#!/usr/bin/env python3
"""
QuantLab Daily Post-Market Updater (A-Shares + US ETFs + Optional LLM Quant Brief)

Runs in GitHub Actions (or locally) to:
1. Fetch latest daily adjusted OHLCV for configured CN & US ETF universes.
2. Refresh `data/real_etf_daily.json` and `data/real_us_etf_daily.json`.
3. Compute daily returns (1D / 5D / 20D), 20D annualized volatility, momentum rank,
   and current S2/S3 reference signals into `data/daily_snapshot.json`.
4. Optionally call an OpenAI-compatible LLM (default model: `deepseek-flash`)
   using `LLM_API_KEY` + `LLM_BASE_URL` env vars to generate a structured JSON
   quant brief and append it to `data/ai_brief_history.json`.

Security: Never hardcode API keys here. Provide `LLM_API_KEY` via GitHub Secrets
or your local `.env` file.
"""

from __future__ import annotations

import datetime
import json
import math
import os
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

MARKET_CONFIGS = {
    "cn": {
        "name": "A股市场 (CN)",
        "currency": "¥",
        "lot_size": 100,
        "default_cash": 80000,
        "safe_code": "511010",
        "real_json": DATA_DIR / "real_etf_daily.json",
        "etfs": [
            {"code": "510300", "name": "沪深300ETF", "yf": "510300.SS", "role": "A股大盘"},
            {"code": "510500", "name": "中证500ETF", "yf": "510500.SS", "role": "A股中盘"},
            {"code": "159915", "name": "创业板ETF", "yf": "159915.SZ", "role": "成长弹性"},
            {"code": "510880", "name": "红利ETF", "yf": "510880.SS", "role": "高股息防御"},
            {"code": "518880", "name": "黄金ETF", "yf": "518880.SS", "role": "避险抗通胀"},
            {"code": "513100", "name": "纳指ETF", "yf": "513100.SS", "role": "美股跨境"},
            {"code": "511010", "name": "国债ETF", "yf": "511010.SS", "role": "低波压舱石"},
        ],
    },
    "us": {
        "name": "美股市场 (US)",
        "currency": "$",
        "lot_size": 1,
        "default_cash": 10000,
        "safe_code": "SHY",
        "real_json": DATA_DIR / "real_us_etf_daily.json",
        "etfs": [
            {"code": "SPY", "name": "标普500 ETF", "yf": "SPY", "role": "美股大盘"},
            {"code": "QQQ", "name": "纳斯达克100 ETF", "yf": "QQQ", "role": "美股科技"},
            {"code": "IWM", "name": "罗素2000 ETF", "yf": "IWM", "role": "美股小盘"},
            {"code": "SCHD", "name": "美股红利 ETF", "yf": "SCHD", "role": "高股息防御"},
            {"code": "GLD", "name": "SPDR 黄金 ETF", "yf": "GLD", "role": "大宗避险"},
            {"code": "TLT", "name": "20年期美债 ETF", "yf": "TLT", "role": "长久期国债"},
            {"code": "SHY", "name": "1-3年美债 ETF", "yf": "SHY", "role": "短债泊车位"},
        ],
    },
}


def fetch_series_yfinance(ticker: str, start: str = "2018-01-01") -> pd.DataFrame | None:
    try:
        import yfinance as yf

        df = yf.download(ticker, start=start, auto_adjust=True, progress=False, threads=False)
        if df is None or len(df) < 60:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]
        df = df.reset_index()
        date_col = "Date" if "Date" in df.columns else df.columns[0]
        out = pd.DataFrame(
            {
                "date": pd.to_datetime(df[date_col]).dt.tz_localize(None),
                "open": pd.to_numeric(df["Open"], errors="coerce"),
                "close": pd.to_numeric(df["Close"], errors="coerce"),
            }
        ).dropna()
        return out.sort_values("date").drop_duplicates("date")
    except Exception as exc:
        print(f"  [warn] yfinance failed for {ticker}: {exc}")
        return None


def fetch_cn_akshare(code: str, start: str = "20180101") -> pd.DataFrame | None:
    try:
        import akshare as ak

        end = datetime.date.today().strftime("%Y%m%d")
        df = ak.fund_etf_hist_em(symbol=code, period="daily", start_date=start, end_date=end, adjust="qfq")
        if df is None or len(df) < 60:
            return None
        out = pd.DataFrame(
            {
                "date": pd.to_datetime(df["日期"]),
                "open": pd.to_numeric(df["开盘"], errors="coerce"),
                "close": pd.to_numeric(df["收盘"], errors="coerce"),
            }
        ).dropna()
        return out.sort_values("date").drop_duplicates("date")
    except Exception as exc:
        print(f"  [warn] akshare failed for {code}: {exc}")
        return None


def refresh_market_real_json(market_id: str, cfg: dict, allow_fetch: bool = True) -> dict | None:
    real_path: Path = cfg["real_json"]
    if allow_fetch:
        frames = {}
        for item in cfg["etfs"]:
            df = fetch_series_yfinance(item["yf"])
            if df is None and market_id == "cn":
                df = fetch_cn_akshare(item["code"])
            if df is not None:
                frames[item["code"]] = df.set_index("date")
                print(f"  [{market_id}] fetched {item['code']} ({len(df)} rows)")

        if len(frames) == len(cfg["etfs"]):
            codes = [x["code"] for x in cfg["etfs"]]
            close_df = pd.DataFrame({c: frames[c]["close"] for c in codes}).sort_index()
            open_df = pd.DataFrame({c: frames[c]["open"] for c in codes}).sort_index()
            common_start = max(close_df[c].first_valid_index() for c in codes)
            close_df = close_df.loc[common_start:, codes].ffill()
            open_df = open_df.loc[common_start:, codes].fillna(close_df)
            payload = {
                "source": f"GitHub Actions Daily Update ({market_id.upper()})",
                "date_range": [str(close_df.index[0].date()), str(close_df.index[-1].date())],
                "codes": codes,
                "dates": [d.strftime("%Y-%m-%d") for d in close_df.index],
                "open": {c: [round(float(v), 4) for v in open_df[c].values] for c in codes},
                "close": {c: [round(float(v), 4) for v in close_df[c].values] for c in codes},
            }
            real_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
            print(f"  [{market_id}] updated {real_path.name} ({len(payload['dates'])} trading days)")
            return payload

    if real_path.exists():
        print(f"  [{market_id}] reusing existing {real_path.name}")
        return json.loads(real_path.read_text(encoding="utf-8"))
    return None


def compute_market_snapshot(market_id: str, cfg: dict, series_payload: dict) -> dict:
    dates = series_payload["dates"]
    close_map = series_payload["close"]
    latest_date = dates[-1]
    safe_code = cfg["safe_code"]
    lot_size = cfg["lot_size"]
    default_cash = cfg["default_cash"]

    rows = []
    for item in cfg["etfs"]:
        c = item["code"]
        arr = np.asarray(close_map[c], dtype=np.float64)
        px = float(arr[-1])
        r1 = (arr[-1] / arr[-2] - 1.0) * 100 if len(arr) >= 2 else 0.0
        r5 = (arr[-1] / arr[-6] - 1.0) * 100 if len(arr) >= 6 else 0.0
        r20 = (arr[-1] / arr[-21] - 1.0) * 100 if len(arr) >= 21 else 0.0
        r60 = (arr[-1] / arr[-61] - 1.0) * 100 if len(arr) >= 61 else 0.0
        daily_r = np.diff(arr[-21:]) / arr[-21:-1] if len(arr) >= 21 else np.array([0.0])
        vol20 = float(np.std(daily_r) * math.sqrt(252) * 100)
        ma20 = float(np.mean(arr[-20:])) if len(arr) >= 20 else px
        above_ma20 = px >= ma20

        rows.append(
            {
                "code": c,
                "name": item["name"],
                "role": item["role"],
                "close": round(px, 4),
                "ret_1d_pct": round(r1, 2),
                "ret_5d_pct": round(r5, 2),
                "ret_20d_pct": round(r20, 2),
                "ret_60d_pct": round(r60, 2),
                "vol_20d_pct": round(vol20, 2),
                "above_ma20": above_ma20,
                "is_safe": c == safe_code,
            }
        )

    risk_rows = sorted([r for r in rows if not r["is_safe"]], key=lambda x: x["ret_20d_pct"], reverse=True)
    top2 = risk_rows[:2]
    target_weights: dict[str, float] = {}
    for r in top2:
        chosen = r["code"] if r["ret_20d_pct"] > 0 else safe_code
        target_weights[chosen] = target_weights.get(chosen, 0.0) + 0.5

    row_by_code = {r["code"]: r for r in rows}
    order_plan = []
    for c, wt in target_weights.items():
        px = row_by_code[c]["close"]
        lots = int((default_cash * wt) // (px * lot_size))
        qty = lots * lot_size
        order_plan.append(
            {
                "code": c,
                "name": row_by_code[c]["name"],
                "weight_pct": round(wt * 100, 1),
                "ref_price": px,
                "qty": qty,
                "est_amount": round(qty * px, 1),
            }
        )

    # Mark status badge on each row
    selected_codes = set(target_weights.keys())
    for r in rows:
        if r["code"] in selected_codes:
            r["signal_tag"] = "避险入选" if r["is_safe"] else "动量Top2入选"
        elif r["ret_20d_pct"] > 0 and r["above_ma20"]:
            r["signal_tag"] = "趋势偏强"
        elif r["ret_20d_pct"] < -5:
            r["signal_tag"] = "弱势观察"
        else:
            r["signal_tag"] = "中性震荡"

    rows_sorted = sorted(rows, key=lambda x: (x["is_safe"], -x["ret_20d_pct"]))
    return {
        "market_id": market_id,
        "market_name": cfg["name"],
        "currency": cfg["currency"],
        "as_of_date": latest_date,
        "trading_days_total": len(dates),
        "default_cash": default_cash,
        "lot_size": lot_size,
        "etfs": rows_sorted,
        "momentum_signal": {
            "rule": "20日动量 Top2 + 负动量切入避险资产",
            "top2_candidates": [{"code": r["code"], "name": r["name"], "ret_20d_pct": r["ret_20d_pct"]} for r in top2],
            "target_plan": order_plan,
        },
    }


def build_rule_based_brief(markets_snap: dict) -> dict:
    market_sections = []
    key_metrics = []
    risks = []
    headline_parts = []

    for mid, snap in markets_snap.items():
        etfs = snap["etfs"]
        risk_etfs = [e for e in etfs if not e["is_safe"]]
        pos_etfs = [e for e in risk_etfs if e["ret_20d_pct"] > 0]
        leader = max(risk_etfs, key=lambda e: e["ret_20d_pct"])
        laggard = min(risk_etfs, key=lambda e: e["ret_20d_pct"])
        high_vol = sorted([e for e in risk_etfs if e["vol_20d_pct"] >= 22.0], key=lambda x: -x["vol_20d_pct"])
        plan_text = " + ".join(f"{p['name']} {p['weight_pct']:.0f}%" for p in snap["momentum_signal"]["target_plan"])

        ratio = len(pos_etfs) / max(1, len(risk_etfs))
        if ratio >= 0.67:
            m_status = "多头占优"
        elif ratio >= 0.34:
            m_status = "结构分化"
        else:
            m_status = "偏弱防御"

        market_sections.append(
            {
                "market": snap["market_name"],
                "as_of": snap["as_of_date"],
                "status": m_status,
                "points": [
                    f"动量广度：{len(pos_etfs)}/{len(risk_etfs)} 只进攻标的 20 日动量为正，整体处于「{m_status}」格局。",
                    f"强弱分化：领涨 {leader['name']}（20日 {leader['ret_20d_pct']:+.2f}% / 今日 {leader['ret_1d_pct']:+.2f}%），最弱 {laggard['name']}（20日 {laggard['ret_20d_pct']:+.2f}%）。",
                    f"模型信号：按月度动量+避险规则，当前参考组合为「{plan_text}」。",
                ],
            }
        )

        if mid == "cn" or not key_metrics:
            key_metrics = [
                {"label": "正动量广度", "value": f"{len(pos_etfs)} / {len(risk_etfs)}"},
                {"label": "20日领涨", "value": f"{leader['name']} {leader['ret_20d_pct']:+.2f}%"},
                {"label": "20日最弱", "value": f"{laggard['name']} {laggard['ret_20d_pct']:+.2f}%"},
                {"label": "当前参考信号", "value": plan_text},
            ]
            headline_parts.append(f"{snap['market_name'].split(' ')[0]}{m_status}：{leader['name']}领跑，信号指向「{plan_text}」")

        if high_vol:
            names = "、".join(f"{x['name']}(波动{x['vol_20d_pct']:.1f}%)" for x in high_vol[:2])
            risks.append(f"【高波动提醒】{snap['market_name']}中 {names} 20 日年化波动偏高，注意控制单标的仓位与滑点。")
        below_ma = [e for e in risk_etfs if not e.get("above_ma20", True)]
        if len(below_ma) >= len(risk_etfs) - 1:
            risks.append(f"【趋势偏弱】{snap['market_name']}多数进攻型 ETF 位于 20 日均线下方，宜依靠避险资产控制回撤，避免盲目抄底。")

    if not risks:
        risks.append("【常规波动】当前核心 ETF 波动率处于正常区间，保持既定低频调仓与样本外纪律。")

    cn = markets_snap.get("cn")
    score = 0
    if cn:
        risk_cn = [e for e in cn["etfs"] if not e["is_safe"]]
        avg20 = float(np.mean([e["ret_20d_pct"] for e in risk_cn]))
        if avg20 > 6:
            score = 2
        elif avg20 > 2:
            score = 1
        elif avg20 < -6:
            score = -2
        elif avg20 < -2:
            score = -1

    headline = "；".join(headline_parts) if headline_parts else "多市场盘后量化监控简报"
    summary = " ".join(s["points"][0] + " " + s["points"][1] for s in market_sections)

    return {
        "source": "rule_based_quant_engine",
        "model": "规则量化引擎 (配置 LLM_API_KEY 后自动切 deepseek-flash)",
        "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sentiment_score": score,
        "regime": market_sections[0]["status"] if market_sections else "中性观察",
        "headline": headline,
        "summary": summary,
        "key_metrics": key_metrics,
        "market_sections": market_sections,
        "risk_alerts": risks,
        "action_notes": [
            "纪律优先：学习阶段仅做模拟盘记录与复盘，不因单日涨跌临时更改调仓周期。",
            "成本意识：若调仓仅涉及微小权重变化，10 万以内资金应避免触发无意义的最低 ¥5 佣金。",
            "接入大模型：在仓库 Settings → Secrets 添加 LLM_API_KEY 后，盘后简报将自动由 deepseek-flash 生成。",
        ],
    }


def call_llm_brief(markets_snap: dict) -> dict | None:
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        return None
    base_url = (os.environ.get("LLM_BASE_URL") or "https://api.deepseek.com/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL") or "deepseek-flash"

    base_brief = build_rule_based_brief(markets_snap)

    compact_ctx = {}
    for mid, snap in markets_snap.items():
        compact_ctx[mid] = {
            "as_of": snap["as_of_date"],
            "etfs": [
                {
                    "code": e["code"],
                    "name": e["name"],
                    "ret_1d": e["ret_1d_pct"],
                    "ret_5d": e["ret_5d_pct"],
                    "ret_20d": e["ret_20d_pct"],
                    "vol_20d": e["vol_20d_pct"],
                    "above_ma20": e.get("above_ma20"),
                    "signal": e["signal_tag"],
                }
                for e in snap["etfs"]
            ],
            "target_plan": snap["momentum_signal"]["target_plan"],
        }

    system_prompt = (
        "你是一位严谨、克制、擅长信息结构化排版的金融量化投研总监，服务于零基础量化学习者。"
        "严禁预测明天绝对涨跌或承诺收益。请基于多市场 ETF 客观量价与动量数据，输出简洁、一目了然、便于 10 秒扫读的合法 JSON（不要 Markdown 代码块包裹）：\n"
        "{\n"
        '  "sentiment_score": -2到2的整数（-2极度谨慎,-1偏谨慎,0中性,1偏积极,2强势偏多）,\n'
        '  "regime": "4-8字市场定调，如 防御避险 / 结构轮动",\n'
        '  "headline": "28字以内一句话核心结论",\n'
        '  "summary": "80字以内极简总览",\n'
        '  "market_sections": [\n'
        '    {"market": "A股市场 (CN)", "status": "4字状态", "points": ["要点1（带具体涨跌幅）", "要点2（强弱与避险解读）"]}\n'
        '  ],\n'
        '  "risk_alerts": ["【标签】简明风险提示1", "【标签】简明风险提示2"],\n'
        '  "action_notes": ["面向学习者的纪律建议1", "建议2", "建议3"]\n'
        "}"
    )
    user_prompt = f"以下是最新盘后 ETF 量化快照数据，请生成结构化易读的今日投研与风控简报：\n{json.dumps(compact_ctx, ensure_ascii=False)}"

    req_body = json.dumps(
        {
            "model": model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=req_body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = content.strip("`").removeprefix("json").strip()
        parsed = json.loads(content)
        return {
            "source": "llm",
            "model": model,
            "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "sentiment_score": int(parsed.get("sentiment_score", base_brief["sentiment_score"])),
            "regime": str(parsed.get("regime", base_brief["regime"])),
            "headline": str(parsed.get("headline", base_brief["headline"])),
            "summary": str(parsed.get("summary", base_brief["summary"])),
            "key_metrics": base_brief["key_metrics"],
            "market_sections": list(parsed.get("market_sections") or base_brief["market_sections"]),
            "risk_alerts": list(parsed.get("risk_alerts") or base_brief["risk_alerts"])[:4],
            "action_notes": list(parsed.get("action_notes") or base_brief["action_notes"])[:4],
        }
    except Exception as exc:
        print(f"[warn] LLM brief call failed ({model}): {exc}")
        return None


def main() -> None:
    allow_fetch = os.environ.get("SKIP_REMOTE_FETCH", "0") != "1"
    markets_snap = {}
    for mid, cfg in MARKET_CONFIGS.items():
        series = refresh_market_real_json(mid, cfg, allow_fetch=allow_fetch)
        if series:
            markets_snap[mid] = compute_market_snapshot(mid, cfg, series)

    if not markets_snap:
        raise RuntimeError("No market series available to build daily snapshot.")

    ai_brief = call_llm_brief(markets_snap) or build_rule_based_brief(markets_snap)

    snapshot = {
        "updated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "markets": markets_snap,
        "ai_brief": ai_brief,
    }
    snap_path = DATA_DIR / "daily_snapshot.json"
    snap_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {snap_path} (markets: {list(markets_snap.keys())}, brief: {ai_brief['source']})")

    # Append rolling 30-day history of daily AI briefs
    hist_path = DATA_DIR / "ai_brief_history.json"
    history = []
    if hist_path.exists():
        try:
            history = json.loads(hist_path.read_text(encoding="utf-8"))
        except Exception:
            history = []
    today_key = next(iter(markets_snap.values()))["as_of_date"]
    entry = {"date": today_key, **ai_brief}
    history = [h for h in history if h.get("date") != today_key]
    history.insert(0, entry)
    history = history[:30]
    hist_path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {hist_path} ({len(history)} records)")


if __name__ == "__main__":
    main()
