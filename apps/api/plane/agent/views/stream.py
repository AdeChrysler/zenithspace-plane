# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json

# Django imports
from django.http import StreamingHttpResponse

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.agent.models import AgentSession
from plane.agent.serializers import AgentSessionSerializer
from plane.settings.redis import redis_instance


class AgentSessionStreamEndpoint(BaseAPIView):
    """
    SSE streaming endpoint for agent session events.

    Subscribes to Redis pub/sub channel for the session and
    streams events as text/event-stream.
    """

    @allow_permission(
        allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE"
    )
    def get(self, request, slug, session_id):
        session = AgentSession.objects.get(
            id=session_id,
            workspace__slug=slug,
        )

        # If session already completed, return result as JSON
        terminal_statuses = [
            AgentSession.Status.COMPLETED,
            AgentSession.Status.FAILED,
            AgentSession.Status.CANCELLED,
            AgentSession.Status.TIMED_OUT,
        ]
        if session.status in terminal_statuses:
            serializer = AgentSessionSerializer(session)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # For active sessions, stream events via SSE
        def event_stream():
            ri = redis_instance()
            channel = f"agent:session:{session_id}"
            pubsub = ri.pubsub()
            pubsub.subscribe(channel)

            try:
                # Send initial connected event
                yield f"event: connected\ndata: {json.dumps({'session_id': str(session_id), 'status': session.status})}\n\n"

                while True:
                    message = pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=1.0
                    )
                    if message and message["type"] == "message":
                        data = message["data"]
                        if isinstance(data, bytes):
                            data = data.decode("utf-8")

                        try:
                            parsed = json.loads(data)
                            event_type = parsed.get("type", "message")
                        except (json.JSONDecodeError, AttributeError):
                            event_type = "message"
                            parsed = {"type": "message", "data": data}

                        yield f"event: {event_type}\ndata: {json.dumps(parsed)}\n\n"

                        # Break on terminal events
                        if event_type in ("done", "error"):
                            break
            finally:
                pubsub.unsubscribe(channel)
                pubsub.close()

        response = StreamingHttpResponse(
            event_stream(), content_type="text/event-stream"
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
