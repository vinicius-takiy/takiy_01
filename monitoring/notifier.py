"""
Envia o relatório por email via SMTP.
Suporta Gmail (App Password), Outlook e qualquer servidor SMTP.
"""
from __future__ import annotations

import logging
import smtplib
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import Config
from agents.base_agent import AgentReport

logger = logging.getLogger(__name__)


def _markdown_to_html(text: str) -> str:
    """Converte markdown simples para HTML (sem dependências externas)."""
    lines = text.split("\n")
    html_lines: list[str] = []
    in_list = False

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("## "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h2 style='color:#1a1a2e;border-bottom:2px solid #e94560;padding-bottom:6px'>{stripped[3:]}</h2>")
        elif stripped.startswith("### "):
            html_lines.append(f"<h3 style='color:#16213e'>{stripped[4:]}</h3>")
        elif stripped.startswith("- ") or stripped.startswith("• "):
            if not in_list:
                html_lines.append("<ul>")
                in_list = True
            content = stripped[2:]
            content = _inline_format(content)
            html_lines.append(f"<li>{content}</li>")
        elif stripped == "":
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append("<br>")
        else:
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<p>{_inline_format(stripped)}</p>")

    if in_list:
        html_lines.append("</ul>")

    return "\n".join(html_lines)


def _inline_format(text: str) -> str:
    """Formata negrito (**texto**) e código (`texto`)."""
    import re
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"`(.+?)`", r"<code style='background:#f4f4f4;padding:1px 4px;border-radius:3px'>\1</code>", text)
    return text


def _build_html_email(analysis: str, reports: list[AgentReport], report_date: date) -> str:
    """Monta o HTML completo do email."""
    total_spend = sum(
        (r.today.spend if r.today else 0.0) for r in reports if r.success
    )
    platforms_ok = sum(1 for r in reports if r.success)
    platforms_total = len(reports)
    total_anomalies = sum(len(r.anomalies) for r in reports if r.success)
    total_budget_alerts = sum(len(r.budget_alerts) for r in reports if r.success)

    status_color = "#27ae60" if total_anomalies == 0 else ("#e67e22" if total_anomalies <= 3 else "#e74c3c")
    status_text = "Normal" if total_anomalies == 0 else ("Atenção" if total_anomalies <= 3 else "Crítico")

    analysis_html = _markdown_to_html(analysis)

    platform_cards = ""
    for r in reports:
        icon = "✅" if r.success and not r.anomalies else ("⚠️" if r.success else "🔴")
        spend_str = f"R$ {r.today.spend:,.2f}" if r.today else "N/A"
        roas_str = f"{r.today.roas:.2f}x" if r.today else "N/A"
        anomaly_str = f"{len(r.anomalies)} anomalia(s)" if r.anomalies else "sem anomalias"
        error_str = f"<br><span style='color:#e74c3c'>Erro: {r.error}</span>" if not r.success else ""

        platform_cards += f"""
        <div style='display:inline-block;width:45%;margin:8px;padding:16px;
                    background:#f8f9fa;border-radius:8px;border-left:4px solid #3498db;
                    vertical-align:top'>
            <div style='font-size:18px;font-weight:bold'>{icon} {r.platform}</div>
            <div style='color:#666;margin-top:8px'>
                Gasto: <strong>{spend_str}</strong><br>
                ROAS: <strong>{roas_str}</strong><br>
                {anomaly_str}{error_str}
            </div>
        </div>
        """

    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           margin: 0; padding: 0; background: #f0f2f5; color: #333; }}
    .container {{ max-width: 700px; margin: 24px auto; background: white;
                  border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
    .header {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
               color: white; padding: 32px; }}
    .header h1 {{ margin: 0; font-size: 24px; }}
    .header .subtitle {{ opacity: 0.7; margin-top: 6px; }}
    .kpi-bar {{ background: #1a1a2e; padding: 16px 32px; display: flex; gap: 32px; }}
    .kpi {{ color: white; text-align: center; }}
    .kpi .value {{ font-size: 22px; font-weight: bold; color: #e94560; }}
    .kpi .label {{ font-size: 11px; opacity: 0.7; text-transform: uppercase; }}
    .status-badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px;
                     background: {status_color}; color: white; font-weight: bold; font-size: 13px; }}
    .content {{ padding: 32px; }}
    h2 {{ color: #1a1a2e; border-bottom: 2px solid #e94560; padding-bottom: 6px; }}
    .footer {{ background: #f8f9fa; padding: 16px 32px; text-align: center;
               color: #999; font-size: 12px; border-top: 1px solid #eee; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Relatório Diário de Mídia Paga</h1>
      <div class="subtitle">
        {report_date.strftime("%A, %d de %B de %Y")} &nbsp;|&nbsp;
        Status: <span class="status-badge">{status_text}</span>
      </div>
    </div>

    <div class="kpi-bar">
      <div class="kpi">
        <div class="value">R$ {total_spend:,.2f}</div>
        <div class="label">Gasto Total</div>
      </div>
      <div class="kpi">
        <div class="value">{platforms_ok}/{platforms_total}</div>
        <div class="label">Plataformas OK</div>
      </div>
      <div class="kpi">
        <div class="value">{total_anomalies}</div>
        <div class="label">Anomalias</div>
      </div>
      <div class="kpi">
        <div class="value">{total_budget_alerts}</div>
        <div class="label">Alertas Budget</div>
      </div>
    </div>

    <div class="content">
      <h2>Visão Geral das Plataformas</h2>
      <div>{platform_cards}</div>

      <hr style='border:none;border-top:1px solid #eee;margin:24px 0'>

      <div id="analysis">
        {analysis_html}
      </div>
    </div>

    <div class="footer">
      Relatório gerado automaticamente por Claude Opus 4.6 · Monitoring Agents<br>
      {report_date.strftime("%d/%m/%Y %H:%M")}
    </div>
  </div>
</body>
</html>
"""


def send_report(analysis: str, reports: list[AgentReport]) -> None:
    """Envia o relatório por email para todos os destinatários configurados."""
    if not Config.EMAIL_TO:
        logger.warning("Nenhum destinatário configurado em EMAIL_TO. Email não enviado.")
        return

    report_date = date.today()
    total_anomalies = sum(len(r.anomalies) for r in reports if r.success)
    status = "🔴 CRÍTICO" if total_anomalies > 3 else ("⚠️ ATENÇÃO" if total_anomalies > 0 else "✅ Normal")

    subject = f"{status} | Relatório Diário Ads — {report_date.strftime('%d/%m/%Y')}"

    html_body = _build_html_email(analysis, reports, report_date)

    # Plain text fallback
    text_body = f"Relatório Diário de Mídia Paga — {report_date.strftime('%d/%m/%Y')}\n\n{analysis}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = Config.EMAIL_FROM
    msg["To"] = ", ".join(Config.EMAIL_TO)
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
        server.sendmail(Config.EMAIL_FROM, Config.EMAIL_TO, msg.as_string())

    logger.info("Email enviado para: %s", ", ".join(Config.EMAIL_TO))
