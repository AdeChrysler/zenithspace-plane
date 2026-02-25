/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useForm, Controller } from "react-hook-form";
// plane imports
import { EIssueCommentAccessSpecifier } from "@plane/constants";
import type { EditorRefApi } from "@plane/editor";
import type { TIssueComment, TCommentsOperations } from "@plane/types";
import { cn, isCommentEmpty } from "@plane/utils";
// components
import { AgentModeBar, useAgentModeState } from "@/components/editor/agent-mode-bar";
import { LiteTextEditor } from "@/components/editor/lite-text";
// hooks
import { useAgent } from "@/hooks/store/use-agent";
import { useWorkspace } from "@/hooks/store/use-workspace";
// services
import { FileService } from "@/services/file.service";

export type TAgentSessionInfo = {
  sessionId: string;
  providerSlug: string;
  variantSlug: string;
  providerName: string;
};

type TCommentCreate = {
  entityId: string;
  workspaceSlug: string;
  activityOperations: TCommentsOperations;
  showToolbarInitially?: boolean;
  projectId?: string;
  onSubmitCallback?: (elementId: string) => void;
  onAgentSessionsCreated?: (sessions: TAgentSessionInfo[]) => void;
};

// services
const fileService = new FileService();

export const CommentCreate = observer(function CommentCreate(props: TCommentCreate) {
  const {
    workspaceSlug,
    entityId,
    activityOperations,
    showToolbarInitially = false,
    projectId,
    onSubmitCallback,
    onAgentSessionsCreated,
  } = props;
  // states
  const [uploadedAssetIds, setUploadedAssetIds] = useState<string[]>([]);
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  // store hooks
  const workspaceStore = useWorkspace();
  const agentStore = useAgent();
  // agent mode state
  const { hasAgentsSelected, selectedCount, selectedVariants, selectedSkillTrigger } = useAgentModeState();
  // derived values
  const workspaceId = workspaceStore.getWorkspaceBySlug(workspaceSlug)?.id as string;
  // form info
  const {
    handleSubmit,
    control,
    watch,
    formState: { isSubmitting },
    reset,
  } = useForm<Partial<TIssueComment>>({
    defaultValues: {
      comment_html: "<p></p>",
    },
  });

  const invokeSelectedAgents = async (commentText: string, commentId?: string) => {
    if (!projectId || selectedVariants.length === 0) return;

    const sessions: TAgentSessionInfo[] = [];

    for (const variantKey of selectedVariants) {
      const [providerSlug, variantSlug] = variantKey.split(":");
      if (!providerSlug || !variantSlug) continue;

      try {
        const session = await agentStore.invokeAgent(workspaceSlug, {
          provider_slug: providerSlug,
          variant_slug: variantSlug,
          skill_trigger: selectedSkillTrigger ?? undefined,
          project_id: projectId,
          issue_id: entityId,
          comment_text: commentText,
          comment_id: commentId,
        });

        // Build a display name from the variant key
        const displayName = variantKey
          .replace(":", " ")
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ");

        sessions.push({
          sessionId: session.id,
          providerSlug,
          variantSlug,
          providerName: displayName,
        });
      } catch (error) {
        console.error(`Failed to invoke agent ${variantKey}:`, error);
      }
    }

    if (sessions.length > 0) {
      onAgentSessionsCreated?.(sessions);
    }

    // Clear agent selection after invoking
    agentStore.clearSelection();
  };

  const onSubmit = async (formData: Partial<TIssueComment>) => {
    try {
      const comment = await activityOperations.createComment(formData);
      if (comment?.id) onSubmitCallback?.(comment.id);
      if (uploadedAssetIds.length > 0) {
        if (projectId) {
          await fileService.updateBulkProjectAssetsUploadStatus(workspaceSlug, projectId.toString(), entityId, {
            asset_ids: uploadedAssetIds,
          });
        } else {
          await fileService.updateBulkWorkspaceAssetsUploadStatus(workspaceSlug, entityId, {
            asset_ids: uploadedAssetIds,
          });
        }
        setUploadedAssetIds([]);
      }

      // If agents are selected, invoke them with the comment text
      if (hasAgentsSelected && formData.comment_html) {
        // Extract plain text from HTML for the agent
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = formData.comment_html;
        const plainText = tempDiv.textContent || tempDiv.innerText || "";
        await invokeSelectedAgents(plainText, comment?.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      reset({
        comment_html: "<p></p>",
      });
      editorRef.current?.clearEditor();
    }
  };

  const commentHTML = watch("comment_html");
  const isEmpty = isCommentEmpty(commentHTML ?? undefined);

  return (
    <div className="space-y-1">
      {/* Agent Mode Bar */}
      {projectId && (
        <AgentModeBar workspaceSlug={workspaceSlug} projectId={projectId} />
      )}

      {/* Comment Editor */}
      <div
        className={cn("sticky bottom-0 z-[4] bg-surface-1 sm:static")}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.ctrlKey &&
            !e.metaKey &&
            !isEmpty &&
            !isSubmitting &&
            editorRef.current?.isEditorReadyToDiscard()
          )
            handleSubmit(onSubmit)(e);
        }}
      >
        <Controller
          name="access"
          control={control}
          render={({ field: { onChange: onAccessChange, value: accessValue } }) => (
            <Controller
              name="comment_html"
              control={control}
              render={({ field: { value, onChange } }) => (
                <LiteTextEditor
                  editable
                  workspaceId={workspaceId}
                  id={"add_comment_" + entityId}
                  value={"<p></p>"}
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  onEnterKeyPress={(e) => {
                    if (!isEmpty && !isSubmitting) {
                      handleSubmit(onSubmit)(e);
                    }
                  }}
                  ref={editorRef}
                  initialValue={value ?? "<p></p>"}
                  containerClassName="min-h-min"
                  onChange={(comment_json, comment_html) => onChange(comment_html)}
                  accessSpecifier={accessValue ?? EIssueCommentAccessSpecifier.INTERNAL}
                  handleAccessChange={onAccessChange}
                  isSubmitting={isSubmitting}
                  uploadFile={async (blockId, file) => {
                    const { asset_id } = await activityOperations.uploadCommentAsset(blockId, file);
                    setUploadedAssetIds((prev) => [...prev, asset_id]);
                    return asset_id;
                  }}
                  duplicateFile={async (assetId: string) => {
                    const { asset_id } = await activityOperations.duplicateCommentAsset(assetId);
                    setUploadedAssetIds((prev) => [...prev, asset_id]);
                    return asset_id;
                  }}
                  showToolbarInitially={showToolbarInitially}
                  parentClassName="p-2"
                  displayConfig={{
                    fontSize: "small-font",
                  }}
                  submitButtonText={hasAgentsSelected ? `Send to ${selectedCount} agent${selectedCount > 1 ? "s" : ""}` : undefined}
                />
              )}
            />
          )}
        />
      </div>
    </div>
  );
});
