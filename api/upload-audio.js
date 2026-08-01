// 录音文件上传：后端用 service_role 生成签名上传 URL，前端直传到 Supabase Storage
// 方案2：前端直传Storage（绕过Vercel 4.5MB限制），RLS INSERT策略允许上传
// 前端流程：1) 调本接口拿签名URL  2) 用原生fetch PUT直传到Storage（不带Authorization）
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { userId, fileName, contentType } = req.body || {}
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

    // 文件名安全化：保留中文/字母/数字/点/横杠，其余替换为下划线
    const safeName = String(fileName).replace(/[^\w\u4e00-\u9fa5.-]/g, '_')
    const path = `${userId || 'anonymous'}/${Date.now()}-${safeName}`

    // 生成签名上传 URL（service_role 授权）
    const { data, error } = await supabaseAdmin.storage
      .from('audio-files')
      .createSignedUploadUrl(path)

    if (error || !data) {
      console.error('[upload-audio] 生成签名URL失败:', error?.message)
      return res.status(500).json({ error: '生成上传URL失败', message: error?.message })
    }

    // 公开访问 URL（桶为 public，访客可直接播放，不经过 RLS）
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/audio-files/${path}`

    return res.status(200).json({
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl,
      name: fileName
    })
  } catch (e) {
    console.error('[upload-audio] 异常:', e)
    return res.status(500).json({ error: '服务器错误', message: e.message })
  }
}
