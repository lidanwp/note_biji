import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isLoggedIn = ref(false)

  const login = (username, password) => {
    // 账号配置
    const users = [
      { 
        username: '13302465541', 
        password: 'wp199582', 
        role: 'admin',
        displayName: '管理员' 
      },
      { 
        username: '呼叫中心冲冲冲', 
        password: '呼叫中心666', 
        role: 'viewer',
        displayName: '呼叫中心冲冲冲' 
      },
      { 
        username: '13800138000', 
        password: '123456', 
        role: 'viewer',
        displayName: '张经理' 
      }
    ]

    // 🔧 修复：用 find 方法在数组中查找
    const foundUser = users.find(
      u => u.username === username && u.password === password
    )

    if (foundUser) {
      user.value = { 
        username: foundUser.displayName || foundUser.username, 
        role: foundUser.role 
      }
      isLoggedIn.value = true
      localStorage.setItem('auth', JSON.stringify(user.value))
      return { success: true, role: foundUser.role }
    }
    return { success: false, message: '账号或密码错误' }
  }

  const logout = () => {
    user.value = null
    isLoggedIn.value = false
    localStorage.removeItem('auth')
  }

  const checkAuth = () => {
    const stored = localStorage.getItem('auth')
    if (stored) {
      const data = JSON.parse(stored)
      user.value = data
      isLoggedIn.value = true
      return true
    }
    return false
  }

  return { user, isLoggedIn, login, logout, checkAuth }
})