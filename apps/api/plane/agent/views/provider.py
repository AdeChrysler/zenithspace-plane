# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.agent.models import AgentProvider
from plane.agent.serializers import AgentProviderSerializer


class AgentProviderListEndpoint(BaseAPIView):
    """
    List all enabled agent providers with their variants.
    """

    @allow_permission(
        allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE"
    )
    def get(self, request, slug):
        providers = AgentProvider.objects.filter(
            is_enabled=True
        ).prefetch_related("variants")

        serializer = AgentProviderSerializer(providers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
