# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.response import Response
from rest_framework import status
from plane.app.views.base import BaseViewSet
from plane.app.serializers import WorkItemTemplateSerializer, ProjectTemplateSerializer
from plane.app.permissions import allow_permission, ROLE
from plane.db.models import WorkItemTemplate, ProjectTemplate, Workspace


class WorkItemTemplateViewSet(BaseViewSet):
    serializer_class = WorkItemTemplateSerializer
    model = WorkItemTemplate

    def get_queryset(self):
        qs = super().get_queryset().filter(workspace__slug=self.kwargs.get("slug"))
        project_id = self.request.query_params.get("project_id")
        if project_id:
            from django.db import models
            qs = qs.filter(models.Q(project_id=project_id) | models.Q(project__isnull=True))
        return qs.order_by("-created_at")

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def list(self, request, slug):
        serializer = WorkItemTemplateSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = WorkItemTemplateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        template = WorkItemTemplate.objects.get(pk=pk, workspace__slug=slug)
        serializer = WorkItemTemplateSerializer(template)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        template = WorkItemTemplate.objects.get(pk=pk, workspace__slug=slug)
        serializer = WorkItemTemplateSerializer(template, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        template = WorkItemTemplate.objects.get(pk=pk, workspace__slug=slug)
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectTemplateViewSet(BaseViewSet):
    serializer_class = ProjectTemplateSerializer
    model = ProjectTemplate

    def get_queryset(self):
        return super().get_queryset().filter(workspace__slug=self.kwargs.get("slug")).order_by("-created_at")

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def list(self, request, slug):
        serializer = ProjectTemplateSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def create(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = ProjectTemplateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def retrieve(self, request, slug, pk):
        template = ProjectTemplate.objects.get(pk=pk, workspace__slug=slug)
        serializer = ProjectTemplateSerializer(template)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        template = ProjectTemplate.objects.get(pk=pk, workspace__slug=slug)
        serializer = ProjectTemplateSerializer(template, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        template = ProjectTemplate.objects.get(pk=pk, workspace__slug=slug)
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
