<template>
  <div id="app">
    <ErrorBoundary @retry="handleRetry">
      <router-view />
    </ErrorBoundary>
    <Toast ref="toastRef" />
    <div v-if="loadingState" class="global-loading">
      <div class="loading-spinner"></div>
      <span class="loading-text">{{ loadingMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from './stores/auth'
import Toast from './components/Toast.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import { setToastInstance } from './utils/toast'
import { loadingState, loadingMessage, useLoading } from './utils/loading'

const authStore = useAuthStore()
const toastRef = ref(null)

const { startLoading, stopLoading } = useLoading()

onMounted(async () => {
  if (toastRef.value) {
    setToastInstance(toastRef.value)
  }
  try {
    startLoading('验证登录状态...')
    await authStore.checkAuth()
  } finally {
    stopLoading()
  }
})

const handleRetry = () => {
  window.location.reload()
}

watch(loadingState, (val) => {
  if (val) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
}

.global-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  gap: 16px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: white;
  font-size: 16px;
  font-weight: 500;
}
</style>
