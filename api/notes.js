export default async function handler(req, res) {
  console.log('=== API /api/notes 被调用 ===')
  console.log('请求方法:', req.method)
  console.log('SUPABASE_URL 是否存在:', !!process.env.SUPABASE_URL)
  console.log('SUPABASE_ANON_KEY 是否存在:', !!process.env.SUPABASE_ANON_KEY)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('环境变量缺失: SUPABASE_URL 或 SUPABASE_ANON_KEY')
    return res.status(500).json({ error: 'Supabase 环境变量未配置' })
  }

  try {
    // GET - 加载所有笔记
    if (req.method === 'GET') {
      console.log('开始请求 Supabase...')
      const response = await fetch(`${supabaseUrl}/rest/v1/notes?select=*&order=date.desc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.error('Supabase 请求失败:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('错误详情:', errorText)
        throw new Error(`Supabase 请求失败: ${response.status}`)
      }

      const data = await response.json()
      console.log('加载成功，返回', data.length, '条笔记')
      res.status(200).json(data)
    }

    // POST - 保存笔记（支持单条或批量，支持部分更新）
    else if (req.method === 'POST') {
      const body = req.body
      const notesArray = Array.isArray(body) ? body : [body]
      console.log('收到 POST 请求，保存', notesArray.length, '条笔记')

      let allData = []
      for (const note of notesArray) {
        // 构建完整数据
        const noteData = {
          id: note.id,
          title: note.title || '',
          category: note.category || '',
          difficulty: note.difficulty || '中级',
          key_points: note.keyPoints || [],
          scenario: note.scenario || '',
          content: note.content || '',
          case_study: note.caseStudy || '',
          tags: note.tags || [],
          attachments: note.attachments || [],
          date: note.date || '',
          view_count: note.viewCount || 0,
          useful_count: note.usefulCount || 0,
          exam_mapping: note.examMapping || { relatedProcesses: [], typicalQuestions: [], commonPitfalls: [] },
          comparison_table: note.comparisonTable || { enabled: false, title: '', cols: [], rows: [] },
          memory_aids: note.memoryAids || [],
          exam_score: note.examScore || 0
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/notes?on_conflict=id&select=*`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation,resolution=merge-duplicates'
          },
          body: JSON.stringify(noteData)
        })

        if (!response.ok) {
          console.error('保存笔记失败:', response.status, response.statusText)
          const errorText = await response.text()
          console.error('错误详情:', errorText)
          throw new Error(`保存笔记 ${note.id} 失败: ${response.status}`)
        }

        const data = await response.json()
        allData = allData.concat(data)
      }

      console.log('保存成功，返回', allData.length, '条笔记')
      res.status(200).json(allData)
    }

    // 其他方法
    else {
      res.status(405).json({ error: '方法不允许' })
    }
  } catch (error) {
    console.error('API 错误:', error)
    res.status(500).json({ error: error.message })
  }
}