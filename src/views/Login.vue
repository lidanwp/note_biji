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
      <div class="card-top-emoji">🌸</div>

      <h1>Hi，欢迎回来 <span class="wave-hand">👋</span></h1>
      <p class="subtitle">今天也想和你一起记录美好 ✨</p>

      <form @submit.prevent="handleLogin">
        <div class="form-group" :class="{ shake: shakeUsername }">
          <label class="input-label">账号</label>
          <div class="input-wrapper">
            <span class="input-icon">👤</span>
            <input 
              type="text" 
              v-model="username" 
              placeholder="请输入账号"
              required
              class="login-input"
              @input="handleInput"
            >
          </div>
        </div>

        <div class="form-group" :class="{ shake: shakePassword }">
          <label class="input-label">密码</label>
          <div class="input-wrapper">
            <span class="input-icon">🔒</span>
            <input 
              :type="showPassword ? 'text' : 'password'" 
              v-model="password" 
              placeholder="请输入密码"
              required
              class="login-input"
            >
            <span class="toggle-pwd" @click="showPassword = !showPassword">👁️</span>
          </div>
        </div>

        <button type="submit" :disabled="!username || !password || loading" class="login-btn">
          <span v-if="loginSuccess" class="btn-success">✅</span>
          <span v-else-if="loading" class="btn-loading">
            <span class="spinner"></span>
          </span>
          <span v-else class="btn-text">登录</span>
        </button>

        <div class="helper-links">
          <a href="#" class="helper-link">忘记密码？</a>
          <span class="dot-divider">·</span>
          <a href="#" class="helper-link register-link">注册新账号</a>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const loginSuccess = ref(false)

const shakeUsername = ref(false)
const shakePassword = ref(false)

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

const triggerShake = () => {
  shakeUsername.value = true
  shakePassword.value = true
  setTimeout(() => {
    shakeUsername.value = false
    shakePassword.value = false
  }, 600)
}

const createStarsRain = () => {
  showStars.value = true
  fallingStars.value = Array.from({ length: 7 }, (_, i) => ({
    id: i,
    char: starEmojis[Math.floor(Math.random() * starEmojis.length)],
    x: 5 + Math.random() * 90,
    duration: 2 + Math.random(),
    delay: Math.random() * 0.5,
    size: 24 + Math.random() * 16
  }))
  
  setTimeout(() => {
    showStars.value = false
  }, 3500)
}

const handleInput = () => {
}

const handleLogin = async () => {
  if (!username.value || !password.value) {
    triggerShake()
    showErrorToast('请输入账号和密码')
    return
  }

  loading.value = true
  loginSuccess.value = false

  try {
    const result = await authStore.login(username.value, password.value)

    if (result.success) {
      loginSuccess.value = true
      createStarsRain()
      setTimeout(() => {
        if (result.role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/viewer')
        }
      }, 1000)
    } else {
      triggerShake()
      showErrorToast(result.message)
    }
  } catch (e) {
    triggerShake()
    showErrorToast('登录过程中发生错误，请重试')
  } finally {
    if (!loginSuccess.value) {
      loading.value = false
    }
  }
}

onMounted(() => {
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
  background: linear-gradient(180deg, #FFF5F5 0%, #F0E6FF 50%, #E6F0FF 100%);
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
  opacity: 0.3;
  animation: float ease-in-out infinite;
}

@keyframes float {
  0%, 100% { 
    transform: translateY(0) rotate(-5deg); 
  }
  50% { 
    transform: translateY(-20px) rotate(5deg); 
  }
}

.login-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 400px;
  padding: 48px 40px 40px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: 40px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 
    0 20px 60px rgba(124, 58, 237, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
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
  font-size: 48px;
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
  font-size: 24px;
  font-weight: 700;
  color: #2D1B3D;
  margin-bottom: 4px;
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
  color: rgba(45, 27, 61, 0.4);
  font-size: 14px;
  font-weight: 400;
  margin-bottom: 32px;
}

.form-group {
  margin-bottom: 16px;
}

.input-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #2D1B3D;
  margin-bottom: 5px;
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

@keyframes inputSlideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-input {
  width: 100%;
  height: 54px;
  padding: 0 16px 0 46px;
  background: rgba(255, 255, 255, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  font-size: 15px;
  color: #2D1B3D;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  font-family: inherit;
}

.login-input::placeholder {
  color: rgba(45, 27, 61, 0.2);
}

.login-input:focus {
  outline: none;
  border-color: #A78BFA;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 0 8px rgba(167, 139, 250, 0.1);
  transform: scale(1.02);
}

.login-input:focus + .input-icon {
  color: #7C3AED;
  transform: rotate(-5deg);
}

.input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: rgba(45, 27, 61, 0.2);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}

.toggle-pwd {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: rgba(45, 27, 61, 0.2);
  cursor: pointer;
  transition: color 0.3s;
  background: transparent;
  border: none;
}

.toggle-pwd:hover {
  color: rgba(45, 27, 61, 0.5);
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

.login-btn {
  width: 100%;
  height: 54px;
  margin-top: 12px;
  background: linear-gradient(135deg, #A78BFA, #7C3AED);
  border: none;
  border-radius: 100px;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 30px rgba(124, 58, 237, 0.25);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: btnSlideIn 0.6s ease-out forwards;
  opacity: 0;
  transform: translateY(20px);
  animation-delay: 0.5s;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes btnSlideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(124, 58, 237, 0.3);
}

.login-btn:active:not(:disabled) {
  transform: scale(0.92);
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.15);
}

.login-btn:disabled {
  background: rgba(200, 180, 210, 0.6);
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-text {
  position: relative;
  z-index: 2;
}

.btn-loading {
  position: relative;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-success {
  font-size: 24px;
  animation: successPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transform: scale(0);
}

@keyframes successPop {
  to { transform: scale(1); }
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
  animation-delay: 0.7s;
}

@keyframes linksSlideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.helper-link {
  font-size: 13px;
  color: rgba(45, 27, 61, 0.35);
  text-decoration: none;
  transition: color 0.3s;
}

.helper-link:hover {
  color: rgba(45, 27, 61, 0.6);
}

.register-link {
  color: #7C3AED;
  font-weight: 600;
}

.register-link:hover {
  color: #FF6BB5;
}

.dot-divider {
  font-size: 4px;
  color: rgba(45, 27, 61, 0.1);
}

.toast-container {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.toast {
  background: rgba(255, 71, 87, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 14px 28px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(255, 71, 87, 0.3);
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
    font-size: 40px;
  }
}
</style>