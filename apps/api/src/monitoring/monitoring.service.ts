import { BadRequestException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import type { Dashboard, HealthCheck, Project, TrendPoint } from '@pro-ops/shared';
import { Database } from '../database/database.js';
import { ProjectsService } from '../projects/projects.service.js';
import { timestamp, toCheck } from '../projects/project.mapper.js';

export const MONITORING_OPTIONS = Symbol('MONITORING_OPTIONS');
export interface MonitoringOptions { scheduling: boolean; probeTimeoutMs: number }

function probeStatus(address: string, signal: AbortSignal): Promise<number> {
  const target = new URL(address);
  const request = target.protocol === 'https:' ? requestHttps : requestHttp;
  return new Promise((resolve, reject) => {
    const outgoing = request(target, { signal, headers: { 'User-Agent': 'Data-Ops/0.1 health-check' } }, (response) => {
      response.destroy();
      resolve(response.statusCode!);
    });
    outgoing.once('error', reject);
    outgoing.end();
  });
}

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly inFlight = new Map<string, Promise<HealthCheck>>();
  private timer?: ReturnType<typeof setInterval>;
  private polling?: Promise<void>;
  private stopping = false;

  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(MONITORING_OPTIONS) private readonly options: MonitoringOptions,
  ) {}

  onModuleInit() {
    if (this.options.scheduling) {
      this.timer = setInterval(() => {
        void this.poll().catch((error: unknown) => this.logger.error('Scheduled monitoring failed', error instanceof Error ? error.message : 'Unknown error'));
      }, 15000);
      this.timer.unref();
    }
  }

  async check(id: string): Promise<HealthCheck> {
    if (this.stopping) throw new ServiceUnavailableException('工作空间正在关闭，请稍后再试');
    const project = await this.projects.find(id);
    if (this.stopping) throw new ServiceUnavailableException('工作空间正在关闭，请稍后再试');
    const key = `${id}:${project.configVersion}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const pending = this.runCheck(project).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, pending);
    return pending;
  }

  private async runCheck(project: Project): Promise<HealthCheck> {
    const id = project.id;
    if (!project.healthUrl) throw new BadRequestException('请先配置项目的检查地址');
    const started = performance.now();
    const signal = AbortSignal.timeout(this.options.probeTimeoutMs);
    let status: HealthCheck['status'] = 'down';
    let httpStatus: number | null = null;
    let latencyMs: number | null = null;
    let error: string | null = null;
    try {
      httpStatus = await probeStatus(project.healthUrl, signal);
      latencyMs = Math.round(performance.now() - started);
      if (httpStatus >= 200 && httpStatus < 400) status = latencyMs > project.slowThresholdMs ? 'slow' : 'healthy';
      else error = `HTTP ${httpStatus}`;
    } catch {
      error = signal.aborted ? `检查超时（${this.options.probeTimeoutMs} ms）` : '无法连接到检查地址';
    }

    return this.database.transaction(async (executor) => {
      const [row] = await executor.query(`INSERT INTO health_checks(id, project_id, target_url, config_version, status, http_status, latency_ms, error)
        SELECT $1, id, $3, $4, $5, $6, $7, $8 FROM projects WHERE id=$2 RETURNING *`,
      [randomUUID(), id, project.healthUrl, project.configVersion, status, httpStatus, latencyMs, error]);
      if (!row) throw new NotFoundException('项目已被移除，本次检查未保存');
      if (project.latestCheck?.status !== status) {
        const message = status === 'healthy' ? '健康检查通过，服务可以访问' : status === 'slow' ? `响应 ${latencyMs} ms，超过 ${project.slowThresholdMs} ms 阈值` : error ?? '健康检查未通过';
        await executor.query(`INSERT INTO activity(id, project_id, project_name, kind, message)
          SELECT $1, id, name, $3, $4 FROM projects WHERE id=$2 AND config_version=$5`,
        [randomUUID(), id, `check_${status}`, message, project.configVersion]);
      }
      return toCheck(row);
    });
  }

  poll(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.polling) return this.polling;
    this.polling = this.runPoll().finally(() => { this.polling = undefined; });
    return this.polling;
  }

  private async runPoll() {
    const projects = await this.projects.list();
    const due = projects.filter((project) => this.isDue(project));
    for (let offset = 0; offset < due.length; offset += 4) {
      if (this.stopping) return;
      const results = await Promise.allSettled(due.slice(offset, offset + 4).map((project) => this.check(project.id)));
      for (const result of results) if (result.status === 'rejected' && !(result.reason instanceof NotFoundException)) this.logger.error('Project check failed to persist', String(result.reason));
    }
    if (this.stopping) return;
    await this.database.query("DELETE FROM health_checks WHERE checked_at < now() - interval '30 days'");
    await this.database.query("DELETE FROM activity WHERE created_at < now() - interval '90 days'");
  }

  private isDue(project: Project) {
    return project.monitoringEnabled && project.healthUrl && (!project.latestCheck || Date.now() - Date.parse(project.latestCheck.checkedAt) >= project.checkIntervalSeconds * 1000);
  }

  async dashboard(): Promise<Dashboard> {
    const [projects, activity, trendRows] = await Promise.all([
      this.projects.list(), this.projects.activity(),
      this.database.query(`SELECT to_timestamp(floor(extract(epoch FROM checked_at)/900)*900) AS checked_at,
        round(avg(latency_ms) FILTER (WHERE status <> 'down')) AS latency_ms, count(*) AS checks,
        count(*) FILTER (WHERE status='down') AS failures FROM health_checks
        WHERE checked_at > now() - interval '6 hours' GROUP BY 1 ORDER BY 1`),
    ]);
    const trend: TrendPoint[] = trendRows.map((row) => ({ checkedAt: timestamp(row.checked_at), latencyMs: row.latency_ms === null ? null : Number(row.latency_ms), checks: Number(row.checks), failures: Number(row.failures) }));
    return {
      summary: {
        total: projects.length,
        healthy: projects.filter((project) => project.status === 'healthy').length,
        attention: projects.filter((project) => project.status === 'slow' || project.status === 'down').length,
        monitored: projects.filter((project) => project.monitoringEnabled && project.healthUrl).length,
        pending: projects.filter((project) => ['unconfigured', 'pending', 'paused'].includes(project.status)).length,
      },
      projects, trend, activity: activity.slice(0, 10), generatedAt: new Date().toISOString(),
    };
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.inFlight.values(), ...(this.polling ? [this.polling] : [])]);
  }
}
