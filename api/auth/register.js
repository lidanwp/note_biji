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
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  const { email, password, displayName } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' })
  }

  // 简单的邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '请输入有效的邮箱地址' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少需要6位' })
  }

  try {
    // 检查邮箱是否已在 auth.users 中注册（可选步骤，Supabase Auth 会自动检查）
    // 这里省略检查，直接尝试注册

    // 尝试注册，Supabase Auth 会自动检查邮箱唯一性
    const signUpResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          display_name: displayName || email.split('@')[0]
        }
      })
    })

    if (!signUpResponse.ok) {
      const errorData = await signUpResponse.json().catch(() => ({}))
      
      if (errorData.msg?.includes('already registered') || errorData.error?.includes('already registered')) {
        return res.status(400).json({ error: '该邮箱已被注册' })
      }
      
      return res.status(400).json({ error: '注册失败：' + (errorData.msg || '请检查邮箱和密码') })
    }

    const signUpData = await signUpResponse.json()
    const userId = signUpData.user?.id

    if (!userId) {
      return res.status(500).json({ error: '注册失败，无法获取用户信息' })
    }

    // 在 users 扩展表中创建用户记录
    if (supabaseServiceRoleKey) {
      // 使用 Service Role Key 绕过 RLS
      const profileResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceRoleKey,
          'Authorization': `Bearer ${supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: userId,
          username: email,
          display_name: displayName || email.split('@')[0],
          role: 'viewer',
          email: email
        })
      })

      if (!profileResponse.ok) {
        console.error('创建用户扩展信息失败:', profileResponse.status, await profileResponse.text())
      }
    } else {
      console.warn('Service Role Key 未配置，跳过创建用户扩展信息')
    }

    res.status(200).json({
      message: '注册成功，请检查邮箱完成验证',
      user: {
        id: userId,
        email: signUpData.user?.email || email,
        displayName: displayName || email.split('@')[0],
        role: 'viewer'
      },
      needsVerification: true
    })
  } catch (error) {
    console.error('注册 API 错误:', error.message)
    res.status(500).json({ error: '注册失败，请稍后重试' })
  }
}