import { z } from 'zod';

const safeUrl = z.string().trim().max(2048).refine((value) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && !/[\r\n]/.test(value)
      && !['169.254.169.254', 'metadata.google.internal', '[fd00:ec2::254]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}, '请输入 HTTP(S) 地址，地址中不能包含账号密码或云元数据端点');

export const projectInputSchema = z.strictObject({
  name: z.string().trim().min(1, '请输入项目名称').max(60, '项目名称不能超过 60 个字符'),
  description: z.string().trim().max(240).default(''),
  stack: z.string().trim().max(60).default(''),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
  branch: z.string().trim().min(1).max(80).default('main'),
  repositoryUrl: safeUrl.nullable().default(null),
  serviceUrl: safeUrl.nullable().default(null),
  healthUrl: safeUrl.nullable().default(null),
  monitoringEnabled: z.boolean().default(true),
  slowThresholdMs: z.number().int().min(100).max(30000).default(800),
  checkIntervalSeconds: z.number().int().min(30).max(3600).default(60),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectStatus = 'healthy' | 'slow' | 'down' | 'pending' | 'unconfigured' | 'paused';

export interface HealthCheck {
  id: string;
  projectId: string;
  targetUrl: string;
  configVersion: number;
  status: 'healthy' | 'slow' | 'down';
  httpStatus: number | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

export interface Project extends ProjectInput {
  id: string;
  configVersion: number;
  status: ProjectStatus;
  latestCheck: HealthCheck | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  projectId: string | null;
  projectName: string;
  kind: 'project_created' | 'project_updated' | 'project_deleted' | 'check_healthy' | 'check_slow' | 'check_down';
  message: string;
  createdAt: string;
}

export interface TrendPoint {
  checkedAt: string;
  latencyMs: number | null;
  checks: number;
  failures: number;
}

export interface Dashboard {
  summary: { total: number; healthy: number; attention: number; monitored: number; pending: number };
  projects: Project[];
  trend: TrendPoint[];
  activity: Activity[];
  generatedAt: string;
}

export const statusLabels: Record<ProjectStatus, string> = {
  healthy: '运行正常', slow: '响应偏慢', down: '无法访问', pending: '等待检查', unconfigured: '待接入', paused: '已暂停',
};

export const environmentLabels: Record<ProjectInput['environment'], string> = {
  production: 'Production', staging: 'Staging', development: 'Development',
};
