"""Spend guardrails for a scan.

A budget stop is a pause, not data loss: the run stops issuing model calls and
leaves the delta watermark where it was so the next run resumes.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


class BudgetExceeded(RuntimeError):
    def __init__(self, limit: str) -> None:
        super().__init__(f"scan budget exceeded: {limit}")
        self.limit = limit


@dataclass
class ScanBudget:
    max_messages: int = 400
    max_llm_calls: int = 600
    max_cost_usd: Decimal = Decimal("15.00")
    max_cost_usd_per_day: Decimal = Decimal("60.00")

    messages: int = 0
    llm_calls: int = 0
    cost_usd: Decimal = field(default_factory=lambda: Decimal("0"))
    prior_day_cost_usd: Decimal = field(default_factory=lambda: Decimal("0"))

    def check(self) -> None:
        if self.messages >= self.max_messages:
            raise BudgetExceeded("max_messages")
        if self.llm_calls >= self.max_llm_calls:
            raise BudgetExceeded("max_llm_calls")
        if self.cost_usd >= self.max_cost_usd:
            raise BudgetExceeded("max_cost_usd")
        if self.prior_day_cost_usd + self.cost_usd >= self.max_cost_usd_per_day:
            raise BudgetExceeded("max_cost_usd_per_day")

    def record_message(self) -> None:
        self.messages += 1

    def record_calls(self, count: int, cost: Decimal) -> None:
        self.llm_calls += count
        self.cost_usd += Decimal(cost)
