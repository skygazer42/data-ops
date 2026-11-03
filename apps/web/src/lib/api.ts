import type { Activity, Dashboard, HealthCheck, Project, ProjectInput } from '@pro-ops/shared';

export class ApiError extends Error {
  constructor(message: string, readonly fields: Record<string, string[]> = {}) { super(message); }
}

async function request<Result>(path: string, options: RequestInit = {}): Promise<Result> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, signal: options.signal ?? AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', ...options.headers } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('暂时连接不到工作空间，请检查服务后重试');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[]; fields?: Record<string, string[]> } | null;
    const message = typeof body?.message === 'string' ? body.message : body?.message?.[0];
    throw new ApiError(message ?? '服务暂时不可用，请稍后重试', body?.fields);
  }
  if (response.status === 204) return undefined as Result;
  return response.json() as Promise<Result>;
}

export const api = {
  dashboard: () => request<Dashboard>('/dashboard'),
  activity: (signal?: AbortSignal) => request<Activity[]>('/activity', { signal }),
  project: (id: string) => request<Project>(`/projects/${id}`),
  checks: (id: string, signal?: AbortSignal) => request<HealthCheck[]>(`/projects/${id}/checks`, { signal }),
  create: (input: ProjectInput) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: ProjectInput) => request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  check: (id: string) => request<HealthCheck>(`/projects/${id}/check`, { method: 'POST' }),
};
