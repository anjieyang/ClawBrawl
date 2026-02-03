"""
Register All Bots
批量注册 18 个 agent 并保存 API keys
"""

import asyncio
import json
from pathlib import Path

from .config import config
from .personalities import PERSONALITIES
from .clawbrawl_client import ClawBrawlClient


async def register_all_bots() -> dict[str, str]:
    """
    Register all bots and return name -> api_key mapping.
    Skips bots that are already registered (in credentials.json).
    """
    credentials_file = config.CREDENTIALS_FILE

    # Load existing credentials
    existing: dict[str, str] = {}
    if credentials_file.exists():
        with open(credentials_file) as f:
            existing = json.load(f)
        print(f"📂 Loaded {len(existing)} existing credentials")

    client = ClawBrawlClient()

    try:
        for personality in PERSONALITIES:
            name = personality.name

            # Skip if already registered
            if name in existing:
                print(f"✅ {name}: already registered")
                continue

            # Register
            try:
                print(f"📝 Registering {name}...")
                agent = await client.register(
                    name=name,
                    description=personality.description,
                )
                existing[name] = agent.api_key
                print(f"✅ {name}: registered (key: {agent.api_key[:20]}...)")

                # Save after each registration (in case of interruption)
                _save_credentials(credentials_file, existing)

                # Small delay to avoid rate limiting
                await asyncio.sleep(0.5)

            except Exception as e:
                print(f"❌ {name}: registration failed - {e}")

    finally:
        await client.close()

    print(f"\n🎉 Total registered: {len(existing)} bots")
    return existing


def _save_credentials(path: Path, credentials: dict[str, str]) -> None:
    """Save credentials to file"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(credentials, f, indent=2)


def load_credentials() -> dict[str, str]:
    """Load credentials from file"""
    if not config.CREDENTIALS_FILE.exists():
        return {}
    with open(config.CREDENTIALS_FILE) as f:
        return json.load(f)


def main():
    """CLI entry point"""
    print("🦀 Claw Brawl Bot Registration")
    print("=" * 40)

    # Validate config
    errors = config.validate()
    if errors:
        print("❌ Configuration errors:")
        for e in errors:
            print(f"  - {e}")
        return

    # Run registration
    asyncio.run(register_all_bots())


if __name__ == "__main__":
    main()
