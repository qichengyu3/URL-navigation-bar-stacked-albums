# Docker 部署

用 Docker Compose 一条命令起整套（前端 + 后端 + 数据库），适合不想手动装 Node、配 Nginx 的场景。

## 前置条件

- 装了 Docker（Windows 是 Docker Desktop，Linux 是 `docker` + `docker compose` 插件）
- 拉取了本仓库代码

## 一条命令部署

```bash
# 1. 进入项目根目录（有 docker-compose.yml 的那层）
cd URL-navigation-bar-stacked-albums

# 2. 设置 JWT 密钥（必填，缺失会拒绝启动）
#    Windows PowerShell:
$env:JWT_SECRET = -join ((48..57)+(97..122) | Get-Random -Count 32 | % {[char]$_})
#    Linux / macOS:
export JWT_SECRET=$(openssl rand -hex 32)

# 3. 构建并后台启动
docker compose up -d --build
```

首次构建会拉镜像、装依赖、打前端，需要几分钟（之后再次启动很快）。

## 访问

| 入口 | 地址 |
|---|---|
| 前台 | http://localhost:8080 |
| 后台 | http://localhost:8080/admin |
| 默认管理员 | `admin / admin12345` |

> 想改默认账号，在 `docker compose up` 前设环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 即可。

## 常用命令

```bash
docker compose up -d --build   # 构建并启动（改代码后重新构建）
docker compose up -d           # 启动（不重新构建）
docker compose logs -f server  # 看后端日志
docker compose down            # 停止并移除容器（数据不丢，在宿主机）
docker compose down -v         # 连同卷一起删（⚠️ 会清空数据库）
```

## 数据存在哪

容器是无状态的，数据都挂在宿主机 `./server/` 下：

| 数据 | 宿主机路径 | 说明 |
|---|---|---|
| SQLite 数据库 | `server/prisma/dev.db` | 全站数据 |
| 上传图标 | `server/uploads/` | favicon |
| 备份快照 | `server/backups/` | 后台备份恢复 |
| COS 解密密钥 | `server/data/` | 配置了对象存储才需要 |

迁移/备份时，把这几个目录连同 `docker-compose.yml` 一起拷走即可。

## 常见问题

**改完代码不生效？**
`docker compose down` 后重新 `docker compose up -d --build`，或用 `--force-recreate`。

**后端起不来 / db push 失败？**
通常是 `JWT_SECRET` 没设，看日志：`docker compose logs server`。

**想换端口？**
把 `docker-compose.yml` 里 `8080:80` 改成 `你想要的端口:80`。

**要挂 HTTPS / 自定义域名？**
Docker 方案默认只跑在 `localhost:8080`。要对外提供 HTTPS，建议外面再套一层 Nginx 反代（见 `docs/DEPLOY.md` 的 Nginx 部分），或直接改用「Nginx + PM2」部署方式。
