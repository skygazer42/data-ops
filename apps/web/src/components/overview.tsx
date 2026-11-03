import { Activity, ArrowRight, ArrowUpRight, Check, CircleAlert, FolderKanban, Link2, Radio } from 'lucide-react';
import type { Dashboard, Project } from '@pro-ops/shared';
import { clockTime, relativeTime } from '@/lib/utils';
import { Button } from './ui/button';
import { StatusBadge } from './project-identity';

export function Metrics({ data }: { data: Dashboard }) {
  const { summary } = data;
  const covered = summary.total ? Math.round(summary.monitored / summary.total * 100) : 0;
  return <section className="metrics" aria-label="运行概况">
    <div className="metric"><div className="metric-label"><FolderKanban size={14} />已管理项目</div><div className="metric-value numeric">{String(summary.total).padStart(2, '0')}<small>个项目</small></div><span className="metric-note">灵感与作品，慢慢积累</span></div>
    <div className="metric"><div className="metric-label"><Activity size={14} />运行正常</div><div className="metric-value numeric">{String(summary.healthy).padStart(2, '0')}<small>个项目</small>{summary.healthy > 0 && <span className="tiny-tag">状态稳定</span>}</div><span className="metric-note">最近一次检查结果</span></div>
    <div className="metric metric-attention"><div className="metric-label"><CircleAlert size={14} />需要关注</div><div className="metric-value numeric">{String(summary.attention).padStart(2, '0')}<small>{summary.attention ? '个项目待查看' : summary.healthy ? '暂无异常' : '等待检查结果'}</small></div><span className="metric-note">响应偏慢或暂时无法访问</span></div>
    <div className="metric"><div className="metric-label"><Radio size={14} />检查覆盖</div><div className="metric-value numeric">{summary.monitored}<span className="metric-divider">/ {summary.total}</span><small>个项目</small></div><div className="coverage-track" aria-label={`检查覆盖 ${covered}%`}><span style={{ width: `${covered}%` }} /></div></div>
  </section>;
}

export function HealthPanels({ data, onOpen, onConnect }: { data: Dashboard; onOpen: (project: Project) => void; onConnect: () => void }) {
  const attention = data.projects.filter((project) => project.status === 'slow' || project.status === 'down').sort((left, right) => Number(right.status === 'down') - Number(left.status === 'down'));
  const issue = attention[0];
  const latest = data.trend.at(-1);
  const checkCount = data.trend.reduce((sum, point) => sum + point.checks, 0);
  const end = Date.parse(data.generatedAt);
  const start = end - 6 * 3600000;
  const maximum = Math.max(100, ...data.trend.map((point) => point.latencyMs ?? 0)) * 1.2;
  let path = '';
  let connected = false;
  for (const point of data.trend) {
    if (point.latencyMs === null) { connected = false; continue; }
    const horizontal = 12 + Math.max(0, Math.min(1, (Date.parse(point.checkedAt) - start) / (end - start))) * 726;
    const vertical = 108 - point.latencyMs / maximum * 86;
    path += `${connected ? 'L' : 'M'}${horizontal.toFixed(1)},${vertical.toFixed(1)} `;
    connected = true;
  }
  return <section className="health-grid">
    <div className="panel pulse-panel"><div className="panel-heading"><h2>运行脉搏 <span>过去 6 小时</span></h2><span className={`live-pill${data.summary.monitored ? '' : ' is-waiting'}`}><i />{data.summary.monitored ? '持续监测中' : '等待接入'}</span></div>
      <div className="chart-legend"><span><i />平均响应 <strong className="numeric">{latest?.latencyMs != null ? `${latest.latencyMs} ms` : '—'}</strong></span><span><i className="legend-light" />检查次数 <strong className="numeric">{checkCount} 次</strong></span></div>
      <div className="pulse-chart"><svg viewBox="0 0 760 126" preserveAspectRatio="none" role="img" aria-label="过去六小时每十五分钟的平均响应时间，未通过的检查不计入响应均值">
        <path d="M12 21H740M12 63H740M12 105H740" stroke="#e7ecdf" strokeWidth="1" strokeDasharray="3 5" />
        {path && <path d={path} fill="none" stroke="#658956" strokeWidth="2.3" strokeLinejoin="round" />}
        {data.trend.map((point) => point.latencyMs === null ? null : <circle key={point.checkedAt} cx={12 + Math.max(0, Math.min(1, (Date.parse(point.checkedAt) - start) / (end - start))) * 726} cy={108 - point.latencyMs / maximum * 86} r="3.5" fill="#658956" stroke="white" strokeWidth="2"><title>{clockTime(point.checkedAt)} · {point.latencyMs} ms · {point.checks} 次检查</title></circle>)}
      </svg>
        {!checkCount && <div className="chart-empty"><span className="chart-empty-symbol"><Activity size={25} /></span><div><strong>从第一次连接，开始了解项目的近况</strong><p>接入检查地址后，真实的响应趋势会出现在这里。</p></div></div>}
        {checkCount > 0 && !path && <div className="chart-empty"><CircleAlert size={20} /><div><strong>这段时间的检查暂未通过</strong><p>打开项目详情，查看检查结果和失败原因。</p></div></div>}
      </div>
      <div className="chart-axis numeric">{[start, start + 2 * 3600000, start + 4 * 3600000, end].map((time) => <span key={time}>{clockTime(new Date(time).toISOString())}</span>)}</div>
    </div>
    <div className={`panel attention-panel${issue ? '' : ' calm-panel'}`}>
      <div className="attention-heading"><span>{issue ? <CircleAlert size={15} /> : data.summary.monitored ? <Check size={15} /> : <Link2 size={15} />}{issue ? '有些近况值得留意' : data.summary.monitored ? '工作空间近况' : '下一步，从这里开始'}</span><span className="numeric">{String(issue ? attention.length : data.summary.pending).padStart(2, '0')}</span></div>
      {issue ? <><div className="issue-name"><strong className="numeric">{issue.name}</strong><StatusBadge status={issue.status} /></div><div className="issue-value numeric">{issue.status === 'slow' ? issue.latestCheck?.latencyMs : issue.latestCheck?.httpStatus ?? '—'}<small>{issue.status === 'slow' ? 'ms / 本次响应' : 'HTTP / 检查结果'}</small></div><p className="issue-description">{issue.latestCheck?.error || `超过 ${issue.slowThresholdMs} ms 阈值，建议查看最近检查。`}</p><div className="attention-bottom"><span>{relativeTime(issue.latestCheck?.checkedAt ?? null)}</span><button onClick={() => onOpen(issue)}>查看详情<ArrowRight size={13} /></button></div></>
        : !data.summary.monitored ? <><h3>给项目，留一扇观察的窗。</h3><p className="onboarding-copy">项目已收进工作空间。连接一个检查地址，就能开始记录它的运行状态。</p><Button variant="ghost" size="small" className="connect-link" onClick={onConnect}>配置项目检查<ArrowUpRight size={15} /></Button><div className="onboarding-footnote"><span className="small-leaf" />一点点接入，慢慢井井有条。</div></>
          : data.summary.healthy === 0 ? <><h3>检查已安排，等第一份近况。</h3><p className="onboarding-copy">已开启 {data.summary.monitored} 个项目的自动检查，新的结果会在这里更新。也可以打开详情，立即检查一次。</p><div className="healthy-stamp"><Radio size={20} /><span>运行状态，正在慢慢连起来。</span></div></>
            : <><h3>暂时没有需要处理的异常。</h3><p className="onboarding-copy">{data.summary.healthy} 个项目通过了最近一次检查。{data.summary.pending ? `还有 ${data.summary.pending} 个项目等待接入或检查。` : '保持创造，项目的近况交给这里。'}</p><div className="healthy-stamp"><Check size={22} /><span>安心，继续手上的事。</span></div></>}
    </div>
  </section>;
}

export function WorkspaceSkeleton() {
  return <div className="workspace-skeleton" aria-label="正在读取工作空间" aria-busy="true"><div className="metrics skeleton-metrics">{[0, 1, 2, 3].map((item) => <div className="metric" key={item}><span className="skeleton skeleton-label" /><span className="skeleton skeleton-value" /></div>)}</div><div className="health-grid"><div className="panel skeleton skeleton-chart" /><div className="panel skeleton skeleton-chart" /></div><div className="panel skeleton-table">{[0, 1, 2, 3].map((item) => <div key={item}><span className="skeleton skeleton-avatar" /><span className="skeleton skeleton-name" /><span className="skeleton skeleton-state" /></div>)}</div></div>;
}
