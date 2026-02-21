# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from plane.app.views.base import BaseAPIView
from plane.db.models import Issue


class DuplicateSearchEndpoint(BaseAPIView):
    def post(self, request, slug):
        title = request.data.get("title", "").strip()
        project_id = request.data.get("project_id", None)
        issue_id = request.data.get("issue_id", None)

        if not title or len(title) < 3:
            return Response({"dupes": []}, status=status.HTTP_200_OK)

        issues = Issue.issue_objects.filter(
            workspace__slug=slug,
            project__project_projectmember__member=request.user,
            project__project_projectmember__is_active=True,
            project__archived_at__isnull=True,
        )

        if project_id:
            issues = issues.filter(project_id=project_id)

        if issue_id:
            issues = issues.exclude(pk=issue_id)

        words = [w for w in title.split() if len(w) >= 3]

        if not words:
            issues = issues.filter(name__icontains=title)
        else:
            q = Q()
            for word in words[:10]:
                q |= Q(name__icontains=word)
            issues = issues.filter(q)

        issues = issues.order_by("-created_at")

        dupes = (
            issues.distinct()
            .values("id", "type_id", "project_id", "sequence_id", "name", "priority", "state_id", "created_by")[:5]
        )

        return Response({"dupes": list(dupes)}, status=status.HTTP_200_OK)
