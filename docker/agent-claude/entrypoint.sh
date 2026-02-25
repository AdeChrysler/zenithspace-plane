#!/bin/bash
set -euo pipefail

echo "=== Plane Agent: ${PROVIDER_SLUG}-${VARIANT_SLUG} ==="
echo "Session: ${SESSION_ID}"
echo "Model: ${MODEL_ID}"

# Configure git
git config --global user.name "Plane Agent"
git config --global user.email "agent@plane.so"

# If GitHub token provided, set up auth and clone
if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${REPO_FULL_NAME:-}" ]; then
    echo "Cloning repository..."
    git clone "https://oauth2:${GITHUB_TOKEN}@github.com/${REPO_FULL_NAME}.git" /work/repo
    cd /work/repo
    BRANCH="agent/${SESSION_ID}"
    git checkout -b "$BRANCH"
    echo "BRANCH=${BRANCH}"
fi

# Build the prompt from issue context + skill
PROMPT="Issue: ${ISSUE_TITLE}

${ISSUE_DESCRIPTION:-No description provided}

${SKILL_INSTRUCTIONS:+Skill Instructions:
$SKILL_INSTRUCTIONS}

User request: ${COMMENT_TEXT}"

# Run Claude Code in non-interactive print mode
echo "Running Claude Code..."
claude --model "${MODEL_ID}" --print "$PROMPT"

# If we have a repo and changes were made, push and create PR
if [ -n "${GITHUB_TOKEN:-}" ] && [ -d "/work/repo/.git" ]; then
    cd /work/repo
    if [ -n "$(git status --porcelain)" ]; then
        echo "Changes detected, committing..."
        git add -A
        git commit -m "agent(${PROVIDER_SLUG}): ${ISSUE_TITLE}"
        git push origin "${BRANCH}"

        echo "Creating pull request..."
        PR_URL=$(gh pr create \
            --title "agent(${PROVIDER_SLUG}): ${ISSUE_TITLE}" \
            --body "Automated by Plane AI Agent

Provider: ${PROVIDER_SLUG}-${VARIANT_SLUG}
Model: ${MODEL_ID}
Skill: ${SKILL_TRIGGER:-none}
Session: ${SESSION_ID}" \
            --head "${BRANCH}" 2>&1 || echo "PR creation failed")

        if [ -n "$PR_URL" ]; then
            echo "PR_URL=${PR_URL}"
        fi
    else
        echo "No changes to commit."
    fi
fi

echo "Agent completed."
