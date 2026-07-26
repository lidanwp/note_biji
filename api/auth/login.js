export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' })
  }

  try {
    // 调用 Supabase Auth 登录
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    })

    if (!authResponse.ok) {
      const errorData = await authResponse.json().catch(() => ({}))
      const errorMsg = errorData.msg === 'Invalid login credentials' ? '邮箱或密码错误' : '登录失败，请重试'
      return res.status(401).json({ error: errorMsg })
    }

    const session = await authResponse.json()

    // 获取用户扩展信息（使用用户自己的 token）
    let profile = null
    try {
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )
      if (profileResponse.ok) {
        const profiles = await profileResponse.json()
        profile = profiles.length > 0 ? profiles[0] : null
      }
    } catch (err) {
      console.error('获取用户扩展信息失败:', err)
    }

    res.status(200).json({
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: profile?.display_name || session.user.email,
        role: profile?.role || 'viewer'
      },
      token: session.access_token,
      expiresIn: session.expires_in
    })
  } catch (error) {
    console.error('登录 API 错误:', error.message)
    res.status(500).json({ error: '登录失败，请稍后重试' })
  }
}