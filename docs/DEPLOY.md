# 部署说明

以「一台 Linux 服务器 + 单域名 + Nginx」为例，宝塔或纯命令行都适用。

## 0. 准备

- Node.js 18+（推荐 20 LTS）
- Nginx
- 一个已解析到服务器的域名（例如 `nav.example.com`）
- 可选：PM2 做进程守护

## 1. 上传代码

```bash
mkdir -p /www/wwwroot/nav
# 把仓库内容放到 /www/wwwroot/nav
cd /www/wwwroot/nav
```

## 2. 构建前端

```bash
cd client
npm install
npm run build          # 产物在 client/dist
```

> 前端接口地址是相对路径 `/api`，不需要改任何业务代码，只要 Nginx 把 `/api` 反代到后端即可。

## 3. 后端安装与初始化

```bash
cd ../server
npm install
cp ../deploy/env.production.example .env
```

编辑 `.env`，**至少**填这几项：

```bash
JWT_SECRET=$(openssl rand -hex 32)   # 必填，缺失会拒绝启动
NODE_ENV=production
HOST=127.0.0.1                        # 只允许 Nginx 访问
CORS_ORIGIN=https://nav.example.com
TRUST_PROXY=1                         # 反代后限流才能拿到真实 IP
```

然后建表并写入演示数据：

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

> `db:seed` 会创建管理员 `admin / admin12345`，请立刻用
> `npm run set-password -- '新密码'` 修改。

### 用 PM2 守护

```bash
npm i -g pm2
pm2 start src/index.js --name nav-api
pm2 save
pm2 startup          # 按提示执行输出的命令，实现开机自启
```

> 如果用宝塔的 Node 项目管理，注意运行用户（通常是 `www`），
> 必须 `chown -R www:www /www/wwwroot/nav`，否则 SQLite 会变成只读。

## 4. Nginx 配置

```bash
cp deploy/nginx.conf.example /etc/nginx/conf.d/nav.conf
vi /etc/nginx/conf.d/nav.conf     # 把 nav.example.com 换成你的域名
```

申请证书（任选其一）：

```bash
# 方式一：certbot
certbot --nginx -d nav.example.com -d www.nav.example.com

# 方式二：宝塔面板 → 网站 → SSL → Let's Encrypt
```

配置里三个容易踩的点：

1. `try_files $uri $uri/ /index.html` —— 少了它，刷新 `/albums`、`/admin` 直接 404
2. `proxy_pass http://127.0.0.1:3001;` —— **结尾不能带 `/`**，否则 `/api` 前缀被截掉，接口全 404
3. `client_max_body_size 30m` —— 少了它上传图片会 413

改完检查并重载：

```bash
nginx -t && systemctl reload nginx
```

## 5. 验证清单

```bash
curl -I https://nav.example.com/            # 200
curl -I https://nav.example.com/albums      # 200（SPA 回退生效）
curl -s https://nav.example.com/api/health  # {"status":"ok"}
curl -I https://nav.example.com/.env        # 403
```

后台 `/admin` 能登录、能新增站点即部署完成。

## 6. 备份

数据库是单个 SQLite 文件 `server/prisma/dev.db`，整套数据都在里面。除此之外要一起备份的还有：

| 内容 | 路径 | 说明 |
|---|---|---|
| 数据库 | `server/prisma/dev.db` | 分类、站点、设置、COS 密文配置 |
| 解密密钥 | `server/data/.cos-secret` | **丢了就解不开已存的 COS 密钥**，需要重填 |
| 上传图标 | `server/uploads/` | 自动抓取的 favicon |

每日备份示例（crontab）：

```bash
0 3 * * * tar czf /www/backup/nav-$(date +\%F).tar.gz \
  /www/wwwroot/nav/server/prisma/dev.db \
  /www/wwwroot/nav/server/data \
  /www/wwwroot/nav/server/uploads
```

## 7. 升级

```bash
cd /www/wwwroot/nav
git pull
cd client && npm install && npm run build
cd ../server && npm install && npx prisma db push
pm2 restart nav-api
```

`prisma db push` 只做结构同步，不会删除已有数据。

## 8. 对象存储（可选）

相册要把图片传到腾讯云 COS：

1. 控制台建桶，拿到 SecretId / SecretKey / Bucket / Region
2. 后台 `设置 → 对象存储` 填入并保存
3. 建议同时配置：**防盗链 Referer 白名单**、**用量封顶**、**子账号密钥**（只给这个桶的读写权限）

没有配置时导航功能不受影响，只是相册上传返回 503。
