// 大模型量化（LLM × Quant）内容：应用分层、陷阱清单与提示词模板。
// 页面渲染逻辑在 app.js 的 renderLlmTab() 中。

export const LLM_LAYERS = [
  {
    id: "L1",
    title: "文本 → 结构化因子",
    maturity: "ready",
    what: "把新闻、公告、研报、社媒文本打成情绪分、事件类型和置信度，按日聚合成可以回测的因子。这是目前最成熟、性价比最高的用法。",
    io: { in: "新闻 / 公告 / 研报文本（带发布时间）", out: "JSON：情绪 -2~2、事件类型、置信度、原文证据" },
    risk: "发布时间对齐、训练期泄漏、因子在样本外快速衰减",
    projects: [{ label: "FinGPT", url: "https://github.com/AI4Finance-Foundation/FinGPT" }],
    practice: [{ type: "template", id: "news", label: "试一试：新闻情绪打分" }],
  },
  {
    id: "L2",
    title: "投研摘要与盘后复盘",
    maturity: "ready",
    what: "代码先算好指标，再让模型写结构化的复盘、风险提示和财报要点。本站的盘后 AI 简报就属于这一层。",
    io: { in: "代码计算的指标 + 财报 / 研报片段", out: "结构化简报、风险提示、待验证问题" },
    risk: "数字幻觉：模型自己算或抄错数字",
    projects: [
      { label: "FinRobot", url: "https://github.com/AI4Finance-Foundation/FinRobot" },
      { label: "OpenBB", url: "https://github.com/OpenBB-finance/OpenBB" },
    ],
    practice: [
      { type: "tab", id: "daily", label: "看本站盘后简报" },
      { type: "template", id: "report", label: "财报要点抽取" },
    ],
  },
  {
    id: "L3",
    title: "因子与策略研发 Agent",
    maturity: "lab",
    what: "让模型提出因子假设、写回测代码、读回测报告再迭代，人负责设定目标和把关。适合在 Colab 上跑，而不是直接产出交易信号。",
    io: { in: "数据集 + 研究目标 + 回测框架", out: "因子假设、代码、回测报告、迭代记录" },
    risk: "数据窥探：生成上百个因子，总有几个“显著”",
    projects: [
      { label: "RD-Agent", url: "https://github.com/microsoft/RD-Agent" },
      { label: "Qlib", url: "https://github.com/microsoft/qlib" },
    ],
    practice: [
      { type: "template", id: "factor", label: "生成因子假设" },
      { type: "template", id: "redteam", label: "回测红队审查" },
    ],
  },
  {
    id: "L4",
    title: "多智能体投研决策",
    maturity: "frontier",
    what: "让基本面、情绪、技术分析师和多空研究员分角色讨论，再由风控与组合经理汇总。很适合学习投研分工，但不适合直接下单。",
    io: { in: "行情 + 新闻 + 基本面", out: "多空论证、风险评估、仓位建议" },
    risk: "调用成本高、结果不可复现、公开回测多落在模型训练期内",
    projects: [
      { label: "TradingAgents", url: "https://github.com/TauricResearch/TradingAgents" },
      { label: "AI Hedge Fund", url: "https://github.com/virattt/ai-hedge-fund" },
    ],
    practice: [{ type: "template", id: "debate", label: "模拟投研委员会" }],
  },
  {
    id: "L5",
    title: "金融时序基础模型",
    maturity: "frontier",
    what: "在海量 K 线上预训练的模型，可以零样本预测收益或波动率分布，也可以输出嵌入特征给传统模型使用。",
    io: { in: "OHLCV 序列", out: "收益 / 波动率分布预测、嵌入特征" },
    risk: "预训练数据可能覆盖测试期；在 A 股 ETF 上的零样本效果需要自己验证",
    projects: [
      { label: "Kronos", url: "https://github.com/shiyu-coder/Kronos" },
      { label: "TimesFM", url: "https://github.com/google-research/timesfm" },
      { label: "Chronos", url: "https://github.com/amazon-science/chronos-forecasting" },
    ],
    practice: [{ type: "tab", id: "sandbox", label: "用 Walk-Forward 做对照" }],
  },
];

export const LLM_PITFALLS = [
  {
    title: "训练期泄漏",
    body: "模型在训练中读过 2018–2024 年的新闻和走势复盘。在这段历史上回测 LLM 信号，等于让它提前看了答案。",
    fix: "只在模型知识截止日之后的数据上评测；输入中隐去标的名称和具体日期。",
  },
  {
    title: "数字幻觉",
    body: "让模型计算收益率、回撤或抄写财报数字，经常出错，而且语气非常肯定。",
    fix: "所有数字由代码计算后传入；输出与源数据逐项核对，本站关键指标卡只用代码结果。",
  },
  {
    title: "时间戳错位",
    body: "用抓取时间代替发布时间，或者拿盘中新闻在当日收盘成交，都会悄悄引入新的未来函数。",
    fix: "按发布时间对齐，T 日生成信号，最早 T+1 开盘成交。",
  },
  {
    title: "结果不可复现",
    body: "同样的输入跑两次结果不同；服务商静默升级模型后，同一个提示词的信号也会变。",
    fix: "固定模型版本，temperature ≤ 0.2，记录提示词版本与输入哈希，多次采样检查一致性。",
  },
  {
    title: "提示词过拟合",
    body: "反复修改提示词直到回测好看，本质上和反复调参数一样，是在拟合历史噪声。",
    fix: "提示词只在训练段调整，样本外段只跑一次，并保留每一版提示词。",
  },
  {
    title: "成本与延迟",
    body: "每天几百条新闻、每条多次调用，用大模型时 API 费用和等待时间会快速累积，可能吃掉小资金相当一部分超额收益。",
    fix: "盘后批处理、缓存结果、先用小模型粗筛，并把 API 成本计入回测。",
  },
  {
    title: "叙事带来的过度自信",
    body: "模型写的理由越流畅，人越容易加仓，而流畅不等于正确。",
    fix: "LLM 只输出评分或信号，仓位上限、止损和再平衡由规则决定。",
  },
];

export const PROMPT_TEMPLATES = [
  {
    id: "news",
    title: "新闻情绪打分 → JSON 因子",
    desc: "把一条新闻或公告变成可回测的结构化情绪信号",
    ctx: "minimal",
    inputLabel: "粘贴新闻或公告原文",
    example:
      "【示例】某公司公告：2026 年前三季度归母净利润同比增长 35%，第三季度单季毛利率环比提升 2.1 个百分点；公司同时宣布拟以 5–10 亿元回购股份，用于员工持股计划。",
    build: ({ market, input }) =>
      `你是一名只做信息抽取的金融文本分析员。请阅读下面这段与${market}相关的新闻或公告，只依据文本本身判断，不要使用你记忆中的后续行情。

只输出如下 JSON，不要输出任何其他内容：
{
  "entities": ["涉及的标的或行业"],
  "event_type": "业绩 | 政策 | 并购重组 | 监管处罚 | 宏观 | 回购增持 | 其他",
  "sentiment": -2 到 2 的整数,
  "confidence": 0 到 1 的小数,
  "horizon": "1d | 1w | 1m",
  "evidence": "原文中最能支撑判断的一句话，逐字摘录",
  "is_new_information": true 或 false
}

规则：
1. 没有明确利好或利空时 sentiment 为 0；
2. evidence 必须逐字来自原文，找不到就填空字符串并把 confidence 设为 0；
3. 已被市场充分预期的旧消息，is_new_information 为 false。

文本：
${input}`,
  },
  {
    id: "report",
    title: "财报 / 研报要点抽取",
    desc: "区分事实与观点，原文没有的数字一律写“未披露”",
    ctx: "minimal",
    inputLabel: "粘贴财报或研报片段",
    example:
      "【示例】报告期内公司实现营业收入 128.6 亿元，同比增长 18.2%；归母净利润 15.3 亿元，同比增长 26.7%。管理层表示海外订单饱满，预计明年产能利用率维持高位，但原材料价格波动仍是主要不确定因素。",
    build: ({ input }) =>
      `请从下面的财报或研报片段中抽取投研要点，按 Markdown 输出：

## 核心数字
列出营收、利润、毛利率等关键数字，每个数字后用括号标注原文出处；原文没有的写“未披露”，不要推算。

## 事实与观点
分两组列出：可验证的事实 / 管理层或作者的判断。

## 可能的预期差
指出可能与市场一致预期存在分歧的地方。

## 待验证问题
列出 3 个后续可以用数据验证的问题，并说明用什么数据验证。

片段：
${input}`,
  },
  {
    id: "factor",
    title: "因子假设生成",
    desc: "基于当前 ETF 池与行情快照提出可检验的低频因子",
    ctx: "daily",
    build: ({ market }) =>
      `请基于上下文 JSON 中${market}的 ETF 池和最新盘后行情快照，提出 3 个只用日线数据就能检验的低频因子假设。每个假设请给出：

1. 经济学直觉：为什么它可能有效；
2. 精确的计算公式：只能使用 T 日及以前的数据；
3. 预期方向，以及它更可能在哪种市场环境下有效；
4. 在 Colab 中用 3 年训练 → 1 年样本外的 Walk-Forward 检验它的步骤；
5. 它最可能失效的原因。

最后说明这 3 个因子之间的相关性风险。不要给出任何买卖建议。`,
  },
  {
    id: "redteam",
    title: "回测红队审查",
    desc: "让模型扮演挑剔的风控审稿人，逐项挑毛病",
    ctx: "backtest",
    build: ({ market }) =>
      `请扮演一名挑剔的量化风控审稿人，对上下文 JSON 中${market}的回测结果与 Walk-Forward 验证结果做红队审查。逐项检查：

- 未来函数与成交时点假设
- 幸存者偏差与标的池选择
- 交易成本、最低佣金与滑点假设
- 参数过拟合：全样本冠军参数与 42 组中位数的差距
- 样本外衰减：WFE 数值说明了什么
- 调仓日运气：起始偏移对结果的影响

每项输出“风险等级（高/中/低）+ 引用的具体数字 + 修正建议”。最后给出结论：这套策略是否值得进入模拟盘，以及进入前还需要补做哪一个实验。`,
  },
  {
    id: "debate",
    title: "模拟投研委员会",
    desc: "多头、空头、风控三方辩论，暴露单一视角的盲点",
    ctx: "daily",
    inputLabel: "要讨论的标的（代码 + 名称）",
    example: "510300 沪深300ETF",
    build: ({ market, input }) =>
      `请模拟一个小型投研委员会，基于上下文 JSON 中${market}的最新行情快照，围绕「${input}」进行一轮讨论：

【多头研究员】给出 3 条看多论据，只能使用已给出的数据。
【空头研究员】逐条反驳，并给出 3 条看空论据。
【风控官】指出波动率、最大回撤和单标的仓位上限。
【主持人结论】在“继续观察 / 小仓位模拟 / 回避”中三选一，并说明理由。

这是学习用的模拟讨论，不构成投资建议；任何上下文中没有的数据请明确标注“需要补充数据”，不要编造。`,
  },
];
