import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_CONFIG,
  formatThresholdInput,
  fromCny,
  normalizeConfig,
  roundThreshold,
  toCny,
  validateConfig,
} from '../lib/config.js'

test('defaults match the requested thresholds', () => {
  assert.equal(DEFAULT_CONFIG.thresholds.low.CNY, 1.5)
  assert.equal(DEFAULT_CONFIG.thresholds.low.USD, 0.25)
  assert.equal(DEFAULT_CONFIG.thresholds.low.EUR, 0.2)
  assert.equal(DEFAULT_CONFIG.thresholds.critical.CNY, 0.25)
  assert.equal(DEFAULT_CONFIG.thresholds.critical.USD, 0.05)
  assert.equal(DEFAULT_CONFIG.thresholds.critical.EUR, 0.045)
})

test('currency conversion round-trips within four decimals', () => {
  const cny = toCny(0.25, 'USD')
  assert.equal(cny, 1.8)
  assert.equal(roundThreshold(fromCny(cny, 'USD')), 0.25)
  assert.equal(roundThreshold(toCny(1, 'EUR')), 8.4)
  assert.equal(formatThresholdInput(0.045), '0.045')
})

test('validation rejects a low threshold that is not above critical', () => {
  const result = validateConfig({
    autoInject: true,
    autoConvert: true,
    thresholds: {
      low: { CNY: 0.1, USD: 0.25, EUR: 0.2 },
      critical: { CNY: 0.25, USD: 0.05, EUR: 0.045 },
    },
  })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'thresholdOrder')
})

test('validation accepts numeric strings and rounds', () => {
  const result = validateConfig({
    autoInject: false,
    autoConvert: true,
    thresholds: {
      low: { CNY: '1.50001', USD: 0.25, EUR: 0.2 },
      critical: { CNY: 0.25, USD: 0.05, EUR: 0.045 },
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.config.autoInject, false)
  assert.equal(result.config.thresholds.low.CNY, 1.5)
})

test('corrupt settings fall back instead of keeping an impossible order', () => {
  const normalized = normalizeConfig({
    autoInject: 'yes',
    thresholds: {
      low: { CNY: 0.01, USD: 0.02, EUR: 0.03 },
      critical: { CNY: 0.5, USD: 0.5, EUR: 0.5 },
    },
  })
  assert.equal(normalized.autoInject, true)
  assert.deepEqual(normalized.thresholds, {
    low: { ...DEFAULT_CONFIG.thresholds.low },
    critical: { ...DEFAULT_CONFIG.thresholds.critical },
  })
})
