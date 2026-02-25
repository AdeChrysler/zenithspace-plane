/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useCallback } from "react";
import type { TAgentRequest } from "@/services/agent.service";

export type TAgentSessionState = "calling" | "working" | "responding" | "completed";

/**
 * Represents a single agent invocation parsed from a comment mention.
 */
export type TAgentInvocation = {
  /** The provider slug extracted from the entity_identifier (e.g., "claude-code") */
  provider_slug: string;
  /** The variant slug extracted from the entity_identifier (e.g., "sonnet") */
  variant_slug: string;
  /** A unique key for this invocation: "provider_slug-variant_slug" */
  key: string;
  /** The legacy-compatible request object for streaming */
  request: TAgentRequest;
};

/**
 * Parse agent mentions from comment HTML.
 * Detects entity_name="agent_mention" with entity_identifier="<provider>-<variant>".
 * Also supports legacy "zenith-agent" mentions for backward compatibility.
 */
function parseAgentMentions(commentHtml: string): Array<{ provider_slug: string; variant_slug: string }> {
  const mentions: Array<{ provider_slug: string; variant_slug: string }> = [];
  const seen = new Set<string>();

  // Match new-style agent_mention entities: entity_name="agent_mention" ... entity_identifier="<slug>"
  // The attributes may appear in any order within the tag
  const agentMentionPattern = /entity_name="agent_mention"[^>]*entity_identifier="([^"]+)"/g;
  const reversePattern = /entity_identifier="([^"]+)"[^>]*entity_name="agent_mention"/g;

  for (const pattern of [agentMentionPattern, reversePattern]) {
    let match;
    while ((match = pattern.exec(commentHtml)) !== null) {
      const identifier = match[1];
      if (identifier && !seen.has(identifier)) {
        seen.add(identifier);
        // Split on the last hyphen to handle provider slugs with hyphens (e.g., "claude-code-sonnet")
        const lastDash = identifier.lastIndexOf("-");
        if (lastDash > 0) {
          mentions.push({
            provider_slug: identifier.substring(0, lastDash),
            variant_slug: identifier.substring(lastDash + 1),
          });
        }
      }
    }
  }

  // Legacy fallback: detect old-style "zenith-agent" mentions
  if (mentions.length === 0) {
    const hasLegacyMention =
      commentHtml.includes('entity_identifier="zenith-agent"') ||
      commentHtml.includes("zenith-agent") ||
      commentHtml.includes("@ZenithAgent") ||
      commentHtml.toLowerCase().includes("@agent");

    if (hasLegacyMention) {
      mentions.push({
        provider_slug: "claude-code",
        variant_slug: "sonnet",
      });
    }
  }

  return mentions;
}

/**
 * Detects if a comment mentions one or more AI agents and provides state for
 * multi-provider streaming responses.
 *
 * Supports MULTIPLE agent mentions in one comment (e.g., both @claude-opus and @gemini-flash).
 * Returns an array of invocations and tracks active sessions per invocation.
 */
export const useAgentMention = () => {
  // Primary invocations (all agents mentioned in the comment)
  const [activeInvocations, setActiveInvocations] = useState<TAgentInvocation[]>([]);
  // Map of invocation key -> session ID for tracking concurrent sessions
  const [activeSessions, setActiveSessions] = useState<Map<string, string>>(new Map());
  // UI state
  const [showAgentResponse, setShowAgentResponse] = useState(false);
  const [agentCallingCommentId, setAgentCallingCommentId] = useState<string | null>(null);
  const [agentSessionState, setAgentSessionState] = useState<TAgentSessionState>("calling");

  // Legacy single-request field for backward compatibility with AgentStreamingResponse
  const [agentRequest, setAgentRequest] = useState<TAgentRequest | null>(null);

  const checkForAgentMention = useCallback(
    (
      commentHtml: string,
      context: {
        workspace_slug: string;
        project_id: string;
        issue_id: string;
        issue_title: string;
        issue_description?: string;
        issue_state?: string;
        issue_priority?: string;
      },
      commentId?: string
    ): boolean => {
      const mentions = parseAgentMentions(commentHtml);

      if (mentions.length === 0) {
        return false;
      }

      // Strip HTML to get plain text for the comment content
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = commentHtml;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";

      // Build invocations for each detected agent mention
      const invocations: TAgentInvocation[] = mentions.map((mention) => ({
        provider_slug: mention.provider_slug,
        variant_slug: mention.variant_slug,
        key: `${mention.provider_slug}-${mention.variant_slug}`,
        request: {
          workspace_slug: context.workspace_slug,
          project_id: context.project_id,
          issue_id: context.issue_id,
          comment_text: plainText,
          issue_context: {
            title: context.issue_title,
            description: context.issue_description,
            state: context.issue_state,
            priority: context.issue_priority,
          },
        },
      }));

      setActiveInvocations(invocations);
      setActiveSessions(new Map());
      setShowAgentResponse(true);
      setAgentCallingCommentId(commentId ?? null);
      setAgentSessionState("calling");

      // Legacy compat: set the first invocation as agentRequest
      if (invocations.length > 0) {
        setAgentRequest(invocations[0].request);
      }

      return true;
    },
    []
  );

  const setSessionForInvocation = useCallback((invocationKey: string, sessionId: string) => {
    setActiveSessions((prev) => {
      const next = new Map(prev);
      next.set(invocationKey, sessionId);
      return next;
    });
  }, []);

  const dismissAgentResponse = useCallback(() => {
    setShowAgentResponse(false);
    setAgentRequest(null);
    setActiveInvocations([]);
    setActiveSessions(new Map());
    setAgentCallingCommentId(null);
    setAgentSessionState("calling");
  }, []);

  return {
    // Multi-provider state
    activeInvocations,
    activeSessions,
    setSessionForInvocation,
    // Legacy single-request compat
    agentRequest,
    // UI state
    showAgentResponse,
    agentCallingCommentId,
    agentSessionState,
    setAgentSessionState,
    // Actions
    checkForAgentMention,
    dismissAgentResponse,
  };
};
