# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.db import models

# Module imports
from plane.db.models import BaseModel


class WorkspaceAgentConfig(BaseModel):
    """
    Per-workspace configuration for an agent provider.

    Stores OAuth credentials (encrypted), concurrency limits, and
    timeout settings for each provider within a workspace.
    """

    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="agent_configs",
    )
    provider = models.ForeignKey(
        "agent.AgentProvider",
        on_delete=models.CASCADE,
        related_name="workspace_configs",
    )
    is_enabled = models.BooleanField(default=True)
    oauth_token_encrypted = models.TextField(blank=True, default="")
    oauth_refresh_token_encrypted = models.TextField(blank=True, default="")
    oauth_token_expires_at = models.DateTimeField(null=True, blank=True)
    max_concurrent_sessions = models.IntegerField(default=3)
    timeout_minutes = models.IntegerField(default=15)
    connected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_connections",
    )
    connected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "agent_workspace_configs"
        unique_together = ["workspace", "provider"]

    def __str__(self):
        return f"AgentConfig({self.workspace_id}, {self.provider_id})"
