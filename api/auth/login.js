import crypto from 'crypto'

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

    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('查询用户失败:', response.status, errorText)
      throw new Error(`查询用户失败: ${response.status}`)
    }

    const users = await response.json()

    if (users.length === 0) {
      return res.status(401).json({ error: '账号或密码错误' })
    }

    const user = users[0]

    if (!user.password || !user.password.includes(':')) {
      console.error('用户密码格式错误:', user.username)
      return res.status(500).json({ error: '用户数据格式错误' })
    }

    const [salt, storedHash] = user.password.split(':')
    
    if (!salt || !storedHash) {
      console.error('密码解析失败:', user.username)
      return res.status(500).json({ error: '用户数据格式错误' })
    }

    const hash = crypto.scryptSync(password, salt, 64).toString('hex')

    if (hash !== storedHash) {
      return res.status(401).json({ error: '账号或密码错误' })
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const sessionRes = await fetch(`${supabaseUrl}/rest/v1/sessions`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        token,
        user_id: String(user.id),
        username: user.display_name || user.username,
        role: user.role,
        expires_at: expiresAt
      })
    })

    if (!sessionRes.ok) {
      const errorText = await sessionRes.text().catch(() => '')
      console.error('创建 session 失败:', sessionRes.status, errorText)
    }

    res.status(200).json({
      user: {
        id: String(user.id),
        username: user.display_name || user.username,
        role: user.role
      },
      token
    })
  } catch (error) {
    console.error('登录 API 错误:', error.message, error.stack)
    res.status(500).json({ error: '登录失败，请稍后重试' })
  }
}
