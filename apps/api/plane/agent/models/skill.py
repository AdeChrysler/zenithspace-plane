# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.db import models

# Module imports
from plane.db.models import BaseModel


class AgentSkill(BaseModel):
    """
    A reusable skill definition that can be triggered by mentioning
    an agent in an issue comment.

    Skills define instructions, tool access, and execution mode for
    agent sessions. They are scoped to a workspace and optionally
    to a specific project.
    """

    MODE_CHOICES = [
        ("autonomous", "Autonomous"),
        ("comment_only", "Comment Only"),
    ]

    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="agent_skills",
    )
    project = models.ForeignKey(
        "db.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="agent_skills",
    )
    name = models.CharField(max_length=255)
    trigger = models.SlugField(max_length=50)
    description = models.TextField(blank=True, default="")
    instructions = models.TextField()
    default_provider = models.CharField(max_length=100, blank=True, default="")
    mode = models.CharField(
        max_length=20,
        default="autonomous",
        choices=MODE_CHOICES,
    )
    tools = models.JSONField(default=list)
    timeout_minutes = models.IntegerField(default=15)
    context_paths = models.JSONField(default=list)
    is_enabled = models.BooleanField(default=True)
    created_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_agent_skills",
    )

    class Meta:
        db_table = "agent_skills"
        unique_together = ["workspace", "trigger"]

    def __str__(self):
        return f"{self.name} (@{self.trigger})"
