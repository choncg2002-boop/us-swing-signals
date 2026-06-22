import { useEffect, useRef, useState } from "react";
import { signalWsUrl, type WsStatus } from "../api/websocket";
import type { ScanSummary } from "../types/signals";
import { isNetlifyOnlyMode } from "../utils/host";

const RECONNECT_MS = 4000;

export function useSignalStream(onScanComplete?: (summary: ScanSummary) => void) {
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [lastScan, setLastScan] = useState<ScanSummary | null>(null);
  const callbackRef = useRef(onScanComplete);
  callbackRef.current = onScanComplete;

  useEffect(() => {
    if (isNetlifyOnlyMode()) {
      setStatus("disconnected");
      return;
    }

    let alive = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (!alive) return;
      setStatus("connecting");
      ws = new WebSocket(signalWsUrl());

      ws.onopen = () => {
        if (!alive) {
          ws?.close();
          return;
        }
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "scan_complete" && msg.data) {
            const summary = msg.data as ScanSummary;
            setLastScan(summary);
            callbackRef.current?.(summary);
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        if (alive) setStatus("error");
      };

      ws.onclose = () => {
        if (!alive) return;
        setStatus("disconnected");
        retryTimer = setTimeout(connect, RECONNECT_MS);
      };

      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: "ping" }));
        }
      }, 30000);
    };

    connect();

    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      ws?.close();
    };
  }, []);

  return { status, lastScan };
}
