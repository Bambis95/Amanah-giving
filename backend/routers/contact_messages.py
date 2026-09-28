import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_manager_actor, get_manager_user
from services import audit
from services.audit import Actor
from schemas.auth import UserResponse
from services.contact_messages import Contact_messagesService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/contact_messages", tags=["contact_messages"])


# ---------- Pydantic Schemas ----------
class Contact_messagesData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    email: str
    phone: str = None
    subject: str = None
    message: str
    is_read: bool = None
    created_at: Optional[datetime] = None


class Contact_messagesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    subject: Optional[str] = None
    message: Optional[str] = None
    is_read: Optional[bool] = None
    created_at: Optional[datetime] = None


class Contact_messagesResponse(BaseModel):
    """Entity response schema"""
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    subject: Optional[str] = None
    message: str
    is_read: Optional[bool] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Contact_messagesListResponse(BaseModel):
    """List response schema"""
    items: List[Contact_messagesResponse]
    total: int
    skip: int
    limit: int


class Contact_messagesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Contact_messagesData]


class Contact_messagesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Contact_messagesUpdateData


class Contact_messagesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Contact_messagesBatchUpdateItem]


class Contact_messagesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Contact_messagesListResponse)
async def query_contact_messagess(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    _admin: UserResponse = Depends(get_manager_user),
    db: AsyncSession = Depends(get_db),
):
    """Query contact_messagess with filtering, sorting, and pagination"""
    logger.debug(f"Querying contact_messagess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Contact_messagesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} contact_messagess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying contact_messagess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Contact_messagesListResponse)
async def query_contact_messagess_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    _admin: UserResponse = Depends(get_manager_user),
    db: AsyncSession = Depends(get_db),
):
    # Query all contact messages: exposes senders' contact details, so admins only
    logger.debug(f"Querying contact_messagess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Contact_messagesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} contact_messagess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying contact_messagess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Contact_messagesResponse)
async def get_contact_messages(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    _admin: UserResponse = Depends(get_manager_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single contact_messages by ID"""
    logger.debug(f"Fetching contact_messages with id: {id}, fields={fields}")
    
    service = Contact_messagesService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Contact_messages with id {id} not found")
            raise HTTPException(status_code=404, detail="Contact_messages not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching contact_messages {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Deleted messages keep only who/subject in the audit log, never their content
MESSAGE_AUDIT_FIELDS = ["name", "email", "subject", "is_read"]


async def _update_with_audit(service: Contact_messagesService, actor: Actor, message_id: int, update_dict: dict):
    existing = await service.get_by_id(message_id)
    if not existing:
        return None
    before = audit.snapshot(existing, MESSAGE_AUDIT_FIELDS)
    result = await service.update(message_id, update_dict)
    if result:
        changes = audit.diff(before, audit.snapshot(result, MESSAGE_AUDIT_FIELDS))
        if list(changes) == ["is_read"]:
            summary = f"Message de {result.name} marqué comme {'lu' if result.is_read else 'non lu'}"
        else:
            summary = f"Message de {result.name} modifié"
        if changes:
            await audit.record(
                service.db, actor, "message.update", summary,
                target_type="message", target_id=message_id, details=changes,
            )
    return result


async def _delete_with_audit(service: Contact_messagesService, actor: Actor, message_id: int) -> bool:
    existing = await service.get_by_id(message_id)
    if not existing:
        return False
    before = audit.snapshot(existing, MESSAGE_AUDIT_FIELDS)
    success = await service.delete(message_id)
    if success:
        await audit.record(
            service.db, actor, "message.delete", f"Message de {before['name']} supprimé",
            target_type="message", target_id=message_id, details=before,
        )
    return success


@router.post("", response_model=Contact_messagesResponse, status_code=201)
async def create_contact_messages(
    data: Contact_messagesData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new contact_messages"""
    logger.debug(f"Creating new contact_messages with data: {data}")
    
    service = Contact_messagesService(db)
    try:
        result = await service.create(data.model_dump(exclude_none=True))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create contact_messages")
        
        logger.info(f"Contact_messages created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating contact_messages: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating contact_messages: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Contact_messagesResponse], status_code=201)
async def create_contact_messagess_batch(
    request: Contact_messagesBatchCreateRequest,
    actor: Actor = Depends(get_manager_actor),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple contact_messagess in a single request"""
    logger.debug(f"Batch creating {len(request.items)} contact_messagess")
    
    service = Contact_messagesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(exclude_none=True))
            if result:
                await audit.record(
                    db, actor, "message.create", f"Message ajouté pour {result.name}",
                    target_type="message", target_id=result.id,
                )
                results.append(result)
        
        logger.info(f"Batch created {len(results)} contact_messagess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Contact_messagesResponse])
async def update_contact_messagess_batch(
    request: Contact_messagesBatchUpdateRequest,
    actor: Actor = Depends(get_manager_actor),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple contact_messagess in a single request"""
    logger.debug(f"Batch updating {len(request.items)} contact_messagess")
    
    service = Contact_messagesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await _update_with_audit(service, actor, item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} contact_messagess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Contact_messagesResponse)
async def update_contact_messages(
    id: int,
    data: Contact_messagesUpdateData,
    actor: Actor = Depends(get_manager_actor),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing contact_messages"""
    logger.debug(f"Updating contact_messages {id} with data: {data}")

    service = Contact_messagesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await _update_with_audit(service, actor, id, update_dict)
        if not result:
            logger.warning(f"Contact_messages with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Contact_messages not found")
        
        logger.info(f"Contact_messages {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating contact_messages {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating contact_messages {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_contact_messagess_batch(
    request: Contact_messagesBatchDeleteRequest,
    actor: Actor = Depends(get_manager_actor),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple contact_messagess by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} contact_messagess")
    
    service = Contact_messagesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await _delete_with_audit(service, actor, item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} contact_messagess successfully")
        return {"message": f"Successfully deleted {deleted_count} contact_messagess", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_contact_messages(
    id: int,
    actor: Actor = Depends(get_manager_actor),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single contact_messages by ID"""
    logger.debug(f"Deleting contact_messages with id: {id}")
    
    service = Contact_messagesService(db)
    try:
        success = await _delete_with_audit(service, actor, id)
        if not success:
            logger.warning(f"Contact_messages with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Contact_messages not found")
        
        logger.info(f"Contact_messages {id} deleted successfully")
        return {"message": "Contact_messages deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting contact_messages {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")