# Bug: Published skill not appearing in search/explore/inspect

## Summary

Successfully published skill returns confirmation but is not discoverable via `search`, `explore`, or `inspect` commands. Web dashboard also shows empty "My Skills" section.

## Environment

- **ClawHub CLI version**: Latest (installed via npx)
- **Registry**: https://clawhub.ai
- **Account**: @anjieyang
- **OS**: Linux

## Steps to Reproduce

1. Login successfully:
```bash
clawhub login --token "clh_xxx" --site https://clawhub.ai --registry https://clawhub.ai
# ✔ OK. Logged in as @anjieyang.
```

2. Publish skill:
```bash
clawhub publish clawbrawl --version 1.0.16 --registry https://clawhub.ai
# ✔ OK. Published clawbrawl@1.0.16 (k97dvng27ftn83smv6bw6x9tvs80jzf8)
```

3. Try to find the published skill:
```bash
clawhub inspect clawbrawl --registry https://clawhub.ai
# ✖ Skill not found

clawhub search clawbrawl --registry https://clawhub.ai
# (empty results)

clawhub explore --registry https://clawhub.ai
# (skill not in list, other skills like clawnance, chitin appear normally)
```

## Expected Behavior

After successful publish, the skill should be:
- Visible in `clawhub explore` output
- Findable via `clawhub search clawbrawl`
- Inspectable via `clawhub inspect clawbrawl`
- Visible in web dashboard "My Skills" section

## Actual Behavior

- Publish returns success with confirmation ID
- Skill is completely invisible in all discovery methods
- Web dashboard "My Skills" is empty
- Web upload also fails with "Server Error Called by client"

## Skill Format (Simplified)

```yaml
---
name: clawbrawl
version: 1.0.16
description: Predict BTC price movements every 10 minutes. Compete with AI agents. Climb the leaderboard!
homepage: https://clawbrawl.ai
metadata: {"clawbrawl":{"emoji":"🦀","category":"game","api_base":"https://api.clawbrawl.ai/api/v1"}}
---
```

## Debugging Attempted

1. ✅ Verified token works (login succeeds)
2. ✅ Simplified skill format to match working skills (chitin, clawnance)
3. ✅ Removed hyphen from name (`claw-brawl` → `clawbrawl`)
4. ✅ Removed extra frontmatter fields (license, compatibility)
5. ✅ Simplified metadata to single-platform format
6. ✅ Tried multiple versions (1.0.13, 1.0.14, 1.0.15, 1.0.16)
7. ✅ Tried web upload - same issue

## Publish Confirmation IDs

- `k97dvng27ftn83smv6bw6x9tvs80jzf8` (v1.0.16)

## Additional Context

Other skills published by different users (clawnance, chitin, etc.) are visible and working. This appears to be account-specific or related to backend indexing.

---

**Priority**: High - Cannot distribute skill via ClawHub as intended
