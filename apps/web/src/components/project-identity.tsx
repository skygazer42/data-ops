import type { ProjectStatus } from '@pro-ops/shared';
import { statusLabels } from '@pro-ops/shared';

export function ProjectAvatar({ name, large = false }: { name: string; large?: boolean }) {
  const palette = [...name].reduce((total, character) => total + character.charCodeAt(0), 0) % 6;
  return <span className={`project-avatar palette-${palette}${large ? ' avatar-large' : ''}`} aria-hidden="true">{name[0]?.toUpperCase()}</span>;
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{statusLabels[status]}</span>;
}
