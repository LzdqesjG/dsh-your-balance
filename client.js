/**
 * AI查余额 (dsh-your-balance) — browser half.
 *
 * One Settings section: live balance overview, auto-injection switch, low and
 * critical threshold editors with optional FX-linked conversion, and the
 * model-facing policy summary. Data is exchanged over the plugin's own
 * same-origin routes; no Harness Client package is imported.
 */

window.__ModuleLoader__.load({
  id: 'dsh-your-balance',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useState } = React

    const NS = 'your-balance'
    const CURRENCIES = ['CNY', 'USD', 'EUR']
    const FALLBACK_RATES = { CNY: 1, USD: 7.2, EUR: 8.4 }
    const STATE_ROUTE = '/api/your-balance/state'
    const CONFIG_ROUTE = '/api/your-balance/config'
    const MUTATION_HEADER = 'x-dsh-your-balance'

    const DICT_ZH = {
      nav: 'AI查余额',
      title: 'AI查余额',
      eyebrow: 'AI BALANCE',
      subtitle: '自动读取 DeepSeek 账号余额，把余额快照和省电策略带入每一轮对话。',
      'balance.section': '当前余额',
      refresh: '刷新余额',
      refreshing: '刷新中…',
      loading: '正在读取余额…',
      'lastUpdated': '更新于 {time}',
      never: '尚未读取',
      wallets: '钱包明细',
      recharge: '充值',
      bonus: '赠送',
      noWallets: '账户暂无可用钱包',
      'status.loading': '读取中',
      'status.ok': '充足',
      'status.low': '较低 · 省电模式',
      'status.critical': '严重不足 · 紧急停机',
      'status.unavailable': '无法读取',
      'status.error': '查询失败',
      'status.unknown': '未知',
      'banner.low': '余额较低：AI 已进入省电模式，后续回答会更精简。',
      'banner.critical': '余额严重不足：AI 会先保存 GOAL.md，再简短提示充值并停止本轮对话。',
      'notLoggedIn': '未登录 DeepSeek 账号，或当前使用 API Key 模式，无法读取平台余额。',
      readFailed: '余额读取失败',
      signInHint: '可在「设置 → 账户」登录 DeepSeek 账号后重试。',
      retry: '重试',
      'settings.title': '注入与阈值',
      'settings.hint': '余额快照在用户发言后和每个工具返回后的模型步骤注入。',
      autoInject: '自动注入余额',
      autoInjectHint: '开启后，每个模型步骤都会收到当前余额、状态和阈值。',
      autoConvert: '汇率联动换算',
      autoConvertHint: '开启后，修改任一币种阈值会按参考汇率自动换算另外两种。',
      thresholds: '余额阈值',
      thresholdsHint: '按主币种判断。余额等于或低于阈值时触发对应策略。',
      low: '较低余额',
      lowDesc: '低于该值：进入省电模式，减少输出 token。',
      critical: '严重不足',
      criticalDesc: '低于该值：保存详细 GOAL.md，提示充值并原地停机。',
      rates: '内置参考汇率：1 USD = {usd} CNY · 1 EUR = {eur} CNY',
      'currency.CNY': '人民币',
      'currency.USD': '美元',
      'currency.EUR': '欧元',
      'policy.title': '注入的提示词',
      'policy.hint': '自动注入开启时，以下策略会进入系统提示词。',
      'policy.low': '较低：压缩输出、减少非必要工具调用，优先用最少步骤完成任务。',
      'policy.critical': '严重不足：先写详细的 GOAL.md，再只回复一句充值提示并立即停止。',
      'policy.unknown': '无法读取：不臆测余额，必要时调用 check_balance 重试。',
      goalHint: 'GOAL.md 写入会话工作区根目录，内容包含目标、进度、关键文件、命令结果和恢复步骤。',
      save: '保存配置',
      saving: '保存中…',
      saved: '配置已保存',
      unsaved: '有未保存的修改',
      'error.invalidNumber': '请输入有效的非负数字',
      'error.negativeThreshold': '阈值不能为负数',
      'error.thresholdTooLarge': '阈值过大',
      'error.thresholdOrder': '每个币种的较低余额阈值必须大于严重不足阈值',
      'error.invalidConfig': '配置格式不正确',
      'error.bodyTooLarge': '提交的数据过大',
      'error.forbidden': '当前页面没有权限修改配置',
      'error.readFailed': '读取余额失败',
      'error.saveFailed': '保存配置失败',
    }

    const DICT_EN = {
      nav: 'AI Balance',
      title: 'AI Balance',
      eyebrow: 'AI BALANCE',
      subtitle: 'Read your DeepSeek wallet balance and carry a balance snapshot with power-saving policy into every turn.',
      'balance.section': 'Current balance',
      refresh: 'Refresh balance',
      refreshing: 'Refreshing…',
      loading: 'Reading balance…',
      'lastUpdated': 'Updated {time}',
      never: 'Not read yet',
      wallets: 'Wallets',
      recharge: 'Recharge',
      bonus: 'Bonus',
      noWallets: 'No available wallet',
      'status.loading': 'Reading',
      'status.ok': 'Healthy',
      'status.low': 'Low · power saver',
      'status.critical': 'Critical · stop',
      'status.unavailable': 'Unavailable',
      'status.error': 'Query failed',
      'status.unknown': 'Unknown',
      'banner.low': 'Low balance: AI is in power-saving mode and will keep answers shorter.',
      'banner.critical': 'Critical balance: AI will save GOAL.md, ask for a top-up briefly, then stop this turn.',
      'notLoggedIn': 'Not signed in to a DeepSeek account, or this profile uses an API key, so Platform balance is unavailable.',
      readFailed: 'Balance query failed',
      signInHint: 'Sign in under Settings → Account, then retry.',
      retry: 'Retry',
      'settings.title': 'Injection & thresholds',
      'settings.hint': 'A balance snapshot is injected into each model step after user messages and tool results.',
      autoInject: 'Auto-inject balance',
      autoInjectHint: 'When on, every model step receives the current balance, status, and thresholds.',
      autoConvert: 'FX-linked conversion',
      autoConvertHint: 'When on, editing one currency converts the other two at the reference rate.',
      thresholds: 'Balance thresholds',
      thresholdsHint: 'Evaluated in the primary currency. A balance at or below a threshold triggers that policy.',
      low: 'Low balance',
      lowDesc: 'Below this value: enter power-saving mode and reduce output tokens.',
      critical: 'Critical',
      criticalDesc: 'Below this value: write a detailed GOAL.md, ask for a top-up, and stop in place.',
      rates: 'Built-in rates: 1 USD = {usd} CNY · 1 EUR = {eur} CNY',
      'currency.CNY': 'Chinese yuan',
      'currency.USD': 'US dollar',
      'currency.EUR': 'Euro',
      'policy.title': 'Injected prompt',
      'policy.hint': 'These rules enter the system prompt while auto-injection is on.',
      'policy.low': 'Low: shorten output, avoid non-essential tool calls, and finish in the fewest steps.',
      'policy.critical': 'Critical: write a detailed GOAL.md first, then send one short top-up note and stop.',
      'policy.unknown': 'Unavailable: never guess the balance; call check_balance when confirmation matters.',
      goalHint: 'GOAL.md is written to the session workspace root with goals, progress, key files, command results, and resume steps.',
      save: 'Save settings',
      saving: 'Saving…',
      saved: 'Settings saved',
      unsaved: 'Unsaved changes',
      'error.invalidNumber': 'Enter a valid non-negative number',
      'error.negativeThreshold': 'Thresholds cannot be negative',
      'error.thresholdTooLarge': 'Threshold is too large',
      'error.thresholdOrder': 'Each low threshold must be greater than its critical threshold',
      'error.invalidConfig': 'Invalid settings payload',
      'error.bodyTooLarge': 'Submitted payload is too large',
      'error.forbidden': 'This page is not allowed to change settings',
      'error.readFailed': 'Failed to read balance',
      'error.saveFailed': 'Failed to save settings',
    }

    const CSS = `
      .yb-root {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-width: 760px;
        margin: 0 auto;
        padding: 6px 0 36px;
        color: var(--dsw-alias-label-primary);
        font-family: inherit;
        font-size: 14px;
        line-height: 22px;
      }
      .yb-header { padding: 2px 2px 4px; }
      .yb-eyebrow {
        color: var(--dsw-alias-brand-primary);
        font-size: 11px;
        font-weight: 600;
        line-height: 16px;
        letter-spacing: 0.14em;
      }
      .yb-title {
        margin: 5px 0 3px;
        font-size: 24px;
        font-weight: 600;
        line-height: 32px;
      }
      .yb-subtitle {
        margin: 0;
        color: var(--dsw-alias-label-secondary);
        font-size: 13px;
        line-height: 20px;
        max-width: 620px;
      }
      .yb-card {
        box-sizing: border-box;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: var(--dsw-radius-lg, 14px);
        background: var(--dsw-alias-bg-layer-1);
        padding: 18px;
      }
      .yb-card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }
      .yb-card-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 24px;
      }
      .yb-card-desc {
        margin: 4px 0 0;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
      }
      .yb-meta-line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }
      .yb-meta {
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
      }
      .yb-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid transparent;
        border-radius: 999px;
        padding: 2px 9px;
        font-size: 12px;
        font-weight: 500;
        line-height: 18px;
      }
      .yb-badge::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      .yb-badge-ok {
        color: var(--dsw-alias-state-success-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent);
        border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 24%, transparent);
      }
      .yb-badge-low {
        color: var(--dsw-alias-state-warn-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);
        border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 24%, transparent);
      }
      .yb-badge-critical, .yb-badge-error {
        color: var(--dsw-alias-state-error-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
        border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 24%, transparent);
      }
      .yb-badge-unavailable, .yb-badge-unknown, .yb-badge-loading {
        color: var(--dsw-alias-state-idle-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-idle-primary) 10%, transparent);
        border-color: color-mix(in srgb, var(--dsw-alias-state-idle-primary) 24%, transparent);
      }
      .yb-button {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 32px;
        padding: 0 12px;
        border: 1px solid transparent;
        border-radius: var(--dsw-radius-md, 8px);
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        cursor: pointer;
        white-space: nowrap;
      }
      .yb-button:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent);
        outline-offset: 1px;
      }
      .yb-button:disabled { cursor: default; opacity: 0.45; }
      .yb-button-ghost {
        background: transparent;
        border-color: var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-secondary);
      }
      .yb-button-ghost:hover:not(:disabled) {
        color: var(--dsw-alias-label-primary);
        background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
      }
      .yb-button-primary {
        background: var(--dsw-alias-brand-primary);
        color: var(--dsw-alias-bg-base);
      }
      .yb-button-primary:hover:not(:disabled) { opacity: 0.9; }
      .yb-total {
        display: flex;
        align-items: baseline;
        gap: 9px;
        margin: 4px 0 14px;
      }
      .yb-total-value {
        font-size: 34px;
        font-weight: 600;
        line-height: 42px;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }
      .yb-total-code {
        color: var(--dsw-alias-label-secondary);
        font-size: 13px;
        font-weight: 500;
      }
      .yb-wallets {
        display: flex;
        flex-direction: column;
        border-top: 1px solid var(--dsw-alias-border-l1);
      }
      .yb-wallet-row {
        display: grid;
        grid-template-columns: 74px minmax(0, 1fr) auto;
        align-items: baseline;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid var(--dsw-alias-border-l1);
      }
      .yb-wallet-row:last-child { border-bottom: none; }
      .yb-wallet-cur {
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
      }
      .yb-wallet-amount {
        font-size: 15px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
      .yb-wallet-detail {
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
        line-height: 17px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .yb-banner {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: 14px;
        padding: 10px 12px;
        border-radius: var(--dsw-radius-md, 8px);
        font-size: 12px;
        line-height: 18px;
      }
      .yb-banner-low {
        color: var(--dsw-alias-state-warn-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 9%, transparent);
      }
      .yb-banner-critical {
        color: var(--dsw-alias-state-error-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent);
      }
      .yb-empty {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 12px;
        border: 1px dashed var(--dsw-alias-border-l1);
        border-radius: var(--dsw-radius-md, 8px);
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
      }
      .yb-empty-title { color: var(--dsw-alias-label-primary); font-weight: 500; }
      .yb-toggle-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        padding: 4px 0;
      }
      .yb-row-title { font-size: 13px; font-weight: 500; line-height: 20px; }
      .yb-row-desc {
        margin-top: 2px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
        max-width: 560px;
      }
      .yb-divider {
        height: 1px;
        background: var(--dsw-alias-border-l1);
        margin: 14px 0;
      }
      .yb-switch {
        position: relative;
        flex: none;
        box-sizing: border-box;
        width: 38px;
        height: 22px;
        margin: 2px 0 0;
        padding: 0;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 999px;
        background: var(--dsw-alias-bg-layer-2);
        cursor: pointer;
        transition: background-color 120ms ease, border-color 120ms ease;
      }
      .yb-switch-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--dsw-alias-label-secondary);
        transition: transform 120ms ease, background-color 120ms ease;
      }
      .yb-switch[aria-checked="true"] {
        border-color: var(--dsw-alias-brand-primary);
        background: var(--dsw-alias-brand-primary);
      }
      .yb-switch[aria-checked="true"] .yb-switch-thumb {
        transform: translateX(16px);
        background: var(--dsw-alias-bg-base);
      }
      .yb-switch:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent);
        outline-offset: 2px;
      }
      .yb-threshold-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .yb-threshold-head {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .yb-threshold-title { font-size: 13px; font-weight: 600; line-height: 20px; }
      .yb-threshold-desc {
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
      }
      .yb-field-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .yb-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
      .yb-field-label {
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
        font-weight: 500;
        line-height: 16px;
      }
      .yb-input-shell {
        display: flex;
        align-items: center;
        box-sizing: border-box;
        height: 34px;
        padding: 0 10px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: var(--dsw-radius-md, 8px);
        background: var(--dsw-alias-bg-base);
      }
      .yb-input-shell:focus-within {
        border-color: var(--dsw-alias-brand-primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
      }
      .yb-currency-mark {
        flex: none;
        margin-right: 5px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .yb-input {
        min-width: 0;
        width: 100%;
        border: none;
        outline: none;
        padding: 0;
        background: transparent;
        color: var(--dsw-alias-label-primary);
        font-family: inherit;
        font-size: 14px;
        line-height: 20px;
        font-variant-numeric: tabular-nums;
      }
      .yb-rate-line {
        margin-top: 12px;
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
        line-height: 17px;
        font-variant-numeric: tabular-nums;
      }
      .yb-policy-list {
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .yb-policy-item {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        gap: 8px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
      }
      .yb-policy-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-top: 0;
        border-radius: 50%;
        color: var(--dsw-alias-brand-primary);
        background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
        font-size: 10px;
        font-weight: 600;
      }
      .yb-footnote {
        margin: 12px 0 0;
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
        line-height: 17px;
      }
      .yb-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        min-height: 36px;
      }
      .yb-save-state {
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
      }
      .yb-save-state-error { color: var(--dsw-alias-state-error-primary); }
      .yb-loading-row {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
      }
      .yb-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--dsw-alias-state-idle-primary);
      }
      .yb-retry-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 20px 0;
        color: var(--dsw-alias-label-secondary);
        font-size: 13px;
      }
      @media (max-width: 560px) {
        .yb-field-grid { grid-template-columns: 1fr; }
        .yb-wallet-row { grid-template-columns: 64px minmax(0, 1fr); }
        .yb-wallet-detail { grid-column: 2; text-align: left; }
        .yb-total-value { font-size: 30px; line-height: 38px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .yb-switch, .yb-switch-thumb { transition: none; }
      }
    `

    function fill(text, vars) {
      let result = String(text)
      for (const [key, value] of Object.entries(vars || {})) {
        result = result.split(`{${key}}`).join(String(value))
      }
      return result
    }

    function toCny(amount, currency, rates) {
      return amount * (rates[currency] ?? 1)
    }

    function fromCny(amount, currency, rates) {
      return amount / (rates[currency] ?? 1)
    }

    function round4(value) {
      return Math.round((value + Number.EPSILON) * 10_000) / 10_000
    }

    function inputNumber(value) {
      const rounded = round4(value)
      return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '')
    }

    function formatNumber(value) {
      if (!Number.isFinite(value)) return '—'
      try {
        return new Intl.NumberFormat(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }).format(value)
      } catch {
        return String(value)
      }
    }

    function formatRate(value) {
      if (!Number.isFinite(value)) return '—'
      return value.toFixed(2).replace(/\.?0+$/, '')
    }

    function formatTime(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) return ''
      try {
        return new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date(milliseconds))
      } catch {
        return new Date(milliseconds).toLocaleString()
      }
    }

    function toDraft(config) {
      return {
        autoInject: config.autoInject === true,
        autoConvert: config.autoConvert === true,
        thresholds: {
          low: Object.fromEntries(CURRENCIES.map(currency => [currency, inputNumber(config.thresholds.low[currency])])),
          critical: Object.fromEntries(CURRENCIES.map(currency => [currency, inputNumber(config.thresholds.critical[currency])])),
        },
      }
    }

    async function requestJson(path, init) {
      const response = await fetch(path, {
        cache: 'no-store',
        ...init,
        headers: {
          accept: 'application/json',
          ...(init && init.headers ? init.headers : {}),
        },
      })
      let payload
      try {
        payload = await response.json()
      } catch {
        payload = undefined
      }
      if (!response.ok) {
        const error = new Error(payload && payload.message ? payload.message : `HTTP ${response.status}`)
        if (payload && payload.code) error.code = payload.code
        throw error
      }
      return payload
    }

    function localizedError(t, error, fallbackKey) {
      if (error && typeof error.code === 'string') {
        const key = `error.${error.code}`
        const translated = t(key)
        if (translated !== key) return translated
      }
      return error && error.message ? error.message : t(fallbackKey)
    }

    function useLocale(ctx) {
      const [, setRevision] = useState(0)
      useEffect(() => ctx.locale.subscribe(() => setRevision(value => value + 1)), [ctx])
      return ctx.locale.bind(NS)
    }

    function Toggle({ checked, onChange, label }) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': checked,
        'aria-label': label,
        className: `yb-switch${checked ? ' yb-switch-on' : ''}`,
        onClick: () => onChange(!checked),
      }, h('span', { className: 'yb-switch-thumb' }))
    }

    function ThresholdInput({ currency, value, t, onChange }) {
      return h('label', { className: 'yb-field' },
        h('span', { className: 'yb-field-label' }, `${currency} · ${t(`currency.${currency}`)}`),
        h('span', { className: 'yb-input-shell' },
          h('span', { className: 'yb-currency-mark', 'aria-hidden': 'true' }, currency),
          h('input', {
            className: 'yb-input',
            type: 'text',
            inputMode: 'decimal',
            autoComplete: 'off',
            spellCheck: false,
            value,
            'aria-label': `${currency} ${t('thresholds')}`,
            onChange: event => onChange(event.target.value),
          }),
        ),
      )
    }

    function BalanceCard({ t, balance, loading, refreshing, error, onRefresh, onRetry }) {
      const status = balance?.status
      const level = status === 'ready' ? balance.level : status
      const tone = level === 'ok' || level === 'low' || level === 'critical'
        ? level
        : level === 'error'
          ? 'error'
          : level === 'unavailable'
            ? 'unavailable'
            : loading
              ? 'loading'
              : 'unknown'
      const label = loading
        ? t('status.loading')
        : status === 'ready'
          ? t(`status.${balance.level}`)
          : status === 'unavailable'
            ? t('status.unavailable')
            : status === 'error'
              ? t('status.error')
              : t('status.unknown')
      const total = status === 'ready' ? balance.total : null
      const wallets = status === 'ready' ? balance.wallets : []
      const updated = balance ? fill(t('lastUpdated'), { time: formatTime(balance.fetchedAt) || t('never') }) : t('never')

      return h('section', { className: 'yb-card' },
        h('div', { className: 'yb-card-head' },
          h('div', {},
            h('h3', { className: 'yb-card-title' }, t('balance.section')),
            h('div', { className: 'yb-meta-line' },
              h('span', { className: `yb-badge yb-badge-${tone}` }, label),
              h('span', { className: 'yb-meta' }, updated),
            ),
          ),
          h('button', {
            type: 'button',
            className: 'yb-button yb-button-ghost',
            disabled: loading || refreshing,
            onClick: onRefresh,
          }, refreshing ? t('refreshing') : t('refresh')),
        ),

        error && !balance
          ? h('div', { className: 'yb-retry-row' },
            h('span', {}, error),
            h('button', { type: 'button', className: 'yb-button yb-button-ghost', onClick: onRetry }, t('retry')),
          )
          : loading && !balance
            ? h('div', { className: 'yb-loading-row' }, h('span', { className: 'yb-dot' }), t('loading'))
            : status === 'ready'
              ? h(React.Fragment, {},
                h('div', { className: 'yb-total' },
                  h('span', { className: 'yb-total-value' }, total ? formatNumber(total.amount) : '—'),
                  h('span', { className: 'yb-total-code' }, total ? total.currency : ''),
                ),
                h('div', { className: 'yb-wallets' },
                  wallets.length === 0
                    ? h('div', { className: 'yb-empty' }, t('noWallets'))
                    : wallets.map(wallet => h('div', { className: 'yb-wallet-row', key: wallet.currency },
                      h('span', { className: 'yb-wallet-cur' }, wallet.currency),
                      h('span', { className: 'yb-wallet-amount' }, formatNumber(wallet.total)),
                      h('span', { className: 'yb-wallet-detail' },
                        `${t('recharge')} ${formatNumber(wallet.recharge)} · ${t('bonus')} ${formatNumber(wallet.bonus)}`,
                      ),
                    )),
                ),
                level === 'low' || level === 'critical'
                  ? h('div', { className: `yb-banner yb-banner-${level}` }, t(`banner.${level}`))
                  : null,
              )
              : h('div', { className: 'yb-empty' },
                h('div', { className: 'yb-empty-title' }, status === 'unavailable' ? t('notLoggedIn') : t('readFailed')),
                balance?.reason ? h('div', {}, balance.reason) : null,
                h('div', {}, t('signInHint')),
                h('div', {},
                  h('button', { type: 'button', className: 'yb-button yb-button-ghost', onClick: onRefresh }, t('retry')),
                ),
              ),
      )
    }

    function BalancePage({ ctx }) {
      const t = useLocale(ctx)
      const [data, setData] = useState(null)
      const [draft, setDraft] = useState(null)
      const [dirty, setDirty] = useState(false)
      const [loading, setLoading] = useState(true)
      const [refreshing, setRefreshing] = useState(false)
      const [saving, setSaving] = useState(false)
      const [loadError, setLoadError] = useState('')
      const [saveError, setSaveError] = useState('')
      const [saved, setSaved] = useState(false)

      const load = useCallback(async (refresh, syncDraft) => {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        setLoadError('')
        try {
          const payload = await requestJson(`${STATE_ROUTE}${refresh ? '?refresh=1' : ''}`)
          setData(payload)
          if (syncDraft) {
            setDraft(toDraft(payload.config))
            setDirty(false)
            setSaved(false)
          }
        } catch (error) {
          setLoadError(localizedError(t, error, 'error.readFailed'))
        } finally {
          if (refresh) setRefreshing(false)
          else setLoading(false)
        }
      }, [t])

      useEffect(() => {
        void load(false, true)
      }, [])

      const rates = data?.rates ?? FALLBACK_RATES
      const balance = data?.balance
      const error = loadError || saveError

      function updateFlag(key, value) {
        setDraft(previous => previous ? { ...previous, [key]: value } : previous)
        setDirty(true)
        setSaved(false)
        setSaveError('')
      }

      function updateThreshold(level, currency, raw) {
        setDraft(previous => {
          if (!previous) return previous
          const next = {
            ...previous,
            thresholds: {
              ...previous.thresholds,
              [level]: { ...previous.thresholds[level], [currency]: raw },
            },
          }
          const parsed = Number(raw)
          if (previous.autoConvert && raw.trim() !== '' && Number.isFinite(parsed) && parsed >= 0) {
            const cny = toCny(parsed, currency, rates)
            for (const other of CURRENCIES) {
              if (other !== currency) next.thresholds[level][other] = inputNumber(fromCny(cny, other, rates))
            }
          }
          return next
        })
        setDirty(true)
        setSaved(false)
        setSaveError('')
      }

      function buildPayload() {
        const thresholds = { low: {}, critical: {} }
        for (const level of ['low', 'critical']) {
          for (const currency of CURRENCIES) {
            const raw = draft.thresholds[level][currency]
            const value = Number(raw)
            if (raw.trim() === '' || !Number.isFinite(value) || value < 0) {
              return { error: t('error.invalidNumber') }
            }
            thresholds[level][currency] = round4(value)
          }
        }
        return {
          value: {
            autoInject: draft.autoInject,
            autoConvert: draft.autoConvert,
            thresholds,
          },
        }
      }

      async function save() {
        const prepared = buildPayload()
        if (prepared.error) {
          setSaveError(prepared.error)
          return
        }
        setSaving(true)
        setSaveError('')
        try {
          const payload = await requestJson(CONFIG_ROUTE, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              [MUTATION_HEADER]: '1',
            },
            body: JSON.stringify(prepared.value),
          })
          setData(payload)
          setDraft(toDraft(payload.config))
          setDirty(false)
          setSaved(true)
        } catch (errorValue) {
          setSaveError(localizedError(t, errorValue, 'error.saveFailed'))
        } finally {
          setSaving(false)
        }
      }

      return h('div', { className: 'yb-root' },
        h('header', { className: 'yb-header' },
          h('div', { className: 'yb-eyebrow' }, t('eyebrow')),
          h('h2', { className: 'yb-title' }, t('title')),
          h('p', { className: 'yb-subtitle' }, t('subtitle')),
        ),

        h(BalanceCard, {
          t,
          balance,
          loading,
          refreshing,
          error: loadError,
          onRefresh: () => void load(true, false),
          onRetry: () => void load(false, true),
        }),

        !draft
          ? h('section', { className: 'yb-card' },
            h('div', { className: 'yb-loading-row' }, h('span', { className: 'yb-dot' }), t('loading')),
          )
          : h(React.Fragment, {},
            h('section', { className: 'yb-card' },
              h('div', { className: 'yb-card-head' },
                h('div', {},
                  h('h3', { className: 'yb-card-title' }, t('settings.title')),
                  h('p', { className: 'yb-card-desc' }, t('settings.hint')),
                ),
              ),
              h('div', { className: 'yb-toggle-row' },
                h('div', {},
                  h('div', { className: 'yb-row-title' }, t('autoInject')),
                  h('div', { className: 'yb-row-desc' }, t('autoInjectHint')),
                ),
                h(Toggle, {
                  checked: draft.autoInject,
                  label: t('autoInject'),
                  onChange: value => updateFlag('autoInject', value),
                }),
              ),
              h('div', { className: 'yb-divider' }),
              h('div', { className: 'yb-toggle-row' },
                h('div', {},
                  h('div', { className: 'yb-row-title' }, t('autoConvert')),
                  h('div', { className: 'yb-row-desc' }, t('autoConvertHint')),
                ),
                h(Toggle, {
                  checked: draft.autoConvert,
                  label: t('autoConvert'),
                  onChange: value => updateFlag('autoConvert', value),
                }),
              ),
              h('div', { className: 'yb-rate-line' },
                fill(t('rates'), { usd: formatRate(rates.USD), eur: formatRate(rates.EUR) }),
              ),
            ),

            h('section', { className: 'yb-card' },
              h('div', { className: 'yb-card-head' },
                h('div', {},
                  h('h3', { className: 'yb-card-title' }, t('thresholds')),
                  h('p', { className: 'yb-card-desc' }, t('thresholdsHint')),
                ),
              ),
              h('div', { className: 'yb-threshold-group' },
                h('div', { className: 'yb-threshold-head' },
                  h('span', { className: 'yb-threshold-title' }, t('low')),
                  h('span', { className: 'yb-threshold-desc' }, t('lowDesc')),
                ),
                h('div', { className: 'yb-field-grid' },
                  CURRENCIES.map(currency => h(ThresholdInput, {
                    key: `low-${currency}`,
                    currency,
                    t,
                    value: draft.thresholds.low[currency],
                    onChange: value => updateThreshold('low', currency, value),
                  })),
                ),
              ),
              h('div', { className: 'yb-divider' }),
              h('div', { className: 'yb-threshold-group' },
                h('div', { className: 'yb-threshold-head' },
                  h('span', { className: 'yb-threshold-title' }, t('critical')),
                  h('span', { className: 'yb-threshold-desc' }, t('criticalDesc')),
                ),
                h('div', { className: 'yb-field-grid' },
                  CURRENCIES.map(currency => h(ThresholdInput, {
                    key: `critical-${currency}`,
                    currency,
                    t,
                    value: draft.thresholds.critical[currency],
                    onChange: value => updateThreshold('critical', currency, value),
                  })),
                ),
              ),
              h('p', { className: 'yb-footnote' }, t('goalHint')),
            ),

            h('section', { className: 'yb-card' },
              h('div', { className: 'yb-card-head' },
                h('div', {},
                  h('h3', { className: 'yb-card-title' }, t('policy.title')),
                  h('p', { className: 'yb-card-desc' }, t('policy.hint')),
                ),
              ),
              h('ul', { className: 'yb-policy-list' },
                h('li', { className: 'yb-policy-item' },
                  h('span', { className: 'yb-policy-mark' }, '1'),
                  h('span', {}, t('policy.low')),
                ),
                h('li', { className: 'yb-policy-item' },
                  h('span', { className: 'yb-policy-mark' }, '2'),
                  h('span', {}, t('policy.critical')),
                ),
                h('li', { className: 'yb-policy-item' },
                  h('span', { className: 'yb-policy-mark' }, '3'),
                  h('span', {}, t('policy.unknown')),
                ),
              ),
            ),
          ),

        h('footer', { className: 'yb-footer' },
          h('span', {
            className: `yb-save-state${saveError ? ' yb-save-state-error' : ''}`,
          }, saveError || (dirty ? t('unsaved') : saved ? t('saved') : '')),
          h('button', {
            type: 'button',
            className: 'yb-button yb-button-primary',
            disabled: !draft || !dirty || saving,
            onClick: () => void save(),
          }, saving ? t('saving') : t('save')),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)

        ctx.effect(() => ctx.locale.register(NS, { zh: DICT_ZH, en: DICT_EN }), 'your-balance: dictionaries')

        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-plugin', 'dsh-your-balance')
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'your-balance: styles')

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'your-balance',
          order: 58,
          label: () => t('nav'),
        }, props => h(BalancePage, { ...props, ctx })))
      },
    }
  },
})
