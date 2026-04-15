"""Generate a PDF GEO Site Audit report from FullSiteAuditResult JSON.

Called by the site-audit router's /report.pdf endpoint.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------

_TEAL = colors.HexColor("#0d9488")
_TEAL_LIGHT = colors.HexColor("#ccfbf1")
_NAVY = colors.HexColor("#1e293b")
_AMBER = colors.HexColor("#f59e0b")
_RED = colors.HexColor("#dc2626")
_GREEN = colors.HexColor("#16a34a")
_GREY_BG = colors.HexColor("#f8fafc")
_BORDER = colors.HexColor("#e2e8f0")

_SEVERITY_COLOUR = {
    "critical": _RED,
    "warning": _AMBER,
    "info": _TEAL,
}


def _score_colour(score: float) -> Any:
    if score >= 70:
        return _GREEN
    if score >= 45:
        return _AMBER
    return _RED


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    safe = escape(str(text)).replace("\n", "<br/>")
    return Paragraph(safe, style)


def _make_table(
    rows: list[list[str]],
    col_widths: list[float] | None = None,
    header_colour: Any = _GREY_BG,
) -> Table:
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), header_colour),
                ("TEXTCOLOR", (0, 0), (-1, 0), _NAVY),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.25, _BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _GREY_BG]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return t


def _score_bar_row(label: str, score: float, max_width: float = 200) -> Table:
    """Single-row score bar as a mini-table."""
    pct = min(score / 100.0, 1.0)
    bar_width = pct * max_width
    bar_empty = max_width - bar_width
    colour = _score_colour(score)

    bar_table_data = [
        [
            Paragraph(
                f'<font color="{colour.hexval()}" size="9"><b>{score:.0f}</b></font>',
                getSampleStyleSheet()["Normal"],
            ),
        ]
    ]
    bar_t = Table(bar_table_data, colWidths=[40])
    bar_t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colour),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )

    styles = getSampleStyleSheet()
    label_para = Paragraph(f'<font size="9">{escape(label)}</font>', styles["Normal"])

    outer = Table([[label_para, bar_t]], colWidths=[150, 50])
    outer.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return outer


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def generate_geo_audit_pdf(result_json: dict[str, Any]) -> bytes:
    """Render a GEO site audit PDF from a FullSiteAuditResult JSON dict."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _build_pdf, result_json)


def _build_pdf(data: dict[str, Any]) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="GEO Site Audit Report",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        textColor=_NAVY,
        spaceAfter=4,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=_NAVY,
        spaceBefore=14,
        spaceAfter=6,
    )
    sub = ParagraphStyle(
        "Sub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=2,
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        spaceAfter=4,
    )
    small = ParagraphStyle(
        "Small",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#475569"),
    )

    story: list[Any] = []
    url = data.get("url", "—")
    geo_score = float(data.get("overall_geo_score", 0))
    generated = datetime.now().strftime("%Y-%m-%d %H:%M UTC")

    # ---------------------------------------------------------------- Header
    story.append(_p("GEO Site Audit Report", h1))
    story.append(_p(f"URL: {url}", sub))
    story.append(_p(f"Generated: {generated}", sub))
    story.append(HRFlowable(width="100%", thickness=1, color=_TEAL, spaceAfter=8))

    # ---------------------------------------------------------- Overall Score
    score_colour = _score_colour(geo_score)
    story.append(
        _p(
            f'Overall GEO Score: <font color="{score_colour.hexval()}" size="22"><b>{geo_score:.0f}/100</b></font>',
            ParagraphStyle(
                "ScoreDisplay",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=14,
                spaceAfter=8,
            ),
        )
    )

    # ------------------------------------------------ Pillar Scores Summary
    story.append(_p("Pillar Scores", h2))
    pillar_rows: list[list[Any]] = [["Pillar", "Score", "Weight"]]
    citability = float(data.get("citability_score", 0))
    technical = data.get("technical") or {}
    schema = data.get("schema") or {}
    llmstxt = data.get("llmstxt") or {}
    content = data.get("content") or {}
    platforms = data.get("platforms") or {}

    def _fmt_score(s: Any) -> str:
        try:
            return f"{float(s):.1f}"
        except (TypeError, ValueError):
            return "—"

    pillar_rows += [
        ["AI Citability", _fmt_score(citability), "25%"],
        ["Content E-E-A-T", _fmt_score(content.get("score", 0)), "20%"],
        ["Technical SEO", _fmt_score(technical.get("score", 0)), "15%"],
        ["Structured Data", _fmt_score(schema.get("score", 0)), "10%"],
        ["Platform Readiness", _fmt_score(platforms.get("average", 0)), "10%"],
        ["Brand Authority", _fmt_score(data.get("brand_authority", 0)), "20%"],
    ]
    story.append(
        _make_table(
            pillar_rows,
            col_widths=[3.5 * inch, 1.2 * inch, 1.2 * inch],
        )
    )
    story.append(Spacer(1, 6))

    # ------------------------------------------------ Platform Readiness
    story.append(_p("Platform Readiness", h2))
    platform_rows: list[list[Any]] = [["Platform", "Score"]]
    platform_map = {
        "Google AI Overviews": "google_aio",
        "ChatGPT": "chatgpt",
        "Perplexity": "perplexity",
        "Gemini": "gemini",
        "Bing Copilot": "copilot",
    }
    for name, key in platform_map.items():
        platform_rows.append([name, _fmt_score(platforms.get(key, 0))])
    story.append(_make_table(platform_rows, col_widths=[3.5 * inch, 2.4 * inch]))
    story.append(Spacer(1, 6))

    # ------------------------------------------------ AI Crawler Access
    story.append(_p("AI Crawler Access (robots.txt)", h2))
    crawler_access: dict[str, Any] = technical.get("ai_crawler_access") or {}
    if crawler_access:
        crow: list[list[str]] = [["Crawler", "Status"]]
        for bot, status in list(crawler_access.items())[:15]:
            crow.append([bot, str(status)])
        story.append(_make_table(crow, col_widths=[3 * inch, 3 * inch]))
    else:
        story.append(_p("No robots.txt data available.", body))
    story.append(Spacer(1, 6))

    # ------------------------------------------------ Technical Details
    story.append(_p("Technical Checks", h2))
    tech_checks: list[list[str]] = [["Check", "Result"]]
    bool_checks = [
        ("HTTPS", technical.get("is_https")),
        ("Sitemap found", technical.get("has_sitemap")),
        ("robots.txt found", technical.get("has_robots_txt")),
        ("llms.txt found", technical.get("has_llmstxt")),
        ("Canonical tag", technical.get("has_canonical")),
        ("OG tags", technical.get("has_og_tags")),
        ("Mobile viewport", technical.get("has_mobile_viewport")),
        ("Meta robots noindex", technical.get("has_meta_robots_noindex")),
    ]
    for label, value in bool_checks:
        if value is None:
            continue
        tech_checks.append([label, "Yes" if value else "No"])
    ttfb = technical.get("ttfb_ms")
    if ttfb is not None:
        tech_checks.append(["TTFB (ms)", f"{float(ttfb):.0f}"])
    sitemap_count = technical.get("sitemap_url_count")
    if sitemap_count:
        tech_checks.append(["Sitemap URLs", str(sitemap_count)])
    story.append(_make_table(tech_checks, col_widths=[3 * inch, 3 * inch]))
    story.append(Spacer(1, 6))

    # ------------------------------------------------ Schema/JSON-LD
    story.append(_p("Structured Data (JSON-LD)", h2))
    schema_checks: list[list[str]] = [["Check", "Result"]]
    schema_bools = [
        ("Organization schema", schema.get("has_organization")),
        ("WebSite schema", schema.get("has_website")),
        ("SearchAction", schema.get("has_search_action")),
        ("BreadcrumbList", schema.get("has_breadcrumbs")),
        ("Speakable", schema.get("has_speakable")),
        ("Server-rendered", schema.get("is_server_rendered")),
    ]
    for label, value in schema_bools:
        if value is None:
            continue
        schema_checks.append([label, "Yes" if value else "No"])
    same_as = schema.get("same_as_count")
    if same_as is not None:
        schema_checks.append(["sameAs links", str(same_as)])
    schema_types = schema.get("schema_types") or []
    if schema_types:
        schema_checks.append(["Types detected", ", ".join(schema_types[:8])])
    story.append(_make_table(schema_checks, col_widths=[3 * inch, 3 * inch]))
    story.append(Spacer(1, 6))

    # ------------------------------------------------ Content Quality
    story.append(_p("Content Quality (E-E-A-T)", h2))
    cq_checks: list[list[str]] = [["Metric", "Value"]]
    cq_metrics = [
        ("Word count", content.get("word_count")),
        ("Heading depth", content.get("heading_depth")),
        ("Paragraph count", content.get("paragraph_count")),
        ("Avg sentence length", content.get("avg_sentence_length")),
        ("Statistical density (per 1k words)", content.get("statistical_density")),
        ("Author present", content.get("has_author")),
        ("Publish date present", content.get("has_publish_date")),
        ("External links", content.get("external_link_count")),
        ("Internal links", content.get("internal_link_count")),
        ("AI-scored", content.get("ai_scored")),
    ]
    for label, value in cq_metrics:
        if value is None:
            continue
        if isinstance(value, bool):
            cq_checks.append([label, "Yes" if value else "No"])
        elif isinstance(value, float):
            cq_checks.append([label, f"{value:.1f}"])
        else:
            cq_checks.append([label, str(value)])
    story.append(_make_table(cq_checks, col_widths=[3 * inch, 3 * inch]))

    eeat_rows: list[list[str]] = [["E-E-A-T Dimension", "Score (/25)"]]
    for dim, key in [
        ("Experience", "score_experience"),
        ("Expertise", "score_expertise"),
        ("Authoritativeness", "score_authoritativeness"),
        ("Trustworthiness", "score_trustworthiness"),
    ]:
        v = content.get(key)
        if v is not None:
            eeat_rows.append([dim, f"{float(v):.1f}"])
    if len(eeat_rows) > 1:
        story.append(Spacer(1, 4))
        story.append(_make_table(eeat_rows, col_widths=[3 * inch, 3 * inch]))
    story.append(Spacer(1, 6))

    # ------------------------------------------------ llms.txt
    story.append(_p("llms.txt", h2))
    llms_checks: list[list[str]] = [["Check", "Value"]]
    llms_metrics = [
        ("llms.txt present", llmstxt.get("has_llmstxt")),
        ("llms-full.txt present", llmstxt.get("has_llmstxt_full")),
        ("Sections", llmstxt.get("section_count")),
        ("Links", llmstxt.get("link_count")),
        ("Valid links", llmstxt.get("valid_links")),
        ("Score completeness", llmstxt.get("score_completeness")),
        ("Score accuracy", llmstxt.get("score_accuracy")),
        ("Score usefulness", llmstxt.get("score_usefulness")),
    ]
    for label, value in llms_metrics:
        if value is None:
            continue
        if isinstance(value, bool):
            llms_checks.append([label, "Yes" if value else "No"])
        elif isinstance(value, float):
            llms_checks.append([label, f"{value:.1f}"])
        else:
            llms_checks.append([label, str(value)])
    story.append(_make_table(llms_checks, col_widths=[3 * inch, 3 * inch]))
    story.append(Spacer(1, 6))

    # ------------------------------------------------ Top Issues
    top_issues: list[dict[str, Any]] = data.get("top_issues") or []
    if top_issues:
        story.append(_p("Top Issues", h2))
        issue_rows: list[list[str]] = [["Severity", "Category", "Issue"]]
        for issue in top_issues[:10]:
            if not isinstance(issue, dict):
                continue
            issue_rows.append(
                [
                    str(issue.get("severity", "—")).upper(),
                    str(issue.get("category", "—")),
                    str(issue.get("message", "—"))[:120],
                ]
            )
        issue_table = _make_table(
            issue_rows, col_widths=[1.0 * inch, 1.2 * inch, 3.8 * inch]
        )
        story.append(issue_table)
        story.append(Spacer(1, 6))

    # ------------------------------------------------ Top Recommendations
    top_recs: list[str] = data.get("top_recommendations") or []
    if top_recs:
        story.append(_p("Top Recommendations", h2))
        for i, rec in enumerate(top_recs[:5], 1):
            story.append(_p(f"{i}. {rec}", body))
        story.append(Spacer(1, 6))

    # ---------------------------------------------------------------- Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER, spaceBefore=12))
    story.append(
        _p(
            f"Generated by AEOGEO · {generated} · {url}",
            small,
        )
    )

    doc.build(story)
    return buf.getvalue()
