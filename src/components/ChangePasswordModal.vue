<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="cp-overlay" @click="handleOverlayClick">
        <div class="cp-modal" @click.stop>
          <div class="cp-header">
            <h3>修改密码</h3>
            <button class="cp-close" @click="handleClose">✕</button>
          </div>
          
          <div class="cp-body">
            <div class="cp-form-group">
              <label>旧密码</label>
              <input 
                type="password" 
                v-model="oldPassword" 
                placeholder="请输入旧密码"
                class="cp-input"
                @keyup.enter="handleSubmit"
              />
            </div>
            
            <div class="cp-form-group">
              <label>新密码</label>
              <input 
                type="password" 
                v-model="newPassword" 
                placeholder="请输入新密码（至少6位）"
                class="cp-input"
                @keyup.enter="handleSubmit"
              />
            </div>
            
            <div class="cp-form-group">
              <label>确认新密码</label>
              <input 
                type="password" 
                v-model="confirmPassword" 
                placeholder="请再次输入新密码"
                class="cp-input"
                @keyup.enter="handleSubmit"
              />
            </div>
            
            <div v-if="errorMessage" class="cp-error">{{ errorMessage }}</div>
          </div>
          
          <div class="cp-footer">
            <button class="cp-btn cp-btn-secondary" @click="handleClose">取消</button>
            <button 
              class="cp-btn cp-btn-primary" 
              @click="handleSubmit"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? '处理中...' : '确认修改' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  userId: { type: [String, Number], default: '' }
})

const emit = defineEmits(['update:visible', 'success'])

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const handleClose = () => {
  emit('update:visible', false)
  resetForm()
}

const handleOverlayClick = () => {
  handleClose()
}

const resetForm = () => {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  errorMessage.value = ''
}

const handleSubmit = async () => {
  errorMessage.value = ''
  
  if (!oldPassword.value) {
    errorMessage.value = '请输入旧密码'
    return
  }
  
  if (!newPassword.value) {
    errorMessage.value = '请输入新密码'
    return
  }
  
  if (newPassword.value.length < 6) {
    errorMessage.value = '新密码至少需要6位'
    return
  }
  
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的新密码不一致'
    return
  }
  
  if (oldPassword.value === newPassword.value) {
    errorMessage.value = '新密码不能与旧密码相同'
    return
  }
  
  isSubmitting.value = true
  
  try {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: props.userId,
        oldPassword: oldPassword.value,
        newPassword: newPassword.value
      })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      errorMessage.value = data.error || '修改密码失败'
      return
    }
    
    emit('success')
    handleClose()
  } catch (error) {
    errorMessage.value = '网络错误，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style>
.cp-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.cp-modal {
  background: var(--bg-secondary, #fff);
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.cp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color, #e8ecf1);
}

.cp-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.cp-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-muted, #999);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
}

.cp-close:hover {
  background: var(--bg-hover, #f5f7fa);
  color: var(--text-primary, #333);
}

.cp-body {
  padding: 24px;
}

.cp-form-group {
  margin-bottom: 16px;
}

.cp-form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #333);
  margin-bottom: 8px;
}

.cp-input {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid var(--border-color, #e8ecf1);
  border-radius: 10px;
  font-size: 15px;
  color: var(--text-primary, #333);
  background: var(--bg-input, #fff);
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.cp-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
}

.cp-input::placeholder {
  color: var(--text-muted, #999);
}

.cp-error {
  color: #ff4d4f;
  font-size: 13px;
  margin-top: 8px;
  padding: 10px 12px;
  background: rgba(255, 77, 79, 0.08);
  border-radius: 8px;
}

.cp-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px 24px;
}

.cp-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cp-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cp-btn-secondary {
  background: var(--bg-hover, #f5f7fa);
  color: var(--text-primary, #333);
}

.cp-btn-secondary:hover {
  background: var(--border-color, #e8ecf1);
}

.cp-btn-primary {
  background: #667eea;
  color: #fff;
}

.cp-btn-primary:hover:not(:disabled) {
  background: #5a6fd6;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .cp-modal,
.modal-leave-active .cp-modal {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-enter-from .cp-modal {
  transform: scale(0.95);
  opacity: 0;
}

.modal-leave-to .cp-modal {
  transform: scale(0.95);
  opacity: 0;
}
</style>
