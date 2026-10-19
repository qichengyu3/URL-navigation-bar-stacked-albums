import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, optionalAuth } from '../middlewares/auth.js';
import { fetchFavicon } from '../services/iconService.js';
import * as XLSX from 'xlsx';
import { normalizeImportPayload, replaceAllData, collectExportData } from '../services/dataTransfer.js';
import { createBackup } from '../services/backupService.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * 安全解析路径参数中的 id。
 * 非法 id（如 /sites/abc）返回 null，由调用方返回 400，
 * 避免把 NaN 传给 Prisma 导致 500。
 */
function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { categoryId, search } = req.query;

    const where = {};

    if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { url: { contains: search } }
      ];
    }

    const sites = await prisma.site.findMany({
      where,
      include: { category: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
    });

    res.json(sites);
  } catch (err) {
    console.error('Get sites error:', err);
    res.status(500).json({ error: 'Failed to get sites' });
  }
});

router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const categories = await prisma.category.findMany({
      include: { children: { include: { children: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    const sites = await prisma.site.findMany({
      include: { category: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
    });

    if (format === 'excel') {
      const sitesData = sites.map(site => ({
        ID: site.id,
        标题: site.title,
        URL: site.url,
        描述: site.description || '',
        分类: site.category?.name || '',
        分类ID: site.categoryId || '',
        图标: site.icon || '',
        点击次数: site.clickCount || 0
      }));

      const categoriesData = categories.map(cat => ({
        ID: cat.id,
        名称: cat.name,
        Slug: cat.slug,
        父分类ID: cat.parentId || '',
        排序: cat.sortOrder
      }));

      const workbook = XLSX.utils.book_new();
      
      const sitesSheet = XLSX.utils.json_to_sheet(sitesData);
      XLSX.utils.book_append_sheet(workbook, sitesSheet, '网站列表');
      
      const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(workbook, categoriesSheet, '分类列表');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Disposition', `attachment; filename=tabb-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } else {
      // 与备份文件同一套结构，导出的 JSON 可以直接再导入
      const data = await collectExportData({ source: 'manual-export' });

      res.json(data);
    }
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (id === null) {
      return res.status(400).json({ error: 'Invalid site id' });
    }

    const site = await prisma.site.findUnique({
      where: { id },
      include: { category: true }
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json(site);
  } catch (err) {
    console.error('Get site error:', err);
    res.status(500).json({ error: 'Failed to get site' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, url, description, categoryId, categoryIds, icon, iconType } = req.body;

    if (!title || !url || (!categoryId && (!categoryIds || categoryIds.length === 0))) {
      return res.status(400).json({ error: 'Title, URL, and category are required' });
    }

    let finalIcon = icon;
    let finalIconType = iconType || 'auto';

    if (!icon && url) {
      try {
        const faviconResult = await fetchFavicon(url);
        finalIcon = faviconResult.icon;
        finalIconType = 'auto';
      } catch (err) {
        console.log('Failed to fetch favicon:', err.message);
      }
    }

    const primaryCategoryId = categoryIds && categoryIds.length > 0 ? parseInt(categoryIds[0]) : (categoryId ? parseInt(categoryId) : null);
    const finalCategoryIds = categoryIds && categoryIds.length > 0 ? JSON.stringify(categoryIds) : null;

    const site = await prisma.site.create({
      data: {
        title,
        url,
        description,
        categoryId: primaryCategoryId,
        categoryIds: finalCategoryIds,
        icon: finalIcon,
        iconType: finalIconType
      }
    });

    res.json(site);
  } catch (err) {
    console.error('Create site error:', err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'URL already exists' });
    }
    res.status(500).json({ error: 'Failed to create site' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (id === null) {
      return res.status(400).json({ error: 'Invalid site id' });
    }

    const { title, url, description, categoryId, categoryIds, icon, iconType, sortOrder } = req.body;

    const site = await prisma.site.findUnique({ where: { id } });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // 只允许 http/https，避免写入 javascript: 等可执行的 URL
    if (url !== undefined) {
      if (typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ error: 'URL is required' });
      }
      let parsed;
      try {
        parsed = new URL(url.trim());
      } catch {
        return res.status(400).json({ error: 'Invalid URL' });
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).json({ error: 'URL must use http or https' });
      }
    }

    const primaryCategoryId = categoryIds && categoryIds.length > 0 ? parseInt(categoryIds[0]) : (categoryId ? parseInt(categoryId) : undefined);
    const finalCategoryIds = categoryIds && categoryIds.length > 0 ? JSON.stringify(categoryIds) : undefined;

    const updated = await prisma.site.update({
      where: { id },
      data: {
        title,
        url,
        description,
        categoryId: Number.isNaN(primaryCategoryId) ? undefined : primaryCategoryId,
        categoryIds: finalCategoryIds,
        icon,
        iconType,
        sortOrder
      }
    });

    res.json(updated);
  } catch (err) {
    console.error('Update site error:', err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'URL already exists' });
    }
    res.status(500).json({ error: 'Failed to update site' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (id === null) {
      return res.status(400).json({ error: 'Invalid site id' });
    }

    await prisma.site.delete({ where: { id } });

    res.json({ message: 'Site deleted successfully' });
  } catch (err) {
    console.error('Delete site error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

router.post('/:id/refresh-icon', authMiddleware, async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (id === null) {
      return res.status(400).json({ error: 'Invalid site id' });
    }

    const site = await prisma.site.findUnique({ where: { id } });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (!site.url) {
      return res.status(400).json({ error: 'Site URL is required' });
    }

    const faviconResult = await fetchFavicon(site.url);

    if (!faviconResult.icon) {
      return res.status(400).json({ error: faviconResult.reason || '未能抓取到该站点的图标' });
    }

    const updated = await prisma.site.update({
      where: { id },
      data: {
        icon: faviconResult.icon,
        iconType: 'auto'
      }
    });

    res.json(updated);
  } catch (err) {
    console.error('Refresh icon error:', err);
    res.status(500).json({ error: 'Failed to refresh icon' });
  }
});

router.post('/:id/click', optionalAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (id === null) {
      return res.status(400).json({ error: 'Invalid site id' });
    }

    // 事务：自增累计点击 + 写一条点击日志（供按天/周/月/季度统计）
    const updated = await prisma.$transaction(async (tx) => {
      const site = await tx.site.update({
        where: { id },
        data: {
          clickCount: { increment: 1 }
        }
      });
      await tx.clickLog.create({ data: { siteId: id } });
      return site;
    });

    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Site not found' });
    }
    console.error('Click count error:', err);
    res.status(500).json({ error: 'Failed to update click count' });
  }
});

router.post('/batch-delete', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids array' });
    }

    await prisma.site.deleteMany({
      where: {
        id: { in: ids.map(id => parseInt(id)) }
      }
    });

    res.json({ message: 'Sites deleted successfully', count: ids.length });
  } catch (err) {
    console.error('Batch delete error:', err);
    res.status(500).json({ error: 'Failed to batch delete sites' });
  }
});

router.post('/batch-move', authMiddleware, async (req, res) => {
  try {
    const { ids, categoryId, categoryIds } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids array' });
    }

    if (!categoryId && (!categoryIds || categoryIds.length === 0)) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const primaryCategoryId = categoryIds && categoryIds.length > 0 ? parseInt(categoryIds[0]) : parseInt(categoryId);
    const finalCategoryIds = categoryIds && categoryIds.length > 0 ? JSON.stringify(categoryIds) : null;

    await prisma.site.updateMany({
      where: {
        id: { in: ids.map(id => parseInt(id)) }
      },
      data: {
        categoryId: primaryCategoryId,
        categoryIds: finalCategoryIds
      }
    });

    res.json({ message: 'Sites moved successfully', count: ids.length });
  } catch (err) {
    console.error('Batch move error:', err);
    res.status(500).json({ error: 'Failed to batch move sites' });
  }
});

router.post('/batch-sort', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    for (const item of items) {
      await prisma.site.update({
        where: { id: parseInt(item.id) },
        data: { sortOrder: item.sortOrder }
      });
    }

    res.json({ message: 'Sort order updated successfully' });
  } catch (err) {
    console.error('Batch sort error:', err);
    res.status(500).json({ error: 'Failed to update sort order' });
  }
});

router.post('/import', authMiddleware, async (req, res) => {
  try {
    const normalized = normalizeImportPayload(req.body);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const { categories, sites } = normalized;

    // 导入会整体覆盖数据，先自动留一份快照，导入后悔了还能退回去。
    // 快照失败不阻断导入，但会把失败原因回传给前端让用户知情。
    let safetyBackup = null;
    try {
      safetyBackup = await createBackup({ label: '导入前自动备份' });
    } catch (err) {
      console.error('Auto backup before import failed:', err.message);
    }

    // 原子替换：清空与写入在同一事务内，失败整体回滚
    await prisma.$transaction((tx) => replaceAllData(tx, categories, sites));

    res.json({
      message: 'Import completed successfully',
      counts: { categories: categories.length, sites: sites.length },
      safetyBackup: safetyBackup ? safetyBackup.filename : null
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

router.get('/stats/popular', async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10);
    const take = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 10;

    // 只统计真正被点过的站点，否则排行榜会被一堆 0 次点击的站点占满
    const sites = await prisma.site.findMany({
      where: { clickCount: { gt: 0 } },
      orderBy: [{ clickCount: 'desc' }, { id: 'asc' }],
      take,
      include: { category: true }
    });

    res.json(sites);
  } catch (err) {
    console.error('Popular sites error:', err);
    res.status(500).json({ error: 'Failed to get popular sites' });
  }
});

export default router;
