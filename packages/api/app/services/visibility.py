class VisibilityService:
    """Stub visibility metrics service. All methods return hardcoded data."""

    async def get_score(self, project_id: str) -> dict:
        # TODO: Calculate real visibility score from tracked engines
        return {"score": 72, "trend": "+5", "period": "30d"}

    async def get_share_of_voice(self, project_id: str) -> list[dict]:
        # TODO: Query real share-of-voice data across engines
        return [
            {"engine": "ChatGPT", "share": 34.2, "trend": "+2.1"},
            {"engine": "Gemini", "share": 22.1, "trend": "-1.3"},
            {"engine": "Perplexity", "share": 18.7, "trend": "+3.5"},
            {"engine": "Claude", "share": 15.3, "trend": "+1.8"},
            {"engine": "Copilot", "share": 9.7, "trend": "-0.4"},
        ]

    async def get_sentiment(self, project_id: str) -> dict:
        # TODO: Run real sentiment analysis on engine responses
        return {"positive": 68.0, "neutral": 22.0, "negative": 10.0}

    async def get_citation_rate(self, project_id: str) -> dict:
        # TODO: Calculate real citation rate from crawled data
        return {"rate": 0.34, "total_citations": 156, "period": "30d"}
