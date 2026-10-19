<template>
  <div class="min-h-screen bg-slate-50">
    <header class="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div class="flex items-center justify-between px-4 sm:px-6 h-16">
        <div class="flex items-center gap-4">
          <button @click="toggleSidebar" class="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors">
            <svg class="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div class="flex items-center gap-2 cursor-pointer group" title="回到前台首页" @click="goHome">
            <div class="w-8 h-8 bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity group-hover:opacity-85">
              <span class="text-white text-sm font-bold">T</span>
            </div>
            <span class="text-lg font-semibold text-slate-800 hidden sm:block transition-colors group-hover:text-indigo-700">{{ settings.siteName || 'TabHub' }}</span>
          </div>
          <span class="text-slate-300 hidden sm:block">|</span>
          <span class="text-sm text-slate-600 hidden sm:block">管理后台</span>
        </div>

        <div class="flex items-center gap-4">
          <span class="text-sm text-slate-600 hidden sm:block">{{ authStore.user?.username }}</span>
          <el-button type="danger" size="small" @click="handleLogout">退出</el-button>
        </div>
      </div>
    </header>

    <div class="flex">
      <aside 
        class="fixed left-0 top-0 h-full w-56 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:h-auto lg:min-h-[calc(100vh-64px)]"
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="p-4 border-b border-slate-100 flex items-center justify-between lg:hidden">
          <div class="flex items-center gap-2 cursor-pointer" title="回到前台首页" @click="goHome">
            <div class="w-7 h-7 bg-gradient-to-br from-indigo-900 to-indigo-700 rounded flex items-center justify-center flex-shrink-0">
              <span class="text-white text-xs font-bold">T</span>
            </div>
            <span class="font-semibold text-slate-800 text-sm">{{ settings.siteName || 'TabHub' }}</span>
          </div>
          <button @click="toggleSidebar" class="p-2 -mr-2 rounded-lg hover:bg-slate-100 transition-colors">
            <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav class="p-4">
          <router-link
            to="/admin"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors',
              $route.path === '/admin' ? 'bg-primary-50 text-primary' : 'text-slate-600 hover:bg-slate-50'
            ]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>概览</span>
          </router-link>

          <router-link
            to="/admin/categories"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors',
              $route.path === '/admin/categories' ? 'bg-primary-50 text-primary' : 'text-slate-600 hover:bg-slate-50'
            ]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>分类管理</span>
          </router-link>

          <router-link
            to="/admin/sites"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors',
              $route.path === '/admin/sites' ? 'bg-primary-50 text-primary' : 'text-slate-600 hover:bg-slate-50'
            ]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span>网站管理</span>
          </router-link>

          <router-link
            to="/admin/settings"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors',
              $route.path === '/admin/settings' ? 'bg-primary-50 text-primary' : 'text-slate-600 hover:bg-slate-50'
            ]"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>系统设置</span>
          </router-link>
        </nav>
      </aside>

      <div v-if="sidebarOpen" @click="toggleSidebar" class="fixed inset-0 bg-black/50 z-40 lg:hidden"></div>

      <main class="flex-1 p-4 sm:p-6 overflow-x-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSettings, getImageUrl } from '../composables/useSettings'

const { settings } = useSettings()
const router = useRouter()
const authStore = useAuthStore()
const sidebarOpen = ref(false)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

// 点击左上角 Logo 回到前台首页
function goHome() {
  router.push('/')
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>
