/**
 * 轻量内存限流中间件。
 *
 * 说明：本项目是单实例部署，内存计数足够。
 * 若将来多实例横向扩展，需把 hits 换成 Redis 等共享存储，
 * 否则限流只在当前进程内生效。
 */
function clientIp(req) {
  // 只用 req.ip（Express 是否采信 X-Forwarded-For 由 app.set('trust proxy') 决定）。
  // 直接读 XFF 头部会让攻击者伪造 IP、绕过登录限流和上传限流。
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/** 通用限流：每次请求都计数，超过上限直接 429。 */
export function createRateLimiter({ windowMs, max, keyGenerator = clientIp, message }) {
  const hits = new Map();

  return function rateLimiter(req, res, next) {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message || `请求过于频繁，请 ${retryAfter} 秒后再试`
      });
    }

    next();
  };
}

/**
 * 登录专用限流：只有失败响应才计数，成功后立刻清零。
 * 避免正常使用（尤其是自动重登）把自己锁死，同时挡住暴力破解。
 */
export function createLoginLimiter({ windowMs, max, keyGenerator = clientIp }) {
  const hits = new Map();

  return function loginLimiter(req, res, next) {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
      return res.status(429).json({
        error: `登录尝试失败次数过多，请 ${Math.max(1, Math.round(retryAfter / 60))} 分钟后再试`
      });
    }

    res.on('finish', () => {
      if (res.statusCode >= 400) {
        entry.count += 1;
        entry.resetAt = Math.max(entry.resetAt, Date.now() + windowMs);
      } else {
        hits.delete(key);
      }
    });

    next();
  };
}
