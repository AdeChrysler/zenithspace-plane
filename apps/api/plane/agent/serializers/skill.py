# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.app.serializers.base import BaseSerializer

from plane.agent.models import AgentSkill


class AgentSkillSerializer(BaseSerializer):
    class Meta:
        model = AgentSkill
        fields = [
            "id",
            "workspace",
            "project",
            "name",
            "trigger",
            "description",
            "instructions",
            "default_provider",
            "mode",
            "tools",
            "timeout_minutes",
            "context_paths",
            "is_enabled",
            "created_by_user",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "created_by_user",
            "created_at",
            "updated_at",
        ]
