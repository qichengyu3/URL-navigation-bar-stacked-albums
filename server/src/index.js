import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import siteRoutes from './routes/sites.js';
import uploadRoutes from './routes/upload.js';
import iconRoutes from './routes/icons.js';
import settingsRoutes from './routes/settings.js';
import backupRoutes from './routes/backup.js';
import statsRoutes from './routes/stats.js';
import albumRoutes from './routes/albums.js';
import cosRoutes from './routes/cos.js';
import { config } from './config.js';
import { createRateLimiter } from './middlewares/rateLimit.js';

const app = express();
const prisma = new PrismaClient();
const PORT = config.port;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 上传目录用绝对路径，避免依赖进程启动时的 cwd
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// 只有明确部署在反向代理（nginx 等）后面才信任 X-Forwarded-For。
// 直接暴露公网时若信任 XFF，客户端可随意伪造该头，每次换一个「IP」，
// 从而绕过登录限流（暴力破解）和上传限流（盗刷对象存储流量）。
// 部署在反代后请设置环境变量 TRUST_PROXY=1。
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

/**
 * CORS 白名单。
 * - CORS_ORIGIN='*'（默认，开发）：放行全部
 * - 生产：写具体域名，多个用英文逗号分隔，如 https://nav.example.com
 * - 无 Origin 的请求（curl、服务端调用）与 Electron 打包后的 file:// 来源（Origin: null）需放行，
 *   否则电脑端「链接速存」连线上 API 会被浏览器 CORS 拦掉。
 *   鉴权走 Authorization: Bearer，不依赖 Cookie，因此放行 null 来源不会带来 CSRF 风险。
 */
const allowedOrigins =
  config.corsOrigin === '*' ? null : config.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || origin === 'null') return cb(null, true);
    if (!allowedOrigins) return cb(null, true);
    return cb(null, allowedOrigins.includes(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 导入/导出可能包含 base64 图标，默认 100kb 会 413
app.use(express.json({ limit: config.jsonBodyLimit }));

// 全局限流：拦住脚本化的批量请求（登录接口另有更严格的失败计数限流）
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300
});

/**
 * 用户上传目录属于不可信内容：
 * - nosniff 阻止浏览器把响应猜成可执行类型
 * - CSP sandbox 让即使存在 SVG/HTML，直接打开时也无法执行脚本、无法访问同源存储
 */
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader('Content-Disposition', 'inline');
  }
}));

// 注意：限流必须在业务路由之前注册，才能覆盖所有 /api 请求
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/icons', iconRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/cos', cosRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unavailable', timestamp: new Date().toISOString() });
  }
});

// /api 下未匹配的路由统一返回 JSON，避免前端拿到 HTML 错误页
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: '请求体过大' });
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// HOST 默认 0.0.0.0（本地开发时手机要能直连）；
// 生产部署在 Nginx 后面时设 HOST=127.0.0.1，让 Node 只监听本机，外网无法绕过 Nginx 直连。
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT} (${config.isProd ? 'production' : 'development'})`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
