"""
real_data_fetcher.py
====================
Loads live market data from market_data.json and provides a refresh mechanism
that re-fetches from public APIs (World Bank, Google Trends via pytrends).

Usage:
  from real_data_fetcher import get_market_data, refresh_market_data

The module caches the loaded JSON in memory and re-reads the file only when
the file has changed on disk or `force=True` is passed to refresh_market_data().

Live refresh fetches:
  - World Bank WDI API (no auth required)
  - Google Trends via pytrends (no auth required)
  These are written back to market_data.json so all endpoints use fresh data.
"""

import json
import os
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger("placementiq.real_data")

DATA_FILE = Path(__file__).parent / "data" / "market_data.json"
REFRESH_INTERVAL_HOURS = 24

# ── In-memory cache ────────────────────────────────────────────────────────────
_cache: Optional[dict] = None
_cache_mtime: float = 0.0


def get_market_data(force_reload: bool = False) -> dict:
    """Return the current market data dict, loading from file if needed."""
    global _cache, _cache_mtime

    if not DATA_FILE.exists():
        logger.warning("market_data.json not found — returning empty market data")
        return {}

    current_mtime = DATA_FILE.stat().st_mtime
    if force_reload or _cache is None or current_mtime != _cache_mtime:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            _cache = json.load(f)
        _cache_mtime = current_mtime
        logger.info(f"Loaded market_data.json (fetched_at: {_cache.get('_meta', {}).get('fetched_at', 'unknown')})")

    return _cache


def get_macro_climate_index() -> float:
    """Return macro_climate_index from real data, fallback 0.65."""
    data = get_market_data()
    return data.get("macro", {}).get("macro_climate_index", 0.65)


def get_field_demand(field: str, region: str) -> dict:
    """
    Return demand info for a specific field × region cell.
    Returns dict with: demand_score, trend, risk_level, top_roles, avg_fresher_salary_inr
    """
    data = get_market_data()
    field_data = data.get("field_demand", {})
    cell = field_data.get(field, {}).get(region, None)
    if cell is None:
        # Fallback defaults per field if region/field not found
        defaults = {"Engineering": 60, "MBA": 55, "Nursing": 65}
        return {
            "demand_score": defaults.get(field, 60),
            "trend": "0.0%",
            "risk_level": "MEDIUM",
            "top_roles": [],
            "avg_fresher_salary_inr": 0,
            "notes": "No live data available for this cell",
        }
    return cell


def get_active_shocks() -> list:
    """Return list of active placement shocks from real market data."""
    data = get_market_data()
    return data.get("active_shocks", [])


def get_positive_signals() -> list:
    """Return positive market signals."""
    data = get_market_data()
    return data.get("positive_signals", [])


def get_overall_sentiment() -> str:
    return get_market_data().get("overall_market_sentiment", "NEUTRAL")


def should_refresh() -> bool:
    """True if market_data.json is older than REFRESH_INTERVAL_HOURS."""
    data = get_market_data()
    fetched_str = data.get("_meta", {}).get("fetched_at")
    if not fetched_str:
        return True
    try:
        fetched_dt = datetime.strptime(fetched_str, "%Y-%m-%d")
        return datetime.utcnow() - fetched_dt > timedelta(hours=REFRESH_INTERVAL_HOURS)
    except (ValueError, TypeError):
        return True


def refresh_market_data(force: bool = False) -> dict:
    """
    Re-fetch live data from World Bank + Google Trends and write market_data.json.
    Only runs if data is stale (>24h) or force=True.
    Returns the updated data dict.
    """
    if not force and not should_refresh():
        logger.info("Market data is fresh — skipping refresh")
        return get_market_data()

    logger.info("Refreshing market data from live sources...")
    data = get_market_data(force_reload=True)

    # ── World Bank API (no auth) ────────────────────────────────────────────
    try:
        import httpx
        wb_base = "https://api.worldbank.org/v2/country/IN/indicator"

        def _wb_latest(indicator: str) -> Optional[float]:
            url = f"{wb_base}/{indicator}?format=json&mrv=3"
            r = httpx.get(url, timeout=10.0)
            r.raise_for_status()
            entries = r.json()[1]
            for entry in entries:
                if entry.get("value") is not None:
                    return round(entry["value"], 3)
            return None

        unemp = _wb_latest("SL.UEM.TOTL.ZS")
        gdp = _wb_latest("NY.GDP.MKTP.KD.ZG")
        services = _wb_latest("SL.SRV.EMPL.ZS")

        if unemp and gdp:
            macro_idx = round(
                min(max(gdp / 10, 0), 1) * 0.5 + max(1 - unemp / 20, 0) * 0.5, 3
            )
            data["macro"].update({
                "unemployment_rate_pct": unemp,
                "gdp_growth_pct": gdp,
                "services_employment_pct": services,
                "macro_climate_index": macro_idx,
                "year": datetime.utcnow().year,
            })
            logger.info(f"World Bank refresh: unemp={unemp}%, gdp={gdp}%, macro_idx={macro_idx}")

    except Exception as e:
        logger.warning(f"World Bank refresh failed: {e} — keeping existing values")

    # ── Google Trends via pytrends ──────────────────────────────────────────
    try:
        from pytrends.request import TrendReq

        pytrends = TrendReq(hl="en-IN", tz=330)
        cities = ["Bengaluru", "Mumbai", "Hyderabad", "Pune", "Delhi", "Chennai"]
        field_queries = {
            "Engineering": "software engineer jobs",
            "MBA": "MBA jobs management",
            "Nursing": "nursing jobs hospital",
        }
        geo_map = {
            "Bengaluru": "IN-KA", "Mumbai": "IN-MH", "Hyderabad": "IN-TG",
            "Pune": "IN-MH", "Delhi NCR": "IN-DL", "Chennai": "IN-TN",
        }

        for field, query in field_queries.items():
            for region, geo_code in geo_map.items():
                try:
                    pytrends.build_payload([query], cat=0, timeframe="today 3-m", geo=geo_code)
                    interest = pytrends.interest_over_time()
                    if not interest.empty:
                        trend_avg = int(interest[query].mean())
                        # Blend trends score (40%) with existing score (60%)
                        existing = data["field_demand"].get(field, {}).get(region, {})
                        if existing:
                            blended = round(existing["demand_score"] * 0.6 + trend_avg * 0.4)
                            data["field_demand"][field][region]["demand_score"] = blended
                            logger.info(f"Trends blended {field}/{region}: {existing['demand_score']} → {blended}")
                    time.sleep(0.5)  # rate-limit pytrends
                except Exception:
                    pass  # individual cell failure is non-fatal

    except ImportError:
        logger.info("pytrends not installed — skipping Google Trends refresh (pip install pytrends)")
    except Exception as e:
        logger.warning(f"Google Trends refresh failed: {e}")

    # ── Write updated data back to disk ────────────────────────────────────
    data["_meta"]["fetched_at"] = datetime.utcnow().strftime("%Y-%m-%d")
    data["_meta"]["next_refresh"] = (datetime.utcnow() + timedelta(hours=REFRESH_INTERVAL_HOURS)).strftime("%Y-%m-%d")

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    global _cache, _cache_mtime
    _cache = data
    _cache_mtime = DATA_FILE.stat().st_mtime
    logger.info("market_data.json refreshed and saved")

    return data
