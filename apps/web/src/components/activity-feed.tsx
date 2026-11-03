import { useEffect, useState } from 'react';
import { Activity as ActivityIcon, ArrowUpRight, Check, CircleAlert, Clock3, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Activity, Project } from '@pro-ops/shared';
import { api } from '@/lib/api';
import { dateTime, errorMessage, relativeTime } from '@/lib/utils';
import { Button } from './ui/button';

const eventIcons = { project_created: Plus, project_updated: Pencil, project_deleted: Trash2, check_healthy: Check, check_slow: Clock3, check_down: CircleAlert };

export function ActivityFeed({ projects, onOpen }: { projects: Project[]; onOpen: (project: Project) => void }) {
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => { void api.activity(controller.signal).then((items) => { setActivity(items); setError(''); }).catch((failure) => { if (!controller.signal.aborted) setError(errorMessage(failure)); }); };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [retry]);
  return <section className="panel activity-panel"><div className="panel-heading"><h2>工作空间足迹 <span>最近 100 条</span></h2><span className="live-pill"><i />自动更新</span></div>
    {error && <div className="inline-error activity-error" role="alert">{error}<Button variant="ghost" size="small" onClick={() => setRetry((current) => current + 1)}>重新读取</Button></div>}
    {!activity && !error && <div className="history-skeleton"><span /><span /><span /></div>}
    {activity?.length === 0 && <div className="table-empty"><span className="empty-icon"><ActivityIcon size={24} /></span><h3>这里会记下每一个新进展</h3><p>添加项目、修改资料或开始检查后，操作记录会出现在这里。</p></div>}
    <div className="activity-list">{activity?.map((item) => {
      const Icon = eventIcons[item.kind];
      const project = projects.find((entry) => entry.id === item.projectId);
      return <article className={`activity-item event-${item.kind}`} key={item.id}><span className="activity-icon"><Icon size={16} /></span><div className="activity-content"><div>{project ? <button className="activity-project numeric" onClick={() => onOpen(project)}>{item.projectName}<ArrowUpRight size={12} /></button> : <strong className="numeric">{item.projectName}</strong>}<span>{item.message}</span></div><time className="numeric" dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div><span className="activity-relative">{relativeTime(item.createdAt)}</span></article>;
    })}</div>
  </section>;
}
