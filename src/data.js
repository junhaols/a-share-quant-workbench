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
];

export const DEFAULT_RESOURCES = [
  { name: "Microsoft Qlib", cat: "AI 量化平台", markets: "A股 / 美股", desc: "微软开源 AI 量化基础设施，内置 Alpha158 因子、LightGBM/深度时序模型与回测，契合 Colab GPU。" },
  { name: "NautilusTrader", cat: "现代回测引擎", markets: "全市场", desc: "Rust 核心 + Python 接口，回测与实盘同代码架构，支持股票、期货、外汇与 Crypto。" },
  { name: "VectorBT", cat: "向量化回测", markets: "全市场", desc: "基于 NumPy/Numba 的高速参数扫描库，适合快速验证多市场 ETF 轮动与规则策略。" },
  { name: "AKShare / BaoStock", cat: "免费数据源", markets: "A股 / 港股 / 宏观", desc: "零成本拉取 A 股复权日线、ETF 行情、财报与宏观指标的必备 Python 数据库。" },
  { name: "yfinance / FRED", cat: "免费数据源", markets: "美股 / 全球", desc: "拉取美股/港股/全球 ETF 历史行情与美联储利率、CPI 等宏观经济序列。" },
  { name: "VeighNa (vn.py)", cat: "实盘交易框架", markets: "A股 / 国内期货", desc: "国内最成熟的开源实盘交易框架，支持合规券商接口（QMT/CTP）与多策略管理。" },
  { name: "QuantConnect LEAN", cat: "机构级引擎", markets: "美股 / 期权 / 期货", desc: "开源多资产量化引擎，支持 Python 策略与美股/期权/外汇精细建模。" },
  { name: "QuantStats / Alphalens", cat: "绩效与因子分析", markets: "全市场", desc: "一键生成专业夏普/回撤/月度收益热力图，以及单因子 IC/IR 分层检验。" },
  { name: "Freqtrade / CCXT", cat: "扩展生态", markets: "Crypto 7×24h", desc: "若未来扩展到加密货币策略，CCXT 与 Freqtrade 是最成熟的开源行情与自动化框架。" },
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
      price: 6.12,
      qty: 6000,
      commission: 9.18,
      note: "【示例记录】A股月度动量排名前2，模拟建仓约 45% 仓位（可随时清空开始你的记录）",
    },
    {
      id: "t_cn_demo_2",
      date: "2026-11-03",
      code: "513100",
      name: "纳指ETF",
      side: "BUY",
      price: 1.68,
      qty: 20000,
      commission: 8.40,
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
      price: 585.0,
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
