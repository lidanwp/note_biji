// 系统集成项目管理中级 - 同义关键词扩展字典
const SYNONYM_MAP = {
  // 过程组
  '五大过程组': ['启动', '计划', '执行', '监控', '收尾'],
  '启动过程': ['启动', '立项', '可行性', '评估决策'],
  '计划过程': ['计划', '规划', '范围基准', '进度计划', '成本估算'],
  '执行过程': ['执行', '实施', '采购', '沟通', '资源管理'],
  '监控过程': ['监控', '控制', '变更管理', '质量保证', '绩效报告'],
  '收尾过程': ['收尾', '验收', '合同收尾', '行政收尾'],

  // 十大知识领域
  '十大知识领域': ['整合管理', '范围管理', '进度管理', '成本管理', '质量管理', '资源管理', '沟通管理', '风险管理', '采购管理', '相关方管理'],
  '整合管理': ['整体管理', '项目章程', '项目管理计划', '整体变更控制'],
  '范围管理': ['需求收集', '定义范围', '创建 WBS', '确认范围', '控制范围'],
  '进度管理': ['时间管理', '活动定义', '活动排序', '活动工期估算', '制定进度计划', '控制进度'],
  '成本管理': ['估算成本', '制定预算', '控制成本', '挣值管理', 'EVM'],
  '质量管理': ['质量计划', '质量保证', '质量控制', 'QA', 'QC'],
  '资源管理': ['人力资源管理', '团队建设', '团队发展', '冲突管理', '激励理论'],
  '沟通管理': ['沟通计划', '信息传递', '绩效报告', '沟通渠道'],
  '风险管理': ['风险识别', '定性风险分析', '定量风险分析', '风险应对', '监控风险'],
  '采购管理': ['采购计划', '实施采购', '控制采购', '合同管理'],
  '相关方管理': ['干系人管理', '识别相关方', '规划相关方参与', '管理相关方参与', '监督相关方参与'],

  // 技术方法
  'WBS': ['工作分解结构', '分解结构', '范围基准'],
  'EVM': ['挣值管理', 'PV', 'EV', 'AC', 'CV', 'SV', 'CPI', 'SPI'],
  '挣值': ['PV', 'EV', 'AC', '偏差', '绩效指数'],
  '关键路径法': ['CPM', '关键路径', '活动工期', '工期估算'],
  '三点估算': ['PERT', '乐观估算', '悲观估算', '最可能估算'],
  '甘特图': ['横道图', '里程碑图'],
  'RACI': ['责任分配矩阵', 'RAM'],

  // 阶段 / 文档
  '可行性研究': ['可行性', '投资前期', '机会研究', '初步可行性', '详细可行性'],
  '项目章程': ['章程', '项目授权', '启动文件'],
  '项目管理计划': ['管理计划', '基准', '综合计划'],

  // 常见缩写
  'PMBOK': ['项目管理知识体系', '知识体系', '过程组', '知识领域'],
  'SOW': ['工作说明书'],
  'ROI': ['投资回报率'],
  'NPV': ['净现值'],
  'IRR': ['内部收益率'],

  // 常见问题问法
  '是什么': ['定义', '概念', '含义', '包含', '包括'],
  '有哪些': ['包含', '包括', '组成', '构成', '分为'],
  '如何做': ['步骤', '方法', '流程', '过程', '措施'],
  '区别': ['对比', '比较', '差异', '不同点'],
  '作用': ['目的', '意义', '好处', '优点']
}

// 生成扩展后的查询关键词集合
function expandQuery(originalQuery) {
  const words = new Set([originalQuery])

  // 匹配同义关键词并扩展
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (originalQuery.includes(key)) {
      words.add(key)
      synonyms.forEach(s => words.add(s))
    }
    // 反向匹配：如果查询里有同义词，也把主词加进去
    synonyms.forEach(s => {
      if (originalQuery.includes(s)) {
        words.add(key)
        words.add(s)
      }
    })
  }

  return Array.from(words).join(' ')
}

// 智能汇总搜索结果：把多个片段拼接成一个可读的答案
function summarizeResults(results, query) {
  if (!results || results.length === 0) {
    return '抱歉，没有在知识库中找到相关内容。请尝试换个说法或关键词，如：十大知识领域、五大过程组、挣值管理 EVM、WBS 等。'
  }

  const parts = []
  const maxResults = Math.min(results.length, 4)

  for (let i = 0; i < maxResults; i++) {
    const r = results[i]
    let text = r.content || ''
    if (text.length > 700) text = text.slice(0, 700) + '...'
    parts.push(text)
  }

  return parts.join('\n\n')
}

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
    const { dataset_id, query, top_k } = req.body

    if (!dataset_id || !query) {
      return res.status(400).json({ error: '缺少必要参数: dataset_id, query' })
    }

    // 生成扩展后的查询关键词
    const expandedQuery = expandQuery(query)
    console.log('原始查询:', query)
    console.log('扩展查询:', expandedQuery)

    // 1. 先尝试 QA 接口（智能问答），用原文查询（保留自然语言）
    const qaResponse = await fetch('http://129.204.21.82:5050/api/v1/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        dataset_id,
        query
      })
    })

    const qaBuffer = await qaResponse.arrayBuffer()
    const qaText = Buffer.from(qaBuffer).toString('utf-8')
    let qaData
    try { qaData = JSON.parse(qaText) } catch (e) { qaData = null }

    const answer = qaData?.data?.answer
    // 使用 contains 判断，避免字符串前后空格/特殊字符影响
    const hasValidQaAnswer = answer && answer.trim().length > 0 &&
      !answer.includes('无法回答') &&
      !answer.includes('没有找到') &&
      !answer.includes('不理解') &&
      answer.trim() !== query

    if (hasValidQaAnswer) {
      return res.status(200).json({
        success: true,
        answer,
        source: 'qa',
        context: qaData.data.context || []
      })
    }

    // 2. QA 无效，回退到搜索接口（用扩展后的关键词查询，提高召回）
    const searchQueries = [query]
    if (expandedQuery !== query) searchQueries.push(expandedQuery)

    let allResults = []
    const seenKeys = new Set()

    for (const q of searchQueries) {
      const searchResponse = await fetch('http://129.204.21.82:5050/api/v1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          dataset_id,
          query: q,
          top_k: top_k || 8
        })
      })

      const searchBuffer = await searchResponse.arrayBuffer()
      const searchText = Buffer.from(searchBuffer).toString('utf-8')
      let searchData
      try { searchData = JSON.parse(searchText) } catch (e) { continue }

      const results = searchData?.data?.results || searchData?.results || []
      // 去重：根据内容前 50 字判断
      for (const r of results) {
        const key = (r.content || '').slice(0, 50)
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key)
          allResults.push(r)
        }
      }
    }

    // 按相关度排序
    allResults.sort((a, b) => (b.score || 0) - (a.score || 0))

    const finalResults = allResults.slice(0, 6)
    const finalAnswer = summarizeResults(finalResults, query)

    return res.status(200).json({
      success: true,
      answer: finalAnswer,
      source: finalResults.length > 0 ? 'search' : 'empty',
      results: finalResults
    })
  } catch (error) {
    console.error('ChatBot proxy error:', error)
    return res.status(500).json({ error: '服务器错误', message: error.message })
  }
}
