import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';
import { createLoginLimiter } from '../middlewares/rateLimit.js';

const router = Router();
const prisma = new PrismaClient();

// 本项目是个人使用的单管理员站点，注册接口已关闭（不再开放任何人自助创建管理员）。
// 管理员账号通过 `npm run db:seed` 初始化，密码通过 `npm run set-password` 修改。

// 登录限流：同一 IP 在窗口内失败 N 次后锁定，成功登录会清零计数
const loginLimiter = createLoginLimiter({
  windowMs: config.loginWindowMs,
  max: config.loginMaxAttempts
});

// 用户不存在时也要走一次 bcrypt 比较，抹平时序差异，防止用户名枚举
const DUMMY_HASH = '$2a$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });

    const isValid = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

    if (!user || !isValid) {
      // 统一错误信息，不泄露账号是否存在
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });

    res.json({
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
