import crypto from 'crypto'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // 仅支持 GET 请求（浏览器地址栏访问即可）
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '方法不允许' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 环境变量未配置' })
  }

  try {
    // 检查是否已有用户（防止重复 seed）
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )
    const existing = await checkRes.json()

    if (existing.length > 0) {
      return res.json({ message: '✅ 用户已存在，跳过初始化', count: existing.length })
    }

    // 种子用户
    const rawUsers = [
      { username: '13302465541', password: 'wp199582', display_name: '管理员', role: 'admin' },
      { username: '呼叫中心冲冲冲', password: '呼叫中心666', display_name: '呼叫中心冲冲冲', role: 'viewer' },
      { username: '13800138000', password: '123456', display_name: '张经理', role: 'viewer' }
    ]

    const hashedUsers = rawUsers.map(u => ({
      username: u.username,
      password: hashPassword(u.password),
      display_name: u.display_name,
      role: u.role
    }))

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(hashedUsers)
    })

    if (!insertRes.ok) {
      const err = await insertRes.text()
      throw new Error(`插入用户失败: ${err}`)
    }

    res.json({ message: '✅ 用户初始化成功', count: rawUsers.length })
  } catch (error) {
    console.error('Seed 错误:', error)
    res.status(500).json({ error: error.message })
  }
}
