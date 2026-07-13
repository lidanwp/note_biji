// api/notes.js
export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 环境变量未配置' });
  }

  try {
    // 根据请求方法处理
    if (req.method === 'GET') {
      // 加载笔记
      const response = await fetch(`${supabaseUrl}/rest/v1/notes?select=*&order=date.desc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase 请求失败: ${response.status}`);
      }

      const data = await response.json();
      res.status(200).json(data);
    } 
    else if (req.method === 'POST') {
      // 保存笔记（支持单条或批量）
      const notes = req.body;
      const notesArray = Array.isArray(notes) ? notes : [notes];

      // 批量保存
      let allData = [];
      for (const note of notesArray) {
        const response = await fetch(`${supabaseUrl}/rest/v1/notes?on_conflict=id&select=*`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation,resolution=merge-duplicates'
          },
          body: JSON.stringify({
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
          })
        });

        if (!response.ok) {
          throw new Error(`保存笔记 ${note.id} 失败: ${response.status}`);
        }

        const data = await response.json();
        allData = allData.concat(data);
      }

      res.status(200).json(allData);
    }
    else {
      res.status(405).json({ error: '方法不允许' });
    }
  } catch (error) {
    console.error('API 错误:', error);
    res.status(500).json({ error: error.message });
  }
}