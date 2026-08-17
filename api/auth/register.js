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

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: '服务器配置错误' })
    }

    const { email, password } = req.body || {}

    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6位' })
    }

    const signUpResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })

    const signUpData = await signUpResponse.json().catch(() => ({}))

    if (!signUpResponse.ok) {
      const errorMsg = signUpData.msg || signUpData.error_description || signUpData.error || '注册失败'
      return res.status(400).json({ error: errorMsg })
    }

    return res.status(200).json({
      message: '注册成功，请检查邮箱点击验证链接完成验证',
      user: {
        id: signUpData.user?.id || null,
        email: signUpData.user?.email || email
      },
      needsVerification: true
    })
  } catch (error) {
    console.error('注册 API 错误:', error.message, error.stack)
    return res.status(500).json({ error: '注册失败，请稍后重试' })
  }
}
