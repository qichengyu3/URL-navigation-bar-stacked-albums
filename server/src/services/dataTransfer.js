import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 统一的数据进出通道。
 *
 * - normalizeImportPayload：把任意来源（用户上传的 JSON / 服务端备份文件）
 *   归一化成可以安全落库的结构，任何一条不合法就整体拒绝。
 * - replaceAllData：清库 + 写入，必须运行在事务里。
 * - collectExportData：导出当前全量数据，格式与导入完全兼容（可闭环复用）。
 */
export { prisma };

/**
 * 归一化导入数据。
 * 返回 { categories, sites } 或 { error }。
 */
export function normalizeImportPayload(payload) {
  const { categories, sites } = payload || {};

  if (!Array.isArray(categories)) {
    return { error: 'Invalid import data: categories must be an array' };
  }
  if (!Array.isArray(sites)) {
    return { error: 'Invalid import data: sites must be an array' };
  }

  const normalizedCategories = [];
  const categoryIdSet = new Set();
  const slugSet = new Set();

  for (const cat of categories) {
    if (!cat || typeof cat.name !== 'string' || !cat.name.trim()) {
      return { error: 'Invalid import data: category missing name' };
    }
    const slug = String(cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-')).trim();
    if (!slug) {
      return { error: 'Invalid import data: category slug is empty' };
    }
    if (slugSet.has(slug)) {
      return { error: `Invalid import data: duplicated category slug "${slug}"` };
    }
    slugSet.add(slug);

    const id = Number.isInteger(cat.id) ? cat.id : undefined;
    if (id !== undefined) {
      if (categoryIdSet.has(id)) {
        return { error: `Invalid import data: duplicated category id ${id}` };
      }
      categoryIdSet.add(id);
    }

    normalizedCategories.push({
      id,
      name: cat.name.trim(),
      slug,
      parentId: Number.isInteger(cat.parentId) ? cat.parentId : null,
      sortOrder: Number.isInteger(cat.sortOrder) ? cat.sortOrder : 0
    });
  }

  // 成环检测：分类层级一旦成环，前台构建分类树会死循环
  const byId = new Map(normalizedCategories.filter((c) => c.id !== undefined).map((c) => [c.id, c]));
  for (const cat of byId.values()) {
    const seen = new Set([cat.id]);
    let cursor = cat.parentId;
    while (cursor !== null) {
      if (seen.has(cursor)) {
        return { error: `Invalid import data: category hierarchy contains a cycle at id ${cursor}` };
      }
      seen.add(cursor);
      const parent = byId.get(cursor);
      if (!parent) break;
      cursor = parent.parentId;
    }
  }

  const normalizedSites = [];
  const urlSet = new Set();

  for (const site of sites) {
    if (!site || typeof site.title !== 'string' || !site.title.trim()) {
      return { error: 'Invalid import data: site missing title' };
    }
    if (typeof site.url !== 'string' || !site.url.trim()) {
      return { error: `Invalid import data: site "${site.title}" missing url` };
    }

    // URL 必须合法且为 http/https，避免导入 javascript: 等危险协议
    let parsedUrl;
    try {
      parsedUrl = new URL(site.url.trim());
    } catch {
      return { error: `Invalid import data: invalid url "${site.url}"` };
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { error: `Invalid import data: url protocol not allowed "${site.url}"` };
    }

    const url = parsedUrl.toString();
    if (urlSet.has(url)) {
      return { error: `Invalid import data: duplicated url "${url}"` };
    }
    urlSet.add(url);

    normalizedSites.push({
      title: site.title.trim(),
      url,
      description: typeof site.description === 'string' ? site.description : '',
      icon: typeof site.icon === 'string' && site.icon ? site.icon : null,
      iconType: typeof site.iconType === 'string' && site.iconType ? site.iconType : 'auto',
      categoryId: Number.isInteger(site.categoryId) ? site.categoryId : null,
      categoryIds: typeof site.categoryIds === 'string' && site.categoryIds ? site.categoryIds : null,
      sortOrder: Number.isInteger(site.sortOrder) ? site.sortOrder : 0,
      // 备份恢复时保留点击量，否则恢复一次热度就清零
      clickCount: Number.isInteger(site.clickCount) && site.clickCount > 0 ? site.clickCount : 0
    });
  }

  return { categories: normalizedCategories, sites: normalizedSites };
}

/**
 * 用给定数据替换全部分类与网站。
 * 调用方必须把它放进事务：await prisma.$transaction(tx => replaceAllData(tx, ...))
 */
export async function replaceAllData(client, categories, sites) {
  await client.site.deleteMany({});
  await client.category.deleteMany({});

  /**
   * 两阶段建分类：
   * 先把所有分类建成顶级，再回填 parentId。
   * 否则只要数据里子分类排在父分类前面（按 sortOrder 排序时很常见），
   * 建表就会撞上 parentId 的外键约束而整批失败。
   */
  const idMap = new Map(); // 原始数据里的 id -> 实际落库 id
  const createdIdByCat = new Map(); // 分类对象 -> 实际落库 id
  const actualIds = new Set();

  for (const cat of categories) {
    const created = await client.category.create({
      data: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parentId: null,
        sortOrder: cat.sortOrder
      }
    });
    if (cat.id !== undefined) idMap.set(cat.id, created.id);
    createdIdByCat.set(cat, created.id);
    actualIds.add(created.id);
  }

  // 引用解析：原始数据没有显式 id 时，只能按实际落库 id 判断
  const resolveRef = (value) => {
    if (value === null || value === undefined) return null;
    if (idMap.size > 0) {
      const mapped = idMap.get(value);
      return mapped === undefined ? null : mapped;
    }
    return actualIds.has(value) ? value : null;
  };

  for (const cat of categories) {
    if (cat.parentId === null || cat.parentId === undefined) continue;
    const parentId = resolveRef(cat.parentId);
    if (parentId === null) continue;
    await client.category.update({
      where: { id: createdIdByCat.get(cat) },
      data: { parentId }
    });
  }

  for (const site of sites) {
    await client.site.create({
      data: {
        ...site,
        categoryId: resolveRef(site.categoryId)
      }
    });
  }
}

/**
 * 导出当前全量数据。
 * 输出结构与导入接口接受的结构一致，因此导出/备份的文件可以直接再导入。
 * 分类不嵌套 children、站点不内联 category 对象，避免冗余和循环引用。
 */
export async function collectExportData(meta = {}) {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });

  const sites = await prisma.site.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  });

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    meta: {
      categoryCount: categories.length,
      siteCount: sites.length,
      ...meta
    },
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      sortOrder: cat.sortOrder
    })),
    sites: sites.map((site) => ({
      title: site.title,
      url: site.url,
      description: site.description || '',
      icon: site.icon || null,
      iconType: site.iconType || 'auto',
      categoryId: site.categoryId,
      categoryIds: site.categoryIds || null,
      sortOrder: site.sortOrder,
      clickCount: site.clickCount || 0
    }))
  };
}
