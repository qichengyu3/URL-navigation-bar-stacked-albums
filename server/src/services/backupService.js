import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  prisma,
  collectExportData,
  normalizeImportPayload,
  replaceAllData
} from './dataTransfer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 备份目录用绝对路径，避免依赖进程启动时的 cwd
const BACKUP_DIR = path.join(__dirname, '../../backups');
const INDEX_FILE = path.join(BACKUP_DIR, 'index.json');

/** 服务端保留的备份份数，超出后自动删除最旧的 */
export const MAX_BACKUPS = 10;

// 文件名格式固定，任何不匹配的一律拒绝，杜绝 ../ 之类的路径穿越
const NAME_RE = /^backup-\d{8}-\d{6}(?:-\d+)?\.json$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

function buildBaseName(date) {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `backup-${stamp}`;
}

/** 校验文件名并解析成绝对路径；非法一律抛错 */
function resolveBackupPath(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    throw new Error('非法的备份文件名');
  }
  const target = path.resolve(BACKUP_DIR, name);
  // 双重保险：解析后的路径必须仍在备份目录内
  if (target !== path.join(BACKUP_DIR, name)) {
    throw new Error('非法的备份文件名');
  }
  return target;
}

async function ensureDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** 索引只存摘要，列表接口就不必把每个备份文件都读一遍 */
async function readIndex() {
  try {
    const raw = await fs.readFile(INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((e) => e && typeof e.filename === 'string');
  } catch {
    return null;
  }
}

async function writeIndex(entries) {
  const tmp = `${INDEX_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(entries, null, 2), 'utf8');
  await fs.rename(tmp, INDEX_FILE);
}

async function statEntry(filename) {
  const target = resolveBackupPath(filename);
  const stat = await fs.stat(target);

  let meta = {};
  try {
    const raw = await fs.readFile(target, 'utf8');
    const data = JSON.parse(raw);
    meta = {
      label: data?.meta?.label || '',
      createdAt: data?.exportedAt || stat.mtime.toISOString(),
      categoryCount: Array.isArray(data?.categories) ? data.categories.length : (data?.meta?.categoryCount ?? 0),
      siteCount: Array.isArray(data?.sites) ? data.sites.length : (data?.meta?.siteCount ?? 0)
    };
  } catch {
    // 文件损坏时至少保证能列出来，让用户在界面上看到并删除
    meta = {
      label: '',
      createdAt: stat.mtime.toISOString(),
      categoryCount: 0,
      siteCount: 0,
      corrupted: true
    };
  }

  return { filename, size: stat.size, ...meta };
}

/** 索引丢失或损坏时，扫描目录重新建立 */
async function rebuildIndex() {
  await ensureDir();
  const files = (await fs.readdir(BACKUP_DIR)).filter((f) => NAME_RE.test(f));

  const entries = [];
  for (const filename of files) {
    try {
      entries.push(await statEntry(filename));
    } catch {
      // 跳过读不了的文件
    }
  }

  entries.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  await writeIndex(entries);
  return entries;
}

/**
 * 创建一份备份快照。
 * 返回该备份的摘要信息。
 */
export async function createBackup({ label = '' } = {}) {
  await ensureDir();

  const data = await collectExportData({ label });
  const now = new Date();
  const base = buildBaseName(now);

  let filename = `${base}.json`;
  let suffix = 1;
  while (await fileExists(path.join(BACKUP_DIR, filename))) {
    suffix += 1;
    filename = `${base}-${suffix}.json`;
  }

  const target = path.join(BACKUP_DIR, filename);
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  // 先落临时文件再改名，避免进程中断留下写了一半的备份
  await fs.rename(tmp, target);

  let entries = (await readIndex()) || [];
  entries = entries.filter((e) => e.filename !== filename);
  entries.push({
    filename,
    label: label || '',
    createdAt: data.exportedAt,
    categoryCount: data.meta.categoryCount,
    siteCount: data.meta.siteCount,
    size: (await fs.stat(target)).size
  });

  const pruned = await prune(entries);
  await writeIndex(pruned);

  return pruned.find((e) => e.filename === filename) || entries[entries.length - 1];
}

/** 只保留最新 MAX_BACKUPS 份，超出的删文件 */
async function prune(entries) {
  const sorted = [...entries].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const keep = sorted.slice(0, MAX_BACKUPS);
  const drop = sorted.slice(MAX_BACKUPS);

  for (const entry of drop) {
    try {
      await fs.unlink(path.join(BACKUP_DIR, entry.filename));
    } catch {
      // 文件已经不在就算了，索引里剔掉即可
    }
  }

  return keep;
}

/** 列出所有备份，按时间倒序 */
export async function listBackups() {
  let entries = await readIndex();

  if (!entries) {
    return rebuildIndex();
  }

  // 与磁盘对账：文件被手工删掉的条目直接剔除
  const onDisk = new Set((await fs.readdir(BACKUP_DIR).catch(() => [])).filter((f) => NAME_RE.test(f)));
  const valid = entries.filter((e) => NAME_RE.test(e.filename) && onDisk.has(e.filename));

  if (valid.length !== entries.length) {
    await writeIndex(valid);
  }

  return valid.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function readBackup(filename) {
  const target = resolveBackupPath(filename);

  if (!(await fileExists(target))) {
    throw new Error('备份文件不存在');
  }

  const raw = await fs.readFile(target, 'utf8');

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('备份文件已损坏，无法解析');
  }
}

/** 删除指定备份（支持批量） */
export async function deleteBackups(filenames) {
  if (!Array.isArray(filenames) || filenames.length === 0) {
    throw new Error('请选择要删除的备份');
  }

  // 先全部校验，任何一个文件名非法就整批拒绝，避免删掉一半才报错
  filenames.map(resolveBackupPath);

  let entries = (await readIndex()) || [];
  const removed = [];
  const missing = [];

  for (const filename of filenames) {
    try {
      await fs.unlink(path.join(BACKUP_DIR, filename));
      removed.push(filename);
    } catch (err) {
      // 文件本来就不在：索引里照旧剔除，但要如实告诉调用方没删到东西
      if (err.code !== 'ENOENT') throw err;
      missing.push(filename);
    }
  }

  const gone = [...removed, ...missing];
  entries = entries.filter((e) => !gone.includes(e.filename));
  await writeIndex(entries);

  return { removed: removed.length, missing: missing.length };
}

/**
 * 用备份文件整体恢复数据。
 * 恢复前会先给当前数据留一份快照，恢复错了还能退回去。
 */
export async function restoreBackup(filename) {
  const data = await readBackup(filename);
  const normalized = normalizeImportPayload(data);

  if (normalized.error) {
    return { error: normalized.error };
  }

  const safety = await createBackup({ label: `恢复 ${filename} 前自动备份` });

  await prisma.$transaction((tx) => replaceAllData(tx, normalized.categories, normalized.sites));

  return {
    counts: {
      categories: normalized.categories.length,
      sites: normalized.sites.length
    },
    safetyBackup: safety.filename
  };
}

export { BACKUP_DIR };
