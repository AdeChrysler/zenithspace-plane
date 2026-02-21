# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from .project import ProjectBaseModel


class Automation(ProjectBaseModel):
    TRIGGER_CHOICES = [
        ("state_change", "State Change"),
        ("assignee_change", "Assignee Change"),
        ("label_change", "Label Change"),
        ("due_date", "Due Date Change"),
        ("priority_change", "Priority Change"),
        ("created", "Issue Created"),
    ]

    ACTION_CHOICES = [
        ("update_state", "Update State"),
        ("add_label", "Add Label"),
        ("assign_user", "Assign User"),
        ("send_notification", "Send Notification"),
        ("update_priority", "Update Priority"),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    trigger_type = models.CharField(max_length=50, choices=TRIGGER_CHOICES)
    trigger_config = models.JSONField(default=dict)
    action_type = models.CharField(max_length=50, choices=ACTION_CHOICES)
    action_config = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Automation"
        verbose_name_plural = "Automations"
        db_table = "automations"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.name} ({self.trigger_type} -> {self.action_type})"
