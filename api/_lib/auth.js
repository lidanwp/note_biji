/**
 * API 鉴权工具（已迁移到 Supabase Auth JWT 验证）
 * 
 * 用法：
 *   import { requireAuth } from '../_lib/auth.js'
 *   const auth = await requireAuth(req)
 *   if (auth.error) return res.status(auth.status).json({ error: auth.error })
 *   // auth.session 包含 { id, email, displayName, role }
 */

export { requireAuth, verifyJwtToken, getUserProfile } from './supabase-auth.js'