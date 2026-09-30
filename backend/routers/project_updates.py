"""Campaign news: short dated updates with an optional photo, written by the president or an admin.

Public reading: the latest news across campaigns (home page) and all news of one campaign.
Paused campaigns are hidden from the public, and so is their news.
"""

from datetime import datetime, timezone
from typing import List, Optional

from core.database import get_db
from dependencies.auth import get_manager_actor
from fastapi import APIRouter, Depends, HTTPException, Query, status
from models.project_update import ProjectUpdate
from models.projects import Projects
from pydantic import BaseModel, Field, field_validator
from services import audit
from services.audit import Actor
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/updates", tags=["campaign news"])


def _safe_image(value: Optional[str]) -> Optional[str]:
    """A photo on this site (/...) or in HTTPS: nothing a browser could run."""
    value = (value or "").strip() or None
    if value and (len(value) > 500 or not (value.startswith("https://") or (value.startswith("/") and not value.startswith("//")))):
        raise ValueError("Adresse de photo invalide")
    return value


class UpdateIn(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    body: str = Field(min_length=3, max_length=3000)
    image: Optional[str] = None

    _image = field_validator("image")(_safe_image)


class UpdateOut(BaseModel):
    id: int
    project_id: int
    project_title: Optional[str] = None
    title: str
    body: str
    image: Optional[str] = None
    published_at: datetime


def _public():
    return or_(Projects.status.is_(None), Projects.status != "paused")


def _out(update: ProjectUpdate, title: Optional[str]) -> UpdateOut:
    return UpdateOut(
        id=update.id, project_id=update.project_id, project_title=title, title=update.title,
        body=update.body, image=update.image, published_at=update.published_at,
    )


@router.get("", response_model=List[UpdateOut])
async def latest(
    limit: int = Query(6, ge=1, le=50),
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Public: newest news first, across campaigns or for one campaign."""
    query = select(ProjectUpdate, Projects.title).join(Projects, Projects.id == ProjectUpdate.project_id).where(_public())
    if project_id is not None:
        query = query.where(ProjectUpdate.project_id == project_id)
    rows = (await db.execute(query.order_by(ProjectUpdate.published_at.desc(), ProjectUpdate.id.desc()).limit(limit))).all()
    return [_out(u, title) for u, title in rows]


@router.get("/manage", response_model=List[UpdateOut])
async def manage_list(project_id: int, db: AsyncSession = Depends(get_db), _actor: Actor = Depends(get_manager_actor)):
    """Dashboard: all news of a campaign, paused or not."""
    rows = (await db.execute(
        select(ProjectUpdate, Projects.title).join(Projects, Projects.id == ProjectUpdate.project_id)
        .where(ProjectUpdate.project_id == project_id)
        .order_by(ProjectUpdate.published_at.desc(), ProjectUpdate.id.desc())
    )).all()
    return [_out(u, title) for u, title in rows]


@router.post("/project/{project_id}", response_model=UpdateOut, status_code=status.HTTP_201_CREATED)
async def create(project_id: int, data: UpdateIn, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_manager_actor)):
    project = await db.get(Projects, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Campagne introuvable")
    update = ProjectUpdate(project_id=project_id, title=data.title.strip(), body=data.body.strip(), image=data.image, created_by=actor.id)
    db.add(update)
    await db.commit()
    await db.refresh(update)
    await audit.record(
        db, actor, "project.news_create", f"Actualité publiée sur « {project.title} » : {update.title}",
        target_type="project", target_id=project_id,
    )
    return _out(update, project.title)


@router.put("/{update_id}", response_model=UpdateOut)
async def edit(update_id: int, data: UpdateIn, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_manager_actor)):
    update = await db.get(ProjectUpdate, update_id)
    if not update:
        raise HTTPException(status_code=404, detail="Actualité introuvable")
    update.title, update.body, update.image = data.title.strip(), data.body.strip(), data.image
    update.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(update)
    project = await db.get(Projects, update.project_id)
    await audit.record(
        db, actor, "project.news_update", f"Actualité modifiée : {update.title}",
        target_type="project", target_id=update.project_id,
    )
    return _out(update, project.title if project else None)


@router.delete("/{update_id}")
async def remove(update_id: int, db: AsyncSession = Depends(get_db), actor: Actor = Depends(get_manager_actor)):
    update = await db.get(ProjectUpdate, update_id)
    if not update:
        raise HTTPException(status_code=404, detail="Actualité introuvable")
    title, project_id = update.title, update.project_id
    await db.delete(update)
    await db.commit()
    await audit.record(
        db, actor, "project.news_delete", f"Actualité supprimée : {title}", target_type="project", target_id=project_id,
    )
    return {"message": "Actualité supprimée"}
