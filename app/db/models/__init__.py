"""
Re-exports every model so existing call sites (`from app.db.models import Deal, ...`)
keep working unchanged now that this is a package instead of a single module.
"""
from app.db.models.deals import Deal, DealUpdateLog
from app.db.models.suggestions import EmailScanLog, PendingSuggestion
from app.db.models.sponsors import Sponsor
from app.db.models.funds import Fund, FundLP
from app.db.models.portfolio import PortfolioMonitoringTest, PortfolioPosition
from app.db.models.documents import DealDocument
from app.db.models.activity import DealActivity, DealNote
from app.db.models.timeline import DealTimelineTask, DealTimelineWorkstream
from app.db.models.chat import ChatMessage, ChatSession

__all__ = [
    "Deal",
    "DealUpdateLog",
    "EmailScanLog",
    "PendingSuggestion",
    "Sponsor",
    "Fund",
    "FundLP",
    "PortfolioPosition",
    "PortfolioMonitoringTest",
    "DealDocument",
    "DealActivity",
    "DealNote",
    "DealTimelineWorkstream",
    "DealTimelineTask",
    "ChatSession",
    "ChatMessage",
]
