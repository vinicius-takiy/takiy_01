"""
Ponto de entrada do sistema de monitoramento.

Uso:
    # Executa uma vez agora (para testes ou chamada manual)
    python scheduler.py --now

    # Inicia o agendador (roda todo dia às 08:00)
    python scheduler.py

    # Define horário personalizado
    python scheduler.py --hour 9 --minute 30
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

# Configura logging antes de qualquer import interno
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("monitoring.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


def run_monitoring_job() -> None:
    """Job principal: coleta dados, analisa e envia email."""
    logger.info("=" * 60)
    logger.info("Iniciando job de monitoramento — %s", datetime.now().isoformat())
    logger.info("=" * 60)

    try:
        from orchestrator import generate_report
        from notifier import send_report

        reports, analysis = generate_report()
        send_report(analysis, reports)

        # Resumo no log
        for r in reports:
            if r.success:
                spend = r.today.spend if r.today else 0
                logger.info(
                    "[%s] spend=%.2f | anomalias=%d | alertas_budget=%d",
                    r.platform, spend, len(r.anomalies), len(r.budget_alerts),
                )
            else:
                logger.error("[%s] FALHOU: %s", r.platform, r.error)

        logger.info("Job concluído com sucesso.")

    except Exception:
        logger.exception("Erro crítico no job de monitoramento")
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Agentes de Monitoramento de Mídia Paga")
    parser.add_argument("--now", action="store_true", help="Executa imediatamente e sai")
    parser.add_argument("--hour", type=int, default=8, help="Hora de execução diária (padrão: 8)")
    parser.add_argument("--minute", type=int, default=0, help="Minuto de execução (padrão: 0)")
    args = parser.parse_args()

    if args.now:
        logger.info("Modo --now: executando imediatamente.")
        run_monitoring_job()
        return

    scheduler = BlockingScheduler(timezone="America/Sao_Paulo")
    trigger = CronTrigger(hour=args.hour, minute=args.minute)
    scheduler.add_job(
        run_monitoring_job,
        trigger=trigger,
        id="daily_ads_monitoring",
        name="Monitoramento Diário de Ads",
        misfire_grace_time=3600,   # tolerância de 1h se o sistema estava offline
        replace_existing=True,
    )

    logger.info(
        "Agendador iniciado. Job diário às %02d:%02d (America/Sao_Paulo).",
        args.hour, args.minute,
    )
    logger.info("Pressione Ctrl+C para parar.")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Agendador encerrado.")


if __name__ == "__main__":
    main()
