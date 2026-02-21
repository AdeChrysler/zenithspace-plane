/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Bot } from "lucide-react";

type TAgentActivityCardProps = {
  content: string;
  timestamp?: string;
};

export function AgentActivityCard(props: TAgentActivityCardProps) {
  const { content, timestamp } = props;

  return (
    <div className="my-2 rounded-lg border border-primary/10 bg-primary/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/5">
        <div className="flex items-center justify-center size-5 rounded bg-primary/10">
          <Bot className="size-3 text-primary" />
        </div>
        <span className="text-xs font-medium text-primary">ZenithAgent</span>
        {timestamp && <span className="text-xs text-tertiary ml-auto">{timestamp}</span>}
      </div>
      <div className="px-3 py-2.5 text-sm text-primary whitespace-pre-wrap">{content}</div>
    </div>
  );
}
