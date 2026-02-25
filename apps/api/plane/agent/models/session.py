# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.db import models

# Module imports
from plane.db.models import BaseModel


class AgentSession(BaseModel):
    """
    Represents a single agent execution session.

    A session is created when a user triggers an agent (e.g. by
    mentioning it in an issue comment). It tracks the full lifecycle
    from pending through provisioning, running, and completion,
    including resource usage and output artifacts.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROVISIONING = "provisioning", "Provisioning"
        RUNNING = "running", "Running"
        STREAMING = "streaming", "Streaming"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"
        TIMED_OUT = "timed_out", "Timed Out"

    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="agent_sessions",
    )
    project = models.ForeignKey(
        "db.Project",
        on_delete=models.CASCADE,
        related_name="agent_sessions",
    )
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="agent_sessions",
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="triggered_agent_sessions",
    )
    trigger_comment = models.ForeignKey(
        "db.IssueComment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_sessions",
    )
    provider_slug = models.CharField(max_length=50)
    variant_slug = models.CharField(max_length=50)
    model_id = models.CharField(max_length=100)
    skill_trigger = models.CharField(max_length=50, null=True, blank=True)
    comment_text = models.TextField(default="")
    container_id = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    timeout_minutes = models.IntegerField(default=15)
    response_text = models.TextField(null=True, blank=True)
    response_html = models.TextField(null=True, blank=True)
    branch_name = models.CharField(max_length=255, null=True, blank=True)
    pull_request_url = models.URLField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    tokens_used = models.IntegerField(default=0)
    estimated_cost_usd = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=0,
    )
    duration_seconds = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "agent_sessions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"AgentSession({self.provider_slug}/{self.variant_slug}, {self.status})"
