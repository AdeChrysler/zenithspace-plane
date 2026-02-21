/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { Layers } from "lucide-react";

type TDeDupeIssueButtonLabelProps = {
  isOpen: boolean;
  buttonLabel: string;
};

export function DeDupeIssueButtonLabel(props: TDeDupeIssueButtonLabelProps) {
  const { buttonLabel } = props;
  return (
    <span className="flex items-center gap-1.5">
      <Layers className="h-3 w-3 flex-shrink-0" />
      <span className="whitespace-nowrap">{buttonLabel}</span>
    </span>
  );
}
