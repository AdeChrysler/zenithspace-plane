# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from celery import shared_task

# Module imports
from plane.utils.realtime import publish_realtime_event
from plane.utils.exception_logger import log_exception


@shared_task
def publish_realtime_event_task(event_type, workspace_slug, project_id=None, data=None):
    """Async wrapper for publishing realtime events."""
    try:
        publish_realtime_event(event_type, workspace_slug, project_id, data)
    except Exception as e:
        log_exception(e)
