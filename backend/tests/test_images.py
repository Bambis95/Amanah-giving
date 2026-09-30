"""Campaign photos: upload from the dashboard (resized, metadata removed), public download."""

import io

from PIL import Image

from tests.conftest import db_fetch, login, register, set_role


def photo(width=3000, height=2000, fmt="JPEG", mode="RGB", exif_gps=False):
    image = Image.new(mode, (width, height), (200, 120, 40) if mode == "RGB" else (200, 120, 40, 0))
    buffer = io.BytesIO()
    kwargs = {}
    if exif_gps:
        exif = Image.Exif()
        exif[0x010F] = "PhoneMaker"  # Make
        exif[0x8825] = {2: (14.0, 47.0, 0.0)}  # GPSInfo: latitude
        kwargs["exif"] = exif
    image.save(buffer, fmt, **kwargs)
    return buffer.getvalue()


def upload(client, content, name="photo.jpg", mime="image/jpeg"):
    return client.post("/api/v1/images", files={"file": (name, content, mime)})


def test_admin_photo_is_resized_cleaned_and_public(client, admin):
    r = upload(client, photo(exif_gps=True))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["url"] == f"/api/v1/images/{body['id']}"
    assert (body["width"], body["height"]) == (1600, 1067)

    client.cookies.clear()  # anyone can see the photo
    r = client.get(body["url"])
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    assert "immutable" in r.headers["cache-control"]
    stored = Image.open(io.BytesIO(r.content))
    assert stored.size == (1600, 1067)
    assert not stored.getexif()  # no maker, no GPS position

    assert db_fetch("SELECT action FROM audit_logs")[0]["action"] == "project.image_upload"


def test_transparent_png_and_small_photo_are_kept_small(client, admin):
    r = upload(client, photo(400, 300, fmt="PNG", mode="RGBA"), name="logo.png", mime="image/png")
    assert r.status_code == 201, r.text
    assert (r.json()["width"], r.json()["height"]) == (400, 300)  # never enlarged
    pixel = Image.open(io.BytesIO(client.get(r.json()["url"]).content)).getpixel((10, 10))
    assert all(channel > 240 for channel in pixel)  # transparency became white


def test_not_an_image_or_too_big_is_refused(client, admin):
    assert upload(client, b"%PDF-1.4 pas une image", name="doc.pdf", mime="application/pdf").status_code == 400
    assert upload(client, b"").status_code == 400
    assert upload(client, b"0" * (12 * 1024 * 1024 + 1)).status_code == 413
    assert db_fetch("SELECT count(*) AS n FROM images")[0]["n"] == 0


def test_only_president_and_admin_upload(client):
    assert upload(client, photo(100, 100)).status_code == 401
    register(client, "membre@example.com")
    set_role("membre@example.com", "member")
    login(client, "membre@example.com")
    assert upload(client, photo(100, 100)).status_code == 403
    set_role("membre@example.com", "president")
    assert upload(client, photo(100, 100)).status_code == 201


def test_unknown_or_malformed_id_is_404(client):
    assert client.get("/api/v1/images/" + "0" * 32).status_code == 404
    assert client.get("/api/v1/images/../../etc").status_code == 404
