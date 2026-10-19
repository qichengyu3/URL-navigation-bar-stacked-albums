import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();
const prisma = new PrismaClient();

/** 解析路径/查询参数里的整数 id，非法一律返回 null */
function parseId(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** 从 categoryIds（JSON 字符串）里读出数字数组，坏数据当空数组 */
function readCategoryIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

/** 递归收集某个分类及其全部后代的 id（删分类时用于连锁清理） */
async function collectDescendantIds(rootId) {
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const childrenOf = new Map();
  for (const c of all) {
    if (c.parentId == null) continue;
    if (!childrenOf.has(c.parentId)) childrenOf.set(c.parentId, []);
    childrenOf.get(c.parentId).push(c.id);
  }

  const result = [];
  const stack = [rootId];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    result.push(current);
    for (const child of childrenOf.get(current) || []) stack.push(child);
  }
  return result;
}

router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { sites: true } } },
      orderBy: { sortOrder: 'asc' }
    });
    res.json(categories);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

router.get('/tree', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        children: {
          include: {
            children: {
              include: { _count: { select: { sites: true } } }
            },
            _count: { select: { sites: true } }
          }
        },
        _count: { select: { sites: true } }
      },
      where: { parentId: null },
      orderBy: { sortOrder: 'asc' }
    });
    res.json(categories);
  } catch (err) {
    console.error('Get categories tree error:', err);
    res.status(500).json({ error: 'Failed to get categories tree' });
  }
});

// 注意：/reorder 必须注册在 /:id 之前，否则 "reorder" 会被当成 id 解析成 NaN
router.put('/reorder', authMiddleware, async (req, res) => {
  try {
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'categories must be an array' });
    }
    if (categories.length === 0) {
      return res.status(400).json({ error: 'categories is empty' });
    }

    const parsed = [];
    for (const item of categories) {
      const id = parseId(item?.id);
      const sortOrder = Number(item?.sortOrder);
      if (id === null || !Number.isFinite(sortOrder)) {
        return res.status(400).json({ error: 'Invalid category item' });
      }
      parsed.push({ id, sortOrder });
    }

    // 只允许更新真实存在的分类，避免幽灵 id 让整批失败
    const existing = await prisma.category.findMany({
      where: { id: { in: parsed.map((p) => p.id) } },
      select: { id: true }
    });
    const existingIds = new Set(existing.map((c) => c.id));
    const valid = parsed.filter((p) => existingIds.has(p.id));

    if (valid.length === 0) {
      return res.status(400).json({ error: 'No valid categories to reorder' });
    }

    await prisma.$transaction(
      valid.map(({ id, sortOrder }) =>
        prisma.category.update({ where: { id }, data: { sortOrder } })
      )
    );

    res.json({ message: 'Categories reordered successfully', updated: valid.length });
  } catch (err) {
    console.error('Reorder categories error:', err);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: { children: true }
    });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ error: 'Failed to get category' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, slug, parentId, sortOrder } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    if (parentId !== undefined && parentId !== null) {
      const pid = parseId(parentId);
      if (pid === null) {
        return res.status(400).json({ error: 'Invalid parentId' });
      }
      const parent = await prisma.category.findUnique({ where: { id: pid } });
      if (!parent) {
        return res.status(400).json({ error: 'Parent category not found' });
      }
    }

    const existing = await prisma.category.findFirst({
      where: { OR: [{ name }, { slug }] }
    });

    if (existing) {
      return res.status(400).json({ error: 'Name or slug already exists' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        parentId: parentId || null,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0
      }
    });

    res.json(category);
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(400).json({ error: 'Name or slug already exists' });
    }
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    const { name, slug, parentId, sortOrder } = req.body;

    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // 不允许把父分类指向自己或自己的后代（会形成环，导致树遍历死循环）
    const nextParentId = parentId === undefined ? undefined : parentId === null ? null : parseId(parentId);
    if (nextParentId !== undefined && nextParentId !== null) {
      if (nextParentId === id) {
        return res.status(400).json({ error: 'A category cannot be its own parent' });
      }
      const descendants = await collectDescendantIds(id);
      if (descendants.includes(nextParentId)) {
        return res.status(400).json({ error: 'Cannot set a descendant category as parent' });
      }
    }

    if (name || slug) {
      const conflict = await prisma.category.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: [name ? { name } : {}, slug ? { slug } : {}].filter((o) => Object.keys(o).length) }
          ]
        }
      });
      if (conflict) {
        return res.status(400).json({ error: 'Name or slug already exists' });
      }
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (nextParentId !== undefined) data.parentId = nextParentId;
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

    const updated = await prisma.category.update({ where: { id }, data });

    res.json(updated);
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(400).json({ error: 'Name or slug already exists' });
    }
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid category id' });
    }

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // 删除前先算出会被牵连的分类（自身 + 全部后代），用于清理站点上的死引用
    const affectedIds = await collectDescendantIds(id);
    const affected = new Set(affectedIds);

    const result = await prisma.$transaction(async (tx) => {
      // 站点不会跟着删除：只把被删分类从它的 categoryIds 里摘掉
      const sites = await tx.site.findMany({
        select: { id: true, categoryId: true, categoryIds: true }
      });

      let detached = 0;
      for (const site of sites) {
        const ids = readCategoryIds(site.categoryIds);
        const stillBelongs =
          (site.categoryId != null && affected.has(site.categoryId)) ||
          ids.some((cid) => affected.has(cid));

        if (!stillBelongs) continue;

        const remaining = ids.filter((cid) => !affected.has(cid));
        const nextPrimary =
          site.categoryId != null && !affected.has(site.categoryId) ? site.categoryId : remaining[0] ?? null;

        await tx.site.update({
          where: { id: site.id },
          data: {
            categoryId: nextPrimary,
            categoryIds: remaining.length ? JSON.stringify(remaining) : null
          }
        });
        detached += 1;
      }

      await tx.category.delete({ where: { id } });

      return { deletedCategories: affected.size, detachedSites: detached };
    });

    res.json({
      message: 'Category deleted successfully',
      deletedCategories: result.deletedCategories,
      detachedSites: result.detachedSites
    });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
