/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import type { E_SORT_ORDER, TActivityFilters, EActivityFilterType } from "@plane/constants";
import { BASE_ACTIVITY_FILTER_TYPES, filterActivityOnSelectedFilters } from "@plane/constants";
import type { TCommentsOperations } from "@plane/types";
import { calculateTimeAgo } from "@plane/utils";
// components
import { CommentCard } from "@/components/comments/card/root";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// plane web components
import { IssueAdditionalPropertiesActivity } from "@/plane-web/components/issues/issue-details/issue-properties-activity";
import { IssueActivityWorklog } from "@/plane-web/components/issues/worklog/activity/root";
// local imports
import { IssueActivityItem } from "./activity/activity-list";
import { AgentCallingBadge, AgentCommentBlock } from "./agent-response";
import { IssueActivityLoader } from "./loader";

type TIssueActivityCommentRoot = {
  workspaceSlug: string;
  projectId: string;
  isIntakeIssue: boolean;
  issueId: string;
  selectedFilters: TActivityFilters[];
  activityOperations: TCommentsOperations;
  showAccessSpecifier?: boolean;
  disabled?: boolean;
  sortOrder: E_SORT_ORDER;
  agentCallingCommentId?: string | null;
  agentCallingProviderName?: string;
};

export const IssueActivityCommentRoot = observer(function IssueActivityCommentRoot(props: TIssueActivityCommentRoot) {
  const {
    workspaceSlug,
    isIntakeIssue,
    issueId,
    selectedFilters,
    activityOperations,
    showAccessSpecifier,
    projectId,
    disabled,
    sortOrder,
    agentCallingCommentId,
    agentCallingProviderName,
  } = props;
  // store hooks
  const {
    activity: { getActivityAndCommentsByIssueId },
    comment: { getCommentById },
  } = useIssueDetail();
  // derived values
  const activityAndComments = getActivityAndCommentsByIssueId(issueId, sortOrder);

  if (!activityAndComments) return <IssueActivityLoader />;

  if (activityAndComments.length <= 0) return null;

  const filteredActivityAndComments = filterActivityOnSelectedFilters(activityAndComments, selectedFilters);

  return (
    <div>
      {filteredActivityAndComments.map((activityComment, index) => {
        const comment = getCommentById(activityComment.id);
        const ends = index === 0 ? "top" : index === filteredActivityAndComments.length - 1 ? "bottom" : undefined;

        // Check if this is a comment
        if (activityComment.activity_type === "COMMENT") {
          // Check if this is an agent comment (persisted) — supports both new and legacy formats
          const commentHtml = comment?.comment_html || "";
          const agentProviderMatch = commentHtml.match(/data-agent-provider="([^"]+)"/);
          const isLegacyAgentComment = commentHtml.includes('data-agent="zenith-agent"');
          const isAgentComment = !!agentProviderMatch || isLegacyAgentComment;

          if (isAgentComment && comment) {
            // Extract the provider-variant slug from the attribute
            const providerVariantSlug = agentProviderMatch?.[1] || "claude-code-sonnet";

            // Derive a display name from the slug (e.g., "claude-code-sonnet" -> "Claude Code Sonnet")
            const providerDisplayName = providerVariantSlug
              .split("-")
              .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" ");

            // Extract plain text from agent comment HTML
            const tempDiv = typeof document !== "undefined" ? document.createElement("div") : null;
            let plainText = commentHtml;
            if (tempDiv) {
              tempDiv.innerHTML = plainText;
              plainText = tempDiv.textContent || tempDiv.innerText || "";
            }

            return (
              <AgentCommentBlock
                key={activityComment.id}
                content={plainText}
                providerName={providerDisplayName}
                providerSlug={providerVariantSlug}
                timestamp={calculateTimeAgo(comment.created_at)}
                ends={ends}
              />
            );
          }

          return (
            <div key={activityComment.id}>
              <CommentCard
                workspaceSlug={workspaceSlug}
                entityId={issueId}
                comment={comment}
                activityOperations={activityOperations}
                ends={ends}
                showAccessSpecifier={!!showAccessSpecifier}
                showCopyLinkOption={!isIntakeIssue}
                disabled={disabled}
                projectId={projectId}
                enableReplies
              />
              {/* Show calling badge after the comment that triggered the agent */}
              {agentCallingCommentId && activityComment.id === agentCallingCommentId && (
                <AgentCallingBadge providerName={agentCallingProviderName} />
              )}
            </div>
          );
        }

        if (BASE_ACTIVITY_FILTER_TYPES.includes(activityComment.activity_type as EActivityFilterType)) {
          return (
            <IssueActivityItem
              key={activityComment.id}
              activityId={activityComment.id}
              ends={ends}
            />
          );
        }

        if (activityComment.activity_type === "ISSUE_ADDITIONAL_PROPERTIES_ACTIVITY") {
          return (
            <IssueAdditionalPropertiesActivity
              key={activityComment.id}
              activityId={activityComment.id}
              ends={ends}
            />
          );
        }

        if (activityComment.activity_type === "WORKLOG") {
          return (
            <IssueActivityWorklog
              key={activityComment.id}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              activityComment={activityComment}
              ends={ends}
            />
          );
        }

        return <span key={activityComment.id} />;
      })}
    </div>
  );
});
