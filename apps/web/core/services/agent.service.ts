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

export class AgentService extends APIService {
  constructor() {
    super(API_BASE_URL as string);
  }

  /**
   * Fetch all agent providers for a workspace (including disabled ones for admin settings).
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
   * Create a new agent skill for a workspace.
   */
  async createSkill(workspaceSlug: string, data: Partial<TAgentSkill>): Promise<TAgentSkill> {
    return this.post(`/api/agent/workspaces/${workspaceSlug}/skills/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Update an existing agent skill.
   */
  async updateSkill(workspaceSlug: string, skillId: string, data: Partial<TAgentSkill>): Promise<TAgentSkill> {
    return this.put(`/api/agent/workspaces/${workspaceSlug}/skills/${skillId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  /**
   * Delete an agent skill.
   */
  async deleteSkill(workspaceSlug: string, skillId: string): Promise<void> {
    return this.delete(`/api/agent/workspaces/${workspaceSlug}/skills/${skillId}/`)
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
