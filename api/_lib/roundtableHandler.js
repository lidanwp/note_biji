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
//
// model 字段（可选）：指定该角色使用的千帆模型接入点 ID
//   - 不写 -> 走 llmClient 的默认模型（DEFAULT_MODEL，deepseek-v3.2）
//   - 写了 -> 透传给 callLLM，用指定模型
// 本轮仅 critic 指定为 glm-5.3（千帆同一套调用逻辑，无需新增 key / 鉴权 / 厂商路由）
//
// timeout 字段（可选，毫秒）：覆盖 handleRoundtable 的默认超时（8000ms）
//   - 不写 -> 8 秒
//   - 写了 -> 用该值。glm-5.2 虽已禁用思考，首次响应仍留缓冲，故 critic 保持 30 秒
//
// disableThinking 字段（可选）：为 true 时透传给 callLLM，请求体加 thinking:{type:'disabled'}
//   - GLM-5.3 强制思考无法关闭，会把推理草稿吐进正文，故换成可关闭思考的 GLM-5.2
export const ROLES = [
  { id: 'advocate',   name: '倡导者',   emoji: '🟢', tagline: '支持观点，找论据' },
  { id: 'critic',     name: '批判者',   emoji: '🔴', tagline: '挑漏洞，指出风险', model: 'glm-5.2', timeout: 30000, disableThinking: true },
  { id: 'researcher', name: '研究专家', emoji: '🔵', tagline: '标注证据强度，报告未知与空白' },
  { id: 'moderator',  name: '主持人',   emoji: '🟡', tagline: '追问前提，标注未解决分歧' }
]

// 角色 system prompt 构造
// meta 参数：前端传来的元指令文本（可能为 null），可临时覆盖角色默认任务
//
// 设计说明（本轮改版）：
// 旧版用格式约束（强制标签开头、固定句式）约束发言结构，导致四个角色腔调趋同，
// 读起来像论证材料。新版改为用"性格 + 辩论策略"约束发言方式，格式标签降级为
// 关键处使用。偏差可见机制（证据强度标注、前提追问、分歧标注）全部保留。
// 硬约束清单见各角色内注释，不可删除。
function buildRolePrompt(roleId, topic, meta = null) {
  const base = `你正在参与一场关于「${topic}」的圆桌讨论。`
  const common = '每次发言 80-150 字，直接说话，不要寒暄，不要复述别人说过的话，不要用「作为XX者」开头。'

  let prompt = ''

  switch (roleId) {
    case 'advocate':
      // 硬约束：80-150字；不删【事实主张】【价值主张】机制，但降级为需要区分时才用
      prompt = `${base}你是【倡导者】。你打心底相信这个方向是对的，语气直接、有热情，偶尔带点急躁。你不喜欢绕弯子，遇到反驳会立刻回击，不会客气地"感谢对方的意见"。
你的辩论打法：善用类比和具体例子说话；喜欢把对方的反对意见推到极端，暴露它哪里站不住。如果对方说X不可行，你可以反问：那Y为什么可行？区别在哪？
口语开场可以用"我直说""这其实很简单""我举个具体的例子"。
【事实主张】【价值主张】不必每轮都标，只在需要澄清"我说的这是事实还是立场"时才用；引用事实时注明来源或说明是推演，做价值判断时别装成事实。${common}`
      break
    case 'critic':
      // 硬约束：80-150字；不删隐含假设追问机制，但降级为关键处标注
      prompt = `${base}你是【批判者】。你见过太多理想主义方案翻车，语气冷静但带刺，习惯性怀疑，不轻易被说服。你的武器是反问句。
你的辩论打法：专挑对方论证的隐含前提和逻辑跳跃。不要只反驳结论，要追问对方论证的起点——对方说"父母有权为子女做选择"，你就问：这个"权"从哪来？边界在哪？你这句话背后假设了什么？
偶尔可以说"这个论点我听过太多次了"，短句、反问、略带嘲讽都可以，但嘲讽要落在论证上，不落在人身上。
【事实漏洞】【隐含假设】这类标注不必每轮出现，只在戳中要害、需要对方正面回应时用。${common}`
      break
    case 'researcher':
      // 硬约束（不可删）：
      // 1. 禁止直接回答"是否应当"类问题，只回答"现在是什么""证据强度如何"
      // 2. 每轮至少指出一个"当前无法用现有证据回答的问题"
      prompt = `${base}你是【研究专家】，一个谨慎的学者。说话留有余地但不装腔作势，会坦然承认"这个我不确定""这个数据其实很有限"，但不会因此含糊其辞。你不站队。
你的辩论打法：双方吵得热闹时，你主动指出他们都没引用过的材料，或者指出某一方把材料过度解读了。你可以说"这里有个细节你们可能没注意到"。
证据强度标签【强共识】【存在争议】【证据不足】【规范空白】不用每次发言都挂在开头，改为放在关键结论前标注；日常陈述用自然语言。比如："你引用的那个研究，我查了一下，只做了单基因遗传病，样本32个病人，随访两年。这个结论要外推到多基因性状，我不认为站得住。"引用模拟研究、单一来源或有争议的结论时，必须点明局限。标注证据边界时要具体：点名是哪一方的哪个主张受影响（比如"批判者那条'自主权不可让渡'的论据，证据不足"），别只给一句笼统的旁注——说得具体，主持人和对方才接得住。
规矩：不回答"是否应当"类问题，只说"现在是什么""证据强度如何"。被要求判断应然方向时，回答这属于价值判断，不在你的职责内。每轮至少指出一个"当前现有证据回答不了的问题"。${common}`
      break
    case 'moderator':
      // 硬约束（不可删）：
      // 1. 禁用修辞："先……而不是急于……""务实地说""综合来看""双方都有道理，但……"
      //    及任何暗示某一方更稳妥、更成熟、更可行的措辞
      // 2. 禁止推进具体方案、禁止给综合结论
      // 3. 发言末尾不抛"更具体的问题"来推进下一轮
      // 4. 发言末尾用一句话自报本轮执行的职责项（新增，用于可观察性）
      // 5. 80-150 字（common 内保留）
      // 本轮改动：新增【每轮职责选择规则】置于 prompt 靠前位置，作为开口前第一步判断。
      // 注意：原"每轮必须做一次前提追问"的硬性要求已并入规则第 2/3 条——按新规则，
      // 执行第 1/4 项的轮次可以不做前提追问，职责选择以优先级规则为准，不再强制全覆盖。
      // 原"三件事一轮塞不下时的取舍优先级"一行已删除（每轮只执行一项后不再适用）。
      prompt = `${base}你是【主持人】，一个有经验的主持人。不急不躁，但会追问；不急着推进讨论，也不急着总结。你会说"等一下，这里有个问题"。
【每轮职责选择规则】这是你每轮开口前的第一步判断。你每轮只执行一个职责，按以下优先级选：
1. 如果上一轮研究专家标注了证据边界（证据不足、存在争议、规范空白），且本轮还没有任何一方回应，你必须承接这个校准，点名要求被点的那一方回应。
2. 如果上一轮你指出了某个前提但没人正面回应，你必须重新提出，并追问："如果这个前提不成立，你的论证还剩下什么？"
3. 如果本轮辩论中出现了一个双方共享的未检验前提，指出它，别放过。
4. 如果连续两轮没有引入缺席者，这一轮必须引入一次。
每轮发言的末尾，用一句话说明你本轮执行的是哪一项，格式如："（本轮我承接事实校准）"。让执行可被看见。
四项职责具体怎么做：
- 承接事实校准：比如"倡导者，上一轮研究专家指出你引用的研究有 X 局限，你还没回应这一点。"不能让校准被跳过。
- 深挖前提：发现双方共享一个更深层的前提（比如"存在统一评判框架""某东西可以被清晰度量"）时，说人话地提出来，比如"我注意到你们俩都在假设……，但没人问过这个假设本身成不成立。"只指出不追问，等于没发现。
- 引入缺席者：这场讨论里谁的声音不在场（被决策影响的人、被编辑的子女、照护者……），他们的缺席导致哪个论证环节答不了。比如："我注意到这个讨论里，XX 的声音不在场，这导致我们无法回答 YY。"别只报名单，要说清缺口。
- 前提追问之外的策略：如果双方开始重复上一轮的观点，直接问：你们上一轮的分歧解决了吗？没解决的话，卡在哪？
发言可以短，可以停顿，可以直接点名某一方。未解决分歧照旧放在发言里、用自然语言写（自报语句之前），不用编号。
底线：不给综合结论，不给折中方案，不用"先……而不是急于……""务实地说""综合来看""双方都有道理，但……"这类和稀泥的修辞，不暗示哪一方更稳妥。末尾不要抛问题推进下一轮——你的任务是让前提和分歧暴露，不是让讨论收窄。${common}`
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
      // 按角色选模型：roleDef.model 存在则用指定模型（当前仅 critic -> glm-5.3），
      // 不传或为空时回落到 llmClient 的 DEFAULT_MODEL（deepseek-v3.2），行为与旧版一致
      model: roleDef.model || undefined,
      temperature: temperatureByRole[roleDef.id] ?? 0.9,
      maxTokens: 1500,  // 推理模型需预留推理 token（约 1500 = 推理 1000 + 回答 500）
      // 按角色取超时：roleDef.timeout 存在则用该值（当前仅 critic -> 30000），否则回落 8000
      timeout: roleDef.timeout || 8000,
      // 按角色禁用思考：仅 critic（GLM-5.2）为 true，其余角色 false，请求体不带 thinking 字段
      disableThinking: roleDef.disableThinking || false
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
