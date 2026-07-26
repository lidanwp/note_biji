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
  // OAuth 回调路由（不需要认证保护）
  {
    path: '/auth/callback',
    name: 'oauth-callback',
    component: () => import('@/views/OAuthCallback.vue'),
    meta: { skipAuth: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.skipAuth) {
    next()
    return
  }

  await authStore.checkAuth()

  if (to.meta.requiresAuth) {
    if (!authStore.isLoggedIn) {
      next('/login')
      return
    }
    
    const requiredRole = to.meta.requiredRole
    if (requiredRole && authStore.user?.role !== requiredRole) {
      if (authStore.user?.role === 'admin') {
        next('/admin')
      } else {
        next('/viewer')
      }
      return
    }
  }
  
  // ⭐ 已登录用户访问登录页或注册页 → 根据角色跳转
  if ((to.path === '/login' || to.path === '/register') && authStore.isLoggedIn) {
    if (authStore.user?.role === 'admin') {
      next('/admin')
    } else {
      next('/viewer')
    }
    return
  }
  
  next()
})

export default router