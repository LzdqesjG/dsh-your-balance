# AI查余额 · dsh-your-balance

> Balance-aware turns for DeepSeek Harness: a `check_balance` tool, a durable per-step balance snapshot, and an automatic power-saving / stop policy.

[![dsh-plugin](https://img.shields.io/badge/dsh--plugin-yes-2ea44f)](https://github.com/topics/dsh-plugin)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen)](package.json)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.1--rc.2-4f46e5)](package.json)

AI查余额 is a DeepSeek Harness plugin that lets the model see the signed-in DeepSeek account balance while it works. It gives the model an explicit balance tool, appends a compact balance snapshot to every model step, and turns the configured balance thresholds into a concrete output-budget and stop policy.

The project is independent and is not affiliated with DeepSeek.

## Why this exists

Long agent runs can burn through a small balance while every step still looks healthy. The failure is rarely dramatic: the model simply keeps working until the account cannot pay for the next request. AI查余额 makes the remaining balance part of the model's working context, then asks it to behave differently before that happens.

- **Low balance** → start a power-saving mode: fewer output tokens, fewer non-essential tools, no repeated explanations.
- **Critical balance** → write a detailed `GOAL.md`, send one short top-up message, and stop the turn in place.
- **Unreadable balance** → never guess; keep working and retry when confirmation matters.

## Features

- **`check_balance` agent tool** — returns recharge wallets, bonus wallets, per-currency totals, the primary-currency spendable total, and the current level (`ok` / `low` / `critical`).
- **Per-step balance injection** — after a user message and after every tool result, the plugin appends a durable, source-attributed balance snapshot as a user-role context message. A 10-second cache prevents repeated Platform calls during multi-tool turns.
- **Automatic policy prompt** — when auto-injection is enabled, a system-prompt section tells the model exactly what “low” and “critical” mean, including the detailed `GOAL.md` requirements and the one-message stop behavior.
- **Settings page** — switch auto-injection on/off, edit low and critical thresholds in CNY / USD / EUR, and optionally link the three currencies so editing one converts the other two.
- **Live balance card** — wallet breakdown, primary-currency total, status badge, refresh, and save/error feedback.
- **Local-first settings** — thresholds live in `$DSH_HOME/your-balance/config.json`; no credentials or balance values are written into the repository.

## How it works

### 1. The tool

`check_balance` calls the Host's optional `deepseekAccount` service with the same account metadata used by the official account UI. It always performs a live read and returns structured data plus a readable tool card.

```text
AI查余额：查询结果
状态：充足
主币种：CNY
可用合计：CNY 10.7562
钱包明细：
- CNY：充值 3.0838；赠送 7.6723；合计 10.7562
```

If the profile is signed out, uses only an API key, or the Platform endpoint is unavailable, the tool returns an explicit “unreadable” result instead of a fabricated zero.

### 2. The per-step snapshot

The Host registers an `agent/pre-step` listener. When auto-injection is on, it appends one sourced user message to the step:

```text
【AI查余额 · 自动余额快照】
状态：充足
主币种：CNY；可用合计：CNY 10.7562
钱包：
- CNY：充值 3.0838；赠送 7.6723；合计 10.7562
阈值：较低 2.5 CNY / 0.3472 USD / 0.2976 EUR；严重不足 0.25 CNY / 0.0347 USD / 0.0298 EUR。
本币种判定：低于 2.5 CNY 进入省电模式；低于 0.25 CNY 视为严重不足。
采样时间：2026-10-23T23:58:31.855Z
```

The injected message is durable session history, not a transient UI decoration. The snapshot is intentionally short: the full policy lives once in the system prompt, while each step carries only the current facts.

### 3. The policy prompt

The system-prompt section is registered only while auto-injection is on. It gives the model three behaviors:

| Level | Behavior |
|---|---|
| `ok` | Work normally. |
| `low` | Enter power-saving mode: concise answers, minimal tool calls, no filler. |
| `critical` | Stop productive work. First write/update `GOAL.md` with a detailed resumable state, then reply with one short top-up message and stop the turn. |
| `unknown` | Do not guess the balance; retry with `check_balance` when it matters. |

A new user turn with a recovered balance is instructed to read `GOAL.md` and resume from the saved state.

## Install

### From GitHub

```sh
dsh plugin --profile <profile> add github:LzdqesjG/dsh-your-balance
```

### From a local checkout

```sh
dsh plugin --profile <profile> add /absolute/path/to/dsh-your-balance
```

Or use the DSH Plugin Manager and install the directory as a bundle.

After installation, refresh the Web page and open **Settings → AI查余额**.

### Requirements

- DeepSeek Harness `0.2.1-rc.2` (tested) with the Web app and `deepseekAccount` service.
- Node.js `^22.19.0 || >=24.0.0`.
- A signed-in DeepSeek account for actual balance values. API-key-only profiles can still use the plugin, but the balance will be reported as unavailable.

## Configuration

Open **Settings → AI查余额**. The page provides:

- **Auto-inject balance** — on/off. When off, the tool remains available but no snapshots or policy prompt are added.
- **Low balance threshold** — CNY / USD / EUR.
- **Critical threshold** — CNY / USD / EUR.
- **FX-linked conversion** — when on, editing one currency recalculates the other two at the built-in reference rates.
- **Live balance preview** — recharge and bonus wallets, primary-currency total, current status.

Defaults:

| Level | CNY | USD | EUR |
|---|---:|---:|---:|
| Low | 1.50 | 0.25 | 0.20 |
| Critical | 0.25 | 0.05 | 0.045 |

Built-in reference rates: `1 USD = 7.2 CNY`, `1 EUR = 8.4 CNY`. The plugin evaluates the primary currency — the wallet currency with the highest converted total — against that currency's thresholds.

Settings are stored at:

```text
$DSH_HOME/your-balance/config.json
```

When `DSH_HOME` is unset, `~/.dsh` is used. Writes are atomic (temporary file + rename).

## Data and security

- Balance data is read through the Host's DeepSeek account service; the plugin never asks for or stores an account token.
- The settings API is served by the Host Web server and accepts only loopback hosts, same-origin browser requests, and writes carrying `x-dsh-your-balance: 1`.
- No credentials, account IDs, or balance values are written to the repository.
- The plugin does not make third-party network requests. Reference exchange rates are constants.

## Limitations

- The DeepSeek Platform account API only exposes CNY and USD wallets today. EUR thresholds are supported for conversion and display, and will be used if a wallet in EUR ever appears.
- The policy is model guidance, not a hard budget enforcement layer. A model can still choose not to follow it; the tool and snapshot make the correct behavior explicit.
- The balance snapshot is cached for 10 seconds for auto-injection; the `check_balance` tool always performs a live read.
- Auto-injection adds tokens to every eligible step. Turn it off if its context cost outweighs the benefit.
- The plugin is not affiliated with or endorsed by DeepSeek.

## Development

```sh
node --check index.js
node --check client.js
node --check lib/balance.js
node --check lib/config.js
node test/config.test.mjs
```

The test file uses Node's built-in test runner. Run it directly; on some sandboxed Windows setups, `node --test` cannot spawn the child process even though the tests themselves pass.

## Author and provenance

- **Publisher and maintainer:** [LzdqesjG](https://github.com/LzdqesjG)
- **Implementation and documentation:** an AI coding agent running in DeepSeek Harness on the `deepseek-flash` model, working from LzdqesjG's specification on 2026-10-24.
- **AI-generated project:** the code, README, and icon were produced by that agent. Review the source before deploying it in a sensitive environment.

中文说明见 [README.zh.md](README.zh.md)。

## License

MIT. See [LICENSE](LICENSE).
