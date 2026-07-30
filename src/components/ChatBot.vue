<template>
  <div class="chat-bot">
    <div class="chat-header" @click="toggleChat">
      <span>🤖 AI 助手</span>
      <span>{{ isOpen ? '▼' : '▲' }}</span>
    </div>
    <div v-if="isOpen" class="chat-body">
      <div class="messages">
        <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.role]">
          <strong>{{ msg.role === 'user' ? '我' : '机器人' }}：</strong>
          <span>{{ msg.content }}</span>
        </div>
        <div v-if="loading" class="message bot">正在思考...</div>
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

// 知识库 ID
const DATASET_ID = '3b9ceef2-f214-402d-95f1-e40ba887bacf'
// 通过 Vercel rewrite 代理到 PandaWiki API，避免 CORS 问题
const API_URL = '/api/chat'

const isOpen = ref(false)
const question = ref('')
const loading = ref(false)
const messages = ref([
  { role: 'bot', content: '你好！我是 PandaWiki AI 助手，有什么可以帮助你的？' }
])

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

    // 处理返回结果（根据实际返回结构调整）
    if (data && data.results && data.results.length > 0) {
      const answer = data.results.map(r => r.text || r.content || JSON.stringify(r)).join('\n')
      messages.value.push({ role: 'bot', content: answer })
    } else if (data && data.answer) {
      messages.value.push({ role: 'bot', content: data.answer })
    } else {
      messages.value.push({ role: 'bot', content: '抱歉，没有找到相关内容。' })
    }
  } catch (error) {
    console.error('请求失败：', error)
    messages.value.push({ role: 'bot', content: '网络错误，请稍后重试。' })
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
  width: 360px;
  max-height: 500px;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  background: #ffffff;
  border: 1px solid #e0e0e0;
  overflow: hidden;
  font-family: sans-serif;
  z-index: 9999;
}
.chat-header {
  background: #4a6cf7;
  color: #fff;
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}
.chat-body {
  display: flex;
  flex-direction: column;
  height: 400px;
}
.messages {
  flex: 1;
  padding: 12px 16px;
  overflow-y: auto;
  background: #f9fafb;
}
.message {
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  word-wrap: break-word;
}
.message.user {
  background: #e3f0ff;
  align-self: flex-end;
  text-align: right;
}
.message.bot {
  background: #fff;
  border: 1px solid #e5e7eb;
}
.input-area {
  display: flex;
  padding: 8px 12px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.input-area input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
  font-size: 14px;
}
.input-area input:focus {
  border-color: #4a6cf7;
}
.input-area button {
  margin-left: 8px;
  padding: 8px 16px;
  background: #4a6cf7;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.input-area button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
