/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo, useState } from "react";
import uniq from "lodash-es/uniq";
import { observer } from "mobx-react";
// plane package imports
import type { TActivityFilters } from "@plane/constants";
import { E_SORT_ORDER, defaultActivityFilters, EUserPermissions } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
// i18n
import { useTranslation } from "@plane/i18n";
//types
import type { TFileSignedURLResponse, TIssueComment } from "@plane/types";
// components
import { CommentCreate } from "@/components/comments/comment-create";
import type { TAgentSessionInfo } from "@/components/comments/comment-create";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useAgentMention } from "@/hooks/use-agent-mention";
// services
import { AgentService } from "@/services/agent.service";
// plane web components
import { ActivityFilterRoot } from "@/plane-web/components/issues/worklog/activity/filter-root";
import { IssueActivityWorklogCreateButton } from "@/plane-web/components/issues/worklog/activity/worklog-create-button";
import { AgentStreamingResponse } from "./agent-response";
import { IssueActivityCommentRoot } from "./activity-comment-root";
import { useWorkItemCommentOperations } from "./helper";
import { ActivitySortRoot } from "./sort-root";

const agentService = new AgentService();

type TIssueActivity = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
  isIntakeIssue?: boolean;
};

export type TActivityOperations = {
  createComment: (data: Partial<TIssueComment>) => Promise<TIssueComment>;
  updateComment: (commentId: string, data: Partial<TIssueComment>) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
  uploadCommentAsset: (blockId: string, file: File, commentId?: string) => Promise<TFileSignedURLResponse>;
};

// Active session type for multi-agent streaming
type TActiveSession = {
  sessionId: string;
  providerSlug: string;
  providerName: string;
};

export const IssueActivity = observer(function IssueActivity(props: TIssueActivity) {
  const { workspaceSlug, projectId, issueId, disabled = false, isIntakeIssue = false } = props;
  // i18n
  const { t } = useTranslation();
  // hooks
  const { setValue: setFilterValue, storedValue: selectedFilters } = useLocalStorage(
    "issue_activity_filters",
    defaultActivityFilters
  );
  const { setValue: setSortOrder, storedValue: sortOrder } = useLocalStorage("activity_sort_order", E_SORT_ORDER.ASC);
  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const { getProjectById } = useProject();
  const { data: currentUser } = useUser();
  // derived values
  const issue = issueId ? getIssueById(issueId) : undefined;
  const currentUserProjectRole = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);
  const isAdmin = currentUserProjectRole === EUserPermissions.ADMIN;
  const isGuest = currentUserProjectRole === EUserPermissions.GUEST;
  const isAssigned = issue?.assignee_ids && currentUser?.id ? issue?.assignee_ids.includes(currentUser?.id) : false;
  const isWorklogButtonEnabled = !isIntakeIssue && !isGuest && (isAdmin || isAssigned);

  // --- Multi-agent active sessions ---
  const [activeSessions, setActiveSessions] = useState<TActiveSession[]>([]);

  // toggle filter
  const toggleFilter = (filter: TActivityFilters) => {
    if (!selectedFilters) return;
    let _filters = [];
    if (selectedFilters.includes(filter)) {
      if (selectedFilters.length === 1) return selectedFilters; // Ensure at least one filter is applied
      _filters = selectedFilters.filter((f) => f !== filter);
    } else {
      _filters = [...selectedFilters, filter];
    }

    setFilterValue(uniq(_filters));
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === E_SORT_ORDER.ASC ? E_SORT_ORDER.DESC : E_SORT_ORDER.ASC);
  };

  // helper hooks
  const activityOperations = useWorkItemCommentOperations(workspaceSlug, projectId, issueId);
  const {
    activeInvocations,
    showAgentResponse,
    agentCallingCommentId,
    setAgentSessionState,
    setSessionForInvocation,
    checkForAgentMention,
    dismissAgentResponse,
  } = useAgentMention();

  // Derive provider display name from the first active invocation
  const activeProviderSlug = activeInvocations.length > 0 ? activeInvocations[0].key : undefined;
  const activeProviderName = activeProviderSlug
    ? activeProviderSlug
        .split("-")
        .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : undefined;

  // --- Invoke agents for mention-based invocations ---
  // When a mention is detected, we invoke the agent backend to create sessions,
  // then stream those sessions.
  const invokeAgentsForMentions = useCallback(async () => {
    if (activeInvocations.length === 0) return;

    for (const invocation of activeInvocations) {
      try {
        const session = await agentService.invokeAgent(invocation.context.workspace_slug, {
          provider_slug: invocation.provider_slug,
          variant_slug: invocation.variant_slug,
          project_id: invocation.context.project_id,
          issue_id: invocation.context.issue_id,
          comment_text: invocation.context.comment_text,
        });

        // Track the session
        setSessionForInvocation(invocation.key, session.id);

        // Add to active sessions for streaming
        setActiveSessions((prev) => [
          ...prev,
          {
            sessionId: session.id,
            providerSlug: invocation.key,
            providerName: invocation.key
              .split("-")
              .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" "),
          },
        ]);
      } catch (err) {
        console.error(`Failed to invoke agent for ${invocation.key}:`, err);
      }
    }

    // After invoking all agents, dismiss the mention-based UI (sessions handle streaming now)
    dismissAgentResponse();
  }, [activeInvocations, setSessionForInvocation, dismissAgentResponse]);

  // Auto-invoke agents when mention is detected
  useMemo(() => {
    if (showAgentResponse && activeInvocations.length > 0) {
      void invokeAgentsForMentions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAgentResponse]);

  // Handle agent session response complete (from both mentions and agent mode bar)
  const handleSessionResponseComplete = useCallback(
    async (sessionId: string, providerSlug: string, responseText: string) => {
      if (responseText.trim()) {
        try {
          const agentCommentHtml = `<div data-agent-provider="${providerSlug}">${responseText.replace(/\n/g, "<br/>")}</div>`;
          await activityOperations.createComment({
            comment_html: agentCommentHtml,
          });
          await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
          console.error("Failed to persist agent session response as comment:", err);
        }
      }

      // Remove this session from active sessions
      setActiveSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    },
    [activityOperations]
  );

  // Callback from CommentCreate when agents are invoked via the agent mode bar
  const handleAgentSessionsCreated = useCallback(
    (sessions: TAgentSessionInfo[]) => {
      const newSessions: TActiveSession[] = sessions.map((s) => ({
        sessionId: s.sessionId,
        providerSlug: s.providerSlug,
        providerName: s.providerName,
      }));
      setActiveSessions((prev) => [...prev, ...newSessions]);
    },
    []
  );

  // Wrap createComment to detect agent mentions after posting
  const wrappedActivityOperations = useMemo(
    () => ({
      ...activityOperations,
      createComment: async (data: Partial<TIssueComment>) => {
        const comment = await activityOperations.createComment(data);
        // After comment is posted, check if it mentions the agent
        if (data.comment_html && issue) {
          checkForAgentMention(
            data.comment_html,
            {
              workspace_slug: workspaceSlug,
              project_id: projectId,
              issue_id: issueId,
              issue_title: issue.name,
              issue_description: issue.description_html?.toString(),
              issue_state: issue.state_id,
              issue_priority: issue.priority,
            },
            comment?.id
          );
        }
        return comment;
      },
    }),
    [activityOperations, checkForAgentMention, workspaceSlug, projectId, issueId, issue]
  );

  const project = getProjectById(projectId);
  const renderCommentCreationBox = useMemo(
    () => (
      <CommentCreate
        workspaceSlug={workspaceSlug}
        entityId={issueId}
        activityOperations={wrappedActivityOperations}
        showToolbarInitially
        projectId={projectId}
        onAgentSessionsCreated={handleAgentSessionsCreated}
      />
    ),
    [workspaceSlug, issueId, wrappedActivityOperations, projectId, handleAgentSessionsCreated]
  );
  if (!project) return <></>;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="text-h5-medium text-primary">{t("common.activity")}</div>
        <div className="flex items-center gap-2">
          {isWorklogButtonEnabled && (
            <IssueActivityWorklogCreateButton
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              disabled={disabled}
            />
          )}
          <ActivitySortRoot sortOrder={sortOrder || E_SORT_ORDER.ASC} toggleSort={toggleSortOrder} />
          <ActivityFilterRoot
            selectedFilters={selectedFilters || defaultActivityFilters}
            toggleFilter={toggleFilter}
            isIntakeIssue={isIntakeIssue}
            projectId={projectId}
          />
        </div>
      </div>

      {/* rendering activity */}
      <div className="space-y-3">
        <div className="min-h-[200px]">
          <div className="space-y-3">
            {!disabled && sortOrder === E_SORT_ORDER.DESC && renderCommentCreationBox}
            <IssueActivityCommentRoot
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              isIntakeIssue={isIntakeIssue}
              issueId={issueId}
              selectedFilters={selectedFilters || defaultActivityFilters}
              activityOperations={wrappedActivityOperations}
              showAccessSpecifier={!!project.anchor}
              disabled={disabled}
              sortOrder={sortOrder || E_SORT_ORDER.ASC}
              agentCallingCommentId={agentCallingCommentId}
              agentCallingProviderName={activeProviderName}
            />
            {/* Multi-agent: concurrent streaming responses */}
            {activeSessions.map((session) => (
              <AgentStreamingResponse
                key={session.sessionId}
                sessionId={session.sessionId}
                workspaceSlug={workspaceSlug}
                providerName={session.providerName}
                providerSlug={session.providerSlug}
                onResponseComplete={(resp) =>
                  void handleSessionResponseComplete(session.sessionId, session.providerSlug, resp)
                }
              />
            ))}
            {!disabled && sortOrder === E_SORT_ORDER.ASC && renderCommentCreationBox}
          </div>
        </div>
      </div>
    </div>
  );
});
