import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oobyperdpjzktzlbph.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KacaVTayTEo0hWOyyMfw1Q_WSMdGKxQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true
  }
})

export const getSiteUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://bdxxg.asia'
}

// ===== 通过 Vercel API 代理 =====

/** 从 localStorage 获取认证 token（Supabase JWT） */
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
    headers: getAuthHeaders()
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
    examScore: row.exam_score || 0,
    // 阶段上下文感知 + 知识图谱依赖推理（检索服务使用）
    phase: row.phase || null,
    relatedNotes: row.related_notes || []
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

// ===== Storage：录音文件上传 / 删除（经后端 service_role 代理）=====
// Storage 桶无 INSERT/DELETE RLS 策略，写入必须用 service_role
// 流程：前端调后端拿签名URL → 直传Storage（绕过Vercel 4.5MB限制）→ 拿publicUrl
const AUDIO_BUCKET = 'audio-files'

/**
 * 上传录音文件
 * 1) 调后端 /api/upload-audio 用 service_role 生成签名上传 URL
 * 2) 前端用签名 URL 直传到 Supabase Storage（不经 Vercel，支持大文件）
 * @param {File} file 浏览器 File 对象
 * @param {string} userId 当前登录用户 ID
 * @returns {Promise<{name:string, url:string, path:string}>}
 */
export const uploadAudioFile = async (file, userId) => {
  // 1) 后端用 service_role 生成签名上传 URL
  const resp = await fetch('/api/upload-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, fileName: file.name, contentType: file.type })
  })
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}))
    throw new Error(e.error || `生成上传URL失败: ${resp.status}`)
  }
  const { path, token, publicUrl, name } = await resp.json()

  // 2) 前端用签名 URL 直传到 Supabase Storage（不经 Vercel，支持大文件）
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .uploadToSignedUrl(path, token, file, {
      contentType: file.type || 'audio/mpeg'
    })

  if (error) throw new Error(`上传失败: ${error.message}`)

  return { name, url: publicUrl, path }
}

/**
 * 删除 Storage 中的录音文件（经后端 service_role 代理）
 * @param {string} path Storage 内的文件路径（上传时返回的 path）
 */
export const deleteAudioFile = async (path) => {
  if (!path) return
  try {
    const resp = await fetch('/api/delete-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    })
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}))
      console.error('删除录音文件失败:', e.error || resp.status)
    }
  } catch (e) {
    console.error('删除录音文件异常:', e.message)
  }
}