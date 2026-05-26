#!/usr/bin/env bash
# Apply the description, homepage, and topics from .github/repo-meta.json
# to the GitHub repo this clone is linked to.
#
# Prereqs: gh CLI authenticated, jq installed, `git remote add origin <url>` done.

set -euo pipefail

cd "$(dirname "$0")/.."

DESC=$(jq -r .description .github/repo-meta.json)
HOMEPAGE=$(jq -r .homepage .github/repo-meta.json)
TOPIC_FLAGS=$(jq -r '.topics | map("--add-topic " + .) | join(" ")' .github/repo-meta.json)

# shellcheck disable=SC2086
gh repo edit --description "$DESC" --homepage "$HOMEPAGE" $TOPIC_FLAGS

echo "✔ Applied metadata to $(gh repo view --json nameWithOwner -q .nameWithOwner)"
