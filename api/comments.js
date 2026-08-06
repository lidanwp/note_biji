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
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 环境变量未配置' })
  }

  try {
    if (req.method === 'GET') {
      const { noteId } = req.query
      const response = await fetch(`${supabaseUrl}/rest/v1/comments?select=*&note_id=eq.${Number(noteId)}&order=created_at.asc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Supabase 请求失败: ${response.status}`)
      }

      const data = await response.json()
      res.status(200).json(data)
    } else if (req.method === 'POST') {
      // 鉴权：需登录才可评论
      const auth = await requireAuth(req)
      if (auth.error) {
        return res.status(auth.status).json({ error: auth.error })
      }

      const body = req.body

      // 特殊 action：删除评论（绕过 DELETE 路由的 bug）
      if (body.action === 'delete' && body.id) {
        // 先查询评论，确认归属
        const findRes = await fetch(
          `${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(body.id)}&select=user_id`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        )

        const comments = await findRes.json()
        const comment = Array.isArray(comments) ? comments[0] : null

        if (!comment) {
          return res.status(404).json({ error: '评论不存在' })
        }

        // 权限校验：只有作者或管理员可删
        if (comment.user_id !== auth.user.id && auth.user.role !== 'admin') {
          return res.status(403).json({ error: '无权限删除此评论' })
        }

        // 执行删除
        const delRes = await fetch(
          `${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(body.id)}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        )

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
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(commentData)
      })

      if (!response.ok) {
        throw new Error(`保存评论失败: ${response.status}`)
      }

      const data = await response.json()
      res.status(200).json(data)
    } else {
      res.status(405).json({ error: '方法不允许' })
    }
  } catch (error) {
    console.error('API 错误:', error)
    res.status(500).json({ error: error.message })
  }
}