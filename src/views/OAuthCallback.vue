<template>
  <div class="callback-container">
    <div class="callback-card">
      <div class="loading-spinner" v-if="!error">
        <div class="spinner"></div>
        <p class="loading-text">正在完成 GitHub 登录...</p>
        <p class="sub-text">请稍候</p>
      </div>
      <div class="error-content" v-else>
        <div class="error-icon">⚠️</div>
        <p class="error-text">{{ error }}</p>
        <button class="retry-btn" @click="goToLogin">返回登录页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const error = ref(null)

const goToLogin = () => {
  router.push('/login')
}

onMounted(async () => {
  try {
    const result = await authStore.handleOAuthCallback()

    if (result.success) {
      const userRole = result.role || 'viewer'
      if (userRole === 'admin') {
        router.push('/admin')
      } else {
        router.push('/viewer')
      }
    } else {
      error.value = result.message || '登录失败，请重试'
    }
  } catch (e) {
    console.error('OAuth 回调处理异常:', e)
    error.value = '登录过程中发生错误，请重试'
  }
})
</script>

<style scoped>
.callback-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FFE8F0 0%, #E8D5F5 40%, #D5E8F5 100%);
  font-family: 'PingFang SC', -apple-system, sans-serif;
}

.callback-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 32px;
  padding: 60px 50px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(124, 58, 237, 0.15);
  min-width: 320px;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(124, 58, 237, 0.15);
  border-top-color: #7C3AED;
  border-radius: 50%;
  animation: spin 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 18px;
  font-weight: 600;
  color: #2D1B3D;
  margin: 0;
}

.sub-text {
  font-size: 14px;
  color: #7C6B8A;
  margin: 0;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.error-icon {
  font-size: 48px;
}

.error-text {
  font-size: 16px;
  color: #EF4444;
  font-weight: 500;
  margin: 0;
}

.retry-btn {
  padding: 12px 32px;
  background: linear-gradient(135deg, #8B5CF6, #6D28D9);
  color: white;
  border: none;
  border-radius: 100px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.retry-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.35);
}
</style>
