// ============================================================================
// llmClient.js — 百度千帆（DeepSeek-V3.1）极简封装
// ----------------------------------------------------------------------------
// 职责：封装 OpenAI 兼容的 /chat/completions 调用，统一 AbortController 超时
// 被调用方：api/_lib/roundtableHandler.js（圆桌讨论，经 api/chat.js 分流）
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
 * @returns {Promise<string>} - 纯文本回复
 */
export async function callLLM({ messages, temperature = 0.85, maxTokens = 1500, timeout = 15000, model = DEFAULT_MODEL }) {
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
        max_tokens: maxTokens
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
