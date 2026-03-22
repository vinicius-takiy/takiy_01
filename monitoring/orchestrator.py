"""
Orquestrador: coleta dados de todos os agentes em paralelo,
envia para Claude Opus 4.6 analisar e gera o relatório consolidado.
"""
from __future__ import annotations

import json
import logging
import concurrent.futures
from datetime import date

import anthropic

from config import Config
from agents import MetaAgent, GoogleAdsAgent, TikTokAgent, GA4Agent
from agents.base_agent import AgentReport

logger = logging.getLogger(__name__)


def run_all_agents() -> list[AgentReport]:
    """Executa os 4 agentes em paralelo e retorna os relatórios."""
    agents = [
        MetaAgent(),
        GoogleAdsAgent(),
        TikTokAgent(),
        GA4Agent(),
    ]

    reports: list[AgentReport] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(agent.run): agent.platform_name for agent in agents}
        for future in concurrent.futures.as_completed(futures):
            platform = futures[future]
            try:
                report = future.result()
                reports.append(report)
                logger.info("Agente %s concluído (sucesso=%s)", platform, report.success)
            except Exception as exc:
                logger.exception("Agente %s falhou com exceção", platform)
                reports.append(
                    AgentReport(platform=platform, success=False, error=str(exc))
                )

    # Ordena por plataforma para consistência
    return sorted(reports, key=lambda r: r.platform)


def analyze_with_claude(reports: list[AgentReport]) -> str:
    """
    Usa Claude Opus 4.6 (adaptive thinking) para analisar todos os dados
    e gerar um relatório executivo consolidado em português.
    """
    client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)

    today_str = (date.today()).strftime("%d/%m/%Y")
    reports_json = json.dumps(
        [r.to_dict() for r in reports],
        ensure_ascii=False,
        indent=2,
    )

    prompt = f"""Você é um especialista em marketing digital e performance de mídia paga.
Analise os dados abaixo de {today_str} (referentes a ontem) das plataformas Meta Ads,
Google Ads, TikTok Ads e GA4, e gere um relatório executivo em português.

DADOS DAS PLATAFORMAS:
{reports_json}

Gere um relatório com as seguintes seções:

## 1. Resumo Executivo
- Visão geral de performance do dia em 3-5 bullet points
- Destaque o mais importante (positivo ou negativo)

## 2. Performance por Plataforma
Para cada plataforma (Meta, Google Ads, TikTok, GA4):
- Métricas principais do dia (spend, conversões, ROAS, etc.)
- Comparação com média dos últimos 7 dias
- Status: ✅ Normal | ⚠️ Atenção | 🔴 Crítico

## 3. Anomalias e Alertas
- Liste todas as anomalias detectadas por plataforma
- Classifique por urgência
- Sugira possíveis causas e ações imediatas

## 4. Alertas de Budget
- Plataformas com budget próximo ao limite
- Projeção de consumo para o fim do dia

## 5. Insights e Recomendações
- 3 a 5 recomendações práticas baseadas nos dados
- Oportunidades identificadas
- Riscos a monitorar

## 6. Próximos Passos
- Lista de ações prioritárias para hoje

Seja direto, use dados concretos, evite genéricos. Se alguma plataforma falhou ao buscar dados,
indique claramente e sugira verificação manual.
"""

    logger.info("Enviando dados para análise do Claude Opus 4.6...")

    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        analysis = stream.get_final_message()

    # Extrai o texto (ignora blocos de thinking)
    report_text = ""
    for block in analysis.content:
        if block.type == "text":
            report_text += block.text

    logger.info(
        "Análise concluída. Tokens usados: input=%d, output=%d",
        analysis.usage.input_tokens,
        analysis.usage.output_tokens,
    )

    return report_text


def generate_report() -> tuple[list[AgentReport], str]:
    """Fluxo completo: coleta dados → analisa com Claude → retorna relatório."""
    logger.info("Iniciando coleta de dados das plataformas...")
    reports = run_all_agents()

    logger.info("Gerando análise com Claude Opus 4.6...")
    analysis = analyze_with_claude(reports)

    return reports, analysis
