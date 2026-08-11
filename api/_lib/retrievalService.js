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
  // 🚨 通用拦截：任何与学习/项目管理无关的话题，优先处理
  { pattern: /(吃饭|吃了吗|饿了|饱了|做饭|外卖|美食|电影|电视剧|综艺|明星|抖音|快手|网红|八卦|游戏|KTV|旅游|购物|天气|下雨|下雪|笨蛋|蠢|傻|白痴|滚|闭嘴|讨厌|恶心|混蛋|王八蛋|脑子有病|神经病|股票|基金|彩票|娱乐|政治|军事|历史|健康|养生|美容|穿搭|运动|体育|音乐|恋爱|感情|婚姻|家庭|孩子|宠物|猫狗|花草|盆栽|化妆|手机|电脑|加班|下班|放假|周末|休息|睡觉|洗澡|洗头|健身|减肥|跑步|游泳|打球|看病|挂号|体检|中医|理财|银行|转账|红包|工资|奖金|花钱|存钱|快递|物流|包裹|售后|退换|差评|好评)/i, reply: '不要聊跟学习无关的事情。' },
  { pattern: /^(你好|您好|你好啊|您好啊|hi|hello|hey|嗨|哈喽|早|早上好|下午好|晚上好|晚安)\s*[!！。.?？~]?\s*$/i, reply: '你好！我是系统集成项目管理中级 AI 助手 🐼，可以问我 PMBOK、五大过程组、十大知识领域、WBS、挣值管理等问题。' },
  { pattern: /^(谢谢|感谢|多谢|thanks|thank you|3q|谢了|辛苦了|麻烦了)\s*[!！。.?？]?\s*$/i, reply: '不客气！如果还有其他项目管理的问题，随时问我 🐼' },
  { pattern: /^(再见|拜拜|bye|good ?bye|88|晚安|走了|下线|回见)\s*[!！。.?？]?\s*$/i, reply: '再见！祝你学习顺利 🐼' },
  { pattern: /^(你是谁|你叫什么|你是啥|介绍一下你自己|你是什么|你是机器人吗|你是ai吗|你是谁呀)/i, reply: '我是「系统集成项目管理中级」AI 助手，专门帮你解答项目管理相关的知识点，如 PMBOK、五大过程组、十大知识领域、WBS、挣值管理等。' },
  { pattern: /^(你能做什么|你会什么|你能帮我什么|有什么功能|怎么用你|你能回答什么|你能干嘛)/i, reply: '我可以帮你查找和解释系统集成项目管理的知识点。试试问我：\n• 十大知识领域有哪些\n• 五大过程组是什么\n• WBS 工作分解结构\n• 挣值管理 EVM\n• 三点估算 PERT' },
  { pattern: /^(好的|嗯|嗯嗯|哦|噢|ok|okay|收到|了解|明白了|知道了|行|好滴)\s*[!！。.?？]?\s*$/i, reply: '嗯嗯，有其他问题随时问我 🐼' },
  { pattern: /^(在吗|在不在|有人吗|你在吗|在么|有人在不|喂)\s*[!！。.?？]?\s*$/i, reply: '在的 🐼 有什么项目管理的问题想问？比如 WBS、挣值管理、五大过程组等。' },
  { pattern: /^(测试|test|测试一下|试一下|测试测试)\s*$/i, reply: '收到测试请求 ✅ 我运行正常。可以试着问我：「什么是 WBS」「五大过程组有哪些」等真实问题。' },
  { pattern: /^(你主要|你主要是|你通常是|你一般).{0,10}(做什么|干嘛|干什么)/i, reply: '我是你的项目管理学习助手，专门帮你解答 PMBOK、五大过程组、十大知识领域、WBS、挣值管理、成本管理、进度管理等软考中级相关的知识点。你可以问我具体概念、过程之间的关系，或者某个知识点在做什么。' },
  { pattern: /^知识库(里|中)?.{0,5}(有多少|多少|总共).{0,5}(笔记|文章|内容)/i, reply: '当前知识库的具体笔记数量，请前往后台「文档管理」查看。我可以帮你解答具体的知识点内容，比如某个过程在做什么、概念之间的区别等。' },
  // 匹配"关于我的更新/变化"类问题
  { pattern: /(你|您).{0,5}(更新|增加|添加|删|改|变化).{0,5}(多少|哪些|什么).{0,5}(笔记|知识|内容)/i, reply: '不要聊跟学习无关的事情。我的知识库内容由管理员在后台更新和维护。关于具体的笔记数量或更新记录，你可以咨询管理员或查看后台的「文档管理」模块。' },
  // 匹配"你在做什么/在干嘛"类问题
  { pattern: /^(你|您).{0,5}(在做什么|在干嘛|干什么|忙什么|在忙啥)/i, reply: '不要聊跟学习无关的事情。我正等你来问项目管理的问题呢！你可以问我 WBS、挣值管理、五大过程组这些知识点，也可以问两个概念之间的关系，我都能帮你解答。' },
  // 匹配"你有什么变化/新功能"类问题
  { pattern: /^(你|您).{0,5}(有.{0,3})?(变|变化|更新|新功能).{0,5}(什么|哪些|吗|了吗)/i, reply: '我暂时没有功能上的更新，但我的知识在随笔记同步。如果你在后台添加了新笔记，我就能回答更多问题了。' },
  // 🆕 强制拒答：与学习/项目管理无关的闲聊话题（天气/娱乐/游戏/体育/时政等）
  { pattern: /(天气|明星|八卦|娱乐|游戏|电影|电视剧|综艺|体育|美食|旅游|购物|音乐|股票|基金|彩票|政治|军事|历史|天文|地理|动物|植物|健康|养生|美容|穿搭|网红|抖音|快手|娱乐八卦|社会新闻)/i, reply: '我是专门帮你学习「系统集成项目管理」的助手，我只擅长回答项目管理、PMBOK、软考相关的问题。你可以问我：WBS、挣值管理、五大过程组、成本管理、进度管理、风险管理等。' }
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
// 1.5 多轮上下文：指代消解
//     当问题含指代词（它们/这些/分别/其/该...）时，从上一轮用户问题提取
//     知识领域实体，增强当前查询，使追问能精准定位上一轮讨论的知识点。
// ============================================================================
const COREFERENCE_WORDS = ['分别','它们','这些','这个','那个','上面','上述','其','该','前者','后者','两者','此','这','那']

function hasCoreference(query) {
  return COREFERENCE_WORDS.some(w => query.includes(w))
}

function resolveCoreference(query, history) {
  if (!hasCoreference(query) || !Array.isArray(history) || history.length === 0) {
    return query
  }
  const lastUser = [...history].reverse().find(m => m.role === 'user' && m.content)
  if (!lastUser) return query
  const entities = DOMAIN_TERMS.filter(t => lastUser.content.includes(t))
  if (!entities.length) return query
  const prefix = entities.filter(e => !query.includes(e)).slice(0, 3).join(' ')
  return prefix ? `${prefix} ${query}` : query
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

async function callPandaQA(datasetId, query, timeoutMs = 6000) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${PANDAWIKI_BASE}/api/v1/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ dataset_id: datasetId, query, temperature: 0.2, max_tokens: 600, system_prompt: "你是一个专业的项目管理知识助手。请严格根据检索到的内容回答问题。如果检索内容与问题不匹配，直接说'知识库中没有找到相关内容'，不要编造。" }),
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

async function callPandaSearch(datasetId, query, topK = 5, timeoutMs = 6000) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${PANDAWIKI_BASE}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ dataset_id: datasetId, query, top_k: topK, threshold: 0.75 }),
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

  // 列举类：primaryAnswer 已由 retrieve 用 composeListSummary 口语化处理，直接使用
  if (primaryAnswer) {
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
    '你是「软考中级系统集成项目管理工程师」AI 助手，用自己的话回答问题，不要逐字照抄原文。',
    '回答风格：先给结论，再展开说明，简洁明了（200字以内）。',
    '绝对禁止使用"根据资料显示""据了解""资料表明"这类套话，直接说答案。',
    '如果笔记里没有直接答案，就根据已有知识合理推测，并在回答开头说明"以下是我的推测："。',
    '涉及数字、公式、对比时，优先用口诀或对比表呈现，记得点明知识点之间的前后关联。',
    '所有意图类型都必须输出自然语言，禁止粘贴 markdown 表格、列表符号或原始片段：',
    '• 列举类（有哪些/几个过程）：先说"一共 N 个核心过程："，再用一句话把每个过程串联起来，',
    '  每个过程用"序号）名称，就是…"格式，整体用中文分号"；"连接，不要换行粘贴清单。',
    '• 定义类（是什么/什么是）：用"XXX 就是…"的句式一句话说清本质，再补 1-2 句展开，不要堆砌要点。',
    '• 综合类（一般提问）：把检索到的内容消化后用自己的话说出来，像跟人聊天一样，不要直接复制片段。',
    '• 对比类/场景类：可以复用对比表格和案例，但要用自然语言点明关键差异或映射关系。'
  ].join('\n')
}

// 列举类口语化总结：把 keyPoints 提炼成"一共 N 个核心过程：1）名称；2）名称；…"的单句串联
// 用于无 QA 答案时作为 primaryAnswer，让前端 ctx.primaryAnswer 也是口语化的
function composeListSummary(keyPoints) {
  if (!keyPoints || !keyPoints.length) return ''
  // 分隔符：英文冒号 :、中文冒号 ：、em dash —、连字符 -（放末尾避免字符类范围歧义）
  const NAME_SEP_RE = /^([^\s:：—\-]{2,12})\s*[:：—\-]/
  const names = keyPoints.map(kp => {
    const s = String(kp).trim()
    // 优先取冒号/破折号前的主语作为核心名称；无分隔符则取前 8 字兜底
    const m = s.match(NAME_SEP_RE)
    return (m ? m[1] : s.slice(0, 8)).replace(/[，,。.；;]$/, '')
  })
  const parts = names.map((n, i) => `${i + 1}）${n}`)
  return `一共 ${keyPoints.length} 个核心过程：${parts.join('；')}。`
}

// 定义类口语化：用标题 + 第一条 keyPoint 组织"XXX 就是…"的句式，而非粘贴原始片段
function composeDefinitionAnswer(topNote, fallbackContent) {
  if (!topNote) return stripFragmentForSpeech(fallbackContent || '')
  const title = (topNote.title || '').trim()
  const kp0 = topNote.keyPoints && topNote.keyPoints[0] ? String(topNote.keyPoints[0]).trim() : ''
  if (title && kp0) {
    // 从 keyPoint 去掉前缀名称和分隔符，取核心说明
    const desc = kp0.replace(/^[\s\S]{0,12}[:：—\-]\s*/, '').trim() || kp0
    return `${title}就是${desc}。`
  }
  if (title && fallbackContent) {
    // 无 keyPoint，取检索片段第一句作为说明
    const firstSentence = stripFragmentForSpeech(fallbackContent).split(/[。.\n！!？?]/)[0].trim()
    return firstSentence ? `${title}就是${firstSentence}。` : stripFragmentForSpeech(fallbackContent)
  }
  return stripFragmentForSpeech(fallbackContent || '')
}

// 综合类口语化：从检索片段提取核心句，去掉表格/列表符号，避免粘贴原始 markdown 片段
function composeGeneralAnswer(merged) {
  const pick = merged.slice(0, 2)
  const parts = pick.map(r => {
    let t = stripFragmentForSpeech(r.content || '')
    if (t.length > 200) t = t.slice(0, 200) + '...'
    return t
  })
  return parts.filter(Boolean).join('；')
}

// 片段清洗：去掉 markdown 表格行、列表符号、多余空白，提取适合口语朗读的纯文本
function stripFragmentForSpeech(content) {
  if (!content) return ''
  let t = String(content).trim()
  // 逐行处理：过滤表格行/分隔线行 → 去掉行首列表符号 → 合并
  t = t.split('\n')
    .filter(line => !/^\s*\|/.test(line) && !/^\s*[-:|\s]+$/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').replace(/^\d+[.、]\s+/, ''))
    .join(' ')
  // 去掉 markdown 强调符号
  t = t.replace(/[*_`#>]/g, '')
  // 压缩多余空白
  t = t.replace(/\s+/g, ' ').trim()
  return t
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

  const qaTask = callPandaQA(dataset_id, resolvedQuery, 6000)
    .then(res => {
      if (res.embeddingDown) return { qaFinalAnswer: null, embeddingDown: true }
      if (res.ok && isGoodQaAnswer(res.answer, resolvedQuery)) return { qaFinalAnswer: res.answer, embeddingDown: false }
      return { qaFinalAnswer: null, embeddingDown: false }
    })
    .catch(() => ({ qaFinalAnswer: null, embeddingDown: false }))

  // search 变体数从 4 减到 3，单变体 5s 超时，总耗时 max(3s,4s,5s)=5s 内完成
  const searchTask = Promise.all(
    variants.slice(0, 2).map(q => callPandaSearch(dataset_id, q, 3))
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
  let merged = mergeAndRankResults(searchGroups)

  // 强制关键词过滤：如果查询包含特定术语，只保留包含该术语的片段
  const filteredMerged = merged.filter(r => r.weightedScore > 0.3)
  const queryTerms = query.split(/[\s,，、]+/).filter(t => t.length >= 2)
  if (queryTerms.length > 0) {
    const keywordFiltered = filteredMerged.filter(r => {
      const content = (r.content || '').toLowerCase()
      return queryTerms.some(term => content.includes(term.toLowerCase()))
    })
    if (keywordFiltered.length > 0) {
      merged = keywordFiltered
    } else {
      merged = filteredMerged
    }
  } else {
    merged = filteredMerged
  }

  // 质量检查：最高加权分过低 → 未命中
  const topScore = merged[0]?.weightedScore || 0
  const topRawScore = merged[0]?.score || 0
  if (merged.length === 0 || (topRawScore < 0.15 && topScore < 0.15)) {
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
  // 优先级：QA 口语化答案 > 按意图口语化生成 > 检索 top 片段拼接（仅 comparison/scenario）
  let primaryAnswer
  if (qaFinalAnswer) {
    primaryAnswer = qaFinalAnswer
  } else if (intent === 'list' && topNote && topNote.keyPoints && topNote.keyPoints.length) {
    // 列举类：用 keyPoints 生成口语化串联，避免粘贴清单
    primaryAnswer = composeListSummary(topNote.keyPoints)
  } else if (intent === 'definition') {
    // 定义类：用标题 + keyPoint 组织"XXX 就是…"句式，避免粘贴原始片段
    primaryAnswer = composeDefinitionAnswer(topNote, merged[0]?.content)
  } else if (intent === 'general') {
    // 综合类：从检索片段提取核心句，去掉表格/列表符号
    primaryAnswer = composeGeneralAnswer(merged)
  } else {
    // 对比类/场景类：保留片段拼接（含表格结构，供前端结构化渲染）
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
