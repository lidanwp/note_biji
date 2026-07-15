<template>
  <div class="settings-panel">
    <div class="settings-header">
      <h4>⚙️ 阅读设置</h4>
      <button @click="emit('close')" class="btn-close">✕</button>
    </div>

    <!-- 主题切换 -->
    <div class="setting-group">
      <label>🌓 主题模式</label>
      <div class="theme-options">
        <button
          v-for="t in themeOptions"
          :key="t.value"
          class="theme-btn"
          :class="{ active: themeStore.theme === t.value }"
          @click="themeStore.setTheme(t.value)"
        >
          <span>{{ t.icon }}</span>
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- 字体大小 -->
    <div class="setting-group">
      <label>📏 字体大小</label>
      <div class="size-options">
        <button
          v-for="s in sizeOptions"
          :key="s.value"
          class="size-btn"
          :class="{ active: themeStore.fontSize === s.value }"
          @click="themeStore.setFontSize(s.value)"
        >
          <span :style="{ fontSize: s.previewSize }">Aa</span>
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- 行间距 -->
    <div class="setting-group">
      <label>📐 行间距</label>
      <div class="line-options">
        <button
          v-for="l in lineOptions"
          :key="l.value"
          class="line-btn"
          :class="{ active: themeStore.lineHeight === l.value }"
          @click="themeStore.setLineHeight(l.value)"
        >
          <span class="line-preview" :style="{ lineHeight: l.preview }">
            <span>行</span>
            <span>高</span>
          </span>
          {{ l.label }}
        </button>
      </div>
    </div>

    <!-- 字体家族 -->
    <div class="setting-group">
      <label>🔤 字体风格</label>
      <div class="font-options">
        <button
          v-for="f in fontOptions"
          :key="f.value"
          class="font-btn"
          :class="{ active: themeStore.fontFamily === f.value }"
          @click="themeStore.setFontFamily(f.value)"
          :style="{ fontFamily: f.fontFamily }"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <!-- 预览 -->
    <div class="preview-box">
      <p class="preview-text">
        这是一个预览文本，用来展示当前的阅读设置效果。<br />
        你可以调整以上选项，找到最舒适的阅读体验。
      </p>
    </div>

    <!-- 重置按钮 -->
    <div class="settings-footer">
      <button @click="resetSettings" class="btn-reset">🔄 恢复默认设置</button>
    </div>
  </div>
</template>

<script setup>
import { useThemeStore } from '@/stores/theme'

// ===== 定义事件 =====
const emit = defineEmits(['close'])

// ===== Store =====
const themeStore = useThemeStore()

// ===== 配置选项 =====
const themeOptions = [
  { value: 'light', label: '亮色', icon: '☀️' },
  { value: 'dark', label: '暗色', icon: '🌙' }
]

const sizeOptions = [
  { value: 'small', label: '小', previewSize: '12px' },
  { value: 'medium', label: '中', previewSize: '16px' },
  { value: 'large', label: '大', previewSize: '20px' }
]

const lineOptions = [
  { value: 'compact', label: '紧凑', preview: '1.2' },
  { value: 'comfortable', label: '舒适', preview: '1.7' },
  { value: 'relaxed', label: '宽松', preview: '2.2' }
]

const fontOptions = [
  { value: 'default', label: '系统', fontFamily: '-apple-system, sans-serif' },
  { value: 'serif', label: '衬线', fontFamily: 'Georgia, "Times New Roman", serif' },
  { value: 'mono', label: '等宽', fontFamily: '"Fira Code", "JetBrains Mono", monospace' }
]

// ===== 重置方法 =====
const resetSettings = () => {
  if (confirm('确定要恢复所有设置为默认值吗？')) {
    themeStore.setTheme('light')
    themeStore.setFontSize('medium')
    themeStore.setLineHeight('comfortable')
    themeStore.setFontFamily('default')
    themeStore.applyTheme()
  }
}
</script>

<style scoped>
.settings-panel {
  padding: 20px 24px;
  background: var(--bg-secondary, #ffffff);
  border-radius: 14px;
  border: 1px solid var(--border-color, #e8ecf1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  animation: slideDown 0.3s ease;
  max-width: 480px;
  width: 100%;
}

/* ===== 动画 ===== */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ===== 头部 ===== */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.settings-header h4 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.btn-close {
  font-size: 18px;
  color: var(--text-muted, #999);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--text-primary, #333);
}

/* ===== 设置组 ===== */
.setting-group {
  margin-bottom: 20px;
}

.setting-group:last-of-type {
  margin-bottom: 16px;
}

.setting-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, #888);
  margin-bottom: 8px;
  letter-spacing: 0.3px;
}

/* ===== 选项按钮容器 ===== */
.theme-options,
.size-options,
.line-options,
.font-options {
  display: flex;
  gap: 8px;
}

.theme-options {
  gap: 12px;
}

/* ===== 主题按钮 ===== */
.theme-btn {
  flex: 1;
  padding: 10px 16px;
  border: 2px solid var(--border-color, #e8ecf1);
  border-radius: 10px;
  background: var(--bg-primary, #f5f7fa);
  color: var(--text-secondary, #555);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.theme-btn:hover {
  border-color: var(--accent-color, #667eea);
  transform: translateY(-1px);
}

.theme-btn.active {
  border-color: var(--accent-color, #667eea);
  background: var(--accent-light, rgba(102, 126, 234, 0.12));
  color: var(--accent-color, #667eea);
  box-shadow: 0 0 0 4px var(--accent-light, rgba(102, 126, 234, 0.08));
}

.theme-btn span {
  font-size: 18px;
}

/* ===== 字体大小按钮 ===== */
.size-btn {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid var(--border-color, #e8ecf1);
  border-radius: 10px;
  background: var(--bg-primary, #f5f7fa);
  color: var(--text-secondary, #555);
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-weight: 500;
}

.size-btn:hover {
  border-color: var(--accent-color, #667eea);
}

.size-btn.active {
  border-color: var(--accent-color, #667eea);
  background: var(--accent-light, rgba(102, 126, 234, 0.12));
  color: var(--accent-color, #667eea);
  box-shadow: 0 0 0 4px var(--accent-light, rgba(102, 126, 234, 0.08));
}

.size-btn span {
  font-weight: 600;
}

/* ===== 行间距按钮 ===== */
.line-btn {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid var(--border-color, #e8ecf1);
  border-radius: 10px;
  background: var(--bg-primary, #f5f7fa);
  color: var(--text-secondary, #555);
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-weight: 500;
}

.line-btn:hover {
  border-color: var(--accent-color, #667eea);
}

.line-btn.active {
  border-color: var(--accent-color, #667eea);
  background: var(--accent-light, rgba(102, 126, 234, 0.12));
  color: var(--accent-color, #667eea);
  box-shadow: 0 0 0 4px var(--accent-light, rgba(102, 126, 234, 0.08));
}

.line-preview {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
}

.line-preview span {
  display: block;
}

.line-preview span:last-child {
  font-size: 10px;
  opacity: 0.6;
}

/* ===== 字体风格按钮 ===== */
.font-btn {
  flex: 1;
  padding: 10px 12px;
  border: 2px solid var(--border-color, #e8ecf1);
  border-radius: 10px;
  background: var(--bg-primary, #f5f7fa);
  color: var(--text-secondary, #555);
  cursor: pointer;
  transition: all 0.25s ease;
  font-size: 14px;
  font-weight: 500;
}

.font-btn:hover {
  border-color: var(--accent-color, #667eea);
}

.font-btn.active {
  border-color: var(--accent-color, #667eea);
  background: var(--accent-light, rgba(102, 126, 234, 0.12));
  color: var(--accent-color, #667eea);
  box-shadow: 0 0 0 4px var(--accent-light, rgba(102, 126, 234, 0.08));
}

/* ===== 预览框 ===== */
.preview-box {
  margin-top: 4px;
  padding: 16px 20px;
  background: var(--bg-primary, #f5f7fa);
  border-radius: 10px;
  border: 1px dashed var(--border-color, #e8ecf1);
}

.preview-text {
  margin: 0;
  font-size: var(--font-size-base, 16px);
  line-height: var(--line-height-base, 1.7);
  font-family: var(--font-family-base, -apple-system, sans-serif);
  color: var(--text-secondary, #555);
  text-align: center;
}

.preview-text br {
  display: block;
  content: '';
  margin-bottom: 4px;
}

/* ===== 底部 ===== */
.settings-footer {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.btn-reset {
  padding: 8px 20px;
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted, #999);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-reset:hover {
  border-color: var(--danger-color, #ef4444);
  color: var(--danger-color, #ef4444);
  background: rgba(239, 68, 68, 0.06);
}

/* ===== 暗色主题适配 ===== */
@media (prefers-color-scheme: dark) {
  .settings-panel {
    background: #1a1a2e;
    border-color: #2a2a42;
  }

  .theme-btn,
  .size-btn,
  .line-btn,
  .font-btn {
    background: #12121f;
    border-color: #2a2a42;
    color: #aaa;
  }

  .theme-btn:hover,
  .size-btn:hover,
  .line-btn:hover,
  .font-btn:hover {
    border-color: #667eea;
  }

  .theme-btn.active,
  .size-btn.active,
  .line-btn.active,
  .font-btn.active {
    background: rgba(102, 126, 234, 0.15);
    color: #8a9eff;
  }

  .preview-box {
    background: #12121f;
    border-color: #2a2a42;
  }

  .btn-reset {
    border-color: #2a2a42;
    color: #666;
  }

  .btn-reset:hover {
    border-color: #ef4444;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
  }
}

/* ===== 响应式 ===== */
@media (max-width: 480px) {
  .settings-panel {
    padding: 16px;
    border-radius: 12px;
  }

  .theme-options,
  .size-options,
  .line-options,
  .font-options {
    gap: 6px;
  }

  .theme-btn,
  .size-btn,
  .line-btn,
  .font-btn {
    padding: 6px 10px;
    font-size: 12px;
  }

  .theme-btn span {
    font-size: 16px;
  }

  .preview-box {
    padding: 12px 16px;
  }
}
</style>