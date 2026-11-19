# QuantLab · 多市场个人量化学习与投研工作台

面向零基础起步并可长期扩展的**多市场个人量化学习与投研工作台**，采用模块化多市场架构（**A 股 / 美股 / 港股与全球跨市场**，并可继续扩展期货与 Crypto），与 Google Colab Pro+ GPU 及 Google Drive 无缝联动。

- **在线地址**：https://junhaols.github.io/a-share-quant-workbench/

## 核心架构与模块

- **全局市场切换栏（`src/markets.js`）**：一键在 **A 股（RMB · 100 股 · T+1/T+0）**、**美股（USD · 1 股 · T+0）**、**港股与全球（HKD）** 之间切换，手数、货币、佣金模型、基准标的与数据源自动适配。
- **1. 多市场总览**：各市场进度与真实回测快照卡片、Colab Pro+ GPU 算力状态、A 股/美股/港股规则对照表。
- **2. 每日行情与 AI 简报**：展示 A 股/美股盘后 ETF 最新涨跌幅、20 日动量排名、波动率与避险参考信号，并沉淀每日盘后 AI 投研风控简报（近 30 天归档）。
- **3. 回测与 Walk-Forward 实验室**：实时交互沙盒 + 42 组参数高原热力图 + 3 年→1 年 Walk-Forward 滚动样本外验证（含 WFE 效率诊断）+ 调仓日偏移与滑点压力测试。
- **4. 成长路线与知识笔记**：4 阶段跨市场量化成长清单、核心概念速查与 Markdown 学习笔记沉淀。
- **5. 多市场模拟盘日志**：按市场独立记账与持仓统计，自动套用对应市场最小手数与佣金规则，支持导出 CSV。
- **6. 标的档案与开源生态库**：分市场维护自选标的池，沉淀跨市场开源量化项目。
- **右上角「AI 量化助手」（BYOK 本地安全模式）**：默认预置 `deepseek-flash`，API Key 仅保存在本机浏览器 `localStorage`，支持一键带入当前回测、Walk-Forward、每日行情与模拟盘上下文做复盘诊断。

## 安全配置每日盘后 AI 自动简报（GitHub Actions）

仓库内置 `.github/workflows/daily-quant-update.yml`，在每个交易日 A 股收盘后（15:35 CST）与美股收盘后（次日 05:30 CST）自动拉取行情并刷新网页。如需启用 `deepseek-flash` 自动生成每日简报：

1. 打开仓库 **Settings → Secrets and variables → Actions**；
2. 在 **Repository secrets** 新增：
   - `LLM_API_KEY`：填入你本机 `.env` 中的 API Key（切勿提交到代码仓库）；
   - `LLM_BASE_URL`（可选）：若使用兼容中转接口，填入你的 Base URL（默认为 `https://api.deepseek.com/v1`）；
3. 在 **Variables** 可选设置 `LLM_MODEL`（默认已设为 `deepseek-flash`）。
4. 到 **Actions → Daily Post-Market Data & AI Quant Brief** 点 **Run workflow** 即可立即验证。

## 已同步的数据 (`data/`)

- `data/daily_snapshot.json` & `data/ai_brief_history.json` — 每日盘后多市场行情快照与近 30 天 AI 简报历史
- `data/latest_lesson01_summary.json` — A 股第 1 课真实回测体检指标（2018-01-02 ~ 2026-11-18）
- `data/real_etf_daily.json` — 7 只 A 股核心 ETF 真实前复权日线（供网页沙盒与 Walk-Forward 实时计算）
- `data/lesson01_strategies_comparison.png` — Colab 原生高清净值与回撤对比图

后续拓展美股或港股时，只需将对应 Colab 产出的 `real_us_etf_daily.json` / `latest_us_summary.json` 放入 `data/` 并推送 `main`，GitHub Actions 会自动重新部署上线。

> 免责声明：本项目仅用于金融量化编程与数据分析学习，所有策略与模拟记录均不构成投资建议。
