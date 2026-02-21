/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { RefObject } from "react";
import { CircleDot } from "lucide-react";
import type { IGanttBlock } from "@plane/types";

type RightDependencyDraggableProps = {
  block: IGanttBlock;
  ganttContainerRef: RefObject<HTMLDivElement>;
};

export function RightDependencyDraggable(_props: RightDependencyDraggableProps) {
  return (
    <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair">
      <CircleDot className="size-3.5 text-primary" />
    </div>
  );
}
