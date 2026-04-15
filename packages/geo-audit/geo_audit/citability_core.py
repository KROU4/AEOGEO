# Citability scoring adapted from geo-seo-claude (MIT): scripts/citability_scorer.py

from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup


def score_passage(text: str, heading: str | None = None) -> dict[str, Any]:
    """Score a single passage for AI citability (0-100 raw subtotal)."""
    words = text.split()
    word_count = len(words)

    scores = {
        "answer_block_quality": 0,
        "self_containment": 0,
        "structural_readability": 0,
        "statistical_density": 0,
        "uniqueness_signals": 0,
    }

    abq_score = 0
    definition_patterns = [
        r"\b\w+\s+is\s+(?:a|an|the)\s",
        r"\b\w+\s+refers?\s+to\s",
        r"\b\w+\s+means?\s",
        r"\b\w+\s+(?:can be |are )?defined\s+as\s",
        r"\bin\s+(?:simple|other)\s+(?:terms|words)\s*,",
    ]
    for pattern in definition_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            abq_score += 15
            break

    first_60_words = " ".join(words[:60])
    if any(
        re.search(p, first_60_words, re.IGNORECASE)
        for p in [
            r"\b(?:is|are|was|were|means?|refers?)\b",
            r"\d+%",
            r"\$[\d,]+",
            r"\d+\s+(?:million|billion|thousand)",
        ]
    ):
        abq_score += 15

    if heading and heading.endswith("?"):
        abq_score += 10

    sentences = re.split(r"[.!?]+", text)
    short_clear_sentences = sum(1 for s in sentences if 5 <= len(s.split()) <= 25)
    if sentences:
        clarity_ratio = short_clear_sentences / len(sentences)
        abq_score += int(clarity_ratio * 10)

    if re.search(
        r"(?:according to|research shows|studies? (?:show|indicate|suggest|found)|data (?:shows|indicates|suggests))",
        text,
        re.IGNORECASE,
    ):
        abq_score += 10

    scores["answer_block_quality"] = min(abq_score, 30)

    sc_score = 0
    if 134 <= word_count <= 167:
        sc_score += 10
    elif 100 <= word_count <= 200:
        sc_score += 7
    elif 80 <= word_count <= 250:
        sc_score += 4
    elif word_count < 30 or word_count > 400:
        sc_score += 0
    else:
        sc_score += 2

    pronoun_count = len(
        re.findall(
            r"\b(?:it|they|them|their|this|that|these|those|he|she|his|her)\b",
            text,
            re.IGNORECASE,
        )
    )
    if word_count > 0:
        pronoun_ratio = pronoun_count / word_count
        if pronoun_ratio < 0.02:
            sc_score += 8
        elif pronoun_ratio < 0.04:
            sc_score += 5
        elif pronoun_ratio < 0.06:
            sc_score += 3

    proper_nouns = len(re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text))
    if proper_nouns >= 3:
        sc_score += 7
    elif proper_nouns >= 1:
        sc_score += 4

    scores["self_containment"] = min(sc_score, 25)

    sr_score = 0
    if sentences:
        avg_sentence_length = word_count / len(sentences)
        if 10 <= avg_sentence_length <= 20:
            sr_score += 8
        elif 8 <= avg_sentence_length <= 25:
            sr_score += 5
        else:
            sr_score += 2

    if re.search(
        r"(?:first|second|third|finally|additionally|moreover|furthermore)",
        text,
        re.IGNORECASE,
    ):
        sr_score += 4

    if re.search(r"(?:\d+[\.\)]\s|\b(?:step|tip|point)\s+\d+)", text, re.IGNORECASE):
        sr_score += 4

    if "\n" in text:
        sr_score += 4

    scores["structural_readability"] = min(sr_score, 20)

    sd_score = 0
    pct_count = len(re.findall(r"\d+(?:\.\d+)?%", text))
    sd_score += min(pct_count * 3, 6)
    dollar_count = len(
        re.findall(r"\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|B|K))?", text)
    )
    sd_score += min(dollar_count * 3, 5)
    number_count = len(
        re.findall(
            r"\b\d+(?:,\d{3})*(?:\.\d+)?\s+(?:users|customers|pages|sites|companies|businesses|people|percent|times|x\b)",
            text,
            re.IGNORECASE,
        )
    )
    sd_score += min(number_count * 2, 4)
    year_count = len(re.findall(r"\b20(?:2[3-9]|1\d)\b", text))
    if year_count > 0:
        sd_score += 2
    source_patterns = [
        r"(?:according to|per|from|by)\s+[A-Z]",
        r"(?:Gartner|Forrester|McKinsey|Harvard|Stanford|MIT|Google|Microsoft|OpenAI|Anthropic)",
        r"\([A-Z][a-z]+(?:\s+\d{4})?\)",
    ]
    for pattern in source_patterns:
        if re.search(pattern, text):
            sd_score += 2

    scores["statistical_density"] = min(sd_score, 15)

    us_score = 0
    if re.search(
        r"(?:our (?:research|study|data|analysis|survey|findings)|we (?:found|discovered|analyzed|surveyed|measured))",
        text,
        re.IGNORECASE,
    ):
        us_score += 5
    if re.search(
        r"(?:case study|for example|for instance|in practice|real-world|hands-on)",
        text,
        re.IGNORECASE,
    ):
        us_score += 3
    if re.search(r"(?:using|with|via|through)\s+[A-Z][a-z]+", text):
        us_score += 2

    scores["uniqueness_signals"] = min(us_score, 10)

    total = sum(scores.values())

    if total >= 80:
        grade = "A"
    elif total >= 65:
        grade = "B"
    elif total >= 50:
        grade = "C"
    elif total >= 35:
        grade = "D"
    else:
        grade = "F"

    return {
        "heading": heading,
        "word_count": word_count,
        "total_score": total,
        "grade": grade,
        "breakdown": scores,
    }


def analyze_html_citability(html: str) -> dict[str, Any]:
    """Analyze content blocks in HTML for citability (page-level average 0–100)."""
    soup = BeautifulSoup(html, "lxml")

    for element in soup.find_all(
        ["script", "style", "nav", "footer", "header", "aside", "form"]
    ):
        element.decompose()

    blocks: list[dict[str, str]] = []
    current_heading = "Introduction"
    current_paragraphs: list[str] = []

    for element in soup.find_all(["h1", "h2", "h3", "h4", "p", "ul", "ol", "table"]):
        if element.name.startswith("h"):
            if current_paragraphs:
                combined = " ".join(current_paragraphs)
                if len(combined.split()) >= 20:
                    blocks.append({"heading": current_heading, "content": combined})
            current_heading = element.get_text(strip=True)
            current_paragraphs = []
        else:
            text = element.get_text(strip=True)
            if text and len(text.split()) >= 5:
                current_paragraphs.append(text)

    if current_paragraphs:
        combined = " ".join(current_paragraphs)
        if len(combined.split()) >= 20:
            blocks.append({"heading": current_heading, "content": combined})

    scored_blocks = [score_passage(b["content"], b["heading"]) for b in blocks]

    if not scored_blocks:
        return {
            "average_citability_score": 0.0,
            "blocks_scored": 0,
        }

    avg_score = sum(b["total_score"] for b in scored_blocks) / len(scored_blocks)
    return {
        "average_citability_score": round(min(avg_score, 100.0), 1),
        "blocks_scored": len(scored_blocks),
    }
