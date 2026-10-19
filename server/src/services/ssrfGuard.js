import dns from 'dns/promises';
import { isIP } from 'net';

/**
 * SSRF 防护：在服务端发起外部请求前，校验目标地址是否安全。
 *
 * 防护层次：
 * 1. 协议白名单（仅 http/https）
 * 2. 主机名黑名单（localhost、metadata 等）
 * 3. IP 字面量私网段拦截
 * 4. DNS 解析后逐条校验解析结果，拦截指向内网/本机/云元数据服务的域名
 */

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'instance-data.ec2.internal',
  '169.254.169.254' // 各家云元数据服务
]);

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal'];

export function isPrivateAddress(ip) {
  if (!ip) return true;
  const value = String(ip).toLowerCase();

  if (value === '::1' || value === '::' || value === '0.0.0.0') return true;

  // IPv4
  if (isIP(value) === 4) {
    if (value === '127.0.0.1' || value.startsWith('127.')) return true;
    if (value.startsWith('10.')) return true;
    if (value.startsWith('192.168.')) return true;
    if (value.startsWith('169.254.')) return true; // link-local / cloud metadata
    if (value.startsWith('0.')) return true;
    if (value.startsWith('100.') ) {
      const second = parseInt(value.split('.')[1], 10);
      if (second >= 64 && second <= 127) return true; // CGNAT 100.64/10
    }
    if (value.startsWith('172.')) {
      const second = parseInt(value.split('.')[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    // IPv4-mapped IPv6 (::ffff:127.0.0.1)
    return false;
  }

  // IPv6
  if (value.includes(':')) {
    const bare = value.replace(/^\[|\]$/g, '');
    if (bare === '::1') return true;
    if (bare.startsWith('fe80') || bare.startsWith('fec0')) return true; // link-local / site-local
    if (bare.startsWith('fc') || bare.startsWith('fd')) return true; // unique local
    if (bare.startsWith('::ffff:')) {
      const mapped = bare.slice('::ffff:'.length);
      if (isIP(mapped) === 4) return isPrivateAddress(mapped);
    }
  }

  return false;
}

/**
 * 校验 URL 是否允许被服务端请求。
 * 通过返回 URL 对象，不通过抛出 Error。
 */
export async function assertSafeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http/https protocols are allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) {
    throw new Error('Missing hostname');
  }

  const lowerHost = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(lowerHost)) {
    throw new Error('Blocked hostname');
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => lowerHost.endsWith(suffix))) {
    throw new Error('Blocked hostname');
  }

  // 直接是 IP 字面量
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error('Private/internal addresses are not allowed');
    }
    return url;
  }

  // 域名：解析后逐条校验
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('DNS resolution failed');
  }

  if (!addresses || addresses.length === 0) {
    throw new Error('DNS resolution returned no addresses');
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error('Private/internal addresses are not allowed');
    }
  }

  return url;
}

/** 非抛出版本：返回 { ok, reason, url } */
export async function checkSafeUrl(rawUrl) {
  try {
    const url = await assertSafeUrl(rawUrl);
    return { ok: true, url };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
