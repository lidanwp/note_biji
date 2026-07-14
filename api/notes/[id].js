export default async function handler(req, res) {
  const { id } = req.query

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: '方法不允许' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('删除API: 环境变量缺失')
    return res.status(500).json({ error: 'Supabase 环境变量未配置' })
  }

  try {
    console.log('删除笔记:', id)
    const response = await fetch(`${supabaseUrl}/rest/v1/notes?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })

    if (!response.ok) {
      console.error('删除失败:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('错误详情:', errorText)
      throw new Error(`删除失败: ${response.status}`)
    }

    console.log('删除成功:', id)
    res.status(200).json({ success: true, id })
  } catch (error) {
    console.error('删除API 错误:', error)
    res.status(500).json({ error: error.message })
  }
}