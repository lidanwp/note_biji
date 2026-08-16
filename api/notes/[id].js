// ===== api/notes/[id].js =====

import { requireAuth } from '../_lib/auth.js'

export default async function handler(req, res) {
  const { id } = req.query

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('API: 环境变量缺失')
    return res.status(500).json({ error: 'Supabase 环境变量未配置' })
  }

  // ===== GET - 加载单条笔记完整内容 =====
  if (req.method === 'GET') {
    try {
      console.log('加载笔记详情:', id)
      const response = await fetch(
        `${supabaseUrl}/rest/v1/notes?id=eq.${id}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.error('加载失败:', response.status, response.statusText)
        throw new Error(`加载失败: ${response.status}`)
      }

      const data = await response.json()

      if (!data || data.length === 0) {
        return res.status(404).json({ error: '笔记不存在' })
      }

      // 下划线转驼峰
      const note = data[0]
      res.status(200).json({
        id: note.id,
        title: note.title || '',
        category: note.category || '',
        difficulty: note.difficulty || '中级',
        keyPoints: note.key_points || [],
        scenario: note.scenario || '',
        content: note.content || '',
        caseStudy: note.case_study || '',
        tags: note.tags || [],
        attachments: note.attachments || [],
        date: note.date || '',
        viewCount: note.view_count || 0,
        usefulCount: note.useful_count || 0,
        examMapping: note.exam_mapping || { relatedProcesses: [], typicalQuestions: [], commonPitfalls: [] },
        comparisonTable: note.comparison_table || { enabled: false, title: '', cols: [], rows: [] },
        memoryAids: note.memory_aids || [],
        examScore: note.exam_score || 0,
        phase: note.phase || null,
        relatedNotes: note.related_notes || []
      })
    } catch (error) {
      console.error('加载笔记详情失败:', error)
      res.status(500).json({ error: error.message })
    }
    return
  }

  // ===== DELETE - 删除笔记 =====
  if (req.method === 'DELETE') {
    // 鉴权：仅 admin 可删除笔记
    const auth = await requireAuth(req)
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error })
    }
    if (auth.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限，仅管理员可删除笔记' })
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
    return
  }

  // 其他方法
  res.status(405).json({ error: '方法不允许' })
}