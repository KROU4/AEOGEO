"""Model pricing registry — per-model input/output token rates."""

from decimal import Decimal

# Rates are per 1M tokens in USD
MODEL_PRICING: dict[str, dict[str, Decimal]] = {
    # OpenAI
    "gpt-4o": {"input_per_1m": Decimal("2.50"), "output_per_1m": Decimal("10.00")},
    "gpt-4o-mini": {"input_per_1m": Decimal("0.15"), "output_per_1m": Decimal("0.60")},
    "gpt-4.1": {"input_per_1m": Decimal("2.00"), "output_per_1m": Decimal("8.00")},
    "gpt-4.1-mini": {"input_per_1m": Decimal("0.40"), "output_per_1m": Decimal("1.60")},
    "gpt-4.1-nano": {"input_per_1m": Decimal("0.10"), "output_per_1m": Decimal("0.40")},
    "o3": {"input_per_1m": Decimal("10.00"), "output_per_1m": Decimal("40.00")},
    "o3-mini": {"input_per_1m": Decimal("1.10"), "output_per_1m": Decimal("4.40")},
    "o4-mini": {"input_per_1m": Decimal("1.10"), "output_per_1m": Decimal("4.40")},
    # Anthropic
    "claude-opus-4-20250514": {"input_per_1m": Decimal("15.00"), "output_per_1m": Decimal("75.00")},
    "claude-sonnet-4-20250514": {"input_per_1m": Decimal("3.00"), "output_per_1m": Decimal("15.00")},
    "claude-haiku-3-5-20241022": {"input_per_1m": Decimal("0.80"), "output_per_1m": Decimal("4.00")},
    # Google
    "gemini-2.5-pro": {"input_per_1m": Decimal("1.25"), "output_per_1m": Decimal("10.00")},
    "gemini-2.5-flash": {"input_per_1m": Decimal("0.15"), "output_per_1m": Decimal("0.60")},
    "gemini-2.0-flash": {"input_per_1m": Decimal("0.10"), "output_per_1m": Decimal("0.40")},
}

DEFAULT_PRICING: dict[str, Decimal] = {
    "input_per_1m": Decimal("3.00"),
    "output_per_1m": Decimal("15.00"),
}


def calculate_cost(
    model: str, input_tokens: int, output_tokens: int
) -> Decimal:
    pricing = MODEL_PRICING.get(model, DEFAULT_PRICING)
    cost = (
        Decimal(input_tokens) * pricing["input_per_1m"] / Decimal("1000000")
        + Decimal(output_tokens) * pricing["output_per_1m"] / Decimal("1000000")
    )
    return cost.quantize(Decimal("0.000001"))
