/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Plus, Trash2, Zap } from "lucide-react";
import { ToggleSwitch, Loader } from "@plane/ui";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TCustomAutomationsRootProps = {
  projectId: string;
  workspaceSlug: string;
};

type TAutomation = {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, string>;
  action_type: string;
  action_config: Record<string, string>;
  is_active: boolean;
};

const TRIGGER_LABELS: Record<string, string> = {
  state_change: "State changes",
  assignee_change: "Assignee changes",
  label_change: "Label changes",
  due_date: "Due date changes",
  priority_change: "Priority changes",
  created: "Issue is created",
};

const ACTION_LABELS: Record<string, string> = {
  update_state: "Update state",
  add_label: "Add label",
  assign_user: "Assign user",
  send_notification: "Send notification",
  update_priority: "Update priority",
};

class AutomationService extends APIService {
  constructor() { super(API_BASE_URL); }
  async list(ws: string, pid: string) { return this.get(`/api/workspaces/${ws}/projects/${pid}/automations/`).then(r => r?.data); }
  async create(ws: string, pid: string, data: any) { return this.post(`/api/workspaces/${ws}/projects/${pid}/automations/`, data).then(r => r?.data); }
  async update(ws: string, pid: string, id: string, data: any) { return this.patch(`/api/workspaces/${ws}/projects/${pid}/automations/${id}/`, data).then(r => r?.data); }
  async remove(ws: string, pid: string, id: string) { return this.delete(`/api/workspaces/${ws}/projects/${pid}/automations/${id}/`).then(r => r?.data); }
}

const automationService = new AutomationService();

export const CustomAutomationsRoot = observer(function CustomAutomationsRoot(props: TCustomAutomationsRootProps) {
  const { projectId, workspaceSlug } = props;
  const [automations, setAutomations] = useState<TAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("state_change");
  const [actionType, setActionType] = useState("update_state");
  const [submitting, setSubmitting] = useState(false);

  const fetchAutomations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await automationService.list(workspaceSlug, projectId);
      setAutomations(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [workspaceSlug, projectId]);

  useEffect(() => { void fetchAutomations(); }, [fetchAutomations]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      const created = await automationService.create(workspaceSlug, projectId, {
        name, description: "", trigger_type: triggerType, trigger_config: {}, action_type: actionType, action_config: {},
      });
      setAutomations(prev => [created, ...prev]);
      setShowForm(false); setName("");
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Success", message: "Automation created." });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: "Failed to create automation." });
    } finally { setSubmitting(false); }
  };

  const handleToggle = async (a: TAutomation) => {
    try {
      const updated = await automationService.update(workspaceSlug, projectId, a.id, { is_active: !a.is_active });
      setAutomations(prev => prev.map(x => x.id === a.id ? updated : x));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await automationService.remove(workspaceSlug, projectId, id);
      setAutomations(prev => prev.filter(x => x.id !== id));
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Deleted", message: "Automation deleted." });
    } catch { /* ignore */ }
  };

  return (
    <section className="mt-8 border-t border-subtle pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Custom Automations</h3>
          <p className="text-sm text-secondary mt-1">Create rules that automatically perform actions when conditions are met.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(v => !v)} prependIcon={<Plus className="size-3.5" />}>
          {showForm ? "Cancel" : "Create Automation"}
        </Button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-md border border-subtle bg-surface-2 p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input type="text" className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm focus:outline-none" placeholder="e.g., Auto-assign on state change" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">When (Trigger)</label>
              <select className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm" value={triggerType} onChange={e => setTriggerType(e.target.value)}>
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Then (Action)</label>
              <select className="mt-1 block w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-sm" value={actionType} onChange={e => setActionType(e.target.value)}>
                {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="neutral-primary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} loading={submitting}>Create</Button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading ? (
          <Loader><Loader.Item height="60px" /><Loader.Item height="60px" /></Loader>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-subtle py-10 text-center">
            <Zap className="size-8 text-secondary mb-2" />
            <p className="text-sm text-secondary">No custom automations yet.</p>
          </div>
        ) : (
          automations.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-md border border-subtle bg-surface-2 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Zap className={`size-4 shrink-0 ${a.is_active ? "text-primary" : "text-secondary"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-secondary truncate">{TRIGGER_LABELS[a.trigger_type]} -&gt; {ACTION_LABELS[a.action_type]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <ToggleSwitch value={a.is_active} onChange={() => handleToggle(a)} size="sm" />
                <button type="button" className="text-secondary hover:text-danger-primary transition-colors" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
});
