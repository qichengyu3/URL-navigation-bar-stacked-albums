import { reactive, ref, onMounted } from 'vue'
import { settingsApi } from '../api/settings'

const globalSettings = reactive({
  siteName: 'TabHub',
  siteSubtitle: '',
  logo: '',
  bannerImage: '',
  bannerTitle: '',
  hotSearches: ''
})

const globalLoading = ref(false)

export function useSettings() {
  const loading = ref(false)

  async function loadSettings() {
    loading.value = true
    globalLoading.value = true
    try {
      const res = await settingsApi.getAll()
      Object.assign(globalSettings, res.data)
    } catch (err) {
      console.log('No settings found, using defaults')
    } finally {
      loading.value = false
      globalLoading.value = false
    }
  }

  onMounted(async () => {
    await loadSettings()
  })

  return {
    settings: globalSettings,
    loading,
    loadSettings
  }
}

export async function refreshSettings() {
  globalLoading.value = true
  try {
    const res = await settingsApi.getAll()
    Object.assign(globalSettings, res.data)
  } catch (err) {
    console.log('Failed to refresh settings')
  } finally {
    globalLoading.value = false
  }
}

export function getImageUrl(path) {
  if (!path) return ''
  return path
}
