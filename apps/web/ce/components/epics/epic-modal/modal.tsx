/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TIssue } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// components
import { IssueFormRoot } from "@/components/issues/issue-modal/form";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useIssuesActions } from "@/hooks/use-issues-actions";
// plane web
import { IssueModalProvider } from "@/plane-web/components/issues/issue-modal/provider";

export interface EpicModalProps {
  data?: Partial<TIssue>;
  isOpen: boolean;
  onClose: () => void;
  beforeFormSubmit?: () => Promise<void>;
  onSubmit?: (res: TIssue) => Promise<void>;
  fetchIssueDetails?: boolean;
  primaryButtonText?: {
    default: string;
    loading: string;
  };
  isProjectSelectionDisabled?: boolean;
}

export const CreateUpdateEpicModal = observer(function CreateUpdateEpicModal(props: EpicModalProps) {
  const {
    data,
    isOpen,
    onClose,
    beforeFormSubmit,
    onSubmit,
    fetchIssueDetails = true,
    primaryButtonText,
    isProjectSelectionDisabled = false,
  } = props;

  // ref
  const issueTitleRef = useRef<HTMLInputElement>(null);
  // states
  const [createMore, setCreateMore] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [uploadedAssetIds, setUploadedAssetIds] = useState<string[]>([]);

  // store hooks
  const { t } = useTranslation();
  const { workspaceSlug, projectId: routerProjectId } = useParams();
  const { issues } = useIssues(EIssuesStoreType.EPIC);
  const { fetchIssue } = useIssueDetail();
  const { getProjectByIdentifier } = useProject();
  const { createIssue, updateIssue } = useIssuesActions(EIssuesStoreType.EPIC);

  // derived values
  const projectId = data?.project_id ?? routerProjectId?.toString();

  const fetchIssueDetail = async (issueId: string | undefined) => {
    setDescription(undefined);
    if (!workspaceSlug) return;

    if (!projectId || issueId === undefined || !fetchIssueDetails) {
      setDescription(data?.description_html || "<p></p>");
      return;
    }
    const response = await fetchIssue(workspaceSlug.toString(), projectId.toString(), issueId);
    if (response) setDescription(response?.description_html || "<p></p>");
  };

  useEffect(() => {
    if (isOpen) fetchIssueDetail(data?.id);

    if (!isOpen) {
      setActiveProjectId(null);
      return;
    }

    if (data && data.project_id) {
      setActiveProjectId(data.project_id);
      return;
    }

    if (projectId && !activeProjectId) setActiveProjectId(projectId.toString());

    return () => setDescription(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.project_id, data?.id, projectId, isOpen, activeProjectId]);

  const handleClose = () => {
    setActiveProjectId(null);
    onClose();
  };

  const handleCreateEpic = async (payload: Partial<TIssue>): Promise<TIssue | undefined> => {
    if (!workspaceSlug || !payload.project_id) return;

    try {
      let response: TIssue | undefined;
      if (createIssue) {
        response = await createIssue(payload.project_id, payload);
      }

      if (!response) throw new Error();

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("success"),
        message: "Epic created successfully",
      });
      if (!createMore) handleClose();
      if (createMore && issueTitleRef) issueTitleRef?.current?.focus();
      setDescription("<p></p>");
      return response;
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("error"),
        message: error?.error ?? "Epic creation failed",
      });
      throw error;
    }
  };

  const handleUpdateEpic = async (payload: Partial<TIssue>): Promise<TIssue | undefined> => {
    if (!workspaceSlug || !payload.project_id || !data?.id) return;

    try {
      if (updateIssue) await updateIssue(payload.project_id, data.id, payload);

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("success"),
        message: "Epic updated successfully",
      });
      handleClose();
    } catch (error: any) {
      console.error(error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("error"),
        message: error?.error ?? "Epic could not be updated",
      });
    }
  };

  const handleFormSubmit = async (payload: Partial<TIssue>) => {
    if (!workspaceSlug || !payload.project_id) return;

    let response: TIssue | undefined = undefined;

    try {
      if (beforeFormSubmit) await beforeFormSubmit();
      if (!data?.id) response = await handleCreateEpic(payload);
      else response = await handleUpdateEpic(payload);
    } finally {
      if (response !== undefined && onSubmit) await onSubmit(response);
    }
  };

  if (!isOpen || !activeProjectId) return null;

  return (
    <IssueModalProvider>
      <ModalCore
        isOpen={isOpen}
        position={EModalPosition.TOP}
        width={EModalWidth.XXXXL}
        className="!bg-transparent rounded-lg shadow-none transition-[width] ease-linear"
      >
        <IssueFormRoot
          data={{
            ...data,
            description_html: description,
          }}
          issueTitleRef={issueTitleRef}
          onAssetUpload={(assetId) => setUploadedAssetIds((prev) => [...prev, assetId])}
          onClose={handleClose}
          onSubmit={handleFormSubmit}
          projectId={activeProjectId}
          isCreateMoreToggleEnabled={createMore}
          onCreateMoreToggleChange={setCreateMore}
          isDraft={false}
          modalTitle={data?.id ? "Update epic" : "Create epic"}
          primaryButtonText={
            primaryButtonText ?? {
              default: data?.id ? t("update") : t("save"),
              loading: data?.id ? t("updating") : t("saving"),
            }
          }
          isDuplicateModalOpen={false}
          handleDuplicateIssueModal={() => {}}
          isProjectSelectionDisabled={isProjectSelectionDisabled}
        />
      </ModalCore>
    </IssueModalProvider>
  );
});
