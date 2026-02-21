/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { Layers } from "lucide-react";
import { PriorityIcon, StateGroupIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TDeDupeIssue } from "@plane/types";
import type { TIssueOperations } from "@/components/issues/issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { DeDupeIssueButtonLabel } from "@/plane-web/components/de-dupe/issue-block/button-label";
import { cn } from "@plane/utils";

type TDeDupeIssuePopoverRootProps = {
  workspaceSlug: string;
  projectId: string;
  rootIssueId: string;
  issues: TDeDupeIssue[];
  issueOperations: TIssueOperations;
  disabled?: boolean;
  renderDeDupeActionModals?: boolean;
  isIntakeIssue?: boolean;
};

export const DeDupeIssuePopoverRoot = observer(function DeDupeIssuePopoverRoot(props: TDeDupeIssuePopoverRootProps) {
  const { workspaceSlug, issues, disabled = false } = props;
  const { getProjectById } = useProject();
  const { getStateById } = useProjectState();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleIssues = issues.filter((issue) => !dismissedIds.has(issue.id));

  if (visibleIssues.length === 0) return <></>;

  const buttonLabel = visibleIssues.length === 1 ? "1 potential duplicate" : `${visibleIssues.length} potential duplicates`;

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors outline-none",
          "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
          isOpen && "bg-amber-500/20"
        )}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
      >
        <DeDupeIssueButtonLabel isOpen={isOpen} buttonLabel={buttonLabel} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border-[0.5px] border-subtle bg-surface-1 shadow-xl">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-secondary">Potential duplicates</h4>
            </div>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto vertical-scrollbar scrollbar-sm">
              {visibleIssues.map((issue) => {
                const proj = getProjectById(issue.project_id);
                const state = issue.state_id ? getStateById(issue.state_id) : undefined;
                const identifier = proj ? `${proj.identifier}-${issue.sequence_id}` : `${issue.sequence_id}`;

                return (
                  <div key={issue.id} className="flex flex-col gap-2 p-2.5 rounded-md bg-layer-1 border-[0.5px] border-subtle">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 pt-0.5">
                        {state && <StateGroupIcon stateGroup={state.group} color={state.color} height="14px" width="14px" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-tertiary flex-shrink-0">{identifier}</span>
                          <PriorityIcon priority={issue.priority} size={12} withContainer />
                        </div>
                        <p className="text-sm text-primary truncate mt-0.5">{issue.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-5">
                      <button
                        type="button"
                        onClick={() => setDismissedIds((prev) => new Set([...prev, issue.id]))}
                        className="text-xs font-medium text-tertiary hover:text-secondary hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
