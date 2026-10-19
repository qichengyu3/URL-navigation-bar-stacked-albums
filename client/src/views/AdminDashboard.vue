<template>
  <div>
    <h1 class="text-2xl font-bold text-slate-800 mb-6">概览</h1>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-500">网站总数</p>
            <p class="text-3xl font-bold text-slate-800 mt-1">{{ stats.totalSites }}</p>
          </div>
          <div class="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-500">分类总数</p>
            <p class="text-3xl font-bold text-slate-800 mt-1">{{ stats.totalCategories }}</p>
          </div>
          <div class="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
            <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-slate-500">最近更新</p>
            <p class="text-lg font-bold text-slate-800 mt-1">{{ stats.lastUpdated }}</p>
          </div>
          <div class="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
            <svg class="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h2 class="text-lg font-semibold text-slate-800 mb-4">快速操作</h2>
        <div class="flex gap-4">
          <router-link to="/admin/sites">
            <el-button type="primary">
              添加网站
            </el-button>
          </router-link>
          <router-link to="/admin/categories">
            <el-button>
              管理分类
            </el-button>
          </router-link>
          <router-link to="/">
            <el-button>
              查看前台
            </el-button>
          </router-link>
        </div>
      </div>

      <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-slate-800">点击排行榜</h2>
          <span class="text-sm text-slate-500">Top 10</span>
        </div>
        <div class="space-y-3">
          <div
            v-for="(site, index) in popularSites"
            :key="site.id"
            class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div
              :class="[
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                index === 0 ? 'bg-yellow-400 text-white' :
                index === 1 ? 'bg-slate-300 text-white' :
                index === 2 ? 'bg-orange-400 text-white' :
                'bg-slate-100 text-slate-500'
              ]"
            >
              {{ index + 1 }}
            </div>
            <div class="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
              <img
                v-if="site.icon && !failedIcons.has(site.id)"
                :src="site.icon"
                :alt="site.title"
                class="w-full h-full object-cover"
                @error="handleIconError(site.id)"
              />
              <svg v-else class="w-4 h-4 text-slate-400 mx-auto mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-800 truncate">{{ site.title }}</p>
              <p class="text-xs text-slate-500">{{ site.category?.name || '未分类' }}</p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-sm font-bold text-primary">{{ site.clickCount || 0 }}</p>
              <p class="text-xs text-slate-400">次点击</p>
            </div>
          </div>
          <div v-if="popularSites.length === 0" class="text-center py-8">
            <p class="text-slate-500">暂无点击数据</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { categoryApi } from '../api/categories'
import { siteApi } from '../api/sites'

const stats = ref({
  totalSites: 0,
  totalCategories: 0,
  lastUpdated: '-'
})

const popularSites = ref([])

// 图标加载失败时回落到占位图形，避免出现一片碎图
const failedIcons = ref(new Set())
function handleIconError(id) {
  failedIcons.value.add(id)
}

async function fetchStats() {
  try {
    const [catRes, sitesRes] = await Promise.all([
      categoryApi.getAll(),
      siteApi.getAll()
    ])

    stats.value.totalCategories = catRes.data.length
    stats.value.totalSites = sitesRes.data.length

    if (sitesRes.data.length > 0) {
      const latest = sitesRes.data[0]
      const date = new Date(latest.updatedAt)
      stats.value.lastUpdated = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
    }
  } catch (err) {
    console.error('Failed to fetch stats:', err)
  }
}

async function fetchPopularSites() {
  try {
    const res = await siteApi.getPopular(10)
    popularSites.value = res.data
  } catch (err) {
    console.error('Failed to fetch popular sites:', err)
  }
}

onMounted(async () => {
  await fetchStats()
  await fetchPopularSites()
})
</script>
