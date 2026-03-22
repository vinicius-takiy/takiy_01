from __future__ import annotations

from datetime import date

from config import Config
from .base_agent import BaseAgent, MetricSnapshot


class GA4Agent(BaseAgent):
    """Agente de monitoramento para Google Analytics 4."""

    platform_name = "GA4"

    def __init__(self):
        super().__init__(
            anomaly_threshold_pct=Config.ANOMALY_THRESHOLD_PCT,
            budget_alert_pct=Config.DAILY_BUDGET_ALERT_PCT,
        )
        self._client = None

    def _get_client(self):
        if self._client is None:
            import os
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = Config.GOOGLE_APPLICATION_CREDENTIALS

            from google.analytics.data_v1beta import BetaAnalyticsDataClient
            self._client = BetaAnalyticsDataClient()
        return self._client

    def fetch_metrics(self, start: date, end: date) -> list[MetricSnapshot]:
        from google.analytics.data_v1beta.types import (
            DateRange,
            Dimension,
            Metric,
            RunReportRequest,
        )

        client = self._get_client()
        property_id = f"properties/{Config.GA4_PROPERTY_ID}"

        request = RunReportRequest(
            property=property_id,
            date_ranges=[
                DateRange(
                    start_date=start.isoformat(),
                    end_date=end.isoformat(),
                )
            ],
            dimensions=[Dimension(name="date")],
            metrics=[
                Metric(name="sessions"),
                Metric(name="screenPageViews"),
                Metric(name="activeUsers"),
                Metric(name="newUsers"),
                Metric(name="bounceRate"),
                Metric(name="averageSessionDuration"),
                Metric(name="conversions"),
                Metric(name="totalRevenue"),
                Metric(name="engagementRate"),
            ],
        )

        response = client.run_report(request)

        snapshots: list[MetricSnapshot] = []
        for row in response.rows:
            raw_date = row.dimension_values[0].value  # "20240115"
            parsed_date = date(
                int(raw_date[:4]),
                int(raw_date[4:6]),
                int(raw_date[6:8]),
            )

            vals = [v.value for v in row.metric_values]
            sessions = int(vals[0])
            pageviews = int(vals[1])
            active_users = int(vals[2])
            new_users = int(vals[3])
            bounce_rate = float(vals[4])
            avg_session_sec = float(vals[5])
            conversions = float(vals[6])
            revenue = float(vals[7])
            engagement_rate = float(vals[8])

            # GA4 não tem spend/budget próprios — zeramos esses campos
            snapshots.append(
                MetricSnapshot(
                    platform=self.platform_name,
                    date=parsed_date,
                    spend=0.0,
                    impressions=pageviews,   # reutilizamos 'impressions' para pageviews
                    clicks=sessions,         # reutilizamos 'clicks' para sessions
                    conversions=conversions,
                    revenue=revenue,
                    ctr=engagement_rate,     # reutilizamos 'ctr' para engagement rate
                    cpc=0.0,
                    cpa=0.0,
                    roas=0.0,
                    daily_budget=0.0,
                    budget_consumed_pct=0.0,
                    extra={
                        "sessions": sessions,
                        "pageviews": pageviews,
                        "active_users": active_users,
                        "new_users": new_users,
                        "bounce_rate": round(bounce_rate, 4),
                        "avg_session_duration_sec": round(avg_session_sec, 1),
                        "engagement_rate": round(engagement_rate, 4),
                    },
                )
            )

        return sorted(snapshots, key=lambda s: s.date)

    def _detect_anomalies(self, today, history):
        """Override para usar métricas relevantes do GA4."""
        if today is None or not history:
            return []

        anomalies: list[str] = []
        threshold = self.anomaly_threshold

        ga4_metrics = {
            "clicks": ("Sessões", today.clicks),
            "impressions": ("Pageviews", today.impressions),
            "conversions": ("Conversões", today.conversions),
            "revenue": ("Receita", today.revenue),
        }

        for key, (label, today_val) in ga4_metrics.items():
            hist_vals = [getattr(s, key) for s in history if getattr(s, key) > 0]
            if not hist_vals:
                continue
            avg = sum(hist_vals) / len(hist_vals)
            if avg == 0:
                continue
            change = (today_val - avg) / avg
            if abs(change) >= threshold:
                direction = "queda" if change < 0 else "aumento"
                anomalies.append(
                    f"{label}: {direction} de {abs(change):.1%} vs média 7d "
                    f"(hoje: {today_val:.2f}, média: {avg:.2f})"
                )

        # Bounce rate alto (acima de 70%)
        if today.extra.get("bounce_rate", 0) > 0.70:
            anomalies.append(
                f"Bounce rate alto: {today.extra['bounce_rate']:.1%}"
            )

        return anomalies
