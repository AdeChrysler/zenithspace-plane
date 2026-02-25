# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import logging
import secrets
from urllib.parse import urlencode

# Third party imports
import redis
from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.agent.models import AgentProvider, WorkspaceAgentConfig
from plane.agent.utils.encryption import encrypt_token
from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.db.models import Workspace

logger = logging.getLogger(__name__)

# OAuth configuration for supported providers
OAUTH_PROVIDERS = {
    "anthropic": {
        "authorize_url": "https://console.anthropic.com/oauth/authorize",
        "token_url": "https://console.anthropic.com/oauth/token",
        "scope": "user:read",
        "client_id_env": "ANTHROPIC_OAUTH_CLIENT_ID",
        "client_secret_env": "ANTHROPIC_OAUTH_CLIENT_SECRET",
    },
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scope": "https://www.googleapis.com/auth/generative-language",
        "client_id_env": "GOOGLE_AI_OAUTH_CLIENT_ID",
        "client_secret_env": "GOOGLE_AI_OAUTH_CLIENT_SECRET",
    },
}

# State token TTL: 10 minutes
STATE_TTL_SECONDS = 600
STATE_KEY_PREFIX = "agent:oauth:state:"


def _get_redis_client():
    """Return a Redis client using the project-wide REDIS_URL setting."""
    return redis.from_url(settings.REDIS_URL)


class AgentOAuthConnectEndpoint(BaseAPIView):
    """
    Start the OAuth flow for a given AI agent provider.

    Generates a cryptographic state token, stores it in Redis with a
    10-minute TTL, and returns a redirect URL pointing to the provider's
    OAuth authorization endpoint.
    """

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug, provider_slug):
        # Validate workspace
        workspace = Workspace.objects.get(slug=slug)

        # Validate provider exists and has an oauth_provider configured
        try:
            provider = AgentProvider.objects.get(slug=provider_slug)
        except AgentProvider.DoesNotExist:
            return Response(
                {"error": "Agent provider not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        oauth_provider = provider.oauth_provider
        if not oauth_provider or oauth_provider not in OAUTH_PROVIDERS:
            return Response(
                {
                    "error": f"OAuth is not configured for provider '{provider_slug}'. "
                    f"Supported OAuth providers: {', '.join(OAUTH_PROVIDERS.keys())}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        oauth_config = OAUTH_PROVIDERS[oauth_provider]

        # Read client credentials from environment / settings
        import os

        client_id = os.environ.get(oauth_config["client_id_env"], "")
        if not client_id:
            return Response(
                {
                    "error": f"OAuth client ID ({oauth_config['client_id_env']}) is not configured. "
                    "Please set it in the environment."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Generate a cryptographic state token
        state = secrets.token_urlsafe(32)

        # Store state in Redis with workspace and provider context
        r = _get_redis_client()
        state_data = f"{slug}:{provider_slug}:{request.user.id}"
        r.setex(f"{STATE_KEY_PREFIX}{state}", STATE_TTL_SECONDS, state_data)

        # Build callback URL
        callback_path = f"/api/agents/workspaces/{slug}/config/callback/{provider_slug}/"
        scheme = "https" if request.is_secure() else "http"
        redirect_uri = f"{scheme}://{request.get_host()}{callback_path}"

        # Build the authorization URL
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": oauth_config["scope"],
            "state": state,
        }

        # Google requires additional params
        if oauth_provider == "google":
            params["access_type"] = "offline"
            params["prompt"] = "consent"

        authorize_url = f"{oauth_config['authorize_url']}?{urlencode(params)}"

        return Response(
            {
                "redirect_url": authorize_url,
                "state": state,
            },
            status=status.HTTP_200_OK,
        )


class AgentOAuthCallbackEndpoint(BaseAPIView):
    """
    Handle the OAuth callback from the provider.

    Validates the state token, exchanges the authorization code for
    access/refresh tokens, encrypts them, and stores them in the
    WorkspaceAgentConfig for the corresponding provider.
    """

    # Callback may come as a browser redirect; allow unauthenticated GET
    # since we validate via the state token stored in Redis.
    permission_classes = []

    def get(self, request, slug, provider_slug):
        code = request.GET.get("code")
        state = request.GET.get("state")
        error = request.GET.get("error")

        # Handle provider-side errors
        if error:
            logger.warning(
                "OAuth callback error for %s/%s: %s",
                slug,
                provider_slug,
                error,
            )
            return HttpResponseRedirect(
                f"/{slug}/settings/agents/?error=oauth_denied"
            )

        if not code or not state:
            return HttpResponseRedirect(
                f"/{slug}/settings/agents/?error=missing_params"
            )

        # Validate state against Redis
        r = _get_redis_client()
        state_key = f"{STATE_KEY_PREFIX}{state}"
        state_data = r.get(state_key)

        if not state_data:
            logger.warning(
                "Invalid or expired OAuth state for %s/%s",
                slug,
                provider_slug,
            )
            return HttpResponseRedirect(
                f"/{slug}/settings/agents/?error=invalid_state"
            )

        # Delete the state token (one-time use)
        r.delete(state_key)

        # Parse state data: "workspace_slug:provider_slug:user_id"
        state_str = (
            state_data.decode("utf-8")
            if isinstance(state_data, bytes)
            else state_data
        )
        parts = state_str.split(":")
        if len(parts) != 3 or parts[0] != slug or parts[1] != provider_slug:
            return HttpResponseRedirect(
                f"/{slug}/settings/agents/?error=state_mismatch"
            )

        stored_user_id = parts[2]

        # Resolve provider
        try:
            provider = AgentProvider.objects.get(slug=provider_slug)
        except AgentProvider.DoesNotExist:
            return HttpResponseRedirect(
                f"/{slug}/settings/agents/?error=provider_not_found"
            )

        oauth_provider = provider.oauth_provider
        if not oauth_provider or oauth_provider not in OAUTH_PROVIDERS:
            return HttpResponseRedirect(
                f"/{slug}/settings/agents/?error=oauth_not_supported"
            )

        oauth_config = OAUTH_PROVIDERS[oauth_provider]

        # Exchange authorization code for tokens
        import os

        import requests as http_requests

        client_id = os.environ.get(oauth_config["client_id_env"], "")
        client_secret = os.environ.get(oauth_config["client_secret_env"], "")

        if not client_id or not client_secret:
            logger.error(
                "Missing OAuth credentials for %s", oauth_provider
            )
            return HttpResponseRedirect(
                f"/{slug}/settings/agents/?error=server_config"
            )

        # Build callback URL (must match what was sent in the authorize request)
        callback_path = f"/api/agents/workspaces/{slug}/config/callback/{provider_slug}/"
        scheme = "https" if request.is_secure() else "http"
        redirect_uri = f"{scheme}://{request.get_host()}{callback_path}"

        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "client_secret": client_secret,
        }

        try:
            token_response = http_requests.post(
                oauth_config["token_url"],
                data=token_data,
                headers={"Accept": "application/json"},
                timeout=30,
            )
            token_response.raise_for_status()
            tokens = token_response.json()
        except (http_requests.RequestException, ValueError) as e:
            logger.error(
                "Token exchange failed for %s/%s: %s",
                slug,
                provider_slug,
                e,
            )
            return HttpResponseRedirect(
                f"/{slug}/settings/agents/?error=token_exchange_failed"
            )

        access_token = tokens.get("access_token", "")
        refresh_token = tokens.get("refresh_token", "")

        if not access_token:
            logger.error(
                "No access_token in response for %s/%s",
                slug,
                provider_slug,
            )
            return HttpResponseRedirect(
                f"/{slug}/settings/agents/?error=no_access_token"
            )

        # Encrypt tokens and store in WorkspaceAgentConfig
        workspace = Workspace.objects.get(slug=slug)

        config, _created = WorkspaceAgentConfig.objects.get_or_create(
            workspace=workspace,
            provider=provider,
            defaults={
                "is_enabled": True,
            },
        )

        config.oauth_token_encrypted = encrypt_token(access_token)
        if refresh_token:
            config.oauth_refresh_token_encrypted = encrypt_token(
                refresh_token
            )
        config.connected_by_id = stored_user_id
        config.connected_at = timezone.now()

        # Store token expiry if provided
        expires_in = tokens.get("expires_in")
        if expires_in:
            from datetime import timedelta

            config.oauth_token_expires_at = timezone.now() + timedelta(
                seconds=int(expires_in)
            )

        config.save()

        logger.info(
            "OAuth tokens stored for workspace=%s provider=%s",
            slug,
            provider_slug,
        )

        # Redirect back to the agent settings page
        return HttpResponseRedirect(
            f"/{slug}/settings/agents/?success=connected&provider={provider_slug}"
        )
