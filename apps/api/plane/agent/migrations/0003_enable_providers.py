# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations


def enable_all_providers(apps, schema_editor):
    AgentProvider = apps.get_model("agent", "AgentProvider")
    AgentProvider.objects.all().update(is_enabled=True)


class Migration(migrations.Migration):

    dependencies = [
        ("agent", "0002_seed_providers"),
    ]

    operations = [
        migrations.RunPython(enable_all_providers, migrations.RunPython.noop),
    ]
