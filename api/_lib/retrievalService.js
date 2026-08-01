// ============================================================================
// retrievalService.js — 系统集成项目管理知识库 检索核心服务
// ----------------------------------------------------------------------------
// 职责：阶段上下文感知 + 字段权重排序 + 章节定向 + 知识图谱推理 + 分层输出
// 被 api/chat.js 作为薄代理调用；不直接处理 HTTP，只负责「检索与组织答案」。
//
// 权重策略（按命中字段）：
//   scenario  ×1.5  （最高：场景/案例最能体现知识运用）
//   keyPoints ×1.2  （次高：核心要点）
//   title     ×1.0  （中等：标题命中）
//   content   ×0.7  （最低：正文泛命中，避免长笔记整体翻出）
//
// 图谱推理：沿 graph.json 边（depends_on / produces / precedes / contrasts_with）
//   找到主笔记的前置依赖、后续产出、对比关系，作为「承接关系上下文」。
// ============================================================================

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')

// ---------- 模块级缓存：配置 + notes 元数据 ----------
let _chapters = null
let _graph = null

function loadConfig() {
  if (!_chapters) {
    _chapters = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'chapters.json'), 'utf-8'))
  }
  if (!_graph) {
    _graph = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'graph.json'), 'utf-8'))
  }
  return { chapters: _chapters, graph: _graph }
}

// notes 元数据缓存（带 TTL，避免每次请求都查 Supabase）
let _notesMeta = null
let _notesMetaAt = 0
const NOTES_META_TTL = 5 * 60 * 1000 // 5 分钟

// ============================================================================
// 1. 意图识别：闲聊 / 问候 / 寒暄 —— 前置于检索，完全不触发知识库
//    分层判断（轻量级，无 LLM 调用，零延迟）：
//    a) 强正则匹配（你好/谢谢/再见/身份询问等）
//    b) 寒暄词 + 无知识领域词 + 短句 → 闲聊
//    c) 短查询（≤3字）且非强术语 → 太宽泛，提示具体化（避免"沟通"命中整篇笔记）
// ============================================================================

// 知识领域词：含这些词的查询视为知识查询，不按闲聊处理
const DOMAIN_TERMS = [
  '整合','整体','范围','进度','成本','质量','资源','风险','采购','相关方','干系人','立项','收尾',
  '沟通管理','沟通渠道','WBS','EVM','PMBOK','PERT','CPM','RACI','挣值','章程','基准','变更',
  '过程组','知识领域','估算','关键路径','三点估算','可行性','合同','招标','团队建设','冲突管理',
  'PDCA','质量保证','质量控制','SPI','CPI','应急储备','管理储备','项目管理','项目计划','监控'
]

// 强术语白名单：即使很短（≤3字）也走检索
const STRONG_TERMS = ['WBS','EVM','PERT','CPM','RACI','PMBOK','QA','QC','PDCA','SPI','CPI','SV','CV','PV','EV','AC','RAM','SOW','CCB']

function hasDomainTerm(query) {
  return DOMAIN_TERMS.some(t => query.includes(t))
}

const SMALL_TALK = [
  { pattern: /^(你好|您好|你好啊|您好啊|hi|hello|hey|嗨|哈喽|早|早上好|下午好|晚上好|晚安)\s*[!！。.?？~]?\s*$/i, reply: '你好！我是系统集成项目管理中级 AI 助手 🐼，可以问我 PMBOK、五大过程组、十大知识领域、WBS、挣值管理等问题。' },
  { pattern: /^(谢谢|感谢|多谢|thanks|thank you|3q|谢了|辛苦了|麻烦了)\s*[!！。.?？]?\s*$/i, reply: '不客气！如果还有其他项目管理的问题，随时问我 🐼' },
  { pattern: /^(再见|拜拜|bye|good ?bye|88|晚安|走了|下线|回见)\s*[!！。.?？]?\s*$/i, reply: '再见！祝你学习顺利 🐼' },
  { pattern: /^(你是谁|你叫什么|你是啥|介绍一下你自己|你是什么|你是机器人吗|你是ai吗|你是谁呀)/i, reply: '我是「系统集成项目管理中级」AI 助手，专门帮你解答项目管理相关的知识点，如 PMBOK、五大过程组、十大知识领域、WBS、挣值管理等。' },
  { pattern: /^(你能做什么|你会什么|你能帮我什么|有什么功能|怎么用你|你能回答什么|你能干嘛)/i, reply: '我可以帮你查找和解释系统集成项目管理的知识点。试试问我：\n• 十大知识领域有哪些\n• 五大过程组是什么\n• WBS 工作分解结构\n• 挣值管理 EVM\n• 三点估算 PERT' },
  { pattern: /^(好的|嗯|嗯嗯|哦|噢|ok|okay|收到|了解|明白了|知道了|行|好滴)\s*[!！。.?？]?\s*$/i, reply: '嗯嗯，有其他问题随时问我 🐼' },
  { pattern: /^(在吗|在不在|有人吗|你在吗|在么|有人在不|喂)\s*[!！。.?？]?\s*$/i, reply: '在的 🐼 有什么项目管理的问题想问？比如 WBS、挣值管理、五大过程组等。' },
  { pattern: /^(测试|test|测试一下|试一下|测试测试)\s*$/i, reply: '收到测试请求 ✅ 我运行正常。可以试着问我：「什么是 WBS」「五大过程组有哪些」等真实问题。' }
]

// 轻量意图分类：判断是否为闲聊/寒暄（前置，不触发检索）
function detectSmallTalk(query) {
  const q = query.trim()

  // a) 强正则匹配
  for (const item of SMALL_TALK) {
    if (item.pattern.test(q)) return item.reply
  }

  // b) 寒暄词 + 无知识领域词 + 短句 → 闲聊
  //    例如"你好啊谢谢"、"嗨，在吗"这类纯寒暄组合，不命中知识领域词才拦截
  const greetingWords = ['你好','您好','嗨','哈喽','hi','hello','谢谢','感谢','再见','拜拜','在吗','辛苦','你好呀']
  const hasGreeting = greetingWords.some(w => q.toLowerCase().includes(w))
  if (hasGreeting && !hasDomainTerm(q) && q.length <= 12) {
    return '你好！我是系统集成项目管理中级 AI 助手 🐼，可以问我 PMBOK、WBS、挣值管理等知识点。'
  }

  return null
}

// 过短/过宽泛判断：≤3字且非强术语 → 提示具体化
// 避免单个泛词（如"沟通""范围"）命中整篇笔记被当作答案翻出
function isTooVague(query) {
  const q = query.trim().replace(/[\s!！。.?？，,、]/g, '')
  if (q.length < 2) return true
  // 2-3字的短查询，若非强术语白名单，视为太宽泛
  if (q.length <= 3 && !STRONG_TERMS.includes(q.toUpperCase())) return true
  return false
}

// ============================================================================
// 2. 查询改写：术语同义词扩展（多次精准查询 + 合并去重）
// ============================================================================
const TERM_MAP = {
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

function buildQueryVariants(originalQuery) {
  const variants = [originalQuery]
  const cleaned = originalQuery
    .replace(/是什么|有哪些|是什么意思|怎么做|如何做|请解释|介绍一下|的内容|的定义/g, ' ')
    .replace(/的|了|和|与|及|等/g, ' ')
    .replace(/\s+/g, ' ').trim()
  if (cleaned && cleaned !== originalQuery.trim()) variants.push(cleaned)

  for (const [mainTerm, synonyms] of Object.entries(TERM_MAP)) {
    if (originalQuery.includes(mainTerm)) {
      variants.push(mainTerm)
      for (const s of synonyms) variants.push(s)
    } else {
      for (const s of synonyms) {
        if (originalQuery.includes(s)) {
          variants.push(mainTerm)
          variants.push(s)
        }
      }
    }
  }
  return [...new Set(variants.map(v => v.trim()).filter(Boolean))]
}

// ============================================================================
// 3. 阶段识别 + 章节定向
//    识别查询属于哪个阶段(启动/规划/执行/监控/收尾)与哪个章节，
//    用于「优先从对应章节检索」与「阶段上下文感知」。
// ============================================================================
function detectPhaseAndChapter(query, chapters) {
  const q = query.toLowerCase()
  let bestChapter = null
  let bestHits = 0

  for (const ch of chapters.chapters) {
    let hits = 0
    // 标题与别名
    const names = [ch.title, ...(ch.aliases || [])].map(s => s.toLowerCase())
    for (const n of names) {
      if (n && q.includes(n)) hits += 3 // 标题命中权重高
    }
    // 关键词
    for (const kw of (ch.keywords || [])) {
      if (q.includes(kw.toLowerCase())) hits += 1
    }
    if (hits > bestHits) {
      bestHits = hits
      bestChapter = ch
    }
  }

  // 阶段关键词直接命中
  let phase = null
  const phaseKeywords = {
    '启动': ['启动', '立项', '章程', '发起'],
    '规划': ['规划', '计划', '制定', '估算', '基准', 'WBS'],
    '执行': ['执行', '实施', '组建', '团队建设', '指导与管理'],
    '监控': ['监控', '控制', '变更', '纠偏', '绩效', '挣值'],
    '收尾': ['收尾', '结束', '验收', '总结', '移交']
  }
  for (const [p, kws] of Object.entries(phaseKeywords)) {
    if (kws.some(k => q.includes(k))) { phase = p; break }
  }

  // 若未直接命中阶段，但有章节命中，用章节的主阶段
  if (!phase && bestChapter) phase = bestChapter.primaryPhase

  return {
    phase,
    chapter: bestChapter ? { id: bestChapter.id, title: bestChapter.title, primaryPhase: bestChapter.primaryPhase } : null,
    hitScore: bestHits
  }
}

// ============================================================================
// 4. Supabase 笔记元数据加载（带 TTL 缓存）
//    只取检索/重排需要的列，避免拉取大字段(content)。
// ============================================================================
async function loadNotesMeta(env) {
  const now = Date.now()
  if (_notesMeta && (now - _notesMetaAt) < NOTES_META_TTL) {
    return _notesMeta
  }
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return _notesMeta || []

  const select = 'id,title,category,phase,related_notes,key_points,scenario,memory_aids,comparison_table'
  const url = `${supabaseUrl}/rest/v1/notes?select=${encodeURIComponent(select)}&order=date.desc`
  try {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 3000)  // 3s 超时，避免阻塞主流程
    const r = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      signal: ctrl.signal
    })
    clearTimeout(to)
    if (!r.ok) {
      console.error('[retrievalService] loadNotesMeta 失败:', r.status)
      return _notesMeta || []
    }
    const rows = await r.json()
    _notesMeta = (rows || []).map(row => ({
      id: row.id,
      title: row.title || '',
      category: row.category || '',
      phase: row.phase || null,
      relatedNotes: row.related_notes || [],
      keyPoints: row.key_points || [],
      scenario: row.scenario || '',
      memoryAids: row.memory_aids || [],
      comparisonTable: row.comparison_table || { enabled: false, title: '', cols: [], rows: [] }
    }))
    _notesMetaAt = now
    return _notesMeta
  } catch (e) {
    console.error('[retrievalService] loadNotesMeta 异常:', e.message)
    return _notesMeta || []
  }
}

// 用标题匹配笔记元数据（PandaWiki 片段 → notes 表笔记）
function matchNoteMeta(content, notesMeta) {
  if (!content || !notesMeta || notesMeta.length === 0) return null
  const c = content.slice(0, 120).replace(/\s+/g, '')
  let best = null
  let bestScore = 0
  for (const n of notesMeta) {
    if (!n.title) continue
    const t = n.title.replace(/\s+/g, '')
    if (!t) continue
    // 标题作为子串出现在片段里，或片段前缀包含标题核心词
    let score = 0
    if (c.includes(t)) score = t.length
    else {
      // 标题分词后命中数
      const parts = n.title.split(/[\s·,，、]+/).filter(p => p.length >= 2)
      let hits = 0
      for (const p of parts) if (c.includes(p)) hits++
      score = hits * 2
    }
    if (score > bestScore) { bestScore = score; best = n }
  }
  return bestScore >= 2 ? best : null
}

// ============================================================================
// 5. PandaWiki 调用封装
// ============================================================================
const PANDAWIKI_BASE = process.env.PANDAWIKI_BASE || 'http://129.204.21.82:5050'

async function callPandaQA(datasetId, query, timeoutMs = 5000) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${PANDAWIKI_BASE}/api/v1/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ dataset_id: datasetId, query }),
      signal: ctrl.signal
    })
    const buf = await r.arrayBuffer()
    const txt = Buffer.from(buf).toString('utf-8')
    let data
    try { data = JSON.parse(txt) } catch (_) { return { ok: false } }
    // 检测 embedding 服务不可用
    if (data?.error && /余额不足|embed error|quota|insufficient/i.test(data.error)) {
      return { ok: false, embeddingDown: true, error: data.error }
    }
    const ans = data?.data?.answer
    return { ok: true, answer: ans || null }
  } catch (e) {
    return { ok: false, error: e.message }
  } finally {
    clearTimeout(to)
  }
}

async function callPandaSearch(datasetId, query, topK = 10, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${PANDAWIKI_BASE}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ dataset_id: datasetId, query, top_k: topK }),
      signal: ctrl.signal
    })
    const buf = await r.arrayBuffer()
    const txt = Buffer.from(buf).toString('utf-8')
    const d = JSON.parse(txt)
    return d?.data?.results || d?.results || []
  } catch (_) {
    return []
  } finally {
    clearTimeout(to)
  }
}

// 判断 QA answer 是否真正有效
function isGoodQaAnswer(ans, originalQuery) {
  if (!ans) return false
  const s = ans.trim()
  if (!s) return false
  if (s.includes('无法回答')) return false
  if (s.includes('record not found')) return false
  if (s.includes('没有找到') && s.length < 30) return false
  if (s === originalQuery) return false
  return s.length >= 4
}

// ============================================================================
// 6. 字段权重重排
//    对 PandaWiki 检索片段应用「按字段」权重：scenario×1.5 keyPoints×1.2 title×1.0 content×0.7
//    并叠加：阶段一致性加成、章节定向加成。
// ============================================================================
const FIELD_WEIGHT = { scenario: 1.5, keyPoints: 1.2, title: 1.0, content: 0.7 }

// 检测片段是否含列表/表格/枚举结构（列举类检索优先命中此类结构）
function hasListStructure(content) {
  if (!content) return false
  if (/^[-*]\s/m.test(content)) return true       // markdown 无序列表
  if (/^\d+\.\s/m.test(content)) return true      // 数字有序列表
  if (/^\|.*\|/m.test(content)) return true       // markdown 表格
  if ((content.match(/、/g) || []).length >= 2) return true  // 顿号枚举
  return false
}

function rerankByWeight(results, query, detection, notesMeta, intent) {
  const q = query.toLowerCase()
  const qTokens = q.split(/[\s,，、]+/).filter(t => t.length >= 2)

  return results.map(r => {
    const baseScore = r.score || 0
    if (baseScore < 0.05) return { ...r, weightedScore: 0, field: 'content', dropped: true }

    const note = matchNoteMeta(r.content, notesMeta)
    let field = 'content'
    let fieldBoost = FIELD_WEIGHT.content

    if (note) {
      // 判断 query 主要命中笔记的哪个字段 → 用对应字段权重
      const titleHit = note.title && q.includes(note.title.toLowerCase())
      const scenarioHit = note.scenario && qTokens.some(t => note.scenario.toLowerCase().includes(t))
      const keyPointsHit = (note.keyPoints || []).some(kp => qTokens.some(t => String(kp).toLowerCase().includes(t)))

      if (scenarioHit) { field = 'scenario'; fieldBoost = FIELD_WEIGHT.scenario }
      else if (keyPointsHit) { field = 'keyPoints'; fieldBoost = FIELD_WEIGHT.keyPoints }
      else if (titleHit) { field = 'title'; fieldBoost = FIELD_WEIGHT.title }
      else { field = 'content'; fieldBoost = FIELD_WEIGHT.content }

      // 阶段一致性加成：查询阶段 == 笔记阶段
      if (detection.phase && note.phase && detection.phase === note.phase) {
        fieldBoost *= 1.3
      }
      // 章节定向加成：命中章节标题与笔记标题/分类一致
      if (detection.chapter) {
        const chTitle = detection.chapter.title
        if (note.title?.includes(chTitle) || note.category?.includes(chTitle) || chTitle.includes(note.title || '')) {
          fieldBoost *= 1.4
        }
      }
      // 列举类加成：优先命中含列表/表格/枚举结构的片段，或笔记有 keyPoints 清单
      if (intent === 'list') {
        if ((note.keyPoints && note.keyPoints.length) || hasListStructure(r.content)) {
          fieldBoost *= 1.3
        }
      }
    } else {
      // 未匹配到笔记：视为正文泛命中，应用 content 最低权重
      field = 'content'
      fieldBoost = FIELD_WEIGHT.content
    }

    return {
      ...r,
      field,
      weightedScore: baseScore * fieldBoost,
      noteId: note?.id || null,
      noteTitle: note?.title || null,
      notePhase: note?.phase || null
    }
  })
    .filter(r => !r.dropped && r.weightedScore > 0)
    .sort((a, b) => b.weightedScore - a.weightedScore)
}

// 合并去重（多查询变体结果）
function mergeAndRankResults(groups) {
  const seen = new Map()
  for (const group of groups) {
    for (const r of group) {
      if (!r || !r.content) continue
      const key = r.content.slice(0, 40).replace(/\s+/g, '')
      if (!key) continue
      if (seen.has(key)) {
        const prev = seen.get(key)
        prev.totalScore += r.weightedScore || r.score || 0
        prev.hits += 1
        if ((r.weightedScore || 0) > (prev.item.weightedScore || 0)) {
          prev.item = r
        }
      } else {
        seen.set(key, { item: r, totalScore: r.weightedScore || r.score || 0, hits: 1 })
      }
    }
  }
  const ranked = [...seen.values()].sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits
    return b.totalScore - a.totalScore
  })
  return ranked.map(x => x.item)
}

// ============================================================================
// 7. 知识图谱推理：沿边找前置依赖 / 后续产出 / 对比关系
// ============================================================================
function reasonOverGraph(noteTitle, graph, notesMeta) {
  if (!noteTitle) return { upstream: [], downstream: [], contrasts: [] }
  // 找到主节点 id（按标题匹配 graph 节点）
  const node = graph.nodes.find(n => noteTitle.includes(n.title) || n.title.includes(noteTitle))
  if (!node) return { upstream: [], downstream: [], contrasts: [] }

  const upstream = []
  const downstream = []
  const contrasts = []

  for (const e of graph.edges) {
    // 依赖：from 产出 → to 依赖。当前节点为 to → upstream
    if (e.to === node.id && e.relation === 'depends_on') {
      const fromNode = graph.nodes.find(n => n.id === e.from)
      upstream.push({ title: fromNode?.title || e.from, output: e.output, description: e.description })
    }
    // 产出：当前节点为 from，relation produces → downstream
    if (e.from === node.id && e.relation === 'produces') {
      const toNode = graph.nodes.find(n => n.id === e.to)
      downstream.push({ title: toNode?.title || e.to, output: e.output, description: e.description })
    }
    // 先于：当前节点 from precedes → downstream
    if (e.from === node.id && e.relation === 'precedes') {
      const toNode = graph.nodes.find(n => n.id === e.to)
      downstream.push({ title: toNode?.title || e.to, output: e.output, description: e.description })
    }
    // 对比关系（自环或指向其他节点）
    if ((e.from === node.id || e.to === node.id) && e.relation === 'contrasts_with') {
      contrasts.push({ output: e.output, description: e.description })
    }
  }

  return { upstream, downstream, contrasts }
}

// ============================================================================
// 8. 阶段上下文：取该阶段相邻章节笔记的 keyPoints 作为背景
// ============================================================================
function buildPhaseContext(phase, chapters, notesMeta) {
  if (!phase) return []
  const phaseToChapters = chapters.phaseToChapters || {}
  const chapterIds = phaseToChapters[phase] || []
  if (chapterIds.length === 0) return []

  const chapterTitles = chapters.chapters
    .filter(c => chapterIds.includes(c.id))
    .map(c => c.title)

  // 匹配 notes 元数据中标题/分类属于本阶段的笔记
  const ctx = []
  for (const n of notesMeta) {
    if (n.phase !== phase) continue
    if (chapterTitles.some(t => n.title?.includes(t) || n.category?.includes(t))) {
      ctx.push({ title: n.title, phase: n.phase, keyPoints: (n.keyPoints || []).slice(0, 3) })
    }
  }
  return ctx.slice(0, 4) // 最多 4 条背景
}

// ============================================================================
// 9. 意图分类（供分层输出选择格式）
// ============================================================================
function classifyIntent(query) {
  const q = query.toLowerCase()
  if (/(区别|对比|比较|异同|vs|差异|不同)/.test(q)) return 'comparison'
  // 列举类：几个/哪些/多少/包含/列举/列出/分别是/几种/多少种/有多少/包括哪些
  // 不应被"定义类→一句话+3要点"压缩，需输出完整清单（总数 + 逐项）
  if (/(几个|哪些|多少|包含|列举|列出|分别是|都有哪些|几种|多少种|多少个|有多少|包括哪些|都有啥|种类)/.test(q)) return 'list'
  if (/(案例|场景|实际|应用|怎么做|如何处理|遇到)/.test(q)) return 'scenario'
  if (/(是什么|什么是|含义|定义|概念|指什么)/.test(q)) return 'definition'
  return 'general'
}

// ============================================================================
// 10. 分层输出（纯文本）—— 任务3 先返回纯文本，对比表格/口诀高亮留到任务4 渲染
//     但 context 数据已备齐，供前端使用。
// ============================================================================
function composeLayeredAnswer({ primaryAnswer, intent, detection, graphReasoning, phaseContext, topNote }) {
  const lines = []

  // 列举类：先总数，再逐项列出名称+一句话说明（不被"定义类"规则压缩）
  if (intent === 'list' && topNote && topNote.keyPoints && topNote.keyPoints.length) {
    const kps = topNote.keyPoints
    lines.push(`共 ${kps.length} 项：`)
    kps.forEach((kp, i) => {
      lines.push(`${i + 1}. ${kp}`)
    })
    // 若 QA/检索主答案较短且未与清单重复，作为补充说明附后
    if (primaryAnswer && primaryAnswer.length <= 200 && !kps.some(k => primaryAnswer.includes(String(k)))) {
      lines.push('')
      lines.push(primaryAnswer)
    }
  } else if (primaryAnswer) {
    lines.push(primaryAnswer)
  }

  // 承接关系（图谱推理）—— 体现知识点之间的关联
  if (graphReasoning && (graphReasoning.upstream.length || graphReasoning.downstream.length)) {
    lines.push('')
    lines.push('【知识承接关系】')
    for (const u of graphReasoning.upstream.slice(0, 2)) {
      lines.push(`• 前置：${u.title}（产出 ${u.output}）— ${u.description}`)
    }
    for (const d of graphReasoning.downstream.slice(0, 2)) {
      lines.push(`• 后续：${d.title}（依赖 ${d.output}）— ${d.description}`)
    }
  }

  // 阶段上下文
  if (phaseContext && phaseContext.length) {
    lines.push('')
    lines.push(`【阶段上下文：${detection.phase}】`)
    for (const c of phaseContext.slice(0, 3)) {
      const kps = (c.keyPoints || []).slice(0, 2).join('；')
      lines.push(`• ${c.title}${kps ? '：' + kps : ''}`)
    }
  }

  return lines.join('\n').trim()
}

// 构建系统 Prompt 指令（口诀优先 + 分层输出），作为「回答风格指引」附在返回里
// 任务4 前端渲染时可读取此 prompt 与 context 决定是否高亮口诀/渲染对比表
function buildSystemPrompt() {
  return [
    '你是「软考中级系统集成项目管理工程师」AI 助手。',
    '回答遵循「口诀优先 + 分层输出」原则：',
    '1. 涉及精确数字/公式/概念对比时，优先输出 memoryAids（记忆口诀）与 comparisonTable（对比表格）。',
    '2. 回答格式按意图分层：',
    '   - 定义类：一句话定义 + 最多三个要点。',
    '   - 对比类：复用对比表格，突出关键差异列。',
    '   - 场景类：只输出案例精要 + 知识点映射，不堆砌全文。',
    '3. 体现知识承接关系：回答时点明该知识点的前置输入与后续输出。',
    '4. 简洁优先，单次回答控制在 300 字以内，避免整篇笔记翻出。'
  ].join('\n')
}

// ============================================================================
// 11. 主入口
// ============================================================================
export async function retrieve({ dataset_id, query, history }) {
  const env = process.env
  const { chapters, graph } = loadConfig()

  // ---- 闲聊 ----
  const smallTalkReply = detectSmallTalk(query)
  if (smallTalkReply) {
    return { success: true, answer: smallTalkReply, source: 'chat', intent: 'chat', results: [], context: {} }
  }

  // ---- 多轮上下文：指代消解 ----
  // 含指代词（它们/这些/分别/其...）时，用上一轮用户问题的实体增强当前查询
  const resolvedQuery = resolveCoreference(query, history)
  if (resolvedQuery !== query) {
    console.log('[retrievalService] 指代消解:', query, '→', resolvedQuery)
  }

  // ---- 过短 ----（用消解后的 query 判断，避免"它们区别"被误判为太宽泛）
  if (isTooVague(resolvedQuery)) {
    return {
      success: true,
      answer: '你的问题有点太简短了，能再说得具体一点吗？比如：「什么是 WBS」「五大过程组有哪些」。',
      source: 'chat', intent: 'general', results: [], context: {}
    }
  }

  // ---- 阶段 + 章节识别（本地计算，无 I/O）----
  const detection = detectPhaseAndChapter(resolvedQuery, chapters)
  const intent = classifyIntent(resolvedQuery)
  console.log('[retrievalService] 阶段/章节/意图:', detection.phase, detection.chapter?.title, intent)

  const variants = buildQueryVariants(resolvedQuery)

  // ---- 三路并发：notesMeta + QA + search，最大化利用 10s Hobby 限制 ----
  const notesMetaTask = loadNotesMeta(env).catch(() => [])

  const qaTask = callPandaQA(dataset_id, resolvedQuery, 5000)
    .then(res => {
      if (res.embeddingDown) return { qaFinalAnswer: null, embeddingDown: true }
      if (res.ok && isGoodQaAnswer(res.answer, resolvedQuery)) return { qaFinalAnswer: res.answer, embeddingDown: false }
      return { qaFinalAnswer: null, embeddingDown: false }
    })
    .catch(() => ({ qaFinalAnswer: null, embeddingDown: false }))

  const searchTask = Promise.all(
    variants.slice(0, 4).map(q => callPandaSearch(dataset_id, q, 8))
  )

  const [notesMeta, { qaFinalAnswer, embeddingDown }, searchGroupsRaw] = await Promise.all([
    notesMetaTask, qaTask, searchTask
  ])

  if (embeddingDown) {
    return {
      success: true,
      source: 'error',
      intent,
      answer: '抱歉，AI 知识库服务暂时不可用（向量检索服务余额不足）。\n\n管理员请前往 PandaWiki 后台检查 Embedding 模型的 API 余额。\n\n你可以先浏览笔记内容，待服务恢复后再提问。',
      results: [], context: {}
    }
  }

  // 对每个 group 做字段权重重排
  const searchGroups = searchGroupsRaw.map(group =>
    rerankByWeight(group, resolvedQuery, detection, notesMeta, intent)
  )
  const merged = mergeAndRankResults(searchGroups)

  // 质量检查：最高加权分过低 → 未命中
  const topScore = merged[0]?.weightedScore || 0
  const topRawScore = merged[0]?.score || 0
  if (merged.length === 0 || (topRawScore < 0.1 && topScore < 0.1)) {
    return {
      success: true,
      source: 'empty',
      intent,
      phase: detection.phase,
      chapter: detection.chapter,
      answer: '抱歉，没有在知识库中找到与「' + query + '」直接相关的内容。\n\n可以尝试更精准的关键词，如：\n• 整合管理\n• WBS\n• 挣值管理\n• 五大过程组\n• PMBOK',
      results: [], context: {}
    }
  }

  // ---- 取主笔记做图谱推理 + 阶段上下文 ----
  const topResult = merged[0]
  const topNote = notesMeta.find(n => n.id === topResult.noteId) ||
    matchNoteMeta(topResult.content, notesMeta) || null

  const graphReasoning = topNote
    ? reasonOverGraph(topNote.title, graph, notesMeta)
    : { upstream: [], downstream: [], contrasts: [] }

  const phaseContext = buildPhaseContext(detection.phase, chapters, notesMeta)

  // ---- 组装主答案（纯文本）----
  // 若 QA 已有好答案，以其为主；否则用检索 top 结果内容拼接
  let primaryAnswer
  if (qaFinalAnswer) {
    primaryAnswer = qaFinalAnswer
  } else {
    const pick = merged.slice(0, 2)
    const parts = pick.map(r => {
      let t = (r.content || '').trim()
      if (t.length > 400) t = t.slice(0, 400) + '...'
      return t
    })
    primaryAnswer = parts.join('\n\n---\n\n')
  }

  const answer = composeLayeredAnswer({
    primaryAnswer,
    intent,
    detection,
    graphReasoning,
    phaseContext,
    topNote
  })

  return {
    success: true,
    source: qaFinalAnswer ? 'qa' : 'search',
    intent,
    phase: detection.phase,
    chapter: detection.chapter,
    answer,
    results: merged.slice(0, 6).map(r => ({
      content: r.content,
      score: r.score,
      weightedScore: Number(r.weightedScore.toFixed(4)),
      field: r.field,
      noteId: r.noteId,
      noteTitle: r.noteTitle,
      notePhase: r.notePhase
    })),
    context: {
      // primaryAnswer 为主答案纯文本（不含承接关系拼接），供前端结构化分层渲染
      // data.answer 为降级纯文本（主答案 + 承接 + 阶段，供不支持 context 渲染时使用）
      primaryAnswer,
      graphReasoning,
      phaseContext,
      memoryAids: topNote?.memoryAids || [],
      comparisonTable: topNote?.comparisonTable || { enabled: false, title: '', cols: [], rows: [] },
      systemPrompt: buildSystemPrompt()
    }
  }
}
