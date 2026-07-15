import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 检查环境变量是否存在
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase 环境变量未配置，请检查 .env.local 文件')
}

// 只在环境变量存在时创建客户端
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null

// ===== 通过 Vercel API 代理 =====

/** 从 localStorage 获取认证 token */
function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  try {
    const stored = localStorage.getItem('auth')
    if (stored) {
      const { token } = JSON.parse(stored)
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }
  } catch (_) {}
  return headers
}

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
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
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
    method: 'DELETE',
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除失败' }))
    throw new Error(error.error || `删除失败: ${response.status}`)
  }

  return await response.json()
}

// 更新浏览量
export const updateViewCount = async (id, viewCount) => {
  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: id,
      viewCount: viewCount
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新浏览量失败' }))
    throw new Error(error.error || `更新浏览量失败: ${response.status}`)
  }

  return await response.json()
}

// 更新有用数
export const updateUsefulCount = async (id, usefulCount) => {
  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: id,
      usefulCount: usefulCount
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新有用数失败' }))
    throw new Error(error.error || `更新有用数失败: ${response.status}`)
  }

  return await response.json()
}