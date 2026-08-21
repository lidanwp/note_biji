import { requireAuth } from './_lib/auth.js'

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const auth = await requireAuth(req)
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error })
  }

  const currentUserId = auth.user.id
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 配置不完整' })
  }

  if (req.method === 'GET') {
    const noteId = req.query?.noteId
    if (!noteId) {
      return res.status(400).json({ error: '缺少 noteId' })
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/user_note_progress?user_id=eq.${encodeURIComponent(currentUserId)}&note_id=eq.${encodeURIComponent(String(noteId))}&select=id,note_id,user_id,score`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`查询失败: ${response.status}`)
      }

      const rows = await response.json()
      const score = rows && rows.length ? Number(rows[0].score) : null
      // 用户掌握度缓存 10 秒足够
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60')
      return res.status(200).json({ score })
    } catch (error) {
      return res.status(500).json({ error: error.message || '查询失败' })
    }
  }

  if (req.method === 'POST') {
    const { noteId, score, userId } = getBody(req)
    if (!noteId || score == null) {
      return res.status(400).json({ error: '缺少 noteId 或 score' })
    }

    if (userId && String(userId) !== String(currentUserId)) {
      return res.status(403).json({ error: '只能修改自己的掌握度' })
    }

    const safeScore = Math.max(0, Math.min(100, Number(score)))

    try {
      // UPSERT：一次请求完成插入或更新（依赖 UNIQUE(user_id, note_id) 约束）
      // resolution=merge-duplicates + on_conflict 指定冲突列
      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_note_progress?on_conflict=user_id,note_id&select=score`,
        {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation,resolution=merge-duplicates'
          },
          body: JSON.stringify({
            user_id: currentUserId,
            note_id: String(noteId),
            score: safeScore,
            updated_at: new Date().toISOString()
          })
        }
      )

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        console.error('upsert progress failed:', response.status, errText)
        throw new Error(`保存失败: ${response.status}`)
      }

      const result = await response.json()
      return res.status(200).json({ score: result[0]?.score ?? safeScore })
    } catch (error) {
      return res.status(500).json({ error: error.message || '保存失败' })
    }
  }

  return res.status(405).json({ error: '方法不允许' })
}
