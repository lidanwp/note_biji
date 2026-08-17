import { requireAuth } from './_lib/auth.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 配置不完整' })
  }

  const auth = await requireAuth(req)
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error })
  }

  const currentUserId = auth.user.id

  if (req.method === 'GET') {
    const { noteId } = req.query || {}
    if (!noteId) {
      return res.status(400).json({ error: '缺少 noteId' })
    }

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_note_progress?user_id=eq.${encodeURIComponent(currentUserId)}&note_id=eq.${encodeURIComponent(String(noteId))}&select=id,note_id,user_id,score` ,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`查询失败: ${response.status}`)
      }

      const rows = await response.json()
      const score = rows && rows.length ? Number(rows[0].score) : null
      return res.status(200).json({ score })
    } catch (error) {
      return res.status(500).json({ error: error.message || '查询失败' })
    }
  }

  if (req.method === 'POST') {
    const { noteId, score, userId } = req.body || {}

    if (!noteId || score == null) {
      return res.status(400).json({ error: '缺少 noteId 或 score' })
    }

    if (userId && String(userId) !== String(currentUserId)) {
      return res.status(403).json({ error: '只能修改自己的掌握度' })
    }

    const safeScore = Math.max(0, Math.min(100, Number(score)))

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_note_progress?user_id=eq.${encodeURIComponent(currentUserId)}&note_id=eq.${encodeURIComponent(String(noteId))}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const existingRows = await response.json()
      const payload = {
        user_id: currentUserId,
        note_id: String(noteId),
        score: safeScore,
        updated_at: new Date().toISOString()
      }

      if (existingRows && existingRows.length > 0) {
        const patchRes = await fetch(
          `${supabaseUrl}/rest/v1/user_note_progress?id=eq.${existingRows[0].id}&select=*`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
          }
        )

        if (!patchRes.ok) {
          throw new Error(`更新失败: ${patchRes.status}`)
        }

        const patched = await patchRes.json()
        return res.status(200).json({ score: patched[0]?.score ?? safeScore })
      }

      const insertRes = await fetch(
        `${supabaseUrl}/rest/v1/user_note_progress?select=*`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        }
      )

      if (!insertRes.ok) {
        throw new Error(`插入失败: ${insertRes.status}`)
      }

      const inserted = await insertRes.json()
      return res.status(200).json({ score: inserted[0]?.score ?? safeScore })
    } catch (error) {
      return res.status(500).json({ error: error.message || '保存失败' })
    }
  }

  return res.status(405).json({ error: '方法不允许' })
}
