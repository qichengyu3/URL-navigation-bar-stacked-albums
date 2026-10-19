<template>
  <div class="max-w-2xl mx-auto">
    <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
      <h2 class="text-lg font-semibold text-slate-800 mb-6">系统设置</h2>
      
      <div class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">网站名称</label>
          <el-input
            v-model="settings.siteName"
            placeholder="请输入网站名称"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">网站Logo</label>
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div class="relative">
              <div 
                class="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 cursor-pointer"
                @click="triggerLogoUpload"
              >
                <img 
                  v-if="settings.logo" 
                  :src="getImageUrl(settings.logo)" 
                  alt="Logo"
                  class="w-full h-full object-contain"
                />
                <span v-else class="text-slate-400 text-sm text-center px-2">点击上传</span>
              </div>
              <input 
                ref="logoInput"
                type="file" 
                accept="image/*" 
                class="hidden"
                @change="handleLogoUpload"
              />
            </div>
            <div class="flex-1">
              <p class="text-sm text-slate-500">支持 JPG、PNG、SVG 格式</p>
              <button 
                v-if="settings.logo"
                @click="removeLogo"
                class="mt-2 text-sm text-red-500 hover:text-red-600"
              >
                移除Logo
              </button>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">网站副标题</label>
          <el-input
            v-model="settings.siteSubtitle"
            placeholder="显示在首页 Banner 标题的下方（可选）"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Banner 标题</label>
          <el-input
            v-model="settings.bannerTitle"
            placeholder="显示在首页 Banner 上；留空则显示网站名称"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Banner 图片</label>
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div class="relative">
              <div 
                class="w-full sm:w-40 h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 cursor-pointer"
                @click="triggerBannerUpload"
              >
                <img 
                  v-if="settings.bannerImage" 
                  :src="getImageUrl(settings.bannerImage)" 
                  alt="Banner"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-slate-400 text-sm text-center px-2">点击上传</span>
              </div>
              <input 
                ref="bannerInput"
                type="file" 
                accept="image/*" 
                class="hidden"
                @change="handleBannerUpload"
              />
            </div>
            <div class="flex-1">
              <p class="text-sm text-slate-500">支持 JPG、PNG 格式，建议尺寸 1920x500</p>
              <button 
                v-if="settings.bannerImage"
                @click="removeBanner"
                class="mt-2 text-sm text-red-500 hover:text-red-600"
              >
                移除Banner图片
              </button>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">热门搜索词</label>
          <el-input
            v-model="settings.hotSearches"
            type="textarea"
            :rows="2"
            placeholder="用逗号或换行分隔，例如：GitHub, Vue, Docker（留空则用默认词）"
            class="w-full"
          />
          <p class="text-xs text-slate-400 mt-1">显示在首页搜索框下拉的"热门搜索"区域</p>
        </div>

        <div class="border-t border-slate-100 pt-6 mt-6">
          <div class="flex items-center justify-between mb-4">
            <label class="block text-sm font-medium text-slate-700">公告轮播</label>
            <el-button type="primary" size="small" @click="addAnnouncement">添加公告</el-button>
          </div>
          <div class="space-y-3">
            <div
              v-for="(item, index) in announcements"
              :key="index"
              class="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
            >
              <div class="flex-1 space-y-2">
                <el-input
                  v-model="item.text"
                  placeholder="请输入公告内容"
                  size="small"
                />
                <el-input
                  v-model="item.url"
                  placeholder="点击跳转链接（可选）"
                  size="small"
                />
              </div>
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                @click="removeAnnouncement(index)"
                circle
              />
            </div>
            <p v-if="announcements.length === 0" class="text-sm text-slate-400 text-center py-4">
              暂无公告，点击"添加公告"创建
            </p>
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-col sm:flex-row justify-end gap-3">
        <el-button @click="resetSettings">重置</el-button>
        <el-button type="primary" @click="saveSettings">保存设置</el-button>
      </div>
    </div>

    <!-- 数据备份：快照落服务端，可选择性下载 / 直接恢复 -->
    <div class="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6 mt-6">
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-lg font-semibold text-slate-800">数据备份</h2>
        <el-button
          type="primary"
          size="small"
          :loading="creatingBackup"
          @click="handleCreateBackup"
        >
          立即备份
        </el-button>
      </div>
      <p class="text-xs text-slate-400 mb-4">
        备份包含全部分类与网站（名称、链接、图标、排序、点击量），可下载留存或一键恢复。
        服务端只保留最新 {{ maxBackups }} 份，超出后自动删除最旧的。
      </p>

      <div
        v-if="backups.length > 0"
        class="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-100"
      >
        <el-checkbox v-model="selectAll" :indeterminate="indeterminate">全选</el-checkbox>
        <span class="text-xs text-slate-500">已选 {{ selectedBackups.length }} 份</span>
        <div class="flex-1"></div>
        <el-button size="small" :disabled="!selectedBackups.length" @click="downloadSelected">
          下载所选
        </el-button>
        <el-button
          size="small"
          type="danger"
          plain
          :disabled="!selectedBackups.length"
          @click="deleteSelected"
        >
          删除所选
        </el-button>
      </div>

      <div v-if="backupsLoading" class="text-sm text-slate-400 py-6 text-center">加载中…</div>
      <div v-else-if="backups.length === 0" class="text-sm text-slate-400 py-6 text-center">
        还没有备份，点击「立即备份」创建第一份
      </div>
      <div v-else class="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        <div
          v-for="item in backups"
          :key="item.filename"
          class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
        >
          <el-checkbox v-model="selectedBackups" :value="item.filename" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-slate-700 truncate">
              {{ formatBackupTime(item.createdAt) }}
              <span v-if="item.label" class="ml-1 text-xs font-normal text-slate-400">· {{ item.label }}</span>
            </div>
            <div class="text-xs text-slate-400 mt-0.5">
              {{ item.categoryCount }} 个分类 · {{ item.siteCount }} 个网站 · {{ formatSize(item.size) }}
              <span v-if="item.corrupted" class="text-red-500 ml-1">（文件损坏）</span>
            </div>
          </div>
          <div class="flex-none flex gap-1">
            <el-button size="small" @click="downloadOne(item.filename)">下载</el-button>
            <el-button
              size="small"
              type="warning"
              plain
              :loading="restoring === item.filename"
              @click="restoreOne(item)"
            >
              恢复
            </el-button>
            <el-button size="small" type="danger" plain @click="deleteOne(item)">删除</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { settingsApi } from '../api/settings'
import { api } from '../api/index'
import { backupApi } from '../api/backup'
import { getImageUrl } from '../composables/useSettings'

const logoInput = ref(null)
const bannerInput = ref(null)
const settings = reactive({
  siteName: 'TabHub',
  siteSubtitle: '',
  logo: '',
  bannerImage: '',
  bannerTitle: '',
  hotSearches: ''
})
const announcements = ref([])

const originalSettings = reactive({})

// ---------- 数据备份 ----------
const backups = ref([])
const backupsLoading = ref(false)
const creatingBackup = ref(false)
const restoring = ref('')
const selectedBackups = ref([])
const maxBackups = ref(10)

const indeterminate = computed(
  () => selectedBackups.value.length > 0 && selectedBackups.value.length < backups.value.length
)
const selectAll = computed({
  get: () => backups.value.length > 0 && selectedBackups.value.length === backups.value.length,
  set: (val) => {
    selectedBackups.value = val ? backups.value.map((b) => b.filename) : []
  }
})

onMounted(async () => {
  await loadSettings()
  await loadBackups()
})

async function loadBackups() {
  backupsLoading.value = true
  try {
    const res = await backupApi.list()
    backups.value = res.data?.backups || []
    maxBackups.value = res.data?.maxBackups || 10
    // 列表刷新后剔除已经不存在的选中项
    const valid = new Set(backups.value.map((b) => b.filename))
    selectedBackups.value = selectedBackups.value.filter((f) => valid.has(f))
  } catch (err) {
    ElMessage.error('获取备份列表失败')
  } finally {
    backupsLoading.value = false
  }
}

async function handleCreateBackup() {
  creatingBackup.value = true
  try {
    await backupApi.create('手动备份')
    ElMessage.success('备份已创建')
    await loadBackups()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '创建备份失败')
  } finally {
    creatingBackup.value = false
  }
}

/** 把 blob 落成文件下载。备份接口返回的是带鉴权获取的 blob，不能直接用 URL 打开 */
function triggerDownload(data, filename) {
  const blob = data instanceof Blob
    ? data
    : new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function downloadOne(filename) {
  try {
    const res = await backupApi.download(filename)
    triggerDownload(res.data, filename)
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '下载失败')
  }
}

async function downloadSelected() {
  if (!selectedBackups.value.length) return

  if (selectedBackups.value.length > 3) {
    try {
      await ElMessageBox.confirm(
        `将连续下载 ${selectedBackups.value.length} 个备份文件，浏览器可能会询问是否允许批量下载。`,
        '批量下载',
        { type: 'info', confirmButtonText: '继续下载', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }

  for (const filename of [...selectedBackups.value]) {
    await downloadOne(filename)
    // 连续触发下载需要间隔，否则浏览器会吞掉后面的请求
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
}

async function restoreOne(item) {
  try {
    await ElMessageBox.confirm(
      `将用「${formatBackupTime(item.createdAt)}」这份备份完整替换当前的分类和网站数据` +
        `（${item.categoryCount} 个分类 / ${item.siteCount} 个网站）。\n\n` +
        `当前数据会先自动存一份快照，恢复后仍可退回。`,
      '确认恢复',
      { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  restoring.value = item.filename
  try {
    const res = await backupApi.restore(item.filename)
    ElMessage.success(`已恢复 ${res.data?.counts?.sites ?? 0} 个网站`)
    await loadBackups()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '恢复失败')
  } finally {
    restoring.value = ''
  }
}

async function deleteOne(item) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${formatBackupTime(item.createdAt)}」这份备份吗？删除后无法找回。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  try {
    await backupApi.remove(item.filename)
    ElMessage.success('已删除')
    await loadBackups()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '删除失败')
  }
}

async function deleteSelected() {
  if (!selectedBackups.value.length) return

  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedBackups.value.length} 份备份吗？删除后无法找回。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  try {
    for (const filename of [...selectedBackups.value]) {
      await backupApi.remove(filename)
    }
    selectedBackups.value = []
    ElMessage.success('已删除')
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '删除失败')
  } finally {
    await loadBackups()
  }
}

function formatBackupTime(iso) {
  if (!iso) return '未知时间'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

async function loadSettings() {
  try {
    const res = await settingsApi.getAll()
    Object.assign(settings, res.data)
    Object.assign(originalSettings, res.data)
    if (res.data.announcements) {
      try {
        announcements.value = JSON.parse(res.data.announcements)
      } catch {
        announcements.value = []
      }
    } else {
      announcements.value = []
    }
  } catch (err) {
    console.log('No settings found, using defaults')
  }
}

function addAnnouncement() {
  announcements.value.push({ text: '', url: '' })
}

function removeAnnouncement(index) {
  announcements.value.splice(index, 1)
}

function triggerLogoUpload() {
  logoInput.value?.click()
}

/**
 * 统一上传入口。
 * 走 axios 实例（相对路径 /api）而不是硬编码 http://localhost:3001，
 * 这样开发走 vite 代理、生产走 nginx 反代都能通，且自动带上登录 token。
 */
async function uploadImage(file, maxSize, sizeLabel) {
  if (file.size > maxSize) {
    ElMessage.error(`图片大小不能超过 ${sizeLabel}`)
    return null
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await api.post('/upload', formData)
    const data = res.data
    if (data?.url) return data.url
    ElMessage.error(data?.error || '上传失败')
    return null
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '上传失败')
    return null
  }
}

async function handleLogoUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const url = await uploadImage(file, 500 * 1024, '500KB')
  if (url) settings.logo = url
  if (logoInput.value) logoInput.value.value = ''
}

function removeLogo() {
  settings.logo = ''
  if (logoInput.value) {
    logoInput.value.value = ''
  }
}

function triggerBannerUpload() {
  bannerInput.value?.click()
}

async function handleBannerUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const url = await uploadImage(file, 2 * 1024 * 1024, '2MB')
  if (url) settings.bannerImage = url
  if (bannerInput.value) bannerInput.value.value = ''
}

function removeBanner() {
  settings.bannerImage = ''
  if (bannerInput.value) {
    bannerInput.value.value = ''
  }
}

function resetSettings() {
  Object.assign(settings, originalSettings)
  if (logoInput.value) {
    logoInput.value.value = ''
  }
  ElMessage.info('已重置为原始设置')
}

async function saveSettings() {
  try {
    for (const key of Object.keys(settings)) {
      if (settings[key] !== undefined && settings[key] !== null) {
        await settingsApi.save(key, settings[key])
      }
    }
    await settingsApi.save('announcements', JSON.stringify(announcements.value))
    Object.assign(originalSettings, settings)
    ElMessage.success('设置保存成功')
  } catch (err) {
    ElMessage.error('保存失败')
  }
}
</script>
