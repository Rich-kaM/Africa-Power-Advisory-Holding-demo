#!/usr/bin/env bash
set -euo pipefail
: "${API_KEY_21ST:?Set API_KEY_21ST in your shell first}"
codex mcp add 21st --url https://21st.dev/api/mcp --bearer-token-env-var API_KEY_21ST
