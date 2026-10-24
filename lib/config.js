/**
 * Persistent settings and currency helpers for AI查余额 (dsh-your-balance).
 *
 * The plugin keeps its user-facing settings in a small JSON file owned by the
 * plugin instead of the Cordis row config: the settings page can then save
 * without rewriting the profile patch, and the row config stays upgrade-safe.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Supported display and threshold currencies. */
export const CURRENCIES = ['CNY', 'USD', 'EUR']

/** CNY per one unit of each currency. Kept deliberately simple and local. */
export const CNY_PER_UNIT = Object.freeze({ CNY: 1, USD: 7.2, EUR: 8.4 })

/** Defaults requested by the product brief. */
export const DEFAULT_CONFIG = Object.freeze({
  autoInject: true,
  autoConvert: true,
  thresholds: Object.freeze({
    low: Object.freeze({ CNY: 1.5, USD: 0.25, EUR: 0.2 }),
    critical: Object.freeze({ CNY: 0.25, USD: 0.05, EUR: 0.045 }),
  }),
})

const MAX_THRESHOLD = 1_000_000_000

/** Resolve the harness home without importing a Host-only package. */
export function resolveDshHome() {
  const configured = process.env.DSH_HOME
  return configured && configured.trim() !== '' ? configured : path.join(os.homedir(), '.dsh')
}

/** Absolute path of the plugin's settings file. */
export function configPath() {
  return path.join(resolveDshHome(), 'your-balance', 'config.json')
}

/** Round a threshold to four decimal places without keeping float noise. */
export function roundThreshold(value) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

/** Convert an amount in `currency` to CNY. */
export function toCny(amount, currency) {
  return amount * (CNY_PER_UNIT[currency] ?? 1)
}

/** Convert an amount in CNY to `currency`. */
export function fromCny(amount, currency) {
  return amount / (CNY_PER_UNIT[currency] ?? 1)
}

/** Format a threshold for a text input, dropping meaningless trailing zeros. */
export function formatThresholdInput(value) {
  const rounded = roundThreshold(value)
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '')
}

function toFiniteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function fallbackThreshold(level, currency) {
  return DEFAULT_CONFIG.thresholds[level][currency]
}

/**
 * Tolerant loader used for the file on disk. Invalid fields fall back to the
 * shipped defaults instead of preventing the plugin from activating.
 */
export function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const thresholds = {}
  for (const level of ['low', 'critical']) {
    thresholds[level] = {}
    for (const currency of CURRENCIES) {
      const value = toFiniteNumber(source.thresholds?.[level]?.[currency])
      thresholds[level][currency] = value !== undefined && value >= 0 && value <= MAX_THRESHOLD
        ? roundThreshold(value)
        : fallbackThreshold(level, currency)
    }
  }

  // A corrupt file must not leave the model with an impossible policy.
  for (const currency of CURRENCIES) {
    if (thresholds.low[currency] <= thresholds.critical[currency]) {
      for (const level of ['low', 'critical']) {
        for (const code of CURRENCIES) thresholds[level][code] = fallbackThreshold(level, code)
      }
      break
    }
  }

  return {
    autoInject: typeof source.autoInject === 'boolean' ? source.autoInject : DEFAULT_CONFIG.autoInject,
    autoConvert: typeof source.autoConvert === 'boolean' ? source.autoConvert : DEFAULT_CONFIG.autoConvert,
    thresholds,
  }
}

/** Load settings synchronously so listeners see the saved policy immediately. */
export function loadConfig() {
  const file = configPath()
  try {
    if (!existsSync(file)) return normalizeConfig(DEFAULT_CONFIG)
    return normalizeConfig(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return normalizeConfig(DEFAULT_CONFIG)
  }
}

/**
 * Validate and normalize one complete settings payload.
 * @returns {{ ok: true, config: object } | { ok: false, code: string, message: string }}
 */
export function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, code: 'invalidConfig', message: 'settings payload must be an object' }
  }

  const thresholds = {}
  for (const level of ['low', 'critical']) {
    thresholds[level] = {}
    for (const currency of CURRENCIES) {
      const value = toFiniteNumber(input.thresholds?.[level]?.[currency])
      if (value === undefined) {
        return { ok: false, code: 'invalidNumber', message: `invalid ${level}.${currency} threshold` }
      }
      if (value < 0) {
        return { ok: false, code: 'negativeThreshold', message: `${level}.${currency} must not be negative` }
      }
      if (value > MAX_THRESHOLD) {
        return { ok: false, code: 'thresholdTooLarge', message: `${level}.${currency} is too large` }
      }
      thresholds[level][currency] = roundThreshold(value)
    }
  }

  for (const currency of CURRENCIES) {
    if (thresholds.low[currency] <= thresholds.critical[currency]) {
      return {
        ok: false,
        code: 'thresholdOrder',
        message: `low.${currency} must be greater than critical.${currency}`,
      }
    }
  }

  return {
    ok: true,
    config: {
      autoInject: typeof input.autoInject === 'boolean' ? input.autoInject : DEFAULT_CONFIG.autoInject,
      autoConvert: typeof input.autoConvert === 'boolean' ? input.autoConvert : DEFAULT_CONFIG.autoConvert,
      thresholds,
    },
  }
}

/** Atomically persist settings; the temporary file stays beside the target. */
export function saveConfig(config) {
  const file = configPath()
  const directory = path.dirname(file)
  mkdirSync(directory, { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  renameSync(temporary, file)
}

/** The reference rates exposed to the settings page. */
export function referenceRates() {
  return { ...CNY_PER_UNIT }
}
