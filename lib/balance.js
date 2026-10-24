/**
 * Balance reading, threshold classification, and model-facing text.
 *
 * The Host account service is queried through the optional `deepseekAccount`
 * capability. Auto-injection uses a short cache so a multi-step turn does not
 * hammer the Platform; the `check_balance` tool always forces a live read.
 */

import { CNY_PER_UNIT, CURRENCIES, roundThreshold, toCny } from './config.js'

const CACHE_TTL_MS = 10_000
const KNOWN = new Set(CURRENCIES)

function clientMetadata() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'zh-CN'
  return {
    version: process.env.DSH_VERSION || '0.2.1',
    locale,
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  }
}

function abortError(signal) {
  return signal?.reason instanceof Error ? signal.reason : new Error('balance read aborted')
}

function withAbort(promise, signal) {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(abortError(signal))
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(signal))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      error => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function numericBalance(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function walletMap(entries) {
  const result = new Map()
  if (!Array.isArray(entries)) return result
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const currency = typeof entry.currency === 'string' ? entry.currency.toUpperCase() : ''
    const amount = numericBalance(entry.balance)
    if (currency === '' || amount === undefined) continue
    result.set(currency, (result.get(currency) ?? 0) + amount)
  }
  return result
}

function emptyView(status, reason, fetchedAt = Date.now()) {
  return {
    status,
    level: 'unknown',
    reason: reason ?? null,
    wallets: [],
    total: null,
    primaryCurrency: null,
    fetchedAt,
  }
}

function levelOf(total, currency, config) {
  const low = config.thresholds.low[currency]
  const critical = config.thresholds.critical[currency]
  if (critical > 0 && total <= critical) return 'critical'
  if (low > 0 && total <= low) return 'low'
  return 'ok'
}

function buildReadyView(value, config, fetchedAt) {
  const normal = walletMap(value.value)
  const bonus = walletMap(value.bonusWallets)
  const currencies = [...new Set([...normal.keys(), ...bonus.keys()])]
    .sort((left, right) => {
      const leftIndex = CURRENCIES.indexOf(left)
      const rightIndex = CURRENCIES.indexOf(right)
      return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
    })

  const wallets = currencies.map(currency => {
    const recharge = normal.get(currency) ?? 0
    const bonusAmount = bonus.get(currency) ?? 0
    return {
      currency,
      recharge: roundThreshold(recharge),
      bonus: roundThreshold(bonusAmount),
      total: roundThreshold(recharge + bonusAmount),
    }
  })

  let primaryCurrency = 'CNY'
  let primaryCnyTotal = -1
  for (const wallet of wallets) {
    if (!KNOWN.has(wallet.currency)) continue
    const cny = toCny(wallet.total, wallet.currency)
    if (cny > primaryCnyTotal) {
      primaryCnyTotal = cny
      primaryCurrency = wallet.currency
    }
  }
  if (primaryCnyTotal < 0) primaryCnyTotal = 0

  let totalPrimary = 0
  for (const wallet of wallets) {
    if (!KNOWN.has(wallet.currency)) continue
    totalPrimary += toCny(wallet.total, wallet.currency) / CNY_PER_UNIT[primaryCurrency]
  }
  totalPrimary = roundThreshold(totalPrimary)

  return {
    status: 'ready',
    level: levelOf(totalPrimary, primaryCurrency, config),
    reason: null,
    wallets,
    total: { currency: primaryCurrency, amount: totalPrimary },
    primaryCurrency,
    thresholds: {
      low: config.thresholds.low[primaryCurrency],
      critical: config.thresholds.critical[primaryCurrency],
    },
    fetchedAt,
  }
}

/** Format an amount consistently in model-facing text. */
export function formatAmount(amount) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    useGrouping: true,
  }).format(amount)
}

function statusLabel(level) {
  if (level === 'low') return '较低（省电模式）'
  if (level === 'critical') return '严重不足（紧急停机）'
  if (level === 'ok') return '充足'
  return '未知'
}

/** Compact threshold summary for model context. */
export function thresholdText(config, currency) {
  const low = config.thresholds.low
  const critical = config.thresholds.critical
  const lowText = `${low.CNY} CNY / ${low.USD} USD / ${low.EUR} EUR`
  const criticalText = `${critical.CNY} CNY / ${critical.USD} USD / ${critical.EUR} EUR`
  const active = currency && config.thresholds.low[currency] !== undefined
    ? `\n本币种判定：低于 ${low[currency]} ${currency} 进入省电模式；低于 ${critical[currency]} ${currency} 视为严重不足。`
    : ''
  return `阈值：较低 ${lowText}；严重不足 ${criticalText}。${active}`
}

/** Text injected as a durable per-step balance snapshot. */
export function renderSnapshot(view, config) {
  const lines = ['【AI查余额 · 自动余额快照】']
  if (view.status === 'ready') {
    lines.push(`状态：${statusLabel(view.level)}`)
    lines.push(`主币种：${view.total.currency}；可用合计：${view.total.currency} ${formatAmount(view.total.amount)}`)
    if (view.wallets.length === 0) {
      lines.push('钱包：无可用钱包。')
    } else {
      lines.push('钱包：')
      for (const wallet of view.wallets) {
        lines.push(`- ${wallet.currency}：充值 ${formatAmount(wallet.recharge)}；赠送 ${formatAmount(wallet.bonus)}；合计 ${formatAmount(wallet.total)}`)
      }
    }
    lines.push(thresholdText(config, view.total.currency))
    if (view.level === 'low') {
      lines.push('当前余额较低：按系统提示立即进入省电模式，压缩输出并减少非必要工具调用。')
    } else if (view.level === 'critical') {
      lines.push('当前余额严重不足：按系统提示先详细写入 GOAL.md，再只回复一句充值提示并立即停止本轮发言。')
    }
  } else {
    lines.push(`状态：无法读取余额（${view.status === 'unavailable' ? '未登录或不可用' : '查询失败'}）`)
    if (view.reason) lines.push(`原因：${view.reason}`)
    lines.push('不要臆测余额。需要确认时调用 check_balance 工具；余额未知不影响正常推进任务。')
  }
  lines.push(`采样时间：${new Date(view.fetchedAt).toISOString()}`)
  return lines.join('\n')
}

/** Text shown in the check_balance tool card. */
export function renderToolResult(view, config) {
  const lines = ['AI查余额：查询结果']
  if (view.status === 'ready') {
    lines.push(`状态：${statusLabel(view.level)}`)
    lines.push(`主币种：${view.total.currency}`)
    lines.push(`可用合计：${view.total.currency} ${formatAmount(view.total.amount)}`)
    if (view.wallets.length > 0) {
      lines.push('钱包明细：')
      for (const wallet of view.wallets) {
        lines.push(`- ${wallet.currency}：充值 ${formatAmount(wallet.recharge)}；赠送 ${formatAmount(wallet.bonus)}；合计 ${formatAmount(wallet.total)}`)
      }
    } else {
      lines.push('钱包明细：无可用钱包')
    }
    lines.push(thresholdText(config, view.total.currency))
    if (view.level === 'critical') {
      lines.push('提醒：余额已严重不足，按余额策略保存任务状态并停机。')
    } else if (view.level === 'low') {
      lines.push('提醒：余额较低，请进入省电模式。')
    }
  } else {
    lines.push(`状态：无法读取（${view.reason ?? '未知原因'}）`)
    lines.push('可能原因：未登录 DeepSeek 账号、登录已失效，或当前配置仅使用 API Key。请在「设置 → 账户」中确认登录状态。')
  }
  lines.push(`采样时间：${new Date(view.fetchedAt).toISOString()}`)
  return lines.join('\n')
}

/**
 * Create the Host balance reader.
 * @param ctx - plugin context.
 * @param getConfig - reads the current normalized plugin settings.
 */
export function createBalanceReader(ctx, getConfig) {
  let cache
  let inflight

  async function perform() {
    const fetchedAt = Date.now()
    const account = ctx.get('deepseekAccount')
    if (!account || typeof account.getBalance !== 'function') {
      return emptyView('unavailable', '当前运行环境没有 DeepSeek 账号服务', fetchedAt)
    }

    let value
    try {
      value = await account.getBalance(clientMetadata())
    } catch (error) {
      return emptyView('error', error instanceof Error ? error.message : String(error), fetchedAt)
    }

    if (value === null) {
      return emptyView('unavailable', '未登录 DeepSeek 账号，或登录已失效', fetchedAt)
    }
    if (value?.status === 'failed') {
      return emptyView('error', '平台余额接口返回失败', fetchedAt)
    }
    if (value?.status !== 'ready' || !Array.isArray(value.value)) {
      return emptyView('error', '平台余额响应格式无法识别', fetchedAt)
    }

    try {
      return buildReadyView(value, getConfig(), fetchedAt)
    } catch (error) {
      return emptyView('error', error instanceof Error ? error.message : String(error), fetchedAt)
    }
  }

  function cacheFresh() {
    return cache !== undefined && Date.now() - cache.at < CACHE_TTL_MS
  }

  return {
    async read(options = {}) {
      const { force = false, signal } = options
      if (!force && cacheFresh()) return cache.view
      if (inflight === undefined) {
        const pending = perform()
        inflight = pending
        pending.then(
          view => {
            cache = { at: Date.now(), view }
          },
          () => {},
        ).finally(() => {
          if (inflight === pending) inflight = undefined
        })
      }
      return await withAbort(inflight, signal)
    },
    clearCache() {
      cache = undefined
    },
  }
}
