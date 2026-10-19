import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * 计算时间维度起点（本地时区，周一为一周开始）
 */
function rangeStart(range) {
  const now = new Date();
  switch (range) {
    case 'today': {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    case 'week': {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = d.getDay(); // 0=周日
      const diff = day === 0 ? 6 : day - 1; // 回退到本周一
      d.setDate(d.getDate() - diff);
      return d;
    }
    case 'month': {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    case 'quarter': {
      const qm = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), qm, 1);
    }
    default:
      return null;
  }
}

/** 把站点点击归并到分类维度 */
function aggregateCategories(topSites) {
  const map = new Map();
  for (const item of topSites) {
    const s = item.site;
    const cid = s.categoryId ?? 'none';
    const cur = map.get(cid) || {
      categoryId: s.categoryId,
      name: s.category?.name || '未分类',
      clicks: 0
    };
    cur.clicks += item.clicks;
    map.set(cid, cur);
  }
  return [...map.values()].sort((a, b) => b.clicks - a.clicks);
}

/**
 * GET /api/stats/clicks?range=today|week|month|quarter|all
 * 多维度点击量排名：站点维度 + 分类维度
 */
router.get('/clicks', authMiddleware, async (req, res) => {
  try {
    const range = req.query.range || 'today';

    // 「累计」维度直接读 clickCount（含 ClickLog 表建立之前的历史点击）
    if (range === 'all') {
      const sites = await prisma.site.findMany({
        where: { clickCount: { gt: 0 } },
        orderBy: [{ clickCount: 'desc' }, { id: 'asc' }],
        take: 100,
        include: { category: true }
      });
      const topSites = sites.map((s) => ({ site: s, clicks: s.clickCount }));
      return res.json({
        range,
        totalClicks: sites.reduce((sum, s) => sum + s.clickCount, 0),
        activeSites: sites.length,
        topSites,
        topCategories: aggregateCategories(topSites)
      });
    }

    // 其余维度：按 ClickLog 时间范围聚合
    const start = rangeStart(range);
    const where = start ? { createdAt: { gte: start } } : {};

    const groups = await prisma.clickLog.groupBy({
      by: ['siteId'],
      where,
      _count: { siteId: true },
      orderBy: { _count: { siteId: 'desc' } },
      take: 100
    });

    const siteIds = groups.map((g) => g.siteId);
    const sites = siteIds.length
      ? await prisma.site.findMany({
          where: { id: { in: siteIds } },
          include: { category: true }
        })
      : [];

    const siteMap = new Map(sites.map((s) => [s.id, s]));
    const topSites = groups
      .map((g) => ({ site: siteMap.get(g.siteId), clicks: g._count.siteId }))
      .filter((x) => x.site);

    const totalClicks = topSites.reduce((sum, x) => sum + x.clicks, 0);

    res.json({
      range,
      totalClicks,
      activeSites: topSites.length,
      topSites,
      topCategories: aggregateCategories(topSites)
    });
  } catch (err) {
    console.error('Stats clicks error:', err);
    res.status(500).json({ error: 'Failed to get click stats' });
  }
});

export default router;
