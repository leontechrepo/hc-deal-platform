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
from app.db.models.companies import Company
from app.db.models.contacts import Contact
from app.db.models.deal_team import DealTeamMember
from app.db.models.competition import CompetitionAssessment
from app.db.models.capital_structure import CapitalStructure, ParticipantLender
from app.db.models.underwriting import UnderwritingAssumption
from app.db.models.screening import ScreeningMemo
from app.db.models.covenants import Covenant
from app.db.models.approvals import ApprovalLogEntry
from app.db.models.amendments import Amendment
from app.db.models.risk_ratings import RiskRating

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
    "Company",
    "Contact",
    "DealTeamMember",
    "CompetitionAssessment",
    "CapitalStructure",
    "ParticipantLender",
    "UnderwritingAssumption",
    "ScreeningMemo",
    "Covenant",
    "ApprovalLogEntry",
    "Amendment",
    "RiskRating",
]
