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

// 角色元数据（前端 store 镜像同一份定义）
export const ROLES = [
  { id: 'advocate',   name: '倡导者',   emoji: '🟢', tagline: '支持观点，找论据' },
  { id: 'critic',     name: '批判者',   emoji: '🔴', tagline: '挑漏洞，指出风险' },
  { id: 'researcher', name: '研究专家', emoji: '🔵', tagline: '补充事实、案例、数据' },
  { id: 'moderator',  name: '主持人',   emoji: '🟡', tagline: '总结分歧，推进讨论' }
]

// 角色 system prompt 构造
function buildRolePrompt(roleId, topic) {
  const base = `你正在参与一场关于「${topic}」的圆桌讨论。`
  const common = '每次发言 80-150 字，直接说观点，不要寒暄、不要复述别人说过的话、不要用「作为XX者」开头。'

  switch (roleId) {
    case 'advocate':
      return `${base}你是【倡导者】，立场是支持该方向。任务：给出论据、例子、逻辑链条；如有反对意见在前序发言中，直接反驳。${common}`
    case 'critic':
      return `${base}你是【批判者】，立场是审慎质疑。任务：指出风险、漏洞、反例、边界条件、未言明的假设。${common}`
    case 'researcher':
      return `${base}你是【研究专家】，立场是补充事实。任务：给出数据、案例、行业实践、相关研究、可验证的来源。${common}`
    case 'moderator':
      return `${base}你是【主持人】。任务：先复述本轮的核心分歧点（一句话），再抛一个更具体的问题推进下一轮。${common}`
    default:
      return base
  }
}

/**
 * 圆桌讨论单角色发言 handler
 * @param {Object} req - Vercel 请求对象
 * @param {Object} res - Vercel 响应对象
 * @param {Object} body - 已由 chat.js 解析好的请求体 { mode, topic, history, role }
 */
export async function handleRoundtable(req, res, body) {
  const { topic, history = [], role } = body

  if (!topic || !role) {
    return res.status(400).json({ error: '缺少 topic 或 role' })
  }

  const roleDef = ROLES.find(r => r.id === role)
  if (!roleDef) {
    return res.status(400).json({ error: '未知角色: ' + role })
  }

  // 组装 messages：system(角色 prompt) + history(前序发言) + user(本次发言请求)
  const messages = [
    { role: 'system', content: buildRolePrompt(roleDef.id, topic) },
    ...history.slice(-8), // 只取最近 8 条，控制 token
    { role: 'user', content: `现在轮到你（${roleDef.name}）发言。` }
  ]

  try {
    const content = await callLLM({
      messages,
      temperature: 0.9, // 圆桌讨论需要观点多样性
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
