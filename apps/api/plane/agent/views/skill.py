# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.agent.models import AgentSkill
from plane.agent.serializers import AgentSkillSerializer
from plane.db.models import Workspace


class AgentSkillListCreateEndpoint(BaseAPIView):
    """
    List and create agent skills for a workspace.
    """

    @allow_permission(
        allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE"
    )
    def get(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        skills = AgentSkill.objects.filter(workspace=workspace)

        # Optional filter by project_id
        project_id = request.query_params.get("project_id")
        if project_id:
            skills = skills.filter(project_id=project_id)

        serializer = AgentSkillSerializer(skills, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = AgentSkillSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(
                workspace=workspace,
                created_by_user=request.user,
            )
            return Response(
                serializer.data, status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors, status=status.HTTP_400_BAD_REQUEST
        )


class AgentSkillDetailEndpoint(BaseAPIView):
    """
    Update and delete agent skills.
    """

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def put(self, request, slug, pk):
        skill = AgentSkill.objects.get(
            pk=pk,
            workspace__slug=slug,
        )
        serializer = AgentSkillSerializer(
            skill, data=request.data, partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(
            serializer.errors, status=status.HTTP_400_BAD_REQUEST
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def delete(self, request, slug, pk):
        skill = AgentSkill.objects.get(
            pk=pk,
            workspace__slug=slug,
        )
        skill.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
