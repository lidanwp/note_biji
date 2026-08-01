// 录音文件上传：前端把文件直接 POST 到本接口
// 后端用 service_role 直接上传到 Storage，完全绕过 RLS（无需 INSERT 策略）
// 注意：Vercel Hobby 请求体限制 4.5MB，前端已做大小检查
import { createClient } from '@supabase/supabase-js'

// 关闭默认 body parser，手动读取 raw body（支持 multipart 或 raw binary）
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: '后端未配置 SUPABASE_SERVICE_ROLE_KEY' })
    }

    const contentType = req.headers['content-type'] || ''

    // ---- 读取原始请求体 ----
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const rawBody = Buffer.concat(chunks)

    let fileBuffer
    let fileName
    let fileContentType
    let userId

    if (contentType.startsWith('multipart/form-data')) {
      // ---- multipart：解析 boundary 分离字段与文件 ----
      const boundaryMatch = contentType.match(/boundary=(.+)$/i)
      if (!boundaryMatch) {
        return res.status(400).json({ error: '无效的 multipart 请求' })
      }
      const boundary = boundaryMatch[1].trim()
      const parts = parseMultipart(rawBody, boundary)

      const filePart = parts.find(p => p.filename)
      if (!filePart) {
        return res.status(400).json({ error: '未找到文件' })
      }
      fileBuffer = filePart.data
      fileName = filePart.filename
      fileContentType = filePart.contentType || 'audio/mpeg'

      const userIdPart = parts.find(p => p.name === 'userId')
      userId = userIdPart ? userIdPart.data.toString('utf8') : null
    } else {
      // ---- raw binary：整个 body 是文件，元数据从 header 取 ----
      fileBuffer = rawBody
      fileName = req.headers['x-file-name'] || `audio-${Date.now()}.mp3`
      fileContentType = contentType || 'audio/mpeg'
      userId = req.headers['x-user-id'] || null
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: '文件内容为空' })
    }

    // ---- 文件名安全化 ----
    const safeName = String(fileName).replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
    const path = `${userId || 'anonymous'}/${Date.now()}-${safeName}`

    // ---- 用 service_role 直接上传（绕过 RLS）----
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { error } = await supabaseAdmin.storage
      .from('audio-files')
      .upload(path, fileBuffer, {
        contentType: fileContentType,
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('[upload-audio] 上传失败:', error.message)
      return res.status(500).json({ error: '上传失败', message: error.message })
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/audio-files/${path}`

    return res.status(200).json({
      name: fileName,
      url: publicUrl,
      path: path
    })
  } catch (e) {
    console.error('[upload-audio] 异常:', e)
    return res.status(500).json({ error: '服务器错误', message: e.message })
  }
}

// ---- 简易 multipart 解析器 ----
function parseMultipart(buffer, boundary) {
  const parts = []
  const boundaryBuf = Buffer.from('--' + boundary)
  let start = buffer.indexOf(boundaryBuf)

  while (start !== -1) {
    const nextStart = buffer.indexOf(boundaryBuf, start + boundaryBuf.length)
    if (nextStart === -1) break

    const partBuf = buffer.slice(start + boundaryBuf.length + 2, nextStart - 2) // -2 去掉 \r\n
    if (partBuf.length === 0) { start = nextStart; continue }

    // 分离 header 和 body
    const headerEnd = partBuf.indexOf('\r\n\r\n')
    if (headerEnd === -1) { start = nextStart; continue }

    const headerStr = partBuf.slice(0, headerEnd).toString('utf8')
    const data = partBuf.slice(headerEnd + 4)

    // 解析 Content-Disposition
    const nameMatch = headerStr.match(/name="([^"]+)"/)
    const filenameMatch = headerStr.match(/filename="([^"]*)"/)
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i)

    parts.push({
      name: nameMatch ? nameMatch[1] : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      contentType: ctMatch ? ctMatch[1].trim() : null,
      data: data
    })

    start = nextStart
  }
  return parts
}
