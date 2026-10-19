import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import crypto from 'crypto';
import { authMiddleware } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { getCos, uploadObject, buildUrl, readCosConfig } from '../services/cosService.js';
import { processImage } from '../utils/image.js';
import { config } from '../config.js';

const router = Router();
const prisma = new PrismaClient();

// 相册照片允许更大体积（上传后会被压缩，最大限制在压缩前）
const ALBUM_MAX_BYTES = 15 * 1024 * 1024;
// 单相册照片数量上限：防止账号被盗后无限灌图刷存储
const MAX_PHOTOS_PER_ALBUM = 500;

// 上传专用限流：即使 token 泄露，也不能拿它当免费图床刷
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: '上传过于频繁，请稍后再试'
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ALBUM_MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('仅支持图片文件'), false);
  }
});

function runUpload(req, res) {
  return new Promise((resolve) => {
    upload.single('file')(req, res, (err) => {
      if (err) return resolve({ err });
      resolve({ err: null });
    });
  });
}

/**
 * 相册名 → 安全的 COS 目录名。
 * 白名单方式（只保留文字/数字/空格/-_·()），从根上排除 / \ : ? # % 这类
 * 会破坏 URL 或路径的字符；保留中文，便于在控制台按名字找文件夹。
 */
function sanitizeName(s) {
  const cleaned = String(s || '')
    .replace(/[^\p{L}\p{N}\s\-_·()（）]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return cleaned || '未命名相册';
}

/** 上传一张图片到 COS 并返回 URL/尺寸信息。
 *  keyPrefix 为目录（如 albums/相册名），namePrefix 用于给文件名加前缀（如 cover-）。
 *  thumbMaxDim > 0 时同时生成一张缩略图（最长边不超过该值），
 *  用于「瀑布流加载缩略图、点开灯箱再加载大图」的省流量方案。 */
async function uploadImageToCos(keyPrefix, file, maxDim, namePrefix = '', thumbMaxDim = 0) {
  const cos = await getCos();
  if (!cos) {
    const e = new Error('对象存储尚未配置，请先在「设置 → 对象存储」里完成配置');
    e.status = 503;
    throw e;
  }
  const p = await processImage(file.buffer, { maxDim });
  // key 带随机串：同一张图重复上传也是新 key，
  // 因此可以放心用「一年强缓存 + immutable」，浏览器永不回源
  const hex = crypto.randomBytes(8).toString('hex');
  const key = `${keyPrefix}/${namePrefix}${hex}.${p.ext}`;
  await uploadObject(cos, key, p.buffer, p.contentType);
  const result = {
    url: buildUrl(cos.cfg, key),
    key,
    width: p.width,
    height: p.height,
    ar: `${p.width} / ${p.height}`,
    dir: p.width >= p.height ? 'h' : 'v'
  };
  if (thumbMaxDim > 0) {
    if (Math.max(p.width, p.height) > thumbMaxDim) {
      // 原图比缩略图尺寸大 → 另生成一张小图
      const t = await processImage(file.buffer, { maxDim: thumbMaxDim });
      const tkey = `${keyPrefix}/${namePrefix}${hex}-thumb.${t.ext}`;
      await uploadObject(cos, tkey, t.buffer, t.contentType);
      result.thumbKey = tkey;
      result.thumb = buildUrl(cos.cfg, tkey);
    } else {
      // 原图本身就小，缩略图直接复用原图，不重复占存储
      result.thumbKey = key;
      result.thumb = result.url;
    }
  }
  return result;
}

/* ============ 公开读取（前台相册使用） ============ */

// 相册列表：最新添加排最前
router.get('/', async (req, res) => {
  try {
    // 配置读一次（内部有 60s 缓存），所有 URL 用它现拼
    const [albums, cfg] = await Promise.all([
      prisma.album.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { _count: { select: { photos: true } } }
      }),
      readCosConfig()
    ]);

    // 短缓存 + 允许过期后先回旧值：前台刷新不会每次都压后端和数据库
    res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');

    res.json({
      albums: albums.map((a) => ({
        id: a.id,
        name: a.name,
        city: a.city,
        desc: a.desc,
        // 用 key 现拼 URL：以后从源站域名切到 CDN 域名，存量数据自动跟着变
        cover: a.coverKey && cfg.configured ? buildUrl(cfg, a.coverKey) : a.cover,
        dir: a.dir,
        ar: a.ar,
        count: a._count.photos,
        createdAt: a.createdAt
      }))
    });
  } catch (err) {
    console.error('List albums error:', err);
    res.status(500).json({ error: '获取相册列表失败' });
  }
});

// 相册详情 + 照片列表
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '相册 ID 无效' });

    const [album, cfg] = await Promise.all([
      prisma.album.findUnique({
        where: { id },
        include: { photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } }
      }),
      readCosConfig()
    ]);
    if (!album) return res.status(404).json({ error: '相册不存在' });

    res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');

    res.json({
      album: {
        id: album.id,
        name: album.name,
        city: album.city,
        desc: album.desc,
        cover: album.coverKey && cfg.configured ? buildUrl(cfg, album.coverKey) : album.cover,
        dir: album.dir,
        ar: album.ar,
        createdAt: album.createdAt,
        count: album.photos.length,
        // 只暴露渲染需要的字段，不下发 COS key / 内部字段
        photos: album.photos.map((p) => {
          const full = p.key && cfg.configured ? buildUrl(cfg, p.key) : p.url;
          return {
            id: p.id,
            url: full,
            // 缩略图：有 thumbKey 用缩略图，没有则回退大图（存量数据未生成缩略图前的兜底）
            thumb: p.thumbKey && cfg.configured ? buildUrl(cfg, p.thumbKey) : full,
            title: p.title,
            ar: p.ar,
            width: p.width,
            height: p.height,
            sortOrder: p.sortOrder
          };
        })
      }
    });
  } catch (err) {
    console.error('Get album error:', err);
    res.status(500).json({ error: '获取相册失败' });
  }
});

/* ============ 管理端（需登录） ============ */

// 上传封面（创建相册时用，不绑定相册）。可带 name 字段决定目录：<COS_ALBUM_PREFIX>/<相册名>/
router.post('/cover', authMiddleware, uploadLimiter, async (req, res) => {
  const { err } = await runUpload(req, res);
  if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message || '上传失败' });
  if (!req.file) return res.status(400).json({ error: '未收到文件' });
  try {
    const name = req.body && req.body.name ? String(req.body.name).trim() : '';
    const folder = name
      ? `${config.cosAlbumPrefix}/${sanitizeName(name)}`
      : `${config.cosAlbumPrefix}/covers`;
    const r = await uploadImageToCos(folder, req.file, 900, 'cover-');
    res.json(r);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '上传失败' });
  }
});

// 创建相册
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, city, desc, cover, coverKey, dir, ar } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '相册名称必填' });
    const album = await prisma.album.create({
      data: {
        name: String(name).trim(),
        city: city || null,
        desc: desc || null,
        cover: cover || null,
        coverKey: coverKey || null,
        dir: dir || 'h',
        ar: ar || '16 / 10'
      }
    });
    res.json({ album });
  } catch (err) {
    console.error('Create album error:', err);
    res.status(500).json({ error: '创建相册失败' });
  }
});

// 更新相册信息
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const album = await prisma.album.findUnique({ where: { id } });
    if (!album) return res.status(404).json({ error: '相册不存在' });

    const { name, city, desc, cover, coverKey, dir, ar } = req.body || {};
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (city !== undefined) data.city = city || null;
    if (desc !== undefined) data.desc = desc || null;
    if (cover !== undefined) data.cover = cover || null;
    if (coverKey !== undefined) data.coverKey = coverKey || null;
    if (dir !== undefined) data.dir = dir;
    if (ar !== undefined) data.ar = ar;

    const updated = await prisma.album.update({ where: { id }, data });
    res.json({ album: updated });
  } catch (err) {
    console.error('Update album error:', err);
    res.status(500).json({ error: '更新相册失败' });
  }
});

// 删除相册：只删除数据库记录（照片随 onDelete Cascade 一并删除），
// 对象存储里的文件按用户要求「保留」，不做删除
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const album = await prisma.album.findUnique({ where: { id } });
    if (!album) return res.status(404).json({ error: '相册不存在' });

    await prisma.album.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete album error:', err);
    res.status(500).json({ error: '删除相册失败' });
  }
});

// 上传照片到相册
router.post('/:id/photos', authMiddleware, uploadLimiter, async (req, res) => {
  const { err } = await runUpload(req, res);
  if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message || '上传失败' });
  if (!req.file) return res.status(400).json({ error: '未收到文件' });

  const id = Number(req.params.id);
  const album = await prisma.album.findUnique({
    where: { id },
    include: { _count: { select: { photos: true } } }
  });
  if (!album) return res.status(404).json({ error: '相册不存在' });
  if (album._count.photos >= MAX_PHOTOS_PER_ALBUM) {
    return res.status(400).json({ error: `单个相册最多 ${MAX_PHOTOS_PER_ALBUM} 张照片` });
  }

  try {
    // 主图 1600 + 缩略图 800，瀑布流加载缩略图、灯箱加载大图
    const r = await uploadImageToCos(
      `${config.cosAlbumPrefix}/${sanitizeName(album.name)}`,
      req.file,
      1600,
      '',
      800
    );
    const title = (req.body && req.body.title) || null;
    const photo = await prisma.photo.create({
      data: { albumId: id, url: r.url, key: r.key, thumbKey: r.thumbKey || null, width: r.width, height: r.height, ar: r.ar, title }
    });
    res.json({ photo });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '上传失败' });
  }
});

// 删除单张照片：只删数据库记录，对象存储文件保留
router.delete('/:id/photos/:photoId', authMiddleware, async (req, res) => {
  try {
    // 必须同时匹配 albumId，避免用别的相册 id 越权删照片
    const photo = await prisma.photo.findFirst({
      where: { id: Number(req.params.photoId), albumId: Number(req.params.id) }
    });
    if (!photo) return res.status(404).json({ error: '照片不存在' });
    await prisma.photo.delete({ where: { id: photo.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete photo error:', err);
    res.status(500).json({ error: '删除照片失败' });
  }
});

// 修改照片标题
router.put('/:id/photos/:photoId', authMiddleware, async (req, res) => {
  try {
    const photo = await prisma.photo.findFirst({
      where: { id: Number(req.params.photoId), albumId: Number(req.params.id) }
    });
    if (!photo) return res.status(404).json({ error: '照片不存在' });
    const data = {};
    if (req.body && req.body.title !== undefined) data.title = req.body.title || null;
    const updated = await prisma.photo.update({ where: { id: photo.id }, data });
    res.json({ photo: updated });
  } catch (err) {
    console.error('Update photo error:', err);
    res.status(500).json({ error: '更新照片失败' });
  }
});

export default router;
