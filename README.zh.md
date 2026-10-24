# AI查余额 · dsh-your-balance

> 让 DeepSeek Harness 的每一轮操作都看得见余额：`check_balance` 工具、每步余额快照，以及自动省电 / 原地停机策略。

[![dsh-plugin](https://img.shields.io/badge/dsh--plugin-yes-2ea44f)](https://github.com/topics/dsh-plugin)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

AI查余额是一个 DeepSeek Harness 插件。它让模型在工作过程中看到当前 DeepSeek 账号余额：提供主动查询工具，在每个模型步骤追加一条余额快照，并把配置的余额阈值转换成明确的“省 Token / 停机”行为。

本项目独立开发，与 DeepSeek 官方无隶属关系。

## 为什么需要它

长时间运行的 Agent 可能在小额余额上悄悄耗尽资金，而每一步看起来都很正常：模型会一直工作到下一次请求付不起为止。AI查余额把剩余余额变成模型当前上下文的一部分，让它在余额耗尽前主动改变行为。

- **余额较低**：进入省电模式，减少输出 token，减少非必要工具调用，不重复解释。
- **余额严重不足**：先写详细的 `GOAL.md`，再发一句简短的充值提示，然后原地停止本轮发言。
- **余额无法读取**：不猜测余额；需要确认时重试 `check_balance`。

## 功能

- **`check_balance` 工具**：返回充值钱包、赠送钱包、各币种金额、主币种可用合计，以及当前状态（`ok` / `low` / `critical`）。
- **每步注入余额**：用户发言后、每个工具返回后的模型步骤，追加一条持久的、带来源标记的余额快照。自动注入使用 10 秒缓存，避免多步工具调用反复请求平台。
- **自动注入策略提示词**：开启自动注入时，注册一条系统提示词，明确“较低”和“严重不足”的行为，包括 `GOAL.md` 必须包含的内容和只回复一句后停止的规则。
- **配置页面**：设置 → AI查余额。支持开关自动注入、编辑 CNY / USD / EUR 两组阈值、开启汇率联动。
- **余额面板**：钱包明细、主币种合计、状态标签、刷新、保存与错误提示。
- **本地保存配置**：阈值保存在 `$DSH_HOME/your-balance/config.json`，仓库中不包含任何凭据或余额数据。

## 工作原理

### 1. 查询工具

`check_balance` 调用 Host 可选的 `deepseekAccount` 服务，并总是执行实时查询。返回结构化数据和可读的工具卡片：

```text
AI查余额：查询结果
状态：充足
主币种：CNY
可用合计：CNY 10.7562
钱包明细：
- CNY：充值 3.0838；赠送 7.6723；合计 10.7562
```

未登录、仅使用 API Key，或平台接口不可用时，工具会明确返回“无法读取”，不会编造一个 0 余额。

### 2. 每步余额快照

Host 注册 `agent/pre-step` 监听器。开启自动注入后，它会向当前步骤追加一条带来源标记的用户消息：

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

快照会进入持久会话历史，而不是临时的 UI 装饰。每条快照只包含当前事实，完整策略只放在系统提示词里，避免每步重复长文本。

### 3. 策略提示词

自动注入开启时，插件注册一条系统提示词：

| 状态 | 行为 |
|---|---|
| `ok` | 正常完成任务。 |
| `low` | 进入省电模式：输出精简、只保留必要工具调用、不写填充内容。 |
| `critical` | 停止推进任务。先写入/更新详细的 `GOAL.md`，再回复一句充值提示并结束本轮发言。 |
| `unknown` | 不猜测余额；需要时调用 `check_balance` 重试。 |

如果新的一轮用户消息到达时余额已恢复，并且工作区存在 `GOAL.md`，模型会先读取它并从上次中断处继续。

## 安装

### 从 GitHub 安装

```sh
dsh plugin --profile <profile> add github:LzdqesjG/dsh-your-balance
```

### 从本地目录安装

```sh
dsh plugin --profile <profile> add /absolute/path/to/dsh-your-balance
```

也可以在 DSH Plugin Manager 中把目录作为 bundle 安装。

安装后刷新 Web 页面，打开 **设置 → AI查余额**。

### 运行要求

- DeepSeek Harness `0.2.1-rc.2`（已测试），需要 Web app 和 `deepseekAccount` 服务。
- Node.js `^22.19.0 || >=24.0.0`。
- 已登录 DeepSeek 账号才能读取真实余额。仅使用 API Key 的配置仍然可以安装插件，但余额会显示为不可用。

## 配置

在 **设置 → AI查余额** 中：

- **自动注入余额**：开关。关闭后工具仍然可用，但不再添加快照或策略提示词。
- **较低余额阈值**：CNY / USD / EUR。
- **严重不足阈值**：CNY / USD / EUR。
- **汇率联动换算**：开启后，修改任一币种会按内置参考汇率自动换算另外两种。
- **余额预览**：充值 / 赠送钱包、主币种合计、当前状态。

默认阈值：

| 状态 | CNY | USD | EUR |
|---|---:|---:|---:|
| 较低 | 1.50 | 0.25 | 0.20 |
| 严重不足 | 0.25 | 0.05 | 0.045 |

内置参考汇率：`1 USD = 7.2 CNY`，`1 EUR = 8.4 CNY`。插件按“折合价值最高的钱包币种”选出主币种，再用该币种的阈值判断状态。

配置保存在：

```text
$DSH_HOME/your-balance/config.json
```

未设置 `DSH_HOME` 时使用 `~/.dsh`。写入采用临时文件 + rename 的原子替换。

## 数据与安全

- 余额通过 Host 的 DeepSeek 账号服务读取；插件不会索取或保存账号 token。
- 配置路由只接受 loopback Host、同源浏览器请求，以及带 `x-dsh-your-balance: 1` 头的写请求。
- 仓库中不包含凭据、账号 ID 或余额数据。
- 插件不访问第三方网络；参考汇率为内置常量。

## 限制

- 目前 DeepSeek 平台账户接口只提供 CNY / USD 钱包。EUR 阈值可用于换算和展示，未来出现 EUR 钱包时会自动参与判断。
- 策略是模型提示，不是硬性预算拦截。模型仍然可能不遵守；工具和快照的作用是让正确行为明确可见。
- 自动注入快照缓存 10 秒；`check_balance` 工具总是实时查询。
- 自动注入会增加每个步骤的 token；如果上下文成本大于收益，可以关闭。
- 本插件与 DeepSeek 官方无隶属或背书关系。

## 开发

```sh
node --check index.js
node --check client.js
node --check lib/balance.js
node --check lib/config.js
node test/config.test.mjs
```

测试使用 Node 内置测试运行器。某些 Windows 沙箱环境下 `node --test` 无法派生子进程，但直接运行测试文件可以通过。

## 作者与来源

- **发布者与维护者**：[LzdqesjG](https://github.com/LzdqesjG)
- **实现与文档**：一名运行在 DeepSeek Harness 中、使用 `deepseek-flash` 模型的 AI 编程代理，于 2026-10-24 根据 LzdqesjG 的需求完成。
- **AI 生成项目**：代码、README 和图标由该代理生成。在敏感环境部署前请审查源码。

English documentation: [README.md](README.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。
