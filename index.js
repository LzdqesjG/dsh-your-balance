/**
 * AI查余额 (dsh-your-balance) — Host half.
 *
 * Registers:
 *  - the `check_balance` agent tool backed by the optional DeepSeek account service;
 *  - a durable per-step balance snapshot through the `agent/pre-step` waterfall;
 *  - a small settings API for the Web settings page;
 *  - the auto-injected balance policy prompt.
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createBalanceReader, renderSnapshot, renderToolResult } from './lib/balance.js'
import {
  loadConfig,
  normalizeConfig,
  referenceRates,
  saveConfig,
  validateConfig,
} from './lib/config.js'

export const name = 'your-balance'
export const inject = ['tools', 'systemPrompt']

const STATE_ROUTE = '/api/your-balance/state'
const CONFIG_ROUTE = '/api/your-balance/config'
const MUTATION_HEADER = 'x-dsh-your-balance'
const MAX_BODY_BYTES = 64 * 1024

const POLICY_TEXT = `## AI查余额 / 余额策略
每个模型步骤都会收到一条“AI查余额”余额快照，包含当前可用余额、状态和阈值。把它当作当前账户的真实余额，并遵守以下策略：

- 状态“充足”：正常完成用户任务，不需要省电。
- 状态“较低”：立即进入省电模式。减少输出 token：只给必要结论，避免重复复述、寒暄和长篇解释，代码与清单尽量精简；减少非必要工具调用，优先用最少步骤完成当前任务。
- 状态“严重不足”：停止继续推进任务。先用 write 工具在工作区根目录写入或更新 GOAL.md，任务状态必须特别详细，至少包含：总体目标、已完成、进行中、待办事项、关键文件与绝对/相对路径、关键决策与原因、已运行命令及结果、当前阻塞、下一步可执行步骤、恢复时首先应该读取的文件。随后只回复一句简短说明（例如“余额不足，请充值；当前任务状态已保存到 GOAL.md。”），不要调用其他工具，不要继续输出，立即结束本轮发言，等待用户下一轮唤醒。
- 状态“无法读取”：不要臆测余额；正常推进任务，必要时调用 check_balance 重试。

新的一轮用户消息到达时，如果余额已恢复且工作区存在 GOAL.md，先读取 GOAL.md 并从上次中断处继续。`

function textBlock(text) {
  return [{ type: 'text', text }]
}

function isLoopbackHostname(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]'
    || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
}

function requestAllowed(req, mutation) {
  const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : ''
  let hostUrl
  try {
    hostUrl = new URL(`http://${hostHeader}`)
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin !== '') {
    try {
      if (new URL(origin).host !== hostUrl.host) return false
    } catch {
      return false
    }
  }
  return mutation ? req.headers[MUTATION_HEADER] === '1' : true
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let settled = false
    let size = 0
    const chunks = []
    const fail = error => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', chunk => {
      if (settled) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        fail(Object.assign(new Error('request body is too large'), { statusCode: 413, code: 'bodyTooLarge' }))
        req.resume()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw.trim() === '' ? {} : JSON.parse(raw))
      } catch {
        reject(Object.assign(new Error('request body must be JSON'), { statusCode: 400, code: 'invalidConfig' }))
      }
    })
    req.on('error', fail)
  })
}

function failureMessage(error) {
  if (error && typeof error === 'object' && typeof error.message === 'string') return error.message
  return String(error)
}

export function apply(ctx) {
  let config = loadConfig()
  let promptDispose
  const reader = createBalanceReader(ctx, () => config)

  function syncPolicyPrompt() {
    if (config.autoInject && promptDispose === undefined) {
      promptDispose = ctx.systemPrompt.section({
        name: 'your-balance',
        order: 800,
        text: POLICY_TEXT,
      })
    } else if (!config.autoInject && promptDispose !== undefined) {
      promptDispose()
      promptDispose = undefined
    }
  }

  syncPolicyPrompt()
  ctx.effect(() => () => {
    if (promptDispose !== undefined) {
      promptDispose()
      promptDispose = undefined
    }
  }, 'your-balance: policy prompt cleanup')

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'check_balance',
    description: '查询当前 DeepSeek 账号的充值余额与赠送余额，返回各币种金额、主币种可用合计，以及按当前阈值判断的余额状态（充足 / 较低 / 严重不足）。用户询问余额、是否够用、是否需要充值，或需要确认省电/停机策略时调用。',
    parameters: {},
    output: {
      // The rendered text is the model-facing contract. Keeping the value
      // schema open avoids rejecting legitimate nullable fields such as
      // `reason: null` or an unavailable balance's `total: null`.
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => textBlock(renderToolResult(value, config)),
    },
    isConcurrencySafe: () => true,
    timeoutMs: 45_000,
    execute: async (_args, exec) => {
      exec.signal.throwIfAborted()
      return await reader.read({ force: true, signal: exec.signal })
    },
  })), 'your-balance: check_balance tool')

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (!config.autoInject || decision.kind === 'reject' || payload.signal.aborted) return decision

    let view
    try {
      view = await reader.read({ signal: payload.signal })
    } catch {
      return decision
    }
    if (payload.signal.aborted) return decision

    try {
      const text = renderSnapshot(view, config)
      return {
        ...decision,
        messages: [
          ...decision.messages,
          createUserMessage({
            content: textBlock(text),
            source: {
              kind: 'your-balance',
              form: 'snapshot',
              sections: [{ name: 'your-balance', text }],
            },
          }),
        ],
      }
    } catch {
      return decision
    }
  })

  const webServer = ctx.get('webServer')
  if (webServer === undefined) return

  async function statePayload(force) {
    return {
      config,
      balance: await reader.read({ force }),
      rates: referenceRates(),
    }
  }

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: STATE_ROUTE,
    handler: async (req, res) => {
      if (!requestAllowed(req, false)) {
        sendJson(res, 403, { code: 'forbidden', message: 'forbidden' })
        return
      }
      if (req.method !== 'GET') {
        sendJson(res, 405, { code: 'methodNotAllowed', message: 'method not allowed' })
        return
      }
      try {
        const url = new URL(req.url ?? STATE_ROUTE, 'http://localhost')
        await sendJson(res, 200, await statePayload(url.searchParams.get('refresh') === '1'))
      } catch (error) {
        sendJson(res, 500, { code: 'readFailed', message: failureMessage(error) })
      }
    },
  }), 'your-balance: state route')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: CONFIG_ROUTE,
    handler: async (req, res) => {
      if (!requestAllowed(req, true)) {
        sendJson(res, 403, { code: 'forbidden', message: 'forbidden' })
        return
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { code: 'methodNotAllowed', message: 'method not allowed' })
        return
      }
      try {
        const body = await readJsonBody(req)
        const validated = validateConfig(body)
        if (!validated.ok) {
          sendJson(res, 400, { code: validated.code, message: validated.message })
          return
        }
        saveConfig(validated.config)
        config = normalizeConfig(validated.config)
        reader.clearCache()
        syncPolicyPrompt()
        await sendJson(res, 200, await statePayload(false))
      } catch (error) {
        const status = Number(error && error.statusCode) || 500
        const code = error && error.code ? String(error.code) : 'saveFailed'
        sendJson(res, status, { code, message: failureMessage(error) })
      }
    },
  }), 'your-balance: config route')
}
