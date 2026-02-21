/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Bot } from "lucide-react";
import { useCallback, useMemo } from "react";
// plane editor
import type { TMentionSection } from "@plane/editor";
// plane types
import type { TSearchEntities, TSearchResponse } from "@plane/types";

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

export const useAdditionalEditorMention = (_args: TUseAdditionalEditorMentionArgs) => {
  const updateAdditionalSections = useCallback(
    (_args: TAdditionalEditorMentionHandlerArgs): TAdditionalEditorMentionHandlerReturnType => {
      const agentSection: TMentionSection = {
        key: "ai-agent",
        title: "AI Agent",
        items: [
          {
            id: "zenith-agent",
            entity_identifier: "zenith-agent",
            entity_name: "user_mention",
            title: "ZenithAgent",
            subTitle: "AI-powered assistant",
            icon: <Bot className="size-4 text-primary" />,
          },
        ],
      };
      return { sections: [agentSection] };
    },
    []
  );

  const parseAdditionalEditorContent = useCallback(
    (_args: TAdditionalParseEditorContentArgs): TAdditionalParseEditorContentReturnType => undefined,
    []
  );

  const editorMentionTypes: TSearchEntities[] = useMemo(
    () => ["user_mention", "issue", "project", "cycle", "module", "page"],
    []
  );

  return {
    updateAdditionalSections,
    parseAdditionalEditorContent,
    editorMentionTypes,
  };
};
