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

# Build the prompt from issue context + skill (write to file to avoid shell injection)
python3 -c "
import os
parts = []
parts.append('Issue: ' + os.environ.get('ISSUE_TITLE', ''))
parts.append('')
parts.append(os.environ.get('ISSUE_DESCRIPTION', 'No description provided'))
parts.append('')
si = os.environ.get('SKILL_INSTRUCTIONS', '')
if si:
    parts.append('Skill Instructions:')
    parts.append(si)
    parts.append('')
parts.append('User request: ' + os.environ.get('COMMENT_TEXT', ''))
with open('/tmp/prompt.txt', 'w') as f:
    f.write('\n'.join(parts))
"

# Run Claude Code in non-interactive print mode
echo "Running Claude Code..."
cat /tmp/prompt.txt | claude --model "${MODEL_ID}" --print -

# If we have a repo and changes were made, push and create PR
if [ -n "${GITHUB_TOKEN:-}" ] && [ -d "/work/repo/.git" ]; then
    cd /work/repo
    if [ -n "$(git status --porcelain)" ]; then
        echo "Changes detected, committing..."
        git add -A
        echo "agent(${PROVIDER_SLUG}): ${ISSUE_TITLE}" > /tmp/commit-msg.txt
        git commit -F /tmp/commit-msg.txt
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
