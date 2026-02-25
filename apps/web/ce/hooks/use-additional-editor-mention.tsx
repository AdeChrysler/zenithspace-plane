/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Bot } from "lucide-react";
import { useCallback, useContext, useMemo } from "react";
// plane editor
import type { TMentionSection, TMentionSuggestion } from "@plane/editor";
// plane types
import type { TSearchEntities, TSearchResponse } from "@plane/types";
// store types
import type { TAgentProvider } from "@/store/agent.store";
// store context
import { StoreContext } from "@/lib/store-context";

export type TUseAdditionalEditorMentionArgs = {
  enableAdvancedMentions: boolean;
};

export type TAdditionalEditorMentionHandlerArgs = {
  response: TSearchResponse;
};

export type TAdditionalEditorMentionHandlerReturnType = {
  sections: TMentionSection[];
};

export type TAdditionalParseEditorContentArgs = {
  id: string;
  entityType: TSearchEntities;
};

export type TAdditionalParseEditorContentReturnType =
  | {
      redirectionPath: string;
      textContent: string;
    }
  | undefined;

/**
 * Build mention sections from agent providers, grouped by provider_group.
 * Each enabled variant of each enabled provider becomes a mention item.
 */
function buildAgentMentionSections(providers: TAgentProvider[]): TMentionSection[] {
  // Group variants by provider_group
  const groupedItems: Record<string, TMentionSuggestion[]> = {};

  for (const provider of providers) {
    if (!provider.is_enabled) continue;
    const group = provider.provider_group || "AI Agent";

    if (!groupedItems[group]) {
      groupedItems[group] = [];
    }

    for (const variant of provider.variants) {
      if (!variant.is_enabled) continue;
      groupedItems[group].push({
        id: `${provider.slug}-${variant.slug}`,
        entity_identifier: `${provider.slug}-${variant.slug}`,
        entity_name: "agent_mention" as const,
        title: variant.display_name,
        subTitle: provider.provider_group,
        icon: <Bot className="size-4 text-primary" />,
      });
    }
  }

  // Convert grouped items into sections
  return Object.entries(groupedItems).map(([group, items]) => ({
    key: group.toLowerCase().replace(/\s+/g, "-"),
    title: group,
    items,
  }));
}

export const useAdditionalEditorMention = (_args: TUseAdditionalEditorMentionArgs) => {
  // Access agent providers from the MobX store
  const context = useContext(StoreContext);
  const enabledProviders = context.agent.enabledProviders;

  const updateAdditionalSections = useCallback(
    (_args: TAdditionalEditorMentionHandlerArgs): TAdditionalEditorMentionHandlerReturnType => {
      // If providers are loaded, build dynamic sections; otherwise fall back to a default agent entry
      if (enabledProviders.length > 0) {
        const sections = buildAgentMentionSections(enabledProviders);
        return { sections };
      }

      // Fallback: show a single generic agent mention while providers are loading
      const fallbackSection: TMentionSection = {
        key: "ai-agent",
        title: "AI Agent",
        items: [
          {
            id: "claude-code-sonnet",
            entity_identifier: "claude-code-sonnet",
            entity_name: "agent_mention" as const,
            title: "Claude Sonnet",
            subTitle: "Anthropic",
            icon: <Bot className="size-4 text-primary" />,
          },
        ],
      };
      return { sections: [fallbackSection] };
    },
    [enabledProviders]
  );

  const parseAdditionalEditorContent = useCallback(
    (args: TAdditionalParseEditorContentArgs): TAdditionalParseEditorContentReturnType => {
      // agent_mention entities don't have a redirection path
      if (args.entityType === "agent_mention") {
        return undefined;
      }
      return undefined;
    },
    []
  );

  const editorMentionTypes: TSearchEntities[] = useMemo(
    () => ["user_mention", "agent_mention", "issue", "project", "cycle", "module", "page"],
    []
  );

  return {
    updateAdditionalSections,
    parseAdditionalEditorContent,
    editorMentionTypes,
  };
};
