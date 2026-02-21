/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";

type Props = {
  isEpic?: boolean;
};

const BLOCK_HEIGHT = 44;
const BLOCK_VISUAL_HEIGHT = 32;

/**
 * Renders SVG dependency paths between Gantt chart blocks
 * that have blocking/blocked_by relations.
 */
export const TimelineDependencyPaths = observer(function TimelineDependencyPaths(props: Props) {
  const { isEpic = false } = props;
  const { relation } = useIssueDetail();
  const { blockIds, getBlockById, isDependencyEnabled } = useTimeLineChartStore();

  if (!isDependencyEnabled || !blockIds || blockIds.length === 0) return <></>;

  const paths: { key: string; d: string }[] = [];

  for (const sourceBlockId of blockIds) {
    const sourceBlock = getBlockById(sourceBlockId);
    if (!sourceBlock?.position) continue;

    // Get blocking relations for this issue
    const blockingIds = relation.getRelationByIssueIdRelationType(sourceBlockId, "blocking");
    if (!blockingIds || blockingIds.length === 0) continue;

    const sourceIndex = blockIds.indexOf(sourceBlockId);
    const sourceX = sourceBlock.position.marginLeft + sourceBlock.position.width;
    const sourceY = sourceIndex * BLOCK_HEIGHT + BLOCK_VISUAL_HEIGHT / 2;

    for (const targetBlockId of blockingIds) {
      const targetBlock = getBlockById(targetBlockId);
      if (!targetBlock?.position) continue;

      const targetIndex = blockIds.indexOf(targetBlockId);
      if (targetIndex < 0) continue;

      const targetX = targetBlock.position.marginLeft;
      const targetY = targetIndex * BLOCK_HEIGHT + BLOCK_VISUAL_HEIGHT / 2;

      // Create a smooth bezier curve path from source right edge to target left edge
      const midX = (sourceX + targetX) / 2;
      const d = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;

      paths.push({
        key: `${sourceBlockId}-${targetBlockId}`,
        d,
      });
    }
  }

  if (paths.length === 0) return <></>;

  return (
    <svg className="absolute top-0 left-0 size-full pointer-events-none z-[3]" style={{ overflow: "visible" }}>
      <defs>
        <marker id="dep-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(var(--color-primary-100))" />
        </marker>
      </defs>
      {paths.map((path) => (
        <path
          key={path.key}
          d={path.d}
          fill="none"
          stroke="rgb(var(--color-primary-100))"
          strokeWidth={1.5}
          markerEnd="url(#dep-arrow)"
          opacity={0.6}
        />
      ))}
    </svg>
  );
});
