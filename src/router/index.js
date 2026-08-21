import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/admin'
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminPanel.vue'),
    meta: { requiresAuth: true, requiredRole: 'admin' }
  },
  {
    path: '/viewer',
    name: 'viewer',
    component: () => import('@/views/ViewerPanel.vue'),
    meta: { requiresAuth: true, requiredRole: 'viewer' }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue')
  },
  {
    path: '/note-list',
    name: 'note-list',
    component: () => import('@/views/NoteList.vue'),
    meta: { public: true }
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/views/EmailVerify.vue'),
    meta: { public: true }
  },
  // catch-all: 任何未匹配路径重定向到首页（避免白屏）
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // 已登录：无需重复 verify，直接放行（登录后跳转或会话仍有效）
  if (authStore.isLoggedIn) {
    // 已登录用户访问登录/注册页 → 按角色跳转
    if (to.path === '/login' || to.path === '/register') {
      if (authStore.user?.role === 'admin') next('/admin')
      else next('/viewer')
      return
    }
    next()
    return
  }

  // 未登录访问受保护路由：检查 localStorage 是否有 token
  // 有 token → 乐观放行，由页面组件并行做 checkAuth + 加载数据（避免守卫串行阻塞）
  // 无 token → 跳登录
  if (to.meta.requiresAuth) {
    const stored = localStorage.getItem('auth')
    if (stored) {
      next()
      return
    }
    next('/login')
    return
  }

  next()
})

export default router