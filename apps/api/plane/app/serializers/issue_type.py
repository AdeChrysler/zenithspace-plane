# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from .base import BaseSerializer
from plane.db.models import IssueType


class IssueTypeSerializer(BaseSerializer):
    class Meta:
        model = IssueType
        fields = [
            "id", "workspace_id", "name", "description", "logo_props",
            "is_epic", "is_default", "is_active", "level",
            "created_at", "updated_at",
        ]
        read_only_fields = ["workspace", "created_at", "updated_at"]


class IssueTypeLiteSerializer(BaseSerializer):
    class Meta:
        model = IssueType
        fields = ["id", "name", "logo_props", "is_default", "is_active"]
        read_only_fields = fields
