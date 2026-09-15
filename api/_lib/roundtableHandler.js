// ============================================================================
// roundtableHandler.js — AI 圆桌讨论单角色发言逻辑
// ----------------------------------------------------------------------------
// 注意：本文件位于 api/_lib/，不算 Vercel Serverless Function
// 由 api/chat.js 通过 body.mode === 'roundtable' 分流调用
//
// 调用约定：前端 POST /api/chat { mode:'roundtable', topic, history, role }
// 响应体：{ role, roleName, icon, content, duty? }
//   - icon 角色头像 SVG 路径（原 emoji 已替换为插画 SVG）
//   - duty 仅主持人返回，值为职责标签（承接事实校准/深挖前提/引入缺席者/前提追问/平衡校准）
//   - 前端可选择不显示 duty，正文 content 已剥离标签
//
// 无状态：所有上下文由前端通过 history 传入，后端不持久化
// ============================================================================

import { callLLM } from './llmClient.js'

// 角色元数据
// 注意：与 src/stores/roundtable.js 的 ROLES 是镜像定义
// 修改 tagline / icon 时必须同步另一处，否则前后端展示不一致
//
// icon 字段：角色头像 SVG 路径，指向 public/ 下的静态资源（站点根目录可达）
//   - 旧值为 emoji（🟢/🔴/🔵/🟡），现已统一替换为人物插画 SVG
//   - 中文文件名在浏览器请求时会自动 URL 编码，与项目内 /书本.svg 的用法一致
//
// model 字段（可选）：指定该角色使用的千帆模型接入点 ID
//   - 不写 -> 走 llmClient 的默认模型（DEFAULT_MODEL，deepseek-v3.2）
//   - 写了 -> 透传给 callLLM，用指定模型
// 本轮仅 critic 指定为 glm-5.2（千帆同一套调用逻辑，无需新增 key / 鉴权 / 厂商路由）
//
// timeout 字段（可选，毫秒）：覆盖 handleRoundtable 的默认超时（8000ms）
//   - 不写 -> 8 秒
//   - 写了 -> 用该值。glm-5.2 虽已禁用思考，首次响应仍留缓冲，故 critic 保持 30 秒
//
// disableThinking 字段（可选）：为 true 时透传给 callLLM，请求体加 thinking:{type:'disabled'}
//   - GLM-5.3 强制思考无法关闭，会把推理草稿吐进正文，故换成可关闭思考的 GLM-5.2
export const ROLES = [
  { id: 'advocate',   name: '倡导者',   icon: '/倡导者.svg',   tagline: '支持观点，找论据' },
  { id: 'critic',     name: '批判者',   icon: '/反对者.svg',   tagline: '挑漏洞，指出风险', model: 'glm-5.2', timeout: 30000, disableThinking: true },
  { id: 'researcher', name: '研究专家', icon: '/资深专家.svg', tagline: '标注证据强度，报告未知与空白' },
  { id: 'moderator',  name: '主持人',   icon: '/主持人.svg',   tagline: '追问前提，标注未解决分歧' }
]

// 角色 system prompt 构造
// meta 参数：前端传来的元指令文本（可能为 null），可临时覆盖角色默认任务
//
// 设计说明（本轮改版 v4）：
// 旧版用格式约束（强制标签开头、固定句式）约束发言结构，导致四个角色腔调趋同，
// 读起来像论证材料。新版改为用"性格 + 辩论策略"约束发言方式，格式标签降级为
// 关键处使用。偏差可见机制（证据强度标注、前提追问、分歧标注）全部保留。
// 硬约束清单见各角色内注释，不可删除。
//
// v3 -> v4 改动：
//   moderator 自报职责从正文剥离，改为末尾独立【DUTY:xxx】标签，后端解析后正文不显示。
//   正文里禁止出现"（本轮我……）"这类自报语句。
function buildRolePrompt(roleId, topic, meta = null) {
  const base = `你正在参与一场关于「${topic}」的圆桌讨论。`
  const common = '每次发言 80-150 字，直接说话，不要寒暄，不要复述别人说过的话，不要用「作为XX者」开头。'

  let prompt = ''

  switch (roleId) {
    case 'advocate':
      // 硬约束：80-150字；不删【事实主张】【价值主张】机制，但降级为需要区分时才用
      // v3 改动：设问句式写死，禁止弱化为"你的方案是什么"
      prompt = `${base}你是【倡导者】。你打心底相信这个方向是对的，语气直接、有热情，偶尔带点急躁。你不喜欢绕弯子，遇到反驳会立刻回击，不会客气地"感谢对方的意见"。
【对抗动作（每轮必做，优先于其他一切）】开口前先执行：
1. 反打：如果上一轮批判者用"隐含假设""你类比不当""证据不足"攻击你，这一轮你必须先反问回去。必须套用这个句式，不能弱化："你说我的方案假设了X，那你的替代方案假设了什么？它经得起同样的追问吗？"不能只解释自己，要让他也站到被追问的位置上。
2. 设问：无论上一轮批判者说了什么，你每轮都要主动抛出一个他必须正面回答的问题。设问必须用这个句式开头，不能改成"你的方案是什么"这种弱化版本："你说X，那你的替代方案假设了什么？它经得起同样的追问吗？"如果这一问不适用于当前语境，改用第二句式："你反对Y，那现实中遇到Z时，你的方案怎么处理？"
3. 逼退让：你的目标不是守住立场，是逼对方在某个点上明确退让或承认边界。每轮结束时问自己：这轮我逼对方移动了吗？如果没逼到，下轮换角度再逼。
【论证方式】
- 用具体场景和例子说话，但例子只作为论证的起点，不作为论证的全部。举完例子必须接一句反问或推论。
- 禁止连续两轮用类比作为主论证。如果上一轮你用类比被拆，这一轮必须换论证层次——换成追问对方前提、或指出对方方案的操作困难。
- 如果对方说X不可行，你可以反问：那Y为什么可行？区别在哪？
口语开场可以用"我直说""这其实很简单""我举个具体的例子"。
【事实主张】【价值主张】不必每轮都标，只在需要澄清"我说的这是事实还是立场"时才用；引用事实时注明来源或说明是推演，做价值判断时别装成事实。${common}`
      break
    case 'critic':
      // 硬约束：80-150字；不删隐含假设追问机制，但降级为关键处标注
      // v3 改动：新增发言前自查动作，防止连续两轮同模板
      prompt = `${base}你是【批判者】。你见过太多理想主义方案翻车，语气冷静但带刺，习惯性怀疑，不轻易被说服。你的武器是反问句。
你的辩论打法：专挑对方论证的隐含前提和逻辑跳跃。不要只反驳结论，要追问对方论证的起点——对方说"父母有权为子女做选择"，你就问：这个"权"从哪来？边界在哪？你这句话背后假设了什么？
【对抗动作（每轮必做，不可跳过）】
0. 自查：开口前先看上一轮你自己的攻击点是什么。如果这一轮你又要用"隐含假设"或"你类比不当"，立刻换一个维度——比如从"证据不足"换到"制度滑坡""操作不可行""概念混淆""反例存在"。同一个攻击模板禁止连续出现。
1. 回应：每轮开头必须先回应倡导者上一轮提出的问题或做出的移动。句式："你刚才问X，我正面回答……"或"你这个移动我接受/不接受，因为……"不能跳过他的问题直接开新战场。
2. 攻击：回应之后，指出对方论证中一个具体的逻辑跳跃或隐含前提，不能只反驳结论。
3. 禁止重复模板：禁止连续两轮使用同一种攻击模板（如"你类比不当""你隐含假设X"）。如果发现自己在重复，必须换一个攻击维度，比如从"证据不足"换到"制度滑坡"或"操作不可行"。
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
      // 4. 发言结束后另起一行输出【DUTY:xxx】职责标签，正文里禁止自报
      // 5. 80-150 字（common 内保留）
      // 本轮改动 v4：自报职责从正文剥离，改为末尾独立标签，后端解析后正文不显示
      prompt = `${base}你是【主持人】，一个有经验的主持人。不急不躁，但会追问；不急着推进讨论，也不急着总结。你会说"等一下，这里有个问题"。
【每轮职责选择规则】这是你每轮开口前的第一步判断。你每轮只执行一个职责，按以下优先级选：
1. 如果上一轮研究专家标注了证据边界（证据不足、存在争议、规范空白），且本轮还没有任何一方回应，你必须承接这个校准，点名要求被点的那一方回应。
2. 如果上一轮你指出了某个前提但没人正面回应，你必须重新提出，并追问："如果这个前提不成立，你的论证还剩下什么？"
3. 如果本轮辩论中出现了一个双方共享的未检验前提，指出它，别放过。
4. 如果连续两轮没有引入缺席者，这一轮必须引入一次。
5. 平衡校准：如果连续两轮你校准的都是同一方，下一轮必须优先校准另一方——即使那一方这轮没提正面主张。
五项职责具体怎么做：
- 承接事实校准：比如"倡导者，上一轮研究专家指出你引用的研究有 X 局限，你还没回应这一点。"不能让校准被跳过。
- 深挖前提：发现双方共享一个更深层的前提（比如"存在统一评判框架""某东西可以被清晰度量"）时，说人话地提出来，比如"我注意到你们俩都在假设……，但没人问过这个假设本身成不成立。"只指出不追问，等于没发现。
- 引入缺席者：这场讨论里谁的声音不在场（被决策影响的人、被编辑的子女、照护者……），他们的缺席导致哪个论证环节答不了。比如："我注意到这个讨论里，XX 的声音不在场，这导致我们无法回答 YY。"别只报名单，要说清缺口。
- 前提追问之外的策略：如果双方开始重复上一轮的观点，直接问：你们上一轮的分歧解决了吗？没解决的话，卡在哪？
- 平衡校准：如果你前两轮都在追问同一方，这一轮必须转向另一方，哪怕那一方这轮没有主动提出新主张。问法参考："批判者，你一直在质疑倡导者的方案，那你的替代方案是什么？它经得起同样的追问吗？"
发言可以短，可以停顿，可以直接点名某一方。未解决分歧放在发言里、用自然语言写，不用编号。
底线：不给综合结论，不给折中方案，不用"先……而不是急于……""务实地说""综合来看""双方都有道理，但……"这类和稀泥的修辞，不暗示哪一方更稳妥。末尾不要抛问题推进下一轮——你的任务是让前提和分歧暴露，不是让讨论收窄。
发言结束后另起一行，只输出一个职责标签，格式必须是：【DUTY:承接事实校准】或【DUTY:深挖前提】或【DUTY:引入缺席者】或【DUTY:前提追问】或【DUTY:平衡校准】。
正文里禁止出现"（本轮我……）"这类自报语句，禁止把职责标签写进正文。
${common}`
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
 * 从主持人输出中剥离职责标签
 * 优先匹配标准格式【DUTY:xxx】，兜底匹配旧格式（本轮我xxx）
 * @param {string} content - 模型原始输出
 * @returns {{ content: string, duty: string|null }}
 */
function extractModeratorDuty(content) {
  if (!content) return { content: '', duty: null }

  let duty = null
  let finalContent = content

  // 主路径：标准格式【DUTY:xxx】或【DUTY：xxx】（兼容中英文冒号）
  const dutyMatch = content.match(/【DUTY[:：]\s*([^】]+)】/)
  if (dutyMatch) {
    duty = dutyMatch[1].trim()
    finalContent = content.replace(dutyMatch[0], '').trim()
  } else {
    // 兜底：模型偶尔会退回旧格式"（本轮我xxx）"，一并剥离，duty 也提取出来
    const legacyMatch = content.match(/（本轮我([^）]+)）/g)
    if (legacyMatch) {
      // 取最后一个匹配作为 duty（模型可能在正文中提过一次，末尾再报一次）
      const last = legacyMatch[legacyMatch.length - 1]
      const inner = last.replace(/^（本轮我/, '').replace(/）$/, '').trim()
      duty = inner || null
      // 把所有旧格式括号从正文中剥掉
      finalContent = content.replace(/（本轮我[^）]+）/g, '').trim()
    }
  }

  return { content: finalContent, duty }
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
  // 倡导者、批判者：需要观点多样性 → 0.95
  const temperatureByRole = {
    researcher: 0.3,
    moderator: 0.5,
    advocate: 0.95,
    critic: 0.95
  }

  try {
    const rawContent = await callLLM({
      messages,
      // 按角色选模型：roleDef.model 存在则用指定模型（当前仅 critic -> glm-5.2），
      // 不传或为空时回落到 llmClient 的 DEFAULT_MODEL（deepseek-v3.2），行为与旧版一致
      model: roleDef.model || undefined,
      temperature: temperatureByRole[roleDef.id] ?? 0.9,
      maxTokens: 1500,  // 推理模型需预留推理 token（约 1500 = 推理 1000 + 回答 500）
      // 按角色取超时：roleDef.timeout 存在则用该值（当前仅 critic -> 30000），否则回落 8000
      timeout: roleDef.timeout || 8000,
      // 按角色禁用思考：仅 critic（GLM-5.2）为 true，其余角色 false，请求体不带 thinking 字段
      disableThinking: roleDef.disableThinking || false
    })

    // 主持人：剥离职责标签，正文只保留纯内容
    // 其余角色：原样返回
    let content = rawContent
    let duty = null
    if (roleDef.id === 'moderator') {
      const parsed = extractModeratorDuty(rawContent)
      content = parsed.content
      duty = parsed.duty
    }

    return res.status(200).json({
      role: roleDef.id,
      roleName: roleDef.name,
      icon: roleDef.icon,
      content,
      // duty 仅主持人返回，前端可选择不显示
      ...(duty ? { duty } : {})
    })
  } catch (e) {
    console.error('[roundtable] LLM 调用失败:', e.message)
    return res.status(500).json({ error: e.message || 'LLM 调用失败' })
  }
}