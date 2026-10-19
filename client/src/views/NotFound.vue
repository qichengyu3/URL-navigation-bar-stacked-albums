<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
    <p class="text-6xl font-bold text-slate-300 dark:text-slate-700">404</p>
    <p class="mt-4 text-slate-600 dark:text-slate-300">这个页面不存在</p>
    <div class="mt-8 flex items-center gap-3">
      <router-link
        to="/"
        class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        回到首页
      </router-link>
      <router-link
        to="/admin"
        class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        管理后台
      </router-link>
    </div>
  </div>
</template>
