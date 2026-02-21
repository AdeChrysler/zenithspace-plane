/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Clock, X } from "lucide-react";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";
import { useProject } from "@/hooks/store/use-project";

type TIssueActivityWorklogCreateButton = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

class WorklogSvc extends APIService {
  constructor() { super(API_BASE_URL); }
  async create(ws: string, pid: string, iid: string, data: any) {
    return this.post(`/api/workspaces/${ws}/projects/${pid}/issues/${iid}/worklogs/`, data).then(r => r?.data);
  }
}

const worklogService = new WorklogSvc();

export function IssueActivityWorklogCreateButton(props: TIssueActivityWorklogCreateButton) {
  const { workspaceSlug, projectId, issueId, disabled } = props;
  const { getProjectById } = useProject();
  const project = getProjectById(projectId);
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!project?.is_time_tracking_enabled) return null;

  const handleSubmit = async () => {
    const h = parseInt(hours || "0", 10);
    const m = parseInt(minutes || "0", 10);
    const totalMinutes = h * 60 + m;
    if (totalMinutes <= 0) return;
    setIsSubmitting(true);
    try {
      await worklogService.create(workspaceSlug, projectId, issueId, {
        duration_in_minutes: totalMinutes, description, logged_at: new Date().toISOString(),
      });
      setHours(""); setMinutes(""); setDescription(""); setIsOpen(false);
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="relative">
      <button type="button" className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-layer-3 transition-colors" onClick={() => setIsOpen(!isOpen)} disabled={disabled}>
        <Clock className="h-3.5 w-3.5" /><span>Log time</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 top-8 z-10 w-72 rounded-md border border-subtle bg-layer-1 p-3 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Log time</span>
            <button type="button" onClick={() => setIsOpen(false)}><X className="h-4 w-4 text-secondary" /></button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1"><label className="text-xs text-secondary">Hours</label><input type="number" min="0" value={hours} onChange={e => setHours(e.target.value)} className="w-full rounded border border-subtle bg-surface-1 px-2 py-1 text-sm" placeholder="0" /></div>
            <div className="flex-1"><label className="text-xs text-secondary">Minutes</label><input type="number" min="0" max="59" value={minutes} onChange={e => setMinutes(e.target.value)} className="w-full rounded border border-subtle bg-surface-1 px-2 py-1 text-sm" placeholder="0" /></div>
          </div>
          <div><label className="text-xs text-secondary">Description (optional)</label><textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded border border-subtle bg-surface-1 px-2 py-1 text-sm resize-none" rows={2} placeholder="What did you work on?" /></div>
          <button type="button" className="w-full rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50" onClick={handleSubmit} disabled={isSubmitting || (!hours && !minutes)}>
            {isSubmitting ? "Logging..." : "Log time"}
          </button>
        </div>
      )}
    </div>
  );
}
