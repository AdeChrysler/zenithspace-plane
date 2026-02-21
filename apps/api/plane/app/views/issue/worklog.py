# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.response import Response
from rest_framework import status
from plane.app.views.base import BaseViewSet
from plane.app.serializers import IssueWorklogSerializer
from plane.app.permissions import allow_permission, ROLE
from plane.db.models import IssueWorklog, Project


class IssueWorklogViewSet(BaseViewSet):
    serializer_class = IssueWorklogSerializer
    model = IssueWorklog

    def get_queryset(self):
        return (
            super().get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("issue_id"))
            .select_related("logged_by")
            .order_by("-created_at")
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def list(self, request, slug, project_id, issue_id):
        project = Project.objects.get(pk=project_id)
        if not project.is_time_tracking_enabled:
            return Response({"error": "Time tracking is not enabled."}, status=status.HTTP_400_BAD_REQUEST)
        queryset = self.get_queryset()
        serializer = IssueWorklogSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id, issue_id):
        project = Project.objects.get(pk=project_id)
        if not project.is_time_tracking_enabled:
            return Response({"error": "Time tracking is not enabled."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = IssueWorklogSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project_id=project_id, issue_id=issue_id, logged_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN], creator=True, model=IssueWorklog)
    def partial_update(self, request, slug, project_id, issue_id, pk):
        worklog = IssueWorklog.objects.get(workspace__slug=slug, project_id=project_id, issue_id=issue_id, pk=pk)
        serializer = IssueWorklogSerializer(worklog, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN], creator=True, model=IssueWorklog)
    def destroy(self, request, slug, project_id, issue_id, pk):
        worklog = IssueWorklog.objects.get(workspace__slug=slug, project_id=project_id, issue_id=issue_id, pk=pk)
        worklog.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
