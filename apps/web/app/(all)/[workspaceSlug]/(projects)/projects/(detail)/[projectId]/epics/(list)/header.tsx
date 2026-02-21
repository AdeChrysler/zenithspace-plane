/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { WorkItemsIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { EIssuesStoreType } from "@plane/types";
import { Breadcrumbs, Header } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { CountChip } from "@/components/common/count-chip";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { usePlatformOS } from "@/hooks/use-platform-os";
// plane web imports
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs/common";
import { CreateUpdateEpicModal } from "@/plane-web/components/epics/epic-modal";

export const EpicsHeader = observer(function EpicsHeader() {
  // states
  const [isCreateEpicOpen, setIsCreateEpicOpen] = useState(false);
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const {
    issues: { getGroupIssueCount },
  } = useIssues(EIssuesStoreType.EPIC);
  const { t } = useTranslation();
  const { currentProjectDetails, loader } = useProject();
  const { allowPermissions } = useUserPermissions();
  const { isMobile } = usePlatformOS();

  const epicsCount = getGroupIssueCount(undefined, undefined, false);
  const canUserCreateEpic = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  return (
    <>
      <Header>
        <Header.LeftItem>
          <div className="flex items-center gap-2.5">
            <Breadcrumbs onBack={() => router.back()} isLoading={loader === "init-loader"} className="flex-grow-0">
              <CommonProjectBreadcrumbs workspaceSlug={workspaceSlug?.toString()} projectId={projectId?.toString()} />
              <Breadcrumbs.Item
                component={
                  <BreadcrumbLink
                    label="Epics"
                    href={`/${workspaceSlug}/projects/${projectId}/epics/`}
                    icon={<WorkItemsIcon className="h-4 w-4 text-tertiary" />}
                    isLast
                  />
                }
                isLast
              />
            </Breadcrumbs>
            {epicsCount && epicsCount > 0 ? (
              <Tooltip
                isMobile={isMobile}
                tooltipContent={`There ${epicsCount > 1 ? "are" : "is"} ${epicsCount} epic${epicsCount > 1 ? "s" : ""} in this project`}
                position="bottom"
              >
                <CountChip count={epicsCount} />
              </Tooltip>
            ) : null}
          </div>
        </Header.LeftItem>
        <Header.RightItem>
          {canUserCreateEpic && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsCreateEpicOpen(true)}
            >
              <div className="hidden sm:block">Add Epic</div>
              <div className="block sm:hidden">Epic</div>
            </Button>
          )}
        </Header.RightItem>
      </Header>
      <CreateUpdateEpicModal
        isOpen={isCreateEpicOpen}
        onClose={() => setIsCreateEpicOpen(false)}
      />
    </>
  );
});
