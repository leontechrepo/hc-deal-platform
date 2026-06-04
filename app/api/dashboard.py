from fastapi import APIRouter

# Dashboard routes have moved to the React SPA (frontend/dist).
# KPI data is served by GET /api/kpis in deals.py.
router = APIRouter()
