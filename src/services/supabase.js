import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 只在环境变量齐全时才创建 Supabase 客户端，否则不阻塞启动
const isConfigured = !!(supabaseUrl && supabaseAnonKey)
export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

// ===== 通过 Vercel API 代理 =====

// 加载笔记
export const loadNotesFromCloud = async () => {
  const response = await fetch('/api/notes', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }))
    throw new Error(error.error || `加载失败: ${response.status}`)
  }

  const data = await response.json()
  
  // 转换字段名
  return data.map(row => ({
    id: row.id,
    title: row.title || '',
    category: row.category || '',
    difficulty: row.difficulty || '中级',
    keyPoints: row.key_points || [],
    scenario: row.scenario || '',
    content: row.content || '',
    caseStudy: row.case_study || '',
    tags: row.tags || [],
    attachments: row.attachments || [],
    date: row.date || '',
    viewCount: row.view_count || 0,
    usefulCount: row.useful_count || 0,
    examMapping: row.exam_mapping || { relatedProcesses: [], typicalQuestions: [], commonPitfalls: [] },
    comparisonTable: row.comparison_table || { enabled: false, title: '', cols: [], rows: [] },
    memoryAids: row.memory_aids || [],
    examScore: row.exam_score || 0
  }))
}

// 保存笔记（单条）
export const saveNoteToCloud = async (note) => {
  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(note)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '保存失败' }))
    throw new Error(error.error || `保存失败: ${response.status}`)
  }

  return await response.json()
}

// 批量保存
export const saveNotesToCloud = async (notes) => {
  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(notes)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '批量保存失败' }))
    throw new Error(error.error || `批量保存失败: ${response.status}`)
  }

  return await response.json()
}

// 删除笔记
export const deleteNoteFromCloud = async (id) => {
  const response = await fetch(`/api/notes/${id}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除失败' }))
    throw new Error(error.error || `删除失败: ${response.status}`)
  }

  return await response.json()
}