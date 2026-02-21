/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
// eslint-disable-next-line import/no-unresolved
import { LIVE_BASE_URL, LIVE_BASE_PATH } from "@plane/constants";

type TRealtimeEvent = {
  event: string;
  workspace_slug: string;
  project_id?: string;
  data: Record<string, unknown>;
};

type TRealtimeHandler = (event: TRealtimeEvent) => void;

export const useRealtimeUpdates = (
  workspaceSlug: string | undefined,
  onEvent: TRealtimeHandler
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 10;

  // Keep a stable ref to the connect function so it can safely call itself recursively
  // via setTimeout without being captured in any useCallback/useEffect dependency array.
  const connectRef = useRef<(() => void) | null>(null);

  // Update the connectRef whenever the relevant props change, before any effects run.
  useLayoutEffect(() => {
    connectRef.current = () => {
      if (!workspaceSlug) return;

      const liveBaseUrl = LIVE_BASE_URL as string | undefined;
      const liveBasePath = LIVE_BASE_PATH as string | undefined;
      const baseUrl = liveBaseUrl?.trim() || window.location.origin;
      const wsUrl = new URL(baseUrl);
      wsUrl.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl.pathname = `${liveBasePath ?? ""}/updates`;
      wsUrl.searchParams.set("workspace_slug", workspaceSlug);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Realtime] Connected to workspace:", workspaceSlug);
        reconnectAttempts.current = 0;
        window.dispatchEvent(
          new CustomEvent("plane:ws_status", {
            detail: { type: "ws_connected" },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as TRealtimeEvent & { type?: string };
          if (data.event === "connected" || data.type === "pong") return;
          onEvent(data);
        } catch (_e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Reconnect with exponential backoff
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          window.dispatchEvent(
            new CustomEvent("plane:ws_status", {
              detail: { type: "ws_disconnected" },
            })
          );
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
          }, delay);
        } else {
          window.dispatchEvent(
            new CustomEvent("plane:ws_status", {
              detail: { type: "ws_failed" },
            })
          );
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };
  }, [workspaceSlug, onEvent]);

  useEffect(() => {
    connectRef.current?.();

    // Keepalive ping every 30s
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [workspaceSlug]);
};
