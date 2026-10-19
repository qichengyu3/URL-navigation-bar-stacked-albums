import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';
import { authMiddleware } from '../middlewares/auth.js';
import { config } from '../config.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// 声明的 mimetype 只是第一道粗筛，真正的类型由文件头（magic bytes）决定
const ALLOWED_MIMETYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/gif',
  'image/webp',
  'image/bmp'
];

// 真实类型 -> 扩展名
const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/svg+xml': 'svg'
};

/**
 * 通过文件头判断真实图片类型，返回 mimetype 或 null。
 * 不信任客户端声明的 Content-Type，也不信任文件名后缀。
 */
function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const signature = buffer.slice(0, 12);
  const head = signature.toString('latin1');

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (signature.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF87a / GIF89a
  if (head.startsWith('GIF8')) {
    return 'image/gif';
  }
  // WEBP: RIFF....WEBP
  if (head.startsWith('RIFF') && signature.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  // BMP: BM
  if (signature[0] === 0x42 && signature[1] === 0x4d) {
    return 'image/bmp';
  }
  // ICO: 00 00 01 00
  if (signature[0] === 0x00 && signature[1] === 0x00 && signature[2] === 0x01 && signature[3] === 0x00) {
    return 'image/x-icon';
  }
  // SVG：纯文本，以 <?xml 或 <svg 开头
  const text = buffer.slice(0, 512).toString('utf8').trimStart();
  if (text.startsWith('<?xml') || text.startsWith('<svg') || text.startsWith('<!DOCTYPE svg')) {
    return 'image/svg+xml';
  }
  return null;
}

/**
 * SVG 是 XML，可以内嵌脚本。上传前做严格内容检查，
 * 只允许静态矢量图形，拒绝任何可执行内容或外部实体引用。
 */
function validateSvgContent(text) {
  const lower = text.toLowerCase();

  const forbidden = [
    '<script',
    'javascript:',
    'data:text/html',
    '<foreignobject',
    '<iframe',
    '<embed',
    '<object',
    '<link',
    '<!entity',
    'onload',
    'onerror',
    'onclick',
    'onmouseover',
    'onfocus',
    'onmouseenter',
    'onbegin',
    'onrepeat',
    '<handler',
    'href="http',
    'xlink:href="javascript'
  ];

  for (const token of forbidden) {
    if (lower.includes(token)) {
      return { ok: false, reason: `SVG 包含不允许的内容: ${token}` };
    }
  }

  // 事件属性泛匹配：onxxx=
  if (/\son[a-z]+\s*=/i.test(text)) {
    return { ok: false, reason: 'SVG 包含事件处理属性' };
  }
  // 外部实体 / DOCTYPE（防 XXE、Billion Laughs）
  if (/<!doctype/i.test(text) || /<!entity/i.test(text)) {
    return { ok: false, reason: 'SVG 包含 DTD/实体声明' };
  }

  return { ok: true };
}

// 使用内存存储：先校验内容再落盘，避免把不可信文件写入磁盘
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploadMaxBytes,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型，仅允许 PNG、JPG、SVG、ICO、GIF、WebP、BMP'), false);
    }
  }
});

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

router.post('/', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err.message);
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message || '上传失败' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const buffer = req.file.buffer;

      // 1) 用文件头确定真实类型
      const realType = sniffImageType(buffer);
      if (!realType) {
        return res.status(400).json({ error: '文件内容不是有效的图片' });
      }
      if (!ALLOWED_MIMETYPES.includes(realType)) {
        return res.status(400).json({ error: '不支持的图片类型' });
      }

      // 2) SVG 额外做内容安全校验
      if (realType === 'image/svg+xml') {
        const check = validateSvgContent(buffer.toString('utf8'));
        if (!check.ok) {
          return res.status(400).json({ error: check.reason });
        }
      }

      // 3) 扩展名由真实类型决定，文件名完全由服务端生成
      const ext = EXT_BY_MIME[realType];
      const fileName = `${crypto.randomBytes(16).toString('hex')}.${ext}`;

      await ensureUploadDir();
      await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);

      res.json({
        url: `/uploads/${fileName}`,
        filename: fileName
      });
    } catch (writeErr) {
      console.error('Upload persist error:', writeErr);
      res.status(500).json({ error: '上传失败' });
    }
  });
});

export default router;
