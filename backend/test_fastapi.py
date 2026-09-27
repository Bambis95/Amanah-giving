from fastapi import FastAPI, APIRouter

app = FastAPI()

router = APIRouter(prefix="/test")


@router.get("/hello")
def hello():
    return {"ok": True}


print("ROUTER ROUTES:", len(router.routes))
print(
    "ROUTER:",
    [(type(r).__name__, r.path, getattr(r, "methods", None)) for r in router.routes]
)

app.include_router(router)

print("APP ROUTES:", len(app.routes))
print(
    "APP:",
    [
        (type(r).__name__, getattr(r, "path", None), getattr(r, "methods", None))
        for r in app.routes
    ]
)
