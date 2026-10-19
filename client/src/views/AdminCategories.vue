<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <h1 class="text-xl sm:text-2xl font-bold text-slate-800">分类管理</h1>
      <el-button type="primary" @click="openDialog()">添加分类</el-button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
      <el-table ref="tableRef" :data="categories" stripe row-key="id">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column width="48" align="center">
          <template #default="{ row }">
            <svg
              v-if="!row.parentId"
              class="drag-handle w-4 h-4 text-slate-400 cursor-move"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
              title="拖动调整顺序"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>
          </template>
        </el-table-column>
        <el-table-column label="名称">
          <template #default="{ row }">
            <span :style="{ paddingLeft: `${(row.level || 0) * 20}px` }">
              <span v-if="row.level > 0">└── </span>{{ row.name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="slug" label="Slug" width="120" />
        <el-table-column prop="parentId" label="父分类" width="80">
          <template #default="{ row }">
            {{ row.parentId ? '是' : '否' }}
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column label="网站数量" width="100">
          <template #default="{ row }">
            {{ row._count?.sites || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            <el-button
              v-if="!row.parentId"
              size="small"
              :disabled="savingOrder"
              @click="moveTopCategory(row, -1)"
              title="上移"
            >↑</el-button>
            <el-button
              v-if="!row.parentId"
              size="small"
              :disabled="savingOrder"
              @click="moveTopCategory(row, 1)"
              title="下移"
            >↓</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑分类' : '添加分类'"
      width="90vw sm:w-[500px]"
      class="!max-w-full sm:!max-w-[500px]"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="Slug" prop="slug">
          <el-input v-model="form.slug" placeholder="请输入 slug" />
        </el-form-item>
        <el-form-item label="父分类">
          <el-select v-model="form.parentId" placeholder="选择父分类（顶级分类请留空）" clearable>
            <el-option
              v-for="cat in parentCategories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { categoryApi } from '../api/categories'

const categories = ref([])
const tableRef = ref(null)
const savingOrder = ref(false)
let sortableInstance = null
const dialogVisible = ref(false)
const loading = ref(false)
const isEdit = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const form = ref({
  name: '',
  slug: '',
  parentId: null,
  sortOrder: 0
})

const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  slug: [
    { required: true, message: '请输入 slug', trigger: 'blur' },
    { pattern: /^[a-z0-9-]+$/, message: 'Slug 只能包含小写字母、数字和连字符', trigger: 'blur' }
  ]
}

const parentCategories = computed(() => {
  return categories.value.filter(cat => !cat.parentId && (!isEdit.value || cat.id !== editingId.value))
})

function buildTree(cats, parentId = null, level = 0) {
  const result = []
  const children = cats.filter(c => c.parentId === parentId)
  children.forEach(child => {
    result.push({ ...child, level })
    result.push(...buildTree(cats, child.id, level + 1))
  })
  return result
}

function openDialog(row = null) {
  if (row) {
    isEdit.value = true
    editingId.value = row.id
    form.value = {
      name: row.name,
      slug: row.slug,
      parentId: row.parentId || null,
      sortOrder: row.sortOrder
    }
  } else {
    isEdit.value = false
    editingId.value = null
    form.value = {
      name: '',
      slug: '',
      parentId: null,
      sortOrder: 0
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
        await categoryApi.update(editingId.value, form.value)
        ElMessage.success('分类更新成功')
      } else {
        await categoryApi.create(form.value)
        ElMessage.success('分类创建成功')
      }

      dialogVisible.value = false
      fetchCategories()
    } catch (err) {
      ElMessage.error(err.response?.data?.error || '操作失败')
    } finally {
      loading.value = false
    }
  })
}

async function handleDelete(row) {
  try {
    const willDeleteChildren = categories.value.some(c => c.parentId === row.id)

    await ElMessageBox.confirm(
      willDeleteChildren
        ? `确定要删除分类 "${row.name}" 吗？${'其子分类会一并删除'}；该分类下的网站不会被删除，只会变成未分类。`
        : `确定要删除分类 "${row.name}" 吗？该分类下的网站不会被删除，只会变成未分类。`,
      '确认删除',
      { type: 'warning' }
    )

    const res = await categoryApi.delete(row.id)
    const detached = res.data?.detachedSites || 0
    ElMessage.success(detached > 0 ? `删除成功，${detached} 个网站已移出该分类` : '删除成功')
    fetchCategories()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '删除失败')
    }
  }
}

/**
 * 把某个顶级分类的整棵子树（在扁平数组里是连续的一段）整体搬到目标位置。
 * 只搬父分类不管子分类的话，子分类会被留在原地，树结构就散了。
 */
function moveBlock(list, fromIndex, toIndex) {
  const root = list[fromIndex]
  const block = [root]

  let i = fromIndex + 1
  while (i < list.length && list[i].level > root.level) {
    block.push(list[i])
    i += 1
  }

  list.splice(fromIndex, block.length)

  const insertAt = toIndex > fromIndex ? toIndex - (block.length - 1) : toIndex
  const clamped = Math.max(0, Math.min(insertAt, list.length))
  list.splice(clamped, 0, ...block)
}

/** 按当前列表顺序重排 sortOrder 并落库 */
async function persistOrder() {
  savingOrder.value = true
  try {
    // 先让表格里的"排序"列立即反映新顺序，再提交
    categories.value.forEach((cat, index) => {
      cat.sortOrder = index
    })

    const items = categories.value.map((cat) => ({ id: cat.id, sortOrder: cat.sortOrder }))
    await categoryApi.reorder(items)
    ElMessage.success('排序已保存')
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '排序保存失败')
    await fetchCategories()
  } finally {
    savingOrder.value = false
  }
}

/** 上移 / 下移按钮：只调整顶级分类之间的相对位置 */
async function moveTopCategory(row, direction) {
  const top = categories.value.filter(c => !c.parentId)
  const currentTopIndex = top.findIndex(c => c.id === row.id)
  const targetTopIndex = currentTopIndex + direction

  if (currentTopIndex < 0 || targetTopIndex < 0 || targetTopIndex >= top.length) return

  const from = categories.value.findIndex(c => c.id === row.id)
  const target = top[targetTopIndex]

  let to = categories.value.findIndex(c => c.id === target.id)
  if (direction > 0) {
    // 往下移要落到目标整棵子树的后面
    let i = to + 1
    while (i < categories.value.length && categories.value[i].level > target.level) i += 1
    to = i - 1
  }

  moveBlock(categories.value, from, to)
  await persistOrder()
}

/** Element Plus 的 el-table 没有内置行拖拽，这里用 sortablejs 绑到 tbody 上 */
function initSortable() {
  if (sortableInstance) return

  const tbody = tableRef.value?.$el?.querySelector('.el-table__body-wrapper tbody')
  if (!tbody) return

  sortableInstance = Sortable.create(tbody, {
    handle: '.drag-handle',
    animation: 160,
    ghostClass: 'sortable-ghost',
    onEnd({ oldIndex, newIndex }) {
      if (oldIndex === newIndex || oldIndex == null || newIndex == null) return
      moveBlock(categories.value, oldIndex, newIndex)
      persistOrder()
    }
  })
}

async function fetchCategories() {
  try {
    const res = await categoryApi.getAll()
    categories.value = buildTree(res.data)
    await nextTick()
    initSortable()
  } catch (err) {
    ElMessage.error('获取分类列表失败')
  }
}

onMounted(fetchCategories)

onUnmounted(() => {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
})
</script>

<!-- 非 scoped：拖拽占位行由 sortablejs 动态插入到 el-table 内部，拿不到 scoped 属性 -->
<style>
.sortable-ghost td {
  background: #dbeafe !important;
  opacity: 0.6;
}
</style>
