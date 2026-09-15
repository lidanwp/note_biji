import { retrieve } from './_lib/retrievalService.js'
import { handleRoundtable } from './_lib/roundtableHandler.js'
import { handleTTS } from './_lib/ttsHandler.js'

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

  const body = getBody(req)

  // 圆桌讨论分流：通过 mode 字段路由到圆桌 handler
  if (body.mode === 'roundtable') {
    return handleRoundtable(req, res, body)
  }

  // 语音合成分流：圆桌角色发言的 TTS 播放（返回 mp3 二进制，不走 JSON）
  if (body.mode === 'tts') {
    return handleTTS(req, res, body)
  }

  const { dataset_id, query, history } = body
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
