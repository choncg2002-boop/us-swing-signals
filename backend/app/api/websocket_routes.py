"""WebSocket endpoints for real-time prices and scan notifications."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import price_manager, signal_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/prices")
async def ws_prices(websocket: WebSocket) -> None:
    await price_manager.connect(websocket, "prices")

    try:
        await websocket.send_json({"type": "connected", "channel": "prices"})

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            action = msg.get("action")
            if action == "subscribe":
                tickers = [str(t).upper() for t in msg.get("tickers", [])]
                if tickers:
                    await price_manager.subscribe_tickers(websocket, tickers)
                    await websocket.send_json({"type": "subscribed", "tickers": tickers})
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({"type": "error", "message": f"Unknown action: {action}"})

    except WebSocketDisconnect:
        pass
    finally:
        await price_manager.disconnect(websocket)


@router.websocket("/ws/signals")
async def ws_signals(websocket: WebSocket) -> None:
    await signal_manager.connect(websocket, "signals")

    try:
        await websocket.send_json({"type": "connected", "channel": "signals"})

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            if msg.get("action") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        await signal_manager.disconnect(websocket)
