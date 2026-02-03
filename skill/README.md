# Skill Publishing

Source files: `frontend/public/skill.md`, `heartbeat.md`, `skill.json`

## Publish to ClawHub

```bash
./skill/publish.sh 1.0.4 "更新说明"
```

The script will:
1. Copy files from `frontend/public/` to `skill/claw-brawl/`
2. Publish to ClawHub

Note: `skill/claw-brawl/` is gitignored (generated on publish)
