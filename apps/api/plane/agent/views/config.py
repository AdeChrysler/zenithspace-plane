# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.agent.models import WorkspaceAgentConfig
from plane.db.models import Workspace


class WorkspaceAgentConfigEndpoint(BaseAPIView):
    """
    List and update workspace agent configurations.
    """

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def get(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        configs = WorkspaceAgentConfig.objects.filter(
            workspace=workspace
        ).select_related("provider")

        data = []
        for config in configs:
            data.append(
                {
                    "id": str(config.id),
                    "provider_slug": config.provider.slug,
                    "provider_name": config.provider.display_name,
                    "is_enabled": config.is_enabled,
                    "has_token": bool(config.oauth_token_encrypted),
                    "max_concurrent": config.max_concurrent_sessions,
                    "timeout": config.timeout_minutes,
                    "connected_at": config.connected_at,
                }
            )

        return Response(data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def put(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        provider_slug = request.data.get("provider_slug")

        if not provider_slug:
            return Response(
                {"error": "provider_slug is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            config = WorkspaceAgentConfig.objects.get(
                workspace=workspace,
                provider__slug=provider_slug,
            )
        except WorkspaceAgentConfig.DoesNotExist:
            return Response(
                {"error": "Configuration not found for this provider."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Update allowed fields
        if "is_enabled" in request.data:
            config.is_enabled = request.data["is_enabled"]
        if "max_concurrent" in request.data:
            config.max_concurrent_sessions = request.data["max_concurrent"]
        if "timeout" in request.data:
            config.timeout_minutes = request.data["timeout"]

        config.save()

        return Response(
            {
                "id": str(config.id),
                "provider_slug": config.provider.slug,
                "provider_name": config.provider.display_name,
                "is_enabled": config.is_enabled,
                "has_token": bool(config.oauth_token_encrypted),
                "max_concurrent": config.max_concurrent_sessions,
                "timeout": config.timeout_minutes,
                "connected_at": config.connected_at,
            },
            status=status.HTTP_200_OK,
        )
