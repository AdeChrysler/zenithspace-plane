/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Layers } from "lucide-react";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

export type TIssueTypeActivity = { activityId: string; showIssue?: boolean; ends: "top" | "bottom" | undefined };

export const IssueTypeActivity = observer(function IssueTypeActivity(props: TIssueTypeActivity) {
  const { activityId } = props;
  const { activity: { getActivityById } } = useIssueDetail();
  const activity = getActivityById(activityId);

  if (!activity) return <></>;

  return (
    <div className="flex items-center gap-2 text-sm text-secondary">
      <Layers className="h-4 w-4 flex-shrink-0" />
      <span>
        set the type to <span className="font-medium text-primary">{activity.new_value}</span>
        {activity.old_value ? (
          <> from <span className="font-medium text-primary">{activity.old_value}</span></>
        ) : null}
      </span>
    </div>
  );
});
