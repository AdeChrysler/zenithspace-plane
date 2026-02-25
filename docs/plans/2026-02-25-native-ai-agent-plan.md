# Native AI Agent Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the external orchestrator with a fully native agent system that spawns CLI tools in Docker containers, supports multiple providers via `@provider-variant:skill` mentions, and uses OAuth authentication exclusively.

**Architecture:** New `plane.agent` Django app with models for providers/variants/skills/sessions. Celery tasks orchestrate ephemeral Docker containers running CLI tools (Claude Code, Gemini CLI). Redis pub/sub streams container output to Django SSE endpoints. Frontend gets an agent mode bar on the comment editor and updated @-mention system.

**Tech Stack:** Django 4.2, Celery 5.4, docker-py, Redis pub/sub, Django SSE (StreamingHttpResponse), React/TypeScript, MobX, Tiptap editor

**Design Doc:** `docs/plans/2026-02-25-native-ai-agent-design.md`

---

## Phase 1: Backend Foundation

### Task 1: Create the `plane.agent` Django App Scaffold

**Files:**

- Create: `apps/api/plane/agent/__init__.py`
- Create: `apps/api/plane/agent/apps.py`
- Create: `apps/api/plane/agent/models/__init__.py`
- Create: `apps/api/plane/agent/views/__init__.py`
- Create: `apps/api/plane/agent/serializers/__init__.py`
- Create: `apps/api/plane/agent/urls.py`
- Modify: `apps/api/plane/settings/common.py` (INSTALLED_APPS)
- Modify: `apps/api/plane/urls.py` (URL include)

**Step 1: Create app directory structure**

```bash
mkdir -p apps/api/plane/agent/{models,views,serializers,migrations}
touch apps/api/plane/agent/__init__.py
touch apps/api/plane/agent/models/__init__.py
touch apps/api/plane/agent/views/__init__.py
touch apps/api/plane/agent/serializers/__init__.py
touch apps/api/plane/agent/migrations/__init__.py
```

**Step 2: Create apps.py**

```python
# apps/api/plane/agent/apps.py
from django.apps import AppConfig


class AgentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "plane.agent"
    verbose_name = "Agent"
```

**Step 3: Create urls.py skeleton**

```python
# apps/api/plane/agent/urls.py
from django.urls import path

urlpatterns = []
```

**Step 4: Register app in settings**

Modify `apps/api/plane/settings/common.py` — add `"plane.agent"` to `INSTALLED_APPS` list, after `"plane.app"`.

**Step 5: Include URLs in root urlpatterns**

Modify `apps/api/plane/urls.py` — add:

```python
path("api/agent/", include("plane.agent.urls")),
```

**Step 6: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): scaffold plane.agent Django app"
```

---

### Task 2: AgentProvider and AgentProviderVariant Models

**Files:**

- Create: `apps/api/plane/agent/models/provider.py`
- Modify: `apps/api/plane/agent/models/__init__.py`

**Step 1: Write the provider models**

```python
# apps/api/plane/agent/models/provider.py
from django.db import models
from plane.db.models import BaseModel


class AgentProvider(BaseModel):
    """An LLM provider that can be invoked as an agent (e.g., Claude, Gemini)."""

    slug = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=100)
    provider_group = models.CharField(max_length=100, default="")  # "Anthropic", "Google"
    cli_tool = models.CharField(max_length=100)
    docker_image = models.CharField(max_length=255)
    oauth_provider = models.CharField(max_length=50, blank=True)
    is_enabled = models.BooleanField(default=False)
    icon_url = models.URLField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "agent_providers"
        ordering = ["sort_order", "display_name"]

    def __str__(self):
        return f"{self.display_name} ({self.slug})"


class AgentProviderVariant(BaseModel):
    """A specific model tier within a provider (e.g., Opus, Sonnet, Flash)."""

    provider = models.ForeignKey(
        AgentProvider, on_delete=models.CASCADE, related_name="variants"
    )
    slug = models.CharField(max_length=50)
    display_name = models.CharField(max_length=100)
    model_id = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False)
    is_enabled = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "agent_provider_variants"
        unique_together = ["provider", "slug"]
        ordering = ["sort_order"]

    def __str__(self):
        return f"{self.display_name} ({self.model_id})"
```

**Step 2: Export from models/**init**.py**

```python
# apps/api/plane/agent/models/__init__.py
from .provider import AgentProvider, AgentProviderVariant
```

**Step 3: Generate and run migration**

```bash
python apps/api/manage.py makemigrations agent
python apps/api/manage.py migrate
```

**Step 4: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): add AgentProvider and AgentProviderVariant models"
```

---

### Task 3: WorkspaceAgentConfig Model (OAuth Token Storage)

**Files:**

- Create: `apps/api/plane/agent/models/config.py`
- Modify: `apps/api/plane/agent/models/__init__.py`

**Step 1: Write the config model**

```python
# apps/api/plane/agent/models/config.py
from django.conf import settings
from django.db import models
from plane.db.models import BaseModel


class WorkspaceAgentConfig(BaseModel):
    """Per-workspace, per-provider agent configuration with encrypted OAuth tokens."""

    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="agent_configs"
    )
    provider = models.ForeignKey(
        "agent.AgentProvider", on_delete=models.CASCADE, related_name="workspace_configs"
    )
    is_enabled = models.BooleanField(default=True)
    oauth_token_encrypted = models.TextField(blank=True, default="")
    oauth_refresh_token_encrypted = models.TextField(blank=True, default="")
    oauth_token_expires_at = models.DateTimeField(null=True, blank=True)
    max_concurrent_sessions = models.IntegerField(default=3)
    timeout_minutes = models.IntegerField(default=15)
    connected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_connections",
    )
    connected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "agent_workspace_configs"
        unique_together = ["workspace", "provider"]

    def __str__(self):
        return f"{self.workspace} - {self.provider}"
```

**Step 2: Update models/**init**.py**

```python
# apps/api/plane/agent/models/__init__.py
from .provider import AgentProvider, AgentProviderVariant
from .config import WorkspaceAgentConfig
```

**Step 3: Generate and run migration**

```bash
python apps/api/manage.py makemigrations agent
python apps/api/manage.py migrate
```

**Step 4: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): add WorkspaceAgentConfig model with encrypted OAuth tokens"
```

---

### Task 4: AgentSkill Model

**Files:**

- Create: `apps/api/plane/agent/models/skill.py`
- Modify: `apps/api/plane/agent/models/__init__.py`

**Step 1: Write the skill model**

```python
# apps/api/plane/agent/models/skill.py
from django.conf import settings
from django.db import models
from plane.db.models import BaseModel


class AgentSkill(BaseModel):
    """A custom agent skill/workflow, stored in DB (overlays repo-based skills)."""

    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="agent_skills"
    )
    project = models.ForeignKey(
        "db.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="agent_skills",
    )
    name = models.CharField(max_length=255)
    trigger = models.SlugField(max_length=50)
    description = models.TextField(blank=True, default="")
    instructions = models.TextField()
    default_provider = models.CharField(max_length=100, blank=True, default="")
    mode = models.CharField(
        max_length=20,
        default="autonomous",
        choices=[("autonomous", "Autonomous"), ("comment_only", "Comment Only")],
    )
    tools = models.JSONField(default=list)
    timeout_minutes = models.IntegerField(default=15)
    context_paths = models.JSONField(default=list)
    is_enabled = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_agent_skills",
    )

    class Meta:
        db_table = "agent_skills"
        unique_together = ["workspace", "trigger"]

    def __str__(self):
        return f"{self.name} (@{self.trigger})"
```

**Step 2: Update models/**init**.py**

```python
# apps/api/plane/agent/models/__init__.py
from .provider import AgentProvider, AgentProviderVariant
from .config import WorkspaceAgentConfig
from .skill import AgentSkill
```

**Step 3: Generate and run migration**

```bash
python apps/api/manage.py makemigrations agent
python apps/api/manage.py migrate
```

**Step 4: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): add AgentSkill model for custom workflows"
```

---

### Task 5: AgentSession Model

**Files:**

- Create: `apps/api/plane/agent/models/session.py`
- Modify: `apps/api/plane/agent/models/__init__.py`

**Step 1: Write the session model**

```python
# apps/api/plane/agent/models/session.py
from django.conf import settings
from django.db import models
from plane.db.models import BaseModel


class AgentSession(BaseModel):
    """Tracks a single agent invocation from trigger to completion."""

    class Status(models.TextChoices):
        PENDING = "pending"
        PROVISIONING = "provisioning"
        RUNNING = "running"
        STREAMING = "streaming"
        COMPLETED = "completed"
        FAILED = "failed"
        CANCELLED = "cancelled"
        TIMED_OUT = "timed_out"

    # Context
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="agent_sessions"
    )
    project = models.ForeignKey(
        "db.Project", on_delete=models.CASCADE, related_name="agent_sessions"
    )
    issue = models.ForeignKey(
        "db.Issue", on_delete=models.CASCADE, related_name="agent_sessions"
    )
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="triggered_agent_sessions",
    )
    trigger_comment = models.ForeignKey(
        "db.IssueComment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_sessions",
    )

    # Agent configuration
    provider_slug = models.CharField(max_length=50)
    variant_slug = models.CharField(max_length=50)
    model_id = models.CharField(max_length=100)
    skill_trigger = models.CharField(max_length=50, null=True, blank=True)
    comment_text = models.TextField(default="")

    # Runtime
    container_id = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    timeout_minutes = models.IntegerField(default=15)

    # Results
    response_text = models.TextField(null=True, blank=True)
    response_html = models.TextField(null=True, blank=True)
    branch_name = models.CharField(max_length=255, null=True, blank=True)
    pull_request_url = models.URLField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

    # Metrics
    tokens_used = models.IntegerField(default=0)
    estimated_cost_usd = models.DecimalField(
        max_digits=10, decimal_places=4, default=0
    )
    duration_seconds = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "agent_sessions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.provider_slug}-{self.variant_slug} on {self.issue} ({self.status})"
```

**Step 2: Update models/**init**.py**

```python
# apps/api/plane/agent/models/__init__.py
from .provider import AgentProvider, AgentProviderVariant
from .config import WorkspaceAgentConfig
from .skill import AgentSkill
from .session import AgentSession
```

**Step 3: Generate and run migration**

```bash
python apps/api/manage.py makemigrations agent
python apps/api/manage.py migrate
```

**Step 4: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): add AgentSession model for tracking invocations"
```

---

### Task 6: Seed Data Migration for Default Providers

**Files:**

- Create: `apps/api/plane/agent/migrations/0005_seed_providers.py` (number depends on previous migrations)

**Step 1: Write the data migration**

```python
# apps/api/plane/agent/migrations/0005_seed_providers.py
from django.db import migrations


def seed_providers(apps, schema_editor):
    AgentProvider = apps.get_model("agent", "AgentProvider")
    AgentProviderVariant = apps.get_model("agent", "AgentProviderVariant")

    # Claude
    claude = AgentProvider.objects.create(
        slug="claude",
        display_name="Claude",
        provider_group="Anthropic",
        cli_tool="claude",
        docker_image="plane/agent-claude:latest",
        oauth_provider="anthropic",
        is_enabled=False,
        sort_order=0,
    )
    for sort, (slug, name, model_id, default) in enumerate([
        ("opus", "Claude Opus", "claude-opus-4-6", False),
        ("sonnet", "Claude Sonnet", "claude-sonnet-4-6", True),
        ("haiku", "Claude Haiku", "claude-haiku-4-5", False),
    ]):
        AgentProviderVariant.objects.create(
            provider=claude,
            slug=slug,
            display_name=name,
            model_id=model_id,
            is_default=default,
            sort_order=sort,
        )

    # Gemini
    gemini = AgentProvider.objects.create(
        slug="gemini",
        display_name="Gemini",
        provider_group="Google",
        cli_tool="gemini",
        docker_image="plane/agent-gemini:latest",
        oauth_provider="google",
        is_enabled=False,
        sort_order=1,
    )
    for sort, (slug, name, model_id, default) in enumerate([
        ("pro", "Gemini Pro", "gemini-2.5-pro", True),
        ("flash", "Gemini Flash", "gemini-2.0-flash", False),
    ]):
        AgentProviderVariant.objects.create(
            provider=gemini,
            slug=slug,
            display_name=name,
            model_id=model_id,
            is_default=default,
            sort_order=sort,
        )


def reverse_seed(apps, schema_editor):
    AgentProvider = apps.get_model("agent", "AgentProvider")
    AgentProvider.objects.filter(slug__in=["claude", "gemini"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("agent", "0004_agentsession"),  # adjust to actual migration name
    ]

    operations = [
        migrations.RunPython(seed_providers, reverse_seed),
    ]
```

**Step 2: Run migration**

```bash
python apps/api/manage.py migrate agent
```

**Step 3: Commit**

```bash
git add apps/api/plane/agent/migrations/ && git commit -m "feat(agent): seed default Claude and Gemini providers"
```

---

### Task 7: Serializers for Provider, Skill, Session

**Files:**

- Create: `apps/api/plane/agent/serializers/provider.py`
- Create: `apps/api/plane/agent/serializers/skill.py`
- Create: `apps/api/plane/agent/serializers/session.py`
- Modify: `apps/api/plane/agent/serializers/__init__.py`

**Step 1: Write provider serializers**

```python
# apps/api/plane/agent/serializers/provider.py
from rest_framework import serializers
from plane.agent.models import AgentProvider, AgentProviderVariant


class AgentProviderVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentProviderVariant
        fields = ["id", "slug", "display_name", "model_id", "is_default", "is_enabled", "sort_order"]
        read_only_fields = ["id"]


class AgentProviderSerializer(serializers.ModelSerializer):
    variants = AgentProviderVariantSerializer(many=True, read_only=True)

    class Meta:
        model = AgentProvider
        fields = [
            "id", "slug", "display_name", "provider_group", "cli_tool",
            "docker_image", "oauth_provider", "is_enabled", "icon_url",
            "sort_order", "variants",
        ]
        read_only_fields = ["id"]
```

**Step 2: Write skill serializer**

```python
# apps/api/plane/agent/serializers/skill.py
from rest_framework import serializers
from plane.agent.models import AgentSkill


class AgentSkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSkill
        fields = [
            "id", "workspace", "project", "name", "trigger", "description",
            "instructions", "default_provider", "mode", "tools",
            "timeout_minutes", "context_paths", "is_enabled", "created_by",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "workspace", "created_by", "created_at", "updated_at"]
```

**Step 3: Write session serializer**

```python
# apps/api/plane/agent/serializers/session.py
from rest_framework import serializers
from plane.agent.models import AgentSession


class AgentSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSession
        fields = [
            "id", "workspace", "project", "issue", "triggered_by",
            "trigger_comment", "provider_slug", "variant_slug", "model_id",
            "skill_trigger", "comment_text", "container_id", "status",
            "started_at", "completed_at", "timeout_minutes", "response_text",
            "response_html", "branch_name", "pull_request_url", "error_message",
            "tokens_used", "estimated_cost_usd", "duration_seconds",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "workspace", "triggered_by", "container_id", "status",
            "started_at", "completed_at", "response_text", "response_html",
            "branch_name", "pull_request_url", "error_message",
            "tokens_used", "estimated_cost_usd", "duration_seconds",
            "created_at", "updated_at",
        ]
```

**Step 4: Update serializers/**init**.py**

```python
# apps/api/plane/agent/serializers/__init__.py
from .provider import AgentProviderSerializer, AgentProviderVariantSerializer
from .skill import AgentSkillSerializer
from .session import AgentSessionSerializer
```

**Step 5: Commit**

```bash
git add apps/api/plane/agent/serializers/ && git commit -m "feat(agent): add serializers for provider, skill, and session models"
```

---

### Task 8: Provider List and Config API Views

**Files:**

- Create: `apps/api/plane/agent/views/provider.py`
- Create: `apps/api/plane/agent/views/config.py`
- Modify: `apps/api/plane/agent/views/__init__.py`
- Modify: `apps/api/plane/agent/urls.py`

**Step 1: Write provider list view**

```python
# apps/api/plane/agent/views/provider.py
from rest_framework import status
from rest_framework.response import Response
from plane.app.permissions import ROLE, allow_permission
from plane.app.views import BaseAPIView
from plane.agent.models import AgentProvider
from plane.agent.serializers import AgentProviderSerializer


class AgentProviderListEndpoint(BaseAPIView):
    """List all enabled agent providers with their variants."""

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        providers = AgentProvider.objects.filter(
            is_enabled=True
        ).prefetch_related("variants")
        serializer = AgentProviderSerializer(providers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
```

**Step 2: Write config view**

```python
# apps/api/plane/agent/views/config.py
from rest_framework import status
from rest_framework.response import Response
from plane.app.permissions import ROLE, allow_permission
from plane.app.views import BaseAPIView
from plane.agent.models import WorkspaceAgentConfig, AgentProvider
from plane.db.models import Workspace


class WorkspaceAgentConfigEndpoint(BaseAPIView):
    """Get/update workspace agent configuration."""

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def get(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        configs = WorkspaceAgentConfig.objects.filter(
            workspace=workspace
        ).select_related("provider")

        result = []
        for config in configs:
            result.append({
                "provider_slug": config.provider.slug,
                "provider_name": config.provider.display_name,
                "is_enabled": config.is_enabled,
                "has_token": bool(config.oauth_token_encrypted),
                "max_concurrent_sessions": config.max_concurrent_sessions,
                "timeout_minutes": config.timeout_minutes,
                "connected_at": config.connected_at,
            })

        return Response(result, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def put(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        provider_slug = request.data.get("provider_slug")
        if not provider_slug:
            return Response(
                {"error": "provider_slug is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            provider = AgentProvider.objects.get(slug=provider_slug)
        except AgentProvider.DoesNotExist:
            return Response(
                {"error": f"Provider '{provider_slug}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        config, _ = WorkspaceAgentConfig.objects.get_or_create(
            workspace=workspace,
            provider=provider,
        )

        if "is_enabled" in request.data:
            config.is_enabled = request.data["is_enabled"]
        if "max_concurrent_sessions" in request.data:
            config.max_concurrent_sessions = request.data["max_concurrent_sessions"]
        if "timeout_minutes" in request.data:
            config.timeout_minutes = request.data["timeout_minutes"]

        config.save()

        return Response({"status": "ok"}, status=status.HTTP_200_OK)
```

**Step 3: Update views/**init**.py**

```python
# apps/api/plane/agent/views/__init__.py
from .provider import AgentProviderListEndpoint
from .config import WorkspaceAgentConfigEndpoint
```

**Step 4: Wire up URLs**

```python
# apps/api/plane/agent/urls.py
from django.urls import path
from plane.agent.views import (
    AgentProviderListEndpoint,
    WorkspaceAgentConfigEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/providers/",
        AgentProviderListEndpoint.as_view(),
        name="agent-providers",
    ),
    path(
        "workspaces/<str:slug>/config/",
        WorkspaceAgentConfigEndpoint.as_view(),
        name="agent-config",
    ),
]
```

**Step 5: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): add provider list and workspace config API endpoints"
```

---

### Task 9: Skill CRUD API Views

**Files:**

- Create: `apps/api/plane/agent/views/skill.py`
- Modify: `apps/api/plane/agent/views/__init__.py`
- Modify: `apps/api/plane/agent/urls.py`

**Step 1: Write skill views**

```python
# apps/api/plane/agent/views/skill.py
from rest_framework import status
from rest_framework.response import Response
from plane.app.permissions import ROLE, allow_permission
from plane.app.views import BaseAPIView
from plane.agent.models import AgentSkill
from plane.agent.serializers import AgentSkillSerializer
from plane.db.models import Workspace


class AgentSkillListCreateEndpoint(BaseAPIView):
    """List and create agent skills for a workspace."""

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        project_id = request.query_params.get("project_id")

        skills = AgentSkill.objects.filter(workspace=workspace, is_enabled=True)
        if project_id:
            skills = skills.filter(
                models.Q(project_id=project_id) | models.Q(project__isnull=True)
            )

        serializer = AgentSkillSerializer(skills, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)
        serializer = AgentSkillSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace=workspace, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AgentSkillDetailEndpoint(BaseAPIView):
    """Update and delete agent skills."""

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def put(self, request, slug, pk):
        workspace = Workspace.objects.get(slug=slug)
        try:
            skill = AgentSkill.objects.get(pk=pk, workspace=workspace)
        except AgentSkill.DoesNotExist:
            return Response(
                {"error": "Skill not found"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = AgentSkillSerializer(skill, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN], level="WORKSPACE")
    def delete(self, request, slug, pk):
        workspace = Workspace.objects.get(slug=slug)
        try:
            skill = AgentSkill.objects.get(pk=pk, workspace=workspace)
        except AgentSkill.DoesNotExist:
            return Response(
                {"error": "Skill not found"}, status=status.HTTP_404_NOT_FOUND
            )
        skill.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

**Step 2: Update views/**init**.py and urls.py**

Add imports and URL patterns for `AgentSkillListCreateEndpoint` and `AgentSkillDetailEndpoint`:

```python
# urls.py additions
path("workspaces/<str:slug>/skills/", AgentSkillListCreateEndpoint.as_view(), name="agent-skills"),
path("workspaces/<str:slug>/skills/<uuid:pk>/", AgentSkillDetailEndpoint.as_view(), name="agent-skill-detail"),
```

**Step 3: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): add skill CRUD API endpoints"
```

---

### Task 10: Agent Invoke View and Session Creation

**Files:**

- Create: `apps/api/plane/agent/views/invoke.py`
- Modify: `apps/api/plane/agent/views/__init__.py`
- Modify: `apps/api/plane/agent/urls.py`

**Step 1: Write invoke view**

This is the core endpoint that receives an agent invocation request, validates the provider/variant, creates an AgentSession, and queues the Celery task.

```python
# apps/api/plane/agent/views/invoke.py
from rest_framework import status
from rest_framework.response import Response
from plane.app.permissions import ROLE, allow_permission
from plane.app.views import BaseAPIView
from plane.agent.models import (
    AgentProvider,
    AgentProviderVariant,
    AgentSession,
    WorkspaceAgentConfig,
)
from plane.agent.serializers import AgentSessionSerializer
from plane.db.models import Workspace, Project, Issue


class AgentInvokeEndpoint(BaseAPIView):
    """Invoke an agent: validate, create session, queue Celery task."""

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)

        # Required fields
        provider_slug = request.data.get("provider_slug")
        variant_slug = request.data.get("variant_slug")
        project_id = request.data.get("project_id")
        issue_id = request.data.get("issue_id")
        comment_text = request.data.get("comment_text", "")

        if not all([provider_slug, project_id, issue_id]):
            return Response(
                {"error": "provider_slug, project_id, and issue_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve provider
        try:
            provider = AgentProvider.objects.get(slug=provider_slug, is_enabled=True)
        except AgentProvider.DoesNotExist:
            return Response(
                {"error": f"Provider '{provider_slug}' not found or disabled"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Resolve variant (use default if not specified)
        if variant_slug:
            try:
                variant = AgentProviderVariant.objects.get(
                    provider=provider, slug=variant_slug, is_enabled=True
                )
            except AgentProviderVariant.DoesNotExist:
                return Response(
                    {"error": f"Variant '{variant_slug}' not found for {provider_slug}"},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            variant = AgentProviderVariant.objects.filter(
                provider=provider, is_default=True, is_enabled=True
            ).first()
            if not variant:
                return Response(
                    {"error": f"No default variant for {provider_slug}"},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Check workspace config exists and has OAuth token
        try:
            config = WorkspaceAgentConfig.objects.get(
                workspace=workspace, provider=provider, is_enabled=True
            )
        except WorkspaceAgentConfig.DoesNotExist:
            return Response(
                {"error": f"Provider '{provider_slug}' not configured for this workspace"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not config.oauth_token_encrypted:
            return Response(
                {"error": f"No OAuth token configured for {provider_slug}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check concurrent session limit
        active_count = AgentSession.objects.filter(
            workspace=workspace,
            status__in=[
                AgentSession.Status.PENDING,
                AgentSession.Status.PROVISIONING,
                AgentSession.Status.RUNNING,
                AgentSession.Status.STREAMING,
            ],
        ).count()

        if active_count >= config.max_concurrent_sessions:
            return Response(
                {"error": "Maximum concurrent agent sessions reached"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Validate project and issue exist
        try:
            project = Project.objects.get(pk=project_id, workspace=workspace)
            issue = Issue.objects.get(pk=issue_id, project=project)
        except (Project.DoesNotExist, Issue.DoesNotExist):
            return Response(
                {"error": "Project or issue not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Create session
        session = AgentSession.objects.create(
            workspace=workspace,
            project=project,
            issue=issue,
            triggered_by=request.user,
            trigger_comment_id=request.data.get("comment_id"),
            provider_slug=provider_slug,
            variant_slug=variant.slug,
            model_id=variant.model_id,
            skill_trigger=request.data.get("skill_trigger"),
            comment_text=comment_text,
            timeout_minutes=config.timeout_minutes,
        )

        # Queue Celery task (Task 12)
        from plane.agent.tasks import run_agent_task
        run_agent_task.delay(str(session.id))

        serializer = AgentSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
```

**Step 2: Add session detail and cancel views**

```python
# Add to invoke.py

class AgentSessionDetailEndpoint(BaseAPIView):
    """Get session status/result."""

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug, session_id):
        try:
            session = AgentSession.objects.get(pk=session_id, workspace__slug=slug)
        except AgentSession.DoesNotExist:
            return Response(
                {"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND
            )
        serializer = AgentSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AgentSessionCancelEndpoint(BaseAPIView):
    """Cancel a running session."""

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug, session_id):
        try:
            session = AgentSession.objects.get(pk=session_id, workspace__slug=slug)
        except AgentSession.DoesNotExist:
            return Response(
                {"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if session.status not in [
            AgentSession.Status.PENDING,
            AgentSession.Status.PROVISIONING,
            AgentSession.Status.RUNNING,
            AgentSession.Status.STREAMING,
        ]:
            return Response(
                {"error": "Session is not active"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Kill container if running
        if session.container_id:
            try:
                import docker
                client = docker.from_env()
                container = client.containers.get(session.container_id)
                container.kill()
            except Exception:
                pass

        session.status = AgentSession.Status.CANCELLED
        session.save(update_fields=["status"])

        return Response({"status": "cancelled"}, status=status.HTTP_200_OK)
```

**Step 3: Update views/**init**.py and urls.py**

```python
# urls.py additions
path("workspaces/<str:slug>/invoke/", AgentInvokeEndpoint.as_view(), name="agent-invoke"),
path("workspaces/<str:slug>/sessions/<uuid:session_id>/", AgentSessionDetailEndpoint.as_view(), name="agent-session-detail"),
path("workspaces/<str:slug>/sessions/<uuid:session_id>/cancel/", AgentSessionCancelEndpoint.as_view(), name="agent-session-cancel"),
```

**Step 4: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): add invoke, session detail, and cancel API endpoints"
```

---

### Task 11: SSE Streaming Endpoint

**Files:**

- Create: `apps/api/plane/agent/views/stream.py`
- Modify: `apps/api/plane/agent/views/__init__.py`
- Modify: `apps/api/plane/agent/urls.py`

**Step 1: Write SSE streaming view**

This endpoint subscribes to the Redis pub/sub channel for a session and streams chunks to the frontend using Django's `StreamingHttpResponse`.

```python
# apps/api/plane/agent/views/stream.py
import json
import time

import redis
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views import BaseAPIView
from plane.agent.models import AgentSession


def _get_redis_client():
    """Get a Redis client from the configured URL."""
    return redis.from_url(settings.REDIS_URL)


class AgentSessionStreamEndpoint(BaseAPIView):
    """SSE endpoint that streams agent output from Redis pub/sub."""

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug, session_id):
        try:
            session = AgentSession.objects.get(pk=session_id, workspace__slug=slug)
        except AgentSession.DoesNotExist:
            return Response(
                {"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # If session is already completed, return the final result
        if session.status in [
            AgentSession.Status.COMPLETED,
            AgentSession.Status.FAILED,
            AgentSession.Status.CANCELLED,
            AgentSession.Status.TIMED_OUT,
        ]:
            return Response(
                {
                    "status": session.status,
                    "response_text": session.response_text,
                    "error_message": session.error_message,
                },
                status=status.HTTP_200_OK,
            )

        def event_stream():
            r = _get_redis_client()
            pubsub = r.pubsub()
            channel = f"agent:session:{session_id}"
            pubsub.subscribe(channel)

            try:
                # Send initial connection event
                yield f"data: {json.dumps({'type': 'connected', 'content': str(session_id)})}\n\n"

                timeout_at = time.time() + (session.timeout_minutes * 60) + 60
                while time.time() < timeout_at:
                    message = pubsub.get_message(timeout=1.0)
                    if message and message["type"] == "message":
                        data = message["data"]
                        if isinstance(data, bytes):
                            data = data.decode("utf-8")
                        yield f"data: {data}\n\n"

                        # Check for terminal events
                        try:
                            parsed = json.loads(data)
                            if parsed.get("type") in ("done", "error"):
                                break
                        except (json.JSONDecodeError, KeyError):
                            pass

                # Send timeout if we hit the limit
                yield f"data: {json.dumps({'type': 'error', 'content': 'Stream timeout'})}\n\n"

            finally:
                pubsub.unsubscribe(channel)
                pubsub.close()

        response = StreamingHttpResponse(
            event_stream(), content_type="text/event-stream"
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
```

**Step 2: Update views/**init**.py and urls.py**

```python
# urls.py addition
path(
    "workspaces/<str:slug>/sessions/<uuid:session_id>/stream/",
    AgentSessionStreamEndpoint.as_view(),
    name="agent-session-stream",
),
```

**Step 3: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): add SSE streaming endpoint via Redis pub/sub"
```

---

### Task 12: Celery Task — Docker Container Orchestration

**Files:**

- Create: `apps/api/plane/agent/tasks.py`
- Modify: `apps/api/requirements/base.txt` (add `docker`)

**Step 1: Add docker-py to requirements**

Add `docker>=7.0.0` to `apps/api/requirements/base.txt`.

**Step 2: Write the Celery task**

```python
# apps/api/plane/agent/tasks.py
import json
import logging
import time

import docker
import redis
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from plane.agent.models import AgentSession, AgentSkill, WorkspaceAgentConfig
from plane.utils.exception_logger import log_exception

logger = logging.getLogger(__name__)


def _get_redis_client():
    return redis.from_url(settings.REDIS_URL)


def _publish_chunk(redis_client, session_id, chunk_type, content):
    """Publish a chunk to the session's Redis channel."""
    channel = f"agent:session:{session_id}"
    data = json.dumps({"type": chunk_type, "content": content})
    redis_client.publish(channel, data)


def _decrypt_token(encrypted_token):
    """Decrypt an OAuth token. Uses Fernet symmetric encryption."""
    # For now, return as-is. In production, implement proper Fernet decryption
    # using SECRET_KEY-derived key.
    # TODO: Implement proper encryption/decryption
    return encrypted_token


@shared_task(bind=True, max_retries=1, time_limit=1800, soft_time_limit=1740)
def run_agent_task(self, session_id):
    """
    Main Celery task: spin up a Docker container, stream output,
    and update the session on completion.
    """
    r = _get_redis_client()
    session = None

    try:
        session = AgentSession.objects.select_related(
            "workspace", "project", "issue"
        ).get(pk=session_id)

        # Update status
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
                pass

        # Build environment for container
        env = {
            "PROVIDER_SLUG": session.provider_slug,
            "VARIANT_SLUG": session.variant_slug,
            "MODEL_ID": session.model_id,
            "CLI_TOOL": config.provider.cli_tool,
            "SESSION_ID": str(session.id),
            "ISSUE_TITLE": session.issue.name or "",
            "ISSUE_DESCRIPTION": session.issue.description_html or "",
            "COMMENT_TEXT": session.comment_text,
            "SKILL_INSTRUCTIONS": skill_instructions,
            "SKILL_TRIGGER": session.skill_trigger or "",
            # OAuth tokens as env vars — never persisted in container
            "ANTHROPIC_API_KEY": oauth_token if session.provider_slug == "claude" else "",
            "GOOGLE_API_KEY": oauth_token if session.provider_slug == "gemini" else "",
            # GitHub token for git operations (from workspace GitHub integration)
            # TODO: Get user's GitHub OAuth token from Account model
            "GITHUB_TOKEN": "",
        }

        # Create and start container
        docker_client = docker.from_env()
        _publish_chunk(r, session_id, "plan", json.dumps([
            "Provisioning container",
            "Loading issue context",
            "Running agent",
            "Processing results",
        ]))

        container = docker_client.containers.run(
            image=config.provider.docker_image,
            environment=env,
            mem_limit="2g",
            cpu_period=100000,
            cpu_quota=100000,
            network_mode="bridge",
            detach=True,
            auto_remove=False,  # We need to inspect exit code
        )

        session.container_id = container.id
        session.status = AgentSession.Status.RUNNING
        session.save(update_fields=["container_id", "status"])
        _publish_chunk(r, session_id, "status", "running")

        # Stream container logs
        session.status = AgentSession.Status.STREAMING
        session.save(update_fields=["status"])

        full_response = ""
        for chunk in container.logs(stream=True, follow=True):
            text = chunk.decode("utf-8", errors="replace")
            full_response += text
            _publish_chunk(r, session_id, "text", text)

        # Wait for container to finish
        result = container.wait(timeout=session.timeout_minutes * 60)
        exit_code = result.get("StatusCode", -1)

        # Check for PR URL in output
        pr_url = None
        for line in full_response.split("\n"):
            if line.startswith("PR_URL="):
                pr_url = line.split("=", 1)[1].strip()
                break

        # Update session with results
        session.status = (
            AgentSession.Status.COMPLETED if exit_code == 0
            else AgentSession.Status.FAILED
        )
        session.completed_at = timezone.now()
        session.response_text = full_response
        session.response_html = full_response.replace("\n", "<br/>")
        session.pull_request_url = pr_url
        if session.started_at:
            session.duration_seconds = int(
                (session.completed_at - session.started_at).total_seconds()
            )
        session.save()

        _publish_chunk(r, session_id, "done", "")

        # Cleanup container
        try:
            container.remove(force=True)
        except Exception:
            pass

    except Exception as e:
        log_exception(e)
        if session:
            session.status = AgentSession.Status.FAILED
            session.error_message = str(e)
            session.completed_at = timezone.now()
            session.save(update_fields=["status", "error_message", "completed_at"])
        _publish_chunk(r, session_id, "error", str(e))
        _publish_chunk(r, session_id, "done", "")
```

**Step 3: Commit**

```bash
git add apps/api/plane/agent/tasks.py apps/api/requirements/ && git commit -m "feat(agent): add Celery task for Docker container orchestration"
```

---

### Task 13: Docker Agent Images

**Files:**

- Create: `docker/agent-claude/Dockerfile`
- Create: `docker/agent-claude/entrypoint.sh`
- Create: `docker/agent-gemini/Dockerfile`
- Create: `docker/agent-gemini/entrypoint.sh`

**Step 1: Create Claude agent image**

```dockerfile
# docker/agent-claude/Dockerfile
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/*

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /work
ENTRYPOINT ["/entrypoint.sh"]
```

```bash
#!/bin/bash
# docker/agent-claude/entrypoint.sh
set -euo pipefail

echo "=== Plane Agent: ${PROVIDER_SLUG}-${VARIANT_SLUG} ==="
echo "Session: ${SESSION_ID}"
echo "Model: ${MODEL_ID}"

# Configure git
git config --global user.name "Plane Agent"
git config --global user.email "agent@plane.so"

# If GitHub token provided, clone and branch
if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${REPO_FULL_NAME:-}" ]; then
    git clone "https://oauth2:${GITHUB_TOKEN}@github.com/${REPO_FULL_NAME}.git" /work/repo
    cd /work/repo
    BRANCH="agent/${SESSION_ID}"
    git checkout -b "$BRANCH"
fi

# Build the prompt
PROMPT="Issue: ${ISSUE_TITLE}

${ISSUE_DESCRIPTION}

${SKILL_INSTRUCTIONS}

User request: ${COMMENT_TEXT}"

# Run Claude Code
claude --model "${MODEL_ID}" --print "$PROMPT"

# If we have a repo and changes were made, push and create PR
if [ -n "${GITHUB_TOKEN:-}" ] && [ -d "/work/repo/.git" ]; then
    cd /work/repo
    if [ -n "$(git status --porcelain)" ]; then
        git add -A
        git commit -m "agent(${PROVIDER_SLUG}): ${ISSUE_TITLE}"
        git push origin "$BRANCH"
        PR_URL=$(gh pr create \
            --title "agent(${PROVIDER_SLUG}): ${ISSUE_TITLE}" \
            --body "Automated by Plane AI Agent

Resolves: #${ISSUE_NUMBER:-}
Provider: ${PROVIDER_SLUG}-${VARIANT_SLUG}
Skill: ${SKILL_TRIGGER:-none}" \
            --head "$BRANCH" 2>&1 || echo "")
        if [ -n "$PR_URL" ]; then
            echo "PR_URL=${PR_URL}"
        fi
    else
        echo "No changes to commit."
    fi
fi
```

**Step 2: Create Gemini agent image** (same pattern, swap CLI tool)

```dockerfile
# docker/agent-gemini/Dockerfile
FROM node:22-slim
# ... same as claude but: RUN npm install -g @anthropic-ai/gemini-cli
```

Entrypoint is the same structure, substituting `gemini` for `claude` CLI invocation.

**Step 3: Add Docker socket mount to docker-compose**

Modify `docker-compose.yml` and `docker-compose-local.yml` — add to the `worker` service:

```yaml
worker:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
```

**Step 4: Commit**

```bash
git add docker/agent-claude/ docker/agent-gemini/ docker-compose*.yml && git commit -m "feat(agent): add Docker images for Claude and Gemini CLI agents"
```

---

## Phase 2: Frontend Agent Mode

### Task 14: Agent MobX Store

**Files:**

- Create: `apps/web/core/stores/agent.store.ts`
- Modify: `apps/web/core/store/root.store.ts` (register store)

**Step 1: Create the agent store**

This store manages provider list, skills, active sessions, and agent mode state. Uses MobX observables and follows the existing store pattern from `root.store.ts`.

Key responsibilities:

- Fetch and cache provider list from `/api/agent/workspaces/{slug}/providers/`
- Fetch and cache skills from `/api/agent/workspaces/{slug}/skills/`
- Track active agent sessions per issue
- Manage agent mode bar state (selected providers, selected skill)

Follow the exact MobX store pattern from `apps/web/core/store/root.store.ts` — class-based with `makeObservable`, interface-first.

**Step 2: Register in root store**

Add `agent: IAgentStore` to `CoreRootStore` interface and constructor in `apps/web/core/store/root.store.ts`.

**Step 3: Commit**

```bash
git add apps/web/core/stores/agent.store.ts apps/web/core/store/root.store.ts && git commit -m "feat(agent): add MobX agent store for providers, skills, and sessions"
```

---

### Task 15: Agent Service — Replace External Orchestrator

**Files:**

- Modify: `apps/web/core/services/agent.service.ts`

**Step 1: Rewrite agent service**

Replace the hardcoded `ORCHESTRATOR_URL` with calls to the Django backend. The service should:

- `fetchProviders(workspaceSlug)` → `GET /api/agent/workspaces/{slug}/providers/`
- `fetchSkills(workspaceSlug, projectId?)` → `GET /api/agent/workspaces/{slug}/skills/`
- `invokeAgent(workspaceSlug, payload)` → `POST /api/agent/workspaces/{slug}/invoke/`
- `streamSession(workspaceSlug, sessionId, onChunk, onComplete, onError, signal?)` → `GET /api/agent/workspaces/{slug}/sessions/{id}/stream/` (SSE)
- `getSession(workspaceSlug, sessionId)` → `GET /api/agent/workspaces/{slug}/sessions/{id}/`
- `cancelSession(workspaceSlug, sessionId)` → `POST /api/agent/workspaces/{slug}/sessions/{id}/cancel/`

Keep the SSE streaming pattern (ReadableStream + text/event-stream parsing) but point it at the Django endpoint instead of the external orchestrator.

**Step 2: Update types**

Replace `TAgentRequest` with the new invoke payload format:

```typescript
export type TAgentInvokeRequest = {
  provider_slug: string;
  variant_slug?: string;
  skill_trigger?: string;
  project_id: string;
  issue_id: string;
  comment_text: string;
  comment_id?: string;
};
```

**Step 3: Commit**

```bash
git add apps/web/core/services/agent.service.ts && git commit -m "feat(agent): replace external orchestrator with Django backend API calls"
```

---

### Task 16: Update Mention System for Multi-Provider

**Files:**

- Modify: `apps/web/ce/hooks/use-additional-editor-mention.tsx`
- Modify: `apps/web/core/hooks/use-agent-mention.tsx`

**Step 1: Update additional editor mentions**

Replace the hardcoded "ZenithAgent" with dynamically loaded providers from the agent store. Each enabled provider+variant becomes a mentionable entity:

```typescript
// Instead of one "zenith-agent" item, generate from store:
const agentItems = providers.flatMap((provider) =>
  provider.variants
    .filter((v) => v.is_enabled)
    .map((variant) => ({
      id: `${provider.slug}-${variant.slug}`,
      entity_identifier: `${provider.slug}-${variant.slug}`,
      entity_name: "agent_mention",
      title: variant.display_name, // "Claude Opus"
      subTitle: provider.provider_group, // "Anthropic"
      icon: <Bot className="size-4 text-primary" />,
    }))
);
```

Group by `provider_group` in the dropdown sections.

**Step 2: Update agent mention detection**

Modify `use-agent-mention.tsx` to:

- Detect `entity_name="agent_mention"` instead of "zenith-agent"
- Parse the `entity_identifier` to extract provider_slug and variant_slug
- Support multiple mentions (multiple agents) in one comment
- For each detected agent, create a separate invoke request

The `checkForAgentMention` function should return an array of `TAgentInvokeRequest` instead of a single request.

**Step 3: Update activity-comment-root.tsx**

Change agent comment detection from `data-agent="zenith-agent"` to `data-agent-provider` attribute (set by the backend when posting agent responses).

**Step 4: Commit**

```bash
git add apps/web/ce/hooks/ apps/web/core/hooks/ apps/web/core/components/issues/ && git commit -m "feat(agent): update mention system for multi-provider agent invocation"
```

---

### Task 17: Agent Mode Bar Component

**Files:**

- Create: `apps/web/core/components/editor/agent-mode-bar.tsx`
- Modify: `apps/web/core/components/comments/comment-create.tsx`

**Step 1: Create agent mode bar**

Build the agent mode bar component that sits above the comment editor. It includes:

- Toggle button to show/hide agent mode
- Multi-select provider chips with `[✕]` to remove
- `[+ Add]` button that opens grouped dropdown (grouped by `provider_group`)
- Optional skill selector dropdown
- Submit button text changes: `[Send]` → `[Send to N agents]`

Follow Plane's existing UI patterns: use `@plane/ui` components (Button, CustomSelect), `cn()` utility, Tailwind classes matching `ai-agent.tsx` styling.

**Step 2: Integrate into comment-create.tsx**

Add the agent mode bar above the `LiteTextEditor` in `comment-create.tsx`. When agent mode is active and agents are selected, the submit handler:

1. Posts the comment normally (via `activityOperations.createComment`)
2. For each selected agent, calls `agentService.invokeAgent()` with the comment text
3. Returns the session IDs to the parent for streaming

**Step 3: Commit**

```bash
git add apps/web/core/components/editor/ apps/web/core/components/comments/ && git commit -m "feat(agent): add agent mode bar to comment editor with multi-provider selection"
```

---

### Task 18: Multi-Agent Streaming in Activity Timeline

**Files:**

- Modify: `apps/web/core/components/issues/issue-detail/issue-activity/agent-response.tsx`
- Modify: `apps/web/core/components/issues/issue-detail/issue-activity/root.tsx`

**Step 1: Update AgentStreamingResponse for provider branding**

Modify the streaming response component to:

- Accept `providerSlug` and `variantSlug` props
- Show provider name + variant instead of "ZenithAgent" (e.g., "Claude Opus", "Gemini Flash")
- Use provider-specific icon or color accent
- Accept `sessionId` and connect to `GET /api/agent/.../sessions/{id}/stream/`

**Step 2: Support multiple concurrent streams in root.tsx**

The activity root currently tracks one agent response. Update to track an array of active sessions:

```typescript
const [activeSessions, setActiveSessions] = useState<TActiveAgentSession[]>([]);
```

Each session renders its own `AgentStreamingResponse` component in the timeline.

**Step 3: Update AgentCommentBlock for provider branding**

Show the provider name instead of "ZenithAgent", and include branch/PR links when available.

**Step 4: Commit**

```bash
git add apps/web/core/components/issues/issue-detail/issue-activity/ && git commit -m "feat(agent): support multi-agent parallel streaming in activity timeline"
```

---

### Task 19: Workspace Agent Settings Page

**Files:**

- Modify: `apps/web/core/components/workspace/settings/ai-agent.tsx`

**Step 1: Rewrite settings page**

Replace the current orchestrator-based settings with:

**Provider Management Section:**

- List of all providers with enable/disable toggles
- For each provider: "Connect" button that initiates OAuth flow
- Connection status indicator (green/red)
- Expandable variant list showing which models are enabled

**Skills Management Section:**

- List of workspace skills with trigger names
- Create/edit/delete skill UI
- Skill editor with: name, trigger, instructions (markdown textarea), default provider selector, mode selector, timeout input

**General Settings:**

- Max concurrent sessions slider
- Default timeout input

Remove all `orchestrator.zenova.id` references.

**Step 2: Commit**

```bash
git add apps/web/core/components/workspace/settings/ && git commit -m "feat(agent): rewrite workspace AI settings for multi-provider management"
```

---

## Phase 3: Cleanup & Polish

### Task 20: Remove Legacy External Orchestrator Code

**Files:**

- Modify: `apps/api/plane/app/views/external/base.py` — remove `GPTIntegrationEndpoint`, `WorkspaceGPTIntegrationEndpoint`, `get_llm_config`, `get_llm_response`, `LLMProvider`, `OpenAIProvider`, `AnthropicProvider`, `GeminiProvider`, `SUPPORTED_PROVIDERS`
- Modify: `apps/api/plane/app/urls/external.py` — remove ai-assistant URL patterns
- Modify: `apps/api/plane/app/views/__init__.py` — remove GPT view imports
- Modify: `apps/web/core/services/ai.service.ts` — remove or redirect to new agent service

**Step 1: Remove backend legacy code**

Remove the legacy LLM views from `external/base.py` (keep `UnsplashEndpoint`). Remove the URL patterns. Remove imports from `__init__.py`.

**Step 2: Remove frontend legacy references**

- Remove `ORCHESTRATOR_URL` constant from any remaining files
- Remove `zenith-agent` / `ZenithAgent` branding references
- Remove `AGENT_MENTION_ID = "zenith-agent"`
- Update `ai.service.ts` to either be removed or redirect to the new agent endpoints

**Step 3: Commit**

```bash
git add -A && git commit -m "refactor(agent): remove legacy external orchestrator and GPT integration code"
```

---

### Task 21: OAuth Provider Integration Endpoints

**Files:**

- Create: `apps/api/plane/agent/views/oauth.py`
- Modify: `apps/api/plane/agent/views/__init__.py`
- Modify: `apps/api/plane/agent/urls.py`

**Step 1: Write OAuth connect/callback views**

For each LLM provider that supports OAuth, create endpoints that:

1. `POST /api/agent/workspaces/{slug}/config/connect/{provider}/` — generate OAuth state, return redirect URL
2. `GET /api/agent/workspaces/{slug}/config/callback/{provider}/` — handle OAuth callback, exchange code for token, encrypt and store in `WorkspaceAgentConfig`

Follow the existing pattern from `apps/api/plane/authentication/provider/oauth/github.py`.

For Anthropic OAuth: Use Anthropic's OAuth 2.0 endpoints.
For Google OAuth: Use Google's OAuth 2.0 endpoints with appropriate Gemini API scopes.

**Step 2: Add token encryption utility**

Create `apps/api/plane/agent/utils/encryption.py` with Fernet-based encrypt/decrypt using Django's `SECRET_KEY`.

**Step 3: Commit**

```bash
git add apps/api/plane/agent/ && git commit -m "feat(agent): add OAuth connect/callback endpoints for LLM providers"
```

---

### Task 22: Update Docker Compose for Agent Infrastructure

**Files:**

- Modify: `docker-compose.yml`
- Modify: `docker-compose-local.yml`

**Step 1: Add Docker socket mount to worker service**

```yaml
worker:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
```

**Step 2: Verify Celery worker discovers agent tasks**

The Celery autodiscover in `apps/api/plane/celery.py` should pick up `plane.agent.tasks` automatically since `plane.agent` is in INSTALLED_APPS. Verify this works.

**Step 3: Commit**

```bash
git add docker-compose*.yml && git commit -m "feat(agent): configure Docker socket mount for agent container orchestration"
```

---

## Summary

| Phase                 | Tasks       | What it delivers                                                                                     |
| --------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| **Phase 1: Backend**  | Tasks 1-13  | Django app, models, API endpoints, Celery task, Docker images, SSE streaming                         |
| **Phase 2: Frontend** | Tasks 14-19 | Agent store, rewritten service, mention system, agent mode bar, multi-agent streaming, settings page |
| **Phase 3: Cleanup**  | Tasks 20-22 | Remove legacy code, add OAuth endpoints, Docker compose config                                       |

**Total: 22 tasks**

Each task is independently committable and testable. Tasks within a phase should be done sequentially (later tasks depend on earlier ones). Phases 1 and 2 can partially overlap once the API endpoints (Tasks 8-11) are in place.
