import crypto from 'crypto'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

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
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  try {
    const { userId, oldPassword, newPassword } = req.body

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: '缺少参数' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少需要6位' })
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({ error: '新密码不能与旧密码相同' })
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    if (!response.ok) {
      throw new Error('查询用户失败')
    }

    const users = await response.json()

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const user = users[0]

    if (!user.password || !user.password.includes(':')) {
      return res.status(500).json({ error: '用户数据格式错误' })
    }

    const [salt, storedHash] = user.password.split(':')
    
    if (!salt || !storedHash) {
      return res.status(500).json({ error: '用户数据格式错误' })
    }

    const hash = crypto.scryptSync(oldPassword, salt, 64).toString('hex')

    if (hash !== storedHash) {
      return res.status(401).json({ error: '旧密码不正确' })
    }

    const newHashedPassword = hashPassword(newPassword)

    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ password: newHashedPassword })
      }
    )

    if (!updateRes.ok) {
      const errorText = await updateRes.text().catch(() => '')
      console.error('更新密码失败:', updateRes.status, errorText)
      return res.status(500).json({ error: '更新密码失败' })
    }

    await fetch(`${supabaseUrl}/rest/v1/sessions?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    }).catch(() => {})

    res.status(200).json({ message: '密码修改成功，请重新登录' })
  } catch (error) {
    console.error('修改密码 API 错误:', error)
    res.status(500).json({ error: '修改密码失败，请稍后重试' })
  }
}
