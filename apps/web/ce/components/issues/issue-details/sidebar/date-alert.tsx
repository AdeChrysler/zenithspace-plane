/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { AlertTriangle, Clock, Info } from "lucide-react";
import type { TIssue } from "@plane/types";
import { Tooltip } from "@plane/propel/tooltip";

export type TDateAlertProps = {
  date: string;
  workItem: TIssue;
  projectId: string;
};

export function DateAlert(props: TDateAlertProps) {
  const { date, workItem } = props;
  if (!date) return <></>;

  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) return <></>;

  const stateGroup = (workItem as any).state__group;
  if (stateGroup === "completed" || stateGroup === "cancelled") return <></>;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return (
      <Tooltip tooltipContent={`Overdue by ${overdueDays} day${overdueDays !== 1 ? "s" : ""}`} position="bottom">
        <div className="flex-shrink-0 flex items-center"><AlertTriangle size={14} className="text-danger-primary" /></div>
      </Tooltip>
    );
  }

  if (diffDays <= 2) {
    const label = diffDays === 0 ? "Due today" : `Due in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
    return (
      <Tooltip tooltipContent={label} position="bottom">
        <div className="flex-shrink-0 flex items-center"><Clock size={14} className="text-warning-primary" /></div>
      </Tooltip>
    );
  }

  return <></>;
}
