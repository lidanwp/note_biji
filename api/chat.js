// ============================================================================
// api/chat.js — 薄代理层
// 只负责：HTTP 方法校验、CORS、参数校验、调用检索服务、返回结果。
// 所有检索核心逻辑（阶段感知/权重排序/章节定向/图谱推理/分层输出）
// 已抽离到 ./_lib/retrievalService.js
// ============================================================================
import { retrieve } from './_lib/retrievalService.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { dataset_id, query, history } = req.body || {}

    if (!dataset_id || !query) {
      return res.status(400).json({ error: '缺少必要参数: dataset_id, query' })
    }

    const result = await retrieve({ dataset_id, query, history })

    return res.status(200).json(result)
  } catch (error) {
    console.error('ChatBot proxy error:', error)
    return res.status(500).json({ error: '服务器错误', message: error.message })
  }
}
