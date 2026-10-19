import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '../.env');

/**
 * 极简 .env 加载（Node 运行时不会自动读取 .env）。
 * 已存在的环境变量优先级更高，不会被文件覆盖。
 */
function loadEnvFile() {
  try {
    if (!fs.existsSync(ENV_PATH)) return;

    const content = fs.readFileSync(ENV_PATH, 'utf8');

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.warn('[config] failed to load .env:', err.message);
  }
}

loadEnvFile();

const isProd = process.env.NODE_ENV === 'production';

// JWT 密钥：生产环境必须显式提供，否则拒绝启动（避免使用源码里的硬编码默认值）。
let jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  if (isProd) {
    // eslint-disable-next-line no-console
    console.error('[config] FATAL: JWT_SECRET is required in production. Set it via environment variable.');
    process.exit(1);
  }
  // 开发环境：生成一个随机的临时密钥，避免可预测的固定密钥；重启后 token 会失效。
  jwtSecret = crypto.randomBytes(48).toString('hex');
  // eslint-disable-next-line no-console
  console.warn('[config] JWT_SECRET not set — generated an ephemeral random secret (tokens invalidate on restart).');
}

export const config = {
  isProd,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '10mb',
  uploadMaxBytes: 5 * 1024 * 1024,
  // 相册在对象存储里的根目录，可按需改名（如 photos/）
  cosAlbumPrefix: process.env.COS_ALBUM_PREFIX || 'albums',
  loginWindowMs: 15 * 60 * 1000, // 登录限流窗口：15 分钟
  loginMaxAttempts: 10 // 每个 IP 15 分钟内最多 10 次
};
