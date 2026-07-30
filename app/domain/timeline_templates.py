"""
Named closing-timeline templates. Each workstream's tasks carry day offsets
relative to a caller-supplied start date — app/api/deal_timeline.py resolves
these into concrete start_date/end_date rows when a template is applied.
"""
from __future__ import annotations

TIMELINE_TEMPLATES: dict[str, dict] = {
    "expedited_close": {
        "label": "Expedited Close",
        "description": "~8 week accelerated close — credit docs, diligence, and rating agency workstreams run in parallel.",
        "workstreams": [
            {
                "name": "Credit Documentation",
                "tasks": [
                    {"name": "Draft & circulate initial credit agreement", "owner": "", "offset_start": 0, "offset_end": 2, "is_milestone": False},
                    {"name": "Lender/borrower comment rounds & redlines", "owner": "", "offset_start": 7, "offset_end": 21, "is_milestone": False},
                    {"name": "Finalize ancillary docs (security agmt, guaranties, intercreditor)", "offset_start": 14, "offset_end": 26, "owner": "", "is_milestone": False},
                    {"name": "Execute & deliver final credit docs", "owner": "", "offset_start": 26, "offset_end": 28, "is_milestone": False},
                ],
            },
            {
                "name": "Financial Diligence",
                "tasks": [
                    {"name": "Receive diligence materials from borrower", "owner": "", "offset_start": 5, "offset_end": 5, "is_milestone": True},
                    {"name": "Financial Diligence Review", "owner": "", "offset_start": 5, "offset_end": 16, "is_milestone": False},
                    {"name": "QoE via third-party provider", "owner": "", "offset_start": 12, "offset_end": 41, "is_milestone": False},
                    {"name": "Diligence findings memo to IC", "owner": "", "offset_start": 23, "offset_end": 23, "is_milestone": True},
                ],
            },
            {
                "name": "Rating Agency Process",
                "tasks": [
                    {"name": "Prepare rating agency presentation & data package", "owner": "", "offset_start": 19, "offset_end": 28, "is_milestone": False},
                    {"name": "Submit application & materials to rating agency", "owner": "", "offset_start": 29, "offset_end": 29, "is_milestone": True},
                    {"name": "Rating agency review & Q&A", "owner": "", "offset_start": 29, "offset_end": 47, "is_milestone": False},
                    {"name": "Receive shadow / private rating", "owner": "", "offset_start": 50, "offset_end": 50, "is_milestone": True},
                ],
            },
            {
                "name": "Closing & Funding",
                "tasks": [
                    {"name": "Satisfy remaining closing conditions", "owner": "", "offset_start": 50, "offset_end": 55, "is_milestone": False},
                    {"name": "Fund / Close (target)", "owner": "", "offset_start": 56, "offset_end": 56, "is_milestone": True},
                ],
            },
        ],
    },
    "pre_close_diligence_only": {
        "label": "Pre-Close Diligence Only",
        "description": "Skips credit-documentation drafting and the rating agency process — for deals where a term sheet already exists and only diligence + closing conditions remain.",
        "workstreams": [
            {
                "name": "Financial Diligence",
                "tasks": [
                    {"name": "Receive diligence materials from borrower", "owner": "", "offset_start": 0, "offset_end": 0, "is_milestone": True},
                    {"name": "Financial Diligence Review", "owner": "", "offset_start": 0, "offset_end": 10, "is_milestone": False},
                    {"name": "QoE via third-party provider", "owner": "", "offset_start": 5, "offset_end": 30, "is_milestone": False},
                    {"name": "Diligence findings memo to IC", "owner": "", "offset_start": 18, "offset_end": 18, "is_milestone": True},
                ],
            },
            {
                "name": "Closing & Funding",
                "tasks": [
                    {"name": "Satisfy remaining closing conditions", "owner": "", "offset_start": 18, "offset_end": 24, "is_milestone": False},
                    {"name": "Fund / Close (target)", "owner": "", "offset_start": 25, "offset_end": 25, "is_milestone": True},
                ],
            },
        ],
    },
}
