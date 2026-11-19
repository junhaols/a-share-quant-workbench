import {
  STORAGE_KEY,
  DEFAULT_ROADMAP,
  DEFAULT_ETFS,
  DEFAULT_RESOURCES,
  DEFAULT_NOTES,
  DEFAULT_TRADES,
  generateCalibratedMarket,
} from "./data.js";
import { runBacktest, buildStrategyWeights } from "./backtest.js";
import { drawLineChart } from "./charts.js";

const THEME_KEY = "antigravity_quant_theme";
const MARKET = generateCalibratedMarket();
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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        roadmap: parsed.roadmap || structuredClone(DEFAULT_ROADMAP),
        notes: parsed.notes || structuredClone(DEFAULT_NOTES),
        etfs: parsed.etfs || structuredClone(DEFAULT_ETFS),
        resources: parsed.resources || structuredClone(DEFAULT_RESOURCES),
        trades: parsed.trades || structuredClone(DEFAULT_TRADES),
        journalCapital: parsed.journalCapital || 80000,
        colabReport: parsed.colabReport || null,
      };
    }
  } catch (_) {
    // ignore storage errors
  }
  return {
    roadmap: structuredClone(DEFAULT_ROADMAP),
    notes: structuredClone(DEFAULT_NOTES),
    etfs: structuredClone(DEFAULT_ETFS),
    resources: structuredClone(DEFAULT_RESOURCES),
    trades: structuredClone(DEFAULT_TRADES),
    journalCapital: 80000,
    colabReport: null,
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

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  applyTheme(theme);

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

function redrawCharts() {
  if (!latestResults.length) return;
  const initialCash = Number(document.getElementById("ctrl-cash").value);
  drawLineChart(document.getElementById("canvas-equity"), MARKET.dates, latestResults, {
    isDrawdown: false,
    initialCash,
    hoverIdx,
  });
  drawLineChart(document.getElementById("canvas-drawdown"), MARKET.dates, latestResults, {
    isDrawdown: true,
    initialCash,
    hoverIdx,
  });
}

function bindChartHover(canvas) {
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const padLeft = 62;
    const padRight = 16;
    const rel = (e.clientX - rect.left - padLeft) / Math.max(1, rect.width - padLeft - padRight);
    hoverIdx = Math.max(0, Math.min(MARKET.dates.length - 1, Math.round(rel * (MARKET.dates.length - 1))));
    redrawCharts();
    const dt = MARKET.dates[hoverIdx];
    const parts = latestResults.map(
      (s) => `${s.key}: ¥${Math.round(s.equity[hoverIdx]).toLocaleString()} (${s.drawdown[hoverIdx].toFixed(1)}%)`
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
  const initialCash = Number(document.getElementById("ctrl-cash").value);
  const rebalEvery = Number(document.getElementById("ctrl-rebal").value);
  const commRate = Number(document.getElementById("ctrl-comm").value);
  const minComm = document.getElementById("ctrl-min5").checked ? 5.0 : 0.0;
  const lookahead = document.getElementById("ctrl-lookahead").checked;

  document.getElementById("val-cash").textContent = `¥${initialCash.toLocaleString()}`;
  document.getElementById("val-rebal").textContent = `每 ${rebalEvery} 交易日`;
  document.getElementById("val-comm").textContent = `万${(commRate * 10000).toFixed(1).replace(/\.0$/, "")}`;
  const lhEl = document.getElementById("val-lookahead");
  lhEl.textContent = lookahead ? "⚠ 作弊 (T日收盘)" : "已防范 (T+1)";
  lhEl.style.color = lookahead ? "var(--warning)" : "var(--success)";
  document.getElementById("lookahead-warning").classList.toggle("hidden", !lookahead);

  const defs = buildStrategyWeights(MARKET, rebalEvery);
  latestResults = defs.map((d) => ({
    ...d,
    ...runBacktest(MARKET, {
      weightsByDay: d.weights,
      initialCash,
      commRate,
      minComm,
      slippageRate: 0.0005,
      lookahead,
    }),
  }));

  const tbody = document.getElementById("sandbox-metrics-tbody");
  tbody.innerHTML = latestResults
    .map((r) => {
      const m = r.metrics;
      const cagrColor = m.cagr >= 0 ? "var(--success)" : "var(--error)";
      return `
        <tr>
          <td class="font-semibold whitespace-nowrap">
            <span class="dot" style="background: var(${r.colorVar})"></span>${r.name}
          </td>
          <td class="text-right font-mono">¥${Math.round(m.finalEq).toLocaleString()}</td>
          <td class="text-right font-mono font-semibold" style="color:${cagrColor}">${m.cagr >= 0 ? "+" : ""}${m.cagr.toFixed(2)}%</td>
          <td class="text-right font-mono" style="color:var(--error)">${m.maxDd.toFixed(2)}%</td>
          <td class="text-right font-mono">${m.sharpe.toFixed(2)}</td>
          <td class="text-right font-mono">${m.trades}</td>
          <td class="text-right font-mono text-muted">¥${(m.totalComm + m.totalSlip).toFixed(0)} (${m.costRatio.toFixed(1)}%)</td>
        </tr>
      `;
    })
    .join("");

  const [s1, s2, s3] = latestResults;
  const diag = [];
  diag.push(
    `<li><strong>分散降回撤效果：</strong>S1 单持沪深300 最大回撤 <span class="font-mono">${s1.metrics.maxDd.toFixed(1)}%</span>，而 S2 股债金平衡将最大回撤压缩至 <span class="font-mono">${s2.metrics.maxDd.toFixed(1)}%</span>，更适合零基础平稳过渡。</li>`
  );
  if (rebalEvery <= 5) {
    diag.push(
      `<li><strong style="color:var(--warning)">高频磨损提醒：</strong>每 ${rebalEvery} 天调仓令 S3 产生 <span class="font-mono">${s3.metrics.trades}</span> 笔交易，佣金+滑点吞噬初始本金的 <span class="font-mono">${s3.metrics.costRatio.toFixed(1)}%</span>${minComm > 0 ? "（最低 5 元佣金显著放大了小资金摩擦）" : ""}。</li>`
    );
  } else {
    diag.push(
      `<li><strong>低频成本健康：</strong>每 ${rebalEvery} 交易日调仓下，S3 累计交易 <span class="font-mono">${s3.metrics.trades}</span> 笔，总费用仅占本金 <span class="font-mono">${s3.metrics.costRatio.toFixed(1)}%</span>，适合东方财富半自动跟踪。</li>`
    );
  }
  if (initialCash <= 30000) {
    diag.push(
      `<li><strong style="color:var(--warning)">小资金整手提示：</strong>当前资金 ¥${initialCash.toLocaleString()}，国债 ETF (511010) 1 手约需 ¥14,000，组合会出现现金冗余，实操中通常用场外纯债基金替代。</li>`
    );
  }
  if (lookahead) {
    diag.push(
      `<li><strong style="color:var(--warning)">检测到未来函数：</strong>当前 S3 年化 <span class="font-mono">${s3.metrics.cagr.toFixed(2)}%</span> 含有收盘价偷看偏差，请关闭开关查看真实 T+1 表现。</li>`
    );
  } else {
    diag.push(
      `<li><strong>与 Colab 联动：</strong>运行第 1 课 Notebook 后，将 Drive 中的 <code>lesson01_summary.json</code> 导入顶部，或直接放到仓库 <code>data/latest_lesson01_summary.json</code> 提交即可自动展示。</li>`
    );
  }
  document.getElementById("sandbox-diagnosis").innerHTML = diag.join("");
  redrawCharts();
}

function renderColabReport() {
  const panel = document.getElementById("colab-import-panel");
  const badge = document.getElementById("data-mode-badge");
  if (!state.colabReport) {
    panel.classList.add("hidden");
    badge.textContent = "内置教学行情（可导入 Colab 真实 JSON）";
    return;
  }
  const rep = state.colabReport;
  panel.classList.remove("hidden");
  badge.textContent = `已加载 Colab 真实报告 (${rep.date_range?.[0] || ""} ~ ${rep.date_range?.[1] || ""})`;
  document.getElementById("colab-date-range").textContent = `${rep.date_range?.[0] || ""} ~ ${rep.date_range?.[1] || ""} · ${rep.trading_days || 0} 交易日`;
  const p = rep.params || {};
  document.getElementById("colab-meta-line").textContent =
    `初始资金 ¥${(p.initial_cash || 0).toLocaleString()} | 佣金万${((p.commission_rate || 0) * 10000).toFixed(2)} | 最低 ¥${p.min_commission ?? 5} | 滑点 ${((p.slippage_rate || 0) * 10000).toFixed(1)}bp`;

  const rows = [];
  for (const [k, m] of Object.entries(rep.strategies || {})) rows.push({ label: k, m });
  if (rep.pitfalls?.lookahead_bias) rows.push({ label: "陷阱A：未来函数（T日收盘成交）", m: rep.pitfalls.lookahead_bias });
  if (rep.pitfalls?.high_freq_cost) rows.push({ label: "陷阱B：每2日高频调仓", m: rep.pitfalls.high_freq_cost });

  document.getElementById("colab-metrics-tbody").innerHTML = rows
    .map(
      ({ label, m }) => `
      <tr>
        <td class="font-semibold">${escapeHtml(label)}</td>
        <td class="text-right font-mono">¥${Math.round(m.final_equity || 0).toLocaleString()}</td>
        <td class="text-right font-mono font-semibold" style="color:${(m.cagr_pct || 0) >= 0 ? "var(--success)" : "var(--error)"}">${(m.cagr_pct || 0) >= 0 ? "+" : ""}${m.cagr_pct}%</td>
        <td class="text-right font-mono" style="color:var(--error)">${m.max_drawdown_pct}%</td>
        <td class="text-right font-mono">${m.sharpe}</td>
        <td class="text-right font-mono">${m.trade_count}</td>
        <td class="text-right font-mono text-muted">${m.cost_ratio_pct}%</td>
      </tr>`
    )
    .join("");
}

async function tryAutoLoadRepoReport() {
  if (state.colabReport) return;
  try {
    const resp = await fetch("./data/latest_lesson01_summary.json", { cache: "no-store" });
    if (!resp.ok) return;
    const parsed = await resp.json();
    if (parsed && parsed.strategies) {
      state.colabReport = parsed;
      renderColabReport();
    }
  } catch (_) {
    // No static repo report present yet; keep sandbox mode.
  }
}

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
              <span>${escapeHtml(it.text)}</span>
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
          <div class="flex-inline">
            <span class="badge">${escapeHtml(n.tag)}</span>
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
    });
  });
}

function renderJournal() {
  const cap = Number(state.journalCapital) || 80000;
  document.getElementById("journal-capital").value = cap;

  const sel = document.getElementById("tr-code");
  const prev = sel.value;
  sel.innerHTML = state.etfs
    .map((e) => `<option value="${escapeHtml(e.code)}">${escapeHtml(e.code)} ${escapeHtml(e.name)}</option>`)
    .join("");
  if (prev && state.etfs.some((e) => e.code === prev)) sel.value = prev;

  const sorted = [...state.trades].sort((a, b) => a.date.localeCompare(b.date));
  const pos = {};
  let cash = cap;
  let totalComm = 0;
  let realizedPnl = 0;

  for (const t of sorted) {
    const gross = t.price * t.qty;
    const comm = Number(t.commission) || Math.max(5, gross * 0.00025);
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

  document.getElementById("kpi-pos-cost").textContent = `¥${Math.round(posCostSum).toLocaleString()}`;
  document.getElementById("kpi-cash-left").textContent = `¥${Math.round(cash).toLocaleString()}`;
  const pnlSign = realizedPnl >= 0 ? "+" : "";
  document.getElementById("kpi-realized-pnl").textContent = `${pnlSign}¥${realizedPnl.toFixed(1)} / ¥${totalComm.toFixed(1)}`;

  document.getElementById("positions-tbody").innerHTML = activePos.length
    ? activePos
        .map((p) => {
          const avg = p.costTotal / p.qty;
          const pct = (p.costTotal / cap) * 100;
          return `
            <tr>
              <td class="font-semibold">${escapeHtml(p.code)} ${escapeHtml(p.name)}</td>
              <td class="text-right font-mono">${p.qty.toLocaleString()}</td>
              <td class="text-right font-mono">¥${avg.toFixed(3)}</td>
              <td class="text-right font-mono">${pct.toFixed(1)}%</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="text-muted" style="text-align:center; padding:20px 0;">当前空仓，可从上方录入模拟买入单</td></tr>`;

  document.getElementById("trades-tbody").innerHTML = state.trades.length
    ? [...state.trades]
        .reverse()
        .map(
          (t) => `
          <tr>
            <td class="font-mono whitespace-nowrap">${escapeHtml(t.date)}</td>
            <td class="whitespace-nowrap font-semibold">${escapeHtml(t.code)} ${escapeHtml(t.name)}</td>
            <td class="font-mono font-semibold" style="color:${t.side === "BUY" ? "var(--error)" : "var(--success)"}">${t.side === "BUY" ? "买入" : "卖出"}</td>
            <td class="text-right font-mono whitespace-nowrap">¥${Number(t.price).toFixed(3)} × ${t.qty}</td>
            <td class="text-right font-mono">¥${Number(t.commission).toFixed(2)}</td>
            <td class="text-muted" style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(t.note)}">${escapeHtml(t.note || "-")}</td>
            <td class="text-right"><button type="button" class="btn-ghost" data-del-trade="${escapeHtml(t.id)}">删</button></td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="text-muted" style="text-align:center; padding:20px 0;">暂无模拟交易记录</td></tr>`;

  document.querySelectorAll("[data-del-trade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.trades = state.trades.filter((x) => x.id !== btn.dataset.delTrade);
      saveState();
      renderJournal();
    });
  });
}

function renderEtfs() {
  const q = (document.getElementById("etf-search").value || "").trim().toLowerCase();
  const rows = state.etfs.filter(
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
        <td class="font-mono text-muted">${escapeHtml(e.lotHint || "100股起")}</td>
        <td class="text-muted">${escapeHtml(e.role)}</td>
        <td class="text-right"><button type="button" class="btn-ghost" data-del-etf="${escapeHtml(e.code)}">移除</button></td>
      </tr>`
    )
    .join("");

  document.querySelectorAll("[data-del-etf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.etfs = state.etfs.filter((x) => x.code !== btn.dataset.delEtf);
      saveState();
      renderEtfs();
      renderJournal();
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

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach((b) => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.id !== `tab-${target}`));
      if (target === "sandbox") setTimeout(redrawCharts, 20);
    });
  });

  ["ctrl-cash", "ctrl-rebal", "ctrl-comm", "ctrl-min5", "ctrl-lookahead"].forEach((id) => {
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
        state.colabReport = parsed;
        saveState();
        renderColabReport();
      } catch (err) {
        alert("导入失败：请选择 Colab 第 1 课生成的 lesson01_summary.json (" + err.message + ")");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("btn-clear-colab").addEventListener("click", () => {
    state.colabReport = null;
    saveState();
    renderColabReport();
  });

  document.getElementById("btn-export-workspace").addEventListener("click", () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`quantlab_backup_${stamp}.json`, JSON.stringify(state, null, 2));
  });

  document.getElementById("import-workspace-json").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.roadmap) || !Array.isArray(parsed.etfs)) throw new Error("备份文件格式不正确");
        state = parsed;
        saveState();
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
    const tag = document.getElementById("note-tag").value;
    const body = document.getElementById("note-body").value.trim();
    if (!title || !body) return;
    state.notes.unshift({
      id: "n_" + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      tag,
      title,
      body,
    });
    saveState();
    e.target.reset();
    renderNotes();
  });

  document.getElementById("btn-export-notes-md").addEventListener("click", () => {
    const md =
      "# A 股量化学习笔记\n\n" +
      state.notes.map((n) => `## [${n.tag}] ${n.title} (${n.date})\n\n${n.body}\n`).join("\n---\n\n");
    downloadText("quant_learning_notes.md", md, "text/markdown");
  });

  document.getElementById("tr-date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("journal-capital").addEventListener("change", (e) => {
    state.journalCapital = Math.max(10000, Number(e.target.value) || 80000);
    saveState();
    renderJournal();
  });

  document.getElementById("trade-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = document.getElementById("tr-code").value;
    const etf = state.etfs.find((x) => x.code === code) || { name: code };
    const price = Number(document.getElementById("tr-price").value);
    const qty = Math.floor(Number(document.getElementById("tr-qty").value) / 100) * 100;
    if (!price || qty < 100) return;
    const comm = Math.max(5.0, price * qty * 0.00025);
    state.trades.push({
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
  });

  document.getElementById("btn-clear-trades").addEventListener("click", () => {
    if (!confirm("确认清空全部模拟交易记录？")) return;
    state.trades = [];
    saveState();
    renderJournal();
  });

  document.getElementById("btn-export-trades-csv").addEventListener("click", () => {
    const header = "日期,代码,名称,方向,成交价,股数,佣金,备注";
    const rows = state.trades.map(
      (t) => `${t.date},${t.code},${t.name},${t.side},${t.price},${t.qty},${t.commission},"${String(t.note || "").replace(/"/g, '""')}"`
    );
    downloadText("paper_trades.csv", "\uFEFF" + [header, ...rows].join("\n"), "text/csv");
  });

  document.getElementById("etf-search").addEventListener("input", renderEtfs);
  document.getElementById("etf-add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = document.getElementById("etf-code").value.trim();
    const name = document.getElementById("etf-name").value.trim();
    const cat = document.getElementById("etf-cat").value.trim();
    const t0 = document.getElementById("etf-t0").value;
    const role = document.getElementById("etf-role").value.trim();
    if (!code || !name) return;
    if (state.etfs.some((x) => x.code === code)) {
      alert("该 ETF 代码已在档案库中");
      return;
    }
    state.etfs.push({ code, name, cat, t0, lotHint: "100股起", role });
    saveState();
    e.target.reset();
    renderEtfs();
    renderJournal();
  });

  document.getElementById("res-add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.resources.push({
      name: document.getElementById("res-name").value.trim(),
      cat: document.getElementById("res-cat").value.trim(),
      desc: document.getElementById("res-desc").value.trim(),
    });
    saveState();
    e.target.reset();
    renderResources();
  });

  window.addEventListener("resize", redrawCharts);
}

function renderAll() {
  renderColabReport();
  updateSandbox();
  renderRoadmap();
  renderNotes();
  renderEtfs();
  renderJournal();
  renderResources();
}

initTheme();
bindEvents();
renderAll();
tryAutoLoadRepoReport();
