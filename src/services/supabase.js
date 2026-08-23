// 注意：前端不再直接使用 @supabase/supabase-js
// 所有数据操作通过 Vercel API 代理（/api/*）进行
// 仅保留 supabaseUrl 常量用于 Storage 图片直传（由后端签名）

/** Supabase Storage 公共 URL 基础路径 */
export const supabaseUrl = 'https://oobypberpdpizktzlbph.supabase.co'

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

// 加载笔记（轻量列表模式，只取卡片所需字段）
// 支持内存缓存，避免重复请求
let notesCache = null
let notesCacheTime = 0
const NOTES_CACHE_TTL = 10000 // 10 秒内存缓存

export const loadNotesFromCloud = async (options = {}) => {
  // 强制刷新时跳过缓存
  if (!options.force && notesCache && (Date.now() - notesCacheTime) < NOTES_CACHE_TTL) {
    return notesCache
  }

  const response = await fetch('/api/notes?mode=list', {
    method: 'GET',
    headers: getAuthHeaders()
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }))
    throw new Error(error.error || `加载失败: ${response.status}`)
  }

  const data = await response.json()
  
  const result = data.map(row => ({
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
    userId: row.user_id || null,
    userExamScores: row.user_exam_scores || {},
    examMapping: row.exam_mapping || { relatedProcesses: [], typicalQuestions: [], commonPitfalls: [] },
    comparisonTable: row.comparison_table || { enabled: false, title: '', cols: [], rows: [] },
    memoryAids: row.memory_aids || [],
    examScore: row.exam_score || 0,
    phase: row.phase || null,
    relatedNotes: row.related_notes || [],
    _textLength: row._textLength,
    _hasFullContent: row._hasFullContent
  }))

  // 存入缓存
  notesCache = result
  notesCacheTime = Date.now()
  return result
}

// 加载单条笔记完整内容（用于编辑回显，绕过列表 mode=list 的裁剪）
export const loadFullNote = async (noteId) => {
  const response = await fetch(`/api/notes/${noteId}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    throw new Error(`加载笔记失败: ${response.status}`)
  }
  const data = await response.json()
  return {
    id: data.id,
    title: data.title || '',
    category: data.category || '',
    keyPoints: data.keyPoints || [],
    scenario: data.scenario || '',
    content: data.content || '',
    caseStudy: data.caseStudy || '',
    tags: data.tags || [],
    attachments: data.attachments || [],
    date: data.date || '',
    viewCount: data.viewCount || 0,
    usefulCount: data.usefulCount || 0,
    examMapping: data.examMapping || { relatedProcesses: [], typicalQuestions: [], commonPitfalls: [] },
    comparisonTable: data.comparisonTable || { enabled: false, title: '', cols: [], rows: [] },
    memoryAids: data.memoryAids || [],
    examScore: data.examScore || 0,
    phase: data.phase || null,
    relatedNotes: data.relatedNotes || [],
    userExamScores: data.userExamScores || {}
  }
}

// 清除笔记缓存（保存/删除后调用）
export const invalidateNotesCache = () => {
  notesCache = null
  notesCacheTime = 0
}

// 保存笔记（单条）
export const saveNoteToCloud = async (note) => {
  invalidateNotesCache()
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
  invalidateNotesCache()
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
  invalidateNotesCache()
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

// ===== Storage：录音文件上传 / 删除 =====
// 方案2：后端生成签名URL → 前端原生fetch直传Storage（绕过Vercel 4.5MB限制）
// 需配合 RLS INSERT 策略（见 scripts/003_create_audio_storage.sql）

/**
 * 上传录音文件
 * 1) 调后端 /api/upload-audio 用 service_role 生成签名上传 URL
 * 2) 前端用原生 fetch PUT 直传到 Supabase Storage（不经 Vercel，无大小限制）
 * @param {File} file 浏览器 File 对象
 * @param {string} userId 当前登录用户 ID
 * @returns {Promise<{name:string, url:string, path:string}>}
 */
export const uploadAudioFile = async (file, userId) => {
  // 1) 后端用 service_role 生成签名上传 URL
  const resp = await fetch('/api/audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'upload', userId, fileName: file.name, contentType: file.type })
  })
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}))
    throw new Error(e.error || `生成上传URL失败: ${resp.status}`)
  }
  const { path, token, signedUrl, publicUrl, name } = await resp.json()

  // 2) 用原生 fetch PUT 直传到 Supabase Storage
  //    不带 Authorization/apikey/x-client-info，避免 SDK 自定义 header 触发 CORS 预检失败
  //    只带 Content-Type，最小化 CORS 预检要求
  const uploadResp = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'audio/mpeg'
    },
    body: file
  })

  if (!uploadResp.ok) {
    const errorText = await uploadResp.text().catch(() => '')
    console.error('[uploadAudioFile] 直传Storage失败:', uploadResp.status, errorText)
    throw new Error(`上传失败: ${uploadResp.status} ${errorText.slice(0, 200)}`)
  }

  return { name, url: publicUrl, path }
}

/**
 * 删除 Storage 中的录音文件（经后端 service_role 代理）
 * @param {string} path Storage 内的文件路径（上传时返回的 path）
 */
export const deleteAudioFile = async (path) => {
  if (!path) return
  try {
    const resp = await fetch('/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', path })
    })
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}))
      console.error('删除录音文件失败:', e.error || resp.status)
    }
  } catch (e) {
    console.error('删除录音文件异常:', e.message)
  }
}