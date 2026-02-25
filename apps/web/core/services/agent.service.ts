/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, import/no-unresolved */
import { API_BASE_URL } from "@plane/constants";
// types
import type { TAgentProvider, TAgentSkill, TAgentSession, TAgentInvokeRequest } from "@/store/agent.store";
// services
import { APIService } from "@/services/api.service";

// --- Legacy type aliases (kept for backward compatibility until Tasks 16/18/20 migrate consumers) ---

/** @deprecated Use TAgentInvokeRequest from @/store/agent.store instead. Will be removed in Task 20. */
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

/** @deprecated Use { type: string; content: string } from @/store/agent.store instead. Will be removed in Task 20. */
export type TAgentStreamChunk = {
  type: "text" | "thinking" | "plan" | "done" | "error";
  content: string;
};

export class AgentService extends APIService {
  constructor() {
    super(API_BASE_URL as string);
  }

  /**
   * Fetch available agent providers for a workspace.
   */
  async fetchProviders(workspaceSlug: string): Promise<TAgentProvider[]> {
    return this.get(`/api/agent/workspaces/${workspaceSlug}/providers/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Fetch available agent skills for a workspace, optionally filtered by project.
   */
  async fetchSkills(workspaceSlug: string, projectId?: string): Promise<TAgentSkill[]> {
    const params = projectId ? `?project_id=${projectId}` : "";
    return this.get(`/api/agent/workspaces/${workspaceSlug}/skills/${params}`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Invoke an agent session for a workspace.
   */
  async invokeAgent(workspaceSlug: string, payload: TAgentInvokeRequest): Promise<TAgentSession> {
    return this.post(`/api/agent/workspaces/${workspaceSlug}/invoke/`, payload)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Get session details by ID.
   */
  async getSession(workspaceSlug: string, sessionId: string): Promise<TAgentSession> {
    return this.get(`/api/agent/workspaces/${workspaceSlug}/sessions/${sessionId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Cancel an active agent session.
   */
  async cancelSession(workspaceSlug: string, sessionId: string): Promise<void> {
    return this.post(`/api/agent/workspaces/${workspaceSlug}/sessions/${sessionId}/cancel/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * @deprecated Legacy streaming method kept for backward compatibility.
   * Uses the old orchestrator-style POST interface. Will be removed in Task 20.
   * New code should use the store's streamSession which calls streamSession below.
   */
  async streamAgentResponse(
    request: TAgentRequest,
    onChunk: (chunk: TAgentStreamChunk) => void,
    onComplete: () => void,
    onError: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      // Invoke via the new backend endpoint, then stream the session
      const session = await this.invokeAgent(request.workspace_slug, {
        provider_slug: "claude-code",
        project_id: request.project_id,
        issue_id: request.issue_id,
        comment_text: request.comment_text,
      });

      await this.streamSession(
        request.workspace_slug,
        session.id,
        (chunk) => onChunk(chunk as TAgentStreamChunk),
        onComplete,
        onError,
        signal
      );
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const errorMessage = e instanceof Error ? e.message : "Agent request failed";
      onError(errorMessage);
    }
  }

  /**
   * Stream an agent session via SSE using fetch + ReadableStream.
   * Points to the Django backend SSE endpoint.
   */
  async streamSession(
    workspaceSlug: string,
    sessionId: string,
    onChunk: (chunk: { type: string; content: string }) => void,
    onComplete: () => void,
    onError: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const url = `${this.baseURL}/api/agent/workspaces/${workspaceSlug}/sessions/${sessionId}/stream/`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
        },
        credentials: "include",
        signal,
      });

      if (!response.ok) {
        onError(`Agent stream request failed: ${response.statusText}`);
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
              const chunk = JSON.parse(trimmed.slice(6)) as { type: string; content: string };
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
          const chunk = JSON.parse(lineBuffer.trim().slice(6)) as { type: string; content: string };
          onChunk(chunk);
        } catch {
          onChunk({ type: "text", content: lineBuffer.trim().slice(6) });
        }
      }

      onComplete();
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const errorMessage = e instanceof Error ? e.message : "Agent stream request failed";
      onError(errorMessage);
    }
  }
}
