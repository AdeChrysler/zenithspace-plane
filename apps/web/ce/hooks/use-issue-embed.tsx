/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TEmbedConfig } from "@plane/editor";
import type { TSearchEntityRequestPayload, TSearchResponse } from "@plane/types";
import { IssueEmbedCard } from "@/plane-web/components/pages";

export type TIssueEmbedHookProps = {
  fetchEmbedSuggestions?: (payload: TSearchEntityRequestPayload) => Promise<TSearchResponse>;
  projectId?: string;
  workspaceSlug?: string;
};

export const useIssueEmbed = (props: TIssueEmbedHookProps) => {
  const { workspaceSlug } = props;

  const widgetCallback = ({
    issueId,
    projectId,
    workspaceSlug: wsSlug,
  }: {
    issueId: string;
    projectId: string | undefined;
    workspaceSlug: string | undefined;
  }) => (
    <IssueEmbedCard
      issueId={issueId}
      projectId={projectId}
      workspaceSlug={wsSlug ?? workspaceSlug}
    />
  );

  const issueEmbedProps: TEmbedConfig["issue"] = {
    widgetCallback,
  };

  return {
    issueEmbedProps,
  };
};
