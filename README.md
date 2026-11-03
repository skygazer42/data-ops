<div align="center">
  <img src="docs/images/data-ops.png" alt="Data Ops" width="320" height="320" />
  <p>把项目资料、运行状态和每一次调整，放在同一个工作台。</p>
  <p>
    <a href="#功能">功能</a> ·
    <a href="#快速开始">快速开始</a> ·
    <a href="#docker-部署">Docker 部署</a> ·
    <a href="docs/architecture.md">架构与 API</a>
  </p>
</div>

![Data Ops 工作台：项目概况、响应趋势与项目列表](docs/images/workspace.png)

Data Ops 是 skygazer42 的个人项目管理中台。为项目建一份档案，连接 HTTP(S) 检查地址，就能集中查看运行近况，不用在多个仓库和服务页面之间来回找。

当前版本面向本机单用户，支持项目管理与 HTTP 可用性检查。服务器 CPU、内存、服务日志、部署和启停操作尚未接入，也暂未提供登录与多用户权限。

## 功能

| 页面 | 可以做什么 |
| --- | --- |
| 工作台 | 查看项目总数、运行状态、检查覆盖和过去 6 小时的响应趋势 |
| 我的项目 | 新增、编辑和移除项目，整理介绍、技术栈、环境、仓库、分支与访问地址 |
| 运行监控 | 配置检查地址、响应阈值与检查间隔，发起立即检查，查看最近 100 次检查 |
| 活动日志 | 回看项目变更，以及检查异常、恢复与状态变化 |
| 接入指南 | 按建档、连接地址、首次检查的顺序完成接入 |

项目名称须唯一，表单和接口共用输入校验。项目支持按名称、介绍和技术栈搜索，按运行环境和状态筛选，也可以切换排序。`Ctrl K` 可打开全局项目搜索。详情使用抽屉展示，删除前需要确认，手机端提供折叠导航。

资料和检查记录保存在服务端。提交失败时保留表单输入，后台刷新失败时保留最近一次读取的内容。

## 快速开始

准备 Node.js 24+ 和 npm，在终端执行：

```bash
git clone https://github.com/skygazer42/data-ops.git
cd data-ops
npm install
npm run dev
```

启动器会先编译共享契约，再启动前后端。默认使用 PGlite，本地运行无需单独安装 PostgreSQL。

| 服务 | 地址 |
| --- | --- |
| 工作台 | <http://127.0.0.1:5173/> |
| API 健康检查 | <http://127.0.0.1:3001/api/health> |

### 接入一个项目

1. 在工作台点击「接入项目」，填写名称，可按需补充介绍、技术栈和仓库地址。
2. 填写中台能够访问的 HTTP(S) 检查地址，设置响应阈值和检查间隔。
3. 打开项目详情，点击「立即检查」。开启自动检查后，运行状态会按配置更新。

建议使用专门的健康检查接口。首页可达或跳转到登录页，只能说明这个地址有响应，不能代表全部业务正常。

### 数据与配置

本地数据默认保存在 `.data/pro-ops/`，刷新浏览器或重启服务后仍会保留。首次初始化会为 MimirQ、Weaver、GustoBot、pokemon-chat、Taroai、DL-Hub 建立项目档案，不预填运行状态、资源使用或部署记录。

需要调整配置时，先在根目录复制环境文件，再编辑 `.env`：

```bash
cp .env.example .env
```

如果希望从空工作空间开始，在首次启动前设置 `SEED_PROJECTS=false`。预建项目删除后不会因重启而重新添加。

<details>
<summary>配置项</summary>

| 变量 | 默认值 / 用途 |
| --- | --- |
| `HOST` | API 监听地址，默认 `127.0.0.1` |
| `PORT` | API 端口，默认 `3001` |
| `WEB_ORIGIN` | 允许的浏览器来源，默认 `http://127.0.0.1:5173` |
| `DATABASE_MODE` | 本地默认 `embedded`；外部 PostgreSQL 使用 `postgres` |
| `DATA_DIR` | PGlite 数据目录，默认 `./.data/pro-ops` |
| `DATABASE_URL` | 使用外部 PostgreSQL 时填写连接串 |
| `SEED_PROJECTS` | 是否初始化预建项目，默认 `true` |
| `WEB_PORT` | Docker Web 入口端口，默认 `8080` |
| `POSTGRES_PASSWORD` | Docker PostgreSQL 密码，部署前填写 |

本地连接外部 PostgreSQL 时，在 `.env` 中设置：

```dotenv
DATABASE_MODE=postgres
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/proops
```

将连接串替换为实际数据库配置。连接失败时服务会报错，不会自动切回本地数据库；生产模式要求使用 PostgreSQL。

</details>

<details>
<summary>检查规则与数据保留</summary>

检查只读取 HTTP(S) 响应头，不携带账号密码，不跟随重定向，超时时间为 5 秒。HTTP 状态码为 200 至 399 时视为可达，响应时间超过项目阈值时标记为偏慢。

| 状态 | 含义 |
| --- | --- |
| 待接入 | 尚未填写检查地址 |
| 已暂停 | 已填写地址，但关闭了自动检查 |
| 等待检查 | 当前配置还没有检查结果 |
| 运行正常 | 地址可达，响应时间未超过阈值 |
| 响应偏慢 | 地址可达，响应时间超过阈值 |
| 无法访问 | 网络连接失败、超时，或返回其他 HTTP 状态 |

调度器每 15 秒扫描一次，按各项目的检查间隔决定是否执行，每批最多并行检查 4 个项目。页面每 15 秒刷新数据。同一项目、同一配置版本的重叠检查共享一次请求。

修改检查地址或响应阈值后，项目重新等待检查，旧记录保留原配置快照。修改配置后发起的立即检查使用新配置。服务关闭时停止接收新检查，等待进行中的检查结束后再关闭数据库。

检查记录保留 30 天，活动记录保留 90 天，由调度器清理。

</details>

## Docker 部署

需要可用的 Docker Linux 引擎和 Docker Compose。根目录的配置会启动 Web、API 与 PostgreSQL 三个服务。

1. 将 `.env.example` 复制为 `.env`。
2. 生成随机十六进制密码，将输出填入 `.env` 的 `POSTGRES_PASSWORD`：

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. 启动服务：

   ```bash
   docker compose up --build -d
   ```

打开 <http://127.0.0.1:8080/>，或通过 `WEB_PORT` 修改入口端口。PostgreSQL 使用持久化卷，API 和数据库端口不直接发布到宿主机。

容器里的 `127.0.0.1` 指向容器自身。检查其他容器时使用同一网络中的服务名；检查宿主机服务时，需要使用当前 Docker 环境能够访问的地址。

默认入口只绑定回环地址。需要远程访问时，先配置认证和受控的访问入口。

## 技术栈

| 部分 | 实现 |
| --- | --- |
| 前端 | React、TypeScript、Vite、Tailwind CSS |
| 界面组件 | Radix Dialog、Lucide，复用共享按钮、表单和抽屉样式 |
| 后端 | NestJS 模块化单体、REST API |
| 数据库 | PostgreSQL；本地开发与测试使用 PGlite |
| 接口契约 | Zod 校验、前后端共享类型 |
| 工程与测试 | npm workspaces、ESLint、Vitest 接口集成测试 |
| 部署 | Docker Compose、Nginx |

```text
apps/
  web/             页面、组件、客户端请求与共享样式
  api/             项目管理、HTTP 检查、数据库与接口测试
packages/
  shared/          输入校验、响应类型与状态标签
scripts/dev.mjs    本地开发启动器
deploy/            Nginx 配置
compose.yaml       容器服务定义
docs/              架构说明、验证记录与文档配图
DESIGN.md          界面与字体规范
```

## 开发命令

在仓库根目录运行：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 同时启动前后端 |
| `npm run typecheck` | 编译共享契约，执行各工作区类型检查 |
| `npm run lint` | 检查前后端、共享包和脚本 |
| `npm test` | 运行 API 集成测试 |
| `npm run build` | 构建共享包、API 和 Web |

接口测试使用独立内存数据库和本地 HTTP 测试服务，不请求真实项目。模块职责、接口字段与访问边界见 [架构说明](docs/architecture.md)。

## 界面设计

工作台采用松绿、暖白与嫩绿配色，中文、英文和数字统一使用本地托管的 MiSans VF。字体随应用发布，按页面用到的字符加载。

设计约定见 [DESIGN.md](DESIGN.md)，字体来源与授权见 [MiSans 说明](apps/web/public/fonts/misans/README.md)。
