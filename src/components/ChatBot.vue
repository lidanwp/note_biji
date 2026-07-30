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
    display: '<div style="line-height:1.7;">' +
      '你好！我是 <b>系统集成项目管理中级 AI 助手</b> 📖<br>' +
      '覆盖：PMBOK 十大知识领域 · 五大过程组 · 整合/范围/进度/成本/质量/资源/沟通/风险/采购/相关方管理 · EVM 挣值 · WBS · PERT 三点估算 · RACI 等<br>' +
      '<span style="color:#666;font-size:12px;">点击下方快捷标签直接提问</span>' +
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
  // 回答来源标签
  const sourceTag =
    data.source === 'qa'
      ? '<div style="color:#10b981;font-size:11px;margin-bottom:6px;">✨ AI 智能回答</div>'
      : data.source === 'search'
      ? '<div style="color:#6366f1;font-size:11px;margin-bottom:6px;">📖 知识库检索结果</div>'
      : '<div style="color:#9ca3af;font-size:11px;margin-bottom:6px;">ℹ️ 未命中相关内容</div>'

  // QA 接口的 AI 答案（优先展示）
  if (data.source === 'qa' && data.answer) {
    let text = data.answer
    text = text
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code style="background:#f5f5f5;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
      .replace(/\r?\n/g, '<br>')
    return sourceTag + `<div style="line-height:1.75;">${text}</div>`
  }

  // 搜索回退结果
  const results = data.results || []
  if (results.length === 0) {
    return sourceTag + '<div style="line-height:1.7;">' + (data.answer || '抱歉，没有找到相关内容。') + '</div>'
  }

  const parts = []
  const maxResults = 4
  for (let i = 0; i < Math.min(results.length, maxResults); i++) {
    const r = results[i]
    let text = r.content || ''
    if (text.length > 600) text = text.slice(0, 600) + '...'

    text = text
      .replace(/^###? (.*$)/gm, '<h4 style="margin:6px 0 3px;color:#374151;font-size:13px;">$1</h4>')
      .replace(/^## (.*$)/gm, '<h3 style="margin:8px 0 4px;color:#1f2937;">$1</h3>')
      .replace(/^# (.*$)/gm, '<h2 style="margin:10px 0 5px;color:#111827;">$1</h2>')
      .replace(/^\|(.+)\|$/gm, (m) => {
        const cells = m.slice(1, -1).split('|').map(c => c.trim()).filter(c => c)
        if (cells.every(c => /^-+$/.test(c))) return ''
        return '<div style="display:flex;gap:4px;margin:2px 0;flex-wrap:wrap;">' +
               cells.map(c => `<span style="background:#eef2ff;color:#4338ca;padding:2px 6px;border-radius:4px;font-size:11px;">${c}</span>`).join('') +
               '</div>'
      })
      .replace(/^- (.*$)/gm, '• $1')
      .replace(/^\d+\. (.*$)/gm, '• $1')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code style="background:#f5f5f5;padding:1px 4px;border-radius:3px;font-size:11px;">$1</code>')
      .replace(/\r?\n/g, '<br>')

    const score = r.score ? ` <span style="color:#9ca3af;font-size:11px;">相关度 ${Math.round(r.score * 100)}%</span>` : ''
    parts.push(`<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed #e5e7eb;">${text}${score}</div>`)
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
      display: '<div style="color:#ef4444;">❌ 网络错误，请稍后重试。</div>'
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.chat-bot {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  max-height: 560px;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(74, 108, 247, 0.22), 0 3px 10px rgba(0, 0, 0, 0.08);
  background: #ffffff;
  border: 1px solid #e0e0e0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}
.chat-header {
  background: linear-gradient(135deg, #4a6cf7, #6366f1);
  color: #fff;
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}
.chat-body {
  display: flex;
  flex-direction: column;
  height: 500px;
}
.quick-tips {
  padding: 10px 14px;
  background: linear-gradient(180deg, #eef2ff 0%, #fff 100%);
  border-bottom: 1px solid #e5e7eb;
}
.tips-title {
  font-size: 12px;
  color: #4b5563;
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
  background: #fff;
  border: 1px solid #c7d2fe;
  color: #4338ca;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.chip:hover {
  background: #4338ca;
  color: #fff;
  border-color: #4338ca;
}
.messages {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  background: #f9fafb;
}
.message {
  margin-bottom: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.65;
}
.msg-label {
  font-size: 12px;
  color: #666;
  margin-right: 4px;
}
.msg-content {
  display: inline;
  max-height: 280px;
  overflow-y: auto;
}
.message.user {
  background: linear-gradient(135deg, #667eea, #4a6cf7);
  color: #fff;
  margin-left: 40px;
  text-align: right;
}
.message.user .msg-label {
  color: rgba(255, 255, 255, 0.85);
}
.message.bot {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #333;
  margin-right: 20px;
}
.input-area {
  display: flex;
  padding: 10px 12px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
  gap: 8px;
  flex-shrink: 0;
}
.input-area input {
  flex: 1;
  padding: 9px 14px;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  outline: none;
  font-size: 13px;
  transition: all 0.2s;
}
.input-area input:focus {
  border-color: #4a6cf7;
  box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.1);
}
.input-area button {
  padding: 9px 18px;
  background: linear-gradient(135deg, #4a6cf7, #6366f1);
  color: #fff;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}
.input-area button:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}
.input-area button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.typing-dots {
  display: inline-flex;
  gap: 3px;
  margin-right: 6px;
}
.typing-dots span {
  width: 6px;
  height: 6px;
  background: #94a3b8;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}
</style>
