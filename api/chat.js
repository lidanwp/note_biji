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

// 搜索结果去重 + 合并 + 过滤低质量（score < 0.05 直接丢弃）
function mergeAndRankResults(groups) {
  const seen = new Map() // key -> { item, totalScore, hits }
  for (const group of groups) {
    for (const r of group) {
      if (!r || !r.content) continue
      const s = r.score || 0
      if (s < 0.05) continue // 扔掉噪声
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

// 最终答案渲染：把结果格式化
function composeAnswer(results, originalQuery) {
  if (!results || results.length === 0) {
    return '抱歉，没有在知识库中找到相关内容。可以尝试更简短的关键词，如：整合管理、WBS、挣值管理、可行性研究、五大过程组、PMBOK 等。'
  }
  const pick = results.slice(0, 4)
  const parts = []
  for (const r of pick) {
    let text = r.content || ''
    if (text.length > 800) text = text.slice(0, 800) + '...'
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

    originalQueryInCheck = query
    const variants = buildQueryVariants(query)
    console.log('原始查询:', query)
    console.log('查询变体:', variants)

    // ---- 策略 1: 先尝试 QA 接口（原文查询，保留自然语言 + 精准关键词分别尝试 2 次） ----
    const qaAttempts = [query, variants[1] || variants[0]]
    let qaFinalAnswer = null
    for (const qaQuery of [...new Set(qaAttempts)]) {
      try {
        // 注意：QA 接口响应较慢，给 25 秒超时（Vercel serverless 默认最多60s）
        const ctrl = new AbortController()
        const to = setTimeout(() => ctrl.abort(), 25000)
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
    const answer = composeAnswer(merged, query)

    return res.status(200).json({
      success: true,
      answer,
      source: merged.length > 0 ? 'search' : 'empty',
      results: merged.slice(0, 6)
    })
  } catch (error) {
    console.error('ChatBot proxy error:', error)
    return res.status(500).json({ error: '服务器错误', message: error.message })
  }
}
