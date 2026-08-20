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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 环境变量未配置' })
  }

  if (req.method === 'GET') {
    const noteId = req.query?.noteId || req.query?.note_id
    if (!noteId) {
      return res.status(400).json({ error: '缺少 noteId 参数' })
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/comments?select=*&note_id=eq.${Number(noteId)}&order=created_at.asc`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Supabase 请求失败: ${response.status}`)
      }

      // 评论数据较小，缓存 15 秒足够覆盖多数阅读场景
      res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=120')
      return res.status(200).json(await response.json())
    } catch (error) {
      console.error('comments GET error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'POST') {
    const auth = await requireAuth(req)
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error })
    }

    try {
      const body = getBody(req)
      const rawQuery = req.query || {}
      if (!body.note_id && rawQuery.noteId) {
        body.note_id = rawQuery.noteId
      }

      if (body.action === 'delete' && body.id) {
        const findRes = await fetch(`${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(body.id)}&select=user_id`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        })

        const comments = await findRes.json().catch(() => [])
        const comment = Array.isArray(comments) ? comments[0] : null
        if (!comment) return res.status(404).json({ error: '评论不存在' })

        if (comment.user_id !== auth.user.id && auth.user.role !== 'admin') {
          return res.status(403).json({ error: '无权限删除此评论' })
        }

        const delRes = await fetch(`${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(body.id)}`, {
          method: 'DELETE',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        })

        if (!delRes.ok) {
          throw new Error(`删除失败: ${delRes.status}`)
        }

        return res.status(200).json({ success: true, id: body.id })
      }

      const commentData = {
        note_id: Number(body.note_id),
        user_id: auth.user.id,
        username: auth.user.displayName,
        content: body.content,
        parent_id: body.parent_id || null,
        created_at: new Date().toISOString()
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/comments?select=*`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(commentData)
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        console.error('save comment failed:', response.status, errText)
        throw new Error(`保存评论失败: ${response.status}`)
      }

      return res.status(200).json(await response.json())
    } catch (error) {
      console.error('comments POST error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(405).json({ error: '方法不允许' })
}
