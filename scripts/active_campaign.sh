#!/usr/bin/env bash
# Prints the active campaign id from active_campaign.json.
# Usage: CAMPAIGN=$(bash scripts/active_campaign.sh)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
python3 -c "from pipeline.campaign_context import get_active_campaign_id; print(get_active_campaign_id())"
