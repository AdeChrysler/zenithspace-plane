/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import type { TEstimatePointsObject, TEstimateSystemKeys, TEstimateTypeError } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useEstimate } from "@/hooks/store/estimates/use-estimate";
// components
import { EstimatePointCreateRoot } from "@/components/estimates/points";

type TUpdateEstimateModal = {
  workspaceSlug: string;
  projectId: string;
  estimateId: string | undefined;
  isOpen: boolean;
  handleClose: () => void;
};

export const UpdateEstimateModal = observer(function UpdateEstimateModal(props: TUpdateEstimateModal) {
  // props
  const { workspaceSlug, projectId, estimateId, isOpen, handleClose } = props;
  // hooks
  const { asJson: estimate, estimatePointIds, estimatePointById } = useEstimate(estimateId);
  const { t } = useTranslation();
  // states
  const [estimatePoints, setEstimatePoints] = useState<TEstimatePointsObject[] | undefined>(undefined);
  const [estimatePointError, setEstimatePointError] = useState<TEstimateTypeError>(undefined);

  // Build local estimate points state from the store whenever the modal opens or the estimate data changes
  useEffect(() => {
    if (isOpen && estimatePointIds && estimatePointIds.length > 0) {
      const points: TEstimatePointsObject[] = estimatePointIds
        .map((pointId) => {
          const point = estimatePointById(pointId);
          if (point) {
            return {
              id: point.id ?? undefined,
              key: point.key ?? 0,
              value: point.value ?? "",
            };
          }
          return undefined;
        })
        .filter((p): p is TEstimatePointsObject => p !== undefined);
      setEstimatePoints(points);
      setEstimatePointError(undefined);
    }
  }, [isOpen, estimatePointIds, estimatePointById]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEstimatePoints(undefined);
      setEstimatePointError(undefined);
    }
  }, [isOpen]);

  const handleEstimatePointError = useCallback(
    (key: number, oldValue: string, newValue: string, message: string | undefined, mode: "add" | "delete" = "add") => {
      setEstimatePointError((prev: TEstimateTypeError) => {
        if (mode === "add") {
          return { ...prev, [key]: { oldValue, newValue, message } };
        } else {
          const newError = { ...prev };
          delete newError[key];
          return newError;
        }
      });
    },
    []
  );

  const handleModalClose = () => {
    handleClose();
  };

  if (!estimateId) return null;

  const estimateType = estimate?.type as TEstimateSystemKeys | undefined;

  return (
    <ModalCore isOpen={isOpen} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <div className="relative space-y-6 py-5">
        {/* heading */}
        <div className="relative flex justify-between items-center gap-2 px-5">
          <div className="text-18 font-medium text-primary">
            {estimate?.name ? `Edit ${estimate.name}` : "Edit Estimate"}
          </div>
        </div>

        {/* estimate points editor */}
        <div className="px-5">
          {estimatePoints && estimateType && (
            <EstimatePointCreateRoot
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              estimateId={estimateId}
              estimateType={estimateType}
              estimatePoints={estimatePoints}
              setEstimatePoints={setEstimatePoints}
              estimatePointError={estimatePointError}
              handleEstimatePointError={handleEstimatePointError}
            />
          )}
        </div>

        <div className="relative flex justify-end items-center gap-3 px-5 pt-5 border-t border-subtle">
          <Button variant="secondary" size="lg" onClick={handleModalClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
