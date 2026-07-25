import crypto from 'crypto'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export default async function handler(req, res) {
  try {
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
      console.error('环境变量未配置:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey })
      return res.status(500).json({ error: '服务器配置错误' })
    }

    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: '请输入账号和密码' })
    }

    if (username.length < 3) {
      return res.status(400).json({ error: '账号至少需要3个字符' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6位' })
    }

    // 检查用户名是否已存在
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=id&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    if (!checkRes.ok) {
      const errorText = await checkRes.text().catch(() => '')
      console.error('检查用户名失败:', checkRes.status, errorText)
      throw new Error(`检查用户名失败: ${checkRes.status}`)
    }

    const existingUsers = await checkRes.json()

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: '该账号已被注册，请使用其他账号' })
    }

    // 创建用户（默认角色为 viewer）
    const hashedPassword = hashPassword(password)

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        username: username,
        password: hashedPassword,
        display_name: username,
        role: 'viewer'
      })
    })

    if (!insertRes.ok) {
      const errorText = await insertRes.text().catch(() => '')
      console.error('创建用户失败:', insertRes.status, errorText)
      return res.status(500).json({ error: '注册失败，请稍后重试' })
    }

    const newUser = await insertRes.json()

    // 返回注册成功信息
    res.status(200).json({
      message: '注册成功',
      user: {
        id: String(newUser[0]?.id),
        username: newUser[0]?.display_name || newUser[0]?.username,
        role: newUser[0]?.role
      }
    })

  } catch (error) {
    console.error('注册 API 错误:', error.message, error.stack)
    res.status(500).json({ error: '注册失败，请稍后重试' })
  }
}
