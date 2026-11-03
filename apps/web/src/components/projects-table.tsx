import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpDown, FolderPlus, Search, SlidersHorizontal } from 'lucide-react';
import { environmentLabels, type Project } from '@pro-ops/shared';
import { relativeTime } from '@/lib/utils';
import { ProjectAvatar, StatusBadge } from './project-identity';
import { Button } from './ui/button';

interface ProjectsTableProps { projects: Project[]; title?: string; onOpen: (project: Project) => void; onAdd: () => void; emptyCopy?: { title: string; description: string; action: string } }
type Filter = 'all' | 'healthy' | 'attention' | 'pending';

export function ProjectsTable({ projects, title = '我的项目', onOpen, onAdd, emptyCopy }: ProjectsTableProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [environment, setEnvironment] = useState('all');
  const [sort, setSort] = useState('created');
  const filtered = useMemo(() => projects.filter((project) => {
    const matchesStatus = filter === 'all' || (filter === 'attention' ? ['slow', 'down'].includes(project.status) : filter === 'pending' ? ['pending', 'unconfigured', 'paused'].includes(project.status) : project.status === 'healthy');
    return matchesStatus && (environment === 'all' || project.environment === environment) && `${project.name} ${project.description} ${project.stack}`.toLowerCase().includes(query.trim().toLowerCase());
  }).sort((left, right) => sort === 'name' ? left.name.localeCompare(right.name) : Date.parse(right.createdAt) - Date.parse(left.createdAt)), [projects, query, filter, environment, sort]);
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: '全部项目', count: projects.length },
    { value: 'healthy', label: '运行正常', count: projects.filter((project) => project.status === 'healthy').length },
    { value: 'attention', label: '需要关注', count: projects.filter((project) => ['slow', 'down'].includes(project.status)).length },
    { value: 'pending', label: '待检查', count: projects.filter((project) => ['pending', 'unconfigured', 'paused'].includes(project.status)).length },
  ];

  return <section className="panel projects-panel">
    <div className="projects-panel-heading"><h2>{title}</h2><span className="count-tag numeric">{projects.length}</span><span className="table-caption">每一个项目，都在这里。</span></div>
    <div className="table-toolbar">
      <div className="table-tabs" role="group" aria-label="按运行状态筛选">{filters.map((item) => <button key={item.value} className={filter === item.value ? 'active' : ''} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}<span className="numeric">{item.count}</span></button>)}</div>
      <div className="table-controls"><label className="table-search"><Search size={14} /><input aria-label="搜索项目" placeholder="搜索项目…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="table-select"><SlidersHorizontal size={14} /><select aria-label="筛选运行环境" value={environment} onChange={(event) => setEnvironment(event.target.value)}><option value="all">所有环境</option><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></label>
        <label className="sort-select" title="排序"><ArrowUpDown size={14} /><select aria-label="项目排序" value={sort} onChange={(event) => setSort(event.target.value)}><option value="created">最近添加</option><option value="name">项目名称</option></select></label>
      </div>
    </div>
    <div className="table-scroll"><table className="project-table"><thead><tr><th className="identity-column">项目名称</th><th className="environment-column">环境 / 分支</th><th>运行状态</th><th className="latency-column">响应时间</th><th className="updated-column">最近检查</th><th className="arrow-column"><span className="sr-only">查看详情</span></th></tr></thead>
      <tbody>{filtered.map((project) => <tr key={project.id} onClick={() => onOpen(project)}>
        <td><div className="project-identity"><ProjectAvatar name={project.name} /><div className="identity-copy"><button className="project-name" onClick={(event) => { event.stopPropagation(); onOpen(project); }}>{project.name}</button><p className="project-description" title={project.description}>{project.description || project.stack || '还没有填写项目介绍'}</p></div></div></td>
        <td className="environment-column"><span className="environment-name numeric">{environmentLabels[project.environment]}</span><span className="branch-name numeric">/ {project.branch}</span></td>
        <td><StatusBadge status={project.status} /></td>
        <td className={`latency-column numeric${project.status === 'slow' ? ' warning-text' : ''}`}>{project.latestCheck?.latencyMs != null ? <>{project.latestCheck.latencyMs}<span className="unit"> ms</span></> : <span className="muted-dash">—</span>}</td>
        <td className="updated-column muted-text">{relativeTime(project.latestCheck?.checkedAt ?? null)}</td>
        <td className="arrow-column"><ArrowRight size={16} aria-hidden="true" /></td>
      </tr>)}</tbody></table></div>
    {!filtered.length && <div className="table-empty"><span className="empty-icon"><FolderPlus size={24} /></span><h3>{projects.length ? '没有找到匹配的项目' : emptyCopy?.title ?? '从你的第一个项目开始'}</h3><p>{projects.length ? '试试其他名称、技术栈，或者调整筛选条件。' : emptyCopy?.description ?? '把分散的项目收在一起，留一个随时回来查看的地方。'}</p>
      {projects.length ? <Button variant="secondary" size="small" onClick={() => { setQuery(''); setFilter('all'); setEnvironment('all'); }}>清除筛选</Button> : <Button size="small" onClick={onAdd}>{emptyCopy?.action ?? '接入项目'}</Button>}</div>}
    <div className="table-footer"><span>显示 <b className="numeric">{filtered.length}</b> 个项目<span className="table-total"> / 共 {projects.length} 个</span></span><span>点击项目，查看它的近况<ArrowUpRightIcon /></span></div>
  </section>;
}

function ArrowUpRightIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.4" /></svg>; }
