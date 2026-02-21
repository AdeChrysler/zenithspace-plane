# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

REALTIME_CHANNEL = "plane:realtime"


def publish_realtime_event(event_type, workspace_slug, project_id=None, data=None):
    """
    Publish a real-time event to Redis for broadcasting via WebSocket.

    event_type: "issue_created", "issue_updated", "issue_deleted",
                "comment_created", "comment_updated", "comment_deleted",
                "activity_created"
    """
    try:
        from plane.settings.redis import redis_instance

        redis_url = settings.REDIS_URL
        if not redis_url:
            return

        r = redis_instance()

        payload = json.dumps({
            "event": event_type,
            "workspace_slug": str(workspace_slug),
            "project_id": str(project_id) if project_id else None,
            "data": data or {},
        })

        r.publish(REALTIME_CHANNEL, payload)
    except Exception as e:
        logger.warning(f"Failed to publish realtime event: {e}")
