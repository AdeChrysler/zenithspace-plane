/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { X } from "lucide-react";
import { PriorityIcon, StateGroupIcon } from "@plane/propel/icons";
import type { TDeDupeIssue } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";

type TDuplicateModalRootProps = {
  workspaceSlug: string;
  issues: TDeDupeIssue[];
  handleDuplicateIssueModal: (value: boolean) => void;
};

export function DuplicateModalRoot(props: TDuplicateModalRootProps) {
  const { workspaceSlug, issues, handleDuplicateIssueModal } = props;
  const { getProjectById } = useProject();
  const { getStateById } = useProjectState();

  if (!issues || issues.length === 0) return <></>;

  return (
    <>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-secondary">Potential duplicates</h4>
        <button
          type="button"
          onClick={() => handleDuplicateIssueModal(false)}
          className="flex items-center justify-center h-5 w-5 rounded hover:bg-surface-3 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-tertiary" />
        </button>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto vertical-scrollbar scrollbar-sm">
        {issues.map((issue) => {
          const projectDetails = getProjectById(issue.project_id);
          const stateDetails = issue.state_id ? getStateById(issue.state_id) : undefined;
          const identifier = projectDetails
            ? `${projectDetails.identifier}-${issue.sequence_id}`
            : `${issue.sequence_id}`;

          return (
            <div key={issue.id} className="flex items-start gap-2 p-2.5 rounded-md bg-surface-1 border-[0.5px] border-subtle hover:bg-layer-1 transition-colors">
              <div className="flex-shrink-0 pt-0.5">
                {stateDetails && (
                  <StateGroupIcon stateGroup={stateDetails.group} color={stateDetails.color} height="14px" width="14px" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-tertiary flex-shrink-0">{identifier}</span>
                  <PriorityIcon priority={issue.priority} size={12} withContainer />
                </div>
                <p className="text-sm text-primary truncate mt-0.5">{issue.name}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
