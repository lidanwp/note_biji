// 录音文件删除：后端用 service_role 删除 Storage 文件
// 前端只传 path（字符串，无大小问题），后端执行删除
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
    const { path } = req.body || {}
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

    const { error } = await supabaseAdmin.storage
      .from('audio-files')
      .remove([path])

    if (error) {
      console.error('[delete-audio] 删除失败:', error.message)
      return res.status(500).json({ error: '删除失败', message: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('[delete-audio] 异常:', e)
    return res.status(500).json({ error: '服务器错误', message: e.message })
  }
}
