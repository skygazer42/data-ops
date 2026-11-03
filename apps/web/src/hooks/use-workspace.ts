import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dashboard, Project } from '@pro-ops/shared';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/utils';

function updateProjects(data: Dashboard, projects: Project[]): Dashboard {
  return { ...data, projects, summary: {
    total: projects.length, healthy: projects.filter((project) => project.status === 'healthy').length,
    attention: projects.filter((project) => project.status === 'down' || project.status === 'slow').length,
    monitored: projects.filter((project) => project.monitoringEnabled && project.healthUrl).length,
    pending: projects.filter((project) => ['pending', 'paused', 'unconfigured'].includes(project.status)).length,
  } };
}

export function useWorkspace() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const revision = useRef(0);
  const mounted = useRef(true);

  const refresh = useCallback(() => {
    const requestRevision = ++revision.current;
    return api.dashboard().then((next) => {
      if (mounted.current && revision.current === requestRevision) { setData(next); setError(''); }
    }, (failure: unknown) => {
      if (mounted.current && revision.current === requestRevision) setError(errorMessage(failure));
    }).finally(() => {
      if (mounted.current && revision.current === requestRevision) setLoading(false);
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { mounted.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  function upsert(project: Project) {
    revision.current += 1;
    setData((current) => current ? updateProjects(current, current.projects.some((item) => item.id === project.id)
      ? current.projects.map((item) => item.id === project.id ? project : item) : [...current.projects, project]) : current);
    void refresh();
  }

  function remove(id: string) {
    revision.current += 1;
    setData((current) => current ? updateProjects(current, current.projects.filter((project) => project.id !== id)) : current);
    void refresh();
  }

  return { data, error, loading, refresh, upsert, remove };
}
