export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
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

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/sessions?token=eq.${token}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    const sessions = await response.json()

    if (sessions.length === 0) {
      return res.status(401).json({ error: '登录已过期，请重新登录' })
    }

    res.json({
      user: {
        id: sessions[0].user_id,
        username: sessions[0].username,
        role: sessions[0].role
      }
    })
  } catch (error) {
    console.error('验证 token 失败:', error)
    res.status(500).json({ error: '验证失败' })
  }
}
