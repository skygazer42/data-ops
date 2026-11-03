export const initialSchema = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY,
  name varchar(60) NOT NULL CHECK (length(trim(name)) > 0),
  description varchar(240) NOT NULL DEFAULT '',
  stack varchar(60) NOT NULL DEFAULT '',
  environment varchar(20) NOT NULL CHECK (environment IN ('production', 'staging', 'development')),
  branch varchar(80) NOT NULL DEFAULT 'main',
  repository_url varchar(2048),
  service_url varchar(2048),
  health_url varchar(2048),
  monitoring_enabled boolean NOT NULL DEFAULT true,
  slow_threshold_ms integer NOT NULL CHECK (slow_threshold_ms BETWEEN 100 AND 30000),
  check_interval_seconds integer NOT NULL CHECK (check_interval_seconds BETWEEN 30 AND 3600),
  config_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS projects_name_key ON projects (lower(name));
CREATE TABLE IF NOT EXISTS health_checks (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_url varchar(2048) NOT NULL,
  config_version integer NOT NULL,
  status varchar(10) NOT NULL CHECK (status IN ('healthy', 'slow', 'down')),
  http_status integer,
  latency_ms integer,
  error varchar(200),
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checks_project_time ON health_checks(project_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS checks_time ON health_checks(checked_at DESC);
CREATE TABLE IF NOT EXISTS activity (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  project_name varchar(60) NOT NULL,
  kind varchar(30) NOT NULL,
  message varchar(240) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_time ON activity(created_at DESC);
INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
`;

export const seedProjects = [
  ['MimirQ', '让提问，成为理解的开始', 'Python'],
  ['Weaver', '与 AI 一起，把需求织成产品', 'TypeScript'],
  ['GustoBot', '你的私人美食推荐助手', 'TypeScript'],
  ['pokemon-chat', '让伙伴陪你聊聊日常', 'TypeScript'],
  ['Taroai', '随手可用的 AI 能力入口', 'TypeScript'],
  ['DL-Hub', '开发与学习资源，慢慢积累', 'HTML'],
] as const;
