# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json
import logging

# Third party imports
import docker
import redis
from celery import shared_task
from django.conf import settings
from django.utils import timezone

# Module imports
from plane.agent.models import AgentSession, AgentSkill, WorkspaceAgentConfig
from plane.agent.utils.encryption import decrypt_token
from plane.utils.exception_logger import log_exception

logger = logging.getLogger(__name__)


def _get_redis_client():
    """Return a Redis client using the project-wide REDIS_URL setting."""
    return redis.from_url(settings.REDIS_URL)


def _publish_chunk(redis_client, session_id, chunk_type, content):
    """Publish a chunk to the session's Redis pub/sub channel."""
    channel = f"agent:session:{session_id}"
    data = json.dumps({"type": chunk_type, "content": content})
    redis_client.publish(channel, data)


def _decrypt_token(encrypted_token):
    """Decrypt an OAuth token using Fernet symmetric encryption.

    Delegates to the encryption utility which derives a key from
    Django's SECRET_KEY.
    """
    return decrypt_token(encrypted_token)


@shared_task(bind=True, max_retries=1, time_limit=1800, soft_time_limit=1740)
def run_agent_task(self, session_id):
    """
    Main Celery task: spin up a Docker container for the AI agent,
    stream its output via Redis pub/sub, and handle completion.

    Lifecycle:
        pending -> provisioning -> running -> streaming -> completed/failed

    The container receives issue context, skill instructions, and OAuth
    tokens via environment variables. Its stdout is streamed line-by-line
    to a Redis pub/sub channel that the SSE endpoint subscribes to.
    """
    r = _get_redis_client()
    session = None

    try:
        session = AgentSession.objects.select_related(
            "workspace", "project", "issue"
        ).get(pk=session_id)

        # --- Provisioning ------------------------------------------------
        session.status = AgentSession.Status.PROVISIONING
        session.started_at = timezone.now()
        session.save(update_fields=["status", "started_at"])
        _publish_chunk(r, session_id, "status", "provisioning")

        # Get workspace config for OAuth token
        config = WorkspaceAgentConfig.objects.select_related("provider").get(
            workspace=session.workspace,
            provider__slug=session.provider_slug,
        )

        oauth_token = _decrypt_token(config.oauth_token_encrypted)

        # Resolve skill if specified
        skill_instructions = ""
        if session.skill_trigger:
            try:
                skill = AgentSkill.objects.get(
                    workspace=session.workspace,
                    trigger=session.skill_trigger,
                    is_enabled=True,
                )
                skill_instructions = skill.instructions
            except AgentSkill.DoesNotExist:
                logger.warning(
                    "Skill '%s' not found, proceeding without skill",
                    session.skill_trigger,
                )

        # Build environment variables for the container
        env = {
            "PROVIDER_SLUG": session.provider_slug,
            "VARIANT_SLUG": session.variant_slug,
            "MODEL_ID": session.model_id,
            "CLI_TOOL": config.provider.cli_tool,
            "SESSION_ID": str(session.id),
            "ISSUE_TITLE": getattr(session.issue, "name", "") or "",
            "ISSUE_DESCRIPTION": getattr(session.issue, "description_html", "") or "",
            "COMMENT_TEXT": session.comment_text or "",
            "SKILL_INSTRUCTIONS": skill_instructions,
            "SKILL_TRIGGER": session.skill_trigger or "",
            # OAuth tokens -- injected as env vars, never persisted to disk
            "ANTHROPIC_API_KEY": oauth_token if session.provider_slug == "claude" else "",
            "GOOGLE_API_KEY": oauth_token if session.provider_slug == "gemini" else "",
            # GitHub token placeholder -- will come from user's GitHub OAuth
            "GITHUB_TOKEN": "",
        }

        # Publish the plan steps so the frontend can render a progress list
        _publish_chunk(r, session_id, "plan", json.dumps([
            "Provisioning container",
            "Loading issue context",
            "Running agent",
            "Processing results",
        ]))

        # --- Docker container creation ------------------------------------
        docker_client = docker.from_env()
        container = docker_client.containers.run(
            image=config.provider.docker_image,
            environment=env,
            mem_limit="2g",
            cpu_period=100000,
            cpu_quota=100000,  # 1 CPU core
            network_mode="bridge",
            detach=True,
            auto_remove=False,  # We need to inspect the exit code
        )

        session.container_id = container.id
        session.status = AgentSession.Status.RUNNING
        session.save(update_fields=["container_id", "status"])
        _publish_chunk(r, session_id, "status", "running")

        # --- Streaming ----------------------------------------------------
        session.status = AgentSession.Status.STREAMING
        session.save(update_fields=["status"])

        full_response = ""
        for chunk in container.logs(stream=True, follow=True):
            text = chunk.decode("utf-8", errors="replace")
            full_response += text
            _publish_chunk(r, session_id, "text", text)

        # Wait for container to finish and capture the exit code
        result = container.wait(timeout=session.timeout_minutes * 60)
        exit_code = result.get("StatusCode", -1)

        # --- Parse structured output from container -----------------------
        pr_url = None
        branch_name = None
        for line in full_response.split("\n"):
            if line.startswith("PR_URL="):
                pr_url = line.split("=", 1)[1].strip()
            elif line.startswith("BRANCH="):
                branch_name = line.split("=", 1)[1].strip()

        # --- Finalize session ---------------------------------------------
        session.status = (
            AgentSession.Status.COMPLETED if exit_code == 0
            else AgentSession.Status.FAILED
        )
        session.completed_at = timezone.now()
        session.response_text = full_response
        session.response_html = full_response.replace("\n", "<br/>")
        session.pull_request_url = pr_url
        session.branch_name = branch_name or f"agent/{session.id}"
        if session.started_at:
            session.duration_seconds = int(
                (session.completed_at - session.started_at).total_seconds()
            )
        if exit_code != 0:
            session.error_message = f"Container exited with code {exit_code}"
        session.save()

        _publish_chunk(r, session_id, "done", "")

        # Cleanup container
        try:
            container.remove(force=True)
        except Exception:
            pass

    except Exception as e:
        log_exception(e)
        logger.error(
            "Agent task failed for session %s: %s", session_id, e
        )
        if session:
            session.status = AgentSession.Status.FAILED
            session.error_message = str(e)[:1000]
            session.completed_at = timezone.now()
            session.save(update_fields=["status", "error_message", "completed_at"])
        _publish_chunk(r, session_id, "error", str(e)[:500])
        _publish_chunk(r, session_id, "done", "")
