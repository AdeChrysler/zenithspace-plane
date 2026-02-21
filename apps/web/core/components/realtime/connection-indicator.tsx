/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
// eslint-disable-next-line import/no-unresolved
import { Tooltip } from "@plane/propel/tooltip";
// eslint-disable-next-line import/no-unresolved
import { cn } from "@plane/utils";

type TConnectionStatus = "connected" | "connecting" | "disconnected";

type TWsStatusDetail = {
  type: string;
};

export const RealtimeConnectionIndicator = () => {
  const { workspaceSlug } = useParams();
  const [status, setStatus] = useState<TConnectionStatus>(workspaceSlug ? "connecting" : "disconnected");

  useEffect(() => {
    if (!workspaceSlug) {
      return;
    }

    const statusHandler = (e: Event) => {
      const detail = (e as CustomEvent<TWsStatusDetail>).detail;
      if (detail?.type === "ws_connected") setStatus("connected");
      else if (detail?.type === "ws_disconnected") setStatus("connecting");
      else if (detail?.type === "ws_failed") setStatus("disconnected");
    };

    // If we get any realtime event, we know the connection is active
    const realtimeHandler = () => setStatus("connected");

    window.addEventListener("plane:ws_status", statusHandler);
    window.addEventListener("plane:realtime", realtimeHandler);

    return () => {
      window.removeEventListener("plane:ws_status", statusHandler);
      window.removeEventListener("plane:realtime", realtimeHandler);
    };
  }, [workspaceSlug]);

  const statusConfig = {
    connected: { color: "bg-green-500", label: "Real-time connected" },
    connecting: { color: "bg-amber-500 animate-pulse", label: "Connecting..." },
    disconnected: { color: "bg-red-500", label: "Disconnected" },
  };

  const config = statusConfig[status];

  return (
    <Tooltip tooltipContent={config.label} position="bottom">
      <div className="flex items-center gap-1.5 px-2 py-1">
        {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */}
        <span className={cn("inline-block size-2 rounded-full", config.color)} />
        <span className="text-xs text-custom-text-300 hidden sm:inline">
          {status === "connected" ? "Live" : status === "connecting" ? "Syncing" : "Offline"}
        </span>
      </div>
    </Tooltip>
  );
};
