import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// 角色元数据（与 api/roundtable.js 的 ROLES 镜像同一份定义）
export const ROLES = [
  { id: 'advocate',   name: '倡导者',   emoji: '🟢', tagline: '支持观点，找论据' },
  { id: 'critic',     name: '批判者',   emoji: '🔴', tagline: '挑漏洞，指出风险' },
  { id: 'researcher', name: '研究专家', emoji: '🔵', tagline: '补充事实、案例、数据' },
  { id: 'moderator',  name: '主持人',   emoji: '🟡', tagline: '总结分歧，推进讨论' }
]

const DRAFT_KEY = 'roundtable_draft'

export const useRoundtableStore = defineStore('roundtable', () => {
  // ===== 状态 =====
  const topic = ref('')
  const totalRounds = ref(3)
  const currentRound = ref(0)
  const currentRoleIndex = ref(-1) // 当前正在发言的角色索引（-1 表示空闲）
  const messages = ref([]) // { id, role:'advocate'|'critic'|'researcher'|'moderator'|'user', roleName?, emoji?, content, round, at }
  const isRunning = ref(false)
  const error = ref(null)

  // ===== 持久化：当前会话草稿（刷新可恢复） =====
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (!saved) return
      const d = JSON.parse(saved)
      if (d.topic) topic.value = d.topic
      if (d.messages) messages.value = d.messages
      // 不恢复 isRunning（断点续跑太复杂，留给用户重开）
    } catch (e) {
      console.warn('[roundtable] 草稿恢复失败:', e)
    }
  }

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        topic: topic.value,
        messages: messages.value.slice(-50) // 最多存 50 条，防爆 localStorage
      }))
    } catch (e) {
      console.warn('[roundtable] 草稿保存失败:', e)
    }
  }

  loadDraft()
  watch([topic, messages], saveDraft, { deep: true })

  // ===== 给 LLM 的 history（最近 8 条，OpenAI 格式） =====
  const buildHistory = () => {
    return messages.value
      .slice(-8)
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.role === 'user'
          ? `[用户插话] ${m.content}`
          : `[${m.roleName}] ${m.content}`
      }))
  }

  // ===== 单角色发言 =====
  const speakOne = async (roleId) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'roundtable',
        topic: topic.value,
        history: buildHistory(),
        role: roleId
      })
    })

    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error || `请求失败: ${res.status}`)
    }

    const data = await res.json()
    messages.value.push({
      id: Date.now() + Math.random(),
      role: data.role,
      roleName: data.roleName,
      emoji: data.emoji,
      content: data.content,
      round: currentRound.value,
      at: new Date().toISOString()
    })
  }

  // ===== 主循环：逐轮逐角色 =====
  const start = async () => {
    if (!topic.value.trim()) {
      error.value = '请输入讨论主题'
      return false
    }
    if (isRunning.value) return false

    error.value = null
    isRunning.value = true
    // 新一轮讨论开始时清空旧消息
    messages.value = []
    currentRound.value = 0
    currentRoleIndex.value = -1

    try {
      for (let r = 1; r <= totalRounds.value; r++) {
        if (!isRunning.value) break
        currentRound.value = r
        for (let i = 0; i < ROLES.length; i++) {
          if (!isRunning.value) break
          currentRoleIndex.value = i
          await speakOne(ROLES[i].id)
        }
      }
      return true
    } catch (e) {
      error.value = e.message
      return false
    } finally {
      isRunning.value = false
      currentRoleIndex.value = -1
    }
  }

  // ===== 插话 =====
  const interrupt = (text) => {
    const t = (text || '').trim()
    if (!t) return
    messages.value.push({
      id: Date.now() + Math.random(),
      role: 'user',
      content: t,
      round: currentRound.value || 0,
      at: new Date().toISOString()
    })
  }

  // ===== 控制 =====
  const stop = () => { isRunning.value = false }

  const clear = () => {
    if (isRunning.value) return
    messages.value = []
    currentRound.value = 0
    currentRoleIndex.value = -1
    error.value = null
  }

  const setTopic = (t) => { topic.value = t }
  const setRounds = (n) => { totalRounds.value = Math.max(1, Math.min(10, Number(n) || 3)) }

  // ===== 导出 Markdown =====
  const exportMarkdown = () => {
    if (!messages.value.length) return ''
    const lines = [`# 圆桌讨论：${topic.value}`, '']
    let lastRound = 0
    for (const m of messages.value) {
      if (m.round !== lastRound) {
        lines.push(`\n## 第 ${m.round} 轮\n`)
        lastRound = m.round
      }
      if (m.role === 'user') {
        lines.push(`> 💬 **用户插话**：${m.content}\n`)
      } else {
        lines.push(`**${m.emoji} ${m.roleName}**：${m.content}\n`)
      }
    }
    return lines.join('\n')
  }

  // ===== 计算属性 =====
  const totalSteps = computed(() => totalRounds.value * ROLES.length)
  const currentStep = computed(() => {
    if (!isRunning.value || currentRound.value === 0) return 0
    return (currentRound.value - 1) * ROLES.length + currentRoleIndex.value + 1
  })
  const progress = computed(() => totalSteps.value ? Math.round(currentStep.value / totalSteps.value * 100) : 0)
  const currentRoleName = computed(() => {
    if (currentRoleIndex.value < 0) return ''
    return ROLES[currentRoleIndex.value]?.name || ''
  })

  return {
    // state
    topic, totalRounds, currentRound, currentRoleIndex, messages,
    isRunning, error, ROLES,
    // computed
    totalSteps, currentStep, progress, currentRoleName,
    // actions
    start, stop, clear, interrupt, setTopic, setRounds, exportMarkdown
  }
})
