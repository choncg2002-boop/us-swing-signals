"""WebSocket connection manager and in-memory pub/sub."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket clients per channel."""

    def __init__(self) -> None:
        self._channels: dict[str, set[WebSocket]] = {}
        self._subscriptions: dict[WebSocket, set[str]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, channel: str) -> None:
        await websocket.accept()
        async with self._lock:
            self._channels.setdefault(channel, set()).add(websocket)
            self._subscriptions.setdefault(websocket, set()).add(channel)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            for channel in list(self._subscriptions.get(websocket, set())):
                if channel in self._channels:
                    self._channels[channel].discard(websocket)
                    if not self._channels[channel]:
                        del self._channels[channel]
            self._subscriptions.pop(websocket, None)

    async def subscribe_tickers(self, websocket: WebSocket, tickers: list[str]) -> None:
        async with self._lock:
            subs = self._subscriptions.setdefault(websocket, set())
            for ticker in tickers:
                channel = f"price:{ticker.upper()}"
                subs.add(channel)
                self._channels.setdefault(channel, set()).add(websocket)

    async def get_subscribed_tickers(self) -> set[str]:
        async with self._lock:
            tickers: set[str] = set()
            for channel in self._channels:
                if channel.startswith("price:"):
                    tickers.add(channel.split(":", 1)[1])
            return tickers

    async def broadcast(self, channel: str, message: dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self._channels.get(channel, set()))

        if not clients:
            return

        payload = json.dumps(message, default=str)
        dead: list[WebSocket] = []

        for ws in clients:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        for ws in dead:
            await self.disconnect(ws)


price_manager = ConnectionManager()
signal_manager = ConnectionManager()
