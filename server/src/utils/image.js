import sharp from 'sharp';

// 单张图最大允许像素数：约 1 亿像素（10000×10000），
// 防止「几 KB 的构造图解压出 GB 级位图」的解压炸弹打爆内存
const MAX_INPUT_PIXELS = 100 * 1e6;

/**
 * 图片压缩处理：统一转码 + 限制最长边，用于显著降低存储与流量消耗。
 *
 * 输出统一为 WebP：
 * - 相比原程序用的 JPEG(mozjpeg)，同画质再小约 25%~35%
 * - 相比 PNG（透明图），体积通常只有 1/5 ~ 1/3
 * - 现代浏览器（含 Safari 14+）全部支持，且保留透明通道
 * 只缩小不放大。
 */
export async function processImage(buffer, { maxDim = 1600, quality = 82 } = {}) {
  let meta;
  try {
    meta = await sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch (err) {
    // 伪造 Content-Type 的非图片、损坏文件、超大像素图都会走到这里 → 返回 400 而不是 500
    const e = new Error('不是有效的图片文件，请换一张试试');
    e.status = 400;
    e.cause = err;
    throw e;
  }
  if (!meta.width || !meta.height) {
    const e = new Error('无法识别的图片文件');
    e.status = 400;
    throw e;
  }

  const w = meta.width;
  const h = meta.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));

  const resize = {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    fit: 'inside',
    withoutEnlargement: true
  };

  let outBuffer;
  try {
    outBuffer = await sharp(buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // 按 EXIF 摆正（手机竖拍照片必需）
      .resize(resize)
      .webp({ quality, effort: 4, smartSubsample: true })
      .toBuffer();
  } catch (err) {
    const e = new Error('图片处理失败，请换一张图片试试');
    e.status = 400;
    e.cause = err;
    throw e;
  }

  const outMeta = await sharp(outBuffer).metadata();
  return {
    buffer: outBuffer,
    width: outMeta.width,
    height: outMeta.height,
    ext: 'webp',
    contentType: 'image/webp'
  };
}
