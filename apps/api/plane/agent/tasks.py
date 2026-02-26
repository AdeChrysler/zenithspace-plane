# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import html
import json
import logging
import os

# Third party imports
import redis
import requests as http_requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone

# Module imports
from plane.agent.models import AgentSession, AgentSkill, WorkspaceAgentConfig
from plane.agent.utils.encryption import decrypt_token
from plane.db.models.user import Account
from plane.license.utils.instance_value import get_configuration_value
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


def _get_github_token(user_id):
    """Resolve the GitHub token for the triggering user.

    Lookup priority:
      1. User's GitHub OAuth account (Account model)
      2. Instance-level GITHUB_ACCESS_TOKEN from settings/env
    """
    try:
        account = Account.objects.filter(
            user_id=user_id, provider="github"
        ).order_by("-last_connected_at").first()
        if account and account.access_token:
            return account.access_token
    except Exception:
        pass

    # Fallback to instance-level env var
    token = getattr(settings, "GITHUB_ACCESS_TOKEN", None)
    if token and token is not False:
        return str(token)

    return ""


def _is_oauth_token(token):
    """Check if a token is a Claude Code OAuth token."""
    return bool(token and token.startswith("sk-ant-oat01-"))


def _get_llm_token(provider_slug, config):
    """Resolve the LLM API token for the given provider.

    Lookup priority:
      1. WorkspaceAgentConfig.oauth_token_encrypted (per-workspace)
      2. InstanceConfiguration LLM_API_KEY (instance-level, encrypted)
      3. Environment variable (ANTHROPIC_API_KEY / GOOGLE_API_KEY)
    """
    # 1. Per-workspace encrypted token
    if config and config.oauth_token_encrypted:
        token = _decrypt_token(config.oauth_token_encrypted)
        if token:
            return token

    # 2. Instance-level LLM_API_KEY from InstanceConfiguration / env
    try:
        (llm_api_key,) = get_configuration_value(
            [{"key": "LLM_API_KEY", "default": ""}]
        )
        if llm_api_key:
            return str(llm_api_key)
    except Exception:
        pass

    # 3. Direct env var fallback
    if provider_slug == "claude":
        return os.environ.get("ANTHROPIC_API_KEY", "")
    if provider_slug == "gemini":
        return os.environ.get("GOOGLE_API_KEY", "")

    return ""


def _build_prompt(session, skill_instructions):
    """Build the LLM prompt from issue context."""
    issue_title = getattr(session.issue, "name", "") or ""
    issue_desc = getattr(session.issue, "description_html", "") or "No description provided"
    comment = session.comment_text or ""

    parts = [f"Issue: {issue_title}", "", issue_desc, ""]
    if skill_instructions:
        parts.extend(["Skill Instructions:", skill_instructions, ""])
    parts.append(f"User request: {comment}")
    return "\n".join(parts)


def _call_anthropic_streaming(model_id, prompt, llm_token, timeout_seconds, redis_client, session_id):
    """Call the Anthropic messages API with streaming, publishing chunks to Redis.

    Supports both OAuth tokens (sk-ant-oat01-*) and standard API keys.
    Returns the full response text.
    """
    headers = {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
    }

    if _is_oauth_token(llm_token):
        headers["Authorization"] = f"Bearer {llm_token}"
        headers["anthropic-beta"] = "oauth-2025-04-20"
    else:
        headers["x-api-key"] = llm_token

    payload = {
        "model": model_id,
        "max_tokens": 8192,
        "stream": True,
        "messages": [{"role": "user", "content": prompt}],
    }

    resp = http_requests.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=payload,
        stream=True,
        timeout=timeout_seconds,
    )
    resp.raise_for_status()

    full_response = ""
    for raw_line in resp.iter_lines():
        if not raw_line:
            continue
        line = raw_line.decode("utf-8", errors="replace")
        if not line.startswith("data: "):
            continue
        data = line[6:]
        if data == "[DONE]":
            break
        try:
            event = json.loads(data)
            if event.get("type") == "content_block_delta":
                text = event.get("delta", {}).get("text", "")
                if text:
                    full_response += text
                    _publish_chunk(redis_client, session_id, "text", text)
        except (json.JSONDecodeError, KeyError):
            continue

    return full_response


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

        # Get workspace config (may or may not have OAuth token)
        try:
            config = WorkspaceAgentConfig.objects.select_related("provider").get(
                workspace=session.workspace,
                provider__slug=session.provider_slug,
            )
        except WorkspaceAgentConfig.DoesNotExist:
            config = None

        # Resolve LLM token via fallback chain
        llm_token = _get_llm_token(session.provider_slug, config)

        # Resolve GitHub token from the triggering user's Account
        github_token = _get_github_token(session.triggered_by_id)

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

        # Resolve provider metadata (cli_tool and docker_image)
        if config and config.provider:
            cli_tool = config.provider.cli_tool
            docker_image = config.provider.docker_image
        else:
            from plane.agent.models import AgentProvider
            provider = AgentProvider.objects.get(slug=session.provider_slug)
            cli_tool = provider.cli_tool
            docker_image = provider.docker_image

        # Publish the plan steps so the frontend can render a progress list
        _publish_chunk(r, session_id, "plan", json.dumps([
            "Loading issue context",
            "Running agent",
            "Processing results",
        ]))

        # --- Direct API call (no Docker required) -------------------------
        if session.provider_slug == "claude" and llm_token:
            prompt = _build_prompt(session, skill_instructions)

            session.status = AgentSession.Status.RUNNING
            session.save(update_fields=["status"])
            _publish_chunk(r, session_id, "status", "running")

            session.status = AgentSession.Status.STREAMING
            session.save(update_fields=["status"])

            full_response = _call_anthropic_streaming(
                model_id=session.model_id,
                prompt=prompt,
                llm_token=llm_token,
                timeout_seconds=session.timeout_minutes * 60,
                redis_client=r,
                session_id=str(session_id),
            )

            session.status = AgentSession.Status.COMPLETED
            session.completed_at = timezone.now()
            session.response_text = full_response
            session.response_html = html.escape(full_response).replace("\n", "<br/>")
            if session.started_at:
                session.duration_seconds = int(
                    (session.completed_at - session.started_at).total_seconds()
                )
            session.save()
            _publish_chunk(r, session_id, "done", "")

        else:
            # Fallback: Docker container execution for other providers
            import docker

            env = {
                "PROVIDER_SLUG": session.provider_slug,
                "VARIANT_SLUG": session.variant_slug,
                "MODEL_ID": session.model_id,
                "CLI_TOOL": cli_tool,
                "SESSION_ID": str(session.id),
                "ISSUE_TITLE": getattr(session.issue, "name", "") or "",
                "ISSUE_DESCRIPTION": getattr(session.issue, "description_html", "") or "",
                "COMMENT_TEXT": session.comment_text or "",
                "SKILL_INSTRUCTIONS": skill_instructions,
                "SKILL_TRIGGER": session.skill_trigger or "",
                "GOOGLE_API_KEY": llm_token if session.provider_slug == "gemini" else "",
                "GITHUB_TOKEN": github_token,
            }

            docker_client = docker.from_env()
            container = docker_client.containers.run(
                image=docker_image,
                environment=env,
                mem_limit="2g",
                cpu_period=100000,
                cpu_quota=100000,
                network_mode="bridge",
                detach=True,
                auto_remove=False,
            )

            session.container_id = container.id
            session.status = AgentSession.Status.RUNNING
            session.save(update_fields=["container_id", "status"])
            _publish_chunk(r, session_id, "status", "running")

            session.status = AgentSession.Status.STREAMING
            session.save(update_fields=["status"])

            full_response = ""
            for chunk in container.logs(stream=True, follow=True):
                text = chunk.decode("utf-8", errors="replace")
                full_response += text
                _publish_chunk(r, session_id, "text", text)

            result = container.wait(timeout=session.timeout_minutes * 60)
            exit_code = result.get("StatusCode", -1)

            pr_url = None
            branch_name = None
            for line in full_response.split("\n"):
                if line.startswith("PR_URL="):
                    pr_url = line.split("=", 1)[1].strip()
                elif line.startswith("BRANCH="):
                    branch_name = line.split("=", 1)[1].strip()

            session.status = (
                AgentSession.Status.COMPLETED if exit_code == 0
                else AgentSession.Status.FAILED
            )
            session.completed_at = timezone.now()
            session.response_text = full_response
            session.response_html = html.escape(full_response).replace("\n", "<br/>")
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
