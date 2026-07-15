import { requireAuth } from '../_lib/auth.js'

export default async function handler(req, res) {
  const { id } = req.query

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
      `${supabaseUrl}/rest/v1/comments?id=eq.${id}&select=user_id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )
    const comments = await findRes.json()
    const comment = comments[0]

    if (comment && comment.user_id !== auth.session.user_id && auth.session.role !== 'admin') {
      return res.status(403).json({ error: '无权限删除此评论' })
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/comments?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })

    if (!response.ok) {
      throw new Error(`删除失败: ${response.status}`)
    }

    res.status(200).json({ success: true, id })
  } catch (error) {
    console.error('删除API 错误:', error)
    res.status(500).json({ error: error.message })
  }
}