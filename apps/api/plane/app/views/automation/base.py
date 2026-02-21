# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.response import Response
from rest_framework import status
from plane.app.views.base import BaseViewSet
from plane.app.serializers import AutomationSerializer
from plane.app.permissions import allow_permission, ROLE
from plane.db.models import Automation


class AutomationViewSet(BaseViewSet):
    serializer_class = AutomationSerializer
    model = Automation

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .order_by("-created_at")
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def list(self, request, slug, project_id):
        queryset = self.get_queryset()
        serializer = AutomationSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        serializer = AutomationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project_id=project_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def retrieve(self, request, slug, project_id, pk):
        automation = Automation.objects.get(pk=pk, workspace__slug=slug, project_id=project_id)
        serializer = AutomationSerializer(automation)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        automation = Automation.objects.get(pk=pk, workspace__slug=slug, project_id=project_id)
        serializer = AutomationSerializer(automation, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, pk):
        automation = Automation.objects.get(pk=pk, workspace__slug=slug, project_id=project_id)
        automation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
