# QuantLab · 多市场个人量化学习与投研工作台

面向零基础起步并可长期扩展的**多市场个人量化学习与投研工作台**，采用模块化多市场架构（**A 股 / 美股 / 港股与全球跨市场**，并可继续扩展期货与 Crypto），与 Google Colab Pro+ GPU 及 Google Drive 无缝联动。

- **在线地址**：https://junhaols.github.io/a-share-quant-workbench/

## 核心架构与模块

- **全局市场切换栏（`src/markets.js`）**：一键在 **A 股（RMB · 100 股 · T+1/T+0）**、**美股（USD · 1 股 · T+0）**、**港股与全球（HKD）** 之间切换，手数、货币、佣金模型、基准标的与数据源自动适配。
- **1. 多市场总览**：各市场进度与真实回测快照卡片、Colab Pro+ GPU 算力状态、A 股/美股/港股规则对照表。
- **2. 通用回测与避坑沙盒**：实时调节资金、调仓周期、佣金与最低门槛、以及「未来函数」作弊开关；支持自动加载 Colab 真实历史日线（当前 A 股已同步 `2018-01-02 ~ 2026-11-18` 共 2,151 个真实交易日）与高清回测对比图。
- **3. 成长路线与知识笔记**：4 阶段跨市场量化成长清单、核心概念速查与 Markdown 学习笔记沉淀。
- **4. 多市场模拟盘日志**：按市场独立记账与持仓统计，自动套用对应市场最小手数与佣金规则，支持导出 CSV。
- **5. 标的档案与开源生态库**：分市场维护自选标的池，沉淀跨市场开源量化项目（Qlib、NautilusTrader、VectorBT、AKShare、yfinance、vn.py、LEAN、Freqtrade）。

## 已同步的 Colab 真实数据 (`data/`)

- `data/latest_lesson01_summary.json` — A 股第 1 课真实回测体检指标（2018-01-02 ~ 2026-11-18）
- `data/real_etf_daily.json` — 7 只 A 股核心 ETF 真实前复权日线（供网页沙盒直接实时重算）
- `data/lesson01_strategies_comparison.png` — Colab 原生高清净值与回撤对比图

后续拓展美股或港股时，只需将对应 Colab 产出的 `real_us_etf_daily.json` / `latest_us_summary.json` 放入 `data/` 并推送 `main`，GitHub Actions 会自动重新部署上线。

> 免责声明：本项目仅用于金融量化编程与数据分析学习，所有策略与模拟记录均不构成投资建议。
