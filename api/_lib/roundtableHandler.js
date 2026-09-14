// ============================================================================
// roundtableHandler.js — AI 圆桌讨论单角色发言逻辑
// ----------------------------------------------------------------------------
// 注意：本文件位于 api/_lib/，不算 Vercel Serverless Function
// 由 api/chat.js 通过 body.mode === 'roundtable' 分流调用
//
// 调用约定：前端 POST /api/chat { mode:'roundtable', topic, history, role }
// 响应体：{ role, roleName, emoji, content }
//
// 无状态：所有上下文由前端通过 history 传入，后端不持久化
// ============================================================================

import { callLLM } from './llmClient.js'

// 角色元数据
// 注意：与 src/stores/roundtable.js 的 ROLES 是镜像定义
// 修改 tagline 时必须同步另一处，否则前后端展示不一致
export const ROLES = [
  { id: 'advocate',   name: '倡导者',   emoji: '🟢', tagline: '支持观点，找论据' },
  { id: 'critic',     name: '批判者',   emoji: '🔴', tagline: '挑漏洞，指出风险' },
  { id: 'researcher', name: '研究专家', emoji: '🔵', tagline: '标注证据强度，报告未知与空白' },
  { id: 'moderator',  name: '主持人',   emoji: '🟡', tagline: '追问前提，标注未解决分歧' }
]

// 角色 system prompt 构造
// meta 参数：前端传来的元指令文本（可能为 null），可临时覆盖角色默认任务
function buildRolePrompt(roleId, topic, meta = null) {
  const base = `你正在参与一场关于「${topic}」的圆桌讨论。`
  const common = '每次发言 80-150 字，直接说观点，不要寒暄、不要复述别人说过的话、不要用「作为XX者」开头。'

  let prompt = ''

  switch (roleId) {
    case 'advocate':
      prompt = `${base}你是【倡导者】，立场是支持该方向。任务：给出论据、例子、逻辑链条；如有反对意见在前序发言中，直接反驳。
你的论证必须区分【事实主张】和【价值主张】。当你引用事实时，注明来源或说明这是推演；当你做价值判断时，明确说这是价值判断。${common}`
      break
    case 'critic':
      prompt = `${base}你是【批判者】，立场是审慎质疑。任务：指出风险、漏洞、反例、边界条件、未言明的假设。
你不仅要指出对方论据的漏洞，还要指出对方论证所依赖的、未被言明的前提假设。${common}`
      break
    case 'researcher':
      prompt = `${base}你是【研究专家】，职能是标注证据强度，报告未知与空白。
每次发言必须以下列标签之一开头（第一个字符即标签）：
- 【强共识】：多个独立来源、长期稳定、无重大争议
- 【存在争议】：学界或实务界有实质分歧
- 【证据不足】：只有单一来源，或仅有模拟/推演，或样本有限
- 【规范空白】：现行法或行业规范未涉及，不等于"不支持"
禁止直接回答"是否应当"类问题。只回答"现在是什么""证据强度如何""有哪些来源"。如果被要求判断应然方向，回答："这属于价值判断，不在我的职能范围内。"
每轮至少指出一个"当前无法用现有证据回答的问题"。
如果引用了模拟研究、单一来源、有争议的结论，必须明确标注其局限性。${common}`
      break
    case 'moderator':
      prompt = `${base}你是【主持人】，职能是【前提追问者】和【分歧标注者】，不是总结者，不是推进者。
每轮发言必须做以下两件事，按顺序：
1. 指出本轮讨论中，双方（或多方）共享的、未经检验的前提假设。格式："本轮各方共享的未检验前提是：……"
2. 列出本轮未解决的分歧点。格式："未解决分歧：1. …… 2. ……" 不要给出综合结论，不要给折中方案。
禁止使用以下修辞：
- "先……而不是急于……"
- "务实地说……"
- "综合来看……"
- "双方都有道理，但……"
- 任何暗示某一方更稳妥、更成熟、更可行的措辞
发言末尾不要抛"更具体的问题"来推进下一轮。你的任务是让前提和分歧暴露出来，不是让讨论收窄。${common}`
      break
    default:
      prompt = base
  }

  // 元指令注入：优先级高于角色默认任务，可临时覆盖
  if (meta) {
    prompt += `\n【本轮元指令】${meta}\n你必须优先执行这条指令，它可以覆盖你默认的任务描述。`
  }

  return prompt
}

/**
 * 圆桌讨论单角色发言 handler
 * @param {Object} req - Vercel 请求对象
 * @param {Object} res - Vercel 响应对象
 * @param {Object} body - 已由 chat.js 解析好的请求体 { mode, topic, history, role, meta, round }
 */
export async function handleRoundtable(req, res, body) {
  const { topic, history = [], role, meta = null } = body

  if (!topic || !role) {
    return res.status(400).json({ error: '缺少 topic 或 role' })
  }

  const roleDef = ROLES.find(r => r.id === role)
  if (!roleDef) {
    return res.status(400).json({ error: '未知角色: ' + role })
  }

  // 组装 messages：system(角色 prompt + 元指令) + history(前序发言) + user(本次发言请求)
  const messages = [
    { role: 'system', content: buildRolePrompt(roleDef.id, topic, meta) },
    ...history.slice(-8), // 只取最近 8 条，控制 token
    { role: 'user', content: `现在轮到你（${roleDef.name}）发言。` }
  ]

  // 角色差异化 temperature
  // 研究专家：事实性内容需要稳定 → 0.3
  // 主持人：需要一定灵活性但不要发散 → 0.5
  // 倡导者、批判者：需要观点多样性 → 0.9
  const temperatureByRole = {
    researcher: 0.3,
    moderator: 0.5,
    advocate: 0.9,
    critic: 0.9
  }

  try {
    const content = await callLLM({
      messages,
      temperature: temperatureByRole[roleDef.id] ?? 0.9,
      maxTokens: 1500,  // 推理模型需预留推理 token（约 1500 = 推理 1000 + 回答 500）
      timeout: 8000
    })

    return res.status(200).json({
      role: roleDef.id,
      roleName: roleDef.name,
      emoji: roleDef.emoji,
      content
    })
  } catch (e) {
    console.error('[roundtable] LLM 调用失败:', e.message)
    return res.status(500).json({ error: e.message || 'LLM 调用失败' })
  }
}
