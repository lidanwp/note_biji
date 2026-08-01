// 邮箱验证回调接口
// Supabase 邮箱确认链接会携带 token 和 type 参数
// 此接口用 token 交换 session，完成邮箱验证
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { token, type = 'signup', email } = req.body || {}

    if (!token) {
      return res.status(400).json({ error: '缺少验证 token' })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: '服务器配置错误' })
    }

    // 用 token 交换 session（Supabase 会自动完成邮箱验证）
    // https://supabase.com/docs/reference/auth/exchange-a-code-for-a-session
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=signup`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token,
        type
      })
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok && data.access_token) {
      // 验证成功，返回 token 信息供前端使用
      return res.status(200).json({
        success: true,
        message: '邮箱验证成功',
        user: {
          id: data.user?.id,
          email: data.user?.email || email,
          role: data.user?.user_metadata?.role || 'viewer'
        },
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
      })
    }

    // 检查是否已经验证过（token 已使用）
    if (data.error === 'user_already_confirmed') {
      return res.status(200).json({
        success: true,
        message: '邮箱已验证，请直接登录'
      })
    }

    // 验证失败
    const errorMsg = data.msg || data.error_description || data.error || '验证失败'
    console.error('邮箱验证失败:', errorMsg)
    return res.status(400).json({ error: errorMsg })

  } catch (e) {
    console.error('邮箱验证接口异常:', e)
    return res.status(500).json({ error: '服务器错误，请稍后重试' })
  }
}
