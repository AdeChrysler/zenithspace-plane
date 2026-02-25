/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, computed, makeObservable, observable, runInAction } from "mobx";
// services
import { AgentService } from "@/services/agent.service";

// --- Types ---

export type TAgentProviderVariant = {
  id: string;
  slug: string;
  display_name: string;
  model_id: string;
  is_default: boolean;
  is_enabled: boolean;
  sort_order: number;
};

export type TAgentProvider = {
  id: string;
  slug: string;
  display_name: string;
  provider_group: string;
  cli_tool: string;
  docker_image: string;
  oauth_provider: string;
  is_enabled: boolean;
  icon_url: string | null;
  sort_order: number;
  variants: TAgentProviderVariant[];
};

export type TAgentSkill = {
  id: string;
  name: string;
  trigger: string;
  description: string;
  instructions: string;
  default_provider: string;
  mode: string;
  timeout_minutes: number;
  is_enabled: boolean;
};

export type TAgentSession = {
  id: string;
  provider_slug: string;
  variant_slug: string;
  model_id: string;
  skill_trigger: string | null;
  status: string;
  response_text: string | null;
  response_html: string | null;
  branch_name: string | null;
  pull_request_url: string | null;
  error_message: string | null;
};

export type TAgentInvokeRequest = {
  provider_slug: string;
  variant_slug?: string;
  skill_trigger?: string;
  project_id: string;
  issue_id: string;
  comment_text: string;
  comment_id?: string;
};

export type TStreamCallbacks = {
  onChunk: (chunk: { type: string; content: string }) => void;
  onComplete: () => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
};

// --- Store Interface ---

export interface IAgentStore {
  // Observables
  providers: TAgentProvider[];
  skills: TAgentSkill[];
  activeSessions: Map<string, TAgentSession>;
  isLoading: boolean;

  // Agent mode bar state
  selectedProviderVariants: string[];
  selectedSkillTrigger: string | null;

  // Computed
  get enabledProviders(): TAgentProvider[];
  get groupedProviders(): Record<string, TAgentProvider[]>;

  // Actions
  fetchProviders(workspaceSlug: string): Promise<void>;
  fetchSkills(workspaceSlug: string, projectId?: string): Promise<void>;
  invokeAgent(workspaceSlug: string, request: TAgentInvokeRequest): Promise<TAgentSession>;
  streamSession(workspaceSlug: string, sessionId: string, callbacks: TStreamCallbacks): Promise<void>;
  cancelSession(workspaceSlug: string, sessionId: string): Promise<void>;

  // Agent mode bar
  addProviderVariant(providerVariantKey: string): void;
  removeProviderVariant(providerVariantKey: string): void;
  setSelectedSkill(trigger: string | null): void;
  clearSelection(): void;
}

// --- Store Implementation ---

export class AgentStore implements IAgentStore {
  // Observables
  providers: TAgentProvider[] = [];
  skills: TAgentSkill[] = [];
  activeSessions: Map<string, TAgentSession> = new Map();
  isLoading: boolean = false;

  // Agent mode bar state
  selectedProviderVariants: string[] = [];
  selectedSkillTrigger: string | null = null;

  // Service
  agentService;

  // Cache keys to avoid redundant fetches
  private providersCacheKey: string | null = null;
  private skillsCacheKey: string | null = null;

  constructor() {
    makeObservable(this, {
      // observables
      providers: observable,
      skills: observable,
      activeSessions: observable,
      isLoading: observable.ref,
      selectedProviderVariants: observable,
      selectedSkillTrigger: observable.ref,
      // computed
      enabledProviders: computed,
      groupedProviders: computed,
      // actions
      fetchProviders: action,
      fetchSkills: action,
      invokeAgent: action,
      streamSession: action,
      cancelSession: action,
      addProviderVariant: action,
      removeProviderVariant: action,
      setSelectedSkill: action,
      clearSelection: action,
    });
    this.agentService = new AgentService();
  }

  // --- Computed ---

  get enabledProviders(): TAgentProvider[] {
    return this.providers.filter((p) => p.is_enabled);
  }

  get groupedProviders(): Record<string, TAgentProvider[]> {
    return this.enabledProviders.reduce(
      (groups, provider) => {
        const group = provider.provider_group || "other";
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(provider);
        return groups;
      },
      {} as Record<string, TAgentProvider[]>
    );
  }

  // --- Actions ---

  fetchProviders = async (workspaceSlug: string): Promise<void> => {
    const cacheKey = workspaceSlug;
    if (this.providersCacheKey === cacheKey && this.providers.length > 0) return;

    try {
      runInAction(() => {
        this.isLoading = true;
      });

      const response = await this.agentService.fetchProviders(workspaceSlug);

      runInAction(() => {
        this.providers = response;
        this.providersCacheKey = cacheKey;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      console.error("Failed to fetch agent providers", error);
      throw error;
    }
  };

  fetchSkills = async (workspaceSlug: string, projectId?: string): Promise<void> => {
    const cacheKey = `${workspaceSlug}:${projectId ?? "all"}`;
    if (this.skillsCacheKey === cacheKey && this.skills.length > 0) return;

    try {
      runInAction(() => {
        this.isLoading = true;
      });

      const response = await this.agentService.fetchSkills(workspaceSlug, projectId);

      runInAction(() => {
        this.skills = response;
        this.skillsCacheKey = cacheKey;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      console.error("Failed to fetch agent skills", error);
      throw error;
    }
  };

  invokeAgent = async (workspaceSlug: string, request: TAgentInvokeRequest): Promise<TAgentSession> => {
    try {
      runInAction(() => {
        this.isLoading = true;
      });

      const session = await this.agentService.invokeAgent(workspaceSlug, request);

      runInAction(() => {
        this.activeSessions.set(session.id, session);
        this.isLoading = false;
      });

      return session;
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      console.error("Failed to invoke agent", error);
      throw error;
    }
  };

  streamSession = async (workspaceSlug: string, sessionId: string, callbacks: TStreamCallbacks): Promise<void> => {
    try {
      await this.agentService.streamSession(
        workspaceSlug,
        sessionId,
        (chunk) => {
          callbacks.onChunk(chunk);
        },
        () => {
          // Update session status on complete
          runInAction(() => {
            const session = this.activeSessions.get(sessionId);
            if (session) {
              this.activeSessions.set(sessionId, { ...session, status: "completed" });
            }
          });
          callbacks.onComplete();
        },
        (error) => {
          runInAction(() => {
            const session = this.activeSessions.get(sessionId);
            if (session) {
              this.activeSessions.set(sessionId, { ...session, status: "failed", error_message: error });
            }
          });
          callbacks.onError(error);
        },
        callbacks.signal
      );
    } catch (error) {
      console.error("Failed to stream agent session", error);
      throw error;
    }
  };

  cancelSession = async (workspaceSlug: string, sessionId: string): Promise<void> => {
    try {
      await this.agentService.cancelSession(workspaceSlug, sessionId);

      runInAction(() => {
        const session = this.activeSessions.get(sessionId);
        if (session) {
          this.activeSessions.set(sessionId, { ...session, status: "cancelled" });
        }
      });
    } catch (error) {
      console.error("Failed to cancel agent session", error);
      throw error;
    }
  };

  // --- Agent mode bar ---

  addProviderVariant = (providerVariantKey: string): void => {
    if (!this.selectedProviderVariants.includes(providerVariantKey)) {
      this.selectedProviderVariants = [...this.selectedProviderVariants, providerVariantKey];
    }
  };

  removeProviderVariant = (providerVariantKey: string): void => {
    this.selectedProviderVariants = this.selectedProviderVariants.filter((key) => key !== providerVariantKey);
  };

  setSelectedSkill = (trigger: string | null): void => {
    this.selectedSkillTrigger = trigger;
  };

  clearSelection = (): void => {
    this.selectedProviderVariants = [];
    this.selectedSkillTrigger = null;
  };
}
