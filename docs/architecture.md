# Pro Ops 架构与接入边界

2026-11-03 确认 React + NestJS + PostgreSQL 技术路线，视觉沿用 01 Fieldwork。

## 目录与职责

```text
apps/web/          React 页面、业务组件、表单、客户端请求与样式
apps/api/          NestJS 项目模块、监控模块、数据库适配与接口测试
packages/shared/  Zod 输入契约、响应类型与状态标签
scripts/dev.mjs   本地开发启动器
deploy/           Nginx 配置
compose.yaml      PostgreSQL、API、Web 三个服务
index.html        保留的四方向设计对比
```

前端只通过 API 读取和提交，服务器是项目资料与检查记录的权威来源。共享输入契约用于表单和接口校验。保存成功后用返回的项目更新当前集合，再重新读取总览；后台旧请求有版本序号，不能覆盖后续提交。

本版通过 REST 与 15 秒轮询更新状态，不额外引入消息队列、Redis 或 SSE。项目数量和实际实时需求明确后，再决定是否引入推送。

## API

全部以 `/api` 为前缀，JSON 输入/输出。

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/health` | 检查 API 与数据库连接 |
| GET | `/dashboard` | 项目、统计、六小时趋势、最近十条活动 |
| GET / POST | `/projects` | 查询项目 / 新增项目 |
| GET / PUT / DELETE | `/projects/:id` | 读取 / 完整更新 / 移除项目 |
| POST | `/projects/:id/check` | 立即检查并记录结果 |
| GET | `/projects/:id/checks` | 最近 100 次检查，含原检查地址 |
| GET | `/activity` | 最近 100 条活动 |

`ProjectInput` 字段：`name`、`description`、`stack`、`environment`、`branch`、`repositoryUrl`、`serviceUrl`、`healthUrl`、`monitoringEnabled`、`slowThresholdMs`、`checkIntervalSeconds`。后端严格拒绝未知字段。PUT 接收完整配置；不使用可能在部分更新中覆盖默认值的 PATCH。

名称去掉首尾空白后必填，大小写不敏感唯一。健康地址选填，偏慢阈值 100–30000 ms，检查间隔 30–3600 秒。项目 ID 使用 UUID。数据库使用参数化 SQL、名称唯一索引、外键和事务保护项目与操作记录的一致性。

## 状态与数据

| 状态 | 判断 |
| --- | --- |
| 待接入 | 未填写检查地址 |
| 已暂停 | 有检查地址，自动检查关闭 |
| 等待检查 | 当前配置还没有检查结果 |
| 运行正常 | HTTP 200–399，响应不超过阈值 |
| 响应偏慢 | HTTP 200–399，响应超过阈值 |
| 无法访问 | 网络失败、超时或其他 HTTP 状态 |

状态按当前配置版本的最近一次检查派生。修改健康地址或阈值时递增配置版本，旧检查不再充当当前结果。每条历史记录保存地址和版本，修改期间完成的旧检查依然可以正确归档。删除项目级联删除其检查记录，管理活动保留名称快照。

检查任务按项目 ID 和配置版本去重；修改配置后的手动检查可以检查新地址。HTTP 探测使用 Node HTTP/HTTPS 客户端，允许普通 HTTP 服务使用 6000 等自定义端口，不跟随跳转，只读取响应头并关闭响应体。停机标记阻止新增检查，监控模块等待完整调度轮次和进行中的探测；数据库在 HTTP 服务结束后的应用关闭阶段释放。PostgreSQL 连接池记录后台连接错误，失效的空闲连接由连接池移除。

数据表为 `projects`、`health_checks`、`activity`、`schema_migrations`。初始化表结构由 `apps/api/src/database/schema.ts` 定义；版本 1 表示初始结构，版本 2 表示已经处理过六个项目的可选初始建档。删除预建项目后重启不会自动重新添加。

部署使用 node-postgres；本地和测试通过显式配置使用 PGlite。二者执行同一套 PostgreSQL SQL。生产模式拒绝 embedded 配置，不会自动降级存储。

Compose 中 Nginx 使用 Docker DNS 动态解析 API 服务，缓存 10 秒，API 容器更换地址后无需重启 Web。当前机器的 Docker Linux 引擎不可用，因此容器构建、容器内 Nginx 运行与外部 PostgreSQL 部署仍需在引擎恢复后验收；本地持久化、接口行为和前后端构建使用独立验证。

## 当前信任边界

此版本只用于本地单用户。API 默认绑定 `127.0.0.1`；Compose 只发布回环 Web 端口。浏览器请求限定为配置的 `WEB_ORIGIN`，尚未提供用户认证。无 Origin 的调用视为本机可信工具，Origin 校验不能替代登录权限。

HTTP 检查允许访问本机和私网服务，这是个人运维中台的用途。只接受 HTTP(S)，拒绝 URL 里的账号密码及明确的云元数据端点，不跟随重定向。该限制不是通用 SSRF 隔离：如要开放给其他用户，应先加入鉴权、出站网络策略、DNS/IP 校验和受控目标范围。

不接收任意命令、SSH 密钥或部署凭据，不执行启停/部署。仓库地址只是资料链接。真实服务器、容器或托管平台连接方式需要结合实际部署环境继续确定。
