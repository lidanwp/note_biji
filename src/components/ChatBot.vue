<template>
  <!-- 浮动按钮 -->
  <button
    v-if="!isOpen"
    class="panda-bot-btn"
    @click="toggleChat"
    aria-label="打开 AI 助手"
  >
    <img src="/bot-logo.svg" alt="AI" class="panda-bot-btn-img" />
  </button>

  <!-- 聊天窗口 - 与 panda-bot-window 结构一致 -->
  <div v-if="isOpen" class="chat-bot">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-left">
        <img src="/bot-logo.svg" alt="Logo" class="header-logo" />
        <div class="header-info">
          <h3 class="header-title">问答机器人</h3>
          <div class="header-status">
            <span class="status-dot"></span>
            <span class="status-text">在线</span>
          </div>
        </div>
      </div>
      <button class="close-btn" @click="toggleChat" aria-label="关闭">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>

    <!-- 快捷提问（仅首次） -->
    <div v-if="messages.length <= 1" class="quick-tips">
      <div class="tips-title">试试这些问题：</div>
      <div class="tips-chips">
        <span
          v-for="t in quickTips"
          :key="t"
          class="chip"
          @click="quickAsk(t)"
        >{{ t }}</span>
      </div>
    </div>

    <!-- Messages -->
    <div class="messages" ref="messagesRef">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['message', msg.role]"
      >
        <div v-if="msg.role === 'bot'" class="msg-content" v-html="msg.display"></div>
        <span v-else>{{ msg.content }}</span>
      </div>
      <div v-if="loading" class="message bot">
        <span class="typing-dots"><span></span><span></span><span></span></span> 正在思考...
      </div>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <div class="textarea-wrapper">
        <textarea
          ref="textareaRef"
          v-model="question"
          class="panda-bot-textarea"
          placeholder="输入你的问题..."
          rows="1"
          :disabled="loading"
          @input="autoResize"
          @keydown="handleKeydown"
        ></textarea>
        <button
          class="send-btn"
          :disabled="loading || !question.trim()"
          @click="sendQuestion"
          aria-label="发送"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onBeforeUnmount } from 'vue'

const DATASET_ID = '4560b15d-1fee-4428-bf53-0f34b78dd35d'
const API_URL = '/api/chat'

const isOpen = ref(false)
const question = ref('')
const loading = ref(false)
const messagesRef = ref(null)
const textareaRef = ref(null)

const messages = ref([
  {
    role: 'bot',
    content: '',
    display: '<div style="line-height:1.7;color:#3D3533;">' +
      '你好！我是问答机器人 🐼<br>' +
      '你可以问我系统集成项目管理的知识，如：<b>十大知识领域、五大过程组、挣值管理、WBS</b> 等。' +
      '</div>'
  }
])

const quickTips = [
  '十大知识领域有哪些',
  '五大过程组是什么',
  '整合管理',
  '挣值管理 EVM',
  'WBS 工作分解结构',
  '三点估算 PERT',
  '可行性研究',
  '风险管理'
]

const quickAsk = (t) => {
  question.value = t
  sendQuestion()
}

// 键盘处理：Enter 发送，Shift+Enter 换行
const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !loading.value) {
    e.preventDefault()
    sendQuestion()
  }
}

// textarea 自动高度
const autoResize = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 140) + 'px'
}

// 自动滚动到底部（消息变化 + loading 变化）
watch(
  () => [messages.value.length, loading.value],
  () => {
    nextTick(() => {
      if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    })
  }
)

// 打开时聚焦
watch(isOpen, (open) => {
  if (open) nextTick(() => textareaRef.value?.focus())
})

// 将内容转为可读的 HTML
function formatAnswer(data) {
  // null / undefined 防护
  if (!data || typeof data !== 'object') {
    return '<div style="line-height:1.7;color:#3D3533;">抱歉，服务暂时不可用，请稍后重试。</div>'
  }

  const sourceTag =
    data.source === 'qa'
      ? '<div style="color:#94A694;font-size:11px;margin-bottom:6px;">✨ AI 智能回答</div>'
      : data.source === 'search'
      ? '<div style="color:#C48E96;font-size:11px;margin-bottom:6px;">📖 知识库检索结果</div>'
      : data.source === 'chat'
      ? '<div style="color:#A8B8A8;font-size:11px;margin-bottom:6px;">💬 智能助手</div>'
      : data.source === 'error'
      ? '<div style="color:#C48E96;font-size:11px;margin-bottom:6px;">⚠️ 服务异常</div>'
      : '<div style="color:#8A7E7A;font-size:11px;margin-bottom:6px;">ℹ️ 未命中相关内容</div>'

  // 闲聊/能力询问/错误提示 - 直接渲染换行
  if ((data.source === 'chat' || data.source === 'error' || data.source === 'empty') && data.answer) {
    const text = data.answer
      .replace(/\*\*(.+?)\*\*/g, '<b style="color:#3D3533;">$1</b>')
      .replace(/\r?\n/g, '<br>')
    return sourceTag + `<div style="line-height:1.75;color:#3D3533;">${text}</div>`
  }

  if (data.source === 'qa' && data.answer) {
    let text = data.answer
    text = text
      .replace(/\*\*(.+?)\*\*/g, '<b style="color:#3D3533;">$1</b>')
      .replace(/`([^`]+)`/g, '<code style="background:#EEEAE7;color:#C48E96;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
      .replace(/\r?\n/g, '<br>')
    return sourceTag + `<div style="line-height:1.75;color:#3D3533;">${text}</div>`
  }

  const results = data.results || []
  if (results.length === 0) {
    return sourceTag + '<div style="line-height:1.7;color:#3D3533;">' + (data.answer || '抱歉，没有找到相关内容。') + '</div>'
  }

  const parts = []
  const maxResults = 2  // 与后端一致：只展示前 2 条
  for (let i = 0; i < Math.min(results.length, maxResults); i++) {
    const r = results[i]
    let text = r.content || ''
    if (text.length > 400) text = text.slice(0, 400) + '...'

    text = text
      .replace(/^###? (.*$)/gm, '<h4 style="margin:6px 0 3px;color:#3D3533;font-size:13px;">$1</h4>')
      .replace(/^## (.*$)/gm, '<h3 style="margin:8px 0 4px;color:#3D3533;">$1</h3>')
      .replace(/^# (.*$)/gm, '<h2 style="margin:10px 0 5px;color:#3D3533;">$1</h2>')
      .replace(/^\|(.+)\|$/gm, (m) => {
        const cells = m.slice(1, -1).split('|').map(c => c.trim()).filter(c => c)
        if (cells.every(c => /^-+$/.test(c))) return ''
        return '<div style="display:flex;gap:4px;margin:2px 0;flex-wrap:wrap;">' +
               cells.map(c => `<span style="background:#EEEAE7;color:#C48E96;padding:2px 6px;border-radius:4px;font-size:11px;">${c}</span>`).join('') +
               '</div>'
      })
      .replace(/^- (.*$)/gm, '• $1')
      .replace(/^\d+\. (.*$)/gm, '• $1')
      .replace(/\*\*(.+?)\*\*/g, '<b style="color:#3D3533;">$1</b>')
      .replace(/`([^`]+)`/g, '<code style="background:#EEEAE7;color:#C48E96;padding:1px 4px;border-radius:3px;font-size:11px;">$1</code>')
      .replace(/\r?\n/g, '<br>')

    const score = r.score ? ` <span style="color:#8A7E7A;font-size:11px;">(${Math.round(r.score * 100)}%)</span>` : ''
    parts.push(`<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed #E8E2DE;">${text}${score}</div>`)
  }

  return sourceTag + '<div>' + parts.join('') + '</div>'
}

const toggleChat = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    // 打开时锁定滚动（防穿透）
    document.body.style.overflow = 'hidden'
  } else {
    // 关闭时恢复
    document.body.style.overflow = ''
    question.value = ''
    loading.value = false
  }
}

// 组件卸载时清理
onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

const sendQuestion = async () => {
  if (!question.value.trim() || loading.value) return

  const userQuestion = question.value.trim()
  messages.value.push({ role: 'user', content: userQuestion })
  question.value = ''
  autoResize()
  loading.value = true

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id: DATASET_ID,
        query: userQuestion,
        top_k: 8
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json().catch(() => null)
    console.log('AI 返回：', data)

    const formatted = formatAnswer(data)
    messages.value.push({
      role: 'bot',
      content: data?.answer || '',
      display: formatted
    })
  } catch (error) {
    console.error('请求失败：', error)
    messages.value.push({
      role: 'bot',
      content: '抱歉，服务暂时不可用，请稍后重试。',
      display: '<div style="color:#C48E96;">❌ 抱歉，服务暂时不可用，请稍后重试。</div>'
    })
  } finally {
    loading.value = false
    nextTick(() => {
      autoResize()
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    })
  }
}
</script>

<style scoped>
/* ============ 浮动按钮 (panda-bot-btn 风格) ============ */
.panda-bot-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #D4A0A8, #C48E96);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(61, 53, 51, 0.08);
  transition: all 0.3s ease;
  padding: 0;
  z-index: 9999;
  animation: botPulse 2.5s ease-in-out infinite;
}
.panda-bot-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 28px rgba(61, 53, 51, 0.12);
}
.panda-bot-btn-img {
  width: 30px;
  height: 30px;
}
@keyframes botPulse {
  0%, 100% { box-shadow: 0 4px 20px rgba(61, 53, 51, 0.08); transform: scale(1); }
  50% { box-shadow: 0 6px 28px rgba(61, 53, 51, 0.12); transform: scale(1.04); }
}

/* ============ 主窗口 (panda-bot-window 风格) ============ */
.chat-bot {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 440px;
  height: 600px;
  background: #FFFFFF;
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(61, 53, 51, 0.18), 0 4px 14px rgba(61, 53, 51, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* ============ Header ============ */
.chat-header {
  padding: 18px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F7F4F2;
  border-bottom: 1px solid #E8E2DE;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.header-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
}
.header-info {
  display: flex;
  flex-direction: column;
}
.header-title {
  margin: 0;
  font-size: 17px;
  font-weight: 500;
  color: #3D3533;
  line-height: 1.3;
}
.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.status-dot {
  width: 8px;
  height: 8px;
  background: #A8B8A8;
  border-radius: 50%;
}
.status-text {
  font-size: 12px;
  color: #8A7E7A;
}
.close-btn {
  background: transparent;
  border: none;
  color: #8A7E7A;
  cursor: pointer;
  padding: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}
.close-btn:hover {
  background: #EEEAE7;
  color: #3D3533;
}
.close-btn svg {
  width: 20px;
  height: 20px;
}

/* ============ 快捷提问 ============ */
.quick-tips {
  padding: 12px 22px 10px;
  background: #F7F4F2;
  border-bottom: 1px solid #E8E2DE;
  flex-shrink: 0;
}
.tips-title {
  font-size: 12px;
  color: #8A7E7A;
  margin-bottom: 8px;
  font-weight: 500;
}
.tips-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  padding: 4px 12px;
  background: #FFFFFF;
  border: 1px solid #E8E2DE;
  color: #3D3533;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.chip:hover {
  background: #D4A0A8;
  color: #FFFFFF;
  border-color: #D4A0A8;
}

/* ============ Messages ============ */
.messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #F7F4F2;
}
.message {
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 14px;
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.65;
  max-width: 82%;
}
.msg-content {
  display: inline;
}
.message.user {
  background: #D4A0A8;
  color: #3D3533;
  margin-left: auto;
  text-align: left;
  border-bottom-right-radius: 4px;
}
.message.bot {
  background: #EEEAE7;
  border: 1px solid #E8E2DE;
  color: #3D3533;
  margin-right: auto;
  border-bottom-left-radius: 4px;
}
.typing-dots {
  display: inline-flex;
  gap: 4px;
  margin-right: 6px;
}
.typing-dots span {
  width: 6px;
  height: 6px;
  background: #A8B8A8;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* ============ Input Area ============ */
.input-area {
  padding: 14px 20px;
  background: #FFFFFF;
  border-top: 1px solid #E8E2DE;
  flex-shrink: 0;
}
.textarea-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}
.panda-bot-textarea {
  flex: 1;
  padding: 12px 16px;
  border: 1.5px solid #E8E2DE;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  resize: none;
  transition: all 0.2s;
  max-height: 140px;
  min-height: 44px;
  font-family: inherit;
  background: #F7F4F2;
  color: #3D3533;
}
.panda-bot-textarea::placeholder {
  color: #8A7E7A;
}
.panda-bot-textarea:focus {
  border-color: #D4A0A8;
  background: #FFFFFF;
}
.send-btn {
  width: 42px;
  height: 42px;
  background: #D4A0A8;
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  padding: 0;
}
.send-btn svg {
  width: 22px;
  height: 22px;
  margin-left: -2px;
}
.send-btn:hover:not(:disabled) {
  transform: scale(1.08);
  box-shadow: 0 4px 14px rgba(212, 160, 168, 0.35);
}
.send-btn:active:not(:disabled) {
  transform: scale(0.96);
}
.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ============ 滚动条 ============ */
.messages::-webkit-scrollbar {
  width: 5px;
}
.messages::-webkit-scrollbar-track {
  background: transparent;
}
.messages::-webkit-scrollbar-thumb {
  background: #A8B8A8;
  border-radius: 3px;
}
.messages::-webkit-scrollbar-thumb:hover {
  background: #94A694;
}

/* ============ 移动端适配 (≤768px) ============ */
@media (max-width: 768px) {
  /* 浮动按钮 - 移动端缩小 + 偏右下 */
  .panda-bot-btn {
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
  }
  .panda-bot-btn-img {
    width: 26px;
    height: 26px;
  }
  @keyframes botPulse {
    0%, 100% { box-shadow: 0 4px 16px rgba(61, 53, 51, 0.08); transform: scale(1); }
    50% { box-shadow: 0 6px 24px rgba(61, 53, 51, 0.12); transform: scale(1.05); }
  }

  /* 主窗口 - 移动端全屏 */
  .chat-bot {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
    z-index: 9999;
  }

  /* Header - 调整 padding */
  .chat-header {
    padding: 14px 16px;
  }
  .header-logo {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }
  .header-title {
    font-size: 15px;
  }

  /* 快捷提问 */
  .quick-tips {
    padding: 10px 16px 8px;
  }

  /* Messages - 移动端更紧凑 */
  .messages {
    padding: 14px 16px;
  }
  .message {
    padding: 9px 12px;
    font-size: 14px;
    max-width: 88%;
  }

  /* 输入区 - 全屏更宽 */
  .input-area {
    padding: 12px 14px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  }
  .panda-bot-textarea {
    font-size: 15px;
    padding: 10px 14px;
    min-height: 42px;
  }
  .send-btn {
    width: 40px;
    height: 40px;
  }
  .send-btn svg {
    width: 20px;
    height: 20px;
  }
}

/* 小屏手机适配 (≤380px) */
@media (max-width: 380px) {
  .header-title {
    font-size: 14px;
  }
  .header-status {
    display: none;
  }
  .chip {
    padding: 3px 10px;
    font-size: 11px;
  }
}
</style>
