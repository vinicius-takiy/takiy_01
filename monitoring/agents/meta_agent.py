from __future__ import annotations

from datetime import date

from config import Config
from .base_agent import BaseAgent, MetricSnapshot


class MetaAgent(BaseAgent):
    """Agente de monitoramento para Meta Ads (Facebook + Instagram)."""

    platform_name = "Meta Ads"

    def __init__(self):
        super().__init__(
            anomaly_threshold_pct=Config.ANOMALY_THRESHOLD_PCT,
            budget_alert_pct=Config.DAILY_BUDGET_ALERT_PCT,
        )
        self._client = None

    def _get_client(self):
        if self._client is None:
            from facebook_business.api import FacebookAdsApi
            from facebook_business.adobjects.adaccount import AdAccount

            FacebookAdsApi.init(
                app_id=Config.META_APP_ID,
                app_secret=Config.META_APP_SECRET,
                access_token=Config.META_ACCESS_TOKEN,
            )
            self._client = AdAccount(Config.META_AD_ACCOUNT_ID)
        return self._client

    def fetch_metrics(self, start: date, end: date) -> list[MetricSnapshot]:
        from facebook_business.adobjects.adsinsights import AdsInsights

        account = self._get_client()

        params = {
            "time_range": {
                "since": start.isoformat(),
                "until": end.isoformat(),
            },
            "time_increment": 1,
            "level": "account",
            "fields": [
                AdsInsights.Field.date_start,
                AdsInsights.Field.spend,
                AdsInsights.Field.impressions,
                AdsInsights.Field.clicks,
                AdsInsights.Field.actions,
                AdsInsights.Field.action_values,
                AdsInsights.Field.ctr,
                AdsInsights.Field.cpc,
                AdsInsights.Field.cpp,
            ],
        }

        insights = account.get_insights(params=params)

        # Budget diário (soma de todos os ad sets ativos)
        daily_budget = self._fetch_daily_budget(account)

        snapshots: list[MetricSnapshot] = []
        for row in insights:
            spend = float(row.get("spend", 0))
            impressions = int(row.get("impressions", 0))
            clicks = int(row.get("clicks", 0))

            # Conversões e receita via 'actions' e 'action_values'
            conversions = self._sum_actions(row.get("actions", []), "offsite_conversion")
            revenue = self._sum_actions(row.get("action_values", []), "offsite_conversion")

            cpa = spend / conversions if conversions > 0 else 0.0
            roas = revenue / spend if spend > 0 else 0.0
            budget_pct = (spend / daily_budget * 100) if daily_budget > 0 else 0.0

            snap = MetricSnapshot(
                platform=self.platform_name,
                date=date.fromisoformat(row["date_start"]),
                spend=spend,
                impressions=impressions,
                clicks=clicks,
                conversions=conversions,
                revenue=revenue,
                ctr=float(row.get("ctr", 0)),
                cpc=float(row.get("cpc", 0)),
                cpa=cpa,
                roas=roas,
                daily_budget=daily_budget,
                budget_consumed_pct=budget_pct,
                extra={
                    "cpp": float(row.get("cpp", 0)),  # custo por 1000 impressões
                },
            )
            snapshots.append(snap)

        return sorted(snapshots, key=lambda s: s.date)

    def _fetch_daily_budget(self, account) -> float:
        """Soma os budgets diários de todos os ad sets ativos."""
        try:
            from facebook_business.adobjects.adset import AdSet

            ad_sets = account.get_ad_sets(
                params={"effective_status": ["ACTIVE"]},
                fields=[AdSet.Field.daily_budget, AdSet.Field.lifetime_budget],
            )
            total = 0.0
            for ad_set in ad_sets:
                daily = float(ad_set.get("daily_budget") or 0) / 100  # centavos → reais
                total += daily
            return total
        except Exception:
            return 0.0

    @staticmethod
    def _sum_actions(actions: list[dict], action_type_prefix: str) -> float:
        total = 0.0
        for action in actions:
            if action.get("action_type", "").startswith(action_type_prefix):
                total += float(action.get("value", 0))
        return total
