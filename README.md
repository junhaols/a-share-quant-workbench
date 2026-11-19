# A 股量化学习与投研工作台 (QuantLab)

面向零基础起步（10 万以内资金、东方财富 + Google Colab + Google Drive）的个人金融量化学习与投研网页工作台。零外部 CDN 依赖、纯原生 HTML/CSS/ES Modules，秒级加载，支持深色/浅色主题切换。

## 核心模块

1. **回测与避坑沙盒**：实时调节初始资金（2万–10万）、调仓周期（2/5/20/60 交易日）、佣金与最低 5 元门槛、以及「未来函数」作弊开关，内置 3 个经典白盒 ETF 策略对比与交互式净值/回撤图表。
2. **学习路线与知识笔记**：4 阶段 12 项可勾选学习进度、A 股规则与指标速查、个人笔记沉淀（支持导出 Markdown）。
3. **东方财富模拟盘日志**：记录模拟买卖单、自动计算 100 股整数倍与最低 5 元佣金、实时汇总持仓与现金，支持导出 CSV。
4. **ETF 档案与开源资料库**：维护个人关注的 ETF 标的池与开源项目/数据源收藏，支持全站 JSON 一键备份与恢复。

## 与 Colab 第 1 课联动

在 Colab 运行 `Quant_Lesson01_A_Share_ETF_Basics.ipynb` 后，Google Drive 中会生成：
`Antigravity/01_Projects/quant_lab/reports/lesson01_summary.json`

你有两种方式在网页中查看这份真实 A 股回测数据：
- **临时查看**：直接点击网页右上角「导入 Colab 回测 JSON」上传文件；
- **持久沉淀**：将文件复制为本仓库的 `data/latest_lesson01_summary.json` 并提交推送，网页打开时会自动加载展示。

## 本地运行

任意静态服务器均可（因使用 ES Modules，请通过 HTTP 访问而非直接双击 `file://`）：

```bash
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 部署说明（私有仓库）

- **GitHub Pages**（仓库已内置 `.github/workflows/deploy-pages.yml`）：若你的账号为 **GitHub Pro / Team / Enterprise**，推送 `main` 分支后会自动触发 Pages 部署。
- **Vercel / Cloudflare Pages**（免费支持私有 GitHub 仓库，推荐）：
  1. 登录 [Vercel](https://vercel.com/new) 或 Cloudflare Pages，授权并选择私有仓库 `junhaols/a-share-quant-workbench`；
  2. Framework Preset 保持 `Other`（静态站点，无需构建命令），点击 Deploy；
  3. 之后每次向 `main` 推送更新都会自动重新部署。

> 免责声明：本项目仅用于金融量化编程与数据分析学习，所有策略与模拟记录均不构成投资建议。
