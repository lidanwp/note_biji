import { createClient } from '@supabase/supabase-js'

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

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
