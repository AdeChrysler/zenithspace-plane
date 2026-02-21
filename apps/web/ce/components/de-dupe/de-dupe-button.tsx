/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Layers } from "lucide-react";
import { cn } from "@plane/utils";

type TDeDupeButtonRoot = {
  workspaceSlug: string;
  isDuplicateModalOpen: boolean;
  handleOnClick: () => void;
  label: string;
};

export function DeDupeButtonRoot(props: TDeDupeButtonRoot) {
  const { workspaceSlug, isDuplicateModalOpen, label, handleOnClick } = props;

  if (!workspaceSlug) return <></>;

  return (
    <button
      type="button"
      onClick={handleOnClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
        "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
        isDuplicateModalOpen && "bg-amber-500/20"
      )}
    >
      <Layers className="h-3 w-3 flex-shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
