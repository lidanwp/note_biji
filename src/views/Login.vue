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
          <label class="input-label" for="username">账号</label>
          <div class="input-wrapper">
            <span class="input-icon">👤</span>
            <input 
              id="username"
              type="text" 
              v-model="username" 
              placeholder="请输入账号"
              required
              class="login-input"
              aria-required="true"
              autocomplete="username"
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
              placeholder="请输入密码"
              required
              class="login-input"
              aria-required="true"
              autocomplete="current-password"
              @input="handleInput"
            >
            <span 
              class="toggle-pwd" 
              @click="showPassword = !showPassword"
              @keydown.enter.prevent="showPassword = !showPassword"
              @keydown.space.prevent="showPassword = !showPassword"
              role="button"
              tabindex="0"
              aria-label="切换密码可见性"
            >{{ showPassword ? '🙈' : '👁️' }}</span>
          </div>
        </div>

        <!-- 按钮容器 - 固定高度防止布局抖动 -->
        <div class="btn-wrapper">
          <button 
            type="submit" 
            :disabled="!username || !password || loading || loginSuccess" 
            class="login-btn" 
            :class="{
              'loading': loading,
              'success': loginSuccess
            }"
          >
            <!-- 默认状态 -->
            <span v-if="!loading && !loginSuccess" class="btn-content">
              <span class="btn-text">登录</span>
            </span>
            
            <!-- 加载状态 -->
            <span v-if="loading && !loginSuccess" class="btn-content loading-content">
              <span class="spinner-ring">
                <span class="spinner"></span>
              </span>
              <span class="loading-text">正在登录...</span>
            </span>
            
            <!-- 成功状态 -->
            <span v-if="loginSuccess" class="btn-content success-content">
              <span class="success-icon">✅</span>
              <span class="success-text">登录成功</span>
            </span>
          </button>
        </div>

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

// 根据后端返回的角色配置路由映射
const roleRouteMap = {
  // 这些key值应该与后端返回的角色字段值完全一致
  'admin': '/admin',
  'administrator': '/admin',  // 如果后端用 administrator
  'manager': '/admin',        // 或者 manager
  'viewer': '/viewer',
  'user': '/viewer',          // 或者 user
  'guest': '/viewer'          // 或者 guest
  // 根据实际后端返回的角色值添加更多映射
}

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
  // 输入时重置成功状态
  if (loginSuccess.value) {
    loginSuccess.value = false
  }
}

const navigateByRole = (role) => {
  // 1. 直接使用角色映射
  const route = roleRouteMap[role]
  if (route) {
    router.push(route)
    return
  }
  
  // 2. 如果映射表中没有，但角色包含 'admin' 或 'viewer' 关键字
  if (role && typeof role === 'string') {
    const lowerRole = role.toLowerCase()
    if (lowerRole.includes('admin') || lowerRole.includes('manager')) {
      router.push('/admin')
      return
    }
    if (lowerRole.includes('viewer') || lowerRole.includes('user') || lowerRole.includes('guest')) {
      router.push('/viewer')
      return
    }
  }
  
  // 3. 默认跳转到 viewer
  console.warn('未知角色:', role, '，使用默认跳转')
  router.push('/viewer')
}

const handleLogin = async () => {
  if (!username.value || !password.value) {
    triggerShake()
    showErrorToast('请输入账号和密码')
    return
  }

  // 重置状态
  loading.value = true
  loginSuccess.value = false

  try {
    const result = await authStore.login(username.value, password.value)

    if (result.success) {
      // 登录成功：先关闭加载状态，再显示成功状态
      loading.value = false
      loginSuccess.value = true
      
      createStarsRain()
      
      // 延迟跳转，根据后端返回的角色动态路由
      setTimeout(() => {
        navigateByRole(result.role)
      }, 1500)
    } else {
      // 登录失败：关闭加载状态
      loading.value = false
      triggerShake()
      showErrorToast(result.message)
    }
  } catch (e) {
    // 发生错误：关闭加载状态
    loading.value = false
    triggerShake()
    showErrorToast('登录过程中发生错误，请重试')
  }
}

onMounted(() => {
  // 如果是从其他页面返回，重置所有状态
  loginSuccess.value = false
  loading.value = false
  username.value = ''
  password.value = ''
  showPassword.value = false
  showToast.value = false
  showStars.value = false
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
  background: linear-gradient(135deg, #FFE8F0 0%, #E8D5F5 40%, #D5E8F5 100%);
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
    0 20px 60px rgba(124, 58, 237, 0.15),
    0 8px 20px rgba(124, 58, 237, 0.08),
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

@keyframes inputSlideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-input {
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

.login-input::placeholder {
  color: rgba(45, 27, 61, 0.3);
  font-weight: 400;
}

.login-input:focus {
  outline: none;
  border-color: #7C3AED;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 8px rgba(124, 58, 237, 0.08);
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
  color: #7C3AED;
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
  color: #7C3AED;
  background: rgba(124, 58, 237, 0.08);
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

/* ===== 按钮包装器 - 固定高度防止布局抖动 ===== */
.btn-wrapper {
  height: 56px;
  margin-top: 12px;
  position: relative;
}

/* ===== 登录按钮样式 ===== */
.login-btn {
  width: 100%;
  height: 56px;
  background: linear-gradient(135deg, #8B5CF6, #6D28D9);
  border: none;
  border-radius: 100px;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 30px rgba(124, 58, 237, 0.35);
  transition: background 0.4s ease, box-shadow 0.4s ease, opacity 0.4s ease;
  animation: btnSlideIn 0.6s ease-out forwards;
  opacity: 0;
  transform: translateY(20px);
  animation-delay: 0.5s;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 1px;
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  will-change: background, box-shadow, opacity;
}

@keyframes btnSlideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 按钮背景光效 */
.login-btn::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.6s ease;
}

.login-btn:hover:not(:disabled)::before {
  opacity: 1;
}

/* 禁用 hover 效果 */
.login-btn:disabled::before {
  display: none;
}

/* 移除所有 transform 相关的 hover/active 效果，防止跳动 */
.login-btn:hover:not(:disabled) {
  box-shadow: 0 12px 40px rgba(124, 58, 237, 0.45);
  transform: translateY(0);
}

.login-btn:active:not(:disabled) {
  transform: scale(1);
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.25);
}

.login-btn:disabled {
  background: linear-gradient(135deg, #C4B5D4, #A78BFA);
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.6;
  transform: translateY(0) scale(1);
}

/* ===== 加载状态 ===== */
.login-btn.loading {
  background: linear-gradient(135deg, #7C3AED, #5B21B6);
  box-shadow: 0 8px 30px rgba(124, 58, 237, 0.5);
  animation: loadingPulse 1.8s ease-in-out infinite;
  cursor: default;
  transform: translateY(0) scale(1);
}

@keyframes loadingPulse {
  0%, 100% {
    box-shadow: 0 8px 30px rgba(124, 58, 237, 0.5);
    transform: translateY(0) scale(1);
  }
  50% {
    box-shadow: 0 8px 50px rgba(124, 58, 237, 0.7), 0 0 80px rgba(124, 58, 237, 0.2);
    transform: translateY(0) scale(1);
  }
}

/* 加载进度条 */
.login-btn.loading::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, #A78BFA, #EC4899, #A78BFA);
  background-size: 200% 100%;
  border-radius: 0 0 100px 100px;
  animation: progressBar 2s ease-in-out infinite;
}

@keyframes progressBar {
  0% {
    width: 0%;
    background-position: 0% 0%;
  }
  50% {
    width: 70%;
    background-position: 50% 0%;
  }
  100% {
    width: 100%;
    background-position: 100% 0%;
  }
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  z-index: 2;
  white-space: nowrap;
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
  flex-shrink: 0;
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
  letter-spacing: 0.5px;
  animation: loadingTextPulse 1.2s ease-in-out infinite;
}

@keyframes loadingTextPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* ===== 成功状态 ===== */
.login-btn.success {
  background: linear-gradient(135deg, #34D399, #059669);
  box-shadow: 0 8px 30px rgba(52, 211, 153, 0.4);
  cursor: default;
  transform: translateY(0) scale(1);
  animation: successPulse 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes successPulse {
  0% { transform: scale(1); }
  30% { transform: scale(1.05); }
  60% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.login-btn.success::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, #34D399, #6EE7B7, #34D399);
  border-radius: 0 0 100px 100px;
}

.success-content {
  gap: 10px;
}

.success-icon {
  font-size: 22px;
  animation: successIconBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  flex-shrink: 0;
}

@keyframes successIconBounce {
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); }
}

.success-text {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* ===== 其他样式 ===== */
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
  font-size: 14px;
  color: rgba(45, 27, 61, 0.4);
  text-decoration: none;
  transition: all 0.3s ease;
  font-weight: 500;
}

.helper-link:hover {
  color: #6D28D9;
}

.register-link {
  color: #7C3AED;
  font-weight: 700;
  background: linear-gradient(135deg, #7C3AED, #6D28D9);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.register-link:hover {
  transform: scale(1.05);
  background: linear-gradient(135deg, #8B5CF6, #EC4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.dot-divider {
  font-size: 4px;
  color: rgba(45, 27, 61, 0.15);
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

  .login-input {
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

  .login-btn {
    height: 50px;
    font-size: 16px;
  }

  .subtitle {
    font-size: 14px;
  }
}
</style>