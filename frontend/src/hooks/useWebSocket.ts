// ---------------------------------------------------------------------------
// useWebSocket — connects to the backend WebSocket endpoint, auto-reconnects
// with exponential backoff, and exposes the last received event.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A parsed event received over the WebSocket. */
export interface WsEvent {
  /** Server-assigned event type, e.g. "message.created", "presence.update". */
  type: string;
  /** Arbitrary JSON payload accompanying the event. */
  payload: unknown;
}

export interface UseWebSocketReturn {
  /** The most recently received event (null until the first event arrives). */
  lastEvent: WsEvent | null;
  /** Whether the socket is currently in the OPEN state. */
  isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWebSocket(token: string | null): UseWebSocketReturn {
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs survive re-renders and are used to track mutable connection state
  // without causing re-renders themselves.
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  // Stable function to schedule a reconnect attempt.
  const scheduleReconnect = useCallback((connect: () => void) => {
    if (unmountedRef.current) return;

    const delay = backoffRef.current;
    backoffRef.current = Math.min(delay * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!unmountedRef.current) {
        connect();
      }
    }, delay);
  }, []);

  useEffect(() => {
    unmountedRef.current = false;

    // If there is no token we cannot authenticate — stay disconnected.
    if (!token) {
      setIsConnected(false);
      return;
    }

    function connect() {
      // Determine the WS URL from the current page location so it works
      // behind reverse-proxies and in production without hard-coded hosts.
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const url = `${protocol}//${host}/api/ws?token=${encodeURIComponent(token!)}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        if (unmountedRef.current) {
          ws.close();
          return;
        }
        backoffRef.current = INITIAL_BACKOFF_MS;
        setIsConnected(true);
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        if (unmountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data as string) as WsEvent;
          setLastEvent(parsed);
        } catch {
          // Ignore non-JSON frames.
        }
      });

      ws.addEventListener("close", () => {
        if (unmountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;
        scheduleReconnect(connect);
      });

      ws.addEventListener("error", () => {
        // The browser will fire `close` after `error`, so reconnection is
        // handled in the `close` handler above. We just make sure to update
        // state here.
        if (unmountedRef.current) return;
        setIsConnected(false);
      });
    }

    connect();

    // Cleanup on unmount or when token changes.
    return () => {
      unmountedRef.current = true;

      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setIsConnected(false);
    };
  }, [token, scheduleReconnect]);

  return { lastEvent, isConnected };
}
