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

    console.log('注册请求 - 环境变量检查:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlLength: supabaseUrl?.length,
      keyLength: supabaseAnonKey?.length
    })

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('环境变量缺失')
      return res.status(500).json({ error: '服务器配置错误' })
    }

    const { email, password } = req.body

    console.log('注册请求 - 参数:', {
      email: email ? email.split('@')[0] + '@***' : null,
      hasPassword: !!password
    })

    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6位' })
    }

    // 直接调用 Supabase Auth 注册
    const signUpResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    })

    console.log('注册请求 - Supabase响应:', {
      status: signUpResponse.status,
      statusText: signUpResponse.statusText
    })

    const signUpData = await signUpResponse.json().catch(() => ({}))
    console.log('注册请求 - Supabase响应数据:', signUpData)

    if (!signUpResponse.ok) {
      const errorMsg = signUpData.msg || signUpData.error_description || signUpData.error || '注册失败'
      console.error('注册失败:', errorMsg)
      return res.status(400).json({ error: errorMsg })
    }

    const userId = signUpData.user?.id

    if (!userId) {
      return res.status(500).json({ error: '注册失败，无法获取用户信息' })
    }

    res.status(200).json({
      message: '注册成功，请检查邮箱完成验证',
      user: {
        id: userId,
        email: signUpData.user?.email || email
      },
      needsVerification: true
    })
  } catch (error) {
    console.error('注册 API 错误:', error.message, error.stack)
    res.status(500).json({ error: '注册失败，请稍后重试' })
  }
}