/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useCallback } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// eslint-disable-next-line import/no-unresolved
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";

type Props = {
  children: React.ReactNode;
};

export const RealtimeProvider = observer(function RealtimeProvider({ children }: Props) {
  const { workspaceSlug } = useParams();

  const handleRealtimeEvent = useCallback(
    (event: { event: string; workspace_slug: string; project_id?: string; data: Record<string, unknown> }) => {
      const { event: eventType, data } = event;
      const actorName = data.actor_name as string | undefined;
      const issueIdentifier = data.issue_identifier as string | undefined;

      switch (eventType) {
        case "issue_created":
        case "issue_updated":
        case "issue_deleted":
          // Dispatch a custom DOM event that stores can listen to
          window.dispatchEvent(
            new CustomEvent("plane:realtime", {
              detail: { type: eventType, ...data },
            })
          );
          break;

        case "comment_created":
          window.dispatchEvent(
            new CustomEvent("plane:realtime", {
              detail: { type: eventType, ...data },
            })
          );
          // Show a subtle toast for new comments
          if (actorName) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            setToast({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              type: TOAST_TYPE.INFO,
              title: "New comment",
              message: `${actorName} commented on ${issueIdentifier ?? "an issue"}`,
            });
          }
          break;

        case "comment_updated":
        case "comment_deleted":
        case "activity_created":
          window.dispatchEvent(
            new CustomEvent("plane:realtime", {
              detail: { type: eventType, ...data },
            })
          );
          break;
      }
    },
    []
  );

  useRealtimeUpdates(workspaceSlug?.toString(), handleRealtimeEvent);

  return <>{children}</>;
});
