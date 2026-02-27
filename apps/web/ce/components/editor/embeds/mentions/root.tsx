/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TCallbackMentionComponentProps } from "@plane/editor";

export type TEditorMentionComponentProps = TCallbackMentionComponentProps;

export function EditorAdditionalMentionsRoot(props: TEditorMentionComponentProps) {
  const { entity_identifier, entity_name } = props;

  if (entity_name === "agent_mention") {
    // Derive display name from entity_identifier (e.g., "claude-sonnet" -> "Claude Sonnet")
    const displayName = (entity_identifier || "AI Agent")
      .split("-")
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    return (
      <span className="not-prose inline px-1 py-0.5 rounded-sm bg-primary/10 text-primary font-medium no-underline">
        @{displayName}
      </span>
    );
  }

  return null;
}
