# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.app.serializers.base import BaseSerializer

from plane.agent.models import AgentSession


class AgentSessionSerializer(BaseSerializer):
    class Meta:
        model = AgentSession
        fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "triggered_by",
            "trigger_comment",
            "provider_slug",
            "variant_slug",
            "model_id",
            "skill_trigger",
            "comment_text",
            "container_id",
            "status",
            "started_at",
            "completed_at",
            "timeout_minutes",
            "response_text",
            "response_html",
            "branch_name",
            "pull_request_url",
            "error_message",
            "tokens_used",
            "estimated_cost_usd",
            "duration_seconds",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "container_id",
            "status",
            "started_at",
            "completed_at",
            "response_text",
            "response_html",
            "branch_name",
            "pull_request_url",
            "error_message",
            "tokens_used",
            "estimated_cost_usd",
            "duration_seconds",
            "created_at",
            "updated_at",
        ]
