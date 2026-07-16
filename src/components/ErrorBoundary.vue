<template>
  <div class="error-boundary" v-if="hasError">
    <div class="error-card">
      <div class="error-icon">💥</div>
      <h3>{{ errorTitle }}</h3>
      <p class="error-message">{{ errorMessage }}</p>
      <div class="error-actions">
        <button @click="handleRetry" class="btn-retry">🔄 重试</button>
        <button v-if="showReset" @click="handleReset" class="btn-reset">🔧 重置</button>
      </div>
      <p v-if="errorStack" class="error-stack">{{ errorStack }}</p>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup>
import { ref, onErrorCaptured } from 'vue'

const props = defineProps({
  errorTitle: {
    type: String,
    default: '出错了'
  },
  showReset: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['retry', 'reset'])

const hasError = ref(false)
const errorMessage = ref('')
const errorStack = ref('')

onErrorCaptured((err, instance, info) => {
  hasError.value = true
  errorMessage.value = err.message || '未知错误'
  errorStack.value = err.stack || ''
  
  console.error('ErrorBoundary captured:', err, info)
  return false
})

const handleRetry = () => {
  emit('retry')
}

const handleReset = () => {
  emit('reset')
}

const clearError = () => {
  hasError.value = false
  errorMessage.value = ''
  errorStack.value = ''
}

defineExpose({ clearError })
</script>

<style scoped>
.error-boundary {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.error-card {
  max-width: 480px;
  width: 100%;
  padding: 40px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-card h3 {
  font-size: 24px;
  color: #333;
  margin: 0 0 12px 0;
}

.error-message {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin: 0 0 20px 0;
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.btn-retry {
  padding: 12px 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-retry:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-reset {
  padding: 12px 28px;
  background: transparent;
  color: #666;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-reset:hover {
  border-color: #667eea;
  color: #667eea;
}

.error-stack {
  font-size: 11px;
  color: #999;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0;
  text-align: left;
  display: none;
}

@media (max-width: 480px) {
  .error-card {
    padding: 24px;
  }
  
  .error-icon {
    font-size: 48px;
  }
  
  .error-card h3 {
    font-size: 20px;
  }
}
</style>