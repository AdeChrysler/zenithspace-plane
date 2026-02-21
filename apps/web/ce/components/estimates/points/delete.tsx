/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FC } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { EEstimateSystem } from "@plane/constants";
import { TrashIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TEstimatePointsObject, TEstimateSystemKeys, TEstimateTypeErrorObject } from "@plane/types";
import { CustomSelect, Spinner } from "@plane/ui";
import { convertMinutesToHoursMinutesString } from "@plane/utils";
// services
import estimateService from "@/services/estimate.service";

export type TEstimatePointDelete = {
  workspaceSlug: string;
  projectId: string;
  estimateId: string;
  estimatePointId: string;
  estimatePoints: TEstimatePointsObject[];
  callback: () => void;
  estimatePointError?: TEstimateTypeErrorObject | undefined;
  handleEstimatePointError?: (newValue: string, message: string | undefined, mode?: "add" | "delete") => void;
  estimateSystem: TEstimateSystemKeys;
};

export const EstimatePointDelete: FC<TEstimatePointDelete> = observer(function EstimatePointDelete(props) {
  const {
    workspaceSlug,
    projectId,
    estimateId,
    estimatePointId,
    estimatePoints,
    callback,
    estimatePointError,
    handleEstimatePointError,
    estimateSystem,
  } = props;
  // states
  const [loader, setLoader] = useState(false);
  const [replacementEstimatePointId, setReplacementEstimatePointId] = useState<string | undefined>(undefined);

  // filter out the current estimate point from the list of available replacement points
  const availableEstimatePoints = estimatePoints.filter((point) => point.id !== estimatePointId);

  const formatEstimateValue = (value: string | undefined): string => {
    if (!value) return "";
    if (estimateSystem === EEstimateSystem.TIME) {
      return convertMinutesToHoursMinutesString(Number(value));
    }
    return value;
  };

  const currentEstimatePoint = estimatePoints.find((point) => point.id === estimatePointId);

  const handleDelete = async () => {
    if (!workspaceSlug || !projectId || !estimateId || !estimatePointId) return;

    setLoader(true);
    try {
      await estimateService.deleteEstimatePoint(
        workspaceSlug,
        projectId,
        estimateId,
        estimatePointId,
        replacementEstimatePointId
      );

      setLoader(false);
      if (handleEstimatePointError) handleEstimatePointError("", undefined, "delete");
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Estimate point deleted",
        message: "The estimate point has been deleted successfully.",
      });
      callback();
    } catch {
      setLoader(false);
      if (handleEstimatePointError)
        handleEstimatePointError("", "Failed to delete the estimate point. Please try again.");
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Estimate point deletion failed",
        message: "We were unable to delete the estimate point, please try again.",
      });
    }
  };

  const handleCancel = () => {
    if (handleEstimatePointError) handleEstimatePointError("", undefined, "delete");
    callback();
  };

  return (
    <div className="relative border border-danger-strong rounded-sm my-1">
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2 text-13 text-secondary">
          <TrashIcon width={14} height={14} className="text-danger-primary" />
          <span>
            Delete estimate point{" "}
            <span className="font-medium text-primary">
              {formatEstimateValue(currentEstimatePoint?.value)}
            </span>
          </span>
        </div>

        {availableEstimatePoints.length > 0 && (
          <div className="space-y-2">
            <p className="text-13 text-secondary">
              Reassign existing work items using this estimate to:
            </p>
            <CustomSelect
              value={replacementEstimatePointId}
              label={
                <span className="text-13">
                  {replacementEstimatePointId
                    ? formatEstimateValue(
                        availableEstimatePoints.find((p) => p.id === replacementEstimatePointId)?.value
                      )
                    : "No replacement (remove estimate from work items)"}
                </span>
              }
              onChange={(value: string) => setReplacementEstimatePointId(value)}
              buttonClassName="border-subtle bg-surface-1 rounded-sm w-full text-13"
              maxHeight="md"
            >
              <CustomSelect.Option key="none" value={undefined}>
                No replacement (remove estimate from work items)
              </CustomSelect.Option>
              {availableEstimatePoints.map((point) => (
                <CustomSelect.Option key={point.id} value={point.id}>
                  {formatEstimateValue(point.value)}
                </CustomSelect.Option>
              ))}
            </CustomSelect>
          </div>
        )}

        {estimatePointError?.message && (
          <p className="text-12 text-danger-primary">{estimatePointError.message}</p>
        )}
      </div>

      <div className="flex justify-end items-center gap-2 px-3 py-2 border-t border-subtle">
        <button
          type="button"
          className="px-3 py-1.5 text-13 rounded-sm border border-subtle hover:bg-layer-1 transition-colors cursor-pointer"
          onClick={handleCancel}
          disabled={loader}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-3 py-1.5 text-13 rounded-sm bg-danger-primary text-white hover:bg-danger-primary/90 transition-colors cursor-pointer flex items-center gap-1.5"
          onClick={handleDelete}
          disabled={loader}
        >
          {loader && <Spinner className="w-3 h-3" />}
          {loader ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
});
