# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.agent.views import (
    AgentProviderListEndpoint,
    WorkspaceAgentConfigEndpoint,
    AgentSkillListCreateEndpoint,
    AgentSkillDetailEndpoint,
    AgentInvokeEndpoint,
    AgentSessionDetailEndpoint,
    AgentSessionCancelEndpoint,
    AgentSessionStreamEndpoint,
)

urlpatterns = [
    # Provider list
    path(
        "workspaces/<str:slug>/providers/",
        AgentProviderListEndpoint.as_view(),
        name="agent-provider-list",
    ),
    # Workspace agent config
    path(
        "workspaces/<str:slug>/config/",
        WorkspaceAgentConfigEndpoint.as_view(),
        name="agent-workspace-config",
    ),
    # Skills
    path(
        "workspaces/<str:slug>/skills/",
        AgentSkillListCreateEndpoint.as_view(),
        name="agent-skill-list-create",
    ),
    path(
        "workspaces/<str:slug>/skills/<uuid:pk>/",
        AgentSkillDetailEndpoint.as_view(),
        name="agent-skill-detail",
    ),
    # Invoke
    path(
        "workspaces/<str:slug>/invoke/",
        AgentInvokeEndpoint.as_view(),
        name="agent-invoke",
    ),
    # Sessions
    path(
        "workspaces/<str:slug>/sessions/<uuid:session_id>/",
        AgentSessionDetailEndpoint.as_view(),
        name="agent-session-detail",
    ),
    path(
        "workspaces/<str:slug>/sessions/<uuid:session_id>/cancel/",
        AgentSessionCancelEndpoint.as_view(),
        name="agent-session-cancel",
    ),
    # Stream
    path(
        "workspaces/<str:slug>/sessions/<uuid:session_id>/stream/",
        AgentSessionStreamEndpoint.as_view(),
        name="agent-session-stream",
    ),
]
