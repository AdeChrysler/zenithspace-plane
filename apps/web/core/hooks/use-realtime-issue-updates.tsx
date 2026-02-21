/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type TRealtimeIssueEventDetail = {
  issue_id: string;
  type: string;
};

export const useRealtimeIssueUpdates = (
  workspaceSlug: string | undefined,
  projectId: string | undefined,
  issueId: string | undefined
) => {
  const {
    issue: { fetchIssue },
    comment: { fetchComments },
    activity: { fetchActivities },
  } = useIssueDetail();

  useEffect(() => {
    if (!workspaceSlug || !projectId || !issueId) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TRealtimeIssueEventDetail>).detail;
      if (!detail) return;

      const isThisIssue = detail.issue_id === issueId;

      switch (detail.type) {
        case "issue_updated":
          if (isThisIssue) {
            // Re-fetch the issue to get latest data
            void fetchIssue(workspaceSlug, projectId, issueId);
          }
          break;
        case "comment_created":
        case "comment_updated":
        case "comment_deleted":
          if (isThisIssue) {
            void fetchComments(workspaceSlug, projectId, issueId);
          }
          break;
        case "activity_created":
          if (isThisIssue) {
            void fetchActivities(workspaceSlug, projectId, issueId);
          }
          break;
      }
    };

    window.addEventListener("plane:realtime", handler);
    return () => window.removeEventListener("plane:realtime", handler);
  }, [workspaceSlug, projectId, issueId, fetchIssue, fetchComments, fetchActivities]);
};
