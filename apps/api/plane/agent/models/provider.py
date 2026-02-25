# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models

# Module imports
from plane.db.models import BaseModel


class AgentProvider(BaseModel):
    """
    Represents an AI agent provider (e.g. Claude, GPT).

    Each provider corresponds to a specific CLI tool and Docker image
    used to run agent sessions. Providers can be enabled/disabled at
    the system level.
    """

    slug = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=100)
    provider_group = models.CharField(max_length=100, default="")
    cli_tool = models.CharField(max_length=100)
    docker_image = models.CharField(max_length=255)
    oauth_provider = models.CharField(max_length=50, blank=True)
    is_enabled = models.BooleanField(default=False)
    icon_url = models.URLField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "agent_providers"
        ordering = ["sort_order", "display_name"]

    def __str__(self):
        return f"{self.display_name} ({self.slug})"


class AgentProviderVariant(BaseModel):
    """
    Represents a specific model variant within an agent provider.

    For example, the "Claude" provider may have variants like "Opus"
    and "Sonnet", each mapping to a specific model_id.
    """

    provider = models.ForeignKey(
        AgentProvider,
        on_delete=models.CASCADE,
        related_name="variants",
    )
    slug = models.CharField(max_length=50)
    display_name = models.CharField(max_length=100)
    model_id = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False)
    is_enabled = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "agent_provider_variants"
        unique_together = ["provider", "slug"]
        ordering = ["sort_order"]

    def __str__(self):
        return f"{self.provider.slug}/{self.slug} ({self.model_id})"
