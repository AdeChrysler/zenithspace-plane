/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { setPromiseToast } from "@plane/propel/toast";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";

type TDuplicateWorkItemModalProps = {
  workItemId: string;
  onClose: () => void;
  isOpen: boolean;
  workspaceSlug: string;
  projectId: string;
};

export const DuplicateWorkItemModal = observer(function DuplicateWorkItemModal(props: TDuplicateWorkItemModalProps) {
  const { workItemId, onClose, isOpen, workspaceSlug, projectId } = props;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();
  const { issue: issueStore } = useIssueDetail();
  const { issues: projectIssues } = useIssues();
  const { getProjectById } = useProject();

  const issue = issueStore.getIssueById(workItemId);
  const project = getProjectById(projectId);

  const handleDuplicate = async () => {
    if (!issue) return;

    setIsSubmitting(true);
    try {
      const duplicateData = {
        name: `${issue.name} (copy)`,
        description_html: issue.description_html,
        priority: issue.priority,
        state_id: issue.state_id,
        label_ids: issue.label_ids,
        assignee_ids: issue.assignee_ids,
        start_date: issue.start_date,
        target_date: issue.target_date,
        estimate_point: issue.estimate_point,
      };

      const createPromise = projectIssues.createIssue(workspaceSlug, projectId, duplicateData);
      setPromiseToast(createPromise, {
        loading: "Duplicating work item...",
        success: { title: "Success!", message: () => "Work item duplicated successfully." },
        error: { title: "Error!", message: () => "Failed to duplicate work item." },
      });
      await createPromise;
      onClose();
    } catch (error) {
      console.error("Failed to duplicate work item:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!issue) return null;

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="p-5">
        <h3 className="text-lg font-medium text-primary">Duplicate work item</h3>
        <p className="mt-2 text-sm text-secondary">
          This will create a copy of <span className="font-medium">{project?.identifier}-{issue.sequence_id}</span>{" "}
          <span className="font-medium">{issue.name}</span> with the same properties.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="neutral-primary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleDuplicate} loading={isSubmitting}>
            {isSubmitting ? "Duplicating..." : "Duplicate"}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
