/**
 * 设置 / 修改后台管理员密码。
 *
 * 用法（任选其一）：
 *   ADMIN_PASSWORD='你的新密码' npm run set-password
 *   node scripts/set-password.js '你的新密码'
 *   node scripts/set-password.js --username=admin '你的新密码'
 *
 * 说明：密码只在命令行/环境变量里给出，不会写进源码或数据库明文。
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function parseArgs(argv) {
  const options = { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || '' };

  for (const arg of argv) {
    if (arg.startsWith('--username=')) {
      options.username = arg.slice('--username='.length);
    } else if (!options.password) {
      options.password = arg;
    }
  }

  return options;
}

async function main() {
  const { username, password } = parseArgs(process.argv.slice(2));

  if (!password) {
    console.error('用法: node scripts/set-password.js <新密码>');
    console.error('   或: ADMIN_PASSWORD=<新密码> npm run set-password');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('密码长度至少 8 位');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { username } });

  if (!existing) {
    console.error(`用户 "${username}" 不存在，请先执行 npm run db:seed`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { username }, data: { password: hashed } });

  console.log(`密码已更新：${username}`);
  console.log('提示：修改密码不会让已签发的 token 立即失效，建议重新登录一次。');
}

main()
  .catch((e) => {
    console.error('设置密码失败:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
