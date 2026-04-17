"""Build PDF exports from persisted report JSON (ReportLab).

Used by the project report download endpoint. Keeps layout logic in one place
so the API and any future CLI wrapper share the same renderer.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
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
# Colours (consistent with geo_report_pdf.py)
# ---------------------------------------------------------------------------

_TEAL = colors.HexColor("#0d9488")
_NAVY = colors.HexColor("#1e293b")
_GREY_BG = colors.HexColor("#f8fafc")
_BORDER = colors.HexColor("#e2e8f0")
_AMBER = colors.HexColor("#f59e0b")
_GREEN = colors.HexColor("#16a34a")
_RED = colors.HexColor("#dc2626")

_BODY_FONT = "Helvetica"
_TITLE_FONT = "Helvetica-Bold"
_FONT_REGISTERED = False


def _register_body_font() -> None:
    """Prefer a TTF with Cyrillic coverage when a common system font exists."""
    global _BODY_FONT, _TITLE_FONT, _FONT_REGISTERED
    if _FONT_REGISTERED:
        return
    _FONT_REGISTERED = True
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    candidates = [
        Path(os.environ.get("WINDIR", "")) / "Fonts" / "arial.ttf",
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    ]
    for path in candidates:
        if path.is_file():
            name = "AeoReportBody"
            pdfmetrics.registerFont(TTFont(name, str(path)))
            _BODY_FONT = name
            _TITLE_FONT = name
            return


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    safe = escape(str(text)).replace("\n", "<br/>")
    return Paragraph(safe, style)


def _fmt(value: Any, decimals: int = 1) -> str:
    """Format a numeric value to fixed decimals, or return '—'."""
    try:
        return f"{float(value):.{decimals}f}"
    except (TypeError, ValueError):
        return "—"


def _make_table(
    data: list[list[Any]],
    col_widths: list[float] | None = None,
) -> Table:
    repeat = 1 if len(data) > 1 else 0
    t = Table(data, colWidths=col_widths, repeatRows=repeat)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), _GREY_BG),
                ("TEXTCOLOR", (0, 0), (-1, 0), _NAVY),
                ("FONTNAME", (0, 0), (-1, 0), _TITLE_FONT),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
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


def _hr(story: list[Any]) -> None:
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER, spaceBefore=8, spaceAfter=8))


def build_report_pdf_bytes(
    *,
    title: str,
    report_type: str,
    data_json: dict[str, Any] | None,
) -> bytes:
    """Render a PDF from stored report metadata and ``data_json`` payload."""
    _register_body_font()
    data = data_json or {}

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=title[:200],
    )
    styles = getSampleStyleSheet()

    h1 = ParagraphStyle(
        name="H1",
        parent=styles["Heading1"],
        fontName=_TITLE_FONT,
        fontSize=20,
        textColor=_NAVY,
        spaceAfter=4,
    )
    h2 = ParagraphStyle(
        name="H2",
        parent=styles["Heading2"],
        fontName=_TITLE_FONT,
        fontSize=12,
        textColor=_NAVY,
        spaceBefore=14,
        spaceAfter=6,
    )
    sub = ParagraphStyle(
        name="Sub",
        parent=styles["Normal"],
        fontName=_BODY_FONT,
        fontSize=9,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=2,
    )
    body = ParagraphStyle(
        name="Body",
        parent=styles["Normal"],
        fontName=_BODY_FONT,
        fontSize=9,
        leading=13,
        spaceAfter=4,
    )
    small = ParagraphStyle(
        name="Small",
        parent=styles["Normal"],
        fontName=_BODY_FONT,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#475569"),
    )

    story: list[Any] = []
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # ---------------------------------------------------------------- Header
    story.append(_p(title, h1))
    story.append(_p(f"Type: {report_type.replace('_', ' ').title()} · Generated: {generated}", sub))
    story.append(HRFlowable(width="100%", thickness=1, color=_TEAL, spaceAfter=10))

    if report_type == "visibility_audit":
        _append_visibility_audit(story, data, h2, body)
    elif report_type == "competitive_analysis":
        _append_competitive_analysis(story, data, h2, body)
    elif report_type == "content_performance":
        _append_content_performance(story, data, h2, body)
    else:
        story.append(_p(f"Unknown report type: {report_type}", body))

    # ---------------------------------------------------------------- Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER, spaceBefore=16))
    story.append(_p(f"Generated by AEOGEO · {generated}", small))

    doc.build(story)
    return buf.getvalue()


def _append_visibility_audit(
    story: list[Any],
    data: dict[str, Any],
    h2: ParagraphStyle,
    body: ParagraphStyle,
) -> None:
    # Summary
    summary = data.get("summary")
    if isinstance(summary, dict) and not summary.get("message"):
        story.append(_p("Score Summary", h2))
        rows: list[list[str]] = [["Metric", "Value"]]
        for k, v in summary.items():
            if not isinstance(v, (dict, list)):
                rows.append([str(k).replace("_", " ").title(), _fmt(v) if isinstance(v, float) else str(v)])
        if len(rows) > 1:
            story.append(_make_table(rows, col_widths=[3 * inch, 3.5 * inch]))
            story.append(Spacer(1, 6))

    # Platform breakdown
    _hr(story)
    story.append(_p("Platform Breakdown", h2))
    by_engine = data.get("by_engine")
    if isinstance(by_engine, list) and by_engine:
        headers = ["Engine", "Overall", "Mention", "Sentiment", "Position", "Citation"]
        erows: list[list[str]] = [headers]
        for e in by_engine:
            if not isinstance(e, dict):
                continue
            name = str(e.get("engine_name") or e.get("engine_id") or "—")
            erows.append([
                name,
                _fmt(e.get("avg_total")),
                _fmt(e.get("avg_mention")),
                _fmt(e.get("avg_sentiment")),
                _fmt(e.get("avg_position")),
                _fmt(e.get("avg_citation")),
            ])
        story.append(_make_table(erows, col_widths=[1.5 * inch] + [0.9 * inch] * 5))
    else:
        story.append(Paragraph(
            "No completed engine runs yet. Run a visibility scan first to populate this section.",
            ParagraphStyle("info", parent=body, textColor=colors.HexColor("#64748b"), fontName="Helvetica-Oblique"),
        ))
    story.append(Spacer(1, 6))

    # Top gaps
    gaps = data.get("top_gaps")
    if isinstance(gaps, list) and gaps:
        _hr(story)
        story.append(_p("Top Gaps (Lowest Dimensions)", h2))
        grow: list[list[str]] = [["Dimension", "Avg Score"]]
        for g in gaps:
            if isinstance(g, dict):
                grow.append([
                    str(g.get("dimension", "—")).replace("_", " ").title(),
                    _fmt(g.get("avg_score")),
                ])
        story.append(_make_table(grow, col_widths=[3.5 * inch, 3 * inch]))
        story.append(Spacer(1, 6))

    # Competitor mentions
    comp = data.get("competitor_mentions")
    if isinstance(comp, list) and comp:
        _hr(story)
        story.append(_p("Competitor Mentions", h2))
        crows: list[list[str]] = [["Name", "Total", "Sentiment Breakdown"]]
        for c in comp:
            if not isinstance(c, dict):
                continue
            sb = c.get("sentiment_breakdown") or {}
            sb_s = ", ".join(f"{k}: {v}" for k, v in sb.items()) if sb else "—"
            crows.append([
                str(c.get("name", "—")),
                str(c.get("total_mentions", "—")),
                sb_s,
            ])
        story.append(_make_table(crows, col_widths=[2 * inch, 1 * inch, 3.5 * inch]))


def _append_competitive_analysis(
    story: list[Any],
    data: dict[str, Any],
    h2: ParagraphStyle,
    body: ParagraphStyle,
) -> None:
    pos = data.get("positioning")
    if isinstance(pos, dict):
        story.append(_p("Positioning", h2))
        if pos.get("message"):
            story.append(_p(str(pos["message"]), body))
        else:
            rows: list[list[str]] = [["Field", "Value"]]
            for k, v in pos.items():
                if not isinstance(v, (dict, list)):
                    rows.append([str(k).replace("_", " ").title(), _fmt(v) if isinstance(v, float) else str(v)])
            if len(rows) > 1:
                story.append(_make_table(rows, col_widths=[2.5 * inch, 4 * inch]))
        story.append(Spacer(1, 6))

    brand = data.get("brand_mentions")
    if isinstance(brand, dict) and brand:
        _hr(story)
        story.append(_p("Brand Mentions", h2))
        rows = [["Field", "Value"]]
        for k, v in brand.items():
            if not isinstance(v, (dict, list)):
                rows.append([str(k).replace("_", " ").title(), _fmt(v) if isinstance(v, float) else str(v)])
        if len(rows) > 1:
            story.append(_make_table(rows, col_widths=[2.5 * inch, 4 * inch]))
        story.append(Spacer(1, 6))

    ca = data.get("competitor_analysis")
    if isinstance(ca, list) and ca:
        _hr(story)
        story.append(_p("Competitor Analysis", h2))
        crows: list[list[str]] = [["Name", "Total Mentions", "Avg Position", "Sentiment"]]
        for c in ca:
            if not isinstance(c, dict):
                continue
            sb = c.get("sentiment_breakdown") or {}
            sb_s = ", ".join(f"{k}: {v}" for k, v in sb.items()) if sb else "—"
            crows.append([
                str(c.get("name", "—")),
                str(c.get("total_mentions", "—")),
                _fmt(c.get("avg_position")),
                sb_s,
            ])
        story.append(_make_table(
            crows,
            col_widths=[1.8 * inch, 1.2 * inch, 1.2 * inch, 2.3 * inch],
        ))

    if not any([pos, brand, ca]):
        story.append(Paragraph(
            "No competitive data available yet. Run a visibility scan to generate competitive analysis.",
            ParagraphStyle("info", parent=body, textColor=colors.HexColor("#64748b"), fontName="Helvetica-Oblique"),
        ))


def _append_content_performance(
    story: list[Any],
    data: dict[str, Any],
    h2: ParagraphStyle,
    body: ParagraphStyle,
) -> None:
    story.append(_p("Visibility Score Trend", h2))
    story.append(_p(
        "This report shows your overall visibility score over time across all AI platforms. "
        "Higher scores indicate better AI discoverability.",
        body,
    ))
    story.append(Spacer(1, 6))

    trends = data.get("score_trends")
    if isinstance(trends, list) and trends:
        trows: list[list[str]] = [["Date", "Overall Score"]]
        for tr in trends[:20]:
            if isinstance(tr, dict):
                trows.append([
                    str(tr.get("created_at", "—"))[:19],
                    _fmt(tr.get("avg_total")),
                ])
        story.append(_make_table(trows, col_widths=[4 * inch, 2.5 * inch]))
    else:
        story.append(Paragraph(
            "No score history available yet. Complete at least one visibility run to see trend data.",
            ParagraphStyle("info", parent=body, textColor=colors.HexColor("#64748b"), fontName="Helvetica-Oblique"),
        ))
