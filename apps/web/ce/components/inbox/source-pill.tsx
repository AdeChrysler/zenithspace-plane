/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Globe, Mail, FileText } from "lucide-react";
import { EInboxIssueSource } from "@plane/types";
import { cn } from "@plane/utils";

export type TInboxSourcePill = {
  source: EInboxIssueSource;
};

const SOURCE_CONFIG: Record<EInboxIssueSource, { label: string; icon: typeof Globe; className: string }> = {
  [EInboxIssueSource.IN_APP]: {
    label: "In-App",
    icon: Globe,
    className: "text-blue-600 bg-blue-500/10",
  },
  [EInboxIssueSource.FORMS]: {
    label: "Form",
    icon: FileText,
    className: "text-purple-600 bg-purple-500/10",
  },
  [EInboxIssueSource.EMAIL]: {
    label: "Email",
    icon: Mail,
    className: "text-green-600 bg-green-500/10",
  },
};

export function InboxSourcePill(props: TInboxSourcePill) {
  const { source } = props;
  const config = SOURCE_CONFIG[source];

  if (!config) return <></>;

  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", config.className)}>
      <Icon className="size-3 flex-shrink-0" />
      <span>{config.label}</span>
    </div>
  );
}
