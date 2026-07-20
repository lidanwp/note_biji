import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isLoggedIn = ref(false)
  const token = ref(null)

  const login = async (username, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      let data = null
      try {
        data = await response.json()
      } catch (parseErr) {
        const text = await response.text().catch(() => '')
        console.error('登录响应解析失败:', response.status, text)
        if (response.status === 500) {
          return { success: false, message: '服务器内部错误，请稍后重试' }
        }
        return { success: false, message: '登录失败，请稍后重试' }
      }

      if (response.ok) {
        user.value = data.user
        token.value = data.token
        isLoggedIn.value = true
        localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }))
        return { success: true, role: data.user.role }
      }

      return { success: false, message: data.error || '账号或密码错误' }
    } catch (e) {
      console.error('登录请求失败:', e)
      return { success: false, message: '网络错误，请稍后重试' }
    }
  }

  const logout = () => {
    // 通知后端删除 session（不阻塞登出）
    const stored = localStorage.getItem('auth')
    if (stored) {
      try {
        const { token: savedToken } = JSON.parse(stored)
        if (savedToken) {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: savedToken })
          }).catch(() => {})
        }
      } catch (_) {}
    }

    user.value = null
    token.value = null
    isLoggedIn.value = false
    localStorage.removeItem('auth')
  }

  const checkAuth = async () => {
    const stored = localStorage.getItem('auth')
    if (!stored) return false

    try {
      const data = JSON.parse(stored)
      if (!data.token) {
        throw new Error('无 token')
      }

      // 向后端验证 token 是否仍然有效
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        user.value = result.user
        token.value = data.token
        isLoggedIn.value = true
        return true
      }

      // token 过期或无效，清除登录状态
      throw new Error('token 无效')
    } catch (e) {
      console.warn('登录状态已过期，请重新登录')
      user.value = null
      token.value = null
      isLoggedIn.value = false
      localStorage.removeItem('auth')
      return false
    }
  }

  return { user, isLoggedIn, token, login, logout, checkAuth }
})
