<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 relative">
    <canvas ref="particleCanvas" class="fixed inset-0 pointer-events-none z-0"></canvas>
    <div v-if="drawerOpen" class="fixed inset-0 bg-black/50 z-[105] sm:hidden" @click="closeDrawer"></div>
    
    <!-- 液态扭曲滤镜：给玻璃面加"隔着水看"的位移效果。
         没有这段 SVG 时不要给 header 加 use-liquid，否则整条 backdrop-filter 会被丢弃。 -->
    <svg width="0" height="0" class="absolute" style="left:-9999px" aria-hidden="true">
      <defs>
        <filter id="liquid_glass_filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.003" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1.2" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="110" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>

    <!-- 顶部导航：液态玻璃 + 圆角胶囊风格
         产品决策：页眉固定全宽，不随滚动收成胶囊。
         胶囊样式仍保留在下方 CSS（.site-header.is-scrolled），想恢复收缩
         只需把 :class="{ 'is-scrolled': headerScrolled }" 绑定加回来。 -->
    <header class="site-header use-liquid">
      <div class="header-glass">
        <div class="header-inner">
          <!-- 左侧：汉堡菜单（仅移动端）；Logo 只保留侧边栏顶部那一个 -->
          <div class="flex items-center gap-3">
            <button @click="openDrawer" class="sm:hidden p-2 -ml-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-700/60 transition-colors">
              <svg class="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <!-- 中间：Logo（仅手机端显示，桌面端由侧边栏承担） -->
          <div class="header-center-logo">
            <div v-if="settings.logo" class="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
              <img :src="getImageUrl(settings.logo)" :alt="settings.siteName || 'Logo'" class="w-full h-full object-contain" />
            </div>
            <div v-else class="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <span class="text-white text-sm font-semibold">T</span>
            </div>
            <span class="font-semibold text-slate-800 dark:text-slate-100 text-sm tracking-tight">{{ settings.siteName || 'TabHub' }}</span>
          </div>

          <!-- 右侧：相册 + 主题切换 + 登录 -->
          <div class="flex items-center gap-2">
            <router-link to="/albums" class="albums-nav-btn" title="相册">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h3l2-2h6l2 2h3a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2zm8 12a5 5 0 100-10 5 5 0 000 10zm0-2.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
              </svg>
              <span>相册</span>
            </router-link>
            <button
              @click="toggleTheme"
              class="theme-btn"
              :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
            >
              <svg v-if="isDark" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3a1 1 0 011 1v1a1 1 0 11-2 0V4a1 1 0 011-1zM12 19a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM21 12a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5 12a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM18.36 5.64a1 1 0 010 1.41l-.7.7a1 1 0 11-1.42-1.42l.7-.7a1 1 0 011.42 0zM7.76 16.24a1 1 0 010 1.42l-.7.7a1 1 0 01-1.42-1.42l.7-.7a1 1 0 011.42 0z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            </button>
            <button
              @click="onLoginClick"
              class="theme-btn"
              :class="{ 'is-auth': authStore.isAuthenticated }"
              :title="authStore.isAuthenticated ? '进入管理后台' : '登录'"
            >
              <svg v-if="authStore.isAuthenticated" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.69-8 6v1h16v-1c0-3.31-3.58-6-8-6z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-4.42 0-8 2.69-8 6h16c0-3.31-3.58-6-8-6z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>

    <aside
      class="site-sidebar"
      :class="[
        drawerOpen ? 'translate-x-0 is-open' : '-translate-x-full',
        'sm:translate-x-0',
      ]"
    >
      <div class="sidebar-header">
        <div class="flex items-center gap-2.5">
          <div v-if="settings.logo" class="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
            <img :src="getImageUrl(settings.logo)" :alt="settings.siteName || 'Logo'" class="w-full h-full object-contain" />
          </div>
          <div v-else class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <span class="text-white text-sm font-semibold">T</span>
          </div>
          <span class="font-semibold text-slate-800 dark:text-slate-100 text-base tracking-tight">{{ settings.siteName || 'TabHub' }}</span>
        </div>
        <button @click="closeDrawer" class="sm:hidden p-2 -mr-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-700/60 transition-colors">
          <svg class="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav class="sidebar-nav p-3 space-y-1">
        <!-- 点分类跳转后同时收起抽屉：手机上点完直接看到对应分类，无需再手动关 -->
        <button
          @click="scrollToCategory(null); closeDrawer()"
          :class="['category-nav-btn', { active: !activeTab && !activeCategoryId }]"
        >
          全部网站
          <span class="nav-count">{{ sites.length }}</span>
        </button>
        <button
          v-for="category in topCategories"
          :key="category.id"
          @click="scrollToCategory(category); closeDrawer()"
          :class="['category-nav-btn', { active: activeCategoryId === category.id }]"
        >
          {{ category.name }}
          <span class="nav-count">{{ getCategorySiteCount(category) }}</span>
        </button>
      </nav>

      <!-- 手机端相册入口：放在侧边栏最底部（桌面端用页眉上的胶囊按钮） -->
      <div class="sidebar-albums sm:hidden">
        <router-link to="/albums" class="sidebar-albums-btn" @click="closeDrawer">
          <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h3l2-2h6l2 2h3a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2zm8 12a5 5 0 100-10 5 5 0 000 10zm0-2.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
          </svg>
          <span>相册</span>
          <svg class="w-4 h-4 ml-auto opacity-45" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </router-link>
      </div>
    </aside>

    <main class="w-full px-4 sm:px-6 py-6 sm:pl-[304px]">
      <div class="w-full sm:w-[90%] sm:mx-auto">
        <div v-if="loading" class="space-y-6">
          <div class="skeleton-banner">
            <div class="skeleton-banner-image"></div>
            <div class="skeleton-search-wrapper">
              <div class="skeleton-search-box"></div>
            </div>
          </div>
          
          <div v-for="i in 3" :key="i" class="skeleton-section">
            <div class="skeleton-title"></div>
            <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              <div v-for="j in 6" :key="j" class="skeleton-card">
                <div class="skeleton-icon"></div>
                <div class="skeleton-text skeleton-text-sm"></div>
                <div class="skeleton-text skeleton-text-xs"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-else>
        <div class="relative mb-6">
          <img 
            v-if="settings.bannerImage"
            :src="getImageUrl(settings.bannerImage)" 
            alt="banner"
            class="w-full h-[200px] sm:h-[300px] md:h-[400px] lg:h-[500px] object-cover rounded-xl"
          />
          <!-- 没配封面图时用渐变色兜底，避免出现空白占位 -->
          <div v-else class="w-full h-[200px] sm:h-[300px] md:h-[400px] lg:h-[500px] bg-gradient-to-br from-indigo-500 via-violet-500 to-rose-400 rounded-xl"></div>
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/40 via-black/20 to-transparent rounded-xl">
            <div class="flex flex-col items-center gap-1 sm:gap-1.5 mb-4 sm:mb-6 px-4">
              <!-- Banner 标题优先用后台配置的 bannerTitle，没配就退回站点名 -->
              <div
                v-if="settings.bannerTitle || settings.siteName"
                class="text-white text-lg sm:text-xl md:text-2xl font-semibold drop-shadow-lg text-center leading-tight"
              >{{ settings.bannerTitle || settings.siteName }}</div>
              <div
                v-if="settings.siteSubtitle"
                class="text-white/85 text-[11px] sm:text-sm drop-shadow text-center"
              >{{ settings.siteSubtitle }}</div>
            </div>
            <div class="w-full px-4 sm:px-0 relative" ref="searchContainer">
              <div class="relative w-full sm:w-[95%] max-w-2xl mx-auto">
                <div class="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                  <button
                    @click.stop="showEngineMenu = !showEngineMenu"
                    class="flex items-center gap-1 sm:gap-1.5 pl-1.5 sm:pl-2 pr-1.5 sm:pr-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 text-white/80 hover:text-white border border-white/10 hover:border-white/20"
                    title="切换搜索引擎"
                  >
                    <img v-if="currentEngine.icon" :src="currentEngine.icon" class="w-4 h-4 flex-shrink-0" />
                    <span class="text-xs font-medium hidden sm:inline">{{ currentEngine.name }}</span>
                    <svg class="w-3 h-3 transition-transform duration-200 hidden sm:inline-block" :class="{ 'rotate-180': showEngineMenu }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <transition name="dropdown">
                    <div v-if="showEngineMenu" class="engine-pop absolute top-full left-0 sm:left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden py-1 sm:min-w-[180px] min-w-[160px]" @click.stop>
                      <div class="px-3 py-1.5 text-xs font-medium text-slate-400 border-b border-slate-50 hidden sm:block">选择搜索引擎</div>
                      <div
                        v-for="engine in searchEngines"
                        :key="engine.key"
                        @click="selectEngine(engine)"
                        class="pop-row flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-all duration-150"
                        :class="{ 'bg-blue-50 dark:bg-blue-900/20': currentEngine.key === engine.key }"
                      >
                        <img v-if="engine.icon" :src="engine.icon" class="w-5 h-5 flex-shrink-0" />
                        <span class="text-sm text-slate-700 whitespace-nowrap font-medium">{{ engine.name }}</span>
                        <span class="text-xs text-slate-400 ml-1 hidden sm:inline">{{ { baidu: '百度搜索', google: 'Google 搜索', bing: '必应搜索' }[engine.key] }}</span>
                        <svg v-if="currentEngine.key === engine.key" class="w-4 h-4 text-primary ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </transition>
                </div>
                <input
                  ref="searchInput"
                  v-model="searchQuery"
                  type="text"
                  :placeholder="isMobile ? currentEngine.name + ' 搜索' : '在 ' + currentEngine.name + ' 中搜索'"
                  class="search-input-overlay"
                  @focus="showSearchDropdown = true"
                  @keydown.enter="handleSearch"
                />
                <button
                  v-if="searchQuery"
                  @click="searchQuery = ''"
                  class="absolute right-12 sm:right-14 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                >
                  <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  @click="handleSearch"
                  class="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
              
              <transition name="dropdown">
                <div v-if="showSearchDropdown && (!searchQuery || searchHistory.length > 0 || hotSearches.length > 0)" 
                     class="search-pop absolute top-full left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto mt-2 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-white/20 z-50 overflow-hidden sm:w-[550px] max-w-[95vw]">
                  <div v-if="searchHistory.length > 0" class="p-3">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs font-medium text-slate-500 flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        搜索历史
                      </span>
                      <button @click="clearSearchHistory" class="text-xs text-slate-400 hover:text-slate-600">清空</button>
                    </div>
                    <div class="space-y-1">
                      <div
                        v-for="(item, index) in searchHistory"
                        :key="index"
                        class="pop-row flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors"
                      >
                        <button
                          @click="searchQuery = item"
                          class="flex-1 flex items-center gap-2 text-left"
                        >
                          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          {{ item }}
                        </button>
                        <button
                          @click="removeSearchHistory(index)"
                          class="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div v-if="hotSearches.length > 0" class="p-3 border-t border-slate-100 pop-divider">
                    <span class="text-xs font-medium text-slate-500 flex items-center gap-1 mb-2">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      热门搜索
                    </span>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="(item, index) in hotSearches"
                        :key="index"
                        @click="searchQuery = item"
                        class="pop-chip px-3 py-1.5 bg-blue-50 text-blue-600 text-sm rounded-full hover:bg-blue-100 transition-colors dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                      >
                        {{ item }}
                      </button>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>
        <div v-if="announcements.length > 0" class="relative overflow-hidden bg-gradient-to-r from-blue-50/80 via-sky-50/60 to-blue-50/80 dark:from-slate-800/90 dark:via-slate-800/80 dark:to-slate-800/90 rounded-lg mb-4 border border-primary-100/50 dark:border-slate-600/50">
           <div class="flex items-center gap-2 px-4 py-2.5">
             <span class="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <span class="hidden sm:inline">公告</span>
            </span>
            <div class="flex-1 overflow-hidden">
              <div
                class="flex transition-transform duration-500 ease-in-out"
                :style="{ transform: `translateX(-${currentAnnouncement * 100}%)` }"
              >
                <div
                  v-for="(item, index) in announcements"
                  :key="index"
                  class="w-full flex-shrink-0 flex items-center gap-2"
                >
                  <span class="text-sm text-slate-600 dark:text-slate-300 truncate">{{ item.text }}</span>
                </div>
              </div>
            </div>
            <!-- 手机端隐藏箭头/圆点，整行留给文字（自动轮播仍在走）；桌面端保留手动切换 -->
            <div v-if="announcements.length > 1" class="hidden sm:flex items-center gap-1.5 flex-shrink-0">
              <button
                @click="prevAnnouncement"
                class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/50 dark:hover:bg-slate-700/60 transition-colors text-slate-400 hover:text-primary dark:text-slate-500 dark:hover:text-primary-300"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div class="flex gap-1">
                <span
                  v-for="(_, index) in announcements"
                  :key="index"
                  class="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  :class="index === currentAnnouncement ? 'bg-primary w-3 dark:bg-primary-300' : 'bg-slate-300 dark:bg-slate-600'"
                ></span>
              </div>
              <button
                @click="nextAnnouncement"
                class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/50 dark:hover:bg-slate-700/60 transition-colors text-slate-400 hover:text-primary dark:text-slate-500 dark:hover:text-primary-300"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="tab-content">
          <div v-if="searchQuery">
            <div class="flex items-center justify-between gap-3 mb-5">
              <p class="text-sm text-slate-500 dark:text-slate-400 min-w-0 truncate">
                “<span class="font-medium text-slate-700 dark:text-slate-200">{{ searchQuery }}</span>”
                的搜索结果 · 共 {{ searchResults.length }} 个
              </p>
              <!-- 清除后回到"全部网站"视图并置顶 -->
              <button
                @click="scrollToCategory(null)"
                class="flex-none text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                清除搜索
              </button>
            </div>
            <div v-if="isSearchPending" class="text-center py-20">
              <p class="text-slate-400 text-lg">搜索中…</p>
            </div>
            <div v-else-if="searchResults.length === 0" class="text-center py-20">
              <p class="text-slate-400 text-lg">没有找到相关网站</p>
              <p class="text-slate-400 text-sm mt-1">换个关键词试试吧</p>
            </div>
            <div v-else class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              <div
                v-for="site in searchResults"
                :key="site.id"
                @click="openSite(site)"
                class="site-card cursor-pointer group"
              >
                <div class="flex items-center gap-2">
                  <div class="w-10 h-10 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                    <img 
                      v-if="site.icon && !failedIcons.has(site.id)" 
                      :src="getIconUrl(site.icon)" 
                      :alt="site.title"
                      loading="lazy"
                      class="w-6 h-6 object-contain card-icon"
                      @error="handleImageError(site.id)"
                    />
                    <span
                      v-else
                      class="w-full h-full flex items-center justify-center text-sm font-semibold text-white select-none"
                      :style="{ backgroundColor: siteAvatarColor(site) }"
                    >{{ siteInitial(site) }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="text-[13px] font-semibold text-slate-800 leading-tight group-hover:text-primary transition-colors card-title whitespace-normal line-clamp-2" v-html="highlightMatch(site.title, searchQuery)"></h3>
                    <p v-if="site.description" class="text-xs text-slate-500 truncate mt-0.5 card-desc" v-html="highlightMatch(site.description, searchQuery)"></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="!activeTab">
            <!-- 手机端：直接显示全站点击前 10，简洁两列 -->
            <div v-if="popularSites.length > 0" class="mb-8 sm:hidden">
              <div class="flex items-center gap-2 mb-3">
                <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2c.5 3 2.5 4.5 4 6.5 1.5 2 2 4 2 6a8 8 0 11-16 0c0-2.5 1-4.5 2.5-6C6 8.5 7.5 7.5 8 5c1 1.5 1.5 3 4 3 1 0 1.5-2 0-6z" />
                  </svg>
                  热门推荐
                </h2>
                <span class="text-xs text-slate-400 dark:text-slate-500">点击量前 10</span>
              </div>
              <div class="grid grid-cols-2 gap-2.5">
                <div
                  v-for="(site, index) in popularSites.slice(0, 10)"
                  :key="site.id"
                  @click="openSite(site)"
                  class="hot-mobile-item"
                  :title="site.title"
                >
                  <span :class="['hot-mobile-rank', index < 3 ? 'hot-mobile-rank-' + (index + 1) : '']">{{ index + 1 }}</span>
                  <div class="w-8 h-8 flex-shrink-0 rounded-lg hot-card-icon flex items-center justify-center overflow-hidden">
                    <img
                      v-if="site.icon && !failedIcons.has(site.id)"
                      :src="getIconUrl(site.icon)"
                      :alt="site.title"
                      loading="lazy"
                      class="w-5 h-5 object-contain"
                      @error="handleImageError(site.id)"
                    />
                    <span
                      v-else
                      class="w-full h-full flex items-center justify-center text-xs font-semibold text-white select-none"
                      :style="{ backgroundColor: siteAvatarColor(site) }"
                    >{{ siteInitial(site) }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="hot-mobile-name">{{ site.title }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 热门推荐（桌面端）：五列分类排行，只在"全部网站"视图出现 -->
            <div v-if="hotCategories.length >= POPULAR_MIN_SHOWN" class="mb-8 hidden sm:block">
              <div class="flex items-baseline gap-2 mb-4">
                <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2c.5 3 2.5 4.5 4 6.5 1.5 2 2 4 2 6a8 8 0 11-16 0c0-2.5 1-4.5 2.5-6C6 8.5 7.5 7.5 8 5c1 1.5 1.5 3 4 3 1 0 1.5-2 0-6z" />
                  </svg>
                  热门推荐
                </h2>
                <span class="text-sm text-slate-400 dark:text-slate-500">按分类总点击量排名 · 每列展示该分类前五</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div
                  v-for="(col, ci) in hotCategories"
                  :key="col.category.id"
                  class="hot-col"
                >
                  <!-- 列头：分类名次 + 名称 + 该分类总点击 -->
                  <div class="hot-col-head">
                    <span :class="['hot-col-rank', ci < 3 ? 'hot-rank-' + (ci + 1) : 'hot-col-rank-plain']">{{ ci + 1 }}</span>
                    <span class="hot-col-name">{{ col.category.name }}</span>
                    <span class="hot-clicks">
                      <svg class="w-3 h-3 flex-none" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2c.5 3 2.5 4.5 4 6.5 1.5 2 2 4 2 6a8 8 0 11-16 0c0-2.5 1-4.5 2.5-6C6 8.5 7.5 7.5 8 5c1 1.5 1.5 3 4 3 1 0 1.5-2 0-6z" />
                      </svg>
                      <span class="tabular-nums font-semibold">{{ col.total }}</span>
                    </span>
                  </div>
                  <!-- 该分类内点击量前 5 的网站 -->
                  <div
                    v-for="site in col.sites"
                    :key="site.id"
                    @click="openSite(site)"
                    class="hot-col-site"
                    :title="`${site.title} · ${site.clickCount} 次点击`"
                  >
                    <div class="w-7 h-7 flex-shrink-0 rounded-lg hot-card-icon flex items-center justify-center overflow-hidden">
                      <img
                        v-if="site.icon && !failedIcons.has(site.id)"
                        :src="getIconUrl(site.icon)"
                        :alt="site.title"
                        loading="lazy"
                        class="w-5 h-5 object-contain card-icon"
                        @error="handleImageError(site.id)"
                      />
                      <span
                        v-else
                        class="w-full h-full flex items-center justify-center text-[11px] font-semibold text-white select-none"
                        :style="{ backgroundColor: siteAvatarColor(site) }"
                      >{{ siteInitial(site) }}</span>
                    </div>
                    <span class="hot-col-site-name">{{ site.title }}</span>
                    <span class="hot-clicks hot-col-site-clicks">
                      <svg class="w-3 h-3 flex-none" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2c.5 3 2.5 4.5 4 6.5 1.5 2 2 4 2 6a8 8 0 11-16 0c0-2.5 1-4.5 2.5-6C6 8.5 7.5 7.5 8 5c1 1.5 1.5 3 4 3 1 0 1.5-2 0-6z" />
                      </svg>
                      <span class="tabular-nums">{{ site.clickCount }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-8">
              <div
                v-for="category in topCategories"
                :key="category.id"
                :id="'category-' + category.id"
                class="category-section"
              >
                <div class="flex flex-wrap items-center gap-4 mb-4">
                  <h2 class="text-lg font-semibold text-slate-800">
                    {{ category.name }}
                    <span class="text-sm font-normal text-slate-400">({{ getCategorySiteCount(category) }})</span>
                  </h2>
                  
                  <div v-if="category.children?.length > 0" class="flex flex-wrap gap-2">
                    <button
                      @click="toggleSubCategory(category.id, null)"
                      :class="['subcategory-tag', { active: !activeSubCategory || activeSubCategoryParent !== category.id }]"
                    >
                      全部
                    </button>
                    <button
                      v-for="child in category.children"
                      :key="child.id"
                      @click="toggleSubCategory(category.id, child)"
                      :class="['subcategory-tag', { active: activeSubCategory?.id === child.id && activeSubCategoryParent === category.id }]"
                    >
                      {{ child.name }}
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  <div
                    v-for="site in getSitesForCategoryAll(category)"
                    :key="site.id"
                    @click="openSite(site)"
                    class="site-card cursor-pointer group"
                  >
                    <div class="flex items-center gap-2">
                      <div class="w-10 h-10 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                        <img
                          v-if="site.icon && !failedIcons.has(site.id)"
                          :src="getIconUrl(site.icon)"
                          :alt="site.title"
                          loading="lazy"
                          class="w-6 h-6 object-contain"
                          @error="handleImageError(site.id)"
                        />
                        <span
                          v-else
                          class="w-full h-full flex items-center justify-center text-sm font-semibold text-white select-none"
                          :style="{ backgroundColor: siteAvatarColor(site) }"
                        >{{ siteInitial(site) }}</span>
                      </div>

                      <div class="flex-1 min-w-0">
                        <h3 class="text-[13px] font-semibold text-slate-800 leading-tight group-hover:text-primary transition-colors whitespace-normal line-clamp-2">
                          {{ site.title }}
                        </h3>
                        <p v-if="site.description" class="text-xs text-slate-500 truncate mt-0.5">
                          {{ site.description }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else>
            <div v-if="currentTabSites.length === 0" class="text-center py-20">
              <p class="text-slate-400 text-lg">这个分类还没有网站呢</p>
            </div>

            <div v-else>
              <div class="flex flex-wrap items-center gap-4 mb-4">
                <h2 class="text-lg font-semibold text-slate-800">
                  {{ activeTab?.name || '全部网站' }}
                  <span class="text-sm font-normal text-slate-400">({{ currentTabSites.length }})</span>
                </h2>
                
                <div v-if="activeTab?.children?.length > 0" class="flex flex-wrap gap-2">
                  <button
                    @click="selectSubCategory(null)"
                    :class="['subcategory-tag', { active: !activeSubCategory }]"
                  >
                    全部
                  </button>
                  <button
                    v-for="child in activeTab.children"
                    :key="child.id"
                    @click="selectSubCategory(child)"
                    :class="['subcategory-tag', { active: activeSubCategory?.id === child.id }]"
                  >
                    {{ child.name }}
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                <div
                  v-for="site in currentTabSites"
                  :key="site.id"
                  @click="openSite(site)"
                  class="site-card cursor-pointer group"
                >
                  <div class="flex items-start gap-3">
                    <div class="w-12 h-12 flex-shrink-0 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
                      <img
                        v-if="site.icon && !failedIcons.has(site.id)"
                        :src="getIconUrl(site.icon)"
                        :alt="site.title"
                        loading="lazy"
                        class="w-8 h-8 object-contain"
                        @error="handleImageError(site.id)"
                      />
                      <span
                        v-else
                        class="w-full h-full flex items-center justify-center text-base font-semibold text-white select-none"
                        :style="{ backgroundColor: siteAvatarColor(site) }"
                      >{{ siteInitial(site) }}</span>
                    </div>

                    <div class="flex-1 min-w-0">
                      <h3 class="font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">
                        {{ site.title }}
                      </h3>
                      <p v-if="site.description" class="text-sm text-slate-500 truncate mt-0.5">
                        {{ site.description }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer class="mt-10 pt-5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-400 dark:text-slate-600">
        <span>{{ settings.siteName || 'TabHub' }}</span>
        <router-link
          to="/admin"
          class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >管理后台</router-link>
      </footer>
      </div>
    </main>

    <button
      v-if="showBackToTop"
      @click="scrollToTop"
      class="fixed bottom-6 right-6 z-50 w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-xl shadow-md border border-slate-100 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all duration-300"
      title="回到顶部"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { categoryApi } from '../api/categories'
import { siteApi } from '../api/sites'
import { useSettings, refreshSettings, getImageUrl } from '../composables/useSettings'
import { useHeaderScroll } from '../composables/useHeaderScroll'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const { settings } = useSettings()
const router = useRouter()
const authStore = useAuthStore()

// 顶栏登录入口：已登录进后台，未登录去登录页（自己登录不用记 /admin 路径）
function onLoginClick() {
  router.push(authStore.isAuthenticated ? '/admin' : '/login')
}
// 页眉已改为固定全宽，不再使用滚动收缩（useHeaderScroll 暂时下岗，
// composable 文件保留，需要恢复胶囊形态时再接回来）
// const { scrolled: headerScrolled } = useHeaderScroll()
const categories = ref([])
const sites = ref([])
const loading = ref(true)
const searchQuery = ref('')
const activeTab = ref(null)
const activeSubCategory = ref(null)
const activeSubCategoryParent = ref(null)
const drawerOpen = ref(false)
const failedIcons = ref(new Set())
const particleCanvas = ref(null)
const isDark = ref(false)
let animationId = null
let particles = []
const activeCategoryId = ref(null)
const showSearchDropdown = ref(false)
const searchHistory = ref([])
// 后台没配置热门搜索时的兜底词，配置过就以后台为准
const DEFAULT_HOT_SEARCHES = ['Google', 'GitHub', 'YouTube', 'Vue', 'React', 'Node.js', 'TypeScript', 'Docker']
const hotSearches = ref([...DEFAULT_HOT_SEARCHES])

// 热门推荐板块：少于这个数量就不显示，避免只有一两张卡片时显得空荡
const POPULAR_MIN_SHOWN = 3
const popularSites = ref([])
const showBackToTop = ref(false)
const announcements = ref([])
const currentAnnouncement = ref(0)
let announcementTimer = null
const searchContainer = ref(null)
const searchInput = ref(null)
let searchDebounceTimer = null
const debouncedSearchQuery = ref('')
const showEngineMenu = ref(false)
const isMobile = ref(window.innerWidth < 640)

watch(() => settings.announcements, () => {
  currentAnnouncement.value = 0
  parseAnnouncements()
})

watch(() => settings.hotSearches, () => {
  parseHotSearches()
})

function updateIsMobile() {
  isMobile.value = window.innerWidth < 640
}

const searchEngines = [
  {
    key: 'baidu',
    name: '百度',
    url: 'https://www.baidu.com/s?wd=',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%232563eb" d="M4.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm7.5 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm7.5 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 14c-1.5 0-3-.5-4.5-1.5S5 10 5 8.5c0-1 .5-2 1.5-2.5C8 5.5 9.5 6 10.5 7c1 1 1.5 2 1.5 3s.5 2 1.5 3c1 1 2.5 1.5 4 1.5s3-.5 4-1.5c1-1 1.5-2 1.5-3s.5-2 1.5-3c1-1 2.5-1.5 4-1 .5.5 1 1.5 1 2.5 0 1.5-1 3-2.5 4S13.5 14 12 14z"/%3E%3C/svg%3E'
  },
  {
    key: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?q=',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%234285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/%3E%3Cpath fill="%2334A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/%3E%3Cpath fill="%23FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/%3E%3Cpath fill="%23EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/%3E%3C/svg%3E'
  },
  {
    key: 'bing',
    name: 'Bing',
    url: 'https://www.bing.com/search?q=',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="%2300A4EF" d="M3.5 2.5v17.5l6 3 11-5.5v-5.5l-5.5 2.5v-5.5L9.5 1 3.5 2.5z"/%3E%3C/svg%3E'
  }
]

const currentEngine = ref(searchEngines[0])

function selectEngine(engine) {
  currentEngine.value = engine
  showEngineMenu.value = false
  localStorage.setItem('searchEngine', engine.key)
  searchInput.value?.focus()
}

function loadSavedEngine() {
  const saved = localStorage.getItem('searchEngine')
  if (saved) {
    const engine = searchEngines.find(e => e.key === saved)
    if (engine) {
      currentEngine.value = engine
    }
  }
}

function parseAnnouncements() {
  if (settings.announcements) {
    try {
      const parsed = JSON.parse(settings.announcements)
      announcements.value = Array.isArray(parsed) ? parsed : []
    } catch {
      announcements.value = []
    }
  } else {
    announcements.value = []
  }
  startAnnouncementTimer()
}

/** 热门搜索支持后台配置，逗号或换行分隔；没配置就用默认词 */
function parseHotSearches() {
  const raw = settings.hotSearches
  if (!raw) {
    hotSearches.value = [...DEFAULT_HOT_SEARCHES]
    return
  }
  const list = String(raw)
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean)
  hotSearches.value = list.length ? list : [...DEFAULT_HOT_SEARCHES]
}

function startAnnouncementTimer() {
  stopAnnouncementTimer()
  if (announcements.value.length > 1) {
    announcementTimer = setInterval(() => {
      nextAnnouncement()
    }, 4000)
  }
}

function stopAnnouncementTimer() {
  if (announcementTimer) {
    clearInterval(announcementTimer)
    announcementTimer = null
  }
}

function prevAnnouncement() {
  currentAnnouncement.value = currentAnnouncement.value === 0
    ? announcements.value.length - 1
    : currentAnnouncement.value - 1
  startAnnouncementTimer()
}

function nextAnnouncement() {
  currentAnnouncement.value = currentAnnouncement.value === announcements.value.length - 1
    ? 0
    : currentAnnouncement.value + 1
  startAnnouncementTimer()
}

function handleClickOutside(event) {
  if (searchContainer.value && !searchContainer.value.contains(event.target)) {
    showSearchDropdown.value = false
    showEngineMenu.value = false
  }
}

function loadSearchHistory() {
  const history = localStorage.getItem('searchHistory')
  if (history) {
    searchHistory.value = JSON.parse(history)
  }
}

function saveSearchHistory(query) {
  if (!query.trim()) return
  const index = searchHistory.value.indexOf(query)
  if (index > -1) {
    searchHistory.value.splice(index, 1)
  }
  searchHistory.value.unshift(query)
  if (searchHistory.value.length > 10) {
    searchHistory.value = searchHistory.value.slice(0, 10)
  }
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
}

function removeSearchHistory(index) {
  searchHistory.value.splice(index, 1)
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
}

function clearSearchHistory() {
  searchHistory.value = []
  localStorage.removeItem('searchHistory')
}

// 结果要塞进 v-html，原始文本必须先转义，否则站点标题/描述里的 HTML 会被执行
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch])
}

function highlightMatch(text, query) {
  if (!text) return ''
  const escaped = escapeHtml(text)
  if (!query.trim()) return escaped

  // 关键词同样要转义后再匹配，才能和转义后的文本对得上
  const escapedQuery = escapeHtml(query)
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return escaped.replace(regex, '<mark class="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 px-0.5 rounded">$1</mark>')
}

// 搜索防抖
let debounceTimer = null
watch(searchQuery, (newVal) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = newVal
  }, 300)
})

// 键盘快捷键 Ctrl+K 聚焦搜索框
function handleKeyboardShortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault()
    searchInput.value?.focus()
  }
  if (event.key === 'Escape') {
    showSearchDropdown.value = false
    searchInput.value?.blur()
  }
}

const topCategories = computed(() => {
  return categories.value
})

/** 热门推荐（分类版）：
 *  一级分类按「分类树下所有网站点击量总和」排名取前 5，
 *  每列再展示该分类内点击量前 5 的网站。 */
const hotCategories = computed(() => {
  return topCategories.value
    .map(category => {
      // 收集该一级分类树下全部 id（含二、三级），站点归属判定与 getCategorySiteCount 保持一致
      const ids = [category.id]
      if (category.children) {
        category.children.forEach(child => {
          ids.push(child.id)
          if (child.children) child.children.forEach(g => ids.push(g.id))
        })
      }
      const catSites = sites.value.filter(site => ids.some(id => siteBelongsToCategory(site, id)))
      const total = catSites.reduce((sum, s) => sum + (s.clickCount || 0), 0)
      const top5 = [...catSites].sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0)).slice(0, 5)
      return { category, total, sites: top5 }
    })
    .filter(col => col.sites.length > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
})

/** 防抖窗口内：输入框已经有词、但结果还没算出来，此时别急着显示"没有找到" */
const isSearchPending = computed(() =>
  searchQuery.value.trim() !== debouncedSearchQuery.value.trim()
)

const searchResults = computed(() => {
  if (!debouncedSearchQuery.value.trim()) return []
  const query = debouncedSearchQuery.value.toLowerCase()
  return sites.value.filter(site => 
    site.title.toLowerCase().includes(query) ||
    site.description?.toLowerCase().includes(query)
  )
})

const currentTabSites = computed(() => {
  let filtered = sites.value

  if (activeTab.value) {
    const categoryIds = [activeTab.value.id]
    if (activeTab.value.children) {
      activeTab.value.children.forEach(child => {
        categoryIds.push(child.id)
        if (child.children) {
          child.children.forEach(grandchild => {
            categoryIds.push(grandchild.id)
          })
        }
      })
    }

    if (activeSubCategory.value) {
      const subIds = [activeSubCategory.value.id]
      if (activeSubCategory.value.children) {
        activeSubCategory.value.children.forEach(child => {
          subIds.push(child.id)
        })
      }
      // 与 getCategorySiteCount 保持同一套判定：既认主分类，也认 categoryIds 里的附加分类
      filtered = filtered.filter(site => subIds.some(id => siteBelongsToCategory(site, id)))
    } else {
      filtered = filtered.filter(site => categoryIds.some(id => siteBelongsToCategory(site, id)))
    }
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(site =>
      site.title.toLowerCase().includes(query) ||
      site.description?.toLowerCase().includes(query) ||
      site.url.toLowerCase().includes(query)
    )
  }

  return filtered.sort((a, b) => a.sortOrder - b.sortOrder)
})

function getCategorySiteCount(category) {
  const categoryIds = [category.id]
  if (category.children) {
    category.children.forEach(child => {
      categoryIds.push(child.id)
      if (child.children) {
        child.children.forEach(grandchild => {
          categoryIds.push(grandchild.id)
        })
      }
    })
  }
  
  return sites.value.filter(site => categoryIds.some(id => siteBelongsToCategory(site, id))).length
}

function siteBelongsToCategory(site, categoryId) {
  if (site.categoryId === categoryId) return true
  if (site.categoryIds) {
    try {
      const ids = JSON.parse(site.categoryIds)
      return ids.includes(categoryId)
    } catch {
      return false
    }
  }
  return false
}

function getSitesForCategoryAll(category) {
  let filtered = sites.value

  const categoryIds = [category.id]
  if (category.children) {
    category.children.forEach(child => {
      categoryIds.push(child.id)
      if (child.children) {
        child.children.forEach(grandchild => {
          categoryIds.push(grandchild.id)
        })
      }
    })
  }

  if (activeSubCategory.value && activeSubCategoryParent.value === category.id) {
    const subIds = [activeSubCategory.value.id]
    if (activeSubCategory.value.children) {
      activeSubCategory.value.children.forEach(child => {
        subIds.push(child.id)
      })
    }
    filtered = filtered.filter(site => subIds.some(id => siteBelongsToCategory(site, id)))
  } else {
    filtered = filtered.filter(site => categoryIds.some(id => siteBelongsToCategory(site, id)))
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(site =>
      site.title.toLowerCase().includes(query) ||
      site.description?.toLowerCase().includes(query) ||
      site.url.toLowerCase().includes(query)
    )
  }

  return filtered.sort((a, b) => a.sortOrder - b.sortOrder)
}

function getIconUrl(icon) {
  if (!icon) return ''
  if (icon.startsWith('http')) return icon
  return getImageUrl(icon)
}

const AVATAR_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#EF4444',
  '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9'
]

// 没有图标时用站名首字做头像
function siteInitial(site) {
  const t = (site.title || '').trim()
  return t ? Array.from(t)[0].toUpperCase() : '?'
}

// 同一个站名永远得到同一个颜色
function siteAvatarColor(site) {
  const t = site.title || ''
  let h = 0
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function handleImageError(siteId) {
  failedIcons.value.add(siteId)
}

/** 只放行 http/https，挡掉 javascript:、data: 等伪协议被 window.open 执行 */
function isSafeHttpUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function openSite(site) {
  if (!isSafeHttpUrl(site.url)) {
    ElMessage.warning(`"${site.title}" 的链接不是有效的 http(s) 地址，已阻止打开`)
    return
  }

  siteApi.click(site.id).catch(err => console.error('Click tracking failed:', err))

  // 乐观更新：本地先 +1，热度立刻反映到卡片和热门榜，不用等下次刷新
  bumpClickCount(site.id)

  window.open(site.url, '_blank', 'noopener,noreferrer')
}

/** 同一个站点可能同时存在于 sites 和 popularSites 两个数组里，按 id 都加一遍 */
function bumpClickCount(siteId) {
  for (const site of sites.value) {
    if (site.id === siteId) site.clickCount = (site.clickCount || 0) + 1
  }
  for (const site of popularSites.value) {
    if (site.id === siteId) site.clickCount = (site.clickCount || 0) + 1
  }
}

/**
 * 退出站内搜索模式。
 * 页面最外层是 v-if="searchQuery"，只要关键词还在，点侧边栏分类也只会停在搜索结果页，
 * 所以任何"切换到浏览某个分类"的操作都必须先清空关键词。
 */
function exitSearchMode() {
  searchQuery.value = ''
  showSearchDropdown.value = false
}

function selectTab(category) {
  exitSearchMode()
  activeTab.value = category
  activeSubCategory.value = null
  activeSubCategoryParent.value = null
}

function selectSubCategory(subcategory) {
  activeSubCategory.value = subcategory
}

function toggleSubCategory(parentId, subcategory) {
  if (activeSubCategory?.id === subcategory?.id && activeSubCategoryParent.value === parentId) {
    activeSubCategory.value = null
    activeSubCategoryParent.value = null
  } else {
    activeSubCategory.value = subcategory
    activeSubCategoryParent.value = parentId
  }
}

function scrollToCategory(category) {
  exitSearchMode()
  activeTab.value = null
  activeSubCategory.value = null
  activeSubCategoryParent.value = null

  if (category) {
    activeCategoryId.value = category.id
    // 要等视图从搜索结果切回分类列表、DOM 更新完，锚点才存在
    nextTick(() => {
      const element = document.getElementById('category-' + category.id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  } else {
    activeCategoryId.value = null
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function openDrawer() {
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}

function toggleTheme() {
  isDark.value = !isDark.value
  // 挂在 <html> 上：Tailwind 的 dark: 变体、Element Plus 弹层（teleport 到 body 外）都能命中
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function initParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  
  const particleCount = Math.floor((canvas.width * canvas.height) / 15000)
  
  particles = []
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 3 + 1,
      speedX: (Math.random() - 0.5) * 0.5,
      speedY: (Math.random() - 0.5) * 0.5,
      opacity: Math.random() * 0.5 + 0.2,
      hue: 210 + Math.random() * 30
    })
  }
  
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    particles.forEach(particle => {
      particle.x += particle.speedX
      particle.y += particle.speedY
      
      if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1
      if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1
      
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${particle.hue}, 70%, 70%, ${particle.opacity})`
      ctx.fill()
      
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${particle.hue}, 60%, 75%, ${particle.opacity * 0.3})`
      ctx.fill()
    })
    
    particles.forEach((p1, i) => {
      particles.slice(i + 1).forEach(p2 => {
        const dx = p1.x - p2.x
        const dy = p1.y - p2.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance < 120) {
          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.strokeStyle = `hsla(210, 60%, 70%, ${0.08 * (1 - distance / 120)})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      })
    })
    
    animationId = requestAnimationFrame(animate)
  }
  
  animate()
}

function handleResize() {
  updateIsMobile()
  const canvas = particleCanvas.value
  if (canvas) {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
}

function onScroll() {
  showBackToTop.value = window.scrollY > 400
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
  try {
    const [categoriesRes, sitesRes] = await Promise.all([
      categoryApi.getTree(),
      siteApi.getAll(),
      refreshSettings()
    ])
    categories.value = categoriesRes.data
    sites.value = sitesRes.data
    loading.value = false
  } catch (error) {
    console.error('Failed to load data:', error)
    loading.value = false
  }
  
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
  
  loadSavedEngine()
  loadSearchHistory()
  parseAnnouncements()
  parseHotSearches()
  fetchPopularSites()
  initParticles()
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeyboardShortcut)
})

async function fetchPopularSites() {
  try {
    const res = await siteApi.getPopular(10)
    popularSites.value = res.data || []
  } catch (err) {
    console.error('Failed to fetch popular sites:', err)
    popularSites.value = []
  }
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    saveSearchHistory(searchQuery.value.trim())
    showSearchDropdown.value = false
    // 使用当前搜索引擎打开搜索
    const searchUrl = currentEngine.value.url + encodeURIComponent(searchQuery.value.trim())
    window.open(searchUrl, '_blank', 'noopener,noreferrer')
  }
}

onUnmounted(() => {
  stopAnnouncementTimer()
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  clearTimeout(debounceTimer)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeyboardShortcut)
})
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: #334155;
  outline: none;
  transition: all 0.2s;
}

.search-input:focus {
  background: #fff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #94a3b8;
}

.search-input-dark {
  width: 100%;
  padding: 12px 16px 12px 44px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  font-size: 16px;
  color: #fff;
  outline: none;
  transition: all 0.2s;
}

.search-input-dark:focus {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.search-input-dark::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.search-input-overlay {
  width: 100%;
  padding: 14px 120px 14px 100px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  font-size: 15px;
  color: #fff;
  outline: none;
  transition: all 0.3s;
}

@media (max-width: 639px) {
  .search-input-overlay {
    padding: 12px 88px 12px 42px;
    font-size: 14px;
    border-radius: 20px;
  }
}

.search-input-overlay:focus {
  background: rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.search-input-overlay::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.search-engine-btn {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;
}

.search-engine-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.tab-content {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

/* =====================================================================
   页眉：液态玻璃 + 圆角胶囊导航
   ===================================================================== */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 64px;
  background: transparent;
  pointer-events: none;
}

/* 桌面端：顶栏从侧边栏右侧开始，避免两个 Logo 叠在一起互相糊 */
@media (min-width: 640px) {
  .site-header {
    padding-left: 280px;
  }
}

.header-glass {
  position: relative;
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  border-radius: 0;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  pointer-events: auto;
  transform: translateY(0);
  /* 独立合成层：尺寸过渡期间 backdrop-filter 每帧重算，独立层让合成更顺 */
  will-change: transform, width;
  /* 展开（胶囊 → 全宽）走慢曲线，像两滴水分开 */
  transition:
    width 1.4s cubic-bezier(0.65, 0, 0.35, 1),
    max-width 1.4s cubic-bezier(0.65, 0, 0.35, 1),
    transform 1.4s cubic-bezier(0.34, 1.25, 0.64, 1),
    height 1.4s cubic-bezier(0.65, 0, 0.35, 1),
    border-radius 1.2s cubic-bezier(0.34, 1.2, 0.64, 1),
    background 0.6s ease,
    border-color 0.6s ease,
    box-shadow 1s cubic-bezier(0.34, 1.2, 0.64, 1);
}

.dark .header-glass {
  background: rgba(15, 23, 42, 0.82);
  border-bottom-color: rgba(51, 65, 85, 0.6);
}

/* ---- 滚动后：收成圆角玻璃胶囊，悬浮在内容之上 ---- */
.site-header.is-scrolled .header-glass {
  width: calc(100% - 48px);
  max-width: calc(100% - 48px);
  height: 52px;
  /* 上下各留一点空隙，形成"悬浮"而不是贴顶 */
  transform: translateY(6px);
  padding: 0 20px;
  border-radius: 999px;
  border-bottom-color: transparent;
  background: rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(26px) saturate(200%);
  -webkit-backdrop-filter: blur(26px) saturate(200%);
  /* 边缘高光 + 主色/辅色的分层投影，把"一块玻璃"的厚度交代出来 */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 22px 48px rgba(31, 36, 48, 0.16),
    0 10px 24px rgba(79, 110, 247, 0.14),
    0 2px 6px rgba(139, 92, 246, 0.12);
  /* 收缩（全宽 → 胶囊）走快曲线：面积变小本身就顺，短时长即可。
     反向展开走基础规则里更慢的曲线。 */
  transition:
    width 0.52s cubic-bezier(0.34, 1.2, 0.64, 1),
    max-width 0.52s cubic-bezier(0.34, 1.2, 0.64, 1),
    transform 0.52s cubic-bezier(0.34, 1.25, 0.64, 1),
    height 0.52s cubic-bezier(0.65, 0, 0.35, 1),
    border-radius 0.52s cubic-bezier(0.34, 1.2, 0.64, 1),
    background 0.42s ease,
    border-color 0.4s ease,
    box-shadow 0.42s cubic-bezier(0.34, 1.2, 0.64, 1);
}

@media (max-width: 639px) {
  .site-header.is-scrolled .header-glass {
    width: calc(100% - 24px);
    max-width: calc(100% - 24px);
    padding: 0 14px;
  }
}

.dark .site-header.is-scrolled .header-glass {
  background: rgba(15, 23, 42, 0.66);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 22px 48px rgba(0, 0, 0, 0.45),
    0 10px 24px rgba(79, 110, 247, 0.18),
    0 2px 6px rgba(139, 92, 246, 0.16);
}

/* 胶囊态下内层不再自己收窄，否则会 100% × 100% 双重收缩 */
.site-header.is-scrolled .header-inner {
  max-width: none;
}

/* 可选：真正的液态扭曲。需要页面里存在 #liquid_glass_filter 这段 SVG */
.site-header.use-liquid .header-glass {
  backdrop-filter: blur(20px) saturate(180%) url(#liquid_glass_filter);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

.site-header.use-liquid.is-scrolled .header-glass {
  backdrop-filter: blur(26px) saturate(200%) url(#liquid_glass_filter);
  -webkit-backdrop-filter: blur(26px) saturate(200%);
}

.header-inner {
  position: relative;
  z-index: 1;
  height: 100%;
  /* 去掉 max-width/margin auto：否则超宽屏下 header-inner 居中，
     主题按钮会远离右边缘，而侧边栏 logo 始终贴左 18px，左右不对称 */
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* 手机端顶栏中间的 Logo：绝对居中，不受左右按钮宽度差影响 */
.header-center-logo {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  white-space: nowrap;
}
/* 桌面端顶栏不重复显示 Logo（侧边栏已有），这里用媒体查询而非 sm:hidden，
   避免被本组件的 display:flex 覆盖 */
@media (min-width: 640px) {
  .header-center-logo {
    display: none;
  }
}

/* 主题切换按钮 */
.theme-btn {
  flex: none;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: #64748b;
  cursor: pointer;
  transition: all 0.25s ease;
}

.theme-btn:hover {
  color: #2563eb;
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.08);
  transform: scale(1.08);
}

.dark .theme-btn {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(51, 65, 85, 0.8);
  color: #94a3b8;
}

.dark .theme-btn:hover {
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.3);
  background: rgba(96, 165, 250, 0.1);
}

/* 已登录状态：登录图标高亮成主色，一眼看出"已经登录了" */
.theme-btn.is-auth {
  color: #2563eb;
  border-color: rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.12);
}
.dark .theme-btn.is-auth {
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.45);
  background: rgba(96, 165, 250, 0.16);
}

/* 页眉「相册」入口：文字胶囊，粉色调点缀 */
.albums-nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: 999px;
  color: #be5f8f;
  background: rgba(236, 100, 160, 0.1);
  border: 1px solid rgba(236, 100, 160, 0.28);
  transition: all 0.18s;
  white-space: nowrap;
}
.albums-nav-btn:hover {
  color: #ec4899;
  background: rgba(236, 100, 160, 0.16);
  border-color: rgba(236, 100, 160, 0.5);
  box-shadow: 0 4px 14px rgba(236, 72, 153, 0.22);
  transform: translateY(-1px);
}
.dark .albums-nav-btn {
  color: #f0a8ca;
  background: rgba(236, 100, 160, 0.14);
  border-color: rgba(236, 100, 160, 0.32);
}
.dark .albums-nav-btn:hover {
  color: #f9a8d4;
  background: rgba(236, 100, 160, 0.22);
}
/* 相册模块只在电脑端展示：手机端整块隐藏，导航里也不显示「相册」 */
@media (max-width: 639px) {
  .albums-nav-btn {
    display: none;
  }
}

/* =====================================================================
   侧边栏
   ===================================================================== */
.site-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100%;
  width: 280px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border-right: 1px solid rgba(226, 232, 240, 0.6);
  /* transform 完全交给 Tailwind 的 -translate-x-full / sm:translate-x-0 / drawer 状态类控制 */
  transition: background 0.4s ease, border-color 0.4s ease, transform 0.3s ease;
}

/* 抽屉打开时的层级。
   为什么不用 Tailwind 的 z-[110]：任意值类是按"样式表里出现的顺序"决定优先级的，
   z-[105]（遮罩）排在 z-[110] 后面就会把它压住 —— 实测侧边栏打开时 computed
   z-index 仍是 90，点分类点到的全是遮罩，抽屉"一点就收"就是这个原因。
   这里用组件自己的类明确层级：打开时 300，压过遮罩(105)和页眉(100)。 */
.site-sidebar.is-open {
  z-index: 300;
}

.dark .site-sidebar {
  background: rgba(15, 23, 42, 0.9);
  border-right-color: rgba(51, 65, 85, 0.5);
}

.sidebar-header {
  flex: none;
  height: 64px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  box-sizing: border-box;
}

.dark .sidebar-header {
  border-bottom-color: rgba(51, 65, 85, 0.5);
}

/* 分类区块：scrollIntoView 定位时避开顶部固定页眉（64px + 16px 呼吸），
   标题不会刚好贴顶被页眉遮住 */
.category-section {
  scroll-margin-top: 80px;
}

/* 分类列表独占剩余高度并独立滚动，分类多了也不会把侧边栏撑爆 */
.sidebar-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.4);
  border-radius: 999px;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.65);
}

/* 侧边栏底部：相册入口（仅手机端，桌面端用页眉胶囊） */
.sidebar-albums {
  flex: none;
  padding: 12px 12px 16px;
  border-top: 1px solid rgba(226, 232, 240, 0.6);
}

.sidebar-albums-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  color: #be5f8f;
  background: rgba(236, 100, 160, 0.1);
  border: 1px solid rgba(236, 100, 160, 0.24);
  transition: background 0.18s, border-color 0.18s, color 0.18s;
}

.sidebar-albums-btn:active {
  background: rgba(236, 100, 160, 0.2);
}

.dark .sidebar-albums {
  border-top-color: rgba(51, 65, 85, 0.5);
}

.dark .sidebar-albums-btn {
  color: #f0a8ca;
  background: rgba(236, 100, 160, 0.14);
  border-color: rgba(236, 100, 160, 0.3);
}

.category-nav-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 11px 14px;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 400;
  color: #475569;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: all 0.2s;
}

.category-nav-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.category-nav-btn.active {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

.nav-count {
  flex: none;
  font-size: 12px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 3px 9px;
  border-radius: 999px;
  font-weight: 500;
}

.category-nav-btn.active .nav-count {
  background: #2563eb;
  color: #fff;
}

.dark .category-nav-btn {
  color: #cbd5e1;
}

.dark .category-nav-btn:hover {
  background: rgba(51, 65, 85, 0.5);
  color: #f1f5f9;
}

.dark .category-nav-btn.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.dark .nav-count {
  background: rgba(51, 65, 85, 0.6);
  color: #cbd5e1;
}

.dark .category-nav-btn.active .nav-count {
  background: rgba(96, 165, 250, 0.25);
  color: #60a5fa;
}

.subcategory-tag {
  padding: 5px 14px;
  background: #f1f5f9;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.subcategory-tag:hover {
  background: #e2e8f0;
  color: #475569;
}

.subcategory-tag.active {
  background: #dbeafe;
  color: #2563eb;
  border-color: rgba(59, 130, 246, 0.2);
  font-weight: 600;
}

.dark .subcategory-tag {
  background: rgba(51, 65, 85, 0.5);
  color: #94a3b8;
}

.dark .subcategory-tag:hover {
  background: rgba(71, 85, 105, 0.6);
  color: #e2e8f0;
}

.dark .subcategory-tag.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.2);
}

.site-card {
  padding: 10px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

@media (min-width: 640px) {
  .site-card {
    padding: 14px;
    border-radius: 12px;
  }
}

.site-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.1), 0 2px 6px rgba(0, 0, 0, 0.04);
}

.site-card:hover .card-icon {
  transform: scale(1.08);
}

.site-card:hover .card-title {
  color: #2563eb;
}

/* ===== 热门推荐卡片：暖橙调，和分类里的普通卡片明显区分开 ===== */
.hot-card {
  position: relative;
  background: linear-gradient(140deg, #fff7ed 0%, #ffffff 62%);
  border-color: rgba(251, 146, 60, 0.45);
  transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
}

/* 顶部一道橙红渐变高光，作为"热门"的视觉签名 */
.hot-card::before {
  content: '';
  position: absolute;
  inset: 1px 1px auto 1px;
  height: 2.5px;
  border-radius: 11px 11px 0 0;
  background: linear-gradient(90deg, #fbbf24, #f97316 55%, #ef4444);
  opacity: 0.9;
  pointer-events: none;
}

.site-card.hot-card:hover {
  border-color: #fb923c;
  box-shadow: 0 12px 26px -12px rgba(249, 115, 22, 0.5), 0 2px 6px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
}

.hot-card-icon {
  background: #dbeafe;
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.25);
}

.hot-card-title {
  transition: color 0.2s ease;
}

.site-card.hot-card:hover .hot-card-title {
  color: #ea580c;
}

.hot-clicks {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 11px;
  line-height: 1.25;
  color: #3b82f6;
  white-space: nowrap;
  min-width: 0;
}

/* 前三名排名徽章：金 / 银 / 铜 */
.hot-rank {
  position: absolute;
  top: -6px;
  left: -6px;
  z-index: 2;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  border: 1.5px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
}

.hot-rank-1 { background: linear-gradient(135deg, #fcd34d, #f59e0b); }
.hot-rank-2 { background: linear-gradient(135deg, #e2e8f0, #94a3b8); }
.hot-rank-3 { background: linear-gradient(135deg, #fdba74, #ea580c); }

.dark .hot-card {
  background: linear-gradient(140deg, rgba(120, 53, 15, 0.32) 0%, rgba(30, 41, 59, 0.88) 62%);
  border-color: rgba(251, 146, 60, 0.35);
}

.dark .hot-card::before {
  opacity: 0.75;
}

.dark .site-card.hot-card:hover {
  border-color: #fb923c;
  box-shadow: 0 14px 28px -14px rgba(0, 0, 0, 0.75);
}

.dark .hot-card-icon {
  background: rgba(30, 64, 175, 0.4);
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.3);
}

.dark .site-card.hot-card:hover .hot-card-title {
  color: #fdba74;
}

.dark .hot-clicks {
  color: #93c5fd;
}

.dark .hot-rank {
  border-color: #1e293b;
}

/* ===== 热门推荐·分类列：一列一个一级分类，暖橙调延续 hot-card 视觉 ===== */
.hot-col {
  position: relative;
  overflow: hidden;
  background: linear-gradient(140deg, #eff6ff 0%, #ffffff 62%);
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: 14px;
  padding: 10px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.hot-col::before {
  content: '';
  position: absolute;
  inset: 1px 1px auto 1px;
  height: 2.5px;
  border-radius: 13px 13px 0 0;
  background: linear-gradient(90deg, #93c5fd, #3b82f6 55%, #6366f1);
  opacity: 0.9;
  pointer-events: none;
}

.hot-col-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 4px 8px;
  border-bottom: 1px dashed rgba(59, 130, 246, 0.3);
  margin-bottom: 6px;
}

.hot-col-rank {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

/* 第 4、5 名没有金银铜配色，用浅蓝补位 */
.hot-col-rank-plain {
  background: #dbeafe;
  color: #1d4ed8;
}

.hot-col-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hot-col-head .hot-clicks {
  margin-left: auto;
}

.hot-col-site {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.hot-col-site:hover {
  background: rgba(59, 130, 246, 0.08);
}

.hot-col-site-name {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.hot-col-site:hover .hot-col-site-name {
  color: #2563eb;
}

.hot-col-site-clicks {
  flex-shrink: 0;
}

.dark .hot-col {
  background: linear-gradient(140deg, rgba(30, 58, 138, 0.35) 0%, rgba(30, 41, 59, 0.88) 62%);
  border-color: rgba(96, 165, 250, 0.3);
}

.dark .hot-col::before {
  opacity: 0.75;
}

.dark .hot-col-name {
  color: #e2e8f0;
}

.dark .hot-col-site-name {
  color: #cbd5e1;
}

.dark .hot-col-site:hover {
  background: rgba(96, 165, 250, 0.12);
}

.dark .hot-col-site:hover .hot-col-site-name {
  color: #93c5fd;
}

.dark .hot-col-rank-plain {
  background: rgba(96, 165, 250, 0.25);
  color: #93c5fd;
}

/* ===== 热门推荐·手机端：点击前 10 两列列表 ===== */
.hot-mobile-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(59, 130, 246, 0.18);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.hot-mobile-item:active {
  background: rgba(59, 130, 246, 0.08);
}

.hot-mobile-rank {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: #dbeafe;
  color: #1d4ed8;
}

.hot-mobile-rank-1 { background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #fff; }
.hot-mobile-rank-2 { background: linear-gradient(135deg, #e2e8f0, #94a3b8); color: #fff; }
.hot-mobile-rank-3 { background: linear-gradient(135deg, #fdba74, #ea580c); color: #fff; }

.hot-mobile-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dark .hot-mobile-item {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(96, 165, 250, 0.25);
}

.dark .hot-mobile-item:active {
  background: rgba(96, 165, 250, 0.12);
}

.dark .hot-mobile-name {
  color: #e2e8f0;
}

.dark .hot-mobile-rank {
  background: rgba(96, 165, 250, 0.25);
  color: #93c5fd;
}

.card-icon {
  transition: transform 0.25s ease;
}

.card-title {
  transition: color 0.2s ease;
}

.skeleton-section {
  animation: fadeIn 0.5s ease;
}

.skeleton-banner {
  position: relative;
  width: 100%;
  margin-bottom: 6px;
}

.skeleton-banner-image {
  width: 100%;
  height: 200px;
  background: linear-gradient(90deg, #e2e8f0 25%, #cbd5e1 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12px;
}

@media (min-width: 640px) {
  .skeleton-banner-image {
    height: 300px;
  }
}

@media (min-width: 768px) {
  .skeleton-banner-image {
    height: 400px;
  }
}

@media (min-width: 1024px) {
  .skeleton-banner-image {
    height: 500px;
  }
}

.skeleton-search-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 95%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.skeleton-site-name {
  width: 200px;
  height: 28px;
  background: linear-gradient(90deg, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

.skeleton-search-box {
  width: 100%;
  height: 48px;
  background: linear-gradient(90deg, rgba(0,0,0,0.2) 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 24px;
}

.skeleton-title {
  width: 120px;
  height: 24px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
  margin-bottom: 16px;
}

.skeleton-card {
  padding: 12px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.skeleton-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12px;
}

.skeleton-text {
  width: 100%;
  height: 12px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-text-sm {
  width: 80%;
}

.skeleton-text-xs {
  width: 60%;
  height: 10px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

html.dark {
  --bg-color: #0f172a;
  --bg-card: #1e293b;
  --bg-card-hover: #334155;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --border-color: #334155;
  --border-hover: #60a5fa;
}

.dark .min-h-screen {
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
}

.dark .site-card {
  background: rgba(30, 41, 59, 0.7);
  border-color: rgba(51, 65, 85, 0.6);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.dark .site-card:hover {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(96, 165, 250, 0.4);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.12), 0 2px 6px rgba(0, 0, 0, 0.2);
}

.dark .site-card:hover .card-icon {
  filter: drop-shadow(0 2px 6px rgba(96, 165, 250, 0.25));
}

.dark .site-card .card-title {
  color: #f1f5f9;
}

.dark .site-card .card-desc {
  color: #94a3b8;
}

.dark .tab-content {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(51, 65, 85, 0.5);
  backdrop-filter: blur(10px);
}

.dark .tab-content h2 {
  color: #f8fafc;
}

.dark .tab-content h2 span {
  color: #cbd5e1;
}

.dark .search-input {
  background: #1e293b;
  color: #f8fafc;
  border-color: #334155;
}

.dark .search-input:focus {
  border-color: #60a5fa;
}

.dark .search-input::placeholder {
  color: #64748b;
}

.dark .particle-canvas {
  opacity: 0.15;
}

/* 更精细的暗色文本控制：避免把所有 slate 都变成纯白 */
.dark .text-slate-800,
.dark .text-slate-700 {
  color: #f1f5f9;
}

.dark .text-slate-600 {
  color: #cbd5e1;
}

.dark .text-slate-500 {
  color: #94a3b8;
}

.dark .text-slate-400 {
  color: #64748b;
}

/* 手机端搜索引擎菜单适配 */
@media (max-width: 639px) {
  .search-input-overlay {
    padding-left: 52px;
    padding-right: 100px;
    font-size: 14px;
    height: 48px;
  }

  .search-engine-btn {
    padding: 2px 8px;
    font-size: 11px;
  }

  .search-engine-btn svg {
    width: 14px;
    height: 14px;
  }

  /* 引擎选择菜单在手机上全屏宽度 */
  .search-engine-menu-mobile {
    position: fixed !important;
    left: 50% !important;
    right: auto !important;
    top: auto !important;
    transform: translateX(-50%) !important;
    width: 90vw !important;
    max-width: 300px !important;
    min-width: unset !important;
  }

  /* 引擎菜单项在手机上更大点击区域 */
  .search-engine-menu-mobile .engine-item {
    padding: 12px 16px !important;
  }

  .search-engine-menu-mobile .engine-item span {
    font-size: 14px !important;
  }

  .search-engine-menu-mobile .engine-item img {
    width: 20px !important;
    height: 20px !important;
  }
}

</style>
