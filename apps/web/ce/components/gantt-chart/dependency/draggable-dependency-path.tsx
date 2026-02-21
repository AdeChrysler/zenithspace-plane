/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Renders a draggable dependency path being actively drawn by the user.
 * This is the in-progress path shown while dragging from one block to another.
 * Full drag-to-create implementation requires mouse tracking and would be wired here.
 */
export function TimelineDraggablePath() {
  // The draggable path is rendered during active mouse drag operations
  // between dependency connection points on gantt blocks.
  // Currently rendered as empty - drag interaction to be wired with
  // mouse event handlers on the gantt container.
  return <></>;
}
