<template>
  <div class="login-container">
    <!-- 动态粒子背景 -->
    <div class="particles-bg"></div>
    
    <!-- 网格线效果 -->
    <div class="grid-overlay"></div>

    <!-- 登录卡片 -->
    <div class="login-card">
      <!-- 装饰光效 -->
      <div class="glow-orb glow-orb-1"></div>
      <div class="glow-orb glow-orb-2"></div>

      <div class="logo-icon">⚡</div>
      <h1>笔记分享平台</h1>
      <p class="subtitle">系统集成 & 项目管理</p>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>
            <span class="label-icon">👤</span>
            账号
          </label>
          <input 
            type="text" 
            v-model="username" 
            placeholder="请输入账号"
            required
            class="tech-input"
          >
          <div class="input-line"></div>
        </div>

        <div class="form-group">
          <label>
            <span class="label-icon">🔒</span>
            密码
          </label>
          <div class="password-wrapper">
            <input 
              :type="showPassword ? 'text' : 'password'" 
              v-model="password" 
              placeholder="请输入密码"
              required
              class="tech-input"
            >
            <span class="toggle-pwd" @click="showPassword = !showPassword">
              {{ showPassword ? '🙈' : '👁️' }}
            </span>
          </div>
          <div class="input-line"></div>
        </div>

        <button type="submit" :disabled="loading" class="tech-btn">
          <span class="btn-text">{{ loading ? '登录中...' : '登 录' }}</span>
          <span class="btn-glow"></span>
        </button>

        <div v-if="error" class="error">
          <span class="error-icon">⚠️</span>
          {{ error }}
        </div>
      </form>

      <!-- 底部装饰 -->
      <div class="footer-decoration">
        <span class="dot"></span>
        <span class="line"></span>
        <span class="dot"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    const result = await authStore.login(username.value, password.value)

    if (result.success) {
      if (result.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/viewer')
      }
    } else {
      error.value = result.message
    }
  } catch (e) {
    error.value = '登录过程中发生错误，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ===== 基础重置 ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* ===== 容器 ===== */
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0e1a;
  position: relative;
  overflow: hidden;
  font-family: 'Segoe UI', 'PingFang SC', sans-serif;
}

/* ===== 粒子背景 ===== */
.particles-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    radial-gradient(circle at 20% 50%, rgba(0, 212, 255, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(138, 43, 226, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 50% 80%, rgba(0, 212, 255, 0.03) 0%, transparent 50%);
  animation: particleFloat 20s ease-in-out infinite alternate;
}

@keyframes particleFloat {
  0% { transform: scale(1) rotate(0deg); }
  100% { transform: scale(1.2) rotate(3deg); }
}

/* ===== 网格线 ===== */
.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
}

/* ===== 登录卡片 ===== */
.login-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 420px;
  padding: 48px 40px 40px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(0, 212, 255, 0.15);
  box-shadow: 
    0 30px 80px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* ===== 装饰光晕 ===== */
.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  pointer-events: none;
}

.glow-orb-1 {
  width: 200px;
  height: 200px;
  top: -80px;
  right: -60px;
  background: rgba(0, 212, 255, 0.15);
}

.glow-orb-2 {
  width: 150px;
  height: 150px;
  bottom: -60px;
  left: -50px;
  background: rgba(138, 43, 226, 0.15);
}

/* ===== Logo ===== */
.logo-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 8px;
  display: block;
  filter: drop-shadow(0 0 20px rgba(0, 212, 255, 0.3));
}

/* ===== 标题 ===== */
h1 {
  text-align: center;
  font-size: 26px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
  letter-spacing: 2px;
  text-shadow: 0 0 30px rgba(0, 212, 255, 0.2);
}

.subtitle {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  letter-spacing: 4px;
  margin-bottom: 36px;
  font-weight: 300;
}

/* ===== 表单 ===== */
.form-group {
  margin-bottom: 28px;
  position: relative;
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.label-icon {
  font-size: 14px;
}

/* ===== 输入框 ===== */
.tech-input {
  width: 100%;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  font-size: 15px;
  color: #fff;
  transition: all 0.3s ease;
  box-sizing: border-box;
  font-family: inherit;
}

.tech-input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.tech-input:focus {
  outline: none;
  border-color: rgba(0, 212, 255, 0.4);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 30px rgba(0, 212, 255, 0.05);
}

/* ===== 输入框底部发光线条 ===== */
.input-line {
  height: 2px;
  width: 0;
  background: linear-gradient(90deg, transparent, #00d4ff, transparent);
  transition: width 0.4s ease;
  margin-top: 4px;
}

.tech-input:focus ~ .input-line {
  width: 100%;
}

/* ===== 密码切换 ===== */
.password-wrapper {
  position: relative;
}

.password-wrapper .tech-input {
  padding-right: 48px;
}

.toggle-pwd {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  font-size: 18px;
  opacity: 0.4;
  transition: opacity 0.3s;
  background: transparent;
  border: none;
}

.toggle-pwd:hover {
  opacity: 0.8;
}

/* ===== 按钮 ===== */
.tech-btn {
  position: relative;
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #00d4ff 0%, #7b2ffc 100%);
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
  letter-spacing: 2px;
  margin-top: 8px;
}

.tech-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 40px rgba(0, 212, 255, 0.25);
}

.tech-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-text {
  position: relative;
  z-index: 2;
}

.btn-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.1) 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.5s ease;
}

.tech-btn:hover:not(:disabled) .btn-glow {
  opacity: 1;
}

/* ===== 错误信息 ===== */
.error {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(255, 0, 0, 0.08);
  border: 1px solid rgba(255, 0, 0, 0.15);
  border-radius: 8px;
  color: #ff6b6b;
  font-size: 14px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.error-icon {
  font-size: 16px;
}

/* ===== 底部装饰 ===== */
.footer-decoration {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
}

.footer-decoration .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(0, 212, 255, 0.2);
}

.footer-decoration .line {
  flex: 1;
  max-width: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.2), transparent);
}

/* ===== 响应式 ===== */
@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px 28px;
    margin: 16px;
    border-radius: 16px;
  }

  h1 {
    font-size: 20px;
  }

  .logo-icon {
    font-size: 36px;
  }
}
</style>