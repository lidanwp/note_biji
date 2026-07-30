<template>
  <div class="chat-bot">
    <div class="chat-header" @click="toggleChat">
      <span>🤖 AI 助手</span>
      <span>{{ isOpen ? '▼' : '▲' }}</span>
    </div>
    <div v-if="isOpen" class="chat-body">
      <div class="messages">
        <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.role]">
          <strong class="msg-label">{{ msg.role === 'user' ? '我' : '🤖' }}：</strong>
          <div v-if="msg.role === 'bot'" class="msg-content" v-html="msg.display"></div>
          <span v-else>{{ msg.content }}</span>
        </div>
        <div v-if="loading" class="message bot">
          <span class="typing-dots"><span></span><span></span><span></span></span> 正在思考...
        </div>
      </div>
      <div class="input-area">
        <input
          v-model="question"
          placeholder="输入你的问题..."
          @keyup.enter="sendQuestion"
        />
        <button @click="sendQuestion" :disabled="loading">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const DATASET_ID = 'b2f803ac-26e9-447a-83ee-2718fab202ad'
const API_URL = '/api/chat'

const isOpen = ref(false)
const question = ref('')
const loading = ref(false)
const messages = ref([
  { role: 'bot', content: '你好！我是 PandaWiki AI 助手，有什么可以帮助你的？', display: '你好！我是 <b>PandaWiki AI 助手</b>，有什么可以帮助你的？' }
])

// 将 PandaWiki 返回的 Markdown 内容转为可读的 HTML
function formatResults(results) {
  if (!results || results.length === 0) return ''

  const maxResults = 3
  const parts = []

  for (let i = 0; i < Math.min(results.length, maxResults); i++) {
    const r = results[i]
    let text = r.content || ''

    // 截断过长内容
    if (text.length > 600) text = text.slice(0, 600) + '...'

    // 简单 Markdown 转 HTML
    text = text
      // 标题: # 标题
      .replace(/^### (.*$)/gm, '<h4 style="margin:8px 0 4px;color:#333;">$1</h4>')
      .replace(/^## (.*$)/gm, '<h3 style="margin:10px 0 4px;color:#222;">$1</h3>')
      .replace(/^# (.*$)/gm, '<h2 style="margin:12px 0 6px;color:#1a1a1a;">$1</h2>')
      // 表格行: | a | b | c |
      .replace(/^\|(.+)\|$/gm, (m) => {
        const cells = m.slice(1, -1).split('|').map(c => c.trim()).filter(c => c)
        return '<div style="display:flex;gap:4px;margin:2px 0;">' +
               cells.map(c => `<span style="background:#f0f4ff;padding:2px 6px;border-radius:4px;font-size:12px;">${c}</span>`).join('') +
               '</div>'
      })
      // 列表项
      .replace(/^- (.*$)/gm, '• $1')
      .replace(/^\d+\. (.*$)/gm, '• $1')
      // 加粗 **text**
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      // 代码块 `text`
      .replace(/`([^`]+)`/g, '<code style="background:#f5f5f5;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
      // 换行
      .replace(/\r?\n/g, '<br>')

    // 添加来源分数
    const score = r.score ? ` <span style="color:#999;font-size:11px;">(相关度 ${(r.score * 100).toFixed(1)}%)</span>` : ''
    parts.push(`<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed #eee;">${text}${score}</div>`)
  }

  return parts.join('')
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
        top_k: 5
      })
    })

    const data = await response.json()
    console.log('API 返回数据：', data)

    const results = data?.data?.results || data?.results
    if (results && results.length > 0) {
      const formatted = formatResults(results)
      messages.value.push({
        role: 'bot',
        content: formatted,
        display: formatted
      })
    } else if (data && data.answer) {
      messages.value.push({
        role: 'bot',
        content: data.answer,
        display: data.answer
      })
    } else {
      messages.value.push({
        role: 'bot',
        content: '抱歉，没有找到相关内容。',
        display: '抱歉，没有找到相关内容。'
      })
    }
  } catch (error) {
    console.error('请求失败：', error)
    messages.value.push({
      role: 'bot',
      content: '网络错误，请稍后重试。',
      display: '网络错误，请稍后重试。'
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
  width: 380px;
  max-height: 520px;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(74, 108, 247, 0.25), 0 2px 8px rgba(0, 0, 0, 0.08);
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
  height: 440px;
  min-height: 300px;
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
  border-radius: 10px;
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.6;
}
.msg-label {
  font-size: 12px;
  color: #666;
  margin-right: 4px;
}
.msg-content {
  display: inline;
  max-height: 260px;
  overflow-y: auto;
}
.message.user {
  background: linear-gradient(135deg, #667eea, #4a6cf7);
  color: #fff;
  align-self: flex-end;
  text-align: right;
}
.message.user .msg-label {
  color: rgba(255, 255, 255, 0.85);
}
.message.bot {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #333;
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
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  outline: none;
  font-size: 13px;
  transition: border-color 0.2s;
}
.input-area input:focus {
  border-color: #4a6cf7;
}
.input-area button {
  padding: 8px 18px;
  background: linear-gradient(135deg, #4a6cf7, #6366f1);
  color: #fff;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: opacity 0.2s;
}
.input-area button:hover:not(:disabled) {
  opacity: 0.9;
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
  background: #999;
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
