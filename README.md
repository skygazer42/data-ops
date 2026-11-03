# Pro Ops

skygazer42 的个人项目管理中台。采用已确认的 **01 松绿工作台 · Fieldwork**，把项目资料、HTTP 运行检查和活动记录放在一起。

## 技术栈

| 部分 | 选择 |
| --- | --- |
| 前端 | React、TypeScript、Vite |
| 界面 | Tailwind CSS、shadcn/ui 组件约定、Radix Dialog、Lucide |
| 后端 | NestJS 模块化单体、REST API |
| 数据 | PostgreSQL；本地开发与测试显式使用 PGlite |
| 部署 | Docker Compose、Nginx |
| 工程 | npm workspaces、共享 Zod 契约、Vitest 接口集成测试 |

## 本地运行

需要 Node.js 24+ 和 npm。在项目根目录运行：

```powershell
npm install
npm run dev
```

- 工作台：`http://127.0.0.1:5173/`
- API 健康接口：`http://127.0.0.1:3001/api/health`
- 原四方向对比：根目录 `index.html`，可以直接离线打开；原有静态服务 `4173` 不受影响。

开发启动器先编译共享契约，再一起启动前后端。默认使用本地嵌入式 PostgreSQL，数据保存在根目录 `.data/pro-ops/`，浏览器刷新和服务重启后可继续读取。首次初始化只预建 MimirQ、Weaver、GustoBot、pokemon-chat、Taroai、DL-Hub 六份项目资料，**不预填运行状态、资源使用或部署记录**。如需空工作空间，在首次启动前设置 `SEED_PROJECTS=false`。

可复制 `.env.example` 为 `.env` 调整配置。使用外部 PostgreSQL 时设置 `DATABASE_MODE=postgres` 和 `DATABASE_URL`，连接失败会明确报错，不会自动切回本地数据库。

## 第一版功能

- 项目新增、详情、编辑、删除与持久化；名称冲突和输入校验。
- 名称、介绍、技术栈搜索，环境和状态筛选，项目排序。
- HTTP(S) 定时检查与立即检查；正常、响应偏慢、不可达、待接入、等待检查和已暂停状态。
- 每个项目最近 100 次检查、过去 6 小时响应趋势、异常/恢复和管理活动。
- `Ctrl K` 项目搜索、详情抽屉、删除确认和窄屏导航。
- 请求失败保留表单输入，后台刷新失败保留最近一次内容。

填写中台可访问的检查地址后即可观测。检查不携带账号密码，不跟随重定向，5 秒超时；HTTP 200–399 视为地址可达，响应超过项目阈值标记为偏慢。这只能反映该地址的响应情况，登录跳转和首页可达不代表全部业务健康，建议使用专门的健康接口。

调度器每 15 秒扫描一次，按项目间隔决定是否检查，自动检查每批最多并行 4 个项目。同一项目、同一配置版本的重叠检查共享一次请求；修改配置后立即检查会使用新配置。项目修改检查地址或响应阈值后，当前状态重新等待检查；旧记录保留原配置快照。检查记录保留 30 天、活动保留 90 天，调度时清理。停机时停止接收新检查并等待正在执行的检查，再关闭数据库。

当前尚未连接真实服务器或运行平台，CPU、内存、服务日志、部署和启停操作需要下一步按实际环境接入。

## Docker Compose 部署

本机必须先启动可用的 Docker Linux 引擎。复制 `.env.example` 为 `.env`，用下列命令生成随机十六进制密码，并填入 `POSTGRES_PASSWORD`：

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
docker compose up --build -d
```

入口为 `http://127.0.0.1:8080/`，可用 `WEB_PORT` 调整。数据库使用持久化卷，API 和数据库不直接发布到宿主机端口。容器内的 `127.0.0.1` 指容器自身；监控其他容器时使用同一网络内的服务名，监控宿主机时按实际 Docker 环境配置可达地址。

本版面向本机单用户，尚无登录与多用户权限。默认监听/发布回环地址；需要远程访问时，应先配置认证和受控的访问入口。

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

接口测试使用独立内存数据库和本地 HTTP 测试服务，不请求真实项目。结构与 API 见 [架构说明](docs/architecture.md)。

## 设计记录

原四方向对比、候选源码、设计说明与截图保留在 `.oil-ui/project-hub-20261102/`。根目录 `index.html` 仍是独立离线对比页。实际应用位于 `apps/web/`，继续使用松绿、暖白、嫩绿，以及 Bahnschrift / 微软雅黑的 01 方向。
