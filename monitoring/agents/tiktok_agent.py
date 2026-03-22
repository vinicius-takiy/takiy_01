from __future__ import annotations

from datetime import date

import requests

from config import Config
from .base_agent import BaseAgent, MetricSnapshot

TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3"


class TikTokAgent(BaseAgent):
    """Agente de monitoramento para TikTok Ads."""

    platform_name = "TikTok Ads"

    def __init__(self):
        super().__init__(
            anomaly_threshold_pct=Config.ANOMALY_THRESHOLD_PCT,
            budget_alert_pct=Config.DAILY_BUDGET_ALERT_PCT,
        )
        self._headers = {
            "Access-Token": Config.TIKTOK_ACCESS_TOKEN,
            "Content-Type": "application/json",
        }

    def fetch_metrics(self, start: date, end: date) -> list[MetricSnapshot]:
        metrics_list = [
            "spend",
            "impressions",
            "clicks",
            "conversion",
            "real_time_conversion",
            "conversion_rate",
            "cost_per_conversion",
            "ctr",
            "cpc",
            "roas",
        ]

        params = {
            "advertiser_id": Config.TIKTOK_ADVERTISER_ID,
            "report_type": "BASIC",
            "dimensions": ["stat_time_day"],
            "metrics": metrics_list,
            "data_level": "AUCTION_ADVERTISER",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "page_size": 1000,
        }

        resp = requests.post(
            f"{TIKTOK_API_BASE}/report/integrated/get/",
            json=params,
            headers=self._headers,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != 0:
            raise RuntimeError(f"TikTok API error: {data.get('message')}")

        # Budget diário
        daily_budget = self._fetch_daily_budget()

        snapshots: list[MetricSnapshot] = []
        for row in data.get("data", {}).get("list", []):
            dims = row.get("dimensions", {})
            mets = row.get("metrics", {})

            stat_day = dims.get("stat_time_day", "")[:10]  # "2024-01-15 00:00:00" → "2024-01-15"
            spend = float(mets.get("spend", 0))
            impressions = int(mets.get("impressions", 0))
            clicks = int(mets.get("clicks", 0))
            conversions = float(mets.get("conversion", 0))
            cpc = float(mets.get("cpc", 0))
            ctr = float(mets.get("ctr", 0)) / 100  # TikTok retorna em %
            cpa = float(mets.get("cost_per_conversion", 0))
            roas = float(mets.get("roas", 0))

            revenue = conversions * cpa * roas if roas > 0 else 0.0
            budget_pct = (spend / daily_budget * 100) if daily_budget > 0 else 0.0

            snapshots.append(
                MetricSnapshot(
                    platform=self.platform_name,
                    date=date.fromisoformat(stat_day),
                    spend=spend,
                    impressions=impressions,
                    clicks=clicks,
                    conversions=conversions,
                    revenue=revenue,
                    ctr=ctr,
                    cpc=cpc,
                    cpa=cpa,
                    roas=roas,
                    daily_budget=daily_budget,
                    budget_consumed_pct=budget_pct,
                )
            )

        return sorted(snapshots, key=lambda s: s.date)

    def _fetch_daily_budget(self) -> float:
        """Busca o budget diário total do advertiser."""
        try:
            resp = requests.get(
                f"{TIKTOK_API_BASE}/advertiser/info/",
                params={"advertiser_ids": f'["{Config.TIKTOK_ADVERTISER_ID}"]'},
                headers=self._headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            advertisers = data.get("data", {}).get("list", [])
            if advertisers:
                return float(advertisers[0].get("balance", 0))
        except Exception:
            pass
        return 0.0
