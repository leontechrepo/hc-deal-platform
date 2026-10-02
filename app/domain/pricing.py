"""Token cost estimation — labelled estimates, not billing sources."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

# USD per million tokens. Snapshot; re-check when models change.
_RATES: dict[str, tuple[Decimal, Decimal]] = {
    "claude-opus-5": (Decimal("5.00"), Decimal("25.00")),
    "claude-sonnet-4-6": (Decimal("3.00"), Decimal("15.00")),
    "claude-sonnet-5": (Decimal("3.00"), Decimal("15.00")),
    "claude-haiku-4-5": (Decimal("1.00"), Decimal("5.00")),
}

_CACHE_READ_MULTIPLIER = Decimal("0.1")
_CACHE_WRITE_MULTIPLIER = Decimal("1.25")
_MILLION = Decimal(1_000_000)


@dataclass(frozen=True)
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0

    @classmethod
    def from_response(cls, usage) -> "Usage":
        return cls(
            input_tokens=getattr(usage, "input_tokens", 0) or 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0,
            cache_read_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
            cache_write_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
        )

    def __add__(self, other: "Usage") -> "Usage":
        return Usage(
            self.input_tokens + other.input_tokens,
            self.output_tokens + other.output_tokens,
            self.cache_read_tokens + other.cache_read_tokens,
            self.cache_write_tokens + other.cache_write_tokens,
        )


def estimate_cost(model: str, usage: Usage) -> Decimal:
    """Estimated USD for one request. Unknown models cost zero, not a guess."""
    rates = _RATES.get(model)
    if rates is None:
        return Decimal("0")
    input_rate, output_rate = rates

    cost = (
        Decimal(usage.input_tokens) * input_rate
        + Decimal(usage.output_tokens) * output_rate
        + Decimal(usage.cache_read_tokens) * input_rate * _CACHE_READ_MULTIPLIER
        + Decimal(usage.cache_write_tokens) * input_rate * _CACHE_WRITE_MULTIPLIER
    ) / _MILLION
    return cost.quantize(Decimal("0.000001"))


def is_priced(model: str) -> bool:
    return model in _RATES
