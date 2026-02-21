/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { TDeDupeIssue } from "@plane/types";
import { DeDupeService } from "@/services/de-dupe.service";

const deDupeService = new DeDupeService();

export const useDebouncedDuplicateIssues = (
  workspaceSlug: string | undefined,
  workspaceId: string | undefined,
  projectId: string | undefined,
  formData: { name: string | undefined; description_html?: string | undefined; issueId?: string | undefined }
) => {
  const [duplicateIssues, setDuplicateIssues] = useState<TDeDupeIssue[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const title = formData.name?.trim();

    if (!workspaceSlug || !workspaceId || !title || title.length < 3) {
      setDuplicateIssues([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const response = await deDupeService.fetchDuplicateIssues(workspaceSlug, {
          title,
          workspace_id: workspaceId,
          project_id: projectId,
          issue_id: formData.issueId ?? null,
          description_stripped: formData.description_html ?? "",
        });
        setDuplicateIssues(response.dupes ?? []);
      } catch {
        setDuplicateIssues([]);
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [workspaceSlug, workspaceId, projectId, formData.name, formData.description_html, formData.issueId]);

  return { duplicateIssues };
};
