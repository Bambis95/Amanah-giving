"""Campaign photos uploaded from the dashboard.

A president or an admin sends a phone photo; it is re-encoded as a JPEG at most 1600 px wide
(about 100-300 KB), turned upright, and stripped of its metadata (EXIF can hold the GPS position
of the phone). The public URL is /api/v1/images/<id>, served by the website's /api relay.
"""

import io
import logging
import re
import secrets

from core.database import get_db
from dependencies.auth import get_manager_actor
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from models.image import StoredImage
from PIL import Image, ImageOps, UnidentifiedImageError
from services import audit
from services.audit import Actor
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/images", tags=["images"])
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 12 * 1024 * 1024
MAX_SIDE = 1600
JPEG_QUALITY = 82
ACCEPTED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "MPO"}  # MPO: some phone cameras' JPEG variant
# A huge pixel count in a small file ("decompression bomb") is refused instead of filling the memory
Image.MAX_IMAGE_PIXELS = 50_000_000
ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")


def _process(raw: bytes) -> tuple[bytes, int, int]:
    """Decode, straighten, shrink and re-encode as JPEG. Raises ValueError with a French message."""
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in ACCEPTED_FORMATS:
                raise ValueError("Format non pris en charge : envoyez une photo JPEG, PNG ou WebP.")
            image = ImageOps.exif_transpose(source)
            image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
            if image.mode in ("RGBA", "LA", "P"):
                # Transparent areas become white rather than black
                rgba = image.convert("RGBA")
                image = Image.new("RGB", rgba.size, (255, 255, 255))
                image.paste(rgba, mask=rgba.getchannel("A"))
            elif image.mode != "RGB":
                image = image.convert("RGB")
            out = io.BytesIO()
            # A new file without the original EXIF/XMP data
            image.save(out, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
            return out.getvalue(), image.width, image.height
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise ValueError("Ce fichier n'est pas une image lisible (JPEG, PNG ou WebP).") from exc


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    actor: Actor = Depends(get_manager_actor),
):
    """Store a campaign photo and return its public URL."""
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Photo trop lourde (12 Mo au maximum).")
    if not raw:
        raise HTTPException(status_code=400, detail="Le fichier est vide.")
    try:
        data, width, height = _process(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    image = StoredImage(
        id=secrets.token_hex(16),
        content_type="image/jpeg",
        data=data,
        width=width,
        height=height,
        size=len(data),
        uploaded_by=actor.id,
    )
    db.add(image)
    await db.commit()
    url = f"/api/v1/images/{image.id}"
    await audit.record(
        db, actor, "project.image_upload", f"Photo ajoutée ({width}×{height}, {len(data) // 1024} Ko)",
        target_type="image", target_id=image.id, details={"fichier": (file.filename or "")[:100]},
    )
    logger.info("Image %s stored: %sx%s, %s bytes (from %s bytes)", image.id, width, height, len(data), len(raw))
    return {"id": image.id, "url": url, "width": width, "height": height, "size": len(data)}


@router.get("/{image_id}")
async def get_image(image_id: str, db: AsyncSession = Depends(get_db)):
    """Public: the photo itself. Its content never changes, so browsers may keep it for a year."""
    if not ID_PATTERN.match(image_id):
        raise HTTPException(status_code=404, detail="Image introuvable")
    image = await db.get(StoredImage, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image introuvable")
    return Response(
        content=image.data,
        media_type=image.content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"},
    )
