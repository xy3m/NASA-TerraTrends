"""NASA FIRMS Active-Fire Proxy & EONET v3 Keyless Wildfire Fallback."""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import datetime, timezone
from typing import Literal, Optional

import numpy as np
import requests

from .auth_store import auth_store


def _build_synthetic_firms_response(
    *,
    west: float,
    south: float,
    east: float,
    north: float,
    source: str,
    day_range: int,
    region_label: str,
    reason: str,
) -> dict:
    """Transparent labeled fallback archive if neither FIRMS MAP_KEY nor live EONET yields regional points."""
    rng = np.random.default_rng(abs(hash((round(west, 1), round(south, 1), region_label))) % (2**31))
    hotspots = []
    daily_buckets: dict[str, list[float]] = defaultdict(list)

    n_points = 42
    now = datetime.now(timezone.utc)
    for i in range(n_points):
        lat = float(rng.uniform(south + 0.1 * (north - south), north - 0.1 * (north - south)))
        lon = float(rng.uniform(west + 0.1 * (east - west), east - 0.1 * (west - west)))
        day_offset = int(rng.integers(0, max(1, day_range)))
        date_str = (now.fromordinal(now.toordinal() - day_offset)).strftime("%Y-%m-%d")
        frp = float(np.round(rng.lognormal(mean=2.6, sigma=0.75), 2))
        bright = float(np.round(315.0 + min(75.0, frp * 0.45), 1))
        dn = "D" if rng.random() > 0.35 else "N"
        conf = "high" if frp > 35 else ("nominal" if frp > 10 else "low")
        hotspots.append(
            {
                "latitude": round(lat, 4),
                "longitude": round(lon, 4),
                "acq_date": date_str,
                "acq_time": f"{int(rng.integers(0, 24)):02d}{int(rng.integers(0, 60)):02d}",
                "frp_mw": frp,
                "brightness_k": bright,
                "confidence": conf,
                "daynight": dn,
                "satellite": source,
                "title": f"{region_label} Thermal Cluster #{i + 1}",
            }
        )
        daily_buckets[date_str].append(frp)

    frp_vals = np.array([h["frp_mw"] for h in hotspots], dtype=float)
    daily_series = [
        {
            "date": d,
            "count": len(vals),
            "total_frp_mw": round(float(np.sum(vals)), 2),
            "mean_frp_mw": round(float(np.mean(vals)), 2),
        }
        for d, vals in sorted(daily_buckets.items())
    ]

    return {
        "provenance": {
            "tier": "synthetic_demo",
            "source_name": f"Geo-Iris Wildfire Benchmark ({source})",
            "dataset_id": f"DEMO_{source}",
            "is_live": False,
            "status_message": reason,
        },
        "region_label": region_label,
        "bbox": [west, south, east, north],
        "source": source,
        "day_range": day_range,
        "summary": {
            "total_detections": len(hotspots),
            "total_frp_mw": round(float(np.sum(frp_vals)), 2),
            "mean_frp_mw": round(float(np.mean(frp_vals)), 2),
            "p95_frp_mw": round(float(np.percentile(frp_vals, 95)), 2),
            "max_frp_mw": round(float(np.max(frp_vals)), 2),
            "day_detections": sum(1 for h in hotspots if h["daynight"] == "D"),
            "night_detections": sum(1 for h in hotspots if h["daynight"] == "N"),
            "high_confidence_count": sum(1 for h in hotspots if h["confidence"] == "high"),
        },
        "daily_series": daily_series,
        "hotspots": hotspots,
    }


def _query_eonet_wildfires(
    *,
    west: float,
    south: float,
    east: float,
    north: float,
    day_range: int,
    region_label: str,
) -> Optional[dict]:
    """Keyless fallback to live NASA EONET v3 wildfires API."""
    url = "https://eonet.gsfc.nasa.gov/api/v3/events"
    params = {
        "category": "wildfires",
        "status": "open",
        "days": max(day_range, 14),
        "limit": 120,
    }
    resp = requests.get(url, params=params, timeout=12)
    resp.raise_for_status()
    payload = resp.json()
    events = payload.get("events", [])
    if not events:
        return None

    in_bbox = []
    global_events = []
    for ev in events:
        title = ev.get("title", "Wildfire Event")
        for geom in ev.get("geometry", []):
            coords = geom.get("coordinates")
            if not coords or len(coords) < 2:
                continue
            lon, lat = float(coords[0]), float(coords[1])
            dt_str = str(geom.get("date", ""))[:10] or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            mag_val = geom.get("magnitudeValue")
            item = {
                "latitude": round(lat, 4),
                "longitude": round(lon, 4),
                "acq_date": dt_str,
                "acq_time": str(geom.get("date", ""))[11:16].replace(":", "") or "1200",
                "frp_mw": float(mag_val) if isinstance(mag_val, (int, float)) else None,
                "brightness_k": None,
                "confidence": "eonet_verified",
                "daynight": "N/A",
                "satellite": "NASA EONET v3",
                "title": title,
            }
            global_events.append(item)
            if west <= lon <= east and south <= lat <= north:
                in_bbox.append(item)

    chosen = in_bbox if len(in_bbox) >= 1 else global_events[:45]
    if not chosen:
        return None

    scope_note = (
        f"Showing {len(chosen)} live NASA EONET v3 wildfire observations inside {region_label}."
        if in_bbox
        else f"No active EONET fires in {region_label}; showing {len(chosen)} active global NASA EONET v3 wildfires (configure NASA_FIRMS_MAP_KEY for sub-km VIIRS FRP detections)."
    )

    daily_buckets: dict[str, int] = defaultdict(int)
    for h in chosen:
        daily_buckets[h["acq_date"]] += 1

    daily_series = [
        {"date": d, "count": cnt, "total_frp_mw": None, "mean_frp_mw": None}
        for d, cnt in sorted(daily_buckets.items())
    ]

    return {
        "provenance": {
            "tier": "satellite_observation",
            "source_name": "NASA EONET v3 Wildfires (Keyless Live Feed)",
            "dataset_id": "EONET_V3_WILDFIRES",
            "is_live": True,
            "status_message": scope_note,
            "citation": "NASA Earth Observatory Natural Event Tracker (EONET) v3 API",
        },
        "region_label": region_label if in_bbox else "Global Active Wildfires (EONET v3)",
        "bbox": [west, south, east, north],
        "source": "NASA_EONET_V3",
        "day_range": max(day_range, 14),
        "summary": {
            "total_detections": len(chosen),
            "regional_matches": len(in_bbox),
            "total_frp_mw": None,
            "mean_frp_mw": None,
            "p95_frp_mw": None,
            "max_frp_mw": None,
            "day_detections": None,
            "night_detections": None,
            "high_confidence_count": len(chosen),
        },
        "daily_series": daily_series,
        "hotspots": chosen[:150],
    }


def query_firms_fires(
    *,
    west: float,
    south: float,
    east: float,
    north: float,
    source: Literal["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "MODIS_NRT"] = "VIIRS_SNPP_NRT",
    day_range: int = 5,
    region_label: str = "Selected Region",
    allow_eonet_fallback: bool = True,
) -> dict:
    """Query NASA FIRMS with MAP_KEY, or gracefully fall back to live EONET v3 / benchmark."""
    map_key = auth_store.get_firms_map_key()

    if map_key:
        area_str = f"{west:.3f},{south:.3f},{east:.3f},{north:.3f}"
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{source}/{area_str}/{day_range}"
        try:
            resp = requests.get(url, timeout=18)
            resp.raise_for_status()
            text = resp.text.strip()
            if text.startswith("Invalid") or "exceeded" in text.lower():
                raise ValueError(f"FIRMS API returned notice: {text[:160]}")

            reader = csv.DictReader(io.StringIO(text))
            hotspots = []
            daily_frp: dict[str, list[float]] = defaultdict(list)

            for row in reader:
                try:
                    lat = float(row["latitude"])
                    lon = float(row["longitude"])
                    frp = float(row.get("frp") or 0.0)
                    bright = float(row.get("bright_ti4") or row.get("brightness") or 0.0)
                except (KeyError, TypeError, ValueError):
                    continue
                acq_date = row.get("acq_date", "")
                acq_time = row.get("acq_time", "")
                conf = str(row.get("confidence", "nominal"))
                dn = str(row.get("daynight", "D"))
                hotspots.append(
                    {
                        "latitude": round(lat, 4),
                        "longitude": round(lon, 4),
                        "acq_date": acq_date,
                        "acq_time": acq_time,
                        "frp_mw": round(frp, 2),
                        "brightness_k": round(bright, 2) if bright > 0 else None,
                        "confidence": conf,
                        "daynight": dn,
                        "satellite": row.get("satellite") or source,
                        "title": f"{source} Hot Spot ({frp:.1f} MW)",
                    }
                )
                if acq_date:
                    daily_frp[acq_date].append(frp)

            frp_vals = np.array([h["frp_mw"] for h in hotspots], dtype=float) if hotspots else np.array([0.0])
            daily_series = [
                {
                    "date": d,
                    "count": len(vals),
                    "total_frp_mw": round(float(np.sum(vals)), 2),
                    "mean_frp_mw": round(float(np.mean(vals)), 2),
                }
                for d, vals in sorted(daily_frp.items())
            ]

            return {
                "provenance": {
                    "tier": "satellite_observation",
                    "source_name": f"NASA FIRMS {source} Live Active Fires",
                    "dataset_id": source,
                    "is_live": True,
                    "status_message": f"Authenticated NASA FIRMS {source} query succeeded ({len(hotspots)} active thermal detections over last {day_range} days).",
                    "citation": "NASA Land, Atmosphere Near real-time Capability for EOS (LANCE) FIRMS",
                },
                "region_label": region_label,
                "bbox": [west, south, east, north],
                "source": source,
                "day_range": day_range,
                "summary": {
                    "total_detections": len(hotspots),
                    "total_frp_mw": round(float(np.sum(frp_vals)), 2) if hotspots else 0.0,
                    "mean_frp_mw": round(float(np.mean(frp_vals)), 2) if hotspots else 0.0,
                    "p95_frp_mw": round(float(np.percentile(frp_vals, 95)), 2) if hotspots else 0.0,
                    "max_frp_mw": round(float(np.max(frp_vals)), 2) if hotspots else 0.0,
                    "day_detections": sum(1 for h in hotspots if h["daynight"] == "D"),
                    "night_detections": sum(1 for h in hotspots if h["daynight"] == "N"),
                    "high_confidence_count": sum(
                        1 for h in hotspots if str(h["confidence"]).lower() in {"h", "high"} or (str(h["confidence"]).isdigit() and int(h["confidence"]) >= 80)
                    ),
                },
                "daily_series": daily_series,
                "hotspots": hotspots[:300],
            }
        except Exception as exc:
            fallback_reason = f"FIRMS live request failed ({exc}); falling back."
    else:
        fallback_reason = "No NASA_FIRMS_MAP_KEY configured (live sub-km VIIRS/MODIS FRP requires free FIRMS MAP_KEY)."

    if allow_eonet_fallback:
        try:
            eonet_res = _query_eonet_wildfires(
                west=west,
                south=south,
                east=east,
                north=north,
                day_range=day_range,
                region_label=region_label,
            )
            if eonet_res is not None:
                return eonet_res
        except Exception:
            pass

    return _build_synthetic_firms_response(
        west=west,
        south=south,
        east=east,
        north=north,
        source=source,
        day_range=day_range,
        region_label=region_label,
        reason=fallback_reason + " Showing synthetic demonstration wildfire FRP dataset.",
    )
