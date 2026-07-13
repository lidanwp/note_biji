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
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  authStore.checkAuth()
  
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
  
  if (to.path === '/login' && authStore.isLoggedIn) {
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
