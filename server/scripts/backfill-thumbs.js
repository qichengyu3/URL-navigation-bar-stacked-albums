/**
 * 一次性迁移：给存量照片补生成缩略图并回填 thumbKey。
 *
 * 背景：双尺寸改造前，Photo 只存了 1600px 大图。改造后瀑布流改加载 800px 缩略图，
 * 点开灯箱才加载大图。本脚本把存量照片（thumbKey 为空的）从 COS 下载原图，
 * 转成 800px WebP 缩略图传回 COS（key 加 -thumb.webp 后缀），并回填 thumbKey。
 *
 * 幂等：只处理 thumbKey 为空的记录，重复运行安全。
 * 运行：在 server 目录下用系统 node 执行（sharp/prisma 原生模块按系统 node 编译）
 *   node scripts/backfill-thumbs.js
 */
import { PrismaClient } from '@prisma/client';
import { getCos, uploadObject } from '../src/services/cosService.js';
import { processImage } from '../src/utils/image.js';

const prisma = new PrismaClient();

/** 从 COS 下载对象为 Buffer（走 SDK API，不依赖公网 URL / 防盗链） */
function getObjectBuffer(cos, key) {
  return new Promise((resolve, reject) => {
    cos.client.getObject(
      { Bucket: cos.cfg.bucket, Region: cos.cfg.region, Key: key },
      (err, data) => {
        if (err) return reject(err);
        resolve(Buffer.isBuffer(data.Body) ? data.Body : Buffer.from(data.Body));
      }
    );
  });
}

async function main() {
  const cos = await getCos();
  if (!cos) {
    console.error('对象存储未配置，无法生成缩略图');
    await prisma.$disconnect();
    process.exit(1);
  }

  const photos = await prisma.photo.findMany({
    where: { thumbKey: null },
    select: { id: true, key: true }
  });
  if (!photos.length) {
    console.log('没有需要处理的存量照片（thumbKey 已全部回填）');
    await prisma.$disconnect();
    return;
  }

  const uniqueKeys = [...new Set(photos.map((p) => p.key))];
  console.log(`待处理：唯一图 ${uniqueKeys.length} 个，记录 ${photos.length} 条`);

  let ok = 0;
  let fail = 0;
  for (const key of uniqueKeys) {
    try {
      const buf = await getObjectBuffer(cos, key);

      const t = await processImage(buf, { maxDim: 800 });
      const thumbKey = key.replace(/\.[^.]+$/, '') + '-thumb.webp';
      await uploadObject(cos, thumbKey, t.buffer, t.contentType);

      const ids = photos.filter((p) => p.key === key).map((p) => p.id);
      await prisma.photo.updateMany({ where: { id: { in: ids } }, data: { thumbKey } });

      ok++;
      console.log(`✓ ${key} -> ${thumbKey} (${(t.buffer.length / 1024).toFixed(1)}KB, 回填 ${ids.length} 条)`);
    } catch (e) {
      fail++;
      console.error(`✗ ${key}: ${e.message}`);
    }
  }

  console.log(`完成：成功 ${ok}，失败 ${fail}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
