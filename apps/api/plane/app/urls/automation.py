# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path
from plane.app.views.automation.base import AutomationViewSet

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/automations/",
        AutomationViewSet.as_view({"get": "list", "post": "create"}),
        name="project-automations",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/automations/<uuid:pk>/",
        AutomationViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="project-automation-detail",
    ),
]
