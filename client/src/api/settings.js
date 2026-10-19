import { api } from './index'

export const settingsApi = {
  getAll() {
    return api.get('/settings')
  },

  get(key) {
    return api.get(`/settings/${key}`)
  },

  save(key, value) {
    return api.post('/settings', { key, value })
  },

  delete(key) {
    return api.delete(`/settings/${key}`)
  }
}
