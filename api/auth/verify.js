import { requireAuth } from '../_lib/supabase-auth.js'

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

  try {
    const authResult = await requireAuth(req)

    if (authResult.error) {
      return res.status(authResult.status).json({ error: authResult.error })
    }

    res.json({
      user: authResult.user
    })
  } catch (error) {
    console.error('验证 token 失败:', error)
    res.status(500).json({ error: '验证失败' })
  }
}