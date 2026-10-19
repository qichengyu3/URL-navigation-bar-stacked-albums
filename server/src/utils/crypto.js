import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const KEY_FILE = path.join(DATA_DIR, '.cos-secret');

/**
 * 加密密钥来源（优先级从高到低）：
 * 1. 环境变量 COS_ENC_KEY（生产建议显式提供）
 * 2. 服务器本地文件 data/.cos-secret（首次运行自动生成，权限 600）
 * 这样即使数据库（存储的是密文）泄露，没有本机密钥文件也无法解密 COS 密钥。
 */
function getKey() {
  if (process.env.COS_ENC_KEY) return process.env.COS_ENC_KEY;
  try {
    if (fs.existsSync(KEY_FILE)) {
      const k = fs.readFileSync(KEY_FILE, 'utf8').trim();
      if (k) return k;
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const k = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(KEY_FILE, k, { mode: 0o600 });
    return k;
  } catch (err) {
    // 生产环境绝不能静默降级到固定弱密钥（等于所有人都能解密 COS 凭据）
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error('[crypto] FATAL: 无法读取/生成加密密钥文件，且未设置 COS_ENC_KEY。', err.message);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.warn('[crypto] failed to load/generate COS key:', err.message);
    return 'dev-insecure-fallback-key';
  }
}

// 统一派生为 32 字节的 AES-256 密钥
const KEY = crypto.createHash('sha256').update(getKey()).digest();

/** AES-256-GCM 加密，输出带 'enc:' 前缀的 base64（iv+tag+cipher） */
export function encrypt(plain) {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}

/** 解密 encrypt() 的输出；失败返回空串（不抛错，避免拖垮接口） */
export function decrypt(ciphertext) {
  if (!ciphertext || !String(ciphertext).startsWith('enc:')) return '';
  try {
    const buf = Buffer.from(String(ciphertext).slice(4), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
