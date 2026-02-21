/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { GitBranch } from "lucide-react";
import type { TIssueGroupByOptions } from "@plane/types";

type Props = {
  groupBy?: TIssueGroupByOptions;
  groupId: string | undefined;
};

export const WorkFlowGroupTree = observer(function WorkFlowGroupTree(props: Props) {
  const { groupBy, groupId } = props;
  if (groupBy !== "state" || !groupId) return <></>;
  return (
    <div className="flex items-center gap-1 ml-1" title="Workflow transitions available">
      <GitBranch className="size-3 text-secondary" />
    </div>
  );
});
