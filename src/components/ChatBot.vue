<template>
  <div class="chat-bot">
    <div class="chat-header" @click="toggleChat">
      <span>🤖 系统集成 AI 助手</span>
      <span>{{ isOpen ? '▼' : '▲' }}</span>
    </div>
    <div v-if="isOpen" class="chat-body">
      <!-- 快捷提问建议（仅在消息列表为空时显示） -->
      <div v-if="messages.length <= 1" class="quick-tips">
        <div class="tips-title">📚 试试这些问题：</div>
        <div class="tips-chips">
          <span
            v-for="t in quickTips"
            :key="t"
            class="chip"
            @click="quickAsk(t)"
          >{{ t }}</span>
        </div>
      </div>
      <div class="messages" ref="messagesRef">
        <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.role]">
          <strong class="msg-label">{{ msg.role === 'user' ? '我' : '🤖' }}：</strong>
          <div v-if="msg.role === 'bot'" class="msg-content" v-html="msg.display"></div>
          <span v-else>{{ msg.content }}</span>
        </div>
        <div v-if="loading" class="message bot">
          <span class="typing-dots"><span></span><span></span><span></span></span> 正在检索知识库...
        </div>
      </div>
      <div class="input-area">
        <input
          v-model="question"
          placeholder="如：整合管理、挣值管理、WBS..."
          @keyup.enter="sendQuestion"
        />
        <button @click="sendQuestion" :disabled="loading">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'

const DATASET_ID = '8cbc6517-ca4f-462e-a9e7-dc9b2129f474'
const API_URL = '/api/chat'

const isOpen = ref(false)
const question = ref('')
const loading = ref(false)
const messagesRef = ref(null)

const messages = ref([
  {
    role: 'bot',
    content: '',
    display: '<div style="line-height:1.7;color:#3D3533;">' +
      '你好！我是 <b>系统集成项目管理中级 AI 助手</b> 🐼<br>' +
      '覆盖：PMBOK 十大知识领域 · 五大过程组 · 整合/范围/进度/成本/质量/资源/沟通/风险/采购/相关方管理 · EVM 挣值 · WBS · PERT 三点估算 · RACI 等<br>' +
      '<span style="color:#8A7E7A;font-size:12px;">点击下方快捷标签直接提问</span>' +
      '</div>'
  }
])

// 快捷提问建议
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

// 自动滚动到底部
watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    })
  }
)

// 将内容转为可读的 HTML
function formatAnswer(data) {
  // 回答来源标签 - Panda 莫兰迪色系
  const sourceTag =
    data.source === 'qa'
      ? '<div style="color:#94A694;font-size:11px;margin-bottom:6px;">✨ AI 智能回答</div>'
      : data.source === 'search'
      ? '<div style="color:#C48E96;font-size:11px;margin-bottom:6px;">📖 知识库检索结果</div>'
      : '<div style="color:#8A7E7A;font-size:11px;margin-bottom:6px;">ℹ️ 未命中相关内容</div>'

  // QA 接口的 AI 答案（优先展示）
  if (data.source === 'qa' && data.answer) {
    let text = data.answer
    text = text
      .replace(/\*\*(.+?)\*\*/g, '<b style="color:#3D3533;">$1</b>')
      .replace(/`([^`]+)`/g, '<code style="background:#EEEAE7;color:#C48E96;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
      .replace(/\r?\n/g, '<br>')
    return sourceTag + `<div style="line-height:1.75;color:#3D3533;">${text}</div>`
  }

  // 搜索回退结果
  const results = data.results || []
  if (results.length === 0) {
    return sourceTag + '<div style="line-height:1.7;color:#3D3533;">' + (data.answer || '抱歉，没有找到相关内容。') + '</div>'
  }

  const parts = []
  const maxResults = 4
  for (let i = 0; i < Math.min(results.length, maxResults); i++) {
    const r = results[i]
    let text = r.content || ''
    if (text.length > 600) text = text.slice(0, 600) + '...'

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

    const score = r.score ? ` <span style="color:#8A7E7A;font-size:11px;">相关度 ${Math.round(r.score * 100)}%</span>` : ''
    parts.push(`<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed #E8E2DE;">${text}${score}</div>`)
  }

  return sourceTag + '<div>' + parts.join('') + '</div>'
}

const toggleChat = () => {
  isOpen.value = !isOpen.value
}

const sendQuestion = async () => {
  if (!question.value.trim() || loading.value) return

  const userQuestion = question.value.trim()
  messages.value.push({ role: 'user', content: userQuestion })
  question.value = ''
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

    const data = await response.json()
    console.log('AI 返回：', data)

    const formatted = formatAnswer(data)
    messages.value.push({
      role: 'bot',
      content: data.answer || '',
      display: formatted
    })
  } catch (error) {
    console.error('请求失败：', error)
    messages.value.push({
      role: 'bot',
      content: '网络错误，请稍后重试。',
      display: '<div style="color:#C48E96;">❌ 网络错误，请稍后重试。</div>'
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* Panda 莫兰迪色系 - 与 widget-bot.js 保持一致 */
.chat-bot {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  max-height: 560px;
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(61, 53, 51, 0.14), 0 3px 10px rgba(61, 53, 51, 0.06);
  background: #FFFFFF;
  border: 1px solid #E8E2DE;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.chat-header {
  background: #F7F4F2;
  border-bottom: 1px solid #E8E2DE;
  color: #3D3533;
  padding: 14px 18px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  font-size: 15px;
  flex-shrink: 0;
  gap: 14px;
}

.chat-header span:first-child {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-header span:first-child::before {
  content: '🐼';
  font-size: 22px;
}

.chat-body {
  display: flex;
  flex-direction: column;
  height: 500px;
  background: #F7F4F2;
}

.quick-tips {
  padding: 14px 18px 12px;
  background: #F7F4F2;
  border-bottom: 1px solid #E8E2DE;
}

.tips-title {
  font-size: 12px;
  color: #8A7E7A;
  margin-bottom: 10px;
  font-weight: 500;
}

.tips-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 5px 14px;
  background: #FFFFFF;
  border: 1px solid #E8E2DE;
  color: #3D3533;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.chip:hover {
  background: #D4A0A8;
  color: #FFFFFF;
  border-color: #D4A0A8;
}

.messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #F7F4F2;
}

.message {
  margin-bottom: 12px;
  padding: 11px 15px;
  border-radius: 14px;
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.65;
  max-width: 85%;
}

.msg-label {
  font-size: 12px;
  color: #8A7E7A;
  margin-right: 4px;
}

.msg-content {
  display: inline;
  max-height: 280px;
  overflow-y: auto;
}

.message.user {
  background: #D4A0A8;
  color: #3D3533;
  margin-left: auto;
  margin-right: 4px;
  text-align: left;
  border-bottom-right-radius: 4px;
}

.message.user .msg-label {
  color: rgba(61, 53, 51, 0.6);
}

.message.bot {
  background: #EEEAE7;
  border: 1px solid #E8E2DE;
  color: #3D3533;
  margin-right: auto;
  margin-left: 4px;
  border-bottom-left-radius: 4px;
}

.input-area {
  display: flex;
  padding: 12px 14px;
  border-top: 1px solid #E8E2DE;
  background: #FFFFFF;
  gap: 10px;
  flex-shrink: 0;
  align-items: center;
}

.input-area input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #E8E2DE;
  border-radius: 22px;
  outline: none;
  font-size: 13px;
  color: #3D3533;
  background: #FFFFFF;
  transition: all 0.2s ease;
}

.input-area input::placeholder {
  color: #8A7E7A;
}

.input-area input:focus {
  border-color: #D4A0A8;
  box-shadow: 0 0 0 3px rgba(212, 160, 168, 0.18);
  background: #FFFFFF;
}

.input-area button {
  padding: 10px 20px;
  background: linear-gradient(135deg, #D4A0A8, #C48E96);
  color: #FFFFFF;
  border: none;
  border-radius: 22px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.input-area button:hover:not(:disabled) {
  transform: scale(1.06);
  box-shadow: 0 4px 14px rgba(212, 160, 168, 0.35);
}

.input-area button:active:not(:disabled) {
  transform: scale(0.96);
}

.input-area button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

/* 自定义滚动条 - 与 Panda 风格一致 */
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
</style>
