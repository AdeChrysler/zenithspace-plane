/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AlertCircle } from "lucide-react";
import { cn } from "@plane/utils";

type Props = {
  parentStateId: string;
  className?: string;
};

export function WorkFlowDisabledMessage(props: Props) {
  const { className } = props;
  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-secondary", className)}>
      <AlertCircle className="size-3 shrink-0" />
      <span>Workflow transition not configured for this state.</span>
    </div>
  );
}
