import { useEffect, useState, useSyncExternalStore } from 'react';
import { Activity, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleAlert, Clock3, FolderKanban, LayoutGrid, Link2, Menu, Plus, Radio, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import type { Project } from '@pro-ops/shared';
import { statusLabels } from '@pro-ops/shared';
import { useWorkspace } from '@/hooks/use-workspace';
import { api } from '@/lib/api';
import { clockTime, errorMessage, relativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { ProjectAvatar, StatusBadge } from '@/components/project-identity';
import { ProjectForm } from '@/components/project-form';
import { ProjectDetails, DeleteProjectDialog } from '@/components/project-details';
import { ProjectsTable } from '@/components/projects-table';
import { HealthPanels, Metrics, WorkspaceSkeleton } from '@/components/overview';
import { ActivityFeed } from '@/components/activity-feed';

const pages = [
  { id: 'overview', label: '工作台', icon: LayoutGrid },
  { id: 'projects', label: '我的项目', icon: FolderKanban },
  { id: 'monitoring', label: '运行监控', icon: Activity },
  { id: 'activity', label: '活动日志', icon: Clock3 },
  { id: 'guide', label: '接入指南', icon: BookOpen },
] as const;
type Page = typeof pages[number]['id'];
function subscribe(listener: () => void) { window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener); }
function routeSnapshot() { const route = window.location.hash.replace('#/', ''); return pages.some((page) => page.id === route) ? route as Page : 'overview'; }
function subscribeNarrowScreen(listener: () => void) { const media = window.matchMedia('(max-width: 700px)'); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); }
function narrowScreenSnapshot() { return window.matchMedia('(max-width: 700px)').matches; }

function Brand() {
  return <div className="brand"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 3v34M3 20h34M8 8l24 24M8 32 32 8" stroke="currentColor" strokeWidth="1.7" /><circle cx="20" cy="20" r="7" fill="#173c32" stroke="currentColor" strokeWidth="1.7" /></svg><div>PRO OPS<small>个人项目管理</small></div></div>;
}

export function App() {
  const page = useSyncExternalStore(subscribe, routeSnapshot);
  const narrowScreen = useSyncExternalStore(subscribeNarrowScreen, narrowScreenSnapshot);
  const { data, error, loading, refresh, upsert, remove } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ project: Project | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'warning' | 'error' } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const currentPage = pages.find((item) => item.id === page)!;
  const selected = data?.projects.find((project) => project.id === selectedId);
  const now = new Date();
  const greeting = now.getHours() < 6 ? '夜深了' : now.getHours() < 12 ? '上午好' : now.getHours() < 18 ? '下午好' : '晚上好';
  const date = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' }).format(now);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); } if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => { document.title = `${currentPage.label} · Pro Ops`; }, [currentPage.label]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 5000); return () => window.clearTimeout(timer); }, [toast]);

  function navigate(next: Page) { window.location.hash = `/${next}`; setMobileOpen(false); }
  function onOpen(project: Project) { setSelectedId(project.id); }
  function onConnect() { const next = data?.projects.find((project) => !project.healthUrl) ?? data?.projects.find((project) => !project.monitoringEnabled) ?? data?.projects[0]; setEditor({ project: next ?? null }); }
  async function check(project: Project) {
    if (checking.has(project.id)) return;
    setChecking((current) => new Set(current).add(project.id));
    try {
      const result = await api.check(project.id);
      const current = await api.project(project.id);
      upsert(current);
      setToast(current.configVersion !== result.configVersion
        ? { message: `${current.name}：检查期间配置已更新，请重新检查当前地址`, kind: 'warning' }
        : { message: `${current.name}：${statusLabels[result.status]}${result.error ? ` · ${result.error}` : ''}`, kind: result.status === 'healthy' ? 'success' : 'warning' });
    } catch (failure) { setToast({ message: errorMessage(failure), kind: 'error' }); }
    finally { setChecking((current) => { const next = new Set(current); next.delete(project.id); return next; }); }
  }
  async function manualRefresh() { setRefreshing(true); await refresh(); setRefreshing(false); }

  return <div className="app-shell">
    {mobileOpen && <button className="nav-backdrop" aria-label="关闭导航" onClick={() => setMobileOpen(false)} />}
    <aside id="workspace-navigation" className={`sidebar${mobileOpen ? ' is-open' : ''}`} inert={narrowScreen && !mobileOpen}>
      <Brand />
      <div className="workspace-name"><span className="workspace-initial numeric">S</span><div><strong>我的工作空间</strong><small>把项目，好好照料。</small></div><span className="workspace-marker" /></div>
      <p className="nav-label">工作空间</p>
      <nav aria-label="主导航">{pages.slice(0, 4).map((item) => <a key={item.id} href={`#/${item.id}`} className={`nav-item${page === item.id ? ' active' : ''}`} aria-current={page === item.id ? 'page' : undefined} onClick={() => setMobileOpen(false)}><item.icon size={18} strokeWidth={1.65} />{item.label}{item.id === 'projects' && <span className="nav-count numeric">{data ? String(data.summary.total).padStart(2, '0') : '—'}</span>}{item.id === 'monitoring' && Boolean(data?.summary.attention) && <span className="nav-alert" />}</a>)}</nav>
      <div className="sidebar-guide"><p className="nav-label">慢慢完善</p><a href="#/guide" className={`nav-item${page === 'guide' ? ' active' : ''}`} aria-current={page === 'guide' ? 'page' : undefined} onClick={() => setMobileOpen(false)}><BookOpen size={18} strokeWidth={1.65} />接入指南<ArrowUpRight size={13} className="nav-trailing" /></a></div>
      <div className="sidebar-bottom"><div className="connection"><p><i className={error ? 'connection-dot disconnected' : loading ? 'connection-dot waiting' : 'connection-dot'} />{error ? '工作空间连接中断' : loading ? '正在连接工作空间' : '工作空间已连接'}</p><small>{data ? `最近同步于 ${clockTime(data.generatedAt)}` : '项目的近况，很快就来。'}</small></div><div className="user-profile"><div className="user-avatar numeric">S</div><div><strong className="numeric">skygazer42</strong><span>个人工作空间</span></div><span className="profile-decoration"><Sparkles size={15} /></span></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><Button className="mobile-menu" variant="ghost" size="icon" aria-label="打开导航" aria-expanded={mobileOpen} aria-controls="workspace-navigation" onClick={() => setMobileOpen((current) => !current)}><Menu size={20} /></Button><div className="breadcrumb">工作空间<ChevronRight size={12} /><span>{currentPage.label}</span></div><div className="topbar-right"><button className="search-shortcut" aria-label="搜索项目" onClick={() => setSearchOpen(true)}><Search size={15} /><span>找一个项目</span><kbd>Ctrl K</kbd></button><span className="topbar-divider" /><time className="topbar-date numeric">{date}</time><Button variant="ghost" size="icon" aria-label="刷新工作空间" onClick={() => void manualRefresh()} loading={refreshing}><RefreshCw size={16} /></Button></div></header>
      <div className="main-content"><section className="page-headline"><div><p className="eyebrow numeric">{page === 'overview' ? 'YOUR PROJECTS, IN GOOD HANDS.' : page === 'projects' ? 'A HOME FOR EVERY PROJECT.' : page === 'monitoring' ? 'KEEP A PULSE ON YOUR PROJECTS.' : page === 'activity' ? 'EVERY LITTLE STEP COUNTS.' : 'LET’S GET THINGS CONNECTED.'}</p><div className="headline-copy"><h1>{page === 'overview' ? `${greeting}，skygazer42` : currentPage.label}</h1><p>{page === 'overview' ? '项目的新进展，从这里开始。' : page === 'projects' ? '把灵感、作品与进行中的事，放在一起。' : page === 'monitoring' ? '及时知道，哪些项目需要你照看。' : page === 'activity' ? '每一次调整，都有迹可循。' : '从项目建档，到第一次真实的检查。'}</p></div></div><Button onClick={() => setEditor({ project: null })} disabled={!data}><Plus size={16} />接入项目</Button></section>
        {error && <div className="workspace-error" role="alert"><CircleAlert size={17} /><span>{error}{data && '，当前保留最近一次读取的内容。'}</span><Button variant="ghost" size="small" onClick={() => void manualRefresh()} loading={refreshing}>重新连接<ArrowRight size={13} /></Button></div>}
        {loading ? <WorkspaceSkeleton /> : data ? <>
          {page === 'overview' && <><Metrics data={data} /><HealthPanels data={data} onOpen={onOpen} onConnect={onConnect} /><ProjectsTable projects={data.projects} onOpen={onOpen} onAdd={() => setEditor({ project: null })} /><footer className="workspace-footer"><span><Clock3 size={12} />{data.activity[0] ? `最近活动：${relativeTime(data.activity[0].createdAt)} · ${data.activity[0].projectName} ${data.activity[0].message}` : '项目已建档。接入检查地址后，近况会自动更新。'}</span><button onClick={() => navigate('activity')}>查看足迹<ArrowUpRight size={12} /></button></footer></>}
          {page === 'projects' && <><div className="page-context"><span><FolderKanban size={16} /><b className="numeric">{data.summary.total}</b> 个项目已在工作空间</span><span>资料可以慢慢补齐，先把项目收好。</span></div><ProjectsTable projects={data.projects} onOpen={onOpen} onAdd={() => setEditor({ project: null })} /></>}
          {page === 'monitoring' && <><Metrics data={data} /><HealthPanels data={data} onOpen={onOpen} onConnect={onConnect} /><ProjectsTable title="已配置检查的项目" projects={data.projects.filter((project) => project.healthUrl)} onOpen={onOpen} onAdd={onConnect} emptyCopy={{ title: '还没有开始观测的项目', description: '给已有项目填写检查地址，就能记录它的运行情况。', action: '配置检查地址' }} /><p className="monitoring-note"><Radio size={13} />按项目配置定期检查，页面每 15 秒刷新。响应可用性与服务器资源分别接入。</p></>}
          {page === 'activity' && <ActivityFeed projects={data.projects} onOpen={onOpen} />}
          {page === 'guide' && <Guide onConnect={onConnect} />}
        </> : <div className="panel disconnected-panel"><Radio size={30} /><h2>暂时还没连接上工作空间</h2><p>项目资料会保存在服务端。连接恢复后，就可以继续管理。</p><Button variant="secondary" onClick={() => void manualRefresh()} loading={refreshing}>重新连接</Button></div>}
      </div>
    </main>
    {selected && !editor && !pendingDelete && <ProjectDetails key={selected.id} project={selected} onClose={() => setSelectedId(null)} onEdit={() => setEditor({ project: selected })} onDelete={() => setPendingDelete(selected)} onCheck={() => check(selected)} checking={checking.has(selected.id)} />}
    {editor && <ProjectForm key={editor.project?.id ?? 'new'} project={editor.project} onClose={() => setEditor(null)} onSaved={(project) => { upsert(project); setToast({ message: editor.project ? '项目资料已更新' : '项目已添加到工作空间', kind: 'success' }); }} />}
    {pendingDelete && <DeleteProjectDialog project={pendingDelete} onClose={() => setPendingDelete(null)} onDeleted={(id) => { remove(id); setSelectedId(null); setToast({ message: '项目已从工作空间移除', kind: 'success' }); }} />}
    {searchOpen && <SearchDialog projects={data?.projects ?? []} onClose={() => setSearchOpen(false)} onOpen={(project) => { setSearchOpen(false); onOpen(project); }} />}
    {toast && <div className={`toast toast-${toast.kind}`} role="status"><span className="toast-symbol">{toast.kind === 'success' ? <Check size={15} /> : <CircleAlert size={15} />}</span><span>{toast.message}</span><button aria-label="关闭提示" onClick={() => setToast(null)}><X size={15} /></button></div>}
  </div>;
}

function SearchDialog({ projects, onClose, onOpen }: { projects: Project[]; onClose: () => void; onOpen: (project: Project) => void }) {
  const [query, setQuery] = useState('');
  const results = projects.filter((project) => `${project.name} ${project.description} ${project.stack}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Modal open onOpenChange={onClose} title="找一个项目" description="按项目名称、介绍或技术栈搜索。" className="search-dialog"><div className="command-search"><Search size={17} /><input autoFocus aria-label="搜索工作空间" placeholder="从这里开始找…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="search-results">{results.length ? results.map((project) => <button className="search-result" key={project.id} onClick={() => onOpen(project)}><ProjectAvatar name={project.name} /><span><strong className="numeric">{project.name}</strong><small>{project.description || project.stack}</small></span><StatusBadge status={project.status} /><ArrowUpRight size={15} /></button>) : <p className="search-empty">没有匹配的项目，换个关键词试试。</p>}</div><div className="search-footer"><span>{results.length} 个匹配项目</span><span><kbd>Esc</kbd> 关闭</span></div></Modal>;
}

function Guide({ onConnect }: { onConnect: () => void }) {
  return <div className="guide-layout"><section className="panel guide-panel"><div className="guide-eyebrow numeric">GETTING STARTED / 01</div><h2>让散落的项目，<br />有一个井井有条的家。</h2><p className="guide-intro">不用一次配好所有东西。先建档，再让运行信息一点点连起来。</p><div className="guide-steps">{[
    ['01', '给项目建一份档案', '填写名称、介绍和技术栈，仓库地址与分支可以随时补充。'],
    ['02', '连接一个检查地址', '填写服务首页或健康检查接口，使用中台所在环境能够访问的 HTTP(S) 地址。'],
    ['03', '看看它现在怎么样', '先做一次立即检查。之后按配置自动检查，异常与恢复会记入活动日志。'],
  ].map(([number, title, copy]) => <div className="guide-step" key={number}><span className="numeric">{number}</span><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div><Button onClick={onConnect}><Link2 size={15} />开始连接项目<ArrowUpRight size={15} /></Button></section><aside className="panel guide-note"><span className="guide-note-icon"><Radio size={24} /></span><h3>目前可以看到什么？</h3><p>项目可用性、响应时间、HTTP 状态，以及每次检查的记录。</p><div className="guide-rule" /><h3>资源与部署怎么接？</h3><p>CPU、内存、服务日志和部署操作，需要连接实际的服务器或运行平台。现在先配置项目地址，后续按你的部署环境继续接入。</p><span className="guide-note-foot"><Sparkles size={14} />一步一步，让管理轻一点。</span></aside></div>;
}
