import { Router } from 'express';
import { fetchFavicon } from '../services/iconService.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// 图标抓取会由服务端发起外部请求（存在 SSRF 面），必须鉴权。
// 目标地址的安全性由 iconService 内部的 SSRF 守卫进一步校验。
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await fetchFavicon(url);

    if (!result.icon && result.reason) {
      return res.status(400).json({ error: result.reason });
    }

    res.json({ icon: result.icon, iconType: result.iconType });
  } catch (err) {
    console.error('Fetch icon error:', err);
    res.status(500).json({ error: 'Failed to fetch icon' });
  }
});

export default router;
