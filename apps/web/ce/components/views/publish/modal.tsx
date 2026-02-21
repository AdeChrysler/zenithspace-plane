/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Globe } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IProjectView } from "@plane/types";
import { Loader, ToggleSwitch, ModalCore, EModalWidth } from "@plane/ui";
import { copyTextToClipboard } from "@plane/utils";
import { ViewService } from "@/services/view.service";

type Props = {
  isOpen: boolean;
  view: IProjectView;
  onClose: () => void;
};

type TPublishViewSettings = {
  is_comments_enabled: boolean;
  is_reactions_enabled: boolean;
  is_votes_enabled: boolean;
};

type TPublishViewDetails = TPublishViewSettings & {
  id: string;
  anchor: string;
};

const defaultValues: TPublishViewSettings = {
  is_comments_enabled: false,
  is_reactions_enabled: false,
  is_votes_enabled: false,
};

const viewService = new ViewService();

export const PublishViewModal = observer(function PublishViewModal(props: Props) {
  const { isOpen, view, onClose } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [publishSettings, setPublishSettings] = useState<TPublishViewDetails | undefined>(undefined);
  const { workspaceSlug, projectId } = useParams();
  const isPublished = !!publishSettings?.anchor;

  const {
    control,
    formState: { isDirty, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<TPublishViewSettings>({ defaultValues });

  const handleClose = () => onClose();

  const handleFormSubmit = async (formData: TPublishViewSettings) => {
    if (!workspaceSlug || !projectId) return;
    try {
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: isPublished ? "Publish settings updated." : "View published successfully.",
      });
      handleClose();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Something went wrong.",
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} width={EModalWidth.XXL}>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="flex items-center justify-between gap-2 p-5">
          <h5 className="text-lg font-medium text-secondary">Publish view</h5>
        </div>

        {isLoading ? (
          <Loader className="space-y-4 px-5">
            <Loader.Item height="30px" />
            <Loader.Item height="30px" />
          </Loader>
        ) : (
          <div className="px-5 space-y-4">
            <div className="space-y-4">
              <div className="relative flex items-center justify-between gap-2">
                <div className="text-sm">Allow comments</div>
                <Controller
                  control={control}
                  name="is_comments_enabled"
                  render={({ field: { onChange, value } }) => (
                    <ToggleSwitch value={!!value} onChange={onChange} size="sm" />
                  )}
                />
              </div>
              <div className="relative flex items-center justify-between gap-2">
                <div className="text-sm">Allow reactions</div>
                <Controller
                  control={control}
                  name="is_reactions_enabled"
                  render={({ field: { onChange, value } }) => (
                    <ToggleSwitch value={!!value} onChange={onChange} size="sm" />
                  )}
                />
              </div>
              <div className="relative flex items-center justify-between gap-2">
                <div className="text-sm">Allow voting</div>
                <Controller
                  control={control}
                  name="is_votes_enabled"
                  render={({ field: { onChange, value } }) => (
                    <ToggleSwitch value={!!value} onChange={onChange} size="sm" />
                  )}
                />
              </div>
            </div>
          </div>
        )}

        <div className="relative flex items-center justify-between border-t border-subtle px-5 py-4 mt-4">
          <div className="flex items-center gap-1 text-sm text-placeholder">
            <Globe className="size-3.5" />
            <div className="text-sm">Anyone with the link can access</div>
          </div>
          <div className="relative flex items-center gap-2">
            <Button variant="secondary" size="lg" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" size="lg" type="submit" loading={isSubmitting}>
              {isSubmitting ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>
      </form>
    </ModalCore>
  );
});
