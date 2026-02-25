# Native AI Agent Integration — Design Document

**Date:** 2026-02-25
**Status:** Approved
**Author:** Design collaboration

---

## 1. Problem Statement

Plane's current AI integration has two disconnected systems:

1. **Legacy LLM endpoints** (`apps/api/plane/app/views/external/base.py`) — Django views that call OpenAI SDK directly for simple text completion (editor rephrase/grammar). Uses API keys.
2. **External agent** (`apps/web/core/services/agent.service.ts`) — "ZenithAgent" that talks directly from the browser to an external orchestrator at `https://orchestrator.zenova.id`. No code for this service exists in the repo.

Neither system is native, neither supports real code execution, and both use API keys instead of OAuth.

### Goals

- Replace the external orchestrator with a fully native agent system inside this codebase
- Spawn real CLI tools (Claude Code, Gemini CLI, etc.) in ephemeral Docker containers
- Support multiple LLM providers with clean user-facing names (no version numbers)
- Allow parallel multi-agent invocation from a single comment
- Integrate a skills system for custom agent workflows
- Use OAuth token authentication exclusively (no API keys)
- Deliver code changes as branch + PR linked to the originating issue

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLANE WEB APP                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Comment Editor with Agent Mode Bar                        │   │
│  │ [Claude Opus ✕] [Gemini Flash ✕] [+ Add]  Skill: [NAKN] │   │
│  │                                                           │   │
│  │ "Fix the null pointer in auth middleware..."              │   │
│  │                                            [Send to 2 🚀] │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Alternative: @claude-opus:nakn mention in comment body         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Mention Hook │→ │ Agent Service    │→ │ SSE Stream UI    │  │
│  │ (detection)  │  │ (calls backend)  │  │ (per-agent)      │  │
│  └──────────────┘  └──────────────────┘  └──────────────────┘  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ POST /api/agent/invoke/
                            │ (one request per selected agent)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DJANGO API (plane.agent app)                 │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ InvokeView   │→ │ Celery Task:     │→ │ SSE Endpoint     │  │
│  │ (validate,   │  │ run_agent_task   │  │ (stream to FE)   │  │
│  │  resolve     │  │                  │  │                  │  │
│  │  provider)   │  │                  │  │                  │  │
│  └──────────────┘  └──────────────────┘  └──────────────────┘  │
│                           │                       ▲              │
│                           │ Redis pub/sub         │              │
│                           ▼                       │              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   AgentSession Model                      │   │
│  │  (tracks state, logs, tokens, linked issue/PR)            │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Docker SDK (docker-py)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              EPHEMERAL DOCKER CONTAINER                           │
│                                                                  │
│  1. git clone repo using GitHub OAuth token                     │
│  2. Load skill file (mounted from host or fetched from DB)      │
│  3. Run CLI tool (claude / gemini / kimi)                       │
│  4. Stream stdout → Redis pub/sub → SSE → Frontend              │
│  5. On completion: git push branch + create PR via GitHub API   │
│  6. Container destroyed                                          │
│                                                                  │
│  OAuth tokens injected as env vars (never persisted to disk)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Provider Registry

### Model: AgentProvider

Each LLM provider is a registered entity with one or more model variants.

```python
class AgentProvider(BaseModel):
    """An LLM provider that can be invoked as an agent."""
    slug = CharField(max_length=50, unique=True)       # "claude"
    display_name = CharField(max_length=100)            # "Anthropic"
    cli_tool = CharField(max_length=100)                # "claude" (binary name)
    docker_image = CharField(max_length=255)            # "plane/agent-claude:latest"
    oauth_provider = CharField(max_length=50)           # "anthropic"
    is_enabled = BooleanField(default=False)
    icon_url = URLField(null=True)
    sort_order = IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "display_name"]
```

### Model: AgentProviderVariant

```python
class AgentProviderVariant(BaseModel):
    """A specific model tier within a provider."""
    provider = ForeignKey(AgentProvider, related_name="variants")
    slug = CharField(max_length=50)                    # "opus"
    display_name = CharField(max_length=100)           # "Claude Opus"
    model_id = CharField(max_length=100)               # "claude-opus-4-6" (actual API ID)
    is_default = BooleanField(default=False)
    is_enabled = BooleanField(default=True)
    sort_order = IntegerField(default=0)

    class Meta:
        unique_together = ["provider", "slug"]
        ordering = ["sort_order"]
```

### Alias Resolution (no version numbers for users)

Users see clean names that always resolve to the latest model:

| User sees     | @-mention        | Resolves to         |
| ------------- | ---------------- | ------------------- |
| Claude Opus   | `@claude-opus`   | `claude-opus-4-6`   |
| Claude Sonnet | `@claude-sonnet` | `claude-sonnet-4-6` |
| Claude Haiku  | `@claude-haiku`  | `claude-haiku-4-5`  |
| Gemini Pro    | `@gemini-pro`    | `gemini-2.5-pro`    |
| Gemini Flash  | `@gemini-flash`  | `gemini-2.0-flash`  |
| Kimi          | `@kimi`          | `moonshot-v1`       |

Admins update which `model_id` an alias points to when new versions release. Users never see version numbers.

### Workspace Provider Config

```python
class WorkspaceAgentConfig(BaseModel):
    """Per-workspace agent provider configuration."""
    workspace = ForeignKey(Workspace)
    provider = ForeignKey(AgentProvider)
    is_enabled = BooleanField(default=True)
    oauth_token_encrypted = TextField()  # encrypted OAuth token for this provider
    max_concurrent_sessions = IntegerField(default=3)
    timeout_minutes = IntegerField(default=15)

    class Meta:
        unique_together = ["workspace", "provider"]
```

---

## 4. Mention System & Agent Mode Bar

### Two ways to invoke agents

#### A. Agent Mode Bar (primary UI)

The comment editor gets a toggleable agent mode bar above the text area:

```
┌─ Agent Mode ──────────────────────────────────────────┐
│ 🤖 Send to:  [Claude Opus ✕] [Gemini Flash ✕] [+ Add]│
│    Skill:    [NAKN ▾]              (optional)          │
└────────────────────────────────────────────────────────┘
```

- `[+ Add]` opens a grouped dropdown:
  ```
  ┌──────────────────────────┐
  │ Anthropic                │
  │   ◉ Claude Opus          │
  │   ○ Claude Sonnet        │
  │   ○ Claude Haiku         │
  │                          │
  │ Google                   │
  │   ○ Gemini Pro           │
  │   ○ Gemini Flash         │
  │                          │
  │ Moonshot                 │
  │   ○ Kimi                 │
  └──────────────────────────┘
  ```
- Multiple agents can be selected — each runs in parallel
- Submit button shows count: `[Send to 2 agents 🚀]`
- Optional skill dropdown filters by project/workspace skills

#### B. @-mention in comment body (power users)

Typing `@` in the editor shows agents alongside members:

```
┌─────────────────────────────────┐
│ 👤 Members                      │
│   John Smith                    │
│   Jane Doe                      │
│                                 │
│ 🤖 AI Agents                    │
│   Claude Opus     @claude-opus  │
│   Claude Sonnet   @claude-sonnet│
│   Gemini Pro      @gemini-pro   │
│   Gemini Flash    @gemini-flash │
└─────────────────────────────────┘
```

After selecting, typing `:` shows skills: `@claude-opus:nakn`

### Mention format specification

```
@{provider}                  → default variant, no skill
@{provider}-{variant}        → specific variant, no skill
@{provider}:{skill}          → default variant + skill
@{provider}-{variant}:{skill} → specific variant + skill

Examples:
  @claude              → Claude Sonnet (default), no skill
  @claude-opus         → Claude Opus, no skill
  @claude:nakn         → Claude Sonnet + NAKN skill
  @claude-opus:nakn    → Claude Opus + NAKN skill
  @gemini-flash        → Gemini Flash, no skill
```

### Parallel invocation

When multiple agents are selected (via agent mode bar or multiple @-mentions), the frontend sends one `POST /api/agent/invoke/` per agent. Each creates a separate `AgentSession` and Docker container. Responses stream independently in the activity timeline.

---

## 5. Skills System

### Two sources, DB overlay takes precedence

```
Resolution order:
  1. DB skills (workspace/project scope) — created via UI
  2. Repo skills (.plane/skills/*.md) — version controlled
  3. Built-in skills (shipped with Plane) — defaults
```

### Repo-based skills

Stored in the repository as markdown files with YAML frontmatter:

```
.plane/
  skills/
    nakn.md            # NAKN development skill
    api-endpoint.md    # API feature skill
    bug-triage.md      # Bug analysis skill
  agent.yaml           # Optional: default agent preferences
  CLAUDE.md            # Base instructions for Claude Code
```

#### Skill file format

```markdown
---
name: NAKN Development
trigger: nakn
description: End-to-end NAKN workflow from TRD to tested webhook
default_provider: claude-opus
mode: autonomous
tools:
  - mcp
  - nag
timeout_minutes: 30
context_paths:
  - docs/trd/
  - src/workflows/
  - tests/webhooks/
---

# Instructions

1. Read and parse the TRD linked in the issue description
2. Create a workflow based on the TRD specifications
3. Implement using NAG patterns and MCP server connections
4. Add webhook test case for workflow verification
5. Use the loop pattern for iterative refinement
6. Run all tests and verify webhook response
7. Commit, push, and open PR
```

### DB-stored skills

```python
class AgentSkill(BaseModel):
    """A custom agent skill/workflow."""
    workspace = ForeignKey(Workspace)
    project = ForeignKey(Project, null=True, blank=True)  # null = workspace-wide
    name = CharField(max_length=255)
    trigger = SlugField(max_length=50)  # unique per workspace
    description = TextField(blank=True)
    instructions = TextField()  # markdown
    default_provider = CharField(max_length=100, blank=True)  # "claude-opus"
    mode = CharField(max_length=20, default="autonomous")
    tools = JSONField(default=list)
    timeout_minutes = IntegerField(default=15)
    context_paths = JSONField(default=list)
    is_enabled = BooleanField(default=True)
    created_by = ForeignKey(User)

    class Meta:
        unique_together = ["workspace", "trigger"]
```

### Skill injection into container

When a skill is specified, the skill file is mounted into the container at a known path. The entrypoint script loads it as instructions for the CLI tool.

---

## 6. Agent Session Lifecycle

### States

```
PENDING → PROVISIONING → RUNNING → STREAMING → COMPLETED
                                               → FAILED
                                               → CANCELLED
                                               → TIMED_OUT
```

### Model: AgentSession

```python
class AgentSession(BaseModel):
    """Tracks a single agent invocation from trigger to completion."""
    # Context
    workspace = ForeignKey(Workspace)
    project = ForeignKey(Project)
    issue = ForeignKey(Issue)
    triggered_by = ForeignKey(User, related_name="agent_sessions")
    trigger_comment = ForeignKey(IssueComment, null=True)

    # Agent configuration
    provider_slug = CharField(max_length=50)       # "claude"
    variant_slug = CharField(max_length=50)        # "opus"
    model_id = CharField(max_length=100)           # "claude-opus-4-6"
    skill_trigger = CharField(null=True, blank=True)  # "nakn"

    # Runtime
    container_id = CharField(max_length=100, null=True, blank=True)
    status = CharField(max_length=20, default="pending")
    started_at = DateTimeField(null=True)
    completed_at = DateTimeField(null=True)
    timeout_minutes = IntegerField(default=15)

    # Results
    response_text = TextField(null=True, blank=True)
    response_html = TextField(null=True, blank=True)
    branch_name = CharField(max_length=255, null=True, blank=True)
    pull_request_url = URLField(null=True, blank=True)
    error_message = TextField(null=True, blank=True)

    # Metrics
    tokens_used = IntegerField(default=0)
    estimated_cost_usd = DecimalField(max_digits=10, decimal_places=4, default=0)
    duration_seconds = IntegerField(null=True)
```

### Celery task flow

```python
@shared_task(bind=True, max_retries=1, time_limit=1800)
def run_agent_task(self, session_id: str):
    """
    Main Celery task that orchestrates a single agent invocation.

    1. Load session and resolve provider/skill
    2. Decrypt OAuth tokens
    3. Create Docker container with env vars
    4. Attach to container stdout, publish to Redis pub/sub
    5. Wait for completion or timeout
    6. If code changes: push branch + create PR
    7. Post response as issue comment
    8. Destroy container
    """
```

---

## 7. OAuth Authentication

### No API keys — OAuth only

Each LLM provider is connected via OAuth at the workspace level.

#### Anthropic OAuth flow (for Claude)

1. Admin clicks "Connect Claude" in workspace settings
2. Redirect to Anthropic OAuth consent screen
3. Callback stores encrypted access/refresh tokens in `WorkspaceAgentConfig`
4. Token injected as env var when container starts

#### GitHub OAuth (for git operations)

Already implemented in Plane. The invoking user's GitHub OAuth token is used for:

- Cloning the repository
- Pushing the agent's branch
- Creating the pull request (attributed to the user)

#### Token storage

```python
class WorkspaceAgentConfig(BaseModel):
    workspace = ForeignKey(Workspace)
    provider = ForeignKey(AgentProvider)
    oauth_token_encrypted = TextField()           # AES-256 encrypted
    oauth_refresh_token_encrypted = TextField()   # AES-256 encrypted
    oauth_token_expires_at = DateTimeField(null=True)
    connected_by = ForeignKey(User)
    connected_at = DateTimeField(auto_now_add=True)
```

Token refresh happens automatically before container provisioning if the token is expired.

---

## 8. Docker Container Strategy

### Pre-built agent images

One Docker image per CLI tool, minimal and purpose-built:

```dockerfile
# plane/agent-claude:latest
FROM node:22-slim
RUN npm install -g @anthropic-ai/claude-code
RUN apt-get update && apt-get install -y git gh && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

```dockerfile
# plane/agent-gemini:latest
FROM node:22-slim
RUN npm install -g @anthropic-ai/gemini-cli
RUN apt-get update && apt-get install -y git gh && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

### Container entrypoint

```bash
#!/bin/bash
set -euo pipefail

# 1. Clone repo
git clone "https://oauth2:${GITHUB_TOKEN}@github.com/${REPO_FULL_NAME}.git" /work
cd /work

# 2. Create agent branch
BRANCH="agent/${SESSION_ID}"
git checkout -b "$BRANCH"

# 3. Load skill instructions (mounted at /skill if provided)
SKILL_PROMPT=""
if [ -f /skill/instructions.md ]; then
  SKILL_PROMPT=$(cat /skill/instructions.md)
fi

# 4. Build prompt from issue context + skill
PROMPT="Issue: ${ISSUE_TITLE}\n\n${ISSUE_DESCRIPTION}\n\n${SKILL_PROMPT}\n\nUser request: ${COMMENT_TEXT}"

# 5. Run the CLI tool — stdout is captured by the Celery task via Docker SDK
$CLI_TOOL --model "$MODEL_ID" --print "$PROMPT"

# 6. If changes exist, push and create PR
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "agent(${PROVIDER_SLUG}): ${ISSUE_TITLE}"
  git push origin "$BRANCH"
  PR_URL=$(gh pr create \
    --title "agent(${PROVIDER_SLUG}): ${ISSUE_TITLE}" \
    --body "Automated by Plane AI Agent\n\nResolves: ${ISSUE_URL}\nProvider: ${PROVIDER_SLUG}-${VARIANT_SLUG}\nSkill: ${SKILL_TRIGGER:-none}" \
    --head "$BRANCH")
  echo "PR_URL=${PR_URL}" >> /tmp/agent-result.env
fi
```

### Streaming: container → Redis → SSE → frontend

```
Container stdout
    │ docker-py attach(stream=True)
    ▼
Celery task reads chunks
    │ redis.publish(f"agent:session:{session_id}", chunk)
    ▼
Django SSE endpoint
    │ redis.subscribe(f"agent:session:{session_id}")
    ▼
Frontend EventSource
    │ renders in AgentStreamingResponse component
    ▼
Activity timeline (persisted on completion)
```

### Resource limits

```python
container = docker_client.containers.run(
    image=provider.docker_image,
    environment={...},
    mem_limit="2g",
    cpu_period=100000,
    cpu_quota=100000,  # 1 CPU
    network_mode="bridge",
    auto_remove=True,
    detach=True,
)
```

### Docker socket mount

The `worker` service in docker-compose needs access to the Docker socket:

```yaml
worker:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
```

---

## 9. API Endpoints

### New Django app: `plane.agent`

```
POST   /api/agent/invoke/                    # Invoke an agent (creates session + Celery task)
GET    /api/agent/sessions/{id}/stream/      # SSE endpoint for streaming response
GET    /api/agent/sessions/{id}/             # Get session status/result
POST   /api/agent/sessions/{id}/cancel/      # Cancel a running session
GET    /api/agent/providers/                  # List enabled providers + variants
GET    /api/agent/skills/                     # List available skills
POST   /api/agent/skills/                     # Create a DB skill (admin)
PUT    /api/agent/skills/{id}/               # Update a DB skill (admin)
DELETE /api/agent/skills/{id}/               # Delete a DB skill (admin)
GET    /api/agent/config/                     # Get workspace agent config
PUT    /api/agent/config/                     # Update workspace agent config
POST   /api/agent/config/connect/{provider}/ # Start OAuth flow for a provider
GET    /api/agent/config/callback/{provider}/ # OAuth callback
```

### Invoke request payload

```json
{
  "provider_slug": "claude",
  "variant_slug": "opus",
  "skill_trigger": "nakn",
  "issue_id": "uuid",
  "project_id": "uuid",
  "comment_text": "Fix the null pointer in auth middleware",
  "comment_id": "uuid"
}
```

---

## 10. Frontend Changes

### Files to modify

| File                                                                        | Change                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `web/core/services/agent.service.ts`                                        | Replace orchestrator URL with Django backend endpoints |
| `web/core/hooks/use-agent-mention.tsx`                                      | Update to parse `@provider-variant:skill` format       |
| `web/ce/hooks/use-additional-editor-mention.tsx`                            | Generate mention list from provider registry API       |
| `web/core/components/issues/issue-detail/issue-activity/agent-response.tsx` | Support multiple concurrent agent streams              |
| `web/core/components/workspace/settings/ai-agent.tsx`                       | Replace with provider management + OAuth connect UI    |

### New files

| File                                                         | Purpose                                    |
| ------------------------------------------------------------ | ------------------------------------------ |
| `web/core/components/editor/agent-mode-bar.tsx`              | Agent mode toggle bar above comment editor |
| `web/core/components/editor/agent-provider-dropdown.tsx`     | Grouped provider/variant selector          |
| `web/core/components/editor/agent-skill-dropdown.tsx`        | Skill selector dropdown                    |
| `web/core/components/workspace/settings/agent-providers.tsx` | Provider management settings               |
| `web/core/components/workspace/settings/agent-skills.tsx`    | Skill management settings                  |
| `web/core/stores/agent.store.ts`                             | MobX store for agent state                 |

---

## 11. Migration Path

### Phase 1: Backend foundation

- New `plane.agent` Django app with models, migrations
- Provider registry with seed data (Claude, Gemini)
- Celery task for Docker container orchestration
- SSE streaming endpoint via Redis pub/sub
- OAuth flows for Anthropic and Google

### Phase 2: Frontend agent mode

- Agent mode bar on comment editor
- Provider dropdown (grouped, clean names)
- Replace external orchestrator calls with Django backend
- Multi-agent parallel invocation
- Per-agent streaming in activity timeline

### Phase 3: Skills system

- Repo-based skill file discovery
- DB skill CRUD (API + settings UI)
- Skill selector in agent mode bar and @-mention
- Skill injection into Docker containers

### Phase 4: Autonomous code delivery

- Branch creation + git push from containers
- PR creation via GitHub API
- PR linked to originating issue
- Agent response posted as issue comment with PR link

---

## 12. What Gets Removed

- `ORCHESTRATOR_URL` / `orchestrator.zenova.id` references (hardcoded external service)
- `ZenithAgent` branding (replaced by actual provider names)
- `AGENT_MENTION_ID = "zenith-agent"` (replaced by provider-based mentions)
- Legacy `GPTIntegrationEndpoint` and `WorkspaceGPTIntegrationEndpoint` (replaced by new agent system)
- `LLM_API_KEY` / `LLM_MODEL` / `LLM_PROVIDER` instance config keys (replaced by OAuth)
- `get_llm_config()` / `get_llm_response()` helpers (replaced by container-based execution)
