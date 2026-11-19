function getThemeColors() {
  const cs = getComputedStyle(document.documentElement);
  const read = (v, fb) => cs.getPropertyValue(v).trim() || fb;
  return {
    fg: read("--fg", "#0f172a"),
    muted: read("--muted", "#64748b"),
    border: read("--border", "#e2e8f0"),
    c1: read("--chart-1", "#2563eb"),
    c2: read("--chart-2", "#059669"),
    c3: read("--chart-3", "#dc2626"),
  };
}

function formatAxisMoney(val, currency) {
  if (Math.abs(val) >= 10000) {
    return `${currency}${(val / 1000).toFixed(0)}k`;
  }
  return `${currency}${(val / 1000).toFixed(1)}k`;
}

export function drawLineChart(canvas, dates, seriesList, { isDrawdown, initialCash, hoverIdx, currency = "¥" }) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 10) return;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const pad = { top: 14, right: 16, bottom: 24, left: 66 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const tc = getThemeColors();
  const colorMap = { "--chart-1": tc.c1, "--chart-2": tc.c2, "--chart-3": tc.c3 };

  ctx.clearRect(0, 0, W, H);

  const n = dates.length;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const s of seriesList) {
    const arr = isDrawdown ? s.drawdown : s.equity;
    for (let i = 0; i < n; i++) {
      if (arr[i] < yMin) yMin = arr[i];
      if (arr[i] > yMax) yMax = arr[i];
    }
  }
  if (isDrawdown) {
    yMax = 0;
    yMin = Math.min(-5, Math.floor(yMin / 5) * 5);
  } else {
    const span = Math.max(initialCash * 0.05, yMax - yMin);
    yMin = Math.max(0, yMin - span * 0.06);
    yMax = yMax + span * 0.06;
  }

  const xOf = (i) => pad.left + (i / (n - 1)) * plotW;
  const yOf = (v) => pad.top + ((yMax - v) / Math.max(1e-6, yMax - yMin)) * plotH;

  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const ticks = isDrawdown ? 3 : 4;
  for (let t = 0; t <= ticks; t++) {
    const val = yMin + ((yMax - yMin) * t) / ticks;
    const y = yOf(val);
    ctx.strokeStyle = tc.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = tc.muted;
    const label = isDrawdown ? `${val.toFixed(0)}%` : formatAxisMoney(val, currency);
    ctx.fillText(label, pad.left - 8, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = tc.muted;
  if (n <= 160) {
    // 短区间（模拟盘等）：按月-日标注，约 6 个刻度
    const step = Math.max(1, Math.ceil(n / 6));
    for (let i = 0; i < n; i += step) ctx.fillText(dates[i].slice(5), xOf(i), H - pad.bottom + 6);
  } else {
    let lastYr = "";
    for (let i = 0; i < n; i += 60) {
      const yr = dates[i].slice(0, 4);
      if (yr !== lastYr) {
        lastYr = yr;
        ctx.fillText(yr, xOf(i), H - pad.bottom + 6);
      }
    }
  }

  if (!isDrawdown) {
    const y0 = yOf(initialCash);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = tc.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y0);
    ctx.lineTo(W - pad.right, y0);
    ctx.stroke();
    ctx.restore();
  }

  const step = Math.max(1, Math.floor(n / 520));
  for (const s of seriesList) {
    const arr = isDrawdown ? s.drawdown : s.equity;
    const col = colorMap[s.colorVar];
    ctx.strokeStyle = col;
    ctx.lineWidth = isDrawdown ? 1.4 : 2;
    ctx.beginPath();
    for (let i = 0; i < n; i += step) {
      const x = xOf(i);
      const y = yOf(arr[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(xOf(n - 1), yOf(arr[n - 1]));
    ctx.stroke();

    if (isDrawdown) {
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = col;
      ctx.lineTo(xOf(n - 1), yOf(0));
      ctx.lineTo(xOf(0), yOf(0));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < n) {
    const hx = xOf(hoverIdx);
    ctx.save();
    ctx.strokeStyle = tc.muted;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, pad.top);
    ctx.lineTo(hx, H - pad.bottom);
    ctx.stroke();
    ctx.restore();

    for (const s of seriesList) {
      const arr = isDrawdown ? s.drawdown : s.equity;
      const hy = yOf(arr[hoverIdx]);
      ctx.fillStyle = colorMap[s.colorVar];
      ctx.beginPath();
      ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
