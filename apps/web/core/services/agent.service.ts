/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

const ORCHESTRATOR_URL = "https://orchestrator.zenova.id";

export type TAgentRequest = {
  workspace_slug: string;
  project_id: string;
  issue_id: string;
  comment_text: string;
  issue_context?: {
    title: string;
    description?: string;
    state?: string;
    priority?: string;
    assignees?: string[];
    labels?: string[];
  };
};

export type TAgentStreamChunk = {
  type: "text" | "thinking" | "plan" | "done" | "error";
  content: string;
};

export class AgentService extends APIService {
  constructor() {
    super(API_BASE_URL as string);
  }

  /**
   * Send a message to the AI agent and get a streaming response.
   * Uses fetch with ReadableStream for server-sent events.
   */
  async streamAgentResponse(
    request: TAgentRequest,
    onChunk: (chunk: TAgentStreamChunk) => void,
    onComplete: () => void,
    onError: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/agent/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal,
      });

      if (!response.ok) {
        onError(`Agent request failed: ${response.statusText}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response stream available");
        return;
      }

      const decoder = new TextDecoder();
      let lineBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        // Keep the last (possibly incomplete) line in the buffer
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith("data: ")) {
            try {
              const chunk = JSON.parse(trimmed.slice(6)) as TAgentStreamChunk;
              onChunk(chunk);
              if (chunk.type === "done") {
                onComplete();
                return;
              }
            } catch {
              // If not JSON, treat as plain text
              onChunk({ type: "text", content: trimmed.slice(6) });
            }
          }
        }
      }

      // Process any remaining data in the buffer
      if (lineBuffer.trim().startsWith("data: ")) {
        try {
          const chunk = JSON.parse(lineBuffer.trim().slice(6)) as TAgentStreamChunk;
          onChunk(chunk);
        } catch {
          onChunk({ type: "text", content: lineBuffer.trim().slice(6) });
        }
      }

      onComplete();
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const errorMessage = e instanceof Error ? e.message : "Agent request failed";
      onError(errorMessage);
    }
  }

  /**
   * Non-streaming fallback: send message and get full response.
   */
  async sendAgentMessage(request: TAgentRequest): Promise<{ response: string }> {
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/agent/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error(res.statusText);
      return (await res.json()) as { response: string };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Agent request failed";
      throw new Error(errorMessage);
    }
  }
}
