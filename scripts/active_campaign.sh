#!/usr/bin/env bash
# Prints the active campaign id from active_campaign.json.
# Usage: CAMPAIGN=$(bash scripts/active_campaign.sh)
set -euo pipefail
python3 -c "import json; print(json.load(open('active_campaign.json'))['active_campaign'])"
