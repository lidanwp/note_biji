#!/usr/bin/env node
/**
 * keep-alive.mjs —— 定期访问站点，防止 Supabase 免费项目因 7 天无请求被暂停
 *
 * 用法：
 *   node scripts/keep-alive.mjs                      # 打一次，成功 exit 0 / 失败 exit 1
 *   node scripts/keep-alive.mjs --interval=12h       # 常驻，每 12 小时打一次
 *   node scripts/keep-alive.mjs --url=https://xxx/api/health
 *   node scripts/keep-alive.mjs --once               # 显式单次（默认行为）
 *
 * 环境变量：
 *   KEEP_ALIVE_URLS    目标地址，逗号分隔（默认 https://bdxxg.asia/api/health）
 *   KEEP_ALIVE_SECRET  若后端配置了 CRON_SECRET，这里给同样的值（走 Bearer）
 *   KEEP_ALIVE_TIMEOUT 单次请求超时毫秒，默认 15000
 *
 * 退出码：0 = 全部成功，1 = 至少一个失败（常驻模式除外，常驻模式永不退出）
 */

const DEFAULT_URL = 'https://bdxxg.asia/api/health'
const DEFAULT_TIMEOUT = 15000

// ---- 参数解析 ----
const args = process.argv.slice(2)
const getArg = (name) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (!hit) return undefined
  if (hit.includes('=')) return hit.split('=').slice(1).join('=')
  return true
}

/** 把 "12h" / "30m" / "90s" / "45" 解析成毫秒 */
function parseDuration(input) {
  if (input === undefined || input === true) return null
  const m = String(input).trim().match(/^(\d+(?:\.\d+)?)\s*([smhd]?)$/i)
  if (!m) return null
  const n = Number(m[1])
  const unit = (m[2] || 'm').toLowerCase()
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]
  return Math.round(n * factor)
}

const urls = String(getArg('url') || process.env.KEEP_ALIVE_URLS || DEFAULT_URL)
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean)

const secret = process.env.KEEP_ALIVE_SECRET || ''
const timeoutArg = getArg('timeout')
const timeout =
  (typeof timeoutArg === 'string' ? Number(timeoutArg) : 0) ||
  Number(process.env.KEEP_ALIVE_TIMEOUT) ||
  DEFAULT_TIMEOUT
const intervalMs = parseDuration(getArg('interval'))
const forever = Boolean(intervalMs)

const stamp = () => new Date().toLocaleString('zh-CN', { hour12: false })

/** 打一个 URL，返回是否成功 */
async function ping(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const startedAt = Date.now()

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {})
      },
      signal: controller.signal
    })

    const ms = Date.now() - startedAt
    let body = ''
    try {
      body = await resp.text()
    } catch {
      /* 忽略 */
    }
    const brief = body.replace(/\s+/g, ' ').slice(0, 200)

    if (resp.ok) {
      console.log(`[${stamp()}] OK   ${resp.status} ${ms}ms  ${url}`)
      if (brief) console.log(`         ${brief}`)
      return true
    }
    console.warn(`[${stamp()}] FAIL ${resp.status} ${ms}ms  ${url}`)
    if (brief) console.warn(`         ${brief}`)
    return false
  } catch (e) {
    const ms = Date.now() - startedAt
    const reason = e?.name === 'AbortError' ? `超时 ${timeout}ms` : String(e?.message || e)
    console.error(`[${stamp()}] FAIL ${reason}  ${url}`)
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function runOnce() {
  const results = await Promise.all(urls.map((u) => ping(u)))
  const failed = results.filter((ok) => !ok).length
  console.log(
    `[${stamp()}] 本轮完成：${results.length - failed}/${results.length} 成功` +
      (failed ? `，${failed} 个失败` : '')
  )
  return failed === 0
}

async function main() {
  console.log(`保活目标（${urls.length}）：${urls.join(', ')}`)
  if (!forever) {
    const ok = await runOnce()
    process.exit(ok ? 0 : 1)
  }

  console.log(`常驻模式：每 ${Math.round(intervalMs / 60000)} 分钟执行一次，Ctrl+C 结束`)
  // 立即执行一次，之后按间隔循环
  for (;;) {
    await runOnce()
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

main().catch((e) => {
  console.error('未捕获异常：', e)
  process.exit(1)
})
