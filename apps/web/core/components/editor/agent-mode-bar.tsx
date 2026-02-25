/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Bot, ChevronDown, Plus, X } from "lucide-react";
// plane imports
import { cn } from "@plane/utils";
// hooks
import { useAgent } from "@/hooks/store/use-agent";
// types
import type { TAgentProvider, TAgentProviderVariant } from "@/store/agent.store";

// --- Types ---

export interface AgentModeBarProps {
  workspaceSlug: string;
  projectId: string;
}

// --- Helper: build a unique key for a provider variant ---

function variantKey(provider: TAgentProvider, variant: TAgentProviderVariant): string {
  return `${provider.slug}-${variant.slug}`;
}

function displayNameForKey(key: string, providers: TAgentProvider[]): string {
  const lastDash = key.lastIndexOf("-");
  const provSlug = lastDash > 0 ? key.slice(0, lastDash) : key;
  const varSlug = lastDash > 0 ? key.slice(lastDash + 1) : "";
  for (const p of providers) {
    if (p.slug === provSlug) {
      for (const v of p.variants) {
        if (v.slug === varSlug) return v.display_name;
      }
      return p.display_name;
    }
  }
  // Fallback: humanize the key
  return key
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

// --- Provider Dropdown ---

const ProviderDropdown = observer(function ProviderDropdown({
  providers,
  selectedKeys,
  onSelect,
  onClose,
}: {
  providers: TAgentProvider[];
  selectedKeys: string[];
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const grouped = providers.reduce(
    (acc, provider) => {
      const group = provider.provider_group || "Other";
      if (!acc[group]) acc[group] = [];
      acc[group].push(provider);
      return acc;
    },
    {} as Record<string, TAgentProvider[]>
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const groupNames = Object.keys(grouped).sort();

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 top-full mt-1 z-20 min-w-[220px] rounded-md border border-subtle bg-surface-1 shadow-lg py-1"
    >
      {groupNames.map((groupName) => (
        <div key={groupName}>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
            {groupName}
          </div>
          {grouped[groupName].map((provider) =>
            provider.variants
              .filter((v) => v.is_enabled)
              .map((variant) => {
                const key = variantKey(provider, variant);
                const isSelected = selectedKeys.includes(key);
                return (
                  <button
                    key={key}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-layer-1",
                      isSelected && "text-primary font-medium"
                    )}
                    onClick={() => {
                      onSelect(key);
                    }}
                  >
                    <div
                      className={cn(
                        "size-3 rounded-full border flex items-center justify-center",
                        isSelected ? "border-primary bg-primary" : "border-tertiary"
                      )}
                    >
                      {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={cn(isSelected ? "text-primary" : "text-secondary")}>{variant.display_name}</span>
                  </button>
                );
              })
          )}
        </div>
      ))}
      {groupNames.length === 0 && (
        <div className="px-3 py-2 text-xs text-tertiary">No providers available</div>
      )}
    </div>
  );
});

// --- Skill Dropdown ---

const SkillDropdown = observer(function SkillDropdown({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const agentStore = useAgent();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void agentStore.fetchSkills(workspaceSlug, projectId);
  }, [agentStore, workspaceSlug, projectId]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const skills = agentStore.skills.filter((s) => s.is_enabled);
  const selectedSkill = skills.find((s) => s.trigger === agentStore.selectedSkillTrigger);

  if (skills.length === 0) return null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-secondary hover:bg-layer-1 transition-colors border border-transparent hover:border-subtle"
        onClick={() => setIsOpen((v) => !v)}
      >
        <span>Skill:</span>
        <span className="font-medium text-primary">{selectedSkill ? selectedSkill.name : "None"}</span>
        <ChevronDown className="size-3 text-tertiary" />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] rounded-md border border-subtle bg-surface-1 shadow-lg py-1">
          <button
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-layer-1",
              !agentStore.selectedSkillTrigger && "text-primary font-medium"
            )}
            onClick={() => {
              agentStore.setSelectedSkill(null);
              setIsOpen(false);
            }}
          >
            None
          </button>
          {skills.map((skill) => (
            <button
              key={skill.id}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-layer-1",
                agentStore.selectedSkillTrigger === skill.trigger && "text-primary font-medium"
              )}
              onClick={() => {
                agentStore.setSelectedSkill(skill.trigger);
                setIsOpen(false);
              }}
            >
              <span>{skill.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// --- Main Agent Mode Bar ---

export const AgentModeBar = observer(function AgentModeBar(props: AgentModeBarProps) {
  const { workspaceSlug, projectId } = props;
  const agentStore = useAgent();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch providers on mount
  useEffect(() => {
    void agentStore.fetchProviders(workspaceSlug);
  }, [agentStore, workspaceSlug]);

  const enabledProviders = agentStore.enabledProviders;
  const selectedKeys = agentStore.selectedProviderVariants;
  const hasSelections = selectedKeys.length > 0;

  const handleToggleVariant = useCallback(
    (key: string) => {
      if (selectedKeys.includes(key)) {
        agentStore.removeProviderVariant(key);
      } else {
        agentStore.addProviderVariant(key);
      }
    },
    [agentStore, selectedKeys]
  );

  const handleRemoveVariant = useCallback(
    (key: string) => {
      agentStore.removeProviderVariant(key);
    },
    [agentStore]
  );

  // When no agents are selected and bar is collapsed, just show the toggle button
  if (!isExpanded && !hasSelections) {
    return (
      <button
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-secondary hover:bg-layer-1 hover:text-primary transition-colors"
        onClick={() => setIsExpanded(true)}
        title="Send to AI agents"
      >
        <Bot className="size-3.5" />
        <span>Agent mode</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-1.5">
      {/* Bot icon / toggle */}
      <button
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors flex-shrink-0"
        onClick={() => {
          if (hasSelections) {
            agentStore.clearSelection();
          }
          setIsExpanded(false);
          setShowDropdown(false);
        }}
        title={hasSelections ? "Clear agent selection" : "Close agent mode"}
      >
        <Bot className="size-3.5" />
      </button>

      {/* Label */}
      <span className="text-xs text-secondary flex-shrink-0">Send to:</span>

      {/* Selected variant chips */}
      <div className="flex items-center gap-1 flex-wrap">
        {selectedKeys.map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {displayNameForKey(key, enabledProviders)}
            <button
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
              onClick={() => handleRemoveVariant(key)}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}

        {/* Add button */}
        <div className="relative">
          <button
            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs text-secondary hover:bg-layer-1 hover:text-primary transition-colors"
            onClick={() => setShowDropdown((v) => !v)}
          >
            <Plus className="size-3" />
            <span>Add</span>
            <ChevronDown className="size-3" />
          </button>
          {showDropdown && (
            <ProviderDropdown
              providers={enabledProviders}
              selectedKeys={selectedKeys}
              onSelect={handleToggleVariant}
              onClose={() => setShowDropdown(false)}
            />
          )}
        </div>
      </div>

      {/* Skill selector (shown when agents are selected) */}
      {hasSelections && (
        <>
          <div className="mx-1 h-4 w-px bg-primary/10 flex-shrink-0" />
          <SkillDropdown workspaceSlug={workspaceSlug} projectId={projectId} />
        </>
      )}
    </div>
  );
});

// --- Export helper to get selected agent count ---

export function useAgentModeState() {
  const agentStore = useAgent();
  return {
    selectedCount: agentStore.selectedProviderVariants.length,
    selectedVariants: agentStore.selectedProviderVariants,
    selectedSkillTrigger: agentStore.selectedSkillTrigger,
    hasAgentsSelected: agentStore.selectedProviderVariants.length > 0,
  };
}
