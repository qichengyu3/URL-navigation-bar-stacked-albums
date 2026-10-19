import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/auth.js';
import { encrypt } from '../utils/crypto.js';
import { readCosConfig, testConnection, clearCosConfigCache } from '../services/cosService.js';

const router = Router();
const prisma = new PrismaClient();

/** 读取配置：SecretKey 不回传明文，只回传是否已设置 */
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const cfg = await readCosConfig();
    res.json({
      secretId: cfg.secretId,
      hasSecretKey: !!cfg.secretKey,
      bucket: cfg.bucket,
      region: cfg.region,
      cdnDomain: cfg.cdnDomain,
      configured: cfg.configured
    });
  } catch (err) {
    console.error('Get COS config error:', err);
    res.status(500).json({ error: '读取对象存储配置失败' });
  }
});

/** 保存配置：SecretId/SecretKey 加密后入库；密钥留空则保留原值 */
router.post('/config', authMiddleware, async (req, res) => {
  try {
    const cur = await readCosConfig();
    const body = req.body || {};
    const secretId = body.secretId && String(body.secretId).trim() ? String(body.secretId).trim() : cur.secretId;
    const secretKey = body.secretKey ? String(body.secretKey) : cur.secretKey;

    const upsert = async (key, value) => {
      const existing = await prisma.setting.findUnique({ where: { key } });
      if (existing) await prisma.setting.update({ where: { key }, data: { value } });
      else await prisma.setting.create({ data: { key, value } });
    };

    await upsert('cos.secretId', encrypt(secretId));
    await upsert('cos.secretKey', encrypt(secretKey));
    await upsert('cos.bucket', String(body.bucket || '').trim());
    await upsert('cos.region', String(body.region || '').trim());
    await upsert('cos.cdnDomain', String(body.cdnDomain || '').trim().replace(/\/+$/, ''));

    // 让内存缓存立即失效，保存后立刻按新配置生效
    clearCosConfigCache();

    res.json({ ok: true, configured: !!(secretId && secretKey && body.bucket && body.region) });
  } catch (err) {
    console.error('Save COS config error:', err);
    res.status(500).json({ error: '保存对象存储配置失败' });
  }
});

/** 测试连接 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const r = await testConnection();
    res.json(r);
  } catch (err) {
    console.error('Test COS error:', err);
    res.status(500).json({ error: '测试连接失败' });
  }
});

export default router;
