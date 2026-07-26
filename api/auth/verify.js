import { verifyJwtToken, getUserProfile } from '../_lib/supabase-auth.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '方法不允许' })
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }

  try {
    // 先验证 JWT 是否有效
    const { user, error: verifyError, status } = await verifyJwtToken(token)
    
    if (verifyError) {
      return res.status(status || 401).json({ error: verifyError })
    }

    // 尝试获取扩展信息（使用用户自己的 token 避免 RLS 拒绝）
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
