# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations


def disable_non_sonnet(apps, schema_editor):
    AgentProvider = apps.get_model("agent", "AgentProvider")
    AgentProviderVariant = apps.get_model("agent", "AgentProviderVariant")

    # Disable all Gemini providers
    AgentProvider.objects.filter(slug="gemini").update(is_enabled=False)

    # Disable all variants except claude-sonnet
    AgentProviderVariant.objects.exclude(
        provider__slug="claude", slug="sonnet"
    ).update(is_enabled=False)


def reverse(apps, schema_editor):
    AgentProvider = apps.get_model("agent", "AgentProvider")
    AgentProviderVariant = apps.get_model("agent", "AgentProviderVariant")

    AgentProvider.objects.filter(slug="gemini").update(is_enabled=True)
    AgentProviderVariant.objects.all().update(is_enabled=True)


class Migration(migrations.Migration):

    dependencies = [
        ("agent", "0004_reset_user_password"),
    ]

    operations = [
        migrations.RunPython(disable_non_sonnet, reverse),
    ]
