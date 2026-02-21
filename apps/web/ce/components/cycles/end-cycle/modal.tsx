/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { AlertCircle } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EIssuesStoreType } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssues } from "@/hooks/store/use-issues";

interface Props {
  isOpen: boolean;
  handleClose: () => void;
  cycleId: string;
  projectId: string;
  workspaceSlug: string;
  transferrableIssuesCount: number;
  cycleName: string;
}

export const EndCycleModal = observer(function EndCycleModal(props: Props) {
  const { isOpen, handleClose, cycleId, projectId, workspaceSlug, transferrableIssuesCount, cycleName } = props;
  const [query, setQuery] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  const { currentProjectIncompleteCycleIds, getCycleById, fetchActiveCycleProgress } = useCycle();
  const {
    issues: { transferIssuesFromCycle },
  } = useIssues(EIssuesStoreType.CYCLE);

  const transferIssue = async (payload: { new_cycle_id: string }) => {
    if (!workspaceSlug || !projectId || !cycleId) return;

    setIsTransferring(true);
    await transferIssuesFromCycle(workspaceSlug, projectId, cycleId, payload)
      .then(async () => {
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Success!",
          message: "Work items have been transferred successfully.",
        });
        await refreshCycleDetails(payload.new_cycle_id);
      })
      .catch(() => {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Error!",
          message: "Unable to transfer work items. Please try again.",
        });
      })
      .finally(() => {
        setIsTransferring(false);
        handleClose();
      });
  };

  const refreshCycleDetails = async (newCycleId: string) => {
    const cyclesFetch = [
      fetchActiveCycleProgress(workspaceSlug, projectId, cycleId),
      fetchActiveCycleProgress(workspaceSlug, projectId, newCycleId),
    ];
    await Promise.all(cyclesFetch).catch((error) => {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: error.error || "Unable to fetch cycle details.",
      });
    });
  };

  const filteredOptions = currentProjectIncompleteCycleIds?.filter((optionId) => {
    const cycleDetails = getCycleById(optionId);
    return cycleDetails?.name?.toLowerCase().includes(query?.toLowerCase());
  });

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <div className="flex flex-col gap-4 py-5">
        <div className="flex items-center justify-between px-5">
          <h4 className="text-lg font-medium text-primary">Transfer work items</h4>
          <button onClick={handleClose} className="text-secondary hover:text-primary">
            &times;
          </button>
        </div>

        <div className="px-5 text-sm text-secondary">
          <span>
            Cycle <span className="font-medium text-primary">{cycleName}</span> has{" "}
            <span className="font-medium text-primary">{transferrableIssuesCount}</span> incomplete work{" "}
            {transferrableIssuesCount === 1 ? "item" : "items"}. Select a cycle to transfer them to.
          </span>
        </div>

        <div className="flex items-center gap-2 border-b border-subtle px-5 pb-3">
          <input
            className="w-full outline-none text-sm bg-transparent"
            placeholder="Search for a cycle..."
            onChange={(e) => setQuery(e.target.value)}
            value={query}
          />
        </div>

        <div className="flex w-full flex-col items-start gap-2 px-5">
          {isTransferring ? (
            <p className="w-full text-center text-secondary text-sm">Transferring work items...</p>
          ) : filteredOptions ? (
            filteredOptions.length > 0 ? (
              filteredOptions.map((optionId) => {
                const cycleDetails = getCycleById(optionId);
                if (!cycleDetails) return null;

                return (
                  <button
                    key={optionId}
                    className="flex w-full items-center gap-4 rounded-sm px-4 py-3 text-sm text-secondary hover:bg-surface-2"
                    onClick={() => transferIssue({ new_cycle_id: optionId })}
                  >
                    <div className="flex w-full justify-between truncate">
                      <span className="truncate">{cycleDetails?.name}</span>
                      {cycleDetails.status && (
                        <span className="flex-shrink-0 flex items-center rounded-full bg-layer-1 px-2 capitalize text-xs">
                          {cycleDetails.status.toLocaleLowerCase()}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex w-full items-center justify-center gap-4 p-5 text-sm">
                <AlertCircle className="h-3.5 w-3.5 text-secondary" />
                <span className="text-center text-secondary">
                  You don&apos;t have any current cycle. Please create one to transfer the work items.
                </span>
              </div>
            )
          ) : (
            <p className="text-center text-secondary">Loading...</p>
          )}
        </div>
      </div>
    </ModalCore>
  );
});
