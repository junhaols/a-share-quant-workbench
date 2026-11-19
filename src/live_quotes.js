// 实时行情：腾讯财经 qt.gtimg.cn（HTTPS、允许跨域、GBK 编码）
// 字段（以 ~ 分隔）：1 名称 2 代码 3 最新价 4 昨收 5 今开 30 时间 31 涨跌 32 涨跌幅% 33 最高 34 最低

const ENDPOINT = "https://qt.gtimg.cn/q=";

export const LIVE_INDICES = [
  { sym: "sh000001", market: "cn", name: "上证指数" },
  { sym: "sz399001", market: "cn", name: "深证成指" },
  { sym: "sh000300", market: "cn", name: "沪深300" },
  { sym: "sz399006", market: "cn", name: "创业板指" },
  { sym: "sh000688", market: "cn", name: "科创50" },
  { sym: "hkHSI", market: "global", name: "恒生指数" },
  { sym: "hkHSTECH", market: "global", name: "恒生科技" },
  { sym: "us.DJI", market: "us", name: "道琼斯" },
  { sym: "us.IXIC", market: "us", name: "纳斯达克" },
  { sym: "us.INX", market: "us", name: "标普500" },
];

// 本站标的代码 → 腾讯行情代码
export function toLiveSymbol(marketId, code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  if (marketId === "cn") {
    if (!/^\d{6}$/.test(c)) return null;
    // 5/6/9 开头在上交所，其余（0/1/2/3）在深交所
    return (/^[569]/.test(c) ? "sh" : "sz") + c;
  }
  if (marketId === "us") {
    return /^[A-Z.\-]{1,6}$/.test(c) ? `us${c.replace(/\./g, "")}` : null;
  }
  if (marketId === "global") {
    const m = c.match(/^(\d{1,5})\.HK$/);
    return m ? `hk${m[1].padStart(5, "0")}` : null;
  }
  return null;
}

function parseLine(line) {
  const m = line.match(/^v_([^=]+)="(.*)";?$/);
  if (!m || !m[2]) return null;
  const f = m[2].split("~");
  if (f.length < 35) return null;
  const num = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  const price = num(f[3]);
  const prev = num(f[4]);
  if (price === null || prev === null || price === 0) return null;
  return {
    sym: m[1],
    name: f[1],
    price,
    prevClose: prev,
    open: num(f[5]),
    time: formatTime(f[30]),
    change: num(f[31]) ?? price - prev,
    pct: num(f[32]) ?? (prev ? (price / prev - 1) * 100 : 0),
    high: num(f[33]),
    low: num(f[34]),
  };
}

function formatTime(raw) {
  const t = String(raw || "").trim();
  if (/^\d{14}$/.test(t)) return `${t.slice(4, 6)}-${t.slice(6, 8)} ${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}`;
  const m = t.match(/^\d{4}[-/](\d{2})[-/](\d{2}) (\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]}-${m[2]} ${m[3]}` : t;
}

export async function fetchLiveQuotes(symbols) {
  const list = [...new Set(symbols.filter(Boolean))];
  if (!list.length) return {};
  const out = {};
  // 分批请求，避免单个 URL 过长
  for (let i = 0; i < list.length; i += 40) {
    const batch = list.slice(i, i + 40);
    const resp = await fetch(ENDPOINT + batch.join(","), { cache: "no-store" });
    if (!resp.ok) throw new Error(`行情接口返回 HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    let text;
    try {
      text = new TextDecoder("gbk").decode(buf);
    } catch (_) {
      text = new TextDecoder().decode(buf);
    }
    for (const line of text.split(/;\s*\n?/)) {
      const q = parseLine(line.trim() + ";");
      if (q) out[q.sym] = q;
    }
  }
  return out;
}

// 交易时段判断（按各市场当地时间，未计入节假日）
const SESSIONS = {
  cn: { tz: "Asia/Shanghai", label: "A股", windows: [["09:30", "11:30"], ["13:00", "15:00"]] },
  global: { tz: "Asia/Hong_Kong", label: "港股", windows: [["09:30", "12:00"], ["13:00", "16:00"]] },
  us: { tz: "America/New_York", label: "美股", windows: [["09:30", "16:00"]] },
};

export function marketSession(marketId, now = new Date()) {
  const s = SESSIONS[marketId];
  if (!s) return { open: false, text: "" };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: s.tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const hm = `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
  const weekend = parts.weekday === "Sat" || parts.weekday === "Sun";
  if (weekend) return { open: false, text: `${s.label}周末休市` };
  const inWin = s.windows.some(([a, b]) => hm >= a && hm < b);
  if (inWin) return { open: true, text: `${s.label}交易中（当地 ${hm}）` };
  const first = s.windows[0][0];
  const last = s.windows[s.windows.length - 1][1];
  if (hm < first) return { open: false, text: `${s.label}未开盘（当地 ${hm}）` };
  if (hm >= last) return { open: false, text: `${s.label}已收盘（当地 ${hm}）` };
  return { open: false, text: `${s.label}午间休市（当地 ${hm}）` };
}
