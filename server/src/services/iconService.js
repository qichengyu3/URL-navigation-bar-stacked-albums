import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { isIP } from 'net';
import { checkSafeUrl, isPrivateAddress } from './ssrfGuard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const commonIconPaths = [
  '/favicon.ico',
];

const MAX_ICON_BYTES = 2 * 1024 * 1024; // 单张图标最多 2MB，防止被大文件刷盘

async function downloadIcon(url, timeout = 3000) {
  try {
    // 每一个真正发起请求的地址都要过 SSRF 校验（含重定向后的目标）
    const guard = await checkSafeUrl(url);
    if (!guard.ok) {
      return null;
    }

    const response = await axios.get(url, {
      timeout,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': USER_AGENT },
      maxRedirects: 3,
      // axios 会自动跟随 3xx：若不在每一跳重新校验，攻击者可让外部站点
      // 302 跳到内网/云元数据地址，绕过入口处的 SSRF 检查。
      // 这里做同步粗筛（协议 + 主机黑名单 + IP 字面量私网），属于纵深防御。
      beforeRedirect: (options) => {
        const host = String(options.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
        if (options.protocol !== 'http:' && options.protocol !== 'https:') {
          throw new Error('redirect blocked: protocol');
        }
        if (
          host === 'localhost' ||
          host.endsWith('.localhost') ||
          host.endsWith('.local') ||
          host.endsWith('.internal') ||
          host === 'metadata' ||
          host === 'instance-data' ||
          host === '169.254.169.254'
        ) {
          throw new Error('redirect blocked: host');
        }
        if (isIP(host) && isPrivateAddress(host)) {
          throw new Error('redirect blocked: private address');
        }
      },
      maxContentLength: MAX_ICON_BYTES,
      maxBodyLength: MAX_ICON_BYTES,
      validateStatus: (status) => status >= 200 && status < 300
    });

    const contentType = response.headers['content-type'] || '';

    if (!contentType.startsWith('image/')) {
      return null;
    }

    const buffer = Buffer.from(response.data);

    // 响应体大小兜底（部分服务端不返回 content-length）
    if (buffer.length > MAX_ICON_BYTES || buffer.length < 16) {
      return null;
    }

    // 抓取的 SVG 同样要过滤脚本内容，避免把可执行的 SVG 存进同源目录
    const isSvg = contentType.includes('image/svg') ||
      buffer.slice(0, 256).toString('utf8').includes('<svg');

    const extension = contentType.includes('image/png') ? 'png' :
                     contentType.includes('image/jpeg') || contentType.includes('image/jpg') ? 'jpg' :
                     contentType.includes('image/gif') ? 'gif' :
                     contentType.includes('image/webp') ? 'webp' :
                     isSvg ? 'svg' :
                     'ico';

    if (extension === 'svg') {
      const svgText = buffer.toString('utf8');
      const lower = svgText.toLowerCase();
      const dangerous = ['<script', 'javascript:', 'onload', 'onerror', 'onclick', '<foreignobject', '<!entity'];
      if (dangerous.some((token) => lower.includes(token))) {
        return null;
      }
    }

    const fileName = `${crypto.randomBytes(12).toString('hex')}.${extension}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    fs.writeFileSync(filePath, buffer);

    return `/uploads/${fileName}`;
  } catch (err) {
    return null;
  }
}

export async function fetchFavicon(siteUrl) {
  try {
    // 入口处先做一次 SSRF 校验，非法目标直接拒绝并给出原因
    const guard = await checkSafeUrl(siteUrl);
    if (!guard.ok) {
      console.warn(`[icon] blocked unsafe url (${siteUrl}): ${guard.reason}`);
      return { icon: null, iconType: 'none', reason: `不允许抓取该地址：${guard.reason}` };
    }

    const urlObj = guard.url;
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    const triedUrls = new Set();

    const allIconUrls = [
      ...commonIconPaths.map((p) => `${baseUrl}${p}`),
    ];

    for (const iconUrl of allIconUrls) {
      if (triedUrls.has(iconUrl)) continue;
      triedUrls.add(iconUrl);

      const result = await downloadIcon(iconUrl);
      if (result) {
        return { icon: result, iconType: 'auto' };
      }
    }

    // 已经是 www. 开头或 IP 主机时，不再尝试 www 变体
    const hostname = urlObj.hostname.toLowerCase();
    const skipWww = hostname.startsWith('www.') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
      hostname.includes(':');

    if (!skipWww) {
      const wwwBaseUrl = baseUrl.replace('://', '://www.');
      for (const p of commonIconPaths) {
        const iconUrl = `${wwwBaseUrl}${p}`;
        if (triedUrls.has(iconUrl)) continue;

        const result = await downloadIcon(iconUrl);
        if (result) {
          return { icon: result, iconType: 'auto' };
        }
      }
    }

    return { icon: null, iconType: 'none' };
  } catch (err) {
    return { icon: null, iconType: 'none' };
  }
}

export function getIconUrl(icon) {
  if (!icon) return null;
  if (icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('data:')) {
    return icon;
  }
  return `/uploads/${icon}`;
}
