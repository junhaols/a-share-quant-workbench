import { runBacktest } from "./backtest.js";

export const WF_LOOKBACK_GRID = [5, 10, 15, 20, 30, 40, 60];
export const WF_REBAL_GRID = [5, 10, 20, 30, 40, 60];

function buildMomentumWeightsWindow(series, cfg, lookback, rebalance, startIdx, endIdx, offsetDays = 0) {
  const { codes, close } = series;
  const safe = cfg.safeCode;
  const riskCodes = codes.filter((c) => c !== safe);
  const len = endIdx - startIdx;
  const weights = new Array(len).fill(null);

  const firstLocal = offsetDays % rebalance;
  for (let local = firstLocal; local < len; local += rebalance) {
    const g = startIdx + local;
    if (g < lookback) continue;
    const scored = riskCodes
      .map((c) => ({ code: c, mom: close[c][g] / close[c][g - lookback] - 1 }))
      .sort((a, b) => b.mom - a.mom);
    const row = {};
    for (const item of scored.slice(0, 2)) {
      const target = item.mom > 0 ? item.code : safe;
      row[target] = (row[target] || 0) + 0.5;
    }
    weights[local] = row;
  }
  return weights;
}

function sliceSeries(series, startIdx, endIdx) {
  const open = {};
  const close = {};
  for (const c of series.codes) {
    open[c] = series.open[c].subarray(startIdx, endIdx);
    close[c] = series.close[c].subarray(startIdx, endIdx);
  }
  return {
    dates: series.dates.slice(startIdx, endIdx),
    codes: series.codes,
    open,
    close,
  };
}

export function runMomentumSlice(series, cfg, { startIdx, endIdx, lookback, rebalance, offsetDays = 0, initialCash, commRate, minComm, slippageRate = 0.0005 }) {
  const sub = sliceSeries(series, startIdx, endIdx);
  const w = buildMomentumWeightsWindow(series, cfg, lookback, rebalance, startIdx, endIdx, offsetDays);
  return runBacktest(sub, {
    weightsByDay: w,
    initialCash,
    commRate,
    minComm,
    slippageRate,
    lookahead: false,
    lotSize: cfg.lotSizes || cfg.lotSize,
  });
}

export function runParameterGrid(series, cfg, opts) {
  const n = series.dates.length;
  const matrix = [];
  const flat = [];

  for (const lb of WF_LOOKBACK_GRID) {
    const row = [];
    for (const rb of WF_REBAL_GRID) {
      const res = runMomentumSlice(series, cfg, {
        startIdx: 0,
        endIdx: n,
        lookback: lb,
        rebalance: rb,
        ...opts,
      });
      const cell = {
        lookback: lb,
        rebalance: rb,
        cagr: res.metrics.cagr,
        sharpe: res.metrics.sharpe,
        maxDd: res.metrics.maxDd,
        costRatio: res.metrics.costRatio,
      };
      row.push(cell);
      flat.push(cell);
    }
    matrix.push(row);
  }

  const sorted = [...flat].sort((a, b) => b.sharpe - a.sharpe);
  const cagrs = flat.map((x) => x.cagr).sort((a, b) => a - b);
  const sharpes = flat.map((x) => x.sharpe).sort((a, b) => a - b);
  const mid = Math.floor(flat.length / 2);

  return {
    lookbacks: WF_LOOKBACK_GRID,
    rebalances: WF_REBAL_GRID,
    matrix,
    best: sorted[0],
    medianCagr: cagrs[mid],
    medianSharpe: sharpes[mid],
  };
}

export function runWalkForwardAnalysis(series, cfg, opts, trainYears = 3) {
  const { dates } = series;
  const yearBounds = new Map();
  for (let i = 0; i < dates.length; i++) {
    const y = Number(dates[i].slice(0, 4));
    if (!yearBounds.has(y)) yearBounds.set(y, { start: i, end: i + 1 });
    else yearBounds.get(y).end = i + 1;
  }
  const years = [...yearBounds.keys()].sort((a, b) => a - b);
  const oosYears = years.filter((y) => y >= years[0] + trainYears);

  const folds = [];
  const oosDates = [];
  const oosDailyRets = [];
  let firstOosIdx = null;
  let lastOosEnd = null;

  for (const testYr of oosYears) {
    const trStartYr = testYr - trainYears;
    const trEndYr = testYr - 1;
    if (!yearBounds.has(trStartYr) || !yearBounds.has(trEndYr)) continue;
    const trStart = yearBounds.get(trStartYr).start;
    const trEnd = yearBounds.get(trEndYr).end;
    const teStart = yearBounds.get(testYr).start;
    const teEnd = yearBounds.get(testYr).end;
    if (teEnd - teStart < 20) continue;

    if (firstOosIdx === null) firstOosIdx = teStart;
    lastOosEnd = teEnd;

    let bestScore = -Infinity;
    let bestPair = [20, 20];
    let bestTr = null;
    for (const lb of WF_LOOKBACK_GRID) {
      for (const rb of WF_REBAL_GRID) {
        const r = runMomentumSlice(series, cfg, { startIdx: trStart, endIdx: trEnd, lookback: lb, rebalance: rb, ...opts });
        if (r.metrics.sharpe > bestScore) {
          bestScore = r.metrics.sharpe;
          bestPair = [lb, rb];
          bestTr = r.metrics;
        }
      }
    }

    const rTe = runMomentumSlice(series, cfg, {
      startIdx: teStart,
      endIdx: teEnd,
      lookback: bestPair[0],
      rebalance: bestPair[1],
      ...opts,
    });
    const eq = rTe.equity;
    for (let k = 0; k < eq.length; k++) {
      oosDates.push(dates[teStart + k]);
      oosDailyRets.push(k === 0 ? 0 : eq[k] / eq[k - 1] - 1);
    }

    folds.push({
      testYear: testYr,
      trainWindow: `${trStartYr}-${trEndYr}`,
      lookback: bestPair[0],
      rebalance: bestPair[1],
      isCagr: bestTr.cagr,
      isSharpe: bestTr.sharpe,
      oosCagr: rTe.metrics.cagr,
      oosSharpe: rTe.metrics.sharpe,
      oosMaxDd: rTe.metrics.maxDd,
    });
  }

  // Stitch Walk-Forward OOS equity curve
  const oosEq = new Float64Array(oosDailyRets.length);
  let curEq = opts.initialCash;
  let peak = curEq;
  let maxDd = 0;
  for (let i = 0; i < oosDailyRets.length; i++) {
    curEq *= 1 + oosDailyRets[i];
    oosEq[i] = curEq;
    if (curEq > peak) peak = curEq;
    const dd = (curEq / peak - 1) * 100;
    if (dd < maxDd) maxDd = dd;
  }
  const oosYrs = Math.max(oosDailyRets.length / 244, 0.25);
  const oosCagr = (Math.pow(curEq / opts.initialCash, 1 / oosYrs) - 1) * 100;
  const meanR = oosDailyRets.reduce((a, b) => a + b, 0) / Math.max(1, oosDailyRets.length);
  const varR = oosDailyRets.reduce((a, b) => a + (b - meanR) ** 2, 0) / Math.max(1, oosDailyRets.length);
  const annVol = Math.sqrt(varR * 244) * 100;
  const oosSharpe = annVol > 1e-6 ? (oosCagr - 2.0) / annVol : 0;

  const avgIsCagr = folds.length ? folds.reduce((a, f) => a + f.isCagr, 0) / folds.length : 0;
  const wfe = Math.abs(avgIsCagr) > 1e-6 ? oosCagr / avgIsCagr : 0;

  // Fixed 20/20 over exact same OOS period
  const fixedRes = firstOosIdx !== null
    ? runMomentumSlice(series, cfg, { startIdx: firstOosIdx, endIdx: lastOosEnd, lookback: 20, rebalance: 20, ...opts })
    : null;

  return {
    folds,
    oosDates,
    oosEq,
    oosSummary: {
      finalEq: curEq,
      cagr: oosCagr,
      sharpe: oosSharpe,
      maxDd,
      avgIsCagr,
      wfe,
    },
    fixed20Summary: fixedRes ? fixedRes.metrics : null,
  };
}

export function runStressTests(series, cfg, opts) {
  const n = series.dates.length;
  const offsets = [0, 4, 8, 12, 16].map((off) => {
    const r = runMomentumSlice(series, cfg, { startIdx: 0, endIdx: n, lookback: 20, rebalance: 20, offsetDays: off, ...opts });
    return { offset: off, cagr: r.metrics.cagr, maxDd: r.metrics.maxDd, sharpe: r.metrics.sharpe };
  });
  const slippages = [5, 15, 30].map((bp) => {
    const r = runMomentumSlice(series, cfg, {
      startIdx: 0,
      endIdx: n,
      lookback: 20,
      rebalance: 20,
      ...opts,
      slippageRate: bp / 10000,
    });
    return { bp, cagr: r.metrics.cagr, maxDd: r.metrics.maxDd, sharpe: r.metrics.sharpe, costRatio: r.metrics.costRatio };
  });
  return { offsets, slippages };
}
