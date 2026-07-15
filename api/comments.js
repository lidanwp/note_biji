export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 环境变量未配置' })
  }

  try {
    if (req.method === 'GET') {
      const { noteId } = req.query
      const response = await fetch(`${supabaseUrl}/rest/v1/comments?select=*&note_id=eq.${noteId}&order=created_at.asc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Supabase 请求失败: ${response.status}`)
      }

      const data = await response.json()
      res.status(200).json(data)
    } else if (req.method === 'POST') {
      const body = req.body
      const commentData = {
        note_id: body.note_id,
        user_id: body.user_id,
        username: body.username,
        content: body.content,
        parent_id: body.parent_id || null,
        created_at: new Date().toISOString()
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/comments?select=*`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(commentData)
      })

      if (!response.ok) {
        throw new Error(`保存评论失败: ${response.status}`)
      }

      const data = await response.json()
      res.status(200).json(data)
    } else {
      res.status(405).json({ error: '方法不允许' })
    }
  } catch (error) {
    console.error('API 错误:', error)
    res.status(500).json({ error: error.message })
  }
}