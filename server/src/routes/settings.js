import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, optionalAuth } from '../middlewares/auth.js';

const router = Router();
const prisma = new PrismaClient();

/* 敏感设置项：绝不能从公开接口下发。
   cos.secretId / cos.secretKey 是 AES 密文，虽然不能直接当密钥用，
   但把密文暴露给未登录访问者等于把「待破解的样本」送出去，
   一旦加密密钥泄漏或强度不足，就能离线爆破出腾讯云密钥。 */
const SENSITIVE_KEYS = ['cos.secretId', 'cos.secretKey'];

router.get('/', optionalAuth, async (req, res) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { notIn: SENSITIVE_KEYS } }
    });
    const result = {};
    settings.forEach(setting => {
      result[setting.key] = setting.value;
    });
    res.json(result);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// 读取单个设置项（前端 settingsApi.get(key) 依赖此接口）
// 注意：必须注册在 /:key 语义的其它路由之前，避免被通配路径吃掉
router.get('/:key', optionalAuth, async (req, res) => {
  try {
    const { key } = req.params;

    // 敏感项一律 404（不暴露「存在但被拒绝」的信息）
    if (SENSITIVE_KEYS.includes(key)) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    const setting = await prisma.setting.findUnique({ where: { key } });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json(setting);
  } catch (err) {
    console.error('Get setting error:', err);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    const existing = await prisma.setting.findUnique({ where: { key } });

    let setting;
    if (existing) {
      setting = await prisma.setting.update({
        where: { key },
        data: { value }
      });
    } else {
      setting = await prisma.setting.create({
        data: { key, value }
      });
    }

    res.json(setting);
  } catch (err) {
    console.error('Save setting error:', err);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

router.delete('/:key', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;

    const existing = await prisma.setting.findUnique({ where: { key } });
    if (!existing) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    await prisma.setting.delete({ where: { key } });

    res.json({ message: 'Setting deleted successfully' });
  } catch (err) {
    console.error('Delete setting error:', err);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

export default router;
