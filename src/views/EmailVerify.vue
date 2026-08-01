<template>
  <div class="email-verify-page">
    <div class="verify-card">
      <div class="verify-icon" :class="status">
        <div v-if="status === 'loading'" class="spinner"></div>
        <svg v-else-if="status === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 12l3 3 5-5"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <h1 class="verify-title">{{ title }}</h1>
      <p class="verify-message">{{ message }}</p>
      <button v-if="status !== 'loading'" class="verify-btn" @click="goLogin">
        {{ status === 'success' ? '前往登录' : '返回首页' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const status = ref('loading') // loading | success | error
const title = ref('正在验证邮箱...')
const message = ref('请稍候，系统正在处理您的验证请求')

const goLogin = () => {
  router.replace('/login')
}

onMounted(async () => {
  try {
    // 从 URL 获取 Supabase 验证参数
    // Hash 路由下参数在 route.query 中
    const token = route.query.token || route.query.access_token
    const type = route.query.type
    const email = route.query.email

    if (!token) {
      // 没有 token 参数，可能是直接访问此页面
      status.value = 'error'
      title.value = '验证链接无效'
      message.value = '未检测到有效的验证参数，请点击邮件中的完整链接，或联系管理员。'
      return
    }

    // 调用后端验证接口
    const response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        token, 
        type: type || 'signup',
        email 
      })
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok) {
      status.value = 'success'
      title.value = '邮箱验证成功！'
      message.value = '感谢您的注册，邮箱已验证通过。现在可以使用邮箱和密码登录系统了。'
    } else {
      status.value = 'error'
      title.value = '验证失败'
      message.value = data.error || '验证链接可能已过期或无效，请重新注册或联系管理员。'
    }
  } catch (e) {
    status.value = 'error'
    title.value = '网络错误'
    message.value = '网络连接异常，请稍后重试。如果问题持续存在，请联系管理员。'
  }
})
</script>

<style scoped>
.email-verify-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary, #f5f7fa);
  padding: 20px;
}
.verify-card {
  background: var(--bg-secondary, #fff);
  border-radius: 16px;
  padding: 48px 40px;
  text-align: center;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  border: 1px solid var(--border-color, #e8ecf1);
}
.verify-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.verify-icon.loading {
  background: var(--accent-light, rgba(102,126,234,0.12));
  color: var(--accent-color, #667eea);
}
.verify-icon.success {
  background: rgba(34,197,94,0.12);
  color: #22c55e;
}
.verify-icon.error {
  background: rgba(239,68,68,0.12);
  color: #ef4444;
}
.verify-icon svg {
  width: 36px;
  height: 36px;
}
.verify-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary, #1a1a2e);
  margin: 0 0 12px;
}
.verify-message {
  font-size: 15px;
  color: var(--text-secondary, #666);
  line-height: 1.6;
  margin: 0 0 32px;
}
.verify-btn {
  background: var(--accent-color, #667eea);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 32px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.verify-btn:hover {
  background: var(--accent-hover, #5a6fd6);
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color, #e8ecf1);
  border-top-color: var(--accent-color, #667eea);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 暗色主题 */
[data-theme="dark"] .verify-card {
  background: var(--bg-card, #1e1e32);
  border-color: var(--border-color, #2a2a42);
}
[data-theme="dark"] .verify-title {
  color: var(--text-primary, #e8e8f0);
}
[data-theme="dark"] .verify-message {
  color: var(--text-secondary, #b0b0c0);
}

/* 移动端 */
@media (max-width: 480px) {
  .verify-card {
    padding: 36px 24px;
  }
  .verify-title {
    font-size: 20px;
  }
  .verify-message {
    font-size: 14px;
  }
}
</style>
