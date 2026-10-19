import { api } from './index'

export const siteApi = {
  getAll(params = {}) {
    return api.get('/sites', { params })
  },

  getById(id) {
    return api.get(`/sites/${id}`)
  },

  create(data) {
    return api.post('/sites', data)
  },

  update(id, data) {
    return api.put(`/sites/${id}`, data)
  },

  delete(id) {
    return api.delete(`/sites/${id}`)
  },

  refreshIcon(id) {
    return api.post(`/sites/${id}/refresh-icon`)
  },

  click(id) {
    return api.post(`/sites/${id}/click`)
  },

  batchDelete(ids) {
    return api.post('/sites/batch-delete', { ids })
  },

  batchMove(ids, categoryId, categoryIds) {
    return api.post('/sites/batch-move', { ids, categoryId, categoryIds })
  },

  batchSort(items) {
    return api.post('/sites/batch-sort', { items })
  },

  export(format = 'json') {
    const config = format === 'excel' ? { responseType: 'blob' } : {}
    return api.get(`/sites/export?format=${format}`, config)
  },

  import(data) {
    return api.post('/sites/import', data)
  },

  getPopular(limit = 10) {
    return api.get('/sites/stats/popular', { params: { limit } })
  }
}

export const iconApi = {
  upload(file) {
    const formData = new FormData()
    // 后端 upload.single('file') 只接收 file 字段
    formData.append('file', file)
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  fetch(url) {
    return api.get('/icons', { params: { url } })
  }
}
