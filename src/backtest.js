export function runBacktest(market, { weightsByDay, initialCash, commRate, minComm, slippageRate, lookahead }) {
  const { dates, codes, open, close } = market;
  const n = dates.length;
  let cash = initialCash;
  const shares = {};
  codes.forEach((c) => { shares[c] = 0; });

  let totalComm = 0;
  let totalSlip = 0;
  let trades = 0;
  const equity = new Float64Array(n);
  const drawdown = new Float64Array(n);
  let peak = initialCash;

  for (let i = 0; i < n; i++) {
    const sigIdx = lookahead ? i : i - 1;
    const targetW = sigIdx >= 0 ? weightsByDay[sigIdx] : null;
    const execPxMap = lookahead ? close : open;

    if (targetW) {
      let portVal = cash;
      for (const c of codes) portVal += shares[c] * execPxMap[c][i];

      const targetShares = {};
      for (const c of codes) {
        const w = targetW[c] || 0;
        const p = execPxMap[c][i];
        if (w <= 0 || p <= 0) {
          targetShares[c] = 0;
        } else {
          const budget = portVal * w * (1 - commRate - slippageRate - 0.002);
          const lots = Math.floor(budget / (p * 100));
          targetShares[c] = Math.max(0, lots * 100);
        }
      }

      // Sell first to free cash
      for (const c of codes) {
        const diff = targetShares[c] - shares[c];
        if (diff < 0) {
          const qty = -diff;
          const rawP = execPxMap[c][i];
          const fillP = rawP * (1 - slippageRate);
          const gross = qty * fillP;
          const comm = Math.max(minComm, gross * commRate);
          cash += gross - comm;
          shares[c] -= qty;
          totalComm += comm;
          totalSlip += qty * rawP * slippageRate;
          trades++;
        }
      }

      // Buy next in 100-share lots
      for (const c of codes) {
        const diff = targetShares[c] - shares[c];
        if (diff > 0) {
          const rawP = execPxMap[c][i];
          const fillP = rawP * (1 + slippageRate);
          const maxLots = Math.floor(Math.max(0, cash - minComm) / (fillP * 100 * (1 + commRate)));
          const qty = Math.min(diff, maxLots * 100);
          if (qty > 0) {
            const gross = qty * fillP;
            const comm = Math.max(minComm, gross * commRate);
            if (cash >= gross + comm) {
              cash -= gross + comm;
              shares[c] += qty;
              totalComm += comm;
              totalSlip += qty * rawP * slippageRate;
              trades++;
            }
          }
        }
      }
    }

    let eq = cash;
    for (const c of codes) eq += shares[c] * close[c][i];
    equity[i] = eq;
    if (eq > peak) peak = eq;
    drawdown[i] = (eq / peak - 1) * 100;
  }

  const years = n / 244;
  const finalEq = equity[n - 1];
  const totalRet = (finalEq / initialCash - 1) * 100;
  const cagr = (Math.pow(finalEq / initialCash, 1 / years) - 1) * 100;

  let sumR = 0;
  let sumR2 = 0;
  for (let i = 1; i < n; i++) {
    const r = equity[i] / equity[i - 1] - 1;
    sumR += r;
    sumR2 += r * r;
  }
  const meanR = sumR / (n - 1);
  const varR = Math.max(0, sumR2 / (n - 1) - meanR * meanR);
  const annVol = Math.sqrt(varR * 244) * 100;
  const sharpe = annVol > 1e-6 ? (cagr - 2.0) / annVol : 0;
  let maxDd = 0;
  for (let i = 0; i < n; i++) if (drawdown[i] < maxDd) maxDd = drawdown[i];

  return {
    equity,
    drawdown,
    metrics: {
      finalEq,
      totalRet,
      cagr,
      maxDd,
      sharpe,
      trades,
      totalComm,
      totalSlip,
      costRatio: ((totalComm + totalSlip) / initialCash) * 100,
    },
  };
}

export function buildStrategyWeights(market, rebalEvery) {
  const { dates, codes, close } = market;
  const n = dates.length;
  const riskCodes = codes.filter((c) => c !== "511010");

  // S1: Buy & Hold CSI300
  const w1 = new Array(n).fill(null);
  w1[0] = { "510300": 1.0 };

  // S2: All-Weather quarterly rebalance
  const w2 = new Array(n).fill(null);
  const aw = { "511010": 0.40, "510300": 0.20, "510880": 0.15, "513100": 0.15, "518880": 0.10 };
  for (let i = 0; i < n; i += 60) w2[i] = aw;

  // S3: Momentum top 2 + China 5Y Bond safety filter
  const w3 = new Array(n).fill(null);
  const lb = 20;
  for (let i = lb; i < n; i += rebalEvery) {
    const scored = riskCodes
      .map((c) => ({ code: c, mom: close[c][i] / close[c][i - lb] - 1 }))
      .sort((a, b) => b.mom - a.mom);
    const row = {};
    for (const item of scored.slice(0, 2)) {
      const target = item.mom > 0 ? item.code : "511010";
      row[target] = (row[target] || 0) + 0.5;
    }
    w3[i] = row;
  }

  return [
    { key: "S1", name: "S1 沪深300买入持有", weights: w1, colorVar: "--chart-1" },
    { key: "S2", name: "S2 股债金全天候平衡", weights: w2, colorVar: "--chart-2" },
    { key: "S3", name: "S3 ETF动量+国债避险", weights: w3, colorVar: "--chart-3" },
  ];
}
