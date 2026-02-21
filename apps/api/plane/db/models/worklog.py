# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.conf import settings
from django.db import models
from .project import ProjectBaseModel


class IssueWorklog(ProjectBaseModel):
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="worklogs")
    description = models.TextField(blank=True)
    duration_in_minutes = models.PositiveIntegerField()
    logged_at = models.DateTimeField()
    logged_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="issue_worklogs")

    class Meta:
        verbose_name = "Issue Worklog"
        verbose_name_plural = "Issue Worklogs"
        db_table = "issue_worklogs"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.issue.name} - {self.duration_in_minutes}m by {self.logged_by.email}"
