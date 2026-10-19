import { api } from './index'

export const backupApi = {
  /** 备份列表（含服务端保留上限） */
  list() {
    return api.get('/backup')
  },

  /** 立即创建一份快照 */
  create(label = '') {
    return api.post('/backup', { label })
  },

  /** 下载指定备份（返回 blob） */
  download(filename) {
    return api.get(`/backup/${encodeURIComponent(filename)}/download`, {
      responseType: 'blob'
    })
  },

  /** 用指定备份整体恢复数据 */
  restore(filename) {
    return api.post(`/backup/${encodeURIComponent(filename)}/restore`)
  },

  /** 删除指定备份 */
  remove(filename) {
    return api.delete(`/backup/${encodeURIComponent(filename)}`)
  }
}
