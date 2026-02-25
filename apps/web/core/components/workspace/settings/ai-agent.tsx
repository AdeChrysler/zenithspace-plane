/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { observer } from "mobx-react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
// plane imports
// eslint-disable-next-line import/no-unresolved
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// eslint-disable-next-line import/no-unresolved
import { Button } from "@plane/propel/button";
// eslint-disable-next-line import/no-unresolved
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// eslint-disable-next-line import/no-unresolved
import { Input, CustomSelect } from "@plane/ui";
// eslint-disable-next-line import/no-unresolved
import { cn } from "@plane/utils";
// hooks
import { useAgent } from "@/hooks/store/use-agent";
import { useUserPermissions } from "@/hooks/store/user";
// services
import { AgentService } from "@/services/agent.service";
// types
import type { TAgentProvider, TAgentSkill, TAgentProviderVariant } from "@/store/agent.store";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SKILL_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "autonomous", label: "Autonomous" },
  { value: "comment_only", label: "Comment Only" },
];

const agentService = new AgentService();

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

/** Expandable provider card with variants and connection status. */
const ProviderCard = observer(function ProviderCard({
  provider,
  isAdmin,
}: {
  provider: TAgentProvider;
  isAdmin: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleConnect = () => {
    setToast({
      type: TOAST_TYPE.INFO,
      title: "Coming soon",
      message: "OAuth provider integration coming soon.",
    });
  };

  return (
    <div className="rounded-lg border border-subtle bg-layer-2">
      {/* Provider header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Expand/collapse toggle */}
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center justify-center text-tertiary hover:text-primary transition-colors"
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>

          {/* Provider icon */}
          {provider.icon_url && (
            <img src={provider.icon_url} alt={provider.display_name} className="size-5 rounded" />
          )}

          {/* Provider name + group */}
          <div className="flex flex-col">
            <span className="text-body-sm-medium">{provider.display_name}</span>
            <span className="text-caption-sm-regular text-tertiary">{provider.provider_group}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block size-2 rounded-full",
                provider.is_enabled ? "bg-green-500" : "bg-red-400"
              )}
            />
            <span className="text-caption-sm-regular text-tertiary">
              {provider.is_enabled ? "Connected" : "Disconnected"}
            </span>
          </span>

          {/* Connect button (placeholder for OAuth - Task 21) */}
          {!provider.is_enabled && isAdmin && (
            <Button variant="secondary" size="sm" onClick={handleConnect}>
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Expandable variant list */}
      {isExpanded && (
        <div className="border-t border-subtle">
          <div className="px-4 py-2">
            <span className="text-caption-sm-medium text-tertiary">Model variants</span>
          </div>
          {provider.variants.length === 0 ? (
            <div className="px-4 pb-3">
              <span className="text-caption-sm-regular text-tertiary">No variants configured.</span>
            </div>
          ) : (
            <div className="divide-y divide-subtle">
              {provider.variants.map((variant: TAgentProviderVariant) => (
                <div key={variant.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-body-sm-regular">{variant.display_name}</span>
                    <span className="text-caption-sm-regular text-tertiary">{variant.model_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {variant.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        Default
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-block size-2 rounded-full",
                        variant.is_enabled ? "bg-green-500" : "bg-neutral-400"
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/** Skill card with edit/delete actions. */
function SkillCard({
  skill,
  isAdmin,
  onEdit,
  onDelete,
}: {
  skill: TAgentSkill;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-subtle bg-layer-2 px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-body-sm-medium">{skill.name}</span>
          <span className="text-caption-sm-regular text-tertiary font-mono">@{skill.trigger}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-caption-sm-regular text-tertiary">
            Provider: {skill.default_provider || "Any"}
          </span>
          <span className="text-caption-sm-regular text-tertiary">
            Mode: {skill.mode === "autonomous" ? "Autonomous" : "Comment Only"}
          </span>
          {skill.timeout_minutes > 0 && (
            <span className="text-caption-sm-regular text-tertiary">
              Timeout: {skill.timeout_minutes}m
            </span>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-layer-3 transition-colors text-tertiary hover:text-primary"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-layer-3 transition-colors text-tertiary hover:text-danger-primary"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Skill Create / Edit Form (inline)
// -----------------------------------------------------------------------------

type TSkillFormData = {
  name: string;
  trigger: string;
  description: string;
  default_provider: string;
  mode: string;
  timeout_minutes: number;
};

const EMPTY_SKILL_FORM: TSkillFormData = {
  name: "",
  trigger: "",
  description: "",
  default_provider: "",
  mode: "autonomous",
  timeout_minutes: 30,
};

function SkillForm({
  initialData,
  providers,
  onSave,
  onCancel,
  isSaving,
}: {
  initialData: TSkillFormData;
  providers: TAgentProvider[];
  onSave: (data: TSkillFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<TSkillFormData>(initialData);

  const handleChange = (key: keyof TSkillFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="rounded-lg border border-subtle bg-layer-2 p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="skill-name" className="text-caption-sm-medium text-tertiary">Skill Name</label>
          <Input
            id="skill-name"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("name", e.target.value)}
            placeholder="e.g., Code Review"
            className="w-full rounded-md"
          />
        </div>

        {/* Trigger */}
        <div className="flex flex-col gap-1">
          <label htmlFor="skill-trigger" className="text-caption-sm-medium text-tertiary">Trigger (mention keyword)</label>
          <Input
            id="skill-trigger"
            value={formData.trigger}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("trigger", e.target.value)}
            placeholder="e.g., review"
            className="w-full rounded-md"
          />
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label htmlFor="skill-description" className="text-caption-sm-medium text-tertiary">Description</label>
        <Input
          id="skill-description"
          value={formData.description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("description", e.target.value)}
          placeholder="What this skill does..."
          className="w-full rounded-md"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Default provider */}
        <div className="flex flex-col gap-1">
          <span className="text-caption-sm-medium text-tertiary">Default Provider</span>
          <CustomSelect
            value={formData.default_provider}
            onChange={(val: string) => handleChange("default_provider", val)}
            label={
              providers.find((p) => p.slug === formData.default_provider)?.display_name || "Any provider"
            }
            buttonClassName="border border-subtle bg-layer-2 !shadow-none !rounded-md"
            input
          >
            <CustomSelect.Option value="">Any provider</CustomSelect.Option>
            {providers.map((p) => (
              <CustomSelect.Option key={p.id} value={p.slug}>
                {p.display_name}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        </div>

        {/* Mode */}
        <div className="flex flex-col gap-1">
          <span className="text-caption-sm-medium text-tertiary">Mode</span>
          <CustomSelect
            value={formData.mode}
            onChange={(val: string) => handleChange("mode", val)}
            label={SKILL_MODE_OPTIONS.find((o) => o.value === formData.mode)?.label || "Select mode"}
            buttonClassName="border border-subtle bg-layer-2 !shadow-none !rounded-md"
            input
          >
            {SKILL_MODE_OPTIONS.map((option) => (
              <CustomSelect.Option key={option.value} value={option.value}>
                {option.label}
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        </div>

        {/* Timeout */}
        <div className="flex flex-col gap-1">
          <label htmlFor="skill-timeout" className="text-caption-sm-medium text-tertiary">Timeout (minutes)</label>
          <Input
            id="skill-timeout"
            type="number"
            value={String(formData.timeout_minutes)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange("timeout_minutes", parseInt(e.target.value, 10) || 0)
            }
            placeholder="30"
            className="w-full rounded-md"
            min={1}
            max={120}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button variant="primary" size="sm" onClick={() => onSave(formData)} loading={isSaving}>
          {isSaving ? "Saving..." : "Save Skill"}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const AIAgentSettings = observer(function AIAgentSettings() {
  // ---------------------------------------------------------------------------
  // Permission check
  // ---------------------------------------------------------------------------
  const { allowPermissions } = useUserPermissions();
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  // ---------------------------------------------------------------------------
  // Params & stores
  // ---------------------------------------------------------------------------
  const { workspaceSlug } = useParams();
  const agentStore = useAgent();

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSkill, setIsSavingSkill] = useState(false);

  // Skill form state
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch data on mount
  // ---------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (!workspaceSlug || typeof workspaceSlug !== "string") return;

    setIsLoading(true);
    try {
      await Promise.all([
        agentStore.fetchProviders(workspaceSlug),
        agentStore.fetchSkills(workspaceSlug),
      ]);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Failed to load AI Agent settings. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, agentStore]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Skill CRUD
  // ---------------------------------------------------------------------------
  const handleCreateSkill = async (data: TSkillFormData) => {
    if (!workspaceSlug || typeof workspaceSlug !== "string") return;

    setIsSavingSkill(true);
    try {
      await agentService.createSkill(workspaceSlug, data);

      // Invalidate cache so fetchSkills re-fetches
      agentStore.skills = [];
      await agentStore.fetchSkills(workspaceSlug);

      setShowSkillForm(false);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Skill created",
        message: `Skill "${data.name}" has been created.`,
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Failed to create skill. Please try again.",
      });
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleUpdateSkill = async (skillId: string, data: TSkillFormData) => {
    if (!workspaceSlug || typeof workspaceSlug !== "string") return;

    setIsSavingSkill(true);
    try {
      await agentService.updateSkill(workspaceSlug, skillId, data);

      agentStore.skills = [];
      await agentStore.fetchSkills(workspaceSlug);

      setEditingSkillId(null);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Skill updated",
        message: `Skill "${data.name}" has been updated.`,
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Failed to update skill. Please try again.",
      });
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleDeleteSkill = async (skill: TAgentSkill) => {
    if (!workspaceSlug || typeof workspaceSlug !== "string") return;

    try {
      await agentService.deleteSkill(workspaceSlug, skill.id);

      agentStore.skills = [];
      await agentStore.fetchSkills(workspaceSlug);

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Skill deleted",
        message: `Skill "${skill.name}" has been deleted.`,
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Failed to delete skill. Please try again.",
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const getEditFormData = (skill: TAgentSkill): TSkillFormData => ({
    name: skill.name,
    trigger: skill.trigger,
    description: skill.description,
    default_provider: skill.default_provider,
    mode: skill.mode,
    timeout_minutes: skill.timeout_minutes,
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-body-sm-regular text-tertiary">Loading AI Agent settings...</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full flex flex-col gap-y-8", { "opacity-60 pointer-events-none": !isAdmin })}>
      {/* ------------------------------------------------------------------ */}
      {/* Section: AI Agent Providers                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-h5-semibold">AI Agent Providers</h3>
          <p className="text-body-sm-regular text-tertiary">
            Connect and configure AI providers for your workspace.
          </p>
        </div>

        {agentStore.providers.length === 0 ? (
          <div className="rounded-lg border border-subtle bg-layer-2 px-4 py-6 text-center">
            <p className="text-body-sm-regular text-tertiary">
              No AI providers configured. Providers will appear here once the system is set up.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {agentStore.providers.map((provider: TAgentProvider) => (
              <ProviderCard key={provider.id} provider={provider} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section: Agent Skills                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-h5-semibold">Agent Skills</h3>
            <p className="text-body-sm-regular text-tertiary">
              Custom workflows that agents can execute when mentioned in comments.
            </p>
          </div>

          {isAdmin && !showSkillForm && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowSkillForm(true);
                setEditingSkillId(null);
              }}
            >
              <Plus className="size-3.5 mr-1" />
              Add Skill
            </Button>
          )}
        </div>

        {/* Create form */}
        {showSkillForm && (
          <SkillForm
            initialData={EMPTY_SKILL_FORM}
            providers={agentStore.providers}
            onSave={(data) => void handleCreateSkill(data)}
            onCancel={() => setShowSkillForm(false)}
            isSaving={isSavingSkill}
          />
        )}

        {/* Skill list */}
        {agentStore.skills.length === 0 && !showSkillForm ? (
          <div className="rounded-lg border border-subtle bg-layer-2 px-4 py-6 text-center">
            <p className="text-body-sm-regular text-tertiary">
              No skills configured yet. Create a skill to define custom agent workflows.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {agentStore.skills.map((skill: TAgentSkill) =>
              editingSkillId === skill.id ? (
                <SkillForm
                  key={skill.id}
                  initialData={getEditFormData(skill)}
                  providers={agentStore.providers}
                  onSave={(data) => void handleUpdateSkill(skill.id, data)}
                  onCancel={() => setEditingSkillId(null)}
                  isSaving={isSavingSkill}
                />
              ) : (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isAdmin={isAdmin}
                  onEdit={() => {
                    setEditingSkillId(skill.id);
                    setShowSkillForm(false);
                  }}
                  onDelete={() => void handleDeleteSkill(skill)}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
});
