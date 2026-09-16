export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  // 这是历史遗留的自建 session 表清理（现行鉴权已改为 Supabase Auth JWT）。
  // 数据库已开启 RLS 且不给 anon 任何策略（scripts/007_lock_down_rls.sql），故用 service_role。
  // 若按 007 脚本的可选清理部分 drop 掉 sessions 表，这整段可以直接删。
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const { token } = req.body || {}

  if (!token || !supabaseUrl || !supabaseKey) {
    return res.json({ success: true })
  }

  try {
    await fetch(`${supabaseUrl}/rest/v1/sessions?token=eq.${token}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })
  } catch (_) {
    // 删除失败不影响前端登出
  }

  return res.json({ success: true })
}
