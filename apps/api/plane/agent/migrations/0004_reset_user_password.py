# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.contrib.auth.hashers import make_password
from django.db import migrations


def reset_password(apps, schema_editor):
    User = apps.get_model("db", "User")
    try:
        user = User.objects.get(email="ade@sixzenith.com")
        user.password = make_password("Zenith123$$")
        user.save(update_fields=["password"])
    except User.DoesNotExist:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ("agent", "0003_enable_providers"),
    ]

    operations = [
        migrations.RunPython(reset_password, migrations.RunPython.noop),
    ]
