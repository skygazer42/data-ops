import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Project, ProjectInput } from '@pro-ops/shared';
import { Database } from '../database/database.js';
import { toActivity, toCheck, toProject } from './project.mapper.js';

const projectSelection = `SELECT p.*, (SELECT row_to_json(h) FROM health_checks h WHERE h.project_id = p.id
  AND h.config_version = p.config_version ORDER BY h.checked_at DESC LIMIT 1) AS latest_check FROM projects p`;

function values(input: ProjectInput) {
  return [input.name, input.description, input.stack, input.environment, input.branch, input.repositoryUrl, input.serviceUrl,
    input.healthUrl, input.monitoringEnabled, input.slowThresholdMs, input.checkIntervalSeconds];
}

@Injectable()
export class ProjectsService {
  constructor(@Inject(Database) private readonly database: Database) {}

  async list(): Promise<Project[]> {
    return (await this.database.query(`${projectSelection} ORDER BY p.created_at, p.name`)).map(toProject);
  }

  async find(id: string): Promise<Project> {
    const [row] = await this.database.query(`${projectSelection} WHERE p.id = $1`, [id]);
    if (!row) throw new NotFoundException('项目不存在或已被移除');
    return toProject(row);
  }

  async create(input: ProjectInput): Promise<Project> {
    const id = randomUUID();
    try {
      await this.database.transaction(async (executor) => {
        await executor.query(`INSERT INTO projects(name, description, stack, environment, branch, repository_url, service_url,
          health_url, monitoring_enabled, slow_threshold_ms, check_interval_seconds, id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [...values(input), id]);
        await executor.query(`INSERT INTO activity(id, project_id, project_name, kind, message) VALUES ($1,$2,$3,'project_created','已添加到工作空间')`, [randomUUID(), id, input.name]);
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
    return this.find(id);
  }

  async update(id: string, input: ProjectInput): Promise<Project> {
    try {
      await this.database.transaction(async (executor) => {
        const updated = await executor.query(`UPDATE projects SET name=$1, description=$2, stack=$3, environment=$4, branch=$5,
          repository_url=$6, service_url=$7, health_url=$8::varchar, monitoring_enabled=$9, slow_threshold_ms=$10, check_interval_seconds=$11,
          config_version=config_version + CASE WHEN health_url IS DISTINCT FROM $8::varchar OR slow_threshold_ms <> $10 THEN 1 ELSE 0 END,
          updated_at=now() WHERE id=$12 RETURNING id`, [...values(input), id]);
        if (!updated.length) throw new NotFoundException('项目不存在或已被移除');
        await executor.query(`INSERT INTO activity(id, project_id, project_name, kind, message) VALUES ($1,$2,$3,'project_updated','更新了项目配置')`, [randomUUID(), id, input.name]);
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
    return this.find(id);
  }

  async remove(id: string): Promise<void> {
    await this.database.transaction(async (executor) => {
      const [removed] = await executor.query('DELETE FROM projects WHERE id=$1 RETURNING name', [id]);
      if (!removed) throw new NotFoundException('项目不存在或已被移除');
      await executor.query(`INSERT INTO activity(id, project_name, kind, message) VALUES ($1,$2,'project_deleted','已从工作空间移除')`, [randomUUID(), removed.name]);
    });
  }

  async checks(id: string) {
    await this.find(id);
    return (await this.database.query('SELECT * FROM health_checks WHERE project_id=$1 ORDER BY checked_at DESC LIMIT 100', [id])).map(toCheck);
  }

  async activity() {
    return (await this.database.query('SELECT * FROM activity ORDER BY created_at DESC LIMIT 100')).map(toActivity);
  }

  private rethrowConflict(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw new ConflictException('这个项目名称已存在，请换一个名称');
    throw error;
  }
}
