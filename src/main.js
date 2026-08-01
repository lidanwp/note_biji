import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import './styles/theme.css'

// 处理外部链接（如邮箱验证回调）的 hash 路由重定向
// 用户点击邮件中的链接 https://bdxxg.asia/auth/callback?token=xxx
// 需要转换成 hash 路由格式 https://bdxxg.asia/#/auth/callback?token=xxx
(function handleExternalRedirect() {
  const path = window.location.pathname
  const search = window.location.search
  const hash = window.location.hash

  // 如果当前已经是 hash 路由（以 #/ 开头），不处理
  if (hash && hash.startsWith('#/')) return

  // 任何非根路径的非 hash URL，都重定向到 hash 路由
  // 这样邮箱验证回调、直接输入的 URL 等都能被 Vue Router 处理
  if (path !== '/' || search) {
    const newHash = '#' + path + search
    window.location.replace(window.location.origin + '/' + newHash)
  }
})()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
