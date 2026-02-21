# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from .base import BaseModel


class WorkItemTemplate(BaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="work_item_templates")
    project = models.ForeignKey("db.Project", on_delete=models.CASCADE, related_name="work_item_templates", null=True, blank=True)
    template_data = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Work Item Template"
        verbose_name_plural = "Work Item Templates"
        db_table = "work_item_templates"
        ordering = ("-created_at",)

    def __str__(self):
        return self.name


class ProjectTemplate(BaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="project_templates")
    template_data = models.JSONField(default=dict)
    cover_image = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Project Template"
        verbose_name_plural = "Project Templates"
        db_table = "project_templates"
        ordering = ("-created_at",)

    def __str__(self):
        return self.name
