/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useCallback } from "react";
import type { TAgentRequest } from "@/services/agent.service";

const AGENT_MENTION_ID = "zenith-agent";

export type TAgentSessionState = "calling" | "working" | "responding" | "completed";

/**
 * Detects if a comment mentions the AI agent and provides state for the streaming response.
 * Tracks the triggering comment ID and agent session state.
 */
export const useAgentMention = () => {
  const [agentRequest, setAgentRequest] = useState<TAgentRequest | null>(null);
  const [showAgentResponse, setShowAgentResponse] = useState(false);
  const [agentCallingCommentId, setAgentCallingCommentId] = useState<string | null>(null);
  const [agentSessionState, setAgentSessionState] = useState<TAgentSessionState>("calling");

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
    ) => {
      // Check if the comment mentions the AI agent
      const hasAgentMention =
        commentHtml.includes(`entity_identifier="${AGENT_MENTION_ID}"`) ||
        commentHtml.includes("zenith-agent") ||
        commentHtml.includes("@ZenithAgent") ||
        commentHtml.toLowerCase().includes("@agent");

      if (hasAgentMention) {
        // Strip HTML to get plain text
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = commentHtml;
        const plainText = tempDiv.textContent || tempDiv.innerText || "";

        const request: TAgentRequest = {
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
        };

        setAgentRequest(request);
        setShowAgentResponse(true);
        setAgentCallingCommentId(commentId ?? null);
        setAgentSessionState("calling");
        return true;
      }

      return false;
    },
    []
  );

  const dismissAgentResponse = useCallback(() => {
    setShowAgentResponse(false);
    setAgentRequest(null);
    setAgentCallingCommentId(null);
    setAgentSessionState("calling");
  }, []);

  return {
    agentRequest,
    showAgentResponse,
    agentCallingCommentId,
    agentSessionState,
    setAgentSessionState,
    checkForAgentMention,
    dismissAgentResponse,
  };
};
