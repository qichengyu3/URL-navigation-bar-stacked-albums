<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <h1 class="text-xl sm:text-2xl font-bold text-slate-800">网站管理</h1>
      <div class="flex flex-wrap gap-2">
        <el-button size="small" @click="handleExport">导出</el-button>
        <el-button size="small" @click="showImportDialog = true">导入</el-button>
        <el-button type="primary" size="small" @click="openDialog()">添加网站</el-button>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-4 overflow-x-auto">
      <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4">
        <el-select v-model="filterCategory" placeholder="筛选分类" clearable class="w-full sm:w-48">
          <el-option
            v-for="cat in flatCategories"
            :key="cat.id"
            :label="cat.label"
            :value="cat.id"
          />
        </el-select>

        <template v-if="selectedIds.length > 0">
          <el-divider direction="vertical" class="hidden sm:block" />
          <span class="text-sm text-slate-500">已选择 {{ selectedIds.length }} 项</span>
          <div class="flex flex-wrap gap-2">
            <el-button size="small" type="warning" @click="showMoveDialog = true">批量移动</el-button>
            <el-button size="small" type="danger" @click="handleBatchDelete">批量删除</el-button>
            <el-button size="small" @click="selectedIds = []">取消</el-button>
          </div>
        </template>
      </div>

      <el-table ref="tableRef" :data="filteredSites" stripe @selection-change="handleSelectionChange" @row-dragstart="handleDragStart" @row-dragend="handleDragEnd" row-key="id" draggable>
        <el-table-column type="selection" width="45" />
        <el-table-column width="40" align="center">
          <template #default>
            <svg class="w-4 h-4 text-slate-400 cursor-move" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>
          </template>
        </el-table-column>
        <el-table-column label="图标" width="70">
          <template #default="{ row }">
            <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
              <img v-if="row.icon" :src="getIconUrl(row.icon)" :alt="row.title" class="w-6 h-6 object-contain" @error="handleImageError" />
              <svg v-else class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="120" />
        <el-table-column prop="url" label="URL" min-width="150">
          <template #default="{ row }">
            <a :href="row.url" target="_blank" class="text-primary hover:underline text-sm">{{ row.url }}</a>
          </template>
        </el-table-column>
        <el-table-column prop="category.name" label="分类" width="100" />
        <el-table-column prop="clickCount" label="点击" width="60" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="refreshIcon(row)">更新图标</el-button>
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑网站' : '添加网站'"
      width="90vw sm:w-[600px]"
      class="!max-w-full sm:!max-w-[600px]"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入网站标题" />
        </el-form-item>

        <el-form-item label="URL" prop="url">
          <el-input v-model="form.url" placeholder="https://example.com" @blur="handleUrlBlur">
            <template #append>
              <el-button @click="fetchIcon" :loading="fetchingIcon">抓取图标</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" rows="2" placeholder="请输入网站描述" />
        </el-form-item>

        <el-form-item label="分类" prop="categoryIds">
          <el-select v-model="form.categoryIds" placeholder="请选择分类（可多选）" class="w-full" multiple collapse-tags>
            <el-option
              v-for="cat in flatCategories"
              :key="cat.id"
              :label="cat.label"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="图标">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
              <img v-if="form.icon" :src="getIconUrl(form.icon)" alt="icon preview" class="w-10 h-10 object-contain" @error="handleImageError" />
              <svg v-else class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <el-upload
              :show-file-list="false"
              :before-upload="handleUpload"
              accept="image/png,image/jpeg,image/svg+xml"
            >
              <el-button>上传图标</el-button>
            </el-upload>
            <span class="text-xs text-slate-400">支持 PNG、JPG、SVG，最大 200KB</span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showMoveDialog" title="批量移动" width="90vw sm:w-[400px]" class="!max-w-full sm:!max-w-[400px]">
      <el-form-item label="目标分类">
        <el-select v-model="moveTargetCategoryIds" placeholder="请选择分类（可多选）" class="w-full" multiple collapse-tags>
          <el-option
            v-for="cat in flatCategories"
            :key="cat.id"
            :label="cat.label"
            :value="cat.id"
          />
        </el-select>
      </el-form-item>
      <template #footer>
        <el-button @click="showMoveDialog = false">取消</el-button>
        <el-button type="primary" @click="handleBatchMove" :disabled="moveTargetCategoryIds.length === 0">移动</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showImportDialog" title="导入数据" width="90vw sm:w-[500px]" class="!max-w-full sm:!max-w-[500px]">
      <div class="mb-4 text-sm text-slate-600">
        <p>导入将覆盖现有所有数据，请谨慎操作。</p>
        <p>建议先导出数据进行备份。</p>
      </div>
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :limit="1"
        accept="application/json"
        :on-change="handleImportFileChange"
        :file-list="importFileList"
      >
        <el-button>选择 JSON 文件</el-button>
        <template #tip>
          <div class="text-xs text-slate-400 mt-2">只能上传 JSON 文件</div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleImport" :loading="importing">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { siteApi, iconApi } from '../api/sites'
import { categoryApi } from '../api/categories'
import { getImageUrl } from '../composables/useSettings'

const sites = ref([])
const categories = ref([])
const filterCategory = ref(null)
const dialogVisible = ref(false)
const loading = ref(false)
const fetchingIcon = ref(false)
const isEdit = ref(false)
const editingId = ref(null)
const formRef = ref(null)
const tableRef = ref(null)
const uploadRef = ref(null)

const selectedIds = ref([])
const showMoveDialog = ref(false)
const moveTargetCategoryIds = ref([])
const showImportDialog = ref(false)
const importFileList = ref([])
const importData = ref(null)
const importing = ref(false)

const form = ref({
  title: '',
  url: '',
  description: '',
  categoryIds: [],
  icon: '',
  iconType: 'auto'
})

const rules = {
  title: [{ required: true, message: '请输入网站标题', trigger: 'blur' }],
  url: [
    { required: true, message: '请输入网站 URL', trigger: 'blur' },
    { type: 'url', message: '请输入有效的 URL', trigger: 'blur' }
  ],
  categoryIds: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

const flatCategories = computed(() => {
  const result = []
  function flatten(cats, prefix = '') {
    cats.forEach(cat => {
      result.push({ id: cat.id, label: prefix + cat.name })
      if (cat.children && cat.children.length > 0) {
        flatten(cat.children, prefix + '└── ')
      }
    })
  }
  flatten(categories.value)
  return result
})

const filteredSites = computed(() => {
  if (!filterCategory.value) return sites.value
  return sites.value.filter(site => site.categoryId === filterCategory.value)
})

function getIconUrl(icon) {
  if (!icon) return ''
  if (icon.startsWith('http')) return icon
  return getImageUrl(icon)
}

function handleImageError(e) {
  e.target.style.display = 'none'
}

function handleSelectionChange(selection) {
  selectedIds.value = selection.map(item => item.id)
}

function openDialog(row = null) {
  if (row) {
    isEdit.value = true
    editingId.value = row.id
    
    let categoryIds = []
    if (row.categoryIds) {
      try {
        categoryIds = JSON.parse(row.categoryIds)
      } catch (e) {
        console.error('Failed to parse categoryIds:', e)
      }
    }
    if (categoryIds.length === 0 && row.categoryId) {
      categoryIds = [row.categoryId]
    }
    
    form.value = {
      title: row.title,
      url: row.url,
      description: row.description || '',
      categoryIds: categoryIds,
      icon: row.icon || '',
      iconType: row.iconType || 'auto'
    }
  } else {
    isEdit.value = false
    editingId.value = null
    form.value = {
      title: '',
      url: '',
      description: '',
      categoryIds: [],
      icon: '',
      iconType: 'auto'
    }
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true

    try {
      if (isEdit.value) {
        await siteApi.update(editingId.value, form.value)
        ElMessage.success('网站更新成功')
      } else {
        await siteApi.create(form.value)
        ElMessage.success('网站创建成功')
      }

      dialogVisible.value = false
      fetchSites()
    } catch (err) {
      ElMessage.error(err.response?.data?.error || '操作失败')
    } finally {
      loading.value = false
    }
  })
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除网站 "${row.title}" 吗？`,
      '确认删除',
      { type: 'warning' }
    )

    await siteApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchSites()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '删除失败')
    }
  }
}

async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 个网站吗？`,
      '确认删除',
      { type: 'warning' }
    )

    await siteApi.batchDelete(selectedIds.value)
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    fetchSites()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '批量删除失败')
    }
  }
}

async function handleBatchMove() {
  try {
    await siteApi.batchMove(selectedIds.value, null, moveTargetCategoryIds.value)
    ElMessage.success('批量移动成功')
    showMoveDialog.value = false
    moveTargetCategoryIds.value = []
    selectedIds.value = []
    fetchSites()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '批量移动失败')
  }
}

async function refreshIcon(row) {
  try {
    const res = await iconApi.fetch(row.url)
    await siteApi.update(row.id, { icon: res.data.icon, iconType: 'auto' })
    ElMessage.success('图标更新成功')
    fetchSites()
  } catch (err) {
    ElMessage.error('图标更新失败')
  }
}

let draggedRow = null

function handleDragStart(row) {
  draggedRow = row
}

async function handleDragEnd() {
  if (!draggedRow) return
  
  const items = filteredSites.value.map((site, index) => ({
    id: site.id,
    sortOrder: index
  }))
  
  try {
    await siteApi.batchSort(items)
    ElMessage.success('排序已保存')
    fetchSites()
  } catch (err) {
    ElMessage.error('排序保存失败')
  }
  
  draggedRow = null
}

async function fetchIcon() {
  if (!form.value.url) {
    ElMessage.warning('请先输入 URL')
    return
  }

  fetchingIcon.value = true

  try {
    const res = await iconApi.fetch(form.value.url)
    form.value.icon = res.data.icon
    form.value.iconType = 'auto'
    ElMessage.success('图标抓取成功')
  } catch (err) {
    ElMessage.error('图标抓取失败，请手动上传')
  } finally {
    fetchingIcon.value = false
  }
}

function handleUrlBlur() {
  const url = form.value.url.trim()
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    form.value.url = 'https://' + url
  }
}

function handleUpload(file) {
  const maxSize = 200 * 1024
  if (file.size > maxSize) {
    ElMessage.error('图片大小不能超过 200KB')
    return false
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    form.value.icon = e.target.result
    form.value.iconType = 'upload'
  }
  reader.readAsDataURL(file)

  return false
}

async function handleExport() {
  try {
    const { format } = await ElMessageBox.confirm(
      '选择导出格式',
      '导出数据',
      {
        confirmButtonText: 'Excel',
        cancelButtonText: 'JSON',
        type: 'info'
      }
    ).then(() => ({ format: 'excel' })).catch(() => ({ format: 'json' }))

    const res = await siteApi.export(format)
    
    if (format === 'excel') {
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tabb-backup-${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } else {
      const dataStr = JSON.stringify(res.data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tabb-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    }
    ElMessage.success('数据导出成功')
  } catch (err) {
    ElMessage.error('数据导出失败')
  }
}

function handleImportFileChange(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      importData.value = JSON.parse(e.target.result)
    } catch (err) {
      ElMessage.error('JSON 解析失败')
    }
  }
  reader.readAsText(file.raw)
}

async function handleImport() {
  if (!importData.value) {
    ElMessage.error('请选择文件')
    return
  }

  try {
    importing.value = true
    const res = await siteApi.import(importData.value)
    const backupName = res.data?.safetyBackup
    ElMessage.success(
      backupName
        ? `数据导入成功，导入前已自动备份为 ${backupName}`
        : '数据导入成功'
    )
    showImportDialog.value = false
    importFileList.value = []
    importData.value = null
    fetchSites()
    fetchCategories()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '数据导入失败')
  } finally {
    importing.value = false
  }
}

async function fetchSites() {
  try {
    const res = await siteApi.getAll()
    sites.value = res.data
  } catch (err) {
    console.error('Failed to fetch sites:', err)
  }
}

async function fetchCategories() {
  try {
    const res = await categoryApi.getTree()
    categories.value = res.data
  } catch (err) {
    console.error('Failed to fetch categories:', err)
  }
}

onMounted(() => {
  fetchCategories()
  fetchSites()
})
</script>
