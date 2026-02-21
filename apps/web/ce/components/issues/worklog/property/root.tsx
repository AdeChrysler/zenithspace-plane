/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect, useCallback } from "react";
import { Clock } from "lucide-react";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";
import { useProject } from "@/hooks/store/use-project";

type TIssueWorklogProperty = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

class WorklogSvc extends APIService {
  constructor() { super(API_BASE_URL); }
  async list(ws: string, pid: string, iid: string) {
    return this.get(`/api/workspaces/${ws}/projects/${pid}/issues/${iid}/worklogs/`).then(r => r?.data);
  }
}

const worklogService = new WorklogSvc();

const formatDuration = (m: number) => {
  if (m === 0) return "0m";
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h > 0 && mins > 0) return `${h}h ${mins}m`;
  if (h > 0) return `${h}h`;
  return `${mins}m`;
};

export function IssueWorklogProperty(props: TIssueWorklogProperty) {
  const { workspaceSlug, projectId, issueId } = props;
  const { getProjectById } = useProject();
  const project = getProjectById(projectId);
  const [totalMinutes, setTotalMinutes] = useState(0);

  const fetchWorklogs = useCallback(async () => {
    try {
      const worklogs = await worklogService.list(workspaceSlug, projectId, issueId);
      const total = worklogs.reduce((sum: number, w: any) => sum + w.duration_in_minutes, 0);
      setTotalMinutes(total);
    } catch { setTotalMinutes(0); }
  }, [workspaceSlug, projectId, issueId]);

  useEffect(() => {
    if (project?.is_time_tracking_enabled) fetchWorklogs();
  }, [project?.is_time_tracking_enabled, fetchWorklogs]);

  if (!project?.is_time_tracking_enabled) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-secondary">
      <Clock className="size-3.5" />
      <span>{formatDuration(totalMinutes)}</span>
    </div>
  );
}
