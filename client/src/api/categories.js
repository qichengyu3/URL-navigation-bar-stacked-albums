import { api } from './index'

export const categoryApi = {
  getAll() {
    return api.get('/categories')
  },

  getTree() {
    return api.get('/categories/tree')
  },

  getById(id) {
    return api.get(`/categories/${id}`)
  },

  create(data) {
    return api.post('/categories', data)
  },

  update(id, data) {
    return api.put(`/categories/${id}`, data)
  },

  delete(id) {
    return api.delete(`/categories/${id}`)
  },

  reorder(categories) {
    return api.put('/categories/reorder', { categories })
  }
}
