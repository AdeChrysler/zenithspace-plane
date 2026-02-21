/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { AlertCircle } from "lucide-react";
import { cn } from "@plane/utils";

export type TWorkflowDisabledOverlayProps = {
  messageContainerRef: React.RefObject<HTMLDivElement>;
  workflowDisabledSource: string;
  shouldOverlayBeVisible: boolean;
};

export const WorkFlowDisabledOverlay = observer(function WorkFlowDisabledOverlay(props: TWorkflowDisabledOverlayProps) {
  const { workflowDisabledSource, shouldOverlayBeVisible } = props;
  if (!shouldOverlayBeVisible || !workflowDisabledSource) return <></>;

  return (
    <div className={cn("absolute inset-0 z-10 flex flex-col items-center justify-center rounded-sm bg-danger-subtle/50 backdrop-blur-[1px] transition-opacity duration-200")}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-danger-primary">
        <AlertCircle className="size-3.5" />
        <span>Workflow restriction: Cannot move here</span>
      </div>
    </div>
  );
});
