/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssue } from "@plane/types";

// Transfer hop info - shows when an issue was transferred between projects/cycles.
// Currently a placeholder as the backend does not track transfer history yet.
export function TransferHopInfo({ workItem: _workItem }: { workItem: TIssue }) {
  return <></>;
}
