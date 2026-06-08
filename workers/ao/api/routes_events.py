"""SSE event stream — UI live updates.

The pipeline / scheduler publish events via notify.dispatcher.dispatch; this
endpoint maintains one queue per connected client and yields events as they
arrive. Heartbeats every 25s keep the connection alive across proxies.
"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ao.notify import dispatcher

router = APIRouter(tags=["events"])


async def _event_stream():
    queue = await dispatcher.subscribe()
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=25.0)
                # msg is a JSON string {"type": "...", "ticker": "...", ...}.
                data = json.loads(msg)
                yield f"event: {data['type']}\ndata: {msg}\n\n"
            except asyncio.TimeoutError:
                # Heartbeat — keeps the connection from idling out.
                yield f"event: heartbeat\ndata: {json.dumps({'ts': 'ok'})}\n\n"
    finally:
        dispatcher.unsubscribe(queue)


@router.get("/events")
async def events():
    return StreamingResponse(_event_stream(), media_type="text/event-stream")
