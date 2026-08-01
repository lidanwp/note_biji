import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import './styles/theme.css'

// 处理外部链接（如邮箱验证回调）的 hash 路由重定向
// 用户点击邮件中的链接后有两种情况：
// 1. Supabase 直接带参数重定向回来：https://bdxxg.asia/?type=signup
// 2. 带 token 的回调：https://bdxxg.asia/auth/callback?token=xxx
(function handleExternalRedirect() {
  const path = window.location.pathname
  const search = window.location.search
  const hash = window.location.hash

  // 如果当前已经是 hash 路由（以 #/ 开头），不处理
  if (hash && hash.startsWith('#/')) return

  // 检查 URL 是否包含验证相关参数
  const hasVerifyParams = search.includes('type=signup') || search.includes('token=') || search.includes('error=')

  // Case 1: URL 是根路径但带有验证参数 → 重定向到 /auth/callback
  if (path === '/' && hasVerifyParams) {
    const newHash = '#/auth/callback' + search
    window.location.replace(window.location.origin + '/' + newHash)
    return
  }

  // Case 2: 其他非根路径 → 重定向到 hash 路由
  if (path !== '/' || (search && !hasVerifyParams)) {
    const newHash = '#' + path + search
    window.location.replace(window.location.origin + '/' + newHash)
  }
})()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
