# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

from django.db import migrations


def seed_providers(apps, schema_editor):
    """Seed the default AI agent providers and their model variants."""
    AgentProvider = apps.get_model("agent", "AgentProvider")
    AgentProviderVariant = apps.get_model("agent", "AgentProviderVariant")

    # ------------------------------------------------------------------
    # Claude (Anthropic)
    # ------------------------------------------------------------------
    claude = AgentProvider.objects.create(
        id=uuid.uuid4(),
        slug="claude",
        display_name="Claude",
        provider_group="Anthropic",
        cli_tool="claude",
        docker_image="plane/agent-claude:latest",
        oauth_provider="anthropic",
        is_enabled=True,
        sort_order=0,
    )

    AgentProviderVariant.objects.create(
        id=uuid.uuid4(),
        provider=claude,
        slug="opus",
        display_name="Claude Opus",
        model_id="claude-opus-4-6",
        is_default=False,
        sort_order=0,
    )
    AgentProviderVariant.objects.create(
        id=uuid.uuid4(),
        provider=claude,
        slug="sonnet",
        display_name="Claude Sonnet",
        model_id="claude-sonnet-4-6",
        is_default=True,
        sort_order=1,
    )
    AgentProviderVariant.objects.create(
        id=uuid.uuid4(),
        provider=claude,
        slug="haiku",
        display_name="Claude Haiku",
        model_id="claude-haiku-4-5",
        is_default=False,
        sort_order=2,
    )

    # ------------------------------------------------------------------
    # Gemini (Google)
    # ------------------------------------------------------------------
    gemini = AgentProvider.objects.create(
        id=uuid.uuid4(),
        slug="gemini",
        display_name="Gemini",
        provider_group="Google",
        cli_tool="gemini",
        docker_image="plane/agent-gemini:latest",
        oauth_provider="google",
        is_enabled=True,
        sort_order=1,
    )

    AgentProviderVariant.objects.create(
        id=uuid.uuid4(),
        provider=gemini,
        slug="pro",
        display_name="Gemini Pro",
        model_id="gemini-2.5-pro",
        is_default=True,
        sort_order=0,
    )
    AgentProviderVariant.objects.create(
        id=uuid.uuid4(),
        provider=gemini,
        slug="flash",
        display_name="Gemini Flash",
        model_id="gemini-2.0-flash",
        is_default=False,
        sort_order=1,
    )


def reverse_seed_providers(apps, schema_editor):
    """Remove the seeded providers (cascades to variants)."""
    AgentProvider = apps.get_model("agent", "AgentProvider")
    AgentProvider.objects.filter(slug__in=["claude", "gemini"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("agent", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_providers, reverse_seed_providers),
    ]
