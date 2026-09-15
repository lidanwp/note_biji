<template>
  <div class="roundtable-widget">
    <!-- ===== 触发按钮（右下角圆形 FAB） ===== -->
    <button
      v-if="!isOpen"
      class="rt-fab"
      @click="isOpen = true"
      title="AI 圆桌讨论"
    >
      <span>🎤</span>
    </button>

    <!-- ===== 浮窗面板 ===== -->
    <transition name="rt-slide">
      <div v-if="isOpen" class="rt-panel">
        <!-- Header -->
        <div class="rt-header">
          <div class="rt-title">
            <span>🎤 AI 圆桌讨论</span>
          </div>
          <div class="rt-header-actions">
            <button
              v-if="messages.length"
              class="rt-icon-btn"
              @click="copyMarkdown"
              title="复制为 Markdown"
            >
              📋
            </button>
            <button class="rt-icon-btn" @click="isOpen = false" title="收起">
              ▭
            </button>
          </div>
        </div>

        <!-- 输入区（仅未运行时显示） -->
        <div v-if="!store.isRunning" class="rt-input-area">
          <textarea
            v-model="topicModel"
            class="rt-topic-input"
            placeholder="输入讨论主题，如：远程办公是否会削弱团队协作？"
            rows="2"
          ></textarea>
          <div class="rt-controls">
            <label class="rt-rounds-label">
              轮数
              <input
                type="number"
                min="1"
                max="10"
                :value="store.totalRounds"
                @input="store.setRounds($event.target.value)"
                class="rt-rounds-input"
              />
            </label>
            <button
              class="rt-btn rt-btn-primary"
              :disabled="!topicModel.trim()"
              @click="handleStart"
            >
              开始讨论
            </button>
          </div>
        </div>

        <!-- 进度条（运行中） -->
        <div v-if="store.isRunning" class="rt-progress">
          <div class="rt-progress-info">
            <span>第 {{ store.currentRound }} / {{ store.totalRounds }} 轮</span>
            <span v-if="store.currentRoleName">· {{ store.currentRoleName }} 思考中…</span>
          </div>
          <div class="rt-progress-bar">
            <div class="rt-progress-fill" :style="{ width: store.progress + '%' }"></div>
          </div>
        </div>

        <!-- 消息流 -->
        <div class="rt-messages" ref="messagesRef">
          <div v-if="!messages.length && !store.isRunning" class="rt-empty">
            <span>💭</span>
            <p>输入主题后开始圆桌讨论</p>
          </div>

          <div
            v-for="msg in messages"
            :key="msg.id"
            class="rt-msg"
            :class="msg.role"
          >
            <div class="rt-msg-avatar" :class="{ 'is-icon': !!iconOf(msg) }">
              <img
                v-if="iconOf(msg)"
                :src="iconOf(msg)"
                :alt="msg.roleName || '角色'"
                class="rt-msg-avatar-img"
                draggable="false"
              />
              <span v-else>💬</span>
            </div>
            <div class="rt-msg-body">
              <div class="rt-msg-meta">
                <span class="rt-msg-name">{{ msg.roleName || '用户' }}</span>
                <span v-if="msg.duty" class="rt-msg-duty" :title="'本轮职责：' + msg.duty">{{ msg.duty }}</span>
                <span v-if="msg.round" class="rt-msg-round">R{{ msg.round }}</span>
              </div>
              <div class="rt-msg-content">{{ msg.content }}</div>
            </div>
          </div>
        </div>

        <!-- 插话区（运行中） -->
        <div v-if="store.isRunning" class="rt-interrupt">
          <div class="rt-interrupt-toggle">
            <button
              :class="['rt-toggle-btn', { active: interruptKind === 'comment' }]"
              @click="interruptKind = 'comment'"
            >插话</button>
            <button
              :class="['rt-toggle-btn', { active: interruptKind === 'meta' }]"
              @click="interruptKind = 'meta'"
            >元指令</button>
          </div>
          <div class="rt-interrupt-row">
            <input
              v-model="interruptText"
              type="text"
              class="rt-interrupt-input"
              :placeholder="interruptKind === 'meta'
                ? '如：让双方交换立场 / 要求研究专家标注证据强度'
                : '插一句话，下一轮会带入上下文…'"
              @keyup.enter="handleInterrupt"
            />
            <button class="rt-btn rt-btn-secondary" @click="handleInterrupt">发送</button>
            <button class="rt-btn rt-btn-danger" @click="store.stop" title="停止">■</button>
          </div>
        </div>

        <!-- 清空按钮（未运行且有消息） -->
        <div v-if="!store.isRunning && messages.length" class="rt-footer">
          <button class="rt-btn rt-btn-ghost" @click="store.clear">清空记录</button>
        </div>

        <!-- 错误提示 -->
        <div v-if="store.error" class="rt-error">
          ⚠ {{ store.error }}
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoundtableStore, ROLES } from '../stores/roundtable'
import { toastSuccess, toastError } from '../utils/toast'

const store = useRoundtableStore()

// 角色 id -> 头像 SVG 路径，用于旧草稿（无 icon 字段）兜底显示角色图标
const ROLE_ICONS = Object.fromEntries(ROLES.map(r => [r.id, r.icon]))
const iconOf = (msg) => msg.icon || ROLE_ICONS[msg.role] || ''

const isOpen = ref(false)
const messagesRef = ref(null)
const interruptText = ref('')
const interruptKind = ref('comment') // 'comment' | 'meta'

// 双向绑定 topic（store 中 topic 是 ref，用 computed 双向）
const topicModel = computed({
  get: () => store.topic,
  set: (v) => store.setTopic(v)
})

const messages = computed(() => store.messages)

// 消息列表自动滚动到底
watch(() => messages.value.length, async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
})

const handleStart = async () => {
  const ok = await store.start()
  if (!ok && store.error) {
    toastError(store.error)
  }
}

const handleInterrupt = () => {
  if (!interruptText.value.trim()) return
  store.interrupt(interruptText.value, interruptKind.value)
  interruptText.value = ''
}

const copyMarkdown = async () => {
  const md = store.exportMarkdown()
  if (!md) return
  try {
    await navigator.clipboard.writeText(md)
    toastSuccess('已复制到剪贴板')
  } catch (e) {
    // 兜底：创建 textarea
    const ta = document.createElement('textarea')
    ta.value = md
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); toastSuccess('已复制到剪贴板') }
    catch (_) { toastError('复制失败，请手动选择') }
    document.body.removeChild(ta)
  }
}
</script>

<style scoped>
.roundtable-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1500;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* ===== FAB 触发按钮 ===== */
.rt-fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--accent-color, #667eea);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rt-fab:hover {
  transform: scale(1.08);
  box-shadow: 0 8px 28px rgba(102, 126, 234, 0.5);
}

/* ===== 浮窗面板 ===== */
.rt-panel {
  width: 380px;
  max-width: calc(100vw - 32px);
  height: 520px;
  max-height: calc(100vh - 48px);
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--accent-color, #667eea);
  color: #fff;
  flex-shrink: 0;
}
.rt-title {
  font-size: 14px;
  font-weight: 600;
}
.rt-header-actions {
  display: flex;
  gap: 6px;
}
.rt-icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}
.rt-icon-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

/* ===== 输入区 ===== */
.rt-input-area {
  padding: 12px;
  border-bottom: 1px solid var(--border-light, #f0f0f0);
  flex-shrink: 0;
}
.rt-topic-input {
  width: 100%;
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  background: var(--bg-input, #fff);
  color: var(--text-primary, #1a1a2e);
  resize: none;
  box-sizing: border-box;
}
.rt-topic-input:focus {
  outline: none;
  border-color: var(--accent-color, #667eea);
}
.rt-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.rt-rounds-label {
  font-size: 12px;
  color: var(--text-muted, #888);
  display: flex;
  align-items: center;
  gap: 4px;
}
.rt-rounds-input {
  width: 48px;
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
  background: var(--bg-input, #fff);
  color: var(--text-primary, #1a1a2e);
}

.rt-btn {
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.rt-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rt-btn-primary {
  background: var(--accent-color, #667eea);
  color: #fff;
  margin-left: auto;
}
.rt-btn-primary:hover:not(:disabled) {
  background: var(--accent-hover, #5a6fd6);
}
.rt-btn-secondary {
  background: var(--bg-hover, #f0f2ff);
  color: var(--text-primary, #1a1a2e);
}
.rt-btn-danger {
  background: var(--danger-color, #ef4444);
  color: #fff;
  width: 32px;
  padding: 6px 0;
}
.rt-btn-ghost {
  background: transparent;
  color: var(--text-muted, #888);
  width: 100%;
  border: 1px solid var(--border-color, #e8ecf1);
}

/* ===== 进度条 ===== */
.rt-progress {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-light, #f0f0f0);
  flex-shrink: 0;
}
.rt-progress-info {
  font-size: 11px;
  color: var(--text-muted, #888);
  margin-bottom: 4px;
}
.rt-progress-bar {
  height: 3px;
  background: var(--bg-hover, #f0f2ff);
  border-radius: 2px;
  overflow: hidden;
}
.rt-progress-fill {
  height: 100%;
  background: var(--accent-color, #667eea);
  transition: width 0.4s ease;
}

/* ===== 消息流 ===== */
.rt-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rt-empty {
  text-align: center;
  color: var(--text-muted, #888);
  padding: 40px 0;
  font-size: 13px;
}
.rt-empty span {
  display: block;
  font-size: 28px;
  margin-bottom: 8px;
}

.rt-msg {
  display: flex;
  gap: 8px;
  animation: rt-msg-in 0.3s ease-out;
}
@keyframes rt-msg-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.rt-msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-hover, #f0f2ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
  box-sizing: border-box;
  overflow: hidden;
}
/* 有角色 SVG 时：保留原有角色底色（下面 .rt-msg.xxx 的色点），四周留 2px 内边距 */
.rt-msg-avatar.is-icon {
  padding: 2px;
}
.rt-msg-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}

.rt-msg-body {
  flex: 1;
  min-width: 0;
}
.rt-msg-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}
.rt-msg-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary, #1a1a2e);
}
.rt-msg-round {
  font-size: 10px;
  color: var(--text-light, #bbb);
  background: var(--bg-hover, #f0f2ff);
  padding: 1px 5px;
  border-radius: 8px;
}
/* 主持人本轮职责标签（仅主持人消息有，用于观察四项职责是否被执行） */
.rt-msg-duty {
  font-size: 10px;
  line-height: 15px;
  color: var(--accent-color, #667eea);
  background: var(--bg-hover, #f0f2ff);
  border: 1px solid var(--border-color, #e8ecf1);
  padding: 0 5px;
  border-radius: 8px;
  white-space: nowrap;
}
.rt-msg-content {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary, #444);
  word-break: break-word;
}

/* 角色色彩点缀 */
.rt-msg.advocate .rt-msg-avatar { background: rgba(34, 197, 94, 0.15); }
.rt-msg.critic   .rt-msg-avatar { background: rgba(239, 68, 68, 0.15); }
.rt-msg.researcher .rt-msg-avatar { background: rgba(59, 130, 246, 0.15); }
.rt-msg.moderator .rt-msg-avatar { background: rgba(251, 191, 36, 0.15); }
.rt-msg.user .rt-msg-avatar { background: rgba(148, 163, 184, 0.2); }
.rt-msg.user .rt-msg-content {
  font-style: italic;
  color: var(--text-muted, #888);
}

/* ===== 插话区 ===== */
.rt-interrupt {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-light, #f0f0f0);
  flex-shrink: 0;
}
.rt-interrupt-toggle {
  display: flex;
  gap: 4px;
}
.rt-toggle-btn {
  border: 1px solid var(--border-color, #e8ecf1);
  background: transparent;
  color: var(--text-muted, #888);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.rt-toggle-btn.active {
  background: var(--accent-color, #667eea);
  color: #fff;
  border-color: var(--accent-color, #667eea);
}
.rt-interrupt-row {
  display: flex;
  gap: 6px;
}
.rt-interrupt-input {
  flex: 1;
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  background: var(--bg-input, #fff);
  color: var(--text-primary, #1a1a2e);
  min-width: 0;
}
.rt-interrupt-input:focus {
  outline: none;
  border-color: var(--accent-color, #667eea);
}

/* ===== Footer ===== */
.rt-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--border-light, #f0f0f0);
  flex-shrink: 0;
}

/* ===== 错误提示 ===== */
.rt-error {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger-color, #ef4444);
  font-size: 12px;
  border-top: 1px solid rgba(239, 68, 68, 0.2);
  flex-shrink: 0;
}

/* ===== 进出动画 ===== */
.rt-slide-enter-active,
.rt-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.rt-slide-enter-from,
.rt-slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.96);
}

/* ===== 移动端适配 ===== */
@media (max-width: 480px) {
  .roundtable-widget {
    bottom: 12px;
    right: 12px;
    left: 12px;
  }
  .rt-fab {
    margin-left: auto;
    display: flex;
  }
  .rt-panel {
    width: 100%;
    height: calc(100vh - 80px);
  }
}
</style>
