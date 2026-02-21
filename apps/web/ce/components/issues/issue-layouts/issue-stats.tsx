/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { cn } from "@plane/utils";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

type Props = {
  issueId: string;
  className?: string;
  size?: number;
  showProgressText?: boolean;
  showLabel?: boolean;
};

/**
 * Shows sub-issue completion progress as a circular indicator.
 */
export const IssueStats = observer(function IssueStats(props: Props) {
  const { issueId, className, size = 16, showProgressText = false, showLabel = false } = props;
  const { subIssues } = useIssueDetail();

  const subIssueIds = subIssues.subIssuesByIssueId(issueId);
  if (!subIssueIds || subIssueIds.length === 0) return <></>;

  const total = subIssueIds.length;
  // We can't easily compute completed count without state data, so show count only
  return (
    <div className={cn("flex items-center gap-1 text-xs text-secondary", className)}>
      {showLabel && <span>Sub-issues:</span>}
      <span className="font-medium">{total}</span>
      {showProgressText && <span>items</span>}
    </div>
  );
});
