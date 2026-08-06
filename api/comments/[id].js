import { requireAuth } from '../_lib/auth.js'

export default async function handler(req, res) {
  // 兼容路由参数 (req.params.id) 和查询参数 (req.query.id)
  const id = req.params?.id || req.query?.id

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: '方法不允许' })
  }

  if (!id) {
    return res.status(400).json({ error: '缺少评论 ID' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 环境变量未配置' })
  }

  // 鉴权：需登录才可删除评论
  const auth = await requireAuth(req, supabaseUrl, supabaseKey)
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error })
  }

  try {
    // 先查询评论，确认是本人或有管理权限
    const findRes = await fetch(
      `${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(id)}&select=user_id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    if (!findRes.ok) {
      const errText = await findRes.text().catch(() => '')
      console.error('查询评论失败:', findRes.status, errText)
      return res.status(500).json({ error: '查询评论失败' })
    }

    const rawText = await findRes.text()
    let comments
    try {
      comments = JSON.parse(rawText)
    } catch (e) {
      console.error('评论数据解析失败:', rawText)
      return res.status(500).json({ error: '评论数据格式错误' })
    }

    const comment = Array.isArray(comments) ? comments[0] : null
    console.log('查询到的评论:', comment, '类型:', typeof comments, '是否数组:', Array.isArray(comments))

    if (!comment) {
      return res.status(404).json({ error: '评论不存在' })
    }

    // auth.user 可能为 undefined（虽然 requireAuth 已验证）
    if (!auth.user) {
      return res.status(401).json({ error: '未授权' })
    }

    // 安全访问 user_id
    const commentUserId = comment.user_id
    const currentUserId = auth.user.id
    const isAdmin = auth.user.role === 'admin'
    console.log('权限检查: commentUserId=', commentUserId, 'currentUserId=', currentUserId, 'isAdmin=', isAdmin)

    if (commentUserId !== currentUserId && !isAdmin) {
      return res.status(403).json({ error: '无权限删除此评论' })
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('删除评论失败:', response.status, errText)
      throw new Error(`删除失败: ${response.status}`)
    }

    console.log('删除成功, id:', id)
    res.status(200).json({ success: true, id })
  } catch (error) {
    console.error('删除API 错误:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || '服务器错误' })
    }
  }
}