// 系统集成项目管理中级 - 知识库专用查询改写层
const TERM_MAP = {
  // 核心概念：关键词的不同说法（用于"多次精准查询 + 结果合并去重"）
  '整合管理': ['整体管理', '项目整合管理'],
  '范围管理': ['项目范围管理', '范围基准', '需求收集', 'WBS'],
  'WBS': ['工作分解结构', '范围基准'],
  '进度管理': ['时间管理', '项目进度计划', '关键路径', 'CPM'],
  '成本管理': ['项目成本', '预算', '估算成本'],
  '挣值管理': ['挣值分析', 'EVM', 'PV EV AC', 'SV CV', 'SPI CPI'],
  'EVM': ['挣值管理', '挣值分析', 'PV', 'EV', 'AC'],
  '质量管理': ['质量保证', '质量控制', 'QA QC'],
  '资源管理': ['人力资源管理', '团队建设', '冲突管理', '激励理论'],
  '沟通管理': ['沟通渠道', '绩效报告', '信息管理'],
  '风险管理': ['风险识别', '风险分析', '风险应对'],
  '采购管理': ['合同管理', '采购计划', '招投标'],
  '相关方管理': ['干系人管理', '相关方参与', '识别相关方'],
  '十大知识领域': ['整合 范围 进度 成本 质量 资源 沟通 风险 采购 相关方'],
  '五大过程组': ['启动过程组 计划过程组 执行过程组 监控过程组 收尾过程组', '启动计划执行监控收尾'],
  '可行性研究': ['项目建议书', '投资前期', '立项阶段'],
  'PERT': ['三点估算', '乐观估算 悲观估算 最可能估算'],
  '关键路径法': ['CPM 关键路径 总工期', '关键路径'],
  'RACI': ['责任分配矩阵', 'RAM'],
  'PMBOK': ['项目管理知识体系 过程组 知识领域'],
  '变更控制': ['整体变更控制 变更流程 变更请求'],
  '项目章程': ['项目授权书 启动文件'],
  '项目管理计划': ['综合计划 基准 管理计划']
}

// ============ 意图识别：判断是否为闲聊/问候/能力询问 ============
// 这类问题不应走知识库搜索，直接返回预设回复
const SMALL_TALK = [
  { pattern: /^(你好|您好|hi|hello|hey|嗨|哈喽|在吗|在不在|有人吗)\s*[!！。.?？]?$/i, reply: '你好！我是系统集成项目管理中级 AI 助手 🐼，可以问我 PMBOK、五大过程组、十大知识领域、WBS、挣值管理等问题。' },
  { pattern: /^(谢谢|多谢|thanks|thank you|3q|谢了|辛苦了)\s*[!！。.?？]?$/i, reply: '不客气！如果还有其他项目管理的问题，随时问我 🐼' },
  { pattern: /^(再见|拜拜|bye|good ?bye|88|晚安)\s*[!！。.?？]?$/i, reply: '再见！祝你学习顺利 🐼' },
  { pattern: /^(你是谁|你叫什么|你是啥|介绍一下你自己|你是什么|你是机器人吗|你是ai吗)/i, reply: '我是「系统集成项目管理中级」AI 助手，专门帮你解答项目管理相关的知识点，如 PMBOK、五大过程组、十大知识领域、WBS、挣值管理等。' },
  { pattern: /^(你能做什么|你会什么|你能帮我什么|有什么功能|怎么用你)/i, reply: '我可以帮你查找和解释系统集成项目管理的知识点。试试问我：\n• 十大知识领域有哪些\n• 五大过程组是什么\n• WBS 工作分解结构\n• 挣值管理 EVM\n• 三点估算 PERT' },
  { pattern: /^(好的|嗯|ok|okay|收到|了解|明白了|知道了)\s*[!！。.?？]?$/i, reply: '嗯嗯，有其他问题随时问我 🐼' },
  { pattern: /^(测试|test|测试一下|试一下)/i, reply: '收到测试请求 ✅ 我运行正常。可以试着问我：「什么是 WBS」「五大过程组有哪些」等真实问题。' }
]

function detectSmallTalk(query) {
  const q = query.trim()
  for (const item of SMALL_TALK) {
    if (item.pattern.test(q)) return item.reply
  }
  return null
}

// 判断查询是否过于宽泛/无意义（比如单个字、纯标点）
function isTooVague(query) {
  const q = query.trim().replace(/[\s!！。.?？，,、]/g, '')
  return q.length < 2
}

// 生成一系列精准查询（而不是把所有同义词塞进一个 query）
function buildQueryVariants(originalQuery) {
  const variants = [originalQuery]
  const cleaned = originalQuery
    .replace(/是什么|有哪些|是什么意思|怎么做|如何做|请解释|介绍一下|的内容|的定义/g, ' ')
    .replace(/的|了|和|与|及|等/g, ' ')
    .replace(/\s+/g, ' ').trim()
  if (cleaned && cleaned !== originalQuery.trim()) variants.push(cleaned)

  // 匹配主词，用其同义词生成更多精准变体
  for (const [mainTerm, synonyms] of Object.entries(TERM_MAP)) {
    if (originalQuery.includes(mainTerm)) {
      variants.push(mainTerm)
      for (const s of synonyms) variants.push(s)
    } else {
      // 反向：如果查询包含了某个同义词，加入主词
      for (const s of synonyms) {
        if (originalQuery.includes(s)) {
          variants.push(mainTerm)
          variants.push(s)
        }
      }
    }
  }

  // 去重 & 过滤空串
  return [...new Set(variants.map(v => v.trim()).filter(Boolean))]
}

// 搜索结果去重 + 合并 + 过滤低质量
// 阈值策略：0.05 绝对阈值过滤明显不相关的（比原来的0.015高，避免"你好"也匹配到笔记）
function mergeAndRankResults(groups) {
  const seen = new Map() // key -> { item, totalScore, hits }
  for (const group of groups) {
    for (const r of group) {
      if (!r || !r.content) continue
      const s = r.score || 0
      if (s < 0.05) continue // 绝对阈值 0.05
      const key = r.content.slice(0, 40).replace(/\s+/g, '')
      if (!key) continue
      if (seen.has(key)) {
        const prev = seen.get(key)
        prev.totalScore += s
        prev.hits += 1
        if (s > prev.item.score) prev.item.score = s
      } else {
        seen.set(key, { item: r, totalScore: s, hits: 1 })
      }
    }
  }
  const ranked = [...seen.values()].sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits // 优先命中次数多的
    return b.totalScore - a.totalScore
  })
  return ranked.map(x => x.item)
}

// 最终答案渲染：把结果格式化（限制总长度，避免输出整个笔记）
function composeAnswer(results, originalQuery) {
  if (!results || results.length === 0) {
    return '抱歉，没有在知识库中找到相关内容。可以尝试更简短的关键词，如：整合管理、WBS、挣值管理、可行性研究、五大过程组、PMBOK 等。'
  }
  // 只取最相关的前 2 条，且每条限制 400 字以内
  const pick = results.slice(0, 2)
  const parts = []
  for (const r of pick) {
    let text = (r.content || '').trim()
    if (text.length > 400) text = text.slice(0, 400) + '...'
    parts.push(text)
  }
  return parts.join('\n\n---\n\n')
}

// 判断 QA answer 是否真正有效
function isGoodQaAnswer(ans) {
  if (!ans) return false
  const s = ans.trim()
  if (!s) return false
  if (s.includes('无法回答')) return false
  if (s.includes('record not found')) return false
  if (s.includes('没有找到') && s.length < 30) return false
  if (s === originalQueryInCheck) return false
  return s.length >= 4
}
let originalQueryInCheck = '' // 闭包变量（下面用）

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { dataset_id, query } = req.body

    if (!dataset_id || !query) {
      return res.status(400).json({ error: '缺少必要参数: dataset_id, query' })
    }

    // ============ 第 0 层：意图识别 - 闲聊/问候/能力询问直接回复 ============
    const smallTalkReply = detectSmallTalk(query)
    if (smallTalkReply) {
      console.log('[意图识别] 命中闲聊:', query)
      return res.status(200).json({
        success: true,
        answer: smallTalkReply,
        source: 'chat',
        results: []
      })
    }

    // ============ 第 0.5 层：过于宽泛的查询直接拒绝 ============
    if (isTooVague(query)) {
      return res.status(200).json({
        success: true,
        answer: '你的问题有点太简短了，能再说得具体一点吗？比如：「什么是 WBS」「五大过程组有哪些」。',
        source: 'chat',
        results: []
      })
    }

    originalQueryInCheck = query
    const variants = buildQueryVariants(query)
    console.log('原始查询:', query)
    console.log('查询变体:', variants)

    // ---- 策略 1: 先尝试 QA 接口（对前 4 个查询变体依次尝试，首个成功即返回） ----
    const qaAttempts = [...new Set([query, ...variants.slice(0, 4)])].slice(0, 4)
    let qaFinalAnswer = null
    for (const qaQuery of qaAttempts) {
      try {
        // 注意：QA 接口响应较慢，给 30 秒超时
        const ctrl = new AbortController()
        const to = setTimeout(() => ctrl.abort(), 30000)
        const qaResponse = await fetch('http://129.204.21.82:5050/api/v1/qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ dataset_id, query: qaQuery }),
          signal: ctrl.signal
        })
        clearTimeout(to)
        const buf = await qaResponse.arrayBuffer()
        const txt = Buffer.from(buf).toString('utf-8')
        let data
        try { data = JSON.parse(txt) } catch (_) { continue }
        const ans = data?.data?.answer
        if (isGoodQaAnswer(ans)) {
          qaFinalAnswer = ans
          break
        }
      } catch (e) {
        console.log('QA 尝试失败:', qaQuery, e.message)
      }
    }

    if (qaFinalAnswer) {
      return res.status(200).json({
        success: true,
        answer: qaFinalAnswer,
        source: 'qa',
        results: []
      })
    }

    // ---- 策略 2: 多查询变体并发搜索，合并结果 ----
    const searchGroups = await Promise.all(
      variants.slice(0, 6).map(async (q) => {
        try {
          const ctrl = new AbortController()
          const to = setTimeout(() => ctrl.abort(), 20000)
          const r = await fetch('http://129.204.21.82:5050/api/v1/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ dataset_id, query: q, top_k: 10 }),
            signal: ctrl.signal
          })
          clearTimeout(to)
          const buf = await r.arrayBuffer()
          const txt = Buffer.from(buf).toString('utf-8')
          const d = JSON.parse(txt)
          return d?.data?.results || d?.results || []
        } catch (_) {
          return []
        }
      })
    )
    const merged = mergeAndRankResults(searchGroups)

    // 质量检查：如果最高分结果低于 0.1，认为没有真正相关的内容
    if (merged.length === 0 || (merged[0].score || 0) < 0.1) {
      return res.status(200).json({
        success: true,
        answer: '抱歉，没有在知识库中找到与「' + query + '」直接相关的内容。\n\n可以尝试更精准的关键词，如：\n• 整合管理\n• WBS\n• 挣值管理\n• 五大过程组\n• PMBOK',
        source: 'empty',
        results: []
      })
    }

    const answer = composeAnswer(merged, query)

    return res.status(200).json({
      success: true,
      answer,
      source: 'search',
      results: merged.slice(0, 6)
    })
  } catch (error) {
    console.error('ChatBot proxy error:', error)
    return res.status(500).json({ error: '服务器错误', message: error.message })
  }
}
