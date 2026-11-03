import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, CircleHelp, ExternalLink, GitBranch, Pencil, Play, Trash2 } from 'lucide-react';
import { environmentLabels, type HealthCheck, type Project } from '@pro-ops/shared';
import { api } from '@/lib/api';
import { dateTime, errorMessage, relativeTime } from '@/lib/utils';
import { ProjectAvatar, StatusBadge } from './project-identity';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';

interface DetailsProps { project: Project; onClose: () => void; onEdit: () => void; onDelete: () => void; onCheck: () => Promise<void>; checking: boolean }

export function ProjectDetails({ project, onClose, onEdit, onDelete, onCheck, checking }: DetailsProps) {
  const [history, setHistory] = useState<HealthCheck[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const checkId = project.latestCheck?.id;

  useEffect(() => {
    const controller = new AbortController();
    void api.checks(project.id, controller.signal).then((checks) => { setHistory(checks); setError(''); }).catch((failure) => {
      if (!controller.signal.aborted) setError(errorMessage(failure));
    });
    return () => controller.abort();
  }, [project.id, checkId, retry]);

  return <Modal open onOpenChange={onClose} title="项目详情" description="资料、运行状态与最近的检查记录。" className="detail-drawer">
    <div className="detail-body">
      <div className="detail-identity"><ProjectAvatar name={project.name} large /><div><h2 className="numeric">{project.name}</h2><p>{project.description || '还没有填写项目介绍'}</p></div></div>
      <div className="detail-status"><StatusBadge status={project.status} /><span>最近检查：{relativeTime(project.latestCheck?.checkedAt ?? null)}</span></div>
      <div className="detail-actions"><Button onClick={() => void onCheck()} loading={checking} disabled={!project.healthUrl}><Play size={14} />立即检查</Button><Button variant="secondary" onClick={onEdit}><Pencil size={14} />编辑项目</Button></div>
      <div className="detail-section"><h3>项目资料</h3><dl className="detail-facts"><div><dt>运行环境</dt><dd className="numeric">{environmentLabels[project.environment]}</dd></div><div><dt>技术栈</dt><dd>{project.stack || '尚未填写'}</dd></div><div><dt>跟踪分支</dt><dd className="numeric"><GitBranch size={13} />{project.branch}</dd></div><div><dt>添加时间</dt><dd className="numeric">{dateTime(project.createdAt)}</dd></div></dl>
        {(project.repositoryUrl || project.serviceUrl) && <div className="project-links">{project.repositoryUrl && <a href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">打开代码仓库<ArrowUpRight size={14} /></a>}{project.serviceUrl && <a href={project.serviceUrl} target="_blank" rel="noopener noreferrer">访问项目<ExternalLink size={13} /></a>}</div>}
      </div>
      <div className="detail-section"><h3>检查配置<Button variant="ghost" size="small" onClick={onEdit}>修改<ArrowUpRight size={12} /></Button></h3>
        {project.healthUrl ? <><div className="endpoint-display numeric">{project.healthUrl}</div><div className="check-settings"><span>每 <b className="numeric">{project.checkIntervalSeconds}</b> 秒检查</span><span>偏慢阈值 <b className="numeric">{project.slowThresholdMs} ms</b></span><span>{project.monitoringEnabled ? '自动检查已开启' : '自动检查已暂停'}</span></div></> : <div className="detail-note"><CircleHelp size={17} /><div><strong>还没有连接运行状态</strong><p>填写健康检查地址后，这里就能看到项目的真实响应情况。</p></div></div>}
        {project.latestCheck?.error && <p className="inline-error">最近一次检查：{project.latestCheck.error}</p>}
      </div>
      <div className="detail-section"><h3><span><Activity size={15} />检查历史</span><small>最近 100 次</small></h3>
        {error && <div className="inline-error" role="alert">{error}<Button variant="ghost" size="small" onClick={() => setRetry((current) => current + 1)}>重试</Button></div>}
        {!history && !error && <div className="history-skeleton" aria-label="正在读取检查记录"><span /><span /><span /></div>}
        {history?.length === 0 && <div className="history-empty"><Activity size={23} /><p>还没有检查记录</p><small>{project.healthUrl ? '点击“立即检查”，看看项目现在怎么样。' : '接入检查地址后，记录会出现在这里。'}</small></div>}
        {Boolean(history?.length) && <div className="history-table-wrap"><table className="history-table"><thead><tr><th>检查时间</th><th>结果</th><th>响应 / HTTP</th></tr></thead><tbody>{history?.map((check) => <tr key={check.id} title={`${check.targetUrl}${check.error ? ` · ${check.error}` : ''}`}><td className="numeric">{dateTime(check.checkedAt)}</td><td><StatusBadge status={check.status} /></td><td className="numeric">{check.latencyMs === null ? '—' : `${check.latencyMs} ms`}<small>{check.httpStatus ?? check.error}</small></td></tr>)}</tbody></table></div>}
      </div>
      <div className="detail-danger"><div><strong>移除项目</strong><p>仅移除中台档案与检查记录。</p></div><Button variant="ghost" size="icon" aria-label={`移除 ${project.name}`} onClick={onDelete}><Trash2 size={16} /></Button></div>
    </div>
  </Modal>;
}

export function DeleteProjectDialog({ project, onClose, onDeleted }: { project: Project; onClose: () => void; onDeleted: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await api.remove(project.id); onDeleted(project.id); onClose(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <Modal open onOpenChange={onClose} title={`移除 ${project.name}？`} description="项目档案与检查历史会被删除，操作记录会保留。代码仓库和实际运行的服务不受影响。" busy={busy} className="confirm-dialog">
    <div className="confirm-body"><div className="confirm-project"><ProjectAvatar name={project.name} /><strong className="numeric">{project.name}</strong><StatusBadge status={project.status} /></div>{error && <div className="inline-error" role="alert">{error}</div>}</div>
    <div className="dialog-footer"><Button variant="secondary" onClick={onClose} disabled={busy}>保留项目</Button><Button variant="danger" loading={busy} onClick={() => void remove()}><Trash2 size={14} />确认移除</Button></div>
  </Modal>;
}
