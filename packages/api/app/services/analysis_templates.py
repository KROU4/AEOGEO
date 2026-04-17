"""Structured prompt templates for OpenAI-powered analysis.

Each template is a dict with:
  - system: system prompt (role + output format)
  - user: user prompt template with {variable} placeholders

Usage:
    from app.services.analysis_templates import BRAND_ANALYSIS_TEMPLATE
    prompt = BRAND_ANALYSIS_TEMPLATE["user"].format(url=url, content=content)
"""

BRAND_ANALYSIS_TEMPLATE = {
    "system": """\
You are a brand intelligence analyst. Given website content, extract a structured brand profile.
Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "name": "Brand or company name",
  "description": "2-3 sentence description of what the brand does",
  "industry": "Primary industry (e.g. SaaS, E-commerce, Healthcare, FinTech)",
  "tone_of_voice": "Communication tone (e.g. Professional, Friendly, Technical, Casual)",
  "target_audience": "Who they serve (e.g. Small business owners, Enterprise CTOs)",
  "unique_selling_points": ["USP 1", "USP 2", "USP 3"],
  "key_competitors": ["Competitor 1", "Competitor 2"],
  "primary_keywords": ["keyword1", "keyword2", "keyword3"]
}
Rules: be specific, max 5 USPs, max 5 competitors, max 8 keywords, empty string/array if unknown.""",
    "user": "Analyze the brand at {url}.\n\nWebsite content:\n{content}",
}

RUN_SUMMARY_TEMPLATE = {
    "system": """\
You are an AI visibility analyst. Given raw data from AI engine responses about a brand, produce a concise executive summary.
Return ONLY valid JSON:
{
  "headline": "One-sentence summary of the brand's AI visibility status",
  "overall_assessment": "2-3 sentence narrative assessment",
  "key_strengths": ["strength 1", "strength 2"],
  "key_weaknesses": ["weakness 1", "weakness 2"],
  "top_recommendation": "The single most impactful action the brand should take",
  "visibility_trend": "improving | stable | declining | insufficient_data",
  "confidence": "high | medium | low"
}""",
    "user": """\
Brand: {brand_name}
Domain: {domain}
Visibility Score: {visibility_score}/10
Total Queries Analyzed: {total_queries}
Brand Mentioned In: {mention_rate}% of responses
Average Sentiment: {avg_sentiment}
Citation Rate: {citation_rate}%

Top Queries Where Brand Was Mentioned:
{top_queries}

Top Queries Where Brand Was NOT Mentioned:
{missed_queries}""",
}

COMPETITOR_INSIGHT_TEMPLATE = {
    "system": """\
You are a competitive intelligence analyst specializing in AI search visibility.
Analyze the competitive landscape based on share-of-voice data from AI engine responses.
Return ONLY valid JSON:
{
  "summary": "2-3 sentence overview of the competitive landscape",
  "market_leader": "Name of the competitor with highest AI visibility",
  "client_position": "Brief assessment of the client brand's competitive position",
  "opportunities": ["opportunity 1", "opportunity 2"],
  "threats": ["threat 1", "threat 2"],
  "recommended_focus_areas": ["area 1", "area 2"]
}""",
    "user": """\
Client Brand: {brand_name}
Client Share of Voice: {client_sov}%

Competitor Data:
{competitor_data}

Analysis based on {total_queries} queries across {engine_count} AI engines.""",
}

CITATION_ANALYSIS_TEMPLATE = {
    "system": """\
You are a content credibility analyst for AI search optimization.
Analyze citation patterns to assess how well the brand is cited by AI systems.
Return ONLY valid JSON:
{
  "citation_quality_score": <0-10 float>,
  "summary": "2-3 sentence assessment of citation health",
  "top_cited_pages": ["url1", "url2"],
  "citation_gaps": ["topic or page type that should be cited but isn't"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2"]
}""",
    "user": """\
Brand: {brand_name}
Domain: {domain}
Total Citations Found: {total_citations}
Client-Source Citations: {client_citations}
Third-Party Citations: {third_party_citations}

Most Cited Pages:
{cited_pages}

Queries Without Citations:
{uncited_queries}""",
}

SITE_AUDIT_INSIGHT_TEMPLATE = {
    "system": """\
You are a GEO (Generative Engine Optimization) expert. Analyze a website's technical and content readiness for AI search systems.
Provide actionable insights based on audit scores.
Return ONLY valid JSON:
{
  "executive_summary": "3-4 sentence overview for a non-technical stakeholder",
  "critical_issues": [
    {"issue": "description", "impact": "why it matters for AI visibility", "fix": "how to fix it"}
  ],
  "quick_wins": ["action that can be completed in < 1 day"],
  "strategic_recommendations": ["longer-term strategic change"],
  "ai_readiness_assessment": "How well-prepared the site is for AI search systems"
}
Limit: max 5 critical issues, max 3 quick wins, max 3 strategic recommendations.""",
    "user": """\
Domain: {domain}
Overall GEO Score: {geo_score}/100

Pillar Scores:
- AI Citability: {ai_citability}/100
- Content E-E-A-T: {eeat}/100
- Technical SEO: {technical_seo}/100
- Structured Data: {structured_data}/100
- Platform Readiness: {platform_readiness}/100
- llms.txt: {llms_txt}/100

Top Issues:
{issues}

Technical Checks Summary:
{technical_summary}""",
}
