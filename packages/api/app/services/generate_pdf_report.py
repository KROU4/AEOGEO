"""Build PDF exports from persisted report JSON (ReportLab).

Used by the project report download endpoint. Keeps layout logic in one place
so the API and any future CLI wrapper share the same renderer.
"""

from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_BODY_FONT = "Helvetica"
_TITLE_FONT = "Helvetica-Bold"
_FONT_REGISTERED = False


def _register_body_font() -> None:
    """Prefer a TTF with Cyrillic coverage when a common system font exists."""
    global _BODY_FONT, _TITLE_FONT, _FONT_REGISTERED
    if _FONT_REGISTERED:
        return
    _FONT_REGISTERED = True
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


def _dict_to_kv_rows(d: dict[str, Any]) -> list[list[str]]:
    rows: list[list[str]] = []
    for k, v in d.items():
        if isinstance(v, (dict, list)):
            continue
        rows.append([str(k), str(v)])
    return rows


def _make_table(
    data: list[list[str]],
    col_widths: list[float] | None = None,
) -> Table:
    repeat = 1 if len(data) > 1 else 0
    t = Table(data, colWidths=col_widths, repeatRows=repeat)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e7e5e4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), _TITLE_FONT),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#fafaf9")],
                ),
            ]
        )
    )
    return t


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
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=title[:200],
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        name="H1",
        parent=styles["Heading1"],
        fontName=_TITLE_FONT,
        fontSize=18,
        spaceAfter=12,
    )
    h2 = ParagraphStyle(
        name="H2",
        parent=styles["Heading2"],
        fontName=_TITLE_FONT,
        fontSize=12,
        spaceBefore=14,
        spaceAfter=8,
    )
    body = ParagraphStyle(
        name="Body",
        parent=styles["Normal"],
        fontName=_BODY_FONT,
        fontSize=9,
        leading=12,
    )
    story: list[Any] = []

    story.append(_p(title, h1))
    story.append(
        _p(
            f"Type: {report_type} · Generated: {data.get('generated_at', '—')}",
            body,
        )
    )
    story.append(Spacer(1, 0.15 * inch))

    if report_type == "visibility_audit":
        _append_visibility_audit(story, data, h2, body)
    elif report_type == "competitive_analysis":
        _append_competitive_analysis(story, data, h2, body)
    elif report_type == "content_performance":
        _append_content_performance(story, data, h2, body)
    else:
        story.append(_p(f"Unknown report_type: {report_type}", body))

    doc.build(story)
    return buf.getvalue()


def _append_visibility_audit(
    story: list[Any],
    data: dict[str, Any],
    h2: ParagraphStyle,
    body: ParagraphStyle,
) -> None:
    summary = data.get("summary")
    if isinstance(summary, dict) and summary.get("message"):
        story.append(_p("Summary", h2))
        story.append(_p(str(summary["message"]), body))
    elif isinstance(summary, dict):
        story.append(_p("Score summary", h2))
        rows = [["Metric", "Value"]] + _dict_to_kv_rows(summary)
        story.append(_make_table(rows, col_widths=[2.2 * inch, 4 * inch]))
        story.append(Spacer(1, 0.12 * inch))

    by_engine = data.get("by_engine")
    if isinstance(by_engine, list) and by_engine:
        story.append(_p("Platform breakdown", h2))
        headers = [
            "Engine",
            "Avg total",
            "Mention",
            "Sentiment",
            "Position",
            "Citation",
        ]
        erows: list[list[str]] = [headers]
        for e in by_engine:
            if not isinstance(e, dict):
                continue
            name = str(e.get("engine_name") or e.get("engine_id") or "—")
            erows.append(
                [
                    name,
                    str(e.get("avg_total", "—")),
                    str(e.get("avg_mention", "—")),
                    str(e.get("avg_sentiment", "—")),
                    str(e.get("avg_position", "—")),
                    str(e.get("avg_citation", "—")),
                ]
            )
        story.append(_make_table(erows, col_widths=[1.4 * inch] + [0.85 * inch] * 5))
        story.append(Spacer(1, 0.12 * inch))

    gaps = data.get("top_gaps")
    if isinstance(gaps, list) and gaps:
        story.append(_p("Top gaps (lowest dimensions)", h2))
        grow = [["Dimension", "Avg score"]]
        for g in gaps:
            if isinstance(g, dict):
                grow.append(
                    [
                        str(g.get("dimension", "—")),
                        str(g.get("avg_score", "—")),
                    ]
                )
        story.append(_make_table(grow, col_widths=[3 * inch, 3.2 * inch]))
        story.append(Spacer(1, 0.12 * inch))

    comp = data.get("competitor_mentions")
    if isinstance(comp, list) and comp:
        story.append(_p("Competitor mentions", h2))
        crows = [["Name", "Total", "Sentiment breakdown"]]
        for c in comp:
            if not isinstance(c, dict):
                continue
            sb = c.get("sentiment_breakdown") or {}
            sb_s = ", ".join(f"{k}: {v}" for k, v in sb.items()) if sb else "—"
            crows.append(
                [
                    str(c.get("name", "—")),
                    str(c.get("total_mentions", "—")),
                    sb_s,
                ]
            )
        story.append(_make_table(crows, col_widths=[1.8 * inch, 1 * inch, 3.4 * inch]))


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
            rows = [["Field", "Value"]] + _dict_to_kv_rows(pos)
            story.append(_make_table(rows, col_widths=[2.2 * inch, 4 * inch]))
        story.append(Spacer(1, 0.12 * inch))

    brand = data.get("brand_mentions")
    if isinstance(brand, dict) and brand:
        story.append(_p("Brand mentions", h2))
        rows = [["Field", "Value"]] + _dict_to_kv_rows(brand)
        story.append(_make_table(rows, col_widths=[2.2 * inch, 4 * inch]))
        story.append(Spacer(1, 0.12 * inch))

    ca = data.get("competitor_analysis")
    if isinstance(ca, list) and ca:
        story.append(_p("Competitor analysis", h2))
        crows = [["Name", "Total mentions", "Avg position", "Sentiment"]]
        for c in ca:
            if not isinstance(c, dict):
                continue
            sb = c.get("sentiment_breakdown") or {}
            sb_s = ", ".join(f"{k}: {v}" for k, v in sb.items()) if sb else "—"
            crows.append(
                [
                    str(c.get("name", "—")),
                    str(c.get("total_mentions", "—")),
                    str(c.get("avg_position", "—")),
                    sb_s,
                ]
            )
        story.append(
            _make_table(
                crows,
                col_widths=[1.5 * inch, 1.1 * inch, 1 * inch, 2.6 * inch],
            )
        )


def _append_content_performance(
    story: list[Any],
    data: dict[str, Any],
    h2: ParagraphStyle,
    body: ParagraphStyle,
) -> None:
    pub = data.get("published_content")
    if isinstance(pub, list) and pub:
        story.append(_p("Published content", h2))
        rows = [["Title", "Type", "Published"]]
        for item in pub[:30]:
            if not isinstance(item, dict):
                continue
            rows.append(
                [
                    str(item.get("title", "—"))[:80],
                    str(item.get("content_type", "—")),
                    str(item.get("published_at", "—"))[:32],
                ]
            )
        story.append(_make_table(rows, col_widths=[3 * inch, 1.2 * inch, 2 * inch]))
        story.append(Spacer(1, 0.12 * inch))

    impact = data.get("content_impact")
    if isinstance(impact, dict):
        story.append(_p("Content impact", h2))
        if impact.get("message"):
            story.append(_p(str(impact["message"]), body))
        else:
            rows = [["Field", "Value"]] + _dict_to_kv_rows(impact)
            story.append(_make_table(rows, col_widths=[2.2 * inch, 4 * inch]))
        story.append(Spacer(1, 0.12 * inch))

    trends = data.get("score_trends")
    if isinstance(trends, list) and trends:
        story.append(_p("Recent score trends (sample)", h2))
        trows = [["Created", "Avg total"]]
        for tr in trends[:15]:
            if isinstance(tr, dict):
                trows.append(
                    [
                        str(tr.get("created_at", "—"))[:28],
                        str(tr.get("avg_total", "—")),
                    ]
                )
        story.append(_make_table(trows, col_widths=[3.5 * inch, 2.7 * inch]))
