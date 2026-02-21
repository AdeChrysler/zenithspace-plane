# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.response import Response
from rest_framework import status
from plane.app.views.base import BaseViewSet
from plane.app.serializers.issue_type import IssueTypeSerializer
from plane.app.permissions import allow_permission, ROLE
from plane.db.models import IssueType, Workspace


class IssueTypeViewSet(BaseViewSet):
    serializer_class = IssueTypeSerializer
    model = IssueType

    def get_queryset(self):
        return self.filter_queryset(
            super().get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(is_active=True)
            .order_by("level", "name")
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        serializer = IssueTypeSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = IssueTypeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        issue_type = IssueType.objects.get(pk=pk, workspace__slug=slug)
        serializer = IssueTypeSerializer(issue_type)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        issue_type = IssueType.objects.get(pk=pk, workspace__slug=slug)
        serializer = IssueTypeSerializer(issue_type, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        issue_type = IssueType.objects.get(pk=pk, workspace__slug=slug)
        if issue_type.is_default:
            return Response({"error": "Default issue type cannot be deleted"}, status=status.HTTP_400_BAD_REQUEST)
        issue_type.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
