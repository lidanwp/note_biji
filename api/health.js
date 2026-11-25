/**
 * GET /api/health —— 保活探针 / 存活检查
 *
 * 为什么需要它：
 * Supabase 免费版项目连续 7 天没有 API 请求会被自动暂停（paused），
 * 恢复需要手动在后台点 Restore。这个端点每次被调用时都会向 PostgREST
 * 发一次极轻的读请求（`notes` 表只取 1 行 1 列），因此能产生一次真实的
 * 数据库活动，从而把「7 天不活动」的计时重置掉。
 *
 * 谁来定时打它：
 *   - 生产环境：.github/workflows/keep-alive.yml（每 3 小时一次）
 *   - 手动/自建：scripts/keep-alive.mjs
 *
 * 为什么不在 vercel.json 里配 crons：
 *   加 crons 字段会让 Vercel 直接判部署失败（构建前的配置校验就挂），
 *   而且 Hobby 计划本来也限制每天最多一次。详见 workflow 里的说明。
 *
 * 鉴权：
 *   若配置了环境变量 CRON_SECRET，则只接受 `Authorization: Bearer <secret>`
 *   （Vercel Cron 会自动带上这个头）或 `?key=<secret>`。
 *   未配置时匿名可访问——返回值只有状态与延迟，不含任何业务数据。
 */

const TIMEOUT_MS = 8000

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  // ---- 可选鉴权 ----
  const secret = process.env.CRON_SECRET
  if (secret) {
    const header = req.headers.authorization || ''
    const fromHeader = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const fromQuery = typeof req.query?.key === 'string' ? req.query.key : ''
    if (fromHeader !== secret && fromQuery !== secret) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  // 数据库已锁 RLS（scripts/007_lock_down_rls.sql），服务端是唯一客户端，固定用 service_role
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      ok: false,
      error: 'Supabase 环境变量未配置（需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）'
    })
  }

  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // 最轻的读：只取主键一列、限制 1 行。表为空也无所谓——请求本身即算活动
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/notes?select=id&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/json'
        },
        signal: controller.signal
      }
    )

    if (!resp.ok) {
      return res.status(502).json({
        ok: false,
        supabase: 'error',
        status: resp.status,
        ms: Date.now() - startedAt,
        time: new Date().toISOString()
      })
    }

    let rows = 0
    try {
      const data = await resp.json()
      rows = Array.isArray(data) ? data.length : 0
    } catch {
      // 响应体解析失败不影响保活结论：HTTP 200 已经说明数据库醒了
    }

    return res.status(200).json({
      ok: true,
      service: 'note_biji',
      supabase: 'awake',
      rows,
      dbMs: Date.now() - startedAt,
      time: new Date().toISOString()
    })
  } catch (e) {
    const isTimeout = e?.name === 'AbortError'
    return res.status(502).json({
      ok: false,
      supabase: isTimeout ? 'timeout' : 'unreachable',
      error: isTimeout ? `Supabase ${TIMEOUT_MS}ms 内无响应` : String(e?.message || e),
      ms: Date.now() - startedAt,
      time: new Date().toISOString()
    })
  } finally {
    clearTimeout(timer)
  }
}
