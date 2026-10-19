import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomePage.vue')
  },
  {
    path: '/albums',
    name: 'Albums',
    component: () => import('../views/AlbumsView.vue')
  },
  {
    path: '/albums/:id',
    name: 'AlbumDetail',
    component: () => import('../views/AlbumDetailView.vue')
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'AdminDashboard',
        component: () => import('../views/AdminDashboard.vue')
      },
      {
        path: 'categories',
        name: 'AdminCategories',
        component: () => import('../views/AdminCategories.vue')
      },
      {
        path: 'sites',
        name: 'AdminSites',
        component: () => import('../views/AdminSites.vue')
      },
      {
        path: 'settings',
        name: 'AdminSettings',
        component: () => import('../views/AdminSettings.vue')
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginPage.vue')
  },
  {
    // 兜底：未匹配的路径统一走 404 页，而不是白屏
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

export default router
