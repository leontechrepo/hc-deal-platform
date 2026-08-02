from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_actor_name, require_auth
from app.db.activity import log_activity
from app.db.models import Deal
from app.db.models.timeline import DealTimelineTask, DealTimelineWorkstream
from app.db.session import get_db
from app.domain.timeline_templates import TIMELINE_TEMPLATES

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

_TASK_STATUSES = {"Not Started", "In Progress", "Complete", "Blocked"}


async def _get_deal_or_404(deal_id: int, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def _task_to_dict(t: DealTimelineTask) -> dict:
    return {
        "id": t.id,
        "workstream_id": t.workstream_id,
        "name": t.name,
        "owner": t.owner,
        "start_date": t.start_date.isoformat() if t.start_date else None,
        "end_date": t.end_date.isoformat() if t.end_date else None,
        "duration_days": t.duration_days,
        "status": t.status,
        "is_milestone": t.is_milestone,
        "sort_order": t.sort_order,
    }


@router.get("/deals/{deal_id}/timeline")
async def get_timeline(deal_id: int, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    ws_result = await db.execute(
        select(DealTimelineWorkstream)
        .where(DealTimelineWorkstream.deal_id == deal_id)
        .order_by(DealTimelineWorkstream.sort_order, DealTimelineWorkstream.id)
    )
    workstreams = ws_result.scalars().all()
    if not workstreams:
        return {"deal_id": deal_id, "workstreams": []}

    tasks_result = await db.execute(
        select(DealTimelineTask)
        .where(DealTimelineTask.workstream_id.in_([w.id for w in workstreams]))
        .order_by(DealTimelineTask.sort_order, DealTimelineTask.id)
    )
    tasks_by_ws: dict[int, list[DealTimelineTask]] = {}
    for t in tasks_result.scalars().all():
        tasks_by_ws.setdefault(t.workstream_id, []).append(t)

    return {
        "deal_id": deal_id,
        "workstreams": [
            {
                "id": w.id,
                "name": w.name,
                "sort_order": w.sort_order,
                "tasks": [_task_to_dict(t) for t in tasks_by_ws.get(w.id, [])],
            }
            for w in workstreams
        ],
    }


@router.get("/timeline/templates")
async def list_timeline_templates():
    return [
        {"key": key, "label": tpl["label"], "description": tpl["description"]}
        for key, tpl in TIMELINE_TEMPLATES.items()
    ]


class ApplyTemplateRequest(BaseModel):
    template_name: str
    start_date: Optional[date] = None


@router.post("/deals/{deal_id}/timeline/from-template")
async def apply_timeline_template(
    deal_id: int,
    body: ApplyTemplateRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    await _get_deal_or_404(deal_id, db)
    template = TIMELINE_TEMPLATES.get(body.template_name)
    if not template:
        raise HTTPException(status_code=400, detail=f"Unknown template: {body.template_name!r}")

    start_date = body.start_date or date.today()

    for ws_order, ws_def in enumerate(template["workstreams"]):
        workstream = DealTimelineWorkstream(deal_id=deal_id, name=ws_def["name"], sort_order=ws_order)
        db.add(workstream)
        await db.flush()

        for task_order, task_def in enumerate(ws_def["tasks"]):
            task_start = start_date + timedelta(days=task_def["offset_start"])
            task_end = start_date + timedelta(days=task_def["offset_end"])
            db.add(DealTimelineTask(
                workstream_id=workstream.id,
                name=task_def["name"],
                owner=task_def.get("owner") or None,
                start_date=task_start,
                end_date=task_end,
                duration_days=(task_end - task_start).days,
                status="Not Started",
                is_milestone=task_def.get("is_milestone", False),
                sort_order=task_order,
            ))

    await log_activity(
        db, deal_id, get_actor_name(auth), "system",
        f"Closing timeline created from template: {template['label']}",
    )

    return await get_timeline(deal_id, db)


class WorkstreamRequest(BaseModel):
    name: str
    sort_order: int = 0


@router.post("/deals/{deal_id}/timeline/workstreams")
async def create_workstream(deal_id: int, body: WorkstreamRequest, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    workstream = DealTimelineWorkstream(deal_id=deal_id, name=body.name, sort_order=body.sort_order)
    db.add(workstream)
    await db.flush()
    return {"id": workstream.id, "deal_id": deal_id, "name": workstream.name, "sort_order": workstream.sort_order, "tasks": []}


class WorkstreamPatchRequest(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


@router.patch("/timeline/workstreams/{workstream_id}")
async def patch_workstream(workstream_id: int, body: WorkstreamPatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DealTimelineWorkstream).where(DealTimelineWorkstream.id == workstream_id))
    workstream = result.scalar_one_or_none()
    if not workstream:
        raise HTTPException(status_code=404, detail="Workstream not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(workstream, field, value)
    workstream.updated_at = datetime.now(timezone.utc)
    return {"id": workstream.id, "name": workstream.name, "sort_order": workstream.sort_order}


@router.delete("/timeline/workstreams/{workstream_id}")
async def delete_workstream(workstream_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DealTimelineWorkstream).where(DealTimelineWorkstream.id == workstream_id))
    workstream = result.scalar_one_or_none()
    if not workstream:
        raise HTTPException(status_code=404, detail="Workstream not found")
    await db.delete(workstream)
    return {"ok": True, "workstream_id": workstream_id}


class TaskRequest(BaseModel):
    name: str
    owner: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = "Not Started"
    is_milestone: bool = False
    sort_order: int = 0


def _validate_status(status: str) -> None:
    if status not in _TASK_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status!r}")


def _duration(start_date: date | None, end_date: date | None) -> int | None:
    if start_date and end_date:
        return (end_date - start_date).days
    return None


@router.post("/timeline/workstreams/{workstream_id}/tasks")
async def create_task(workstream_id: int, body: TaskRequest, db: AsyncSession = Depends(get_db)):
    ws_result = await db.execute(select(DealTimelineWorkstream).where(DealTimelineWorkstream.id == workstream_id))
    if not ws_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workstream not found")
    _validate_status(body.status)
    task = DealTimelineTask(
        workstream_id=workstream_id,
        name=body.name,
        owner=body.owner,
        start_date=body.start_date,
        end_date=body.end_date,
        duration_days=_duration(body.start_date, body.end_date),
        status=body.status,
        is_milestone=body.is_milestone,
        sort_order=body.sort_order,
    )
    db.add(task)
    await db.flush()
    return _task_to_dict(task)


class TaskPatchRequest(BaseModel):
    name: Optional[str] = None
    owner: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    is_milestone: Optional[bool] = None
    sort_order: Optional[int] = None


@router.patch("/timeline/tasks/{task_id}")
async def patch_task(task_id: int, body: TaskPatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DealTimelineTask).where(DealTimelineTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    updates = body.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is not None:
        _validate_status(updates["status"])
    for field, value in updates.items():
        setattr(task, field, value)
    if "start_date" in updates or "end_date" in updates:
        task.duration_days = _duration(task.start_date, task.end_date)
    task.updated_at = datetime.now(timezone.utc)
    return _task_to_dict(task)


@router.delete("/timeline/tasks/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DealTimelineTask).where(DealTimelineTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    return {"ok": True, "task_id": task_id}
