# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.app.serializers.base import BaseSerializer

from plane.agent.models import AgentProvider, AgentProviderVariant


class AgentProviderVariantSerializer(BaseSerializer):
    class Meta:
        model = AgentProviderVariant
        fields = [
            "id",
            "slug",
            "display_name",
            "model_id",
            "is_default",
            "is_enabled",
            "sort_order",
        ]


class AgentProviderSerializer(BaseSerializer):
    variants = AgentProviderVariantSerializer(many=True, read_only=True)

    class Meta:
        model = AgentProvider
        fields = [
            "id",
            "slug",
            "display_name",
            "provider_group",
            "cli_tool",
            "docker_image",
            "oauth_provider",
            "is_enabled",
            "icon_url",
            "sort_order",
            "variants",
        ]
