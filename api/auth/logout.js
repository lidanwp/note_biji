export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY
  const { token } = req.body

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

  res.json({ success: true })
}
