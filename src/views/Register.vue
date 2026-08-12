<template>
  <div class="login-container">
    <div class="floating-emojis">
      <span 
        v-for="(emoji, index) in floatingEmojis" 
        :key="index"
        class="floating-emoji"
        :style="{
          left: emoji.x + '%',
          top: emoji.y + '%',
          fontSize: emoji.size + 'px',
          animationDuration: emoji.duration + 's',
          animationDelay: emoji.delay + 's'
        }"
      >
        {{ emoji.char }}
      </span>
    </div>

    <div class="login-card">
      <div class="card-top-emoji">🚀</div>

      <h1>加入我们 <span class="wave-hand">✨</span></h1>
      <p class="subtitle">开启你的知识分享之旅 🌟</p>

      <form @submit.prevent="handleRegister">
        <div class="form-group" :class="{ shake: shakeEmail }">
          <label class="input-label" for="email">邮箱</label>
          <div class="input-wrapper">
            <span class="input-icon">📧</span>
            <input 
              id="email"
              type="email" 
              v-model="email" 
              placeholder="请输入邮箱地址"
              required
              class="register-input"
              aria-required="true"
              autocomplete="email"
              @input="handleInput"
            >
          </div>
        </div>

        <div class="form-group" :class="{ shake: shakePassword }">
          <label class="input-label" for="password">密码</label>
          <div class="input-wrapper">
            <span class="input-icon">🔒</span>
            <input 
              id="password"
              :type="showPassword ? 'text' : 'password'" 
              v-model="password" 
              placeholder="请输入密码（至少6位）"
              required
              class="register-input"
              aria-required="true"
              autocomplete="new-password"
              @input="handleInput"
            >
            <span 
              class="toggle-pwd" 
              @click="showPassword = !showPassword"
              role="button"
              tabindex="0"
              aria-label="切换密码可见性"
            >{{ showPassword ? '🙈' : '👁️' }}</span>
          </div>
        </div>

        <div class="form-group" :class="{ shake: shakeConfirm }">
          <label class="input-label" for="confirmPassword">确认密码</label>
          <div class="input-wrapper">
            <span class="input-icon">🔑</span>
            <input 
              id="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'" 
              v-model="confirmPassword" 
              placeholder="请再次输入密码"
              required
              class="register-input"
              aria-required="true"
              autocomplete="new-password"
              @input="handleInput"
            >
            <span 
              class="toggle-pwd" 
              @click="showConfirmPassword = !showConfirmPassword"
              role="button"
              tabindex="0"
              aria-label="切换密码可见性"
            >{{ showConfirmPassword ? '🙈' : '👁️' }}</span>
          </div>
        </div>

        <div class="btn-wrapper">
          <button 
            type="submit" 
            :disabled="!email || !password || !confirmPassword || loading || registerSuccess" 
            class="register-btn" 
            :class="{
              'loading': loading,
              'success': registerSuccess
            }"
          >
            <span v-if="!loading && !registerSuccess" class="btn-content">
              <span class="btn-text">注册</span>
            </span>
            
            <span v-if="loading && !registerSuccess" class="btn-content loading-content">
              <span class="spinner-ring">
                <span class="spinner"></span>
              </span>
              <span class="loading-text">正在注册...</span>
            </span>
            
            <span v-if="registerSuccess" class="btn-content success-content">
              <span class="success-icon">✅</span>
              <span class="success-text">注册成功</span>
            </span>
          </button>
        </div>

        <div class="helper-links">
          <router-link to="/login" class="helper-link">已有账号？立即登录</router-link>
        </div>
      </form>
    </div>

    <div class="toast-container" v-if="showToast">
      <div class="toast" :class="{ leaving: toastLeaving }">
        {{ toastMessage }}
      </div>
    </div>

    <div class="stars-container" v-if="showStars">
      <span 
        v-for="(star, index) in fallingStars" 
        :key="index"
        class="falling-star"
        :style="{
          left: star.x + '%',
          animationDuration: star.duration + 's',
          animationDelay: star.delay + 's',
          fontSize: star.size + 'px'
        }"
      >
        {{ star.char }}
      </span>
    </div>

    <!-- ===== 注册成功弹窗（遮罩点击不关闭，防误操作） ===== -->
    <div class="success-modal-overlay" v-if="showSuccessModal">
      <div class="success-modal" role="dialog" aria-modal="true" aria-label="注册成功提示">
        <span class="modal-icon">✉️</span>
        <h2 class="modal-title">注册成功！</h2>
        <p class="modal-desc">账户已创建，完成邮箱验证即可登录</p>

        <div class="modal-email">
          <span class="email-label">📧 注册邮箱</span>
          <span class="email-value">{{ registeredEmail }}</span>
        </div>

        <div class="modal-steps">
          <div class="modal-step">
            <span class="step-badge">1</span>
            <div class="step-body">
              <span class="step-text">打开你的邮箱</span>
            </div>
          </div>
          <div class="modal-step">
            <span class="step-badge">2</span>
            <div class="step-body">
              <span class="step-text">查收验证邮件</span>
              <span class="step-tip">⚠️ 如果没收到，请去「垃圾箱」里找找</span>
            </div>
          </div>
          <div class="modal-step">
            <span class="step-badge">3</span>
            <div class="step-body">
              <span class="step-text">点击邮件中的验证链接</span>
            </div>
          </div>
        </div>

        <button class="modal-btn" @click="goToLogin">我知道了，去登录</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const registerSuccess = ref(false)

const shakeEmail = ref(false)
const shakePassword = ref(false)
const shakeConfirm = ref(false)

const showToast = ref(false)
const toastMessage = ref('')
const toastLeaving = ref(false)

const showStars = ref(false)
const fallingStars = ref([])

const floatingEmojis = ref([
  { char: '☁️', x: 8, y: 12, size: 36, duration: 7, delay: 0 },
  { char: '🌸', x: 88, y: 8, size: 28, duration: 5, delay: 1 },
  { char: '✨', x: 15, y: 45, size: 32, duration: 8, delay: 0.5 },
  { char: '🌈', x: 82, y: 72, size: 44, duration: 6, delay: 2 },
  { char: '🦋', x: 10, y: 85, size: 30, duration: 9, delay: 1.5 },
  { char: '☀️', x: 90, y: 40, size: 40, duration: 5.5, delay: 0.8 }
])

const starEmojis = ['⭐', '🌟', '✨', '🎉', '💫', '🌈']

const showErrorToast = (message) => {
  toastMessage.value = message
  showToast.value = true
  toastLeaving.value = false
  
  setTimeout(() => {
    toastLeaving.value = true
    setTimeout(() => {
      showToast.value = false
    }, 400)
  }, 2200)
}

const showSuccessModal = ref(false)
const registeredEmail = ref('')

const goToLogin = () => {
  showSuccessModal.value = false
  router.push('/login')
}

const triggerShake = () => {
  shakeEmail.value = true
  shakePassword.value = true
  shakeConfirm.value = true
  setTimeout(() => {
    shakeEmail.value = false
    shakePassword.value = false
    shakeConfirm.value = false
  }, 600)
}

const createStarsRain = () => {
  showStars.value = true
  fallingStars.value = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    char: starEmojis[Math.floor(Math.random() * starEmojis.length)],
    x: 5 + Math.random() * 90,
    duration: 2 + Math.random() * 2,
    delay: Math.random() * 0.8,
    size: 20 + Math.random() * 20
  }))
  
  setTimeout(() => {
    showStars.value = false
  }, 3500)
}

const handleInput = () => {
  if (registerSuccess.value) {
    registerSuccess.value = false
  }
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const handleRegister = async () => {
  registerSuccess.value = false
  
  if (!email.value) {
    shakeEmail.value = true
    setTimeout(() => { shakeEmail.value = false }, 600)
    showErrorToast('请输入邮箱地址')
    return
  }

  if (!emailRegex.test(email.value)) {
    shakeEmail.value = true
    setTimeout(() => { shakeEmail.value = false }, 600)
    showErrorToast('请输入有效的邮箱地址')
    return
  }

  if (password.value.length < 6) {
    shakePassword.value = true
    setTimeout(() => { shakePassword.value = false }, 600)
    showErrorToast('密码至少需要6位')
    return
  }

  if (password.value !== confirmPassword.value) {
    shakeConfirm.value = true
    setTimeout(() => { shakeConfirm.value = false }, 600)
    showErrorToast('两次输入的密码不一致')
    return
  }

  loading.value = true

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || '注册失败')
    }

    loading.value = false
    registerSuccess.value = true

    registeredEmail.value = email.value
    createStarsRain()
    showSuccessModal.value = true

    email.value = ''
    password.value = ''
    confirmPassword.value = ''

  } catch (error) {
    loading.value = false
    triggerShake()
    showErrorToast(error.message || '注册失败，请重试')
  }
}

onMounted(() => {
  registerSuccess.value = false
  loading.value = false
  email.value = ''
  password.value = ''
  confirmPassword.value = ''
  showPassword.value = false
  showConfirmPassword.value = false
  showToast.value = false
  showStars.value = false
  showSuccessModal.value = false
  registeredEmail.value = ''
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #E8F5E9 0%, #DCEDC8 40%, #C8E6C9 100%);
  position: relative;
  overflow: hidden;
  font-family: 'PingFang SC', -apple-system, sans-serif;
}

.floating-emojis {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.floating-emoji {
  position: absolute;
  opacity: 0.25;
  animation: float ease-in-out infinite;
  will-change: transform;
}

@keyframes float {
  0%, 100% { 
    transform: translateY(0) rotate(-10deg); 
  }
  50% { 
    transform: translateY(-20px) rotate(10deg); 
  }
}

.login-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 400px;
  padding: 48px 40px 40px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: 40px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 
    0 20px 60px rgba(76, 175, 80, 0.15),
    0 8px 20px rgba(76, 175, 80, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  animation: cardEntrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  opacity: 0;
  transform: translateY(40px) scale(0.8);
}

@keyframes cardEntrance {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.card-top-emoji {
  text-align: center;
  font-size: 52px;
  margin-bottom: 16px;
  animation: sway 3s ease-in-out infinite;
  display: block;
}

@keyframes sway {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}

h1 {
  text-align: center;
  font-size: 26px;
  font-weight: 700;
  color: #2D1B3D;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}

.wave-hand {
  display: inline-block;
  transform-origin: 70% bottom;
  animation: wave 2.5s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { transform: rotate(-20deg); }
  50% { transform: rotate(20deg); }
}

.subtitle {
  text-align: center;
  color: #7C6B8A;
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 32px;
}

.form-group {
  margin-bottom: 18px;
}

.input-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #2D1B3D;
  margin-bottom: 6px;
}

.input-wrapper {
  position: relative;
  animation: inputSlideIn 0.6s ease-out forwards;
  opacity: 0;
  transform: translateY(20px);
}

.form-group:nth-child(1) .input-wrapper {
  animation-delay: 0.2s;
}

.form-group:nth-child(2) .input-wrapper {
  animation-delay: 0.35s;
}

.form-group:nth-child(3) .input-wrapper {
  animation-delay: 0.5s;
}

@keyframes inputSlideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.register-input {
  width: 100%;
  height: 56px;
  padding: 0 48px 0 48px;
  background: rgba(255, 255, 255, 0.7);
  border: 2.5px solid rgba(124, 58, 237, 0.15);
  border-radius: 20px;
  font-size: 15px;
  color: #2D1B3D;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  font-family: inherit;
}

.register-input::placeholder {
  color: rgba(45, 27, 61, 0.3);
  font-weight: 400;
}

.register-input:focus {
  outline: none;
  border-color: #4CAF50;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 8px rgba(76, 175, 80, 0.08);
  transform: scale(1.02);
}

.input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  color: rgba(45, 27, 61, 0.35);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
  z-index: 2;
}

.input-wrapper:focus-within .input-icon {
  color: #4CAF50;
  transform: translateY(-50%) rotate(-5deg) scale(1.1);
}

.toggle-pwd {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  color: rgba(45, 27, 61, 0.35);
  cursor: pointer;
  transition: all 0.3s ease;
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 50%;
  z-index: 2;
}

.toggle-pwd:hover {
  color: #4CAF50;
  background: rgba(76, 175, 80, 0.08);
  transform: translateY(-50%) scale(1.15);
}

.toggle-pwd:active {
  transform: translateY(-50%) scale(0.9);
}

.form-group.shake .input-wrapper {
  animation: shake 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-12px); }
  40% { transform: translateX(12px); }
  60% { transform: translateX(-8px); }
  80% { transform: translateX(8px); }
  90% { transform: translateX(-4px); }
}

.btn-wrapper {
  height: 56px;
  margin-top: 12px;
  position: relative;
}

.register-btn {
  width: 100%;
  height: 56px;
  background: linear-gradient(135deg, #66BB6A, #43A047);
  border: none;
  border-radius: 100px;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 30px rgba(76, 175, 80, 0.35);
  transition: background 0.4s ease, box-shadow 0.4s ease, opacity 0.4s ease;
  animation: btnSlideIn 0.6s ease-out forwards;
  opacity: 0;
  transform: translateY(20px);
  animation-delay: 0.65s;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 1px;
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
}

@keyframes btnSlideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.register-btn:hover:not(:disabled) {
  box-shadow: 0 12px 40px rgba(76, 175, 80, 0.45);
}

.register-btn:active:not(:disabled) {
  transform: scale(0.98);
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.25);
}

.register-btn:disabled {
  background: linear-gradient(135deg, #C8E6C9, #A5D6A7);
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.6;
}

.register-btn.loading {
  background: linear-gradient(135deg, #4CAF50, #388E3C);
  box-shadow: 0 8px 30px rgba(76, 175, 80, 0.5);
}

.register-btn.success {
  background: linear-gradient(135deg, #34D399, #059669);
  box-shadow: 0 8px 30px rgba(52, 211, 153, 0.4);
  animation: successPulse 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes successPulse {
  0% { transform: scale(1); }
  30% { transform: scale(1.05); }
  60% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  z-index: 2;
}

.loading-content {
  gap: 12px;
}

.spinner-ring {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 16px;
  font-weight: 600;
}

.success-content {
  gap: 10px;
}

.success-icon {
  font-size: 22px;
  animation: successIconBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes successIconBounce {
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); }
}

.success-text {
  font-size: 16px;
  font-weight: 600;
}

.helper-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
  animation: linksSlideIn 0.6s ease-out forwards;
  opacity: 0;
  transform: translateY(20px);
  animation-delay: 0.8s;
}

@keyframes linksSlideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.helper-link {
  font-size: 14px;
  color: rgba(45, 27, 61, 0.4);
  text-decoration: none;
  transition: all 0.3s ease;
  font-weight: 500;
}

.helper-link:hover {
  color: #6D28D9;
}

.toast-container {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.toast {
  background: rgba(239, 68, 68, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 14px 28px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);
  animation: toastEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes toastEnter {
  from {
    opacity: 0;
    transform: translateY(-40px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.toast.leaving {
  animation: toastLeave 0.4s ease-out forwards;
}

@keyframes toastLeave {
  to {
    opacity: 0;
    transform: translateY(-20px);
  }
}

/* ===== 注册成功弹窗 ===== */
.success-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(30, 27, 45, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: overlayFadeIn 0.3s ease forwards;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.success-modal {
  width: 100%;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: 28px;
  padding: 32px 28px 26px;
  box-shadow: 0 24px 60px rgba(45, 27, 61, 0.25);
  animation: modalPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes modalPopIn {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.85);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-icon {
  display: block;
  text-align: center;
  font-size: 46px;
  animation: modalIconBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalIconBounce {
  0% { transform: scale(0) rotate(-15deg); opacity: 0; }
  60% { transform: scale(1.15) rotate(8deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); }
}

.modal-title {
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  color: #2D1B3D;
  margin: 10px 0 4px;
}

.modal-desc {
  text-align: center;
  font-size: 14px;
  color: #7C6B8A;
  margin-bottom: 16px;
}

.modal-email {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  background: rgba(76, 175, 80, 0.08);
  border: 1.5px dashed rgba(76, 175, 80, 0.4);
  border-radius: 12px;
  padding: 10px 14px;
}

.email-label {
  font-size: 13px;
  font-weight: 500;
  color: #7C6B8A;
}

.email-value {
  font-size: 14px;
  font-weight: 700;
  color: #2D1B3D;
  word-break: break-all;
}

.modal-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
}

.modal-step {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(124, 58, 237, 0.05);
  border: 1.5px solid rgba(124, 58, 237, 0.12);
  border-radius: 14px;
  padding: 12px 14px;
}

.step-badge {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7C3AED, #A78BFA);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.step-text {
  font-size: 14px;
  font-weight: 600;
  color: #2D1B3D;
}

.step-tip {
  font-size: 12px;
  font-weight: 500;
  color: #F59E0B;
}

.modal-btn {
  width: 100%;
  height: 50px;
  margin-top: 24px;
  border: none;
  border-radius: 100px;
  background: linear-gradient(135deg, #66BB6A, #43A047);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.35);
  transition: all 0.3s ease;
  font-family: inherit;
}

.modal-btn:hover {
  box-shadow: 0 12px 32px rgba(76, 175, 80, 0.45);
  transform: translateY(-1px);
}

.modal-btn:active {
  transform: scale(0.97);
}

.stars-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}

.falling-star {
  position: absolute;
  top: -50px;
  animation: starFall linear forwards;
}

@keyframes starFall {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg) scale(0.2);
    opacity: 0;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 36px 24px 32px;
    margin: 16px;
    border-radius: 32px;
  }

  h1 {
    font-size: 22px;
  }

  .card-top-emoji {
    font-size: 44px;
  }

  .register-input {
    height: 50px;
    padding: 0 44px 0 44px;
    font-size: 14px;
  }

  .input-icon {
    font-size: 18px;
    left: 14px;
  }

  .toggle-pwd {
    font-size: 18px;
    right: 14px;
  }

  .btn-wrapper {
    height: 50px;
  }

  .register-btn {
    height: 50px;
    font-size: 16px;
  }

  .subtitle {
    font-size: 14px;
  }

  /* 弹窗：手机端收窄内边距与圆角 */
  .success-modal {
    padding: 28px 20px 22px;
    border-radius: 24px;
  }
}
</style>
