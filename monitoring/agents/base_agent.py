from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class MetricSnapshot:
    """Snapshot diário de métricas de uma plataforma."""
    platform: str
    date: date
    spend: float = 0.0               # Gasto em R$ / moeda da conta
    impressions: int = 0
    clicks: int = 0
    conversions: float = 0.0
    revenue: float = 0.0             # Receita atribuída
    ctr: float = 0.0                 # Click-through rate (%)
    cpc: float = 0.0                 # Custo por clique
    cpa: float = 0.0                 # Custo por aquisição
    roas: float = 0.0                # Return on Ad Spend
    daily_budget: float = 0.0        # Budget diário total
    budget_consumed_pct: float = 0.0 # % do budget consumido
    extra: dict[str, Any] = field(default_factory=dict)  # Métricas extras por plataforma


@dataclass
class AgentReport:
    """Relatório completo de um agente de plataforma."""
    platform: str
    success: bool
    today: MetricSnapshot | None = None
    history: list[MetricSnapshot] = field(default_factory=list)  # últimos 7 dias
    anomalies: list[str] = field(default_factory=list)
    budget_alerts: list[str] = field(default_factory=list)
    error: str | None = None

    def to_dict(self) -> dict:
        return {
            "platform": self.platform,
            "success": self.success,
            "today": self._snapshot_dict(self.today),
            "history_7d": [self._snapshot_dict(s) for s in self.history],
            "anomalies": self.anomalies,
            "budget_alerts": self.budget_alerts,
            "error": self.error,
        }

    @staticmethod
    def _snapshot_dict(s: MetricSnapshot | None) -> dict | None:
        if s is None:
            return None
        return {
            "date": s.date.isoformat(),
            "spend": round(s.spend, 2),
            "impressions": s.impressions,
            "clicks": s.clicks,
            "conversions": round(s.conversions, 2),
            "revenue": round(s.revenue, 2),
            "ctr": round(s.ctr, 4),
            "cpc": round(s.cpc, 2),
            "cpa": round(s.cpa, 2),
            "roas": round(s.roas, 2),
            "daily_budget": round(s.daily_budget, 2),
            "budget_consumed_pct": round(s.budget_consumed_pct, 2),
            **s.extra,
        }


class BaseAgent(ABC):
    """Classe base para agentes de monitoramento de plataformas de ads."""

    platform_name: str = "Unknown"

    def __init__(self, anomaly_threshold_pct: float = 20.0, budget_alert_pct: float = 90.0):
        self.anomaly_threshold = anomaly_threshold_pct / 100
        self.budget_alert_pct = budget_alert_pct
        self.logger = logging.getLogger(self.__class__.__name__)

    def run(self) -> AgentReport:
        """Executa o agente e retorna o relatório completo."""
        try:
            today = date.today() - timedelta(days=1)  # ontem (dados completos)
            history_start = today - timedelta(days=7)

            today_data = self.fetch_metrics(today, today)
            history_data = self.fetch_metrics(history_start, today - timedelta(days=1))

            today_snapshot = today_data[0] if today_data else None
            anomalies = self._detect_anomalies(today_snapshot, history_data)
            budget_alerts = self._check_budget(today_snapshot)

            return AgentReport(
                platform=self.platform_name,
                success=True,
                today=today_snapshot,
                history=history_data,
                anomalies=anomalies,
                budget_alerts=budget_alerts,
            )
        except Exception as exc:
            self.logger.exception("Erro ao executar agente %s", self.platform_name)
            return AgentReport(
                platform=self.platform_name,
                success=False,
                error=str(exc),
            )

    @abstractmethod
    def fetch_metrics(self, start: date, end: date) -> list[MetricSnapshot]:
        """Busca métricas da plataforma para o período informado."""
        ...

    def _detect_anomalies(
        self, today: MetricSnapshot | None, history: list[MetricSnapshot]
    ) -> list[str]:
        if today is None or not history:
            return []

        anomalies: list[str] = []
        threshold = self.anomaly_threshold

        metrics = {
            "spend": ("Gasto", today.spend),
            "impressions": ("Impressões", today.impressions),
            "clicks": ("Cliques", today.clicks),
            "conversions": ("Conversões", today.conversions),
            "roas": ("ROAS", today.roas),
        }

        for key, (label, today_val) in metrics.items():
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

        return anomalies

    def _check_budget(self, today: MetricSnapshot | None) -> list[str]:
        if today is None:
            return []
        alerts: list[str] = []
        if today.budget_consumed_pct >= self.budget_alert_pct:
            alerts.append(
                f"Budget {today.budget_consumed_pct:.1f}% consumido "
                f"(R$ {today.spend:.2f} de R$ {today.daily_budget:.2f})"
            )
        return alerts
