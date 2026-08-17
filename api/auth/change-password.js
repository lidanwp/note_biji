export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ error: '未登录' })
    }

    const { oldPassword, newPassword } = req.body || {}

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '缺少参数' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少需要6位' })
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({ error: '新密码不能与旧密码相同' })
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`
      }
    })

    if (!userResponse.ok) {
      return res.status(401).json({ error: '登录已失效，请重新登录' })
    }

    const userData = await userResponse.json()
    const email = userData.email

    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password: oldPassword })
    })

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}))
      return res.status(400).json({ error: '旧密码不正确' })
    }

    const updateResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}))
      return res.status(400).json({ error: errorData.msg || '修改密码失败' })
    }

    res.status(200).json({ message: '密码修改成功，请重新登录' })
  } catch (error) {
    console.error('修改密码 API 错误:', error)
    res.status(500).json({ error: '修改密码失败，请稍后重试' })
  }
}
