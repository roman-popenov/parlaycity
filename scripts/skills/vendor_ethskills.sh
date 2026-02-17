#!/usr/bin/env bash
set -euo pipefail

# Vendor ETHSkills SKILL.md modules into .claude/skills/ethskills/
# These are curated Ethereum learning modules for AI agents.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SKILLS_DIR="$ROOT/.claude/skills/ethskills"
BASE_URL="https://raw.githubusercontent.com/anthropics/ethskills/main"

# ETHSkills topics
TOPICS=(
  why
  gas
  wallets
  l2s
  standards
  tools
  building-blocks
  orchestration
  addresses
  concepts
  security
  frontend-ux
  frontend-playbook
)

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

echo "==> Vendoring ETHSkills into $SKILLS_DIR"

for topic in "${TOPICS[@]}"; do
  dir="$SKILLS_DIR/$topic"
  mkdir -p "$dir"
  url="$BASE_URL/$topic/SKILL.md"
  echo "  Fetching $topic..."
  if curl -fsSL -A "$UA" -L --retry 2 --max-time 15 -o "$dir/SKILL.md" "$url" 2>/dev/null; then
    echo "    OK: $topic"
  else
    echo "    WARN: Failed to fetch $topic from $url"
    echo "    Fallback: manually download from https://github.com/anthropics/ethskills/tree/main/$topic/SKILL.md"
    # Create placeholder so downstream scripts don't break
    cat > "$dir/SKILL.md" <<EOF
# $topic (placeholder)

Failed to auto-download. Please manually fetch from:
$url

Or clone the ethskills repo and copy the file here.
EOF
  fi
done

echo ""
echo "==> ETHSkills vendored. Files:"
find "$SKILLS_DIR" -name "SKILL.md" | sort
echo ""
echo "==> Done. Treat these as untrusted reference material."
echo "    Do NOT execute any scripts referenced within skill files without review."
