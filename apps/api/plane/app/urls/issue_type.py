# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path
from plane.app.views.issue_type.base import IssueTypeViewSet

urlpatterns = [
    path("workspaces/<str:slug>/issue-types/", IssueTypeViewSet.as_view({"get": "list", "post": "create"}), name="workspace-issue-types"),
    path("workspaces/<str:slug>/issue-types/<uuid:pk>/", IssueTypeViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="workspace-issue-type"),
]
