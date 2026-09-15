// ============================================================================
// llmClient.js — 百度千帆 LLM + 语音合成 极简封装
// ----------------------------------------------------------------------------
// 职责：1) 封装 OpenAI 兼容的 /chat/completions 调用（callLLM）
//      2) 封装百度短文本在线合成（callTTS）
//      两者共用同一个 QIANFAN_API_KEY，统一 AbortController 超时
// 被调用方：api/_lib/roundtableHandler.js（圆桌讨论）、api/_lib/ttsHandler.js（语音合成），
//         均经 api/chat.js 分流
// 不依赖：retrievalService / PandaWiki（已停用）
//
// 扩展位：如需 fallback 到其他 provider，只需在本文件内加 _tryProviders 数组，
//        callLLM 接口形状保持不变，调用方无需感知。
// ============================================================================

const BASE_URL = 'https://qianfan.baidubce.com/v2'
const DEFAULT_MODEL = 'deepseek-v3.2'

/**
 * 调用 LLM 生成回复
 * @param {Object} opts
 * @param {Array<{role:string, content:string}>} opts.messages - OpenAI 格式消息
 * @param {number} [opts.temperature=0.85] - 温度
 * @param {number} [opts.maxTokens=1500] - 最大生成 token
 * @param {number} [opts.timeout=15000] - 超时毫秒
 * @param {string} [opts.model] - 模型名，默认 deepseek-v3.2
 * @param {boolean} [opts.disableThinking=false] - 是否下发 thinking:{type:'disabled'} 关闭深度思考
 *        （GLM 系列支持；为 true 才拼进请求体，避免给不支持该字段的模型带未知参数）
 * @returns {Promise<string>} - 纯文本回复
 */
export async function callLLM({ messages, temperature = 0.85, maxTokens = 1500, timeout = 15000, model = DEFAULT_MODEL, disableThinking = false }) {
  // trim 防御：用户粘贴 key 时可能带换行/空格
  // 不做格式强校验：千帆 Key 形如 bce-v3/ALTAK-xxx/yyy，含 / 与 -，直接透传
  const apiKey = (process.env.QIANFAN_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('QIANFAN_API_KEY 未配置或为空')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        // 思考模式控制（智谱/千帆 GLM 系列同形）：仅在 disableThinking 为 true 时下发，
        // 其余模型不带该字段，保持请求体与旧版一致
        ...(disableThinking ? { thinking: { type: 'disabled' } } : {})
      }),
      signal: controller.signal
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      // 区分常见状态码，便于前端给出可操作的提示
      const status = res.status
      let msg = `LLM 请求失败 ${status}`
      if (status === 401) msg = '千帆 API Key 无效或已过期（401）'
      else if (status === 403) msg = '千帆 API Key 无权限访问该模型（403）'
      else if (status === 429) msg = '千帆请求频率超限，请稍后重试（429）'
      else if (status >= 500) msg = `千帆服务端错误（${status}）`
      throw new Error(`${msg}: ${errText.slice(0, 200)}`)
    }

    const data = await res.json()
    const message = data?.choices?.[0]?.message
    let content = message?.content

    // 兜底：若 content 为空，部分模型会把内容放在 reasoning_content
    if (!content || !content.trim()) {
      if (message?.reasoning_content) {
        content = message.reasoning_content
      }
    }
    if (!content || !content.trim()) {
      throw new Error('LLM 返回为空')
    }
    return content.trim()
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('LLM 请求超时')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// 语音合成（TTS）— 百度短文本在线合成
// ----------------------------------------------------------------------------
// 鉴权：Authorization: Bearer <QIANFAN_API_KEY> 可直接用于 tsn.baidu.com/text2audio，
//      不需要换取 Access Token（已用 curl 验证：返回 mp3 二进制，Content-Type: audio/mp3）
// 成功 / 失败的唯一判据：响应头的 Content-Type 是否以 audio/ 开头
//      （失败时百度返回 application/json，正文里带 err_no / err_msg）
// ============================================================================

const TTS_URL = 'https://tsn.baidu.com/text2audio'

// 角色音色映射：每个角色一个音色，让四个角色的语音可区分
// per = 音色 ID，spd = 语速 0-15，pit = 音调 0-15，vol 统一 5，aue=3 表示 mp3
export const TTS_VOICES = {
  advocate:   { per: 4132, spd: 7, pit: 3 }, // 度嫣然 - 活泼男声
  critic:     { per: 4139, spd: 7, pit: 3 }, // 度怀安 - 磁性男声
  researcher: { per: 4115, spd: 6, pit: 4 }, // 度沁遥 - 知性男声
  moderator:  { per: 4197, spd: 5, pit: 4 }  // 度博文 - 专业男主播
}

// 未知角色回落到主持人音色，保证任何一条发言都有声音
const TTS_DEFAULT_VOICE = TTS_VOICES.moderator

/**
 * 调用百度短文本在线合成接口
 * @param {Object} opts
 * @param {string} opts.text - 待合成文本
 * @param {string} [opts.role] - 角色 id，决定音色（见 TTS_VOICES）
 * @param {number} [opts.timeout=15000] - 超时毫秒（TTS 独立设置，不复用 LLM 的默认值）
 * @returns {Promise<ArrayBuffer>} - mp3 音频数据
 */
export async function callTTS({ text, role, timeout = 15000 }) {
  // 与 callLLM 同一套 Key 读取方式，trim 防御用户粘贴时带入的换行/空格
  const apiKey = (process.env.QIANFAN_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('QIANFAN_API_KEY 未配置或为空')
  }

  const voice = TTS_VOICES[role] || TTS_DEFAULT_VOICE

  // 用 URLSearchParams 拼接 body：文本含标点/引号时自动做 x-www-form-urlencoded 编码，
  // 手写字符串拼接容易漏编码
  const form = new URLSearchParams({
    tex: text,
    cuid: 'roundtable',
    ctp: '1',
    lan: 'zh',
    spd: String(voice.spd),
    pit: String(voice.pit),
    vol: '5',
    per: String(voice.per),
    aue: '3' // 3 = mp3
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString(),
      signal: controller.signal
    })

    const contentType = res.headers.get('content-type') || ''

    // 成功判据只看 Content-Type：audio/* 才是音频，否则一律视为失败（JSON 错误体）
    if (!contentType.startsWith('audio/')) {
      const errText = await res.text().catch(() => '')
      let errNo = null
      let errMsg = ''
      try {
        const errJson = JSON.parse(errText)
        errNo = errJson.err_no ?? null
        errMsg = errJson.err_msg ?? ''
      } catch {
        // 非 JSON 时走下面的 errText 兜底，把原文截断带上，便于排查
      }
      const detail = errMsg || errText.slice(0, 200) || `HTTP ${res.status}`
      throw new Error(`TTS 合成失败${errNo !== null ? `（err_no=${errNo}）` : ''}: ${detail}`)
    }

    return await res.arrayBuffer()
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('TTS 请求超时')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}
