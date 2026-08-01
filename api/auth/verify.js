import { verifyJwtToken, getUserProfile } from '../_lib/supabase-auth.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // POST: 邮箱验证回调（用 token 交换 session）
  if (req.method === 'POST') {
    return handleEmailVerify(req, res)
  }

  // GET: 验证登录 token
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '方法不允许' })
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }

  try {
    const { user, error: verifyError, status } = await verifyJwtToken(token)
    
    if (verifyError) {
      return res.status(status || 401).json({ error: verifyError })
    }

    const profile = await getUserProfile(user.id, token).catch(() => null)

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: profile?.display_name || user.email,
        role: profile?.role || 'viewer'
      }
    })
  } catch (error) {
    console.error('验证 token 失败:', error)
    res.status(500).json({ error: '验证失败' })
  }
}

// ---- 邮箱验证回调 ----
async function handleEmailVerify(req, res) {
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
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=signup`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, type })
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok && data.access_token) {
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

    if (data.error === 'user_already_confirmed') {
      return res.status(200).json({
        success: true,
        message: '邮箱已验证，请直接登录'
      })
    }

    const errorMsg = data.msg || data.error_description || data.error || '验证失败'
    console.error('邮箱验证失败:', errorMsg)
    return res.status(400).json({ error: errorMsg })
  } catch (e) {
    console.error('邮箱验证异常:', e)
    return res.status(500).json({ error: '服务器错误，请稍后重试' })
  }
}
