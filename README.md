# TabHub 导航

一个干净、顺手的个人网址导航站。Vue 3 + Express + Prisma + SQLite，单机即可跑起来，也支持对象存储托管相册。

> 开箱自带 **20 个分类 / 100 个站点** 的演示数据，全部是公开网站，登录后台就能改成自己的收藏。

![桌面端预览](docs/screenshot.png)

<p align="center">
  <img src="docs/screenshot-mobile.png" width="300" alt="移动端预览" />
</p>

## ✨ 功能

**前台**

- 分类侧边栏 + 站点卡片，液态玻璃页眉，暗色模式
- 多引擎搜索框，热门推荐按点击量自动排序
- 公告条、站点 Logo 与名称可在后台自定义
- 相册模块：散落式照片墙（桌面）/ 竖排卡片（手机），灯箱支持旋转、缩放、左右切换
- 相册详情走「缩略图 + 大图」双尺寸，首屏只加载缩略图
- 全局单例音乐播放器，跨路由切换不断播
- 完整移动端适配（抽屉式分类、防止横向溢出）

**后台（/admin）**

- JWT 登录鉴权，登录与上传接口都有独立限流
- 分类增删改、站点增删改、拖拽排序
- 自动抓取站点 favicon 并转存本地（带 SSRF 防护）
- 一键备份 / 恢复，服务端保留最近若干份
- JSON 批量导入导出、Excel 导出
- 站点设置：名称、副标题、公告、热门搜索、Logo、背景音乐

**对象存储（可选）**

- 相册图片可托管到腾讯云 COS，SecretId / SecretKey 经 AES-256-GCM 加密后入库
- 上传自动转 WebP，并生成 1600px 主图 + 800px 缩略图
- 删库不删文件：删除相册只删数据库记录，对象存储里的原图保留

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3、Vite、Vue Router、Pinia、Tailwind CSS、Element Plus |
| 后端 | Express 4（ESM） |
| 数据库 | SQLite + Prisma |
| 图片处理 | sharp（WebP 转码 / 缩略图） |
| 对象存储 | 腾讯云 COS（可选） |
| 部署 | Nginx 反代 / Docker Compose |

## 📁 目录结构

```
.
├── client/                 前端（Vue 3 + Vite）
│   ├── src/
│   │   ├── views/          首页、相册、详情、后台
│   │   ├── components/     音乐播放器、通用组件
│   │   ├── composables/    音乐播放单例等
│   │   └── api/            接口封装（baseURL 为相对路径 /api）
│   └── vite.config.js
├── server/                 后端（Express + Prisma）
│   ├── prisma/
│   │   ├── schema.prisma   数据模型
│   │   ├── demo-data.js    演示数据（100 条）
│   │   └── seed.js         初始化脚本
│   ├── src/
│   │   ├── routes/         auth / sites / categories / albums / cos / settings …
│   │   ├── services/       COS、图标抓取、备份、SSRF 防护
│   │   ├── middlewares/    鉴权、限流
│   │   └── utils/          加密、图片处理
│   └── scripts/            改密码、图标迁移、缩略图回填
├── deploy/                 Nginx 示例、生产 env 模板、打包脚本
└── docs/                   部署说明与安全审查记录
```

## 🚀 快速开始

需要 Node.js 18+（推荐 20）。

```bash
# 1. 后端
cd server
npm install
cp .env.example .env          # 开发环境可直接用默认值
npx prisma db push            # 建表（生成 prisma/dev.db）
npm run db:seed               # 写入 20 个分类 + 100 个站点 + 管理员
npm run dev                   # http://localhost:3001

# 2. 前端（另开一个终端）
cd client
npm install
npm run dev                   # http://localhost:5173
```

默认管理员：`admin / admin12345`（可在 seed 前用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 环境变量覆盖）。

**第一次登录后请立刻改密码：**

```bash
cd server
npm run set-password -- '你的新密码'
```

### 环境变量

复制 `server/.env.example` 为 `server/.env`，常用项：

| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | token 签名密钥；生产必填，`openssl rand -hex 32` |
| `PORT` | 服务端口，默认 3001 |
| `HOST` | 监听地址；放在 Nginx 后面时用 `127.0.0.1` |
| `CORS_ORIGIN` | 允许的来源，多个用逗号分隔；开发用 `*` |
| `TRUST_PROXY` | 位于反向代理后必须设为 `1`，否则限流拿不到真实 IP |
| `COS_ENC_KEY` | 解密 COS 密钥的主密钥；不填则自动生成到 `server/data/.cos-secret` |
| `COS_ALBUM_PREFIX` | 相册在对象存储里的根目录，默认 `albums` |

## 🖼 相册与对象存储

相册为了不把图片塞进仓库，走对象存储：

1. 在腾讯云 COS 建一个存储桶，拿到 SecretId / SecretKey、Bucket、Region
2. 登录后台 `设置 → 对象存储`，填入并保存（服务端会加密入库，只回传「是否已配置」）
3. 上传照片时会自动转 WebP，并生成缩略图

没有配置 COS 时，站点导航功能完全可用，只有相册上传会返回 `503`。

## 📦 部署

单域名方案：Nginx 托管前端静态文件，`/api/` 与 `/uploads/` 反代到 3001。

- `deploy/nginx.conf.example`：站点配置示例（改域名即可用）
- `deploy/env.production.example`：生产环境变量模板
- `deploy/package-deploy.sh`：一键打部署包
- `docs/DEPLOY.md`：从零部署的完整步骤和常见坑

也可以直接用 Docker：

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose up -d --build
# 前端 http://localhost:8080
```

## 🔒 安全设计

- 密钥加密存储：COS SecretId / SecretKey 用 AES-256-GCM 加密入库，读接口不回传明文
- 敏感配置过滤：公开的设置接口会剔除 `cos.secretId` / `cos.secretKey`
- 限流：登录按 IP 限次；上传单独限流；只有 `TRUST_PROXY=1` 时才信任 `X-Forwarded-For`，防伪造绕过
- 上传校验：图片解码失败直接拒绝，限制像素总量防解压炸弹，统一转 WebP
- 图标抓取：DNS 解析 + 逐跳重定向校验，挡内网与元数据地址（SSRF）
- 隐藏文件拒绝访问（`.env`、`.git`、密钥文件）

安全审查记录见 `docs/SECURITY-REVIEW-cos.md` 与 `docs/SECURITY-REVIEW-albums.md`。

## 📄 License

[MIT](./LICENSE)
