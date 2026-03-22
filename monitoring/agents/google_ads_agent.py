from __future__ import annotations

from datetime import date

from config import Config
from .base_agent import BaseAgent, MetricSnapshot


class GoogleAdsAgent(BaseAgent):
    """Agente de monitoramento para Google Ads."""

    platform_name = "Google Ads"

    def __init__(self):
        super().__init__(
            anomaly_threshold_pct=Config.ANOMALY_THRESHOLD_PCT,
            budget_alert_pct=Config.DAILY_BUDGET_ALERT_PCT,
        )
        self._client = None

    def _get_client(self):
        if self._client is None:
            from google.ads.googleads.client import GoogleAdsClient

            self._client = GoogleAdsClient.load_from_dict(
                {
                    "developer_token": Config.GOOGLE_ADS_DEVELOPER_TOKEN,
                    "client_id": Config.GOOGLE_ADS_CLIENT_ID,
                    "client_secret": Config.GOOGLE_ADS_CLIENT_SECRET,
                    "refresh_token": Config.GOOGLE_ADS_REFRESH_TOKEN,
                    "login_customer_id": Config.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
                    "use_proto_plus": True,
                }
            )
        return self._client

    def fetch_metrics(self, start: date, end: date) -> list[MetricSnapshot]:
        client = self._get_client()
        ga_service = client.get_service("GoogleAdsService")
        customer_id = Config.GOOGLE_ADS_CUSTOMER_ID

        query = f"""
            SELECT
                segments.date,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value,
                metrics.ctr,
                metrics.average_cpc,
                metrics.cost_per_conversion,
                campaign_budget.amount_micros
            FROM campaign
            WHERE segments.date BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
              AND campaign.status = 'ENABLED'
        """

        response = ga_service.search(customer_id=customer_id, query=query)

        # Agrega por data
        by_date: dict[str, dict] = {}
        for row in response:
            d = row.segments.date
            if d not in by_date:
                by_date[d] = {
                    "spend": 0.0,
                    "impressions": 0,
                    "clicks": 0,
                    "conversions": 0.0,
                    "revenue": 0.0,
                    "daily_budget": 0.0,
                }
            agg = by_date[d]
            agg["spend"] += row.metrics.cost_micros / 1_000_000
            agg["impressions"] += row.metrics.impressions
            agg["clicks"] += row.metrics.clicks
            agg["conversions"] += row.metrics.conversions
            agg["revenue"] += row.metrics.conversions_value
            agg["daily_budget"] += row.campaign_budget.amount_micros / 1_000_000

        snapshots: list[MetricSnapshot] = []
        for d_str, agg in by_date.items():
            spend = agg["spend"]
            clicks = agg["clicks"]
            conversions = agg["conversions"]
            revenue = agg["revenue"]
            impressions = agg["impressions"]
            daily_budget = agg["daily_budget"]

            ctr = clicks / impressions if impressions > 0 else 0.0
            cpc = spend / clicks if clicks > 0 else 0.0
            cpa = spend / conversions if conversions > 0 else 0.0
            roas = revenue / spend if spend > 0 else 0.0
            budget_pct = (spend / daily_budget * 100) if daily_budget > 0 else 0.0

            snapshots.append(
                MetricSnapshot(
                    platform=self.platform_name,
                    date=date.fromisoformat(d_str),
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
