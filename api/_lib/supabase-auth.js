/**
 * Supabase Auth 验证工具
 * 使用 Supabase JWT 验证替代自定义 session 验证
 */

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * 使用 JWT token 验证用户身份
 * @param {string} token - Supabase Auth JWT token
 * @returns {Object} - { user, error } 
 */
export async function verifyJwtToken(token) {
  if (!token || !supabaseUrl || !supabaseServiceKey) {
    return { error: '服务器配置错误', status: 500 }
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      return { error: '登录已过期，请重新登录', status: 401 }
    }

    const user = await response.json()
    return { user }
  } catch (e) {
    console.error('JWT 验证错误:', e)
    return { error: '验证服务异常', status: 500 }
  }
}

/**
 * 获取用户的扩展信息（从 users 表查询 role 等）
 * @param {string} userId - auth.users.id
 * @returns {Object} - 用户扩展信息
 */
export async function getUserProfile(userId) {
  if (!userId) return null

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,display_name,role,created_at`,
      {
        headers: {
          'apikey': supabaseServiceKey || process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${supabaseServiceKey || process.env.SUPABASE_ANON_KEY}`
        }
      }
    )

    if (!response.ok) {
      return null
    }

    const profiles = await response.json()
    return profiles.length > 0 ? profiles[0] : null
  } catch (e) {
    console.error('获取用户扩展信息错误:', e)
    return null
  }
}

/**
 * 完整验证流程：JWT 验证 + 获取用户信息
 * @param {Object} req - HTTP 请求对象
 * @returns {Object} - { user, profile, error }
 */
export async function requireAuth(req) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return { error: '未登录', status: 401 }
  }

  const { user, error: verifyError, status } = await verifyJwtToken(token)
  
  if (verifyError) {
    return { error: verifyError, status }
  }

  const profile = await getUserProfile(user.id)

  return { 
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.display_name || user.email,
      role: profile?.role || 'viewer'
    },
    profile
  }
}