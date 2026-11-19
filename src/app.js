import { MARKETS, MARKET_ORDER } from "./markets.js";
import {
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  DEFAULT_ROADMAP,
  DEFAULT_RESOURCES,
  DEFAULT_NOTES,
  createInitialMarketStates,
  generateCalibratedMarket,
} from "./data.js";
import { runBacktest, buildStrategyWeights } from "./backtest.js";
import { drawLineChart } from "./charts.js";

const THEME_KEY = "antigravity_quant_theme";

// Market series cache: { cn: { dates, codes, open, close, isReal }, us: ..., global: ... }
const marketSeriesCache = {};
let latestResults = [];
let hoverIdx = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[s]));
}

function fmtMoney(val, currency, decimals = 0) {
  const abs = Math.abs(val).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${val < 0 ? "-" : ""}${currency}${abs}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const baseMarkets = createInitialMarketStates();
      for (const id of MARKET_ORDER) {
        if (parsed.markets?.[id]) {
          baseMarkets[id] = {
            ...baseMarkets[id],
            ...parsed.markets[id],
          };
        }
      }
      return {
        activeMarket: MARKETS[parsed.activeMarket] ? parsed.activeMarket : "cn",
        roadmap: parsed.roadmap || structuredClone(DEFAULT_ROADMAP),
        notes: parsed.notes || structuredClone(DEFAULT_NOTES),
        resources: parsed.resources || structuredClone(DEFAULT_RESOURCES),
        markets: baseMarkets,
      };
    }

    // One-time migration from v1 A-share-only storage
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const old = JSON.parse(legacyRaw);
      const baseMarkets = createInitialMarketStates();
      if (Array.isArray(old.etfs)) baseMarkets.cn.etfs = old.etfs;
      if (Array.isArray(old.trades)) baseMarkets.cn.trades = old.trades;
      if (old.journalCapital) baseMarkets.cn.journalCapital = old.journalCapital;
      if (old.colabReport) baseMarkets.cn.colabReport = old.colabReport;
      return {
        activeMarket: "cn",
        roadmap: structuredClone(DEFAULT_ROADMAP),
        notes: Array.isArray(old.notes) && old.notes.length ? old.notes.map((n) => ({ market: "A股", ...n })) : structuredClone(DEFAULT_NOTES),
        resources: structuredClone(DEFAULT_RESOURCES),
        markets: baseMarkets,
      };
    }
  } catch (_) {
    // ignore storage errors
  }

  return {
    activeMarket: "cn",
    roadmap: structuredClone(DEFAULT_ROADMAP),
    notes: structuredClone(DEFAULT_NOTES),
    resources: structuredClone(DEFAULT_RESOURCES),
    markets: createInitialMarketStates(),
  };
}

let state = loadState();
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // ignore quota errors
  }
}

function getActiveCfg() {
  return MARKETS[state.activeMarket] || MARKETS.cn;
}

function getActiveMarketState() {
  return state.markets[state.activeMarket];
}

function getSeriesForMarket(marketId) {
  if (!marketSeriesCache[marketId]) {
    marketSeriesCache[marketId] = generateCalibratedMarket(MARKETS[marketId]);
  }
  return marketSeriesCache[marketId];
}

// =========================================================================
// THEME
// =========================================================================
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));

  document.getElementById("btn-toggle-theme").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  document.getElementById("btn-toggle-theme").textContent = theme === "dark" ? "切换浅色" : "切换深色";
  redrawCharts();
}

// =========================================================================
// GLOBAL MARKET SWITCHER & OVERVIEW
// =========================================================================
function renderMarketSwitcher() {
  const box = document.getElementById("market-switcher");
  box.innerHTML = MARKET_ORDER.map((id) => {
    const cfg = MARKETS[id];
    const series = getSeriesForMarket(id);
    const hasReal = series.isReal || Boolean(state.markets[id].colabReport);
    const dotColor = hasReal ? "var(--success)" : id === "us" ? "var(--primary)" : "var(--muted)";
    return `
      <button type="button" class="market-pill" data-market-id="${id}" aria-pressed="${state.activeMarket === id ? "true" : "false"}">
        <span class="status-dot" style="background:${dotColor}"></span>
        <span>${escapeHtml(cfg.label)}</span>
      </button>`;
  }).join("");

  box.querySelectorAll("[data-market-id]").forEach((btn) => {
    btn.addEventListener("click", () => switchMarket(btn.dataset.marketId));
  });

  const cfg = getActiveCfg();
  document.getElementById("active-market-rule-chip").textContent =
    `${cfg.currencyCode} · 最小单位 ${cfg.lotSize} 股 · ${cfg.stampDutyNote}`;
}

function switchMarket(marketId) {
  if (!MARKETS[marketId]) return;
  state.activeMarket = marketId;
  hoverIdx = null;
  saveState();
  syncControlsToMarket();
  renderAll();
  ensureMarketDataLoaded(marketId);
}

function switchTab(targetTab) {
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.setAttribute("aria-selected", b.dataset.tab === targetTab ? "true" : "false")
  );
  document.querySelectorAll(".tab-panel").forEach((p) =>
    p.classList.toggle("hidden", p.id !== `tab-${targetTab}`)
  );
  if (targetTab === "sandbox") setTimeout(redrawCharts, 20);
}

function renderOverview() {
  const cardsEl = document.getElementById("overview-market-cards");
  cardsEl.innerHTML = MARKET_ORDER.map((id) => {
    const cfg = MARKETS[id];
    const ms = state.markets[id];
    const series = getSeriesForMarket(id);
    const rep = ms.colabReport;
    const isSel = state.activeMarket === id;
    const badgeText = series.isReal
      ? `真实行情 · ${series.dates.length} 交易日`
      : rep
        ? "已导入 Colab 报告"
        : cfg.statusText;

    let metricHtml = `<p class="text-xs text-muted">标的池：${ms.etfs.length} 只核心 ETF · ${escapeHtml(cfg.brokerNote)}</p>`;
    if (rep && rep.strategies) {
      const entries = Object.entries(rep.strategies);
      metricHtml = `
        <div class="text-xs text-muted stack-sm">
          <div>区间：<span class="font-mono">${escapeHtml(rep.date_range?.[0] || "")} ~ ${escapeHtml(rep.date_range?.[1] || "")}</span></div>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">
            ${entries
              .slice(0, 3)
              .map(
                ([k, m]) =>
                  `<span><strong>${escapeHtml(k.split("_")[0])}</strong> <span class="font-mono" style="color:${m.cagr_pct >= 0 ? "var(--success)" : "var(--error)"}">${m.cagr_pct >= 0 ? "+" : ""}${m.cagr_pct}%</span></span>`
              )
              .join("")}
          </div>
        </div>`;
    }

    return `
      <div class="card market-overview-card stack-sm ${isSel ? "is-selected" : ""}" data-overview-market="${id}">
        <div class="flex-between">
          <h3>${escapeHtml(cfg.label)}</h3>
          <span class="badge">${escapeHtml(badgeText)}</span>
        </div>
        ${metricHtml}
        <div class="flex-between text-xs text-muted" style="padding-top:4px; border-top:1px solid var(--border);">
          <span>最小 ${cfg.lotSize} 股 · ${cfg.currencyCode}</span>
          <span style="color:var(--primary); font-weight:500;">${isSel ? "当前选中" : "点击切换 →"}</span>
        </div>
      </div>`;
  }).join("");

  cardsEl.querySelectorAll("[data-overview-market]").forEach((card) => {
    card.addEventListener("click", () => switchMarket(card.dataset.overviewMarket));
  });

  // Overview Colab Snapshot for active market
  const cfg = getActiveCfg();
  const ms = getActiveMarketState();
  const rep = ms.colabReport;
  document.getElementById("overview-colab-title").textContent = `${cfg.shortName} · Colab 真实回测快照`;
  const metaEl = document.getElementById("overview-colab-meta");
  const bodyEl = document.getElementById("overview-colab-body");

  if (rep && rep.strategies) {
    metaEl.textContent = `数据区间 ${rep.date_range?.[0] || ""} ~ ${rep.date_range?.[1] || ""}（${rep.trading_days} 交易日）| 初始资金 ${fmtMoney(rep.params?.initial_cash || cfg.defaultCash, cfg.currency)}`;
    const rows = Object.entries(rep.strategies);
    bodyEl.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>策略</th>
              <th class="text-right">期末资金</th>
              <th class="text-right">年化收益</th>
              <th class="text-right">最大回撤</th>
              <th class="text-right">夏普</th>
              <th class="text-right">费用占比</th>
            </tr>
          </thead>
          <tbody class="tabular-nums">
            ${rows
              .map(
                ([name, m]) => `
                <tr>
                  <td class="font-semibold">${escapeHtml(name)}</td>
                  <td class="text-right font-mono">${fmtMoney(Math.round(m.final_equity), cfg.currency)}</td>
                  <td class="text-right font-mono font-semibold" style="color:${m.cagr_pct >= 0 ? "var(--success)" : "var(--error)"}">${m.cagr_pct >= 0 ? "+" : ""}${m.cagr_pct}%</td>
                  <td class="text-right font-mono" style="color:var(--error)">${m.max_drawdown_pct}%</td>
                  <td class="text-right font-mono">${m.sharpe}</td>
                  <td class="text-right font-mono text-muted">${m.cost_ratio_pct}%</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  } else {
    metaEl.textContent = `${cfg.shortName}尚未导入 Colab 真实回测 JSON，当前沙盒使用多周期教学演示行情`;
    bodyEl.innerHTML = `
      <div class="subcard text-xs text-muted stack-sm">
        <p>你可以立即点击右上角<strong>「进入实时沙盒深度调节」</strong>体验 ${escapeHtml(cfg.shortName)} ETF 策略对比，或让我为你生成对应的 Colab 数据拉取与回测 Notebook（自动使用 <code>${escapeHtml(cfg.dataSources)}</code>）。</p>
        <p>生成并运行后，将结果 JSON 导入顶部按钮，即可像 A 股一样在这里展示真实历史体检表。</p>
      </div>`;
  }

  // Learning progress + journal summary
  const doneCnt = state.roadmap.filter((x) => x.done).length;
  const pct = Math.round((doneCnt / Math.max(1, state.roadmap.length)) * 100);
  document.getElementById("overview-learn-pct").textContent = `${doneCnt}/${state.roadmap.length} (${pct}%)`;
  document.getElementById("overview-learn-bar").style.width = `${pct}%`;
  document.getElementById("overview-notes-count").textContent = `已沉淀 ${state.notes.length} 条量化学习与复盘笔记。`;

  const totalTradesAll = MARKET_ORDER.reduce((sum, id) => sum + state.markets[id].trades.length, 0);
  document.getElementById("overview-journal-summary").textContent =
    `当前 ${cfg.shortName} 已记 ${ms.trades.length} 笔模拟单（全市场合计 ${totalTradesAll} 笔），初始模拟本金 ${fmtMoney(ms.journalCapital, cfg.currency)}。`;

  // Cross-market rules table
  document.getElementById("overview-rules-tbody").innerHTML = MARKET_ORDER.map((id) => {
    const c = MARKETS[id];
    return `
      <tr>
        <td class="font-semibold whitespace-nowrap">${escapeHtml(c.label)}</td>
        <td class="font-mono">${c.currencyCode} (${c.currency})</td>
        <td class="font-mono whitespace-nowrap">${c.lotSize} 股</td>
        <td class="text-muted">${escapeHtml(c.tradingRule)}</td>
        <td class="text-muted">${escapeHtml(c.stampDutyNote)}</td>
        <td class="text-muted">${escapeHtml(c.dataSources)}</td>
        <td class="text-muted">${escapeHtml(c.brokerNote)}</td>
      </tr>`;
  }).join("");
}

// =========================================================================
// SANDBOX CONTROLS & CHARTS
// =========================================================================
function syncControlsToMarket() {
  const cfg = getActiveCfg();
  const cashEl = document.getElementById("ctrl-cash");
  cashEl.min = String(cfg.minCash);
  cashEl.max = String(cfg.maxCash);
  cashEl.step = String(cfg.cashStep);
  cashEl.value = String(cfg.defaultCash);

  const mid = Math.round((cfg.minCash + cfg.maxCash) / 2);
  document.getElementById("cash-range-labels").innerHTML = `
    <span>${fmtMoney(cfg.minCash, cfg.currency)}</span>
    <span>${fmtMoney(mid, cfg.currency)}</span>
    <span>${fmtMoney(cfg.maxCash, cfg.currency)}</span>`;

  const commEl = document.getElementById("ctrl-comm");
  commEl.innerHTML = cfg.commOptions
    .map((o) => `<option value="${o.value}" ${Number(o.value) === cfg.defaultCommRate ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
    .join("");

  document.getElementById("label-mincomm").textContent = cfg.minCommLabel;
  document.getElementById("ctrl-mincomm").checked = cfg.defaultMinComm > 0;
  document.getElementById("sandbox-stamp-note").textContent = cfg.stampDutyNote;
}

function redrawCharts() {
  if (!latestResults.length) return;
  const cfg = getActiveCfg();
  const series = getSeriesForMarket(state.activeMarket);
  const initialCash = Number(document.getElementById("ctrl-cash").value);
  drawLineChart(document.getElementById("canvas-equity"), series.dates, latestResults, {
    isDrawdown: false,
    initialCash,
    hoverIdx,
    currency: cfg.currency,
  });
  drawLineChart(document.getElementById("canvas-drawdown"), series.dates, latestResults, {
    isDrawdown: true,
    initialCash,
    hoverIdx,
    currency: cfg.currency,
  });
}

function bindChartHover(canvas) {
  canvas.addEventListener("mousemove", (e) => {
    const series = getSeriesForMarket(state.activeMarket);
    const cfg = getActiveCfg();
    const rect = canvas.getBoundingClientRect();
    const padLeft = 66;
    const padRight = 16;
    const rel = (e.clientX - rect.left - padLeft) / Math.max(1, rect.width - padLeft - padRight);
    hoverIdx = Math.max(0, Math.min(series.dates.length - 1, Math.round(rel * (series.dates.length - 1))));
    redrawCharts();
    const dt = series.dates[hoverIdx];
    const parts = latestResults.map(
      (s) => `${s.key}: ${fmtMoney(Math.round(s.equity[hoverIdx]), cfg.currency)} (${s.drawdown[hoverIdx].toFixed(1)}%)`
    );
    document.getElementById("chart-hover-readout").textContent = `${dt}  |  ${parts.join("  ·  ")}`;
  });
  canvas.addEventListener("mouseleave", () => {
    hoverIdx = null;
    redrawCharts();
    document.getElementById("chart-hover-readout").textContent = "悬停图表查看每日净值与回撤";
  });
}

function updateSandbox() {
  const cfg = getActiveCfg();
  const series = getSeriesForMarket(state.activeMarket);
  const initialCash = Number(document.getElementById("ctrl-cash").value);
  const rebalEvery = Number(document.getElementById("ctrl-rebal").value);
  const commRate = Number(document.getElementById("ctrl-comm").value);
  const minComm = document.getElementById("ctrl-mincomm").checked ? cfg.defaultMinComm : 0.0;
  const lookahead = document.getElementById("ctrl-lookahead").checked;

  document.getElementById("val-cash").textContent = fmtMoney(initialCash, cfg.currency);
  document.getElementById("val-rebal").textContent = `每 ${rebalEvery} 交易日`;
  document.getElementById("val-comm").textContent =
    commRate === 0 ? "免佣 (0%)" : `万${(commRate * 10000).toFixed(1).replace(/\.0$/, "")}`;

  const lhEl = document.getElementById("val-lookahead");
  lhEl.textContent = lookahead ? "⚠ 作弊 (T日收盘)" : "已防范 (T+1)";
  lhEl.style.color = lookahead ? "var(--warning)" : "var(--success)";
  document.getElementById("lookahead-warning").classList.toggle("hidden", !lookahead);

  const dateSpan = `${series.dates[0]} ~ ${series.dates[series.dates.length - 1]}`;
  document.getElementById("sandbox-heading").textContent = `${cfg.label} 实时交互回测沙盒 · ${series.isReal ? "真实历史行情" : "教学演示行情"}`;
  document.getElementById("sandbox-subtitle").textContent =
    `${dateSpan}（${series.dates.length} 交易日 · 最小 ${cfg.lotSize} 股整数倍）`;
  document.getElementById("chart-title-line").textContent =
    `${cfg.shortName}净值曲线与回撤对比（${series.isReal ? "Colab 真实数据" : "演示数据"}）`;

  const defs = buildStrategyWeights(series, cfg, rebalEvery);
  latestResults = defs.map((d) => ({
    ...d,
    ...runBacktest(series, {
      weightsByDay: d.weights,
      initialCash,
      commRate,
      minComm,
      slippageRate: 0.0005,
      lookahead,
      lotSize: cfg.lotSize,
    }),
  }));

  document.getElementById("chart-legend-row").innerHTML = latestResults
    .map((r) => `<span><span class="dot" style="background:var(${r.colorVar})"></span>${escapeHtml(r.name)}</span>`)
    .join("");

  const tbody = document.getElementById("sandbox-metrics-tbody");
  tbody.innerHTML = latestResults
    .map((r) => {
      const m = r.metrics;
      const cagrColor = m.cagr >= 0 ? "var(--success)" : "var(--error)";
      return `
        <tr>
          <td class="font-semibold whitespace-nowrap">
            <span class="dot" style="background: var(${r.colorVar})"></span>${escapeHtml(r.name)}
          </td>
          <td class="text-right font-mono">${fmtMoney(Math.round(m.finalEq), cfg.currency)}</td>
          <td class="text-right font-mono font-semibold" style="color:${cagrColor}">${m.cagr >= 0 ? "+" : ""}${m.cagr.toFixed(2)}%</td>
          <td class="text-right font-mono" style="color:var(--error)">${m.maxDd.toFixed(2)}%</td>
          <td class="text-right font-mono">${m.sharpe.toFixed(2)}</td>
          <td class="text-right font-mono">${m.trades}</td>
          <td class="text-right font-mono text-muted">${fmtMoney(Math.round(m.totalComm + m.totalSlip), cfg.currency)} (${m.costRatio.toFixed(1)}%)</td>
        </tr>`;
    })
    .join("");

  document.getElementById("sandbox-footnote").textContent = series.isReal
    ? `当前沙盒正在直接对 Colab 拉取的 ${cfg.shortName} 真实前复权日线（${dateSpan}）进行逐日事件驱动回测。`
    : `当前 ${cfg.shortName} 沙盒使用多周期校准演示行情；在 Colab 拉取该市场真实行情 JSON 放入 ${cfg.realDataUrl} 后会自动切换为真实历史数据。`;

  const [s1, s2, s3] = latestResults;
  const diag = [];
  diag.push(
    `<li><strong>多资产降回撤效果：</strong>单一基准（S1）最大回撤 <span class="font-mono">${s1.metrics.maxDd.toFixed(1)}%</span>，而全天候平衡（S2）将最大回撤控制在 <span class="font-mono">${s2.metrics.maxDd.toFixed(1)}%</span>，大幅改善持有体验。</li>`
  );
  if (rebalEvery <= 5) {
    diag.push(
      `<li><strong style="color:var(--warning)">高频换手磨损警示：</strong>每 ${rebalEvery} 天调仓使 S3 产生 <span class="font-mono">${s3.metrics.trades}</span> 笔交易，佣金+滑点占初始本金高达 <span class="font-mono">${s3.metrics.costRatio.toFixed(1)}%</span>。</li>`
    );
  } else {
    diag.push(
      `<li><strong>调仓成本评估：</strong>每 ${rebalEvery} 交易日调仓下，S3 交易 <span class="font-mono">${s3.metrics.trades}</span> 笔，总交易成本占本金 <span class="font-mono">${s3.metrics.costRatio.toFixed(1)}%</span>，便于个人低频半自动跟踪。</li>`
    );
  }
  if (cfg.id === "cn" && initialCash <= 30000) {
    diag.push(
      `<li><strong style="color:var(--warning)">A股整手门槛提示：</strong>当前资金 ¥${initialCash.toLocaleString()}，国债 ETF (511010) 1 手约需 ¥14,100，仓位会有现金冗余；对比切到「美股市场」可以看到 1 股起步的灵活性差异。</li>`
    );
  }
  if (lookahead) {
    diag.push(
      `<li><strong style="color:var(--warning)">未来函数已开启：</strong>当前 S3 年化 <span class="font-mono">${s3.metrics.cagr.toFixed(2)}%</span> 含收盘瞬间成交假设，仅供识别陷阱对比，切勿用于实盘决策。</li>`
    );
  }
  document.getElementById("sandbox-diagnosis").innerHTML = diag.join("");

  // Header status badge
  const badge = document.getElementById("data-mode-badge");
  badge.textContent = series.isReal
    ? `${cfg.shortName} · 真实行情 (${dateSpan})`
    : `${cfg.shortName} · 演示行情（可导 Colab JSON）`;

  redrawCharts();
}

function renderColabReport() {
  const cfg = getActiveCfg();
  const rep = getActiveMarketState().colabReport;
  const panel = document.getElementById("colab-import-panel");
  if (!rep) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  document.getElementById("colab-date-range").textContent =
    `${rep.date_range?.[0] || ""} ~ ${rep.date_range?.[1] || ""} · ${rep.trading_days || 0} 交易日`;
  const p = rep.params || {};
  document.getElementById("colab-meta-line").textContent =
    `${cfg.label} | 初始资金 ${fmtMoney(p.initial_cash || cfg.defaultCash, cfg.currency)} | 佣金万${((p.commission_rate || 0) * 10000).toFixed(2)} | 最低 ${cfg.currency}${p.min_commission ?? cfg.defaultMinComm} | 滑点 ${((p.slippage_rate || 0) * 10000).toFixed(1)}bp`;

  const rows = [];
  for (const [k, m] of Object.entries(rep.strategies || {})) rows.push({ label: k, m });
  if (rep.pitfalls?.lookahead_bias) rows.push({ label: "陷阱A：未来函数（T日收盘成交）", m: rep.pitfalls.lookahead_bias });
  if (rep.pitfalls?.high_freq_cost) rows.push({ label: "陷阱B：每2日高频调仓", m: rep.pitfalls.high_freq_cost });

  document.getElementById("colab-metrics-tbody").innerHTML = rows
    .map(
      ({ label, m }) => `
      <tr>
        <td class="font-semibold">${escapeHtml(label)}</td>
        <td class="text-right font-mono">${fmtMoney(Math.round(m.final_equity || 0), cfg.currency)}</td>
        <td class="text-right font-mono font-semibold" style="color:${(m.cagr_pct || 0) >= 0 ? "var(--success)" : "var(--error)"}">${(m.cagr_pct || 0) >= 0 ? "+" : ""}${m.cagr_pct}%</td>
        <td class="text-right font-mono" style="color:var(--error)">${m.max_drawdown_pct}%</td>
        <td class="text-right font-mono">${m.sharpe}</td>
        <td class="text-right font-mono">${m.trade_count}</td>
        <td class="text-right font-mono text-muted">${m.cost_ratio_pct}%</td>
      </tr>`
    )
    .join("");

  const detailsEl = document.getElementById("colab-chart-details");
  const imgEl = document.getElementById("colab-chart-img");
  detailsEl.style.display = "";
  imgEl.onerror = () => {
    detailsEl.style.display = "none";
  };
  imgEl.src = cfg.colabChartUrl;
}

async function ensureMarketDataLoaded(marketId) {
  const cfg = MARKETS[marketId];
  if (!cfg) return;

  // 1) Try loading synced real historical daily prices
  if (!marketSeriesCache[marketId]?.isReal && cfg.realDataUrl) {
    try {
      const resp = await fetch(cfg.realDataUrl, { cache: "no-store" });
      if (resp.ok) {
        const raw = await resp.json();
        if (raw && Array.isArray(raw.dates) && raw.open && raw.close) {
          const open = {};
          const close = {};
          for (const c of raw.codes) {
            open[c] = Float64Array.from(raw.open[c]);
            close[c] = Float64Array.from(raw.close[c]);
          }
          marketSeriesCache[marketId] = { dates: raw.dates, codes: raw.codes, open, close, isReal: true };
          if (state.activeMarket === marketId) {
            renderMarketSwitcher();
            renderOverview();
            updateSandbox();
          }
        }
      }
    } catch (_) {
      // Keep fallback series
    }
  }

  // 2) Try loading synced Colab summary report
  if (cfg.colabReportUrl) {
    try {
      const resp = await fetch(cfg.colabReportUrl, { cache: "no-store" });
      if (resp.ok) {
        const parsed = await resp.json();
        if (parsed && parsed.strategies) {
          const cur = state.markets[marketId].colabReport;
          const curTs = cur?.generated_at_utc || "";
          const repoTs = parsed.generated_at_utc || "";
          if (!cur || (repoTs && repoTs >= curTs)) {
            state.markets[marketId].colabReport = parsed;
            saveState();
            renderMarketSwitcher();
            renderOverview();
            if (state.activeMarket === marketId) renderColabReport();
          }
        }
      }
    } catch (_) {
      // No static summary for this market yet
    }
  }
}

// =========================================================================
// ROADMAP & NOTES
// =========================================================================
function renderRoadmap() {
  const stages = {};
  for (const item of state.roadmap) {
    if (!stages[item.stage]) stages[item.stage] = [];
    stages[item.stage].push(item);
  }
  const doneCnt = state.roadmap.filter((x) => x.done).length;
  const pct = Math.round((doneCnt / Math.max(1, state.roadmap.length)) * 100);
  document.getElementById("learn-progress-text").textContent = `${doneCnt} / ${state.roadmap.length} (${pct}%)`;
  document.getElementById("learn-progress-bar").style.width = `${pct}%`;

  document.getElementById("roadmap-grid").innerHTML = Object.entries(stages)
    .map(
      ([stage, items]) => `
      <div class="subcard stack-sm">
        <div class="text-xs font-semibold">${escapeHtml(stage)}</div>
        <div class="stack-sm">
          ${items
            .map(
              (it) => `
            <label class="check-row ${it.done ? "is-done" : ""}">
              <input type="checkbox" data-road-id="${escapeHtml(it.id)}" ${it.done ? "checked" : ""} />
              <span><span class="badge" style="padding:0 5px; margin-right:5px;">${escapeHtml(it.market || "通用")}</span>${escapeHtml(it.text)}</span>
            </label>`
            )
            .join("")}
        </div>
      </div>`
    )
    .join("");

  document.querySelectorAll("[data-road-id]").forEach((el) => {
    el.addEventListener("change", () => {
      const item = state.roadmap.find((x) => x.id === el.dataset.roadId);
      if (item) {
        item.done = el.checked;
        saveState();
        renderRoadmap();
        renderOverview();
      }
    });
  });
}

function renderNotes() {
  const list = document.getElementById("notes-list");
  if (!state.notes.length) {
    list.innerHTML = `<p class="text-xs text-muted" style="text-align:center; padding:18px 0;">暂无笔记，写下你的第一条量化学习心得吧。</p>`;
    return;
  }
  list.innerHTML = state.notes
    .map(
      (n) => `
      <article class="subcard stack-sm">
        <div class="flex-between">
          <div class="flex-inline" style="flex-wrap:wrap;">
            <span class="badge">${escapeHtml(n.market || "通用")}</span>
            <span class="badge badge-muted">${escapeHtml(n.tag)}</span>
            <h4>${escapeHtml(n.title)}</h4>
          </div>
          <div class="flex-inline text-xs text-muted">
            <span class="font-mono">${escapeHtml(n.date)}</span>
            <button type="button" class="btn-ghost" data-del-note="${escapeHtml(n.id)}">删除</button>
          </div>
        </div>
        <p class="text-xs text-muted" style="white-space:pre-wrap; line-height:1.6;">${escapeHtml(n.body)}</p>
      </article>`
    )
    .join("");

  document.querySelectorAll("[data-del-note]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.notes = state.notes.filter((x) => x.id !== btn.dataset.delNote);
      saveState();
      renderNotes();
      renderOverview();
    });
  });
}

// =========================================================================
// MULTI-MARKET PAPER TRADING JOURNAL
// =========================================================================
function renderJournal() {
  const cfg = getActiveCfg();
  const ms = getActiveMarketState();
  const cap = Number(ms.journalCapital) || cfg.defaultCash;

  document.getElementById("journal-market-label").textContent = cfg.label;
  document.getElementById("journal-currency-prefix").textContent = cfg.currency;
  document.getElementById("journal-capital").value = cap;
  document.getElementById("journal-form-title").textContent = `录入 ${cfg.label} 模拟盘交易记录`;
  document.getElementById("journal-broker-hint").textContent =
    `参考通道：${cfg.brokerNote} | 最小步长：${cfg.lotSize} 股 | 默认佣金按 ${cfg.minCommLabel} 起估算`;

  const qtyInput = document.getElementById("tr-qty");
  qtyInput.step = String(cfg.lotSize);
  qtyInput.min = String(cfg.lotSize);
  qtyInput.placeholder = cfg.lotSize > 1 ? `股数(${cfg.lotSize}倍数)` : "股数(1股起)";

  const sel = document.getElementById("tr-code");
  const prev = sel.value;
  sel.innerHTML = ms.etfs
    .map((e) => `<option value="${escapeHtml(e.code)}">${escapeHtml(e.code)} ${escapeHtml(e.name)}</option>`)
    .join("");
  if (prev && ms.etfs.some((e) => e.code === prev)) sel.value = prev;

  const sorted = [...ms.trades].sort((a, b) => a.date.localeCompare(b.date));
  const pos = {};
  let cash = cap;
  let totalComm = 0;
  let realizedPnl = 0;

  for (const t of sorted) {
    const gross = t.price * t.qty;
    const comm = Number(t.commission) ?? Math.max(cfg.defaultMinComm, gross * cfg.defaultCommRate);
    totalComm += comm;
    if (!pos[t.code]) pos[t.code] = { code: t.code, name: t.name, qty: 0, costTotal: 0 };

    if (t.side === "BUY") {
      cash -= gross + comm;
      pos[t.code].qty += t.qty;
      pos[t.code].costTotal += gross + comm;
    } else {
      const sellQty = Math.min(t.qty, pos[t.code].qty);
      const avgCost = pos[t.code].qty > 0 ? pos[t.code].costTotal / pos[t.code].qty : t.price;
      cash += gross - comm;
      realizedPnl += gross - comm - avgCost * sellQty;
      pos[t.code].qty -= sellQty;
      pos[t.code].costTotal = Math.max(0, pos[t.code].costTotal - avgCost * sellQty);
    }
  }

  const activePos = Object.values(pos).filter((p) => p.qty > 0);
  const posCostSum = activePos.reduce((acc, p) => acc + p.costTotal, 0);

  document.getElementById("kpi-pos-cost").textContent = fmtMoney(Math.round(posCostSum), cfg.currency);
  document.getElementById("kpi-cash-left").textContent = fmtMoney(Math.round(cash), cfg.currency);
  const pnlSign = realizedPnl > 0 ? "+" : "";
  document.getElementById("kpi-realized-pnl").textContent =
    `${pnlSign}${fmtMoney(realizedPnl, cfg.currency, 1)} / ${fmtMoney(totalComm, cfg.currency, 1)}`;

  document.getElementById("positions-tbody").innerHTML = activePos.length
    ? activePos
        .map((p) => {
          const avg = p.costTotal / p.qty;
          const pct = (p.costTotal / cap) * 100;
          return `
            <tr>
              <td class="font-semibold">${escapeHtml(p.code)} ${escapeHtml(p.name)}</td>
              <td class="text-right font-mono">${p.qty.toLocaleString()}</td>
              <td class="text-right font-mono">${cfg.currency}${avg.toFixed(3)}</td>
              <td class="text-right font-mono">${pct.toFixed(1)}%</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="text-muted" style="text-align:center; padding:20px 0;">当前市场空仓，可从上方录入模拟买入单</td></tr>`;

  document.getElementById("trades-tbody").innerHTML = ms.trades.length
    ? [...ms.trades]
        .reverse()
        .map(
          (t) => `
          <tr>
            <td class="font-mono whitespace-nowrap">${escapeHtml(t.date)}</td>
            <td class="whitespace-nowrap font-semibold">${escapeHtml(t.code)} ${escapeHtml(t.name)}</td>
            <td class="font-mono font-semibold" style="color:${t.side === "BUY" ? "var(--error)" : "var(--success)"}">${t.side === "BUY" ? "买入" : "卖出"}</td>
            <td class="text-right font-mono whitespace-nowrap">${cfg.currency}${Number(t.price).toFixed(3)} × ${t.qty}</td>
            <td class="text-right font-mono">${cfg.currency}${Number(t.commission).toFixed(2)}</td>
            <td class="text-muted" style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(t.note)}">${escapeHtml(t.note || "-")}</td>
            <td class="text-right"><button type="button" class="btn-ghost" data-del-trade="${escapeHtml(t.id)}">删</button></td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="text-muted" style="text-align:center; padding:20px 0;">当前市场暂无模拟交易记录</td></tr>`;

  document.querySelectorAll("[data-del-trade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ms.trades = ms.trades.filter((x) => x.id !== btn.dataset.delTrade);
      saveState();
      renderJournal();
      renderOverview();
    });
  });
}

// =========================================================================
// ETF ARCHIVE & OPEN-SOURCE ECOSYSTEM
// =========================================================================
function renderEtfs() {
  const cfg = getActiveCfg();
  const ms = getActiveMarketState();
  document.getElementById("etf-pool-heading").textContent = `${cfg.label} · 标的档案库`;
  const q = (document.getElementById("etf-search").value || "").trim().toLowerCase();
  const rows = ms.etfs.filter(
    (e) =>
      !q ||
      e.code.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q) ||
      e.cat.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q)
  );
  document.getElementById("etf-table-body").innerHTML = rows
    .map(
      (e) => `
      <tr>
        <td class="font-mono font-semibold">${escapeHtml(e.code)}</td>
        <td class="font-semibold">${escapeHtml(e.name)}</td>
        <td class="text-muted">${escapeHtml(e.cat)}</td>
        <td class="font-mono">${escapeHtml(e.t0)}</td>
        <td class="font-mono text-muted">${escapeHtml(e.lotHint || `${cfg.lotSize}股起`)}</td>
        <td class="text-muted">${escapeHtml(e.role)}</td>
        <td class="text-right"><button type="button" class="btn-ghost" data-del-etf="${escapeHtml(e.code)}">移除</button></td>
      </tr>`
    )
    .join("");

  document.querySelectorAll("[data-del-etf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ms.etfs = ms.etfs.filter((x) => x.code !== btn.dataset.delEtf);
      saveState();
      renderEtfs();
      renderJournal();
      renderOverview();
    });
  });
}

function renderResources() {
  document.getElementById("resources-grid").innerHTML = state.resources
    .map(
      (r, idx) => `
      <div class="subcard" style="display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
        <div class="stack-sm">
          <div class="flex-between">
            <span class="font-semibold">${escapeHtml(r.name)}</span>
            <span class="badge">${escapeHtml(r.cat)}</span>
          </div>
          ${r.markets ? `<div class="text-xs text-muted">适用市场：${escapeHtml(r.markets)}</div>` : ""}
          <p class="text-xs text-muted" style="line-height:1.6;">${escapeHtml(r.desc)}</p>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button type="button" class="btn-ghost" data-del-res="${idx}">删除</button>
        </div>
      </div>`
    )
    .join("");

  document.querySelectorAll("[data-del-res]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.resources.splice(Number(btn.dataset.delRes), 1);
      saveState();
      renderResources();
    });
  });
}

function downloadText(filename, content, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =========================================================================
// EVENT WIRING
// =========================================================================
function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("btn-goto-sandbox").addEventListener("click", () => switchTab("sandbox"));
  document.getElementById("btn-goto-journal").addEventListener("click", () => switchTab("journal"));

  ["ctrl-cash", "ctrl-rebal", "ctrl-comm", "ctrl-mincomm", "ctrl-lookahead"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateSandbox);
    document.getElementById(id).addEventListener("change", updateSandbox);
  });

  bindChartHover(document.getElementById("canvas-equity"));
  bindChartHover(document.getElementById("canvas-drawdown"));

  document.getElementById("import-colab-json").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.strategies) throw new Error("未找到 strategies 字段");
        getActiveMarketState().colabReport = parsed;
        saveState();
        renderColabReport();
        renderOverview();
        switchTab("sandbox");
      } catch (err) {
        alert("导入失败：请选择 Colab 生成的回测摘要 JSON (" + err.message + ")");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("btn-clear-colab").addEventListener("click", () => {
    getActiveMarketState().colabReport = null;
    saveState();
    renderColabReport();
    renderOverview();
  });

  document.getElementById("btn-export-workspace").addEventListener("click", () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`quantlab_multi_market_backup_${stamp}.json`, JSON.stringify(state, null, 2));
  });

  document.getElementById("import-workspace-json").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.markets || !Array.isArray(parsed.roadmap)) throw new Error("备份文件格式不正确");
        state = parsed;
        saveState();
        syncControlsToMarket();
        renderAll();
      } catch (err) {
        alert("恢复备份失败：" + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("note-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("note-title").value.trim();
    const market = document.getElementById("note-market").value;
    const tag = document.getElementById("note-tag").value;
    const body = document.getElementById("note-body").value.trim();
    if (!title || !body) return;
    state.notes.unshift({
      id: "n_" + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      market,
      tag,
      title,
      body,
    });
    saveState();
    e.target.reset();
    renderNotes();
    renderOverview();
  });

  document.getElementById("btn-export-notes-md").addEventListener("click", () => {
    const md =
      "# QuantLab 个人量化学习笔记\n\n" +
      state.notes.map((n) => `## [${n.market || "通用"} · ${n.tag}] ${n.title} (${n.date})\n\n${n.body}\n`).join("\n---\n\n");
    downloadText("quant_learning_notes.md", md, "text/markdown");
  });

  document.getElementById("tr-date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("journal-capital").addEventListener("change", (e) => {
    const cfg = getActiveCfg();
    getActiveMarketState().journalCapital = Math.max(1000, Number(e.target.value) || cfg.defaultCash);
    saveState();
    renderJournal();
    renderOverview();
  });

  document.getElementById("trade-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const cfg = getActiveCfg();
    const ms = getActiveMarketState();
    const code = document.getElementById("tr-code").value;
    const etf = ms.etfs.find((x) => x.code === code) || { name: code };
    const price = Number(document.getElementById("tr-price").value);
    const qty = Math.floor(Number(document.getElementById("tr-qty").value) / cfg.lotSize) * cfg.lotSize;
    if (!price || qty < cfg.lotSize) return;
    const comm = cfg.defaultCommRate === 0 && cfg.defaultMinComm === 0
      ? 0
      : Math.max(cfg.defaultMinComm, price * qty * cfg.defaultCommRate);
    ms.trades.push({
      id: "t_" + Date.now(),
      date: document.getElementById("tr-date").value,
      code,
      name: etf.name,
      side: document.getElementById("tr-side").value,
      price,
      qty,
      commission: Number(comm.toFixed(2)),
      note: document.getElementById("tr-note").value.trim(),
    });
    saveState();
    document.getElementById("tr-price").value = "";
    document.getElementById("tr-qty").value = "";
    document.getElementById("tr-note").value = "";
    renderJournal();
    renderOverview();
  });

  document.getElementById("btn-clear-trades").addEventListener("click", () => {
    const cfg = getActiveCfg();
    if (!confirm(`确认清空「${cfg.label}」的全部模拟交易记录？`)) return;
    getActiveMarketState().trades = [];
    saveState();
    renderJournal();
    renderOverview();
  });

  document.getElementById("btn-export-trades-csv").addEventListener("click", () => {
    const cfg = getActiveCfg();
    const ms = getActiveMarketState();
    const header = "市场,日期,代码,名称,方向,成交价,股数,佣金,备注";
    const rows = ms.trades.map(
      (t) => `${cfg.id},${t.date},${t.code},${t.name},${t.side},${t.price},${t.qty},${t.commission},"${String(t.note || "").replace(/"/g, '""')}"`
    );
    downloadText(`paper_trades_${cfg.id}.csv`, "\uFEFF" + [header, ...rows].join("\n"), "text/csv");
  });

  document.getElementById("etf-search").addEventListener("input", renderEtfs);
  document.getElementById("etf-add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const cfg = getActiveCfg();
    const ms = getActiveMarketState();
    const code = document.getElementById("etf-code").value.trim();
    const name = document.getElementById("etf-name").value.trim();
    const cat = document.getElementById("etf-cat").value.trim();
    const t0 = document.getElementById("etf-t0").value;
    const role = document.getElementById("etf-role").value.trim();
    if (!code || !name) return;
    if (ms.etfs.some((x) => x.code === code)) {
      alert("该代码已在当前市场档案库中");
      return;
    }
    ms.etfs.push({ code, name, cat, t0, lotHint: `${cfg.lotSize}股起`, role });
    saveState();
    e.target.reset();
    renderEtfs();
    renderJournal();
    renderOverview();
  });

  document.getElementById("res-add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.resources.push({
      name: document.getElementById("res-name").value.trim(),
      cat: document.getElementById("res-cat").value.trim(),
      markets: getActiveCfg().shortName,
      desc: document.getElementById("res-desc").value.trim(),
    });
    saveState();
    e.target.reset();
    renderResources();
  });

  window.addEventListener("resize", redrawCharts);
}

function renderAll() {
  renderMarketSwitcher();
  renderOverview();
  renderColabReport();
  updateSandbox();
  renderRoadmap();
  renderNotes();
  renderEtfs();
  renderJournal();
  renderResources();
}

initTheme();
syncControlsToMarket();
bindEvents();
renderAll();
// Auto-load real market data & Colab summary reports for all configured markets
MARKET_ORDER.forEach((id) => ensureMarketDataLoaded(id));
