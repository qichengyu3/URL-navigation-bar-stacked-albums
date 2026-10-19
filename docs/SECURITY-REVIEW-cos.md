# 安全审查报告 · 对象存储（COS）专项

- 日期：2026-10-18
- 范围：`tab/server`（API + COS 服务）、`tab/client`（前台）、`tab-desktop`（管理端）
- 结论：发现 **2 个高危**、**3 个中危**、若干低危/加固建议。高危已在本轮修复并验证。

---

## 一、已修复（本轮）

### 1）高危 · 公开设置接口泄露 COS 凭据密文

- 位置：`server/src/routes/settings.js` 的 `GET /api/settings`、`GET /api/settings/:key`
- 问题：两个接口只挂了 `optionalAuth`（**未登录即可访问**），却把 Setting 表**全部**键值返回，其中包含 `cos.secretId` / `cos.secretKey` 的 AES 密文。
- 危害：把「待破解样本」直接交给匿名访问者。一旦加密密钥文件泄漏、或密钥强度被低估，可离线爆破出腾讯云密钥，进而完全控制存储桶（删文件、刷流量、产生费用）。
- 修复：接口层加敏感键过滤（`SENSITIVE_KEYS = ['cos.secretId','cos.secretKey']`），列表过滤、单键查询直接 404（不暴露「存在但被拒」）。
- 验证：
  - `GET /api/settings` 返回中只剩 `cos.bucket / cos.region / cos.cdnDomain`
  - `GET /api/settings/cos.secretKey` → `404`

### 2）高危 · 伪造 X-Forwarded-For 绕过所有限流

- 位置：`server/src/index.js`（`app.set('trust proxy', 1)` 无条件开启）、`server/src/middlewares/rateLimit.js`（`clientIp` 直接取 XFF 首段）
- 问题：服务直接对外监听 `0.0.0.0`、前面没有反代时，任何客户端都能自带 `X-Forwarded-For: <任意IP>`，限流键随之每次变化。
- 危害：
  - 登录限流（10 次/15 分钟）失效 → **可无限暴力破解管理员密码**
  - 全局限流（300 次/分钟）和上传限流（120 次/分钟）失效 → **被盗 token 后可无限灌图，直接烧 COS 存储与流量**（正是「对象存储被盗刷」的主要入口之一）
- 修复：
  - `trust proxy` 改为显式开关：仅当 `TRUST_PROXY=1` 时信任代理头
  - `clientIp()` 只使用 `req.ip`（是否采信 XFF 交由 Express 统一判断），不再手读请求头
- 验证：连续 3 次错误登录、每次带不同的伪造 XFF，`X-RateLimit-Remaining` 为 `10 → 9 → 8`（计数共享真实 IP），伪造失效。

### 3）中危 · SSRF 防护可被 3xx 重定向绕过

- 位置：`server/src/services/iconService.js`
- 问题：入口处对目标 URL 做了完整 SSRF 校验，但 `axios` 配置了 `maxRedirects: 3`；攻击者用可控外部站点返回 `302 Location: http://169.254.169.254/...`（云元数据）或内网地址，即可绕过入口校验。
- 修复：增加 `beforeRedirect` 钩子，对**每一跳**做同步粗筛（协议白名单、localhost/.local/.internal/metadata 黑名单、IP 字面量私网段）。属于纵深防御（域名目标在同步钩子里无法做 DNS 解析，仍依赖入口校验）。
- 状态：已实现，需重启后生效（已重启）。

### 4）中危 · 加密密钥加载失败时静默降级为固定弱密钥

- 位置：`server/src/utils/crypto.js`
- 问题：密钥文件读写失败时（如权限问题），代码回退到硬编码的 `dev-insecure-fallback-key`，**生产环境也照此执行**。
- 危害：任何人都能用这个公开的固定值解开 COS 凭据密文。
- 修复：`NODE_ENV=production` 时直接打印 FATAL 并退出；仅开发环境保留降级并告警。

### 5）低危 · 照片删除/修改未校验相册归属

- 位置：`server/src/routes/albums.js`
- 问题：`DELETE /:id/photos/:photoId`、`PUT /:id/photos/:photoId` 只按 `photoId` 查，未校验 `albumId`，可用任意相册 id 操作别册照片。
- 修复：改为 `findFirst({ id, albumId })` 双重匹配。

---

## 二、对象存储专项清单（现状）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 密钥加密存储 | ✅ | AES-256-GCM，密文前缀 `enc:` |
| 加密密钥存放 | ✅ | 优先环境变量 `COS_ENC_KEY`，否则本地文件 `data/.cos-secret`（0600）；`data` 目录未做静态暴露 |
| 密钥回传 | ⚠️ | SecretKey 不回传明文 ✅；`GET /cos/config` 仍回传 **SecretId 明文**（SecretId 非密钥，风险低，可考虑打码） |
| 配置读写鉴权 | ✅ | `/api/cos/*` 全部 `authMiddleware` |
| 上传鉴权 | ✅ | 封面/照片上传均需登录 |
| 上传限流 | ✅（修复后） | 120 次/分钟/IP，且 XFF 伪造已失效 |
| 单文件大小 | ✅ | 15MB（相册）/ 5MB（其他图标） |
| 图片校验 | ✅ | 统一 sharp 转 WebP；`limitInputPixels` 1 亿防解压炸弹；解码失败 400 |
| 文件名/路径穿越 | ✅ | 服务端生成随机 hex 名；目录名走 `sanitizeName` 白名单（仅文字/数字/空格/-_·()） |
| 公开读直链 | ⚠️ | `/api/albums` 公开返回全部封面/照片 URL（前台展示所需） |
| COS 防盗链 | ❌ 未配置 | **控制台需配置 Referer 白名单**，否则任何站点可外链盗刷流量 |
| 用量封顶 | ❌ 未配置 | 建议在 COS 控制台设置流量/请求数日封顶，避免异常消耗 |
| 子账号密钥 | ❌ 未使用 | 当前用主账号密钥；建议改为只授予该桶读写权限的子账号密钥 |
| CDN 加速 | ❌ 未启用 | 启用后配合 CDN 防盗链，可进一步降本并隐藏源站 |

---

## 三、仍建议处理（未改代码）

1. **CORS 默认 `*`**（`config.js`）
   `CORS_ORIGIN` 未设置时回退 `*`，任意站点可跨域读取公开接口。当前用 Bearer + localStorage，CSRF 面不大，但建议生产环境显式设置 `CORS_ORIGIN=https://你的域名`。

2. **JSON 请求体上限 10MB**（`JSON_BODY_LIMIT`）
   全局限流 300 次/分钟 × 10MB 理论上可造成内存放大（约 3GB/分钟）。建议降到 2MB，仅备份恢复接口单独放宽。

3. **`GET /cos/config` 回传 SecretId 明文**
   可改为只回传打码值（如 `AKID****abcd`）+ `hasSecretId`，桌面端留空即保留原值。

4. **错误处理回传 `err.message`**（`index.js` 末尾）
   可能把数据库/内部错误细节暴露给客户端，建议生产环境统一返回通用文案，细节只写日志。

5. **COS 控制台三项配置**（优先级最高，属于「防盗刷」实质手段）
   - 防盗链：Referer 白名单仅放行 `example.com` 及其子域
   - 用量封顶：按日设置流量/请求数上限
   - 子账号：新建仅含该桶读写的子账号，替换主账号密钥

---

## 四、未发现问题的项目（已核查）

- SQL 注入：全部走 Prisma 参数化查询
- 前端 XSS：唯一 `v-html` 用于搜索高亮，`escapeHtml()` 已完整转义后再拼 `<mark>`
- 备份路径穿越：`NAME_RE` 白名单 + `path.resolve` 二次校验目录边界
- 上传目录静态服务：`X-Content-Type-Options: nosniff` + `CSP sandbox`
- SVG 上传：脚本/事件属性/`foreignObject`/XXE 全部拦截
- JWT：生产强制 `JWT_SECRET`，开发随机生成，无硬编码
- 登录：bcrypt + 用户名不存在时走 dummy hash 抹平时序 + 统一错误文案
