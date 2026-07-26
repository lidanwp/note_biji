import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, getSiteUrl } from '../services/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const isLoggedIn = ref(false)
  const token = ref(null)
  const authProvider = ref(null)

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
        authProvider.value = 'custom'
        localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token, provider: 'custom' }))
        return { success: true, role: data.user.role }
      }

      return { success: false, message: data.error || '账号或密码错误' }
    } catch (e) {
      console.error('登录请求失败:', e)
      return { success: false, message: '网络错误，请稍后重试' }
    }
  }

  const loginWithGitHub = async () => {
    try {
      const siteUrl = getSiteUrl()
      const redirectUrl = `${siteUrl}/#/auth/callback`

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline'
          }
        }
      })

      if (error) {
        console.error('GitHub OAuth 启动失败:', error)
        return { success: false, message: 'GitHub 登录启动失败，请稍后重试' }
      }

      if (data?.url) {
        window.location.href = data.url
        return { success: true }
      }

      return { success: false, message: '无法获取 GitHub 登录链接' }
    } catch (e) {
      console.error('GitHub OAuth 异常:', e)
      return { success: false, message: 'GitHub 登录异常，请稍后重试' }
    }
  }

  const handleOAuthCallback = async () => {
    try {
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search)
      const code = hashParams.get('code')

      if (!code) {
        const params = new URLSearchParams(window.location.search)
        const authCode = params.get('code')
        if (authCode) {
          return await exchangeCodeForSession(authCode)
        }
        return { success: false, message: '无效的 OAuth 回调' }
      }

      return await exchangeCodeForSession(code)
    } catch (e) {
      console.error('OAuth 回调处理失败:', e)
      return { success: false, message: 'OAuth 登录失败' }
    }
  }

  const exchangeCodeForSession = async (code) => {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Exchange code 失败:', error)
        return { success: false, message: 'OAuth 会话建立失败' }
      }

      if (data?.session) {
        const session = data.session
        const supabaseUser = session.user

        const userData = {
          id: supabaseUser.id,
          username: supabaseUser.user_metadata?.user_name || 
                   supabaseUser.user_metadata?.full_name || 
                   supabaseUser.email?.split('@')[0] || 
                   'GitHub用户',
          role: 'viewer',
          provider: 'github',
          avatar: supabaseUser.user_metadata?.avatar_url || null
        }

        user.value = userData
        token.value = session.access_token
        isLoggedIn.value = true
        authProvider.value = 'github'

        localStorage.setItem('auth', JSON.stringify({
          user: userData,
          token: session.access_token,
          refreshToken: session.refresh_token,
          provider: 'github'
        }))

        return { success: true, role: 'viewer', user: userData }
      }

      return { success: false, message: '无法获取用户信息' }
    } catch (e) {
      console.error('Exchange code 异常:', e)
      return { success: false, message: 'OAuth 登录异常' }
    }
  }

  const logout = async () => {
    if (authProvider.value === 'github') {
      try {
        await supabase.auth.signOut()
      } catch (e) {
        console.warn('Supabase signOut 失败:', e)
      }
    }

    const stored = localStorage.getItem('auth')
    if (stored) {
      try {
        const { token: savedToken, provider } = JSON.parse(stored)
        if (savedToken && provider !== 'github') {
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
    authProvider.value = null
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

      if (data.provider === 'github') {
        try {
          const { data: sessionData, error } = await supabase.auth.getSession()
          if (error || !sessionData?.session) {
            throw new Error('Supabase session 无效')
          }
          token.value = sessionData.session.access_token
          user.value = data.user
          isLoggedIn.value = true
          authProvider.value = 'github'
          return true
        } catch (supabaseErr) {
          throw new Error('Supabase session 已过期')
        }
      }

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
        authProvider.value = 'custom'
        return true
      }

      throw new Error('token 无效')
    } catch (e) {
      console.warn('登录状态已过期，请重新登录')
      user.value = null
      token.value = null
      isLoggedIn.value = false
      authProvider.value = null
      localStorage.removeItem('auth')
      return false
    }
  }

  return { user, isLoggedIn, token, authProvider, login, loginWithGitHub, handleOAuthCallback, logout, checkAuth }
})
