/**
 * Supabase Auth 验证工具
 * 使用 Supabase JWT 验证替代自定义 session 验证
 */

/**
 * 带超时的 fetch（AbortController 实现）
 * 超时后真正 abort 请求释放 socket，完成后自动清理 timer
 * @param {string} url
 * @param {Object} options - fetch options
 * @param {number} timeout - 超时毫秒，默认 8000（Vercel Hobby 10s 硬超时留余量）
 */
export function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

const supabaseUrl = process.env.SUPABASE_URL
// /auth/v1（GoTrue）网关用 anon key 即可；/rest/v1 读表另用 service_role，见 getUserProfile
const supabaseKey = process.env.SUPABASE_ANON_KEY

/**
 * 使用 JWT token 验证用户身份
 * @param {string} token - Supabase Auth JWT token
 * @returns {Object} - { user, error } 
 */
export async function verifyJwtToken(token) {
  if (!token || !supabaseUrl || !supabaseKey) {
    return { error: '服务器配置错误', status: 500 }
  }

  try {
    const response = await fetchWithTimeout(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          'apikey': supabaseKey,
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
 *
 * 注意：必须用 service_role 查询。数据库已开启 RLS 且不给 anon/authenticated 任何策略
 * （见 scripts/007_lock_down_rls.sql），若改用用户自己的 JWT 查，RLS 会把结果过滤成空数组
 * （PostgREST 此时返回 200 + []，不会报错），结果是 profile 为 null、
 * 管理员被静默降级为 viewer —— 这种失败很难排查，所以这里固定用 service_role。
 *
 * @param {string} userId - auth.users.id
 * @param {string} [_userToken] - 已废弃，保留参数仅为兼容既有调用方
 * @returns {Object|null} - 用户扩展信息
 */
export async function getUserProfile(userId, _userToken) {
  if (!userId) return null

  const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !dbKey) {
    console.error('getUserProfile: 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，无法查询 users 表')
    return null
  }

  try {
    const response = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,display_name,role,created_at`,
      {
        headers: {
          'apikey': dbKey,
          'Authorization': `Bearer ${dbKey}`
        }
      }
    )

    if (!response.ok) {
      console.error('查询 users 表失败:', response.status)
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
 * 优化：优先从 user_metadata 读取 role/display_name，命中则免查 users 表（省一次网络请求）
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

  // Fast path：JWT user_metadata 已包含 role + display_name → 免查 users 表
  const jwtRole = user?.user_metadata?.role
  const jwtDisplayName = user?.user_metadata?.display_name

  if (jwtRole && jwtDisplayName) {
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: jwtDisplayName,
        role: jwtRole
      },
      profile: null
    }
  }

  // Fallback：metadata 缺失（老用户未经过 login.js 回写），查 users 表
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