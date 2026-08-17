import { createClient } from '@supabase/supabase-js'
import { requireAuth, verifyJwtToken, getUserProfile } from './_lib/auth.js'
import { retrieve } from './_lib/retrievalService.js'

function getSegments(req) {
  const rawPath = typeof req.url === 'string' ? req.url.split('?')[0] : '/'
  const cleaned = rawPath.replace(/^\/api\/?/, '').replace(/^\//, '')
  return cleaned ? cleaned.split('/').filter(Boolean) : []
}

function getQuery(req) {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    return Object.fromEntries(url.searchParams.entries())
  } catch {
    return {}
  }
}

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return {}
}

async function handleLogin(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  const { email, password } = getBody(req)
  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' })
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })

    if (!authResponse.ok) {
      const errorData = await authResponse.json().catch(() => ({}))
      const errorMsg = errorData.msg === 'Invalid login credentials' ? '邮箱或密码错误' : '登录失败，请重试'
      return res.status(401).json({ error: errorMsg })
    }

    const session = await authResponse.json()
    let profile = null
    try {
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )
      if (profileResponse.ok) {
        const profiles = await profileResponse.json()
        profile = profiles.length > 0 ? profiles[0] : null
      }
    } catch (err) {
      console.error('获取用户扩展信息失败:', err)
    }

    return res.status(200).json({
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: profile?.display_name || session.user.email,
        role: profile?.role || 'viewer'
      },
      token: session.access_token,
      expiresIn: session.expires_in
    })
  } catch (error) {
    console.error('登录 API 错误:', error.message)
    return res.status(500).json({ error: '登录失败，请稍后重试' })
  }
}

async function handleRegister(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  const { email, password } = getBody(req)
  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少需要6位' })
  }

  try {
    const signUpResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })

    const signUpData = await signUpResponse.json().catch(() => ({}))

    if (!signUpResponse.ok) {
      const errorMsg = signUpData.msg || signUpData.error_description || signUpData.error || '注册失败'
      return res.status(400).json({ error: errorMsg })
    }

    return res.status(200).json({
      message: '注册成功，请检查邮箱点击验证链接完成验证',
      user: {
        id: signUpData.user?.id || null,
        email: signUpData.user?.email || email
      },
      needsVerification: true
    })
  } catch (error) {
    console.error('注册 API 错误:', error.message, error.stack)
    return res.status(500).json({ error: '注册失败，请稍后重试' })
  }
}

async function handleLogout(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY
  const { token } = getBody(req)

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
  } catch (_) {}

  return res.json({ success: true })
}

async function handleVerify(req, res) {
  if (req.method === 'POST') {
    const { token, type = 'signup', email } = getBody(req)
    if (!token) {
      return res.status(400).json({ error: '缺少验证 token' })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: '服务器配置错误' })
    }

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=signup`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, type })
      })

      const data = await response.json().catch(() => ({}))
      if (response.ok && data.access_token) {
        return res.status(200).json({
          success: true,
          message: '邮箱验证成功',
          user: {
            id: data.user?.id,
            email: data.user?.email || email,
            role: data.user?.user_metadata?.role || 'viewer'
          },
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in
        })
      }

      if (data.error === 'user_already_confirmed') {
        return res.status(200).json({ success: true, message: '邮箱已验证，请直接登录' })
      }

      const errorMsg = data.msg || data.error_description || data.error || '验证失败'
      return res.status(400).json({ error: errorMsg })
    } catch (e) {
      console.error('邮箱验证异常:', e)
      return res.status(500).json({ error: '服务器错误，请稍后重试' })
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '方法不允许' })
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }

  try {
    const { user, error: verifyError, status } = await verifyJwtToken(token)
    if (verifyError) {
      return res.status(status || 401).json({ error: verifyError })
    }

    const profile = await getUserProfile(user.id, token).catch(() => null)
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: profile?.display_name || user.email,
        role: profile?.role || 'viewer'
      }
    })
  } catch (error) {
    console.error('验证 token 失败:', error)
    return res.status(500).json({ error: '验证失败' })
  }
}

async function handleChangePassword(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }

  const { oldPassword, newPassword } = getBody(req)
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '缺少参数' })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少需要6位' })
  }
  if (oldPassword === newPassword) {
    return res.status(400).json({ error: '新密码不能与旧密码相同' })
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`
      }
    })

    if (!userResponse.ok) {
      return res.status(401).json({ error: '登录已失效，请重新登录' })
    }

    const userData = await userResponse.json()
    const email = userData.email

    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password: oldPassword })
    })

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}))
      return res.status(400).json({ error: '旧密码不正确' })
    }

    const updateResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}))
      return res.status(400).json({ error: errorData.msg || '修改密码失败' })
    }

    return res.status(200).json({ message: '密码修改成功，请重新登录' })
  } catch (error) {
    console.error('修改密码 API 错误:', error)
    return res.status(500).json({ error: '修改密码失败，请稍后重试' })
  }
}

async function handleNotes(req, res) {
  const segments = getSegments(req)
  const query = getQuery(req)
  const noteId = segments[1] || query.noteId || query.id

  if (req.method === 'GET' && !noteId) {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase 环境变量未配置' })
    }

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/notes?select=id,title,category,date,view_count,useful_count,tags,created_at,user_id,key_points,scenario,content,case_study,attachments,exam_mapping,comparison_table,memory_aids,exam_score,phase,related_notes&order=date.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Supabase 请求失败: ${response.status}`)
      }

      const data = await response.json()
      return res.status(200).json(data)
    } catch (error) {
      console.error('API 错误:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'POST' && !noteId) {
    const body = getBody(req)
    const notesArray = Array.isArray(body) ? body : [body]
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase 环境变量未配置' })
    }

    try {
      let allData = []
      for (const note of notesArray) {
        const isPartialUpdate =
          (note.viewCount !== undefined || note.usefulCount !== undefined || note.examScore !== undefined) &&
          note.title === undefined && note.content === undefined

        if (isPartialUpdate) {
          const patchData = {}
          if (note.viewCount !== undefined) patchData.view_count = note.viewCount
          if (note.usefulCount !== undefined) patchData.useful_count = note.usefulCount
          if (note.examScore !== undefined) patchData.exam_score = note.examScore

          const response = await fetch(`${supabaseUrl}/rest/v1/notes?id=eq.${note.id}&select=*`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(patchData)
          })

          if (!response.ok) {
            throw new Error(`更新笔记 ${note.id} 失败: ${response.status}`)
          }

          const data = await response.json()
          allData = allData.concat(data)
          continue
        }

        const auth = await requireAuth(req)
        if (auth.error) {
          return res.status(auth.status).json({ error: auth.error })
        }
        if (auth.user.role !== 'admin') {
          return res.status(403).json({ error: '无权限，仅管理员可编辑笔记' })
        }

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
          exam_score: note.examScore || 0,
          phase: note.phase || null,
          related_notes: note.relatedNotes || []
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
          throw new Error(`保存笔记 ${note.id} 失败: ${response.status}`)
        }

        const data = await response.json()
        allData = allData.concat(data)
      }

      return res.status(200).json(allData)
    } catch (error) {
      console.error('API 错误:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'GET' && noteId) {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase 环境变量未配置' })
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/notes?id=eq.${noteId}&select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`加载失败: ${response.status}`)
      }

      const data = await response.json()
      if (!data || data.length === 0) {
        return res.status(404).json({ error: '笔记不存在' })
      }

      const note = data[0]
      return res.status(200).json({
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
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'DELETE' && noteId) {
    const auth = await requireAuth(req)
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error })
    }
    if (auth.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限，仅管理员可删除笔记' })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase 环境变量未配置' })
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/notes?id=eq.${noteId}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      })

      if (!response.ok) {
        throw new Error(`删除失败: ${response.status}`)
      }

      return res.status(200).json({ success: true, id: noteId })
    } catch (error) {
      console.error('删除API 错误:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(405).json({ error: '方法不允许' })
}

async function handleComments(req, res) {
  const segments = getSegments(req)
  const query = getQuery(req)
  const commentId = segments[1] || query.id
  const noteId = query.noteId || query.note_id

  if (req.method === 'GET') {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase 环境变量未配置' })
    }

    const targetNoteId = noteId ?? req.query?.note_id
    if (!targetNoteId) {
      return res.status(400).json({ error: '缺少 noteId 参数' })
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/comments?select=*&note_id=eq.${Number(targetNoteId)}&order=created_at.asc`, {
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
      return res.status(200).json(data)
    } catch (error) {
      console.error('API 错误:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'POST') {
    const auth = await requireAuth(req)
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error })
    }

    const body = getBody(req)
    const rawQuery = getQuery(req)
    if (!body.note_id && rawQuery.noteId) {
      body.note_id = rawQuery.noteId
    }
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    const useKey = serviceKey

    if (!supabaseUrl || !useKey) {
      return res.status(500).json({ error: 'Supabase 环境变量未配置' })
    }

    if (body.action === 'delete' && body.id) {
      const findRes = await fetch(`${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(body.id)}&select=user_id`, {
        headers: {
          'apikey': useKey,
          'Authorization': `Bearer ${useKey}`
        }
      })

      const comments = await findRes.json().catch(() => [])
      const comment = Array.isArray(comments) ? comments[0] : null

      if (!comment) {
        return res.status(404).json({ error: '评论不存在' })
      }

      if (comment.user_id !== auth.user.id && auth.user.role !== 'admin') {
        return res.status(403).json({ error: '无权限删除此评论' })
      }

      const delRes = await fetch(`${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'DELETE',
        headers: {
          'apikey': useKey,
          'Authorization': `Bearer ${useKey}`
        }
      })

      if (!delRes.ok) {
        throw new Error(`删除失败: ${delRes.status}`)
      }

      return res.status(200).json({ success: true, id: body.id })
    }

    const commentData = {
      note_id: Number(body.note_id),
      user_id: auth.user.id,
      username: auth.user.displayName,
      content: body.content,
      parent_id: body.parent_id || null,
      created_at: new Date().toISOString()
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/comments?select=*`, {
      method: 'POST',
      headers: {
        'apikey': useKey,
        'Authorization': `Bearer ${useKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(commentData)
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('保存评论失败:', response.status, errText)
      throw new Error(`保存评论失败: ${response.status}`)
    }

    const data = await response.json()
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE' && commentId) {
    const auth = await requireAuth(req)
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const useKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !useKey) {
      return res.status(500).json({ error: 'Supabase 环境变量未配置' })
    }

    try {
      const findRes = await fetch(`${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(commentId)}&select=user_id`, {
        headers: {
          'apikey': useKey,
          'Authorization': `Bearer ${useKey}`
        }
      })

      const rawText = await findRes.text()
      let comments
      try {
        comments = JSON.parse(rawText)
      } catch (e) {
        comments = []
      }

      const comment = Array.isArray(comments) ? comments[0] : null
      if (!comment) {
        return res.status(404).json({ error: '评论不存在' })
      }

      if (!auth.user) {
        return res.status(401).json({ error: '未授权' })
      }

      const isAdmin = auth.user.role === 'admin'
      if (comment.user_id !== auth.user.id && !isAdmin) {
        return res.status(403).json({ error: '无权限删除此评论' })
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: {
          'apikey': useKey,
          'Authorization': `Bearer ${useKey}`
        }
      })

      if (!response.ok) {
        throw new Error(`删除失败: ${response.status}`)
      }

      return res.status(200).json({ success: true, id: commentId })
    } catch (error) {
      console.error('删除API 错误:', error)
      return res.status(500).json({ error: error.message || '服务器错误' })
    }
  }

  return res.status(405).json({ error: '方法不允许' })
}

async function handleUserProgress(req, res) {
  const auth = await requireAuth(req)
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error })
  }

  const currentUserId = auth.user.id
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 配置不完整' })
  }

  if (req.method === 'GET') {
    const { noteId } = req.query || {}
    if (!noteId) {
      return res.status(400).json({ error: '缺少 noteId' })
    }

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_note_progress?user_id=eq.${encodeURIComponent(currentUserId)}&note_id=eq.${encodeURIComponent(String(noteId))}&select=id,note_id,user_id,score`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`查询失败: ${response.status}`)
      }

      const rows = await response.json()
      const score = rows && rows.length ? Number(rows[0].score) : null
      return res.status(200).json({ score })
    } catch (error) {
      return res.status(500).json({ error: error.message || '查询失败' })
    }
  }

  if (req.method === 'POST') {
    const { noteId, score, userId } = getBody(req)

    if (!noteId || score == null) {
      return res.status(400).json({ error: '缺少 noteId 或 score' })
    }

    if (userId && String(userId) !== String(currentUserId)) {
      return res.status(403).json({ error: '只能修改自己的掌握度' })
    }

    const safeScore = Math.max(0, Math.min(100, Number(score)))

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_note_progress?user_id=eq.${encodeURIComponent(currentUserId)}&note_id=eq.${encodeURIComponent(String(noteId))}&select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const existingRows = await response.json()
      const payload = {
        user_id: currentUserId,
        note_id: String(noteId),
        score: safeScore,
        updated_at: new Date().toISOString()
      }

      if (existingRows && existingRows.length > 0) {
        const patchRes = await fetch(`${supabaseUrl}/rest/v1/user_note_progress?id=eq.${existingRows[0].id}&select=*`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        })

        if (!patchRes.ok) {
          throw new Error(`更新失败: ${patchRes.status}`)
        }

        const patched = await patchRes.json()
        return res.status(200).json({ score: patched[0]?.score ?? safeScore })
      }

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/user_note_progress?select=*`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      })

      if (!insertRes.ok) {
        throw new Error(`插入失败: ${insertRes.status}`)
      }

      const inserted = await insertRes.json()
      return res.status(200).json({ score: inserted[0]?.score ?? safeScore })
    } catch (error) {
      return res.status(500).json({ error: error.message || '保存失败' })
    }
  }

  return res.status(405).json({ error: '方法不允许' })
}

async function handleAudio(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, userId, fileName, path } = getBody(req)

  try {
    if (action === 'delete') {
      if (!path) {
        return res.status(400).json({ error: '缺少 path' })
      }

      const supabaseUrl = process.env.SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: '后端未配置 SUPABASE_SERVICE_ROLE_KEY' })
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })

      const { error } = await supabaseAdmin.storage.from('audio-files').remove([path])
      if (error) {
        console.error('[audio] 删除失败:', error.message)
        return res.status(500).json({ error: '删除失败', message: error.message })
      }

      return res.status(200).json({ success: true })
    }

    if (!fileName) {
      return res.status(400).json({ error: '缺少 fileName' })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: '后端未配置 SUPABASE_SERVICE_ROLE_KEY' })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const safeName = String(fileName).replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
    const filePath = `${userId || 'anonymous'}/${Date.now()}-${safeName}`
    const { data, error } = await supabaseAdmin.storage.from('audio-files').createSignedUploadUrl(filePath)

    if (error || !data) {
      console.error('[audio] 生成签名URL失败:', error?.message)
      return res.status(500).json({ error: '生成上传URL失败', message: error?.message })
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/audio-files/${filePath}`
    return res.status(200).json({
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl,
      name: fileName
    })
  } catch (e) {
    console.error('[audio] 异常:', e)
    return res.status(500).json({ error: '服务器错误', message: e.message })
  }
}

async function handleChat(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { dataset_id, query, history } = getBody(req)
  if (!dataset_id || !query) {
    return res.status(400).json({ error: '缺少必要参数: dataset_id, query' })
  }

  try {
    const result = await retrieve({ dataset_id, query, history })
    return res.status(200).json(result)
  } catch (error) {
    console.error('ChatBot proxy error:', error)
    return res.status(500).json({ error: '服务器错误', message: error.message })
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const segments = getSegments(req)
  const type = segments[0]

  if (!type) {
    return res.status(404).json({ error: 'API route not found' })
  }

  const route = type.toLowerCase()

  if (route === 'auth') {
    const action = segments[1]
    switch (action) {
      case 'login':
        return handleLogin(req, res)
      case 'register':
        return handleRegister(req, res)
      case 'logout':
        return handleLogout(req, res)
      case 'verify':
        return handleVerify(req, res)
      case 'change-password':
        return handleChangePassword(req, res)
      default:
        return res.status(404).json({ error: 'Unknown auth route' })
    }
  }

  if (route === 'notes') {
    return handleNotes(req, res)
  }

  if (route === 'comments') {
    return handleComments(req, res)
  }

  if (route === 'user-progress') {
    return handleUserProgress(req, res)
  }

  if (route === 'audio') {
    return handleAudio(req, res)
  }

  if (route === 'chat') {
    return handleChat(req, res)
  }

  return res.status(404).json({ error: 'API route not found' })
}
