import { MARKETS } from "./markets.js";

export const STORAGE_KEY = "quantlab_universal_v2";
export const LEGACY_STORAGE_KEY = "antigravity_quant_workbench_v1";

export const DEFAULT_ROADMAP = [
  { id: "s1_1", stage: "第 1 阶段 · 市场规则与量化地基", market: "通用", text: "理解 ETF 与个股差异（免印花税/分散风险/流动性）以及不同市场规则（A股 T+1 vs 美股 T+0）", done: false },
  { id: "s1_2", stage: "第 1 阶段 · 市场规则与量化地基", market: "通用", text: "掌握 4 大策略体检指标：年化收益 (CAGR)、最大回撤 (MaxDD)、夏普比率、费用占比", done: false },
  { id: "s1_3", stage: "第 1 阶段 · 市场规则与量化地基", market: "A股", text: "搞懂前复权 / 后复权、100 股整手规则与东方财富单笔最低 5 元佣金影响", done: false },
  { id: "s2_1", stage: "第 2 阶段 · 白盒策略与真实数据闭环", market: "A股", text: "在 Colab 跑通第 1 课 Notebook，拉取 7 只 A 股核心 ETF 真实日线并同步到本工作台", done: true },
  { id: "s2_2", stage: "第 2 阶段 · 白盒策略与真实数据闭环", market: "A股", text: "对比真实回测中「沪深300持有 vs 全天候平衡 vs 月度动量轮动」的收益与回撤表现", done: false },
  { id: "s2_3", stage: "第 2 阶段 · 白盒策略与真实数据闭环", market: "美股", text: "拓展至美股 ETF 池（SPY / QQQ / GLD / TLT / SHY），对比跨市场相关性与无涨跌停特征", done: false },
  { id: "s3_1", stage: "第 3 阶段 · 避坑与防过拟合实验", market: "通用", text: "亲手开关「未来函数」验证 T 日收盘成交带来的回测偏差", done: false },
  { id: "s3_2", stage: "第 3 阶段 · 避坑与防过拟合实验", market: "A股", text: "复盘真实回测「陷阱 B」：理解每 2 日高频调仓如何产生占本金 65% 的手续费+滑点", done: false },
  { id: "s3_3", stage: "第 3 阶段 · 避坑与防过拟合实验", market: "通用", text: "掌握 Walk-Forward 样本外滚动验证，识别参数过度拟合的假策略", done: false },
  { id: "s4_1", stage: "第 4 阶段 · AI 量化进阶与模拟实盘", market: "A股", text: "在东方财富坚持 1–3 个月低频模拟跟踪，记录每笔调仓信号与心态复盘", done: false },
  { id: "s4_2", stage: "第 4 阶段 · AI 量化进阶与模拟实盘", market: "通用", text: "利用已联调成功的 Colab Pro+ GPU (L4/A100/G4) 运行 Microsoft Qlib / LightGBM 多因子实验", done: false },
  { id: "s4_3", stage: "第 4 阶段 · AI 量化进阶与模拟实盘", market: "美股", text: "探索跨市场组合（A 股 + 美股 + 黄金 + 债券）与 LLM 财报/研报情绪因子提取", done: false },
  { id: "s5_1", stage: "第 5 阶段 · 大模型量化实战", market: "通用", text: "读懂本站盘后简报链路：数字由代码计算，大模型只负责结构化解读，失败自动回退规则引擎", done: false },
  { id: "s5_2", stage: "第 5 阶段 · 大模型量化实战", market: "A股", text: "用提示词实验室把 50 条新闻/公告打成 JSON 情绪分，检验它与次日 (T+1) 收益的相关性", done: false },
  { id: "s5_3", stage: "第 5 阶段 · 大模型量化实战", market: "通用", text: "只在模型知识截止日之后的数据上评测 LLM 信号，并与“不用 LLM”的基线对比", done: false },
  { id: "s5_4", stage: "第 5 阶段 · 大模型量化实战", market: "通用", text: "在 Colab 跑通 RD-Agent 或 TradingAgents 的官方示例，记录成本、耗时与可复现性", done: false },
];

export const LLM_EVAL_CHECKLIST = [
  { id: "e1", text: "评测区间全部晚于模型的训练数据截止日（否则等同于未来函数）" },
  { id: "e2", text: "输入里隐去或替换标的名称与具体日期，防止模型“认出”历史行情" },
  { id: "e3", text: "文本按发布时间对齐，信号在 T 日生成，最早 T+1 开盘成交" },
  { id: "e4", text: "固定模型版本、temperature ≤ 0.2，并记录提示词版本与输入哈希" },
  { id: "e5", text: "输出强制 JSON Schema，解析失败的样本计入统计而不是丢弃" },
  { id: "e6", text: "同一输入采样 3 次以上，报告结果的一致性" },
  { id: "e7", text: "提示词只在训练段调整，样本外段只跑一次（提示词也会过拟合）" },
  { id: "e8", text: "与不用 LLM 的规则/因子基线对比，并扣除 API 成本与交易成本" },
];

export const DEFAULT_RESOURCES = [
  // ---- 大模型量化 ----
  { group: "llm", name: "Microsoft RD-Agent", cat: "LLM 因子研发 Agent", markets: "A股 / 美股", url: "https://github.com/microsoft/RD-Agent", desc: "让大模型自动提出因子与模型假设、写代码、在 Qlib 上回测并迭代，是“LLM 做研发而不是直接预测”的代表。" },
  { group: "llm", name: "TradingAgents", cat: "LLM 多智能体", markets: "美股为主", url: "https://github.com/TauricResearch/TradingAgents", desc: "模拟基本面/情绪/技术分析师、多空研究员辩论与风控经理的多智能体交易框架，适合学习投研流程的分工。" },
  { group: "llm", name: "AI Hedge Fund", cat: "LLM 多智能体", markets: "美股", url: "https://github.com/virattt/ai-hedge-fund", desc: "以多位“投资风格”智能体 + 风控 + 组合经理组成的教学型项目，代码短小，适合读懂多 Agent 编排。" },
  { group: "llm", name: "FinGPT", cat: "金融大模型", markets: "全市场", url: "https://github.com/AI4Finance-Foundation/FinGPT", desc: "开源金融大模型与微调方案，覆盖新闻情绪分类、金融问答等任务，可作为文本情绪因子的基线。" },
  { group: "llm", name: "FinRobot", cat: "LLM 投研 Agent", markets: "美股 / 全球", url: "https://github.com/AI4Finance-Foundation/FinRobot", desc: "面向财报分析、研报生成的金融 Agent 平台，示范如何把数据工具调用与 LLM 推理串成工作流。" },
  { group: "llm", name: "Kronos", cat: "金融时序基础模型", markets: "全市场", url: "https://github.com/shiyu-coder/Kronos", desc: "在多市场 K 线上预训练的金融时序基础模型，可做预测或特征提取；需严格样本外检验，警惕预训练数据覆盖测试期。" },
  { group: "llm", name: "TimesFM / Chronos", cat: "通用时序基础模型", markets: "全市场", url: "https://github.com/google-research/timesfm", links: [{ label: "Chronos", url: "https://github.com/amazon-science/chronos-forecasting" }], desc: "Google 与 Amazon 开源的零样本时序预测模型，可作为波动率或成交量预测的对照基线，不宜直接用来猜涨跌。" },
  { group: "llm", name: "FinRL", cat: "强化学习交易", markets: "全市场", url: "https://github.com/AI4Finance-Foundation/FinRL", desc: "金融强化学习框架，常与 LLM 情绪信号组合做仓位决策实验，适合进阶对照。" },
  { group: "llm", name: "OpenBB", cat: "开放投研平台", markets: "美股 / 全球", url: "https://github.com/OpenBB-finance/OpenBB", desc: "开源投研数据平台，统一接入多家数据源，并提供给 AI Agent 调用的数据接口。" },
  // ---- 平台、回测与实盘 ----
  { group: "engine", name: "Microsoft Qlib", cat: "AI 量化平台", markets: "A股 / 美股", url: "https://github.com/microsoft/qlib", desc: "微软开源 AI 量化基础设施，内置 Alpha158 因子、LightGBM/深度时序模型与回测，契合 Colab GPU。" },
  { group: "engine", name: "NautilusTrader", cat: "现代回测引擎", markets: "全市场", url: "https://github.com/nautechsystems/nautilus_trader", desc: "Rust 核心 + Python 接口，回测与实盘同代码架构，支持股票、期货、外汇与 Crypto。" },
  { group: "engine", name: "VectorBT", cat: "向量化回测", markets: "全市场", url: "https://github.com/polakowo/vectorbt", desc: "基于 NumPy/Numba 的高速参数扫描库，适合快速验证多市场 ETF 轮动与规则策略。" },
  { group: "engine", name: "VeighNa (vn.py)", cat: "实盘交易框架", markets: "A股 / 国内期货", url: "https://github.com/vnpy/vnpy", desc: "国内最成熟的开源实盘交易框架，支持合规券商接口（QMT/CTP）与多策略管理。" },
  { group: "engine", name: "QuantConnect LEAN", cat: "机构级引擎", markets: "美股 / 期权 / 期货", url: "https://github.com/QuantConnect/Lean", desc: "开源多资产量化引擎，支持 Python 策略与美股/期权/外汇精细建模。" },
  { group: "engine", name: "QuantStats / Alphalens", cat: "绩效与因子分析", markets: "全市场", url: "https://github.com/ranaroussi/quantstats", links: [{ label: "Alphalens", url: "https://github.com/stefan-jansen/alphalens-reloaded" }], desc: "一键生成专业夏普/回撤/月度收益热力图，以及单因子 IC/IR 分层检验。" },
  { group: "engine", name: "Freqtrade / CCXT", cat: "扩展生态", markets: "Crypto 7×24h", url: "https://github.com/freqtrade/freqtrade", links: [{ label: "CCXT", url: "https://github.com/ccxt/ccxt" }], desc: "若未来扩展到加密货币策略，CCXT 与 Freqtrade 是最成熟的开源行情与自动化框架。" },
  // ---- 数据源 ----
  { group: "data", name: "AKShare / BaoStock", cat: "免费数据源", markets: "A股 / 港股 / 宏观", url: "https://github.com/akfamily/akshare", links: [{ label: "BaoStock", url: "http://baostock.com" }], desc: "零成本拉取 A 股复权日线、ETF 行情、财报与宏观指标的必备 Python 数据库。" },
  { group: "data", name: "yfinance / FRED", cat: "免费数据源", markets: "美股 / 全球", url: "https://github.com/ranaroussi/yfinance", links: [{ label: "FRED", url: "https://fred.stlouisfed.org" }], desc: "拉取美股/港股/全球 ETF 历史行情与美联储利率、CPI 等宏观经济序列。" },
  { group: "data", name: "Tushare Pro", cat: "进阶数据源", markets: "A股 / 港股 / 期货", url: "https://tushare.pro", desc: "积分制的 A 股结构化数据服务，财务、公告、资金流等字段更完整，适合给 LLM 提供干净的结构化输入。" },
];

export const DEFAULT_NOTES = [
  {
    id: "n_init_1",
    date: "2026-11-19",
    market: "A股",
    tag: "回测复盘",
    title: "A股第1课真实回测关键发现 (2018–2026)",
    body: "1) 单持沪深300（S1）8年年化仅 +1.56%，最大回撤高达 -41.98%；\n2) 股债金全天候（S2）年化 +6.82%，最大回撤压缩至 -9.39%，夏普 0.60，总费用仅占本金 1.02%，非常稳健；\n3) 陷阱B每2日调仓产生 2,099 笔交易，佣金+滑点高达 ¥52,183（占初始8万本金的 65.23%），说明小资金高频换手磨损极其惊人。",
  },
  {
    id: "n_init_2",
    date: "2026-11-19",
    market: "通用",
    tag: "避坑记录",
    title: "关于未来函数（Look-ahead Bias）的铁律",
    body: "未来函数不是预测未来的工具，而是回测偷看答案的 Bug。决策时刻只能使用当时已经公开的数据，成交必须晚于信号（T日收盘信号 -> T+1日开盘成交）。",
  },
];

export const DEFAULT_TRADES_BY_MARKET = {
  cn: [
    {
      id: "t_cn_demo_1",
      date: "2026-11-03",
      code: "518880",
      name: "黄金ETF",
      side: "BUY",
      price: 7.989,
      qty: 4500,
      commission: 8.99,
      note: "【示例记录】A股月度动量排名前2，模拟建仓约 45% 仓位（可随时清空开始你的记录）",
    },
    {
      id: "t_cn_demo_2",
      date: "2026-11-03",
      code: "513100",
      name: "纳指ETF",
      side: "BUY",
      price: 2.197,
      qty: 15000,
      commission: 8.24,
      note: "【示例记录】A股跨境配置，分散单一市场波动",
    },
  ],
  us: [
    {
      id: "t_us_demo_1",
      date: "2026-11-03",
      code: "SPY",
      name: "标普500 ETF",
      side: "BUY",
      price: 754.35,
      qty: 8,
      commission: 1.0,
      note: "【示例记录】美股最小可买 1 股，模拟建立核心大盘底仓",
    },
  ],
  global: [],
};

export function createInitialMarketStates() {
  const byMarket = {};
  for (const [id, cfg] of Object.entries(MARKETS)) {
    byMarket[id] = {
      etfs: structuredClone(cfg.defaultEtfs),
      trades: structuredClone(DEFAULT_TRADES_BY_MARKET[id] || []),
      journalCapital: cfg.defaultCash,
      colabReport: null,
    };
  }
  return byMarket;
}

/**
 * Deterministic multi-regime 2018-2026 calibrated fallback series for any configured market.
 */
export function generateCalibratedMarket(marketCfg) {
  const profile = marketCfg.simProfile;
  let seed = profile.seed || 20180102;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randn = () => {
    const u = Math.max(1e-9, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const nDays = 1950;
  const dates = [];
  const cur = new Date(2018, 0, 2);
  while (dates.length < nDays) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  const codes = Object.keys(profile.initPx);
  const close = {};
  const open = {};
  codes.forEach((c) => {
    close[c] = new Float64Array(nDays);
    open[c] = new Float64Array(nDays);
  });

  const px = { ...profile.initPx };
  for (let i = 0; i < nDays; i++) {
    const yrIdx = Math.min(7, Math.floor(i / 244));
    const zEq = randn();
    const zSafe = randn();
    for (const c of codes) {
      const mu = profile.yearlyDrifts[c][yrIdx] / 244;
      const sig = profile.vols[c] / Math.sqrt(244);
      const isSafe = c === marketCfg.safeCode || c === "TLT" || c === "518880" || c === "GLD" || c === "2840.HK";
      const factor = isSafe
        ? -0.2 * zEq + 0.58 * zSafe + 0.79 * randn()
        : 0.74 * zEq + 0.67 * randn();

      const gap = randn() * sig * 0.3;
      const o = Math.max(0.1, px[c] * (1 + gap));
      const ret = mu + sig * factor;
      const cl = Math.max(0.1, px[c] * Math.exp(ret - 0.5 * sig * sig));
      open[c][i] = o;
      close[c][i] = cl;
      px[c] = cl;
    }
  }
  return { dates, codes, open, close, isReal: false };
}
