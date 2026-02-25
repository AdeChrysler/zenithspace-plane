# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.agent.models import (
    AgentProvider,
    AgentProviderVariant,
    AgentSession,
    WorkspaceAgentConfig,
)
from plane.agent.serializers import AgentSessionSerializer
from plane.db.models import Workspace


class AgentInvokeEndpoint(BaseAPIView):
    """
    Invoke an agent session: validate provider/variant, check config,
    create session, and queue Celery task.
    """

    @allow_permission(
        allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE"
    )
    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)

        # Validate required fields
        provider_slug = request.data.get("provider_slug")
        project_id = request.data.get("project_id")
        issue_id = request.data.get("issue_id")

        if not provider_slug or not project_id or not issue_id:
            return Response(
                {
                    "error": "provider_slug, project_id, and issue_id are required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate provider exists and is enabled
        try:
            provider = AgentProvider.objects.get(
                slug=provider_slug, is_enabled=True
            )
        except AgentProvider.DoesNotExist:
            return Response(
                {"error": "Provider not found or not enabled."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Resolve variant
        variant_slug = request.data.get("variant_slug")
        if variant_slug:
            try:
                variant = AgentProviderVariant.objects.get(
                    provider=provider,
                    slug=variant_slug,
                    is_enabled=True,
                )
            except AgentProviderVariant.DoesNotExist:
                return Response(
                    {"error": "Variant not found or not enabled."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            # Use default variant
            variant = (
                AgentProviderVariant.objects.filter(
                    provider=provider,
                    is_default=True,
                    is_enabled=True,
                ).first()
            )
            if not variant:
                return Response(
                    {"error": "No default variant available for this provider."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Check workspace config has OAuth token
        try:
            config = WorkspaceAgentConfig.objects.get(
                workspace=workspace,
                provider=provider,
                is_enabled=True,
            )
        except WorkspaceAgentConfig.DoesNotExist:
            return Response(
                {"error": "Agent provider is not configured for this workspace."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not config.oauth_token_encrypted:
            return Response(
                {"error": "OAuth token not configured. Please connect the provider first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check concurrent session limit
        active_sessions_count = AgentSession.objects.filter(
            workspace=workspace,
            provider_slug=provider_slug,
            status__in=[
                AgentSession.Status.PENDING,
                AgentSession.Status.PROVISIONING,
                AgentSession.Status.RUNNING,
                AgentSession.Status.STREAMING,
            ],
        ).count()

        if active_sessions_count >= config.max_concurrent_sessions:
            return Response(
                {
                    "error": f"Concurrent session limit reached ({config.max_concurrent_sessions}). Please wait for an active session to complete."
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Create session
        session = AgentSession.objects.create(
            workspace=workspace,
            project_id=project_id,
            issue_id=issue_id,
            triggered_by=request.user,
            trigger_comment_id=request.data.get("comment_id"),
            provider_slug=provider.slug,
            variant_slug=variant.slug,
            model_id=variant.model_id,
            skill_trigger=request.data.get("skill_trigger"),
            comment_text=request.data.get("comment_text", ""),
            timeout_minutes=config.timeout_minutes,
            status=AgentSession.Status.PENDING,
        )

        # Queue Celery task
        try:
            from plane.agent.tasks import run_agent_task

            run_agent_task.delay(str(session.id))
        except ImportError:
            # Task module not yet available; session remains in PENDING
            pass

        serializer = AgentSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AgentSessionDetailEndpoint(BaseAPIView):
    """
    Retrieve an agent session by ID.
    """

    @allow_permission(
        allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE"
    )
    def get(self, request, slug, session_id):
        session = AgentSession.objects.get(
            id=session_id,
            workspace__slug=slug,
        )
        serializer = AgentSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AgentSessionCancelEndpoint(BaseAPIView):
    """
    Cancel an active agent session and kill the container if running.
    """

    @allow_permission(
        allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE"
    )
    def post(self, request, slug, session_id):
        session = AgentSession.objects.get(
            id=session_id,
            workspace__slug=slug,
        )

        # Only cancel sessions that are still active
        active_statuses = [
            AgentSession.Status.PENDING,
            AgentSession.Status.PROVISIONING,
            AgentSession.Status.RUNNING,
            AgentSession.Status.STREAMING,
        ]
        if session.status not in active_statuses:
            return Response(
                {"error": f"Session is already {session.status} and cannot be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Kill container if running
        if session.container_id:
            try:
                import docker

                client = docker.from_env()
                container = client.containers.get(session.container_id)
                container.kill()
            except Exception:
                # Container may already be stopped; proceed with cancellation
                pass

        session.status = AgentSession.Status.CANCELLED
        session.completed_at = timezone.now()
        session.save(update_fields=["status", "completed_at"])

        serializer = AgentSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)
