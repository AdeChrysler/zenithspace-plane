/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Request } from "express";
import type WebSocket from "ws";
// plane imports
// eslint-disable-next-line import/no-unresolved
import { Controller, WebSocket as WSDecorator } from "@plane/decorators";
// eslint-disable-next-line import/no-unresolved
import { logger } from "@plane/logger";
// redis
import { redisManager } from "@/redis";

const REALTIME_CHANNEL = "plane:realtime";

// Track connected clients by workspace
const workspaceClients = new Map<string, Set<WebSocket>>();

// Redis subscriber instance (created once on first connection)
let subscriberInitialized = false;

function initializeSubscriber(): void {
  if (subscriberInitialized) return;
  subscriberInitialized = true;

  const client = redisManager.getClient();
  if (!client) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.error("REALTIME_CONTROLLER: Redis client not available, cannot subscribe to realtime channel");
    subscriberInitialized = false;
    return;
  }

  // Create a duplicate connection for pub/sub (required by ioredis:
  // a client in subscriber mode cannot be used for other commands)
  const subscriber = client.duplicate();

  void subscriber.subscribe(REALTIME_CHANNEL, (err) => {
    if (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      logger.error("REALTIME_CONTROLLER: Failed to subscribe to realtime channel:", err);
      subscriberInitialized = false;
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.info("REALTIME_CONTROLLER: Subscribed to plane:realtime channel");
  });

  subscriber.on("message", (channel: string, message: string) => {
    if (channel !== REALTIME_CHANNEL) return;

    try {
      const event = JSON.parse(message) as { workspace_slug?: string };
      const { workspace_slug } = event;

      if (!workspace_slug) return;

      // Broadcast to all clients connected to this workspace
      const clients = workspaceClients.get(workspace_slug);
      if (!clients) return;

      const payload = JSON.stringify(event);

      for (const ws of clients) {
        if (ws.readyState === 1) {
          // WebSocket.OPEN
          ws.send(payload);
        }
      }
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      logger.error("REALTIME_CONTROLLER: Failed to process realtime message:", e);
    }
  });

  subscriber.on("error", (err: Error) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.error("REALTIME_CONTROLLER: Redis subscriber error:", err);
  });
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
@Controller("/updates")
export class RealtimeController {
  [key: string]: unknown;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @WSDecorator("/")
  handleConnection(ws: WebSocket, req: Request) {
    // Ensure the Redis subscriber is initialized on first connection
    initializeSubscriber();

    const workspaceSlug = req.query.workspace_slug as string;

    if (!workspaceSlug) {
      ws.close(4000, "workspace_slug required");
      return;
    }

    // Add to workspace clients
    if (!workspaceClients.has(workspaceSlug)) {
      workspaceClients.set(workspaceSlug, new Set());
    }
    workspaceClients.get(workspaceSlug)!.add(ws);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    logger.info(`REALTIME_CONTROLLER: Client connected: workspace=${workspaceSlug}`);

    // Send connection confirmation
    ws.send(JSON.stringify({ event: "connected", workspace_slug: workspaceSlug }));

    // Handle client messages (e.g., ping/pong for keepalive)
    ws.on("message", (data: WebSocket.Data) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const msg = JSON.parse(String(data)) as { type?: string };
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // ignore invalid messages
      }
    });

    ws.on("close", () => {
      const clients = workspaceClients.get(workspaceSlug);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          workspaceClients.delete(workspaceSlug);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      logger.info(`REALTIME_CONTROLLER: Client disconnected: workspace=${workspaceSlug}`);
    });

    ws.on("error", (err: Error) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      logger.error(`REALTIME_CONTROLLER: WebSocket error: workspace=${workspaceSlug}`, err);
    });
  }
}
