import COS from 'cos-nodejs-sdk-v5';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/crypto.js';

const prisma = new PrismaClient();

const COS_KEYS = ['cos.secretId', 'cos.secretKey', 'cos.bucket', 'cos.region', 'cos.cdnDomain'];

/* ---- 配置缓存 ----
   相册列表/详情每次请求都要拼图片 URL，如果每次都查库 + AES 解密 + new COS()，
   在图片墙这种高频读场景下是纯浪费。这里做 60s 内存缓存，配置保存时主动失效。 */
const CONFIG_TTL = 60 * 1000;
let cfgCache = null;
let cfgCacheAt = 0;
let clientCache = null;
let clientSig = '';

/**
 * 从 Setting 表读取 COS 配置，SecretId/SecretKey 为密文，这里解密。
 * 注意：该配置仅通过 /api/cos/config（需登录）读写，不出现在公开设置接口里。
 */
export async function readCosConfig({ fresh = false } = {}) {
  if (!fresh && cfgCache && Date.now() - cfgCacheAt < CONFIG_TTL) return cfgCache;

  const rows = await prisma.setting.findMany({ where: { key: { in: COS_KEYS } } });
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });

  const secretId = decrypt(map['cos.secretId']);
  const secretKey = decrypt(map['cos.secretKey']);
  const bucket = map['cos.bucket'] || '';
  const region = map['cos.region'] || '';
  const cdnDomain = (map['cos.cdnDomain'] || '').trim().replace(/\/+$/, '');

  const cfg = {
    secretId,
    secretKey,
    bucket,
    region,
    cdnDomain,
    configured: !!(secretId && secretKey && bucket && region)
  };

  cfgCache = cfg;
  cfgCacheAt = Date.now();
  return cfg;
}

/** 配置变更后调用，让缓存立即失效（否则要等 60s 才生效） */
export function clearCosConfigCache() {
  cfgCache = null;
  cfgCacheAt = 0;
  clientCache = null;
  clientSig = '';
}

/** 组装完整的公网 URL（优先 CDN 域名；域名无协议前缀时自动补 https://）
 *  逐段 encodeURIComponent：相册名可能是中文/空格，直接拼进 URL 在部分客户端会出错 */
export function buildUrl(cfg, key) {
  if (!cfg) return '';
  const encoded = String(key).split('/').map(encodeURIComponent).join('/');
  if (cfg.cdnDomain) {
    const base = /^https?:\/\//i.test(cfg.cdnDomain) ? cfg.cdnDomain : `https://${cfg.cdnDomain}`;
    return base + '/' + encoded;
  }
  return `https://${cfg.bucket}.cos.${cfg.region}.myqcloud.com/${encoded}`;
}

/**
 * 按 key 生成当前生效的公网 URL。
 * 相册接口对外输出时统一用它，而不是直接吐数据库里存的 url ——
 * 这样以后从「源站域名」切到「CDN 域名」时，存量数据不用改一行。
 */
export async function publicUrlFor(key, fallback = '') {
  if (!key) return fallback;
  const cfg = await readCosConfig();
  return cfg.configured ? buildUrl(cfg, key) : fallback;
}

/** 获取已就绪的 COS 客户端（复用实例）；未配置时返回 null */
export async function getCos() {
  const cfg = await readCosConfig();
  if (!cfg.configured) return null;

  const sig = cfg.secretId + '|' + cfg.secretKey;
  if (!clientCache || clientSig !== sig) {
    clientCache = new COS({ SecretId: cfg.secretId, SecretKey: cfg.secretKey });
    clientSig = sig;
  }
  return { cfg, client: clientCache };
}

export function uploadObject(cos, key, body, contentType) {
  return new Promise((resolve, reject) => {
    cos.client.putObject(
      {
        Bucket: cos.cfg.bucket,
        Region: cos.cfg.region,
        Key: key,
        Body: body,
        ContentType: contentType,
        // 内容寻址（key 带随机串，永不覆盖复用）→ 可以安全地给一年强缓存，
        // 浏览器命中后不再回源，这是省流量最关键的一环
        CacheControl: 'public, max-age=31536000, immutable'
      },
      (err, data) => (err ? reject(err) : resolve(data))
    );
  });
}

export function deleteObject(cos, key) {
  return new Promise((resolve, reject) => {
    cos.client.deleteObject(
      { Bucket: cos.cfg.bucket, Region: cos.cfg.region, Key: key },
      (err, data) => (err ? reject(err) : resolve(data))
    );
  });
}

/** 测试连接：headBucket 校验配置是否有效 */
export function testConnection() {
  return getCos().then((cos) => {
    if (!cos) return { ok: false, error: '对象存储尚未配置完整' };
    return new Promise((resolve) => {
      cos.client.headBucket({ Bucket: cos.cfg.bucket, Region: cos.cfg.region }, (err) => {
        resolve(err ? { ok: false, error: err.message } : { ok: true });
      });
    });
  });
}
