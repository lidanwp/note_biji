import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// 角色元数据
// 注意：与 api/_lib/roundtableHandler.js 的 ROLES 是镜像定义
// 修改 tagline / icon 时必须同步另一处，否则前后端展示不一致
// icon 为角色头像 SVG 路径（原 emoji 已替换），指向 public/ 下的静态资源
export const ROLES = [
  { id: 'advocate',   name: '倡导者',   icon: '/倡导者.svg',   tagline: '支持观点，找论据' },
  { id: 'critic',     name: '批判者',   icon: '/反对者.svg',   tagline: '挑漏洞，指出风险' },
  { id: 'researcher', name: '研究专家', icon: '/资深专家.svg', tagline: '标注证据强度，报告未知与空白' },
  { id: 'moderator',  name: '主持人',   icon: '/主持人.svg',   tagline: '追问前提，标注未解决分歧' }
]

// 可配置常量
// 研究专家发言频率：第1轮固定不发言，第2轮起每 N 轮发言一次（N=2 → 第2、4、6…轮）
const RESEARCHER_SPEAK_EVERY_N_ROUNDS = 2

const DRAFT_KEY = 'roundtable_draft'

export const useRoundtableStore = defineStore('roundtable', () => {
  // ===== 状态 =====
  const topic = ref('')
  const totalRounds = ref(3)
  const currentRound = ref(0)
  const currentRoleIndex = ref(-1) // 当前正在发言的角色索引（-1 表示空闲）
  const messages = ref([]) // { id, role:'advocate'|'critic'|'researcher'|'moderator'|'user', roleName?, icon?, duty?, content, round, at }
  // duty：仅主持人消息有值，本轮执行的职责标签（深挖前提/引入缺席者/承接事实校准/前提追问/平衡校准）
  const isRunning = ref(false)
  const error = ref(null)
  // pending 元指令：用户发送的 kind:'meta' 消息暂存于此，作用于下一轮全部 speakOne，轮末自动清除
  const pendingMeta = ref(null)
  // 已完成发言步数（每次 speakOne 成功后 +1），用于进度条
  const currentStepCount = ref(0)

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
  // 旧消息无 kind 字段时按 'comment' 处理（向后兼容）
  const buildHistory = () => {
    return messages.value
      .slice(-8)
      .map(m => {
        if (m.role === 'user') {
          // meta 类型以 [元指令] 标记进入 history，与普通插话区分
          const label = m.kind === 'meta' ? '[元指令]' : '[用户插话]'
          return { role: 'user', content: `${label} ${m.content}` }
        }
        return { role: 'assistant', content: `[${m.roleName}] ${m.content}` }
      })
  }

  // ===== 单角色发言 =====
  // meta 参数：本轮快照的元指令文本（可能为 null），传给后端注入 system prompt
  const speakOne = async (roleId, meta = null) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'roundtable',
        topic: topic.value,
        history: buildHistory(),
        role: roleId,
        meta,            // 元指令文本，后端注入 system prompt
        round: currentRound.value
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
      icon: data.icon,          // 角色头像 SVG 路径（后端返回，由 ROLES 镜像定义）
      duty: data.duty || null,  // 仅主持人有值：本轮执行的职责标签，用于 UI 标记
      content: data.content,
      round: currentRound.value,
      at: new Date().toISOString()
    })
  }

  // ===== 主循环：条件调度（非固定轮询） =====
  // 调度规则：
  //   第1轮：倡导者 → 批判者（研究专家、主持人不发言，让观点先碰撞）
  //   第2轮起：倡导者 → 批判者 → [研究专家按频率发言] → 主持人（最后）
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
    pendingMeta.value = null // 重置 pending 元指令
    currentStepCount.value = 0 // 重置进度计数

    try {
      for (let r = 1; r <= totalRounds.value; r++) {
        if (!isRunning.value) break
        currentRound.value = r

        // 快照本轮元指令：作用于整轮全部 speakOne，轮末自动失效（不重复生效）
        const metaForRound = pendingMeta.value
        pendingMeta.value = null

        // 构建本轮发言顺序
        const speakers = ['advocate', 'critic']
        if (r > 1) {
          // 研究专家：第1轮不发言，第2轮起每 N 轮发言一次
          if (r >= 2 && (r % RESEARCHER_SPEAK_EVERY_N_ROUNDS === 0)) {
            speakers.push('researcher')
          }
          // 主持人：第1轮不发言，第2轮起每轮最后发言（前提追问 + 分歧标注）
          speakers.push('moderator')
        }

        for (let i = 0; i < speakers.length; i++) {
          if (!isRunning.value) break
          // currentRoleIndex 映射到 ROLES 数组索引，用于 UI 显示当前角色名
          currentRoleIndex.value = ROLES.findIndex(role => role.id === speakers[i])
          await speakOne(speakers[i], metaForRound)
          currentStepCount.value++ // 进度计数
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
  // kind: 'comment' — 普通插话，进入 history 作为上下文
  // kind: 'meta' — 元指令，暂存到 pendingMeta，作为下一轮 speakOne 的额外参数传给后端
  const interrupt = (text, kind = 'comment') => {
    const t = (text || '').trim()
    if (!t) return
    if (kind === 'meta') {
      // 元指令暂存，下一轮开始时快照并传给全部角色
      pendingMeta.value = t
    }
    messages.value.push({
      id: Date.now() + Math.random(),
      role: 'user',
      kind, // 旧消息无此字段时 buildHistory 按 'comment' 处理
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
    pendingMeta.value = null
  }

  const setTopic = (t) => { topic.value = t }
  // 轮数范围 1–5，默认 3；UI 用 +/- 步进器调整，不提供手动输入
  const MIN_ROUNDS = 1
  const MAX_ROUNDS = 5
  const setRounds = (n) => { totalRounds.value = Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, Number(n) || 3)) }

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
        const label = m.kind === 'meta' ? '⚡ 元指令' : '💬 用户插话'
        lines.push(`> **${label}**：${m.content}\n`)
      } else {
        // 角色头像已由 emoji 换成 SVG，Markdown 导出不再带图标（本地路径在外部编辑器里不可用）
        // 主持人额外带上本轮职责，便于回看四项职责是否被执行
        const dutyNote = m.duty ? `（本轮职责：${m.duty}）` : ''
        lines.push(`**${m.roleName}**${dutyNote}：${m.content}\n`)
      }
    }
    return lines.join('\n')
  }

  // ===== 计算属性 =====
  // 总步数随调度规则动态计算（第1轮2人，第2轮起每轮至少3人，研究专家按频率加入）
  const totalSteps = computed(() => {
    let total = 0
    for (let r = 1; r <= totalRounds.value; r++) {
      if (r === 1) total += 2 // 倡导者、批判者
      else {
        total += 3 // 倡导者、批判者、主持人
        if (r >= 2 && r % RESEARCHER_SPEAK_EVERY_N_ROUNDS === 0) total += 1 // 研究专家
      }
    }
    return total
  })
  const currentStep = computed(() => {
    if (!isRunning.value || currentRound.value === 0) return 0
    return currentStepCount.value
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
    start, stop, clear, interrupt, setTopic, setRounds, exportMarkdown,
    MIN_ROUNDS, MAX_ROUNDS
  }
})
