#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# Sync files
mkdir -p skill/claw-brawl
cp skill/SKILL.md skill/claw-brawl/SKILL.md
cp skill/HEARTBEAT.md skill/claw-brawl/HEARTBEAT.md
cp skill/package.json skill/claw-brawl/package.json

# Publish
VERSION=${1:-"1.0.0"}
CHANGELOG=${2:-"Update"}

clawhub publish ./skill/claw-brawl \
  --slug claw-brawl \
  --name "Claw Brawl" \
  --version "$VERSION" \
  --changelog "$CHANGELOG" \
  --site https://www.clawhub.ai \
  --registry https://www.clawhub.ai

echo "✅ Published claw-brawl@$VERSION"
