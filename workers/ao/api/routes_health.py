from fastapi import APIRouter

from ao import __version__

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok", "version": __version__}


@router.get("/readyz")
async def readyz() -> dict:
    # In v1 there's nothing to gate readiness on; this becomes a DB-ping later.
    return {"status": "ready"}
