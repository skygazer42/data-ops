import type { Activity, HealthCheck, Project, ProjectStatus } from '@pro-ops/shared';

export function timestamp(value: unknown): string {
  return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

export function toCheck(row: Record<string, unknown>): HealthCheck {
  return {
    id: String(row.id), projectId: String(row.project_id), targetUrl: String(row.target_url), configVersion: Number(row.config_version),
    status: row.status as HealthCheck['status'], httpStatus: row.http_status === null ? null : Number(row.http_status),
    latencyMs: row.latency_ms === null ? null : Number(row.latency_ms), error: row.error as string | null, checkedAt: timestamp(row.checked_at),
  };
}

export function toProject(row: Record<string, unknown>): Project {
  const latestCheck = row.latest_check ? toCheck(row.latest_check as Record<string, unknown>) : null;
  const status: ProjectStatus = !row.health_url ? 'unconfigured' : !row.monitoring_enabled ? 'paused' : latestCheck?.status ?? 'pending';
  return {
    id: String(row.id), name: String(row.name), description: String(row.description), stack: String(row.stack),
    environment: row.environment as Project['environment'], branch: String(row.branch), repositoryUrl: row.repository_url as string | null,
    serviceUrl: row.service_url as string | null, healthUrl: row.health_url as string | null, monitoringEnabled: Boolean(row.monitoring_enabled),
    slowThresholdMs: Number(row.slow_threshold_ms), checkIntervalSeconds: Number(row.check_interval_seconds), configVersion: Number(row.config_version),
    status, latestCheck, createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
  };
}

export function toActivity(row: Record<string, unknown>): Activity {
  return {
    id: String(row.id), projectId: row.project_id as string | null, projectName: String(row.project_name),
    kind: row.kind as Activity['kind'], message: String(row.message), createdAt: timestamp(row.created_at),
  };
}
