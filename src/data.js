export const STORAGE_KEY = "antigravity_quant_workbench_v1";

export const DEFAULT_ROADMAP = [
  { id: "s1_1", stage: "第 1 阶段 · 市场规则与指标", text: "理解 ETF 与个股差异（免印花税、无个股退市风险、100 股门槛）", done: false },
  { id: "s1_2", stage: "第 1 阶段 · 市场规则与指标", text: "掌握 4 大体检指标：年化收益、最大回撤、夏普比率、费用占比", done: false },
  { id: "s1_3", stage: "第 1 阶段 · 市场规则与指标", text: "搞懂前复权 / 后复权与东方财富单笔最低 5 元佣金规则", done: false },
  { id: "s2_1", stage: "第 2 阶段 · 白盒策略实战", text: "在 Colab 跑通第 1 课 Notebook 并拉取 7 只 ETF 真实日线缓存到 Drive", done: false },
  { id: "s2_2", stage: "第 2 阶段 · 白盒策略实战", text: "对比「买入持有 vs 全天候平衡 vs 动量轮动」的收益与回撤曲线", done: false },
  { id: "s2_3", stage: "第 2 阶段 · 白盒策略实战", text: "把 Colab 生成的 lesson01_summary.json 导入本网页复盘", done: false },
  { id: "s3_1", stage: "第 3 阶段 · 避坑与防过拟合", text: "亲手开关「未来函数」验证 T 日收盘成交带来的虚假收益", done: false },
  { id: "s3_2", stage: "第 3 阶段 · 避坑与防过拟合", text: "对比 2 日高频调仓与 20 日月频调仓的小资金手续费损耗", done: false },
  { id: "s3_3", stage: "第 3 阶段 · 避坑与防过拟合", text: "学习样本外滚动验证（Walk-Forward）避免参数过度拟合", done: false },
  { id: "s4_1", stage: "第 4 阶段 · AI 进阶与模拟跟踪", text: "在东方财富开启至少 1–3 个月模拟盘，每周记录调仓与心态", done: false },
  { id: "s4_2", stage: "第 4 阶段 · AI 进阶与模拟跟踪", text: "启用 Colab Pro+ L4/A100 跑 Microsoft Qlib / LightGBM 多因子基线", done: false },
  { id: "s4_3", stage: "第 4 阶段 · AI 进阶与模拟跟踪", text: "沉淀个人策略手册与风控止损纪律，形成长期可复用研究库", done: false },
];

export const DEFAULT_ETFS = [
  { code: "510300", name: "沪深300ETF", cat: "A股宽基", t0: "T+1", lotHint: "~400元/手", role: "A股核心大盘蓝筹基准" },
  { code: "510500", name: "中证500ETF", cat: "A股宽基", t0: "T+1", lotHint: "~600元/手", role: "中盘成长与弹性代表" },
  { code: "159915", name: "创业板ETF", cat: "A股成长", t0: "T+1", lotHint: "~250元/手", role: "高波动成长科技进攻端" },
  { code: "510880", name: "红利ETF", cat: "A股防御", t0: "T+1", lotHint: "~320元/手", role: "高股息价值风格压舱石" },
  { code: "518880", name: "黄金ETF", cat: "大宗商品", t0: "T+0", lotHint: "~600元/手", role: "抗通胀与地缘避险资产" },
  { code: "513100", name: "纳指ETF", cat: "跨境美股", t0: "T+0", lotHint: "~160元/手", role: "全球科技分散（注意溢价率）" },
  { code: "511010", name: "国债ETF", cat: "利率债券", t0: "T+0", lotHint: "~14,100元/手", role: "5年期国债避险低波资产" },
];

export const DEFAULT_RESOURCES = [
  { name: "Microsoft Qlib", cat: "AI 量化平台", desc: "微软开源 AI 量化基础设施，内置 Alpha158 因子、LightGBM/深度时序模型与回测，契合 Colab GPU。" },
  { name: "NautilusTrader", cat: "现代回测引擎", desc: "Rust 核心 + Python 接口，回测与实盘同代码架构，性能与工程质量极高。" },
  { name: "VectorBT", cat: "向量化回测", desc: "基于 NumPy/Numba 的高速参数扫描库，适合快速验证 ETF 轮动与规则策略。" },
  { name: "AKShare / BaoStock", cat: "A股免费数据", desc: "零成本拉取 A 股复权日线、ETF 行情、财报与宏观指标的必备 Python 数据库。" },
  { name: "VeighNa (vn.py)", cat: "国内实盘框架", desc: "国内最成熟的开源实盘交易框架，支持合规券商接口（QMT/CTP）与多策略管理。" },
  { name: "QuantStats / Alphalens", cat: "绩效与因子分析", desc: "一键生成专业夏普/回撤/月度收益热力图，以及单因子 IC/IR 分层检验。" },
];

export const DEFAULT_NOTES = [
  {
    id: "n_init_1",
    date: "2026-11-19",
    tag: "避坑记录",
    title: "关于未来函数的核心理解",
    body: "未来函数不是预测未来的工具，而是回测偷看答案的 Bug。决策时刻只能使用当时已经公开的数据，成交必须晚于信号（T日收盘信号 -> T+1日开盘成交）。",
  },
];

export const DEFAULT_TRADES = [
  {
    id: "t_demo_1",
    date: "2026-11-03",
    code: "518880",
    name: "黄金ETF",
    side: "BUY",
    price: 6.12,
    qty: 6000,
    commission: 9.18,
    note: "【示例记录】月度动量排名前2，按计划模拟建仓约 45% 仓位（可随时清空开始你的记录）",
  },
  {
    id: "t_demo_2",
    date: "2026-11-03",
    code: "513100",
    name: "纳指ETF",
    side: "BUY",
    price: 1.68,
    qty: 20000,
    commission: 8.40,
    note: "【示例记录】月度动量排名前2，跨境资产分散风险",
  },
];

/**
 * Deterministic multi-regime 2018-2026 calibrated ETF series for interactive sandbox learning.
 */
export function generateCalibratedMarket() {
  let seed = 20180102;
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
    if (dow !== 0 && dow !== 6) {
      dates.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }

  const yearlyDrifts = {
    "510300": [-0.24, 0.34, 0.25, -0.05, -0.21, -0.11, 0.16, 0.11],
    "510500": [-0.30, 0.26, 0.21, 0.14, -0.20, -0.07, 0.10, 0.14],
    "159915": [-0.28, 0.42, 0.58, 0.12, -0.29, -0.18, 0.18, 0.15],
    "510880": [-0.14, 0.15, 0.04, 0.16, -0.02, 0.08, 0.16, 0.09],
    "518880": [0.04, 0.19, 0.14, -0.04, 0.09, 0.16, 0.27, 0.18],
    "513100": [0.02, 0.37, 0.36, 0.24, -0.27, 0.48, 0.26, 0.14],
    "511010": [0.06, 0.04, 0.03, 0.04, 0.03, 0.04, 0.06, 0.03],
  };
  const vols = {
    "510300": 0.19, "510500": 0.23, "159915": 0.28, "510880": 0.15,
    "518880": 0.13, "513100": 0.22, "511010": 0.022,
  };
  const initPx = {
    "510300": 4.05, "510500": 6.10, "159915": 1.75, "510880": 2.45,
    "518880": 2.75, "513100": 0.65, "511010": 112.0,
  };
  const codes = Object.keys(initPx);
  const close = {};
  const open = {};
  codes.forEach((c) => {
    close[c] = new Float64Array(nDays);
    open[c] = new Float64Array(nDays);
  });

  const px = { ...initPx };
  for (let i = 0; i < nDays; i++) {
    const yrIdx = Math.min(7, Math.floor(i / 244));
    const zChina = randn();
    const zGlobal = randn();
    const zSafe = randn();
    for (const c of codes) {
      const mu = yearlyDrifts[c][yrIdx] / 244;
      const sig = vols[c] / Math.sqrt(244);
      let factor = 0;
      if (c === "510300" || c === "510500" || c === "159915") factor = 0.78 * zChina + 0.62 * randn();
      else if (c === "510880") factor = 0.58 * zChina + 0.81 * randn();
      else if (c === "513100") factor = 0.20 * zChina + 0.72 * zGlobal + 0.66 * randn();
      else if (c === "518880") factor = -0.15 * zChina + 0.55 * zSafe + 0.82 * randn();
      else factor = -0.25 * zChina + 0.60 * zSafe + 0.76 * randn();

      const gap = randn() * sig * 0.35;
      const o = Math.max(0.1, px[c] * (1 + gap));
      const ret = mu + sig * factor;
      const cl = Math.max(0.1, px[c] * Math.exp(ret - 0.5 * sig * sig));
      open[c][i] = o;
      close[c][i] = cl;
      px[c] = cl;
    }
  }
  return { dates, codes, open, close };
}
