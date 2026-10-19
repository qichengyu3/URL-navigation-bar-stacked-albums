import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEMO_DATA } from './demo-data.js';

const prisma = new PrismaClient();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin12345';

const SETTINGS = {
  siteName: 'TabHub 导航',
  siteSubtitle: '一个干净顺手的网址导航',
  bannerTitle: '去自由、随心所欲',
  hotSearches: 'Google,百度,GitHub,知乎,Steam',
  announcements: JSON.stringify([
    { text: '演示数据已就绪：20 个分类 · 100 个站点', url: '' },
    { text: '登录后台即可增删改，数据都在本地 SQLite', url: '' }
  ])
};

async function seedAdmin() {
  const existing = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } });

  if (existing) {
    console.log(`[user] 已存在 ${existing.username}，密码保持不变`);
    return;
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.create({ data: { username: ADMIN_USERNAME, password: hashed } });

  console.log(`[user] 已创建管理员：${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  console.log('       登录后请立刻执行 npm run set-password 改成自己的密码');
}

async function seedCategories() {
  for (let i = 0; i < DEMO_DATA.length; i++) {
    const { name, slug } = DEMO_DATA[i];
    await prisma.category.upsert({
      where: { slug },
      update: { name, sortOrder: i },
      create: { name, slug, sortOrder: i }
    });
  }
  console.log(`[category] ${DEMO_DATA.length} 个分类就绪`);
}

async function seedSites() {
  const cats = await prisma.category.findMany();
  const bySlug = new Map();
  for (const c of cats) bySlug.set(c.slug, c.id);

  let created = 0;
  let updated = 0;
  let order = 0;

  for (const group of DEMO_DATA) {
    const categoryId = bySlug.get(group.slug);

    for (const [title, url, description] of group.sites) {
      order++;
      const clickCount = Math.floor(Math.random() * 240) + 5;
      const data = { title, url, description, categoryId, sortOrder: order, clickCount };

      const exist = await prisma.site.findUnique({ where: { url } });
      if (exist) {
        await prisma.site.update({ where: { url }, data });
        updated++;
      } else {
        await prisma.site.create({ data });
        created++;
      }
    }
  }

  console.log(`[site] 新增 ${created} 条，更新 ${updated} 条，共 ${created + updated} 条`);
}

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value }
    });
  }
  console.log(`[setting] ${Object.keys(SETTINGS).length} 项站点配置就绪`);
}

async function main() {
  await seedAdmin();
  await seedCategories();
  await seedSites();
  await seedSettings();

  const [categories, sites] = await Promise.all([
    prisma.category.count(),
    prisma.site.count()
  ]);

  console.log('');
  console.log(`完成：${categories} 个分类，${sites} 个站点`);
  console.log('启动方式：npm run dev（后端 3001）+ cd ../client && npm run dev（前端 5173）');
}

main()
  .catch((e) => {
    console.error('Seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
