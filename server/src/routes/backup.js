import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import {
  MAX_BACKUPS,
  listBackups,
  createBackup,
  readBackup,
  deleteBackups,
  restoreBackup
} from '../services/backupService.js';

const router = Router();

/**
 * 服务端备份快照。
 * 备份文件结构与 /api/sites/import 接受的结构完全一致，
 * 所以下载的备份既能直接导入，也能在这里一键恢复。
 */

/** 列表 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({ maxBackups: MAX_BACKUPS, backups });
  } catch (err) {
    console.error('List backups error:', err);
    res.status(500).json({ error: '获取备份列表失败' });
  }
});

/** 创建一份新备份 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const label = typeof req.body?.label === 'string' ? req.body.label.slice(0, 100) : '';
    const entry = await createBackup({ label });
    res.json(entry);
  } catch (err) {
    console.error('Create backup error:', err);
    res.status(500).json({ error: '创建备份失败' });
  }
});

/** 下载指定备份 */
router.get('/:name/download', authMiddleware, async (req, res) => {
  try {
    const data = await readBackup(req.params.name);
    const payload = JSON.stringify(data, null, 2);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}"`);
    res.send(payload);
  } catch (err) {
    if (err.message === '备份文件不存在') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === '非法的备份文件名' || err.message === '备份文件已损坏，无法解析') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Download backup error:', err);
    res.status(500).json({ error: '下载备份失败' });
  }
});

/** 用备份整体恢复数据 */
router.post('/:name/restore', authMiddleware, async (req, res) => {
  try {
    const result = await restoreBackup(req.params.name);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: '数据已恢复',
      counts: result.counts,
      safetyBackup: result.safetyBackup
    });
  } catch (err) {
    if (err.message === '备份文件不存在') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === '非法的备份文件名' || err.message === '备份文件已损坏，无法解析') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Restore backup error:', err);
    res.status(500).json({ error: '恢复失败' });
  }
});

/** 删除备份（单个） */
router.delete('/:name', authMiddleware, async (req, res) => {
  try {
    const result = await deleteBackups([req.params.name]);

    if (result.removed === 0) {
      return res.status(404).json({ error: '备份文件不存在' });
    }

    res.json({ message: '已删除', removed: result.removed });
  } catch (err) {
    if (err.message === '非法的备份文件名') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Delete backup error:', err);
    res.status(500).json({ error: '删除备份失败' });
  }
});

export default router;
