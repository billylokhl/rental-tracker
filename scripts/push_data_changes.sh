#!/usr/bin/env bash
# Commits regenerated campaign data and pushes to main, tolerating pushes that
# landed while the job ran. Requires an activated venv (for pipeline.cli).
# Usage: push_data_changes.sh <campaign> <commit-message>
set -euo pipefail
campaign="$1"
message="$2"

git add campaigns/ web/data/ web/public/data/
if git diff --staged --quiet; then
  echo "No data changes detected. Skipping commit."
  exit 0
fi
git commit -m "$message"

# Writer workflows are serialized by the shared 'data-writes' concurrency group,
# so the only concurrent pushes are browser annotation syncs. Rebase with NO
# custom merge strategy: a real conflict must fail loudly rather than silently
# dropping data (-X theirs previously could delete a concurrently added listing
# or revert freshly refreshed fields).
git pull --rebase origin main || { git rebase --abort; exit 1; }

# Rebuild the bundle from the merged data (local recompile, no network) and
# fold any difference into the commit, so the deployed campaign_data.json
# reflects changes the rebase brought in. No-ops on a fast-forward.
python3 -m pipeline.cli build --campaign "$campaign"
mkdir -p web/data
cp web/public/data/campaign_data.json web/data/campaign_data.json
git add campaigns/ web/data/ web/public/data/
if ! git diff --staged --quiet; then
  git commit --amend --no-edit
fi
git push origin main
