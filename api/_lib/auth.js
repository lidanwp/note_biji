/**
 * API 鉴权工具
 * 从请求的 Authorization header 验证 session token
 *
 * 用法：
 *   import { requireAuth } from '../_lib/auth.js'
 *   const auth = await requireAuth(req, supabaseUrl, supabaseKey)
 *   if (auth.error) return res.status(auth.status).json({ error: auth.error })
 *   // auth.session 包含 { user_id, username, role }
 */

export async function requireAuth(req, supabaseUrl, supabaseKey) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token || !supabaseUrl || !supabaseKey) {
    return { error: '未登录', status: 401 }
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/sessions?token=eq.${token}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    if (!response.ok) {
      return { error: '验证失败', status: 500 }
    }

    const sessions = await response.json()
    if (sessions.length === 0) {
      return { error: '登录已过期，请重新登录', status: 401 }
    }

    return { session: sessions[0] }
  } catch (e) {
    console.error('requireAuth 错误:', e)
    return { error: '验证服务异常', status: 500 }
  }
}
