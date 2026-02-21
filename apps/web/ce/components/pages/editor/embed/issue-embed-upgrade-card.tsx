/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { PriorityIcon, StateGroupIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssuePriorities } from "@plane/types";
import { Avatar, AvatarGroup, Loader } from "@plane/ui";
import { getFileURL } from "@plane/utils";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";

type TIssueEmbedCardProps = {
  issueId: string;
  projectId?: string;
  workspaceSlug?: string;
};

export const IssueEmbedCard = observer(function IssueEmbedCard(props: TIssueEmbedCardProps) {
  const { issueId, projectId, workspaceSlug } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const {
    issue: { getIssueById },
    fetchIssue,
  } = useIssueDetail();
  const { getProjectIdentifierById } = useProject();
  const { getStateById } = useProjectState();
  const { getUserDetails } = useMember();

  const issue = getIssueById(issueId);

  useEffect(() => {
    if (!issue && workspaceSlug && projectId && issueId) {
      setIsLoading(true);
      setError(false);
      fetchIssue(workspaceSlug, projectId, issueId)
        .catch(() => setError(true))
        .finally(() => setIsLoading(false));
    }
  }, [issue, workspaceSlug, projectId, issueId, fetchIssue]);

  if (isLoading || (!issue && !error)) {
    return (
      <div className="w-full rounded-md border-[0.5px] border-subtle bg-layer-1 p-3 shadow-raised-100">
        <Loader className="space-y-2">
          <Loader.Item height="14px" width="80px" />
          <Loader.Item height="16px" width="100%" />
          <Loader.Item height="20px" width="120px" />
        </Loader>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="w-full rounded-md border-[0.5px] border-subtle bg-layer-1 px-4 py-3 shadow-raised-100">
        <p className="text-sm text-secondary">
          Unable to load work item. It may have been deleted or you may not have access.
        </p>
      </div>
    );
  }

  const projectIdentifier = getProjectIdentifierById(issue.project_id);
  const stateDetails = issue.state_id ? getStateById(issue.state_id) : undefined;
  const stateGroup = stateDetails?.group ?? "backlog";
  const stateName = stateDetails?.name;
  const assigneeIds = issue.assignee_ids ?? [];

  return (
    <div className="w-full rounded-md border-[0.5px] border-subtle bg-layer-1 p-3 shadow-raised-100 space-y-2 hover:bg-layer-transparent-hover transition-colors cursor-pointer">
      <div className="flex items-center justify-between gap-3 text-secondary">
        <span className="text-xs text-tertiary whitespace-nowrap">
          {projectIdentifier}-{issue.sequence_id}
        </span>
        {stateDetails && (
          <div className="shrink-0 flex items-center gap-1">
            <StateGroupIcon stateGroup={stateGroup} className="shrink-0 size-3" />
            <p className="text-xs font-medium truncate max-w-[120px]">{stateName}</p>
          </div>
        )}
      </div>
      <div>
        <Tooltip tooltipContent={issue.name} position="top-start">
          <h6 className="text-sm text-primary truncate">{issue.name}</h6>
        </Tooltip>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PriorityIcon priority={issue.priority as TIssuePriorities} withContainer />
        </div>
        {assigneeIds.length > 0 && (
          <AvatarGroup size="sm" showTooltip>
            {assigneeIds.map((userId) => {
              const userDetails = getUserDetails(userId);
              if (!userDetails) return null;
              return (
                <Avatar key={userId} src={getFileURL(userDetails.avatar_url)} name={userDetails.display_name} />
              );
            })}
          </AvatarGroup>
        )}
      </div>
    </div>
  );
});

export const IssueEmbedUpgradeCard = IssueEmbedCard;
