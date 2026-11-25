import { requireAuth } from './_lib/auth.js'

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const supabaseUrl = process.env.SUPABASE_URL
  // 数据库已开启 RLS 且不给 anon 任何策略（见 scripts/007_lock_down_rls.sql），
  // 服务端是唯一的数据库客户端，因此 /rest/v1 一律用 service_role key（绕过 RLS）
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 环境变量未配置（需要 SUPABASE_SERVICE_ROLE_KEY）' })
  }

  if (req.method === 'GET') {
    // ── 保活探针（?mode=ping）─────────────────────────────────────────
    // 纯运维用途：只做主键一列一行的最轻读取，用来确认 Supabase 活着。
    // 之所以挂在 notes 上而不是单独开 /api/health：Vercel Hobby 计划限制
    // 每个部署最多 12 个 Serverless Functions，本项目原本就正好 12 个，
    // 新增函数会让整个部署直接失败（exceeded_serverless_functions_per_deployment）。
    // 不返回任何业务数据，也不能替代正常列表请求。
    if (req.query?.mode === 'ping') {
      const startedAt = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      // 覆盖 vercel.json 里给 /api/notes 配的 30s CDN 缓存，确保每次真打到库
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/notes?select=id&limit=1`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json'
          },
          signal: controller.signal
        })
        if (!resp.ok) {
          return res.status(502).json({
            ok: false,
            supabase: 'error',
            status: resp.status,
            ms: Date.now() - startedAt
          })
        }
        return res.status(200).json({
          ok: true,
          service: 'note_biji',
          supabase: 'awake',
          ms: Date.now() - startedAt,
          time: new Date().toISOString()
        })
      } catch (e) {
        const isTimeout = e?.name === 'AbortError'
        return res.status(502).json({
          ok: false,
          supabase: isTimeout ? 'timeout' : 'unreachable',
          error: String(e?.message || e),
          ms: Date.now() - startedAt
        })
      } finally {
        clearTimeout(timer)
      }
    }

    // 轻量列表：裁剪 content 到前 200 字符做预览，不传 case_study/attachments 等大字段
    const isListMode = req.query?.mode === 'list'

    try {
      // 列表模式仍然查询完整 content 和 case_study（用于字数统计），但只返回截断版本
      const select = isListMode
        ? 'id,title,category,date,view_count,useful_count,tags,created_at,user_id,key_points,scenario,content,case_study,exam_score,phase,related_notes'
        : 'id,title,category,date,view_count,useful_count,tags,created_at,user_id,key_points,scenario,content,case_study,attachments,exam_mapping,comparison_table,memory_aids,exam_score,phase,related_notes'

      const response = await fetch(`${supabaseUrl}/rest/v1/notes?select=${encodeURIComponent(select)}&order=date.desc`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Supabase 请求失败: ${response.status}`)
      }

      const data = await response.json()

      // 计算纯文本字数的辅助函数：去除 HTML 标签和 markdown 符号
      const countTextLength = (note) => {
        const parts = [
          note.title || '',
          note.content || '',
          note.case_study || '',
          note.scenario || '',
          Array.isArray(note.key_points) ? note.key_points.join(' ') : '',
          Array.isArray(note.memory_aids) ? note.memory_aids.join(' ') : ''
        ]
        const combined = parts.map(p =>
          String(p || '').replace(/<[^>]*>/g, '').replace(/[#*`>\-\[\]()]/g, '')
        ).join(' ')
        return combined.replace(/\s+/g, ' ').trim().length
      }

      // 列表模式：计算完整字数 + 裁剪 content + 标记 _hasFullContent
      // 非列表模式：返回完整数据
      const processed = isListMode ? data.map(n => {
        const originalContent = n.content || ''
        const wasTruncated = originalContent.length > 200
        return {
          ...n,
          content: wasTruncated ? originalContent.slice(0, 200) : originalContent,
          case_study: undefined,           // 不传 case_study 大字段到前端
          _textLength: countTextLength(n), // 基于完整数据计算的字数
          _hasFullContent: !wasTruncated   // 内容未截断则无需再请求
        }
      }) : data.map(n => ({
        ...n,
        _textLength: countTextLength(n),
        _hasFullContent: true
      }))

      // 缓存 30 秒（Serverless 冷启动 + Supabase 响应时间远大于此，客户端可复用）
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=600')
      return res.status(200).json(processed)
    } catch (error) {
      console.error('notes GET error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'POST') {
    try {
      const body = getBody(req)
      const notesArray = Array.isArray(body) ? body : [body]
      let allData = []

      for (const note of notesArray) {
        const isPartialUpdate =
          (note.viewCount !== undefined || note.usefulCount !== undefined || note.examScore !== undefined) &&
          note.title === undefined && note.content === undefined

        if (isPartialUpdate) {
          // examScore（全局掌握度）属管理数据，必须管理员；viewCount/usefulCount 允许匿名，但走服务端自增
          if (note.examScore !== undefined) {
            const auth = await requireAuth(req)
            if (auth.error) {
              return res.status(auth.status).json({ error: auth.error })
            }
            if (auth.user.role !== 'admin') {
              return res.status(403).json({ error: '无权限，仅管理员可修改掌握度' })
            }
          }

          const patchData = {}
          // 忽略客户端传值：先读当前值再 +1，防止匿名把计数改成任意值
          if (note.viewCount !== undefined || note.usefulCount !== undefined) {
            const fields = ['id']
            if (note.viewCount !== undefined) fields.push('view_count')
            if (note.usefulCount !== undefined) fields.push('useful_count')
            const curRes = await fetch(`${supabaseUrl}/rest/v1/notes?id=eq.${note.id}&select=${fields.join(',')}`, {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`
              }
            })
            if (!curRes.ok) {
              throw new Error(`读取笔记 ${note.id} 计数失败: ${curRes.status}`)
            }
            const rows = await curRes.json()
            if (!rows.length) {
              throw new Error(`笔记 ${note.id} 不存在`)
            }
            if (note.viewCount !== undefined) patchData.view_count = (rows[0].view_count || 0) + 1
            if (note.usefulCount !== undefined) patchData.useful_count = (rows[0].useful_count || 0) + 1
          }
          if (note.examScore !== undefined) patchData.exam_score = note.examScore

          const response = await fetch(`${supabaseUrl}/rest/v1/notes?id=eq.${note.id}&select=*`, {
            method: 'PATCH',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation'
            },
            body: JSON.stringify(patchData)
          })

          if (!response.ok) {
            throw new Error(`更新笔记 ${note.id} 失败: ${response.status}`)
          }

          allData = allData.concat(await response.json())
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
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation,resolution=merge-duplicates'
          },
          body: JSON.stringify(noteData)
        })

        if (!response.ok) {
          throw new Error(`保存笔记 ${note.id} 失败: ${response.status}`)
        }

        allData = allData.concat(await response.json())
      }

      return res.status(200).json(allData)
    } catch (error) {
      console.error('notes POST error:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(405).json({ error: '方法不允许' })
}
