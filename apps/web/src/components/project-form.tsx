import { useState, type FormEvent } from 'react';
import { ArrowUpRight, ChevronDown, Link2 } from 'lucide-react';
import { projectInputSchema, type Project, type ProjectInput } from '@pro-ops/shared';
import { api, ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';

interface ProjectFormProps { project: Project | null; onClose: () => void; onSaved: (project: Project) => void }

export function ProjectForm({ project, onClose, onSaved }: ProjectFormProps) {
  const [form, setForm] = useState<ProjectInput>(() => project ? {
    name: project.name, description: project.description, stack: project.stack, environment: project.environment,
    branch: project.branch, repositoryUrl: project.repositoryUrl, serviceUrl: project.serviceUrl, healthUrl: project.healthUrl,
    monitoringEnabled: project.monitoringEnabled, slowThresholdMs: project.slowThresholdMs, checkIntervalSeconds: project.checkIntervalSeconds,
  } : { name: '', description: '', stack: '', environment: 'production', branch: 'main', repositoryUrl: null, serviceUrl: null,
    healthUrl: null, monitoringEnabled: true, slowThresholdMs: 800, checkIntervalSeconds: 60 });
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function change<Key extends keyof ProjectInput>(key: Key, value: ProjectInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFields((current) => ({ ...current, [key]: [] }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = projectInputSchema.safeParse(form);
    if (!parsed.success) { setFields(parsed.error.flatten().fieldErrors); setError('请检查标出的内容'); return; }
    setSaving(true);
    setError('');
    try {
      const saved = project ? await api.update(project.id, parsed.data) : await api.create(parsed.data);
      onSaved(saved);
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally { setSaving(false); }
  }

  const fieldError = (key: string) => fields[key]?.[0] ? <span className="field-error" id={`error-${key}`}>{fields[key]?.[0]}</span> : null;

  return <Modal open onOpenChange={onClose} busy={saving} title={project ? '编辑项目' : '接入一个新项目'}
    description={project ? '更新项目资料与检查方式，历史检查记录会保留。' : '先把项目收进工作空间，再慢慢补齐它的运行信息。'}>
    <form onSubmit={submit} noValidate>
      <div className="form-body">
        <div className="field"><label htmlFor="project-name">项目名称 <span className="required">*</span></label>
          <input id="project-name" autoFocus value={form.name} maxLength={60} placeholder="例如 Weaver" onChange={(event) => change('name', event.target.value)} aria-invalid={Boolean(fields.name?.length)} aria-describedby={fields.name?.length ? 'error-name' : undefined} disabled={saving} />{fieldError('name')}</div>
        <div className="field"><label htmlFor="project-description">一句话介绍 <span className="label-optional">选填</span></label>
          <input id="project-description" value={form.description} maxLength={240} placeholder="这个项目在做什么？" onChange={(event) => change('description', event.target.value)} disabled={saving} />{fieldError('description')}</div>
        <div className="form-row">
          <div className="field"><label htmlFor="project-stack">技术栈 <span className="label-optional">选填</span></label><input id="project-stack" value={form.stack} maxLength={60} placeholder="如 Python / FastAPI" onChange={(event) => change('stack', event.target.value)} disabled={saving} />{fieldError('stack')}</div>
          <div className="field"><label htmlFor="project-environment">运行环境</label><select id="project-environment" value={form.environment} onChange={(event) => change('environment', event.target.value as ProjectInput['environment'])} disabled={saving}><option value="production">Production · 生产环境</option><option value="staging">Staging · 预发布</option><option value="development">Development · 开发环境</option></select>{fieldError('environment')}</div>
        </div>
        <div className="form-monitor-box"><div className="form-section-label"><Link2 size={15} />让运行状态连起来</div>
          <div className="field"><label htmlFor="project-health">健康检查地址 <span className="label-optional">选填</span></label>
            <input id="project-health" type="url" value={form.healthUrl ?? ''} placeholder="https://your-project.com/health" onChange={(event) => change('healthUrl', event.target.value || null)} disabled={saving} aria-invalid={Boolean(fields.healthUrl?.length)} aria-describedby="health-hint" />{fieldError('healthUrl')}
            <span className="field-hint" id="health-hint">填写中台可访问的地址，即可定期检查可用性与响应时间。暂不填写也能保存项目。</span></div>
          <label className="checkbox-label"><input type="checkbox" checked={form.monitoringEnabled} onChange={(event) => change('monitoringEnabled', event.target.checked)} disabled={saving} />启用自动检查</label>
        </div>
        <details className="advanced-settings"><summary>更多项目设置<ChevronDown size={15} /></summary>
          <div className="advanced-fields">
            <div className="field"><label htmlFor="project-repo">仓库地址</label><input id="project-repo" type="url" value={form.repositoryUrl ?? ''} placeholder="https://github.com/…" onChange={(event) => change('repositoryUrl', event.target.value || null)} disabled={saving} />{fieldError('repositoryUrl')}</div>
            <div className="field"><label htmlFor="project-service">项目访问地址</label><input id="project-service" type="url" value={form.serviceUrl ?? ''} placeholder="https://your-project.com" onChange={(event) => change('serviceUrl', event.target.value || null)} disabled={saving} />{fieldError('serviceUrl')}</div>
            <div className="field"><label htmlFor="project-branch">分支</label><input id="project-branch" value={form.branch} maxLength={80} onChange={(event) => change('branch', event.target.value)} disabled={saving} />{fieldError('branch')}</div>
            <div className="form-row"><div className="field"><label htmlFor="project-threshold">偏慢阈值 <span className="label-optional">ms</span></label><input id="project-threshold" type="number" min={100} max={30000} value={form.slowThresholdMs} onChange={(event) => change('slowThresholdMs', Number(event.target.value))} disabled={saving} />{fieldError('slowThresholdMs')}</div>
              <div className="field"><label htmlFor="project-interval">检查间隔 <span className="label-optional">秒</span></label><input id="project-interval" type="number" min={30} max={3600} value={form.checkIntervalSeconds} onChange={(event) => change('checkIntervalSeconds', Number(event.target.value))} disabled={saving} />{fieldError('checkIntervalSeconds')}</div></div>
          </div>
        </details>
        {error && <div className="inline-error" role="alert">{error}</div>}
      </div>
      <div className="dialog-footer"><Button variant="secondary" onClick={onClose} disabled={saving}>取消</Button><Button type="submit" loading={saving}>{project ? '保存修改' : '添加项目'}<ArrowUpRight size={15} /></Button></div>
    </form>
  </Modal>;
}
