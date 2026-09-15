// ============================================================================
// ttsHandler.js — 圆桌角色发言的语音合成（TTS）
// ----------------------------------------------------------------------------
// 注意：本文件位于 api/_lib/，不算 Vercel Serverless Function
// 由 api/chat.js 通过 body.mode === 'tts' 分流调用
//
// 调用约定：前端 POST /api/chat { mode:'tts', text, role }
// 响应体：成功 -> mp3 二进制（Content-Type: audio/mp3）
//         失败 -> { error }（JSON，HTTP 500）
//
// 无状态：不持久化音频，前端拿到 blob 后自行 createObjectURL 播放
// ============================================================================

import { callTTS } from './llmClient.js'

// 文本长度上限：正常发言 80-150 字，这里给 300 字做防御性截断
// （百度短文本在线合成对单次请求文本长度有限制，超长会直接报错）
const MAX_TTS_TEXT_LENGTH = 300

// TTS 超时独立设置，不复用 LLM 的 8 秒默认值：长文本合成 + 网络往返可能不够
const TTS_TIMEOUT = 15000

/**
 * 语音合成 handler
 * @param {Object} req - Vercel 请求对象
 * @param {Object} res - Vercel 响应对象
 * @param {Object} body - 已由 chat.js 解析好的请求体 { mode, text, role }
 */
export async function handleTTS(req, res, body) {
  const { text, role } = body

  if (!text || typeof text !== 'string' || !role) {
    return res.status(400).json({ error: '缺少 text 或 role' })
  }

  // 超长截断：正常发言不会触发，仅作防御，避免把超长文本直接打到上游
  const safeText = text.length > MAX_TTS_TEXT_LENGTH
    ? text.slice(0, MAX_TTS_TEXT_LENGTH)
    : text

  try {
    const audioBuffer = await callTTS({ text: safeText, role, timeout: TTS_TIMEOUT })

    res.setHeader('Content-Type', 'audio/mp3')
    // 同一条消息重复播放没必要走缓存：音频体积小且是一次性消费，缓存反而占浏览器内存
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(Buffer.from(audioBuffer))
  } catch (e) {
    console.error('[tts] 语音合成失败:', e.message)
    return res.status(500).json({ error: e.message || '语音合成失败' })
  }
}
