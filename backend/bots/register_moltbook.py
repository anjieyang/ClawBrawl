"""
Register All Bots on Moltbook
批量注册 18 个 agent 到 Moltbook，创建 m/clawbrawl submolt
"""

import asyncio
import json
from pathlib import Path
from typing import Optional

from .config import config
from .personalities import PERSONALITIES
from .moltbook_client import MoltbookClient


# Moltbook credentials file (separate from ClawBrawl credentials)
MOLTBOOK_CREDENTIALS_FILE = Path(__file__).parent / "moltbook_credentials.json"

# Our submolt
CLAWBRAWL_SUBMOLT = "clawbrawl"
CLAWBRAWL_SUBMOLT_DISPLAY = "Claw Brawl Arena 🦀"
CLAWBRAWL_SUBMOLT_DESC = "The arena where AI agents prove their trading instincts! Battle reports, trash talk, strategies, and drama. Join the fight: http://www.clawbrawl.ai"


def load_moltbook_credentials() -> dict[str, str]:
    """Load Moltbook credentials from file"""
    if not MOLTBOOK_CREDENTIALS_FILE.exists():
        return {}
    with open(MOLTBOOK_CREDENTIALS_FILE) as f:
        return json.load(f)


def save_moltbook_credentials(credentials: dict[str, str]) -> None:
    """Save Moltbook credentials to file"""
    MOLTBOOK_CREDENTIALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MOLTBOOK_CREDENTIALS_FILE, "w") as f:
        json.dump(credentials, f, indent=2)


async def register_all_bots_moltbook() -> dict[str, str]:
    """
    Register all bots on Moltbook and return name -> api_key mapping.
    Skips bots that are already registered.
    """
    # Load existing credentials
    existing = load_moltbook_credentials()
    if existing:
        print(f"📂 Loaded {len(existing)} existing Moltbook credentials")

    client = MoltbookClient()

    try:
        for personality in PERSONALITIES:
            name = personality.name

            # Skip if already registered
            if name in existing:
                print(f"✅ {name}: already registered on Moltbook")
                continue

            # Build description for Moltbook
            # Include personality traits for richer profile
            moltbook_desc = f"{personality.description} | Claw Brawl trader | {personality.trading_style[:100]}"

            # Register
            try:
                print(f"📝 Registering {name} on Moltbook...")
                agent = await client.register(
                    name=name,
                    description=moltbook_desc,
                )
                
                if agent and agent.api_key:
                    existing[name] = agent.api_key
                    print(f"✅ {name}: registered (key: {agent.api_key[:20]}...)")
                    if agent.claim_url:
                        print(f"   Claim URL: {agent.claim_url}")

                    # Save after each registration (in case of interruption)
                    save_moltbook_credentials(existing)
                else:
                    print(f"❌ {name}: registration returned no key")

                # Small delay to avoid rate limiting
                await asyncio.sleep(1.0)

            except Exception as e:
                print(f"❌ {name}: registration failed - {e}")

    finally:
        await client.close()

    print(f"\n🎉 Total registered on Moltbook: {len(existing)} bots")
    return existing


async def create_clawbrawl_submolt(api_key: str) -> bool:
    """Create m/clawbrawl submolt if it doesn't exist"""
    client = MoltbookClient(api_key=api_key)
    
    try:
        # Check if submolt already exists
        info = await client.get_submolt_info(CLAWBRAWL_SUBMOLT)
        if info:
            print(f"✅ m/{CLAWBRAWL_SUBMOLT} already exists")
            return True

        # Create it
        print(f"📝 Creating m/{CLAWBRAWL_SUBMOLT}...")
        result = await client.create_submolt(
            name=CLAWBRAWL_SUBMOLT,
            display_name=CLAWBRAWL_SUBMOLT_DISPLAY,
            description=CLAWBRAWL_SUBMOLT_DESC,
        )
        
        if result:
            print(f"✅ Created m/{CLAWBRAWL_SUBMOLT}")
            return True
        else:
            print(f"❌ Failed to create m/{CLAWBRAWL_SUBMOLT}")
            return False
            
    finally:
        await client.close()


async def subscribe_all_to_clawbrawl() -> None:
    """Make all bots subscribe to m/clawbrawl"""
    credentials = load_moltbook_credentials()
    
    if not credentials:
        print("❌ No Moltbook credentials found. Register bots first.")
        return

    for name, api_key in credentials.items():
        client = MoltbookClient(api_key=api_key)
        try:
            success = await client.subscribe(CLAWBRAWL_SUBMOLT)
            if success:
                print(f"✅ {name} subscribed to m/{CLAWBRAWL_SUBMOLT}")
            else:
                print(f"⚠️ {name} may already be subscribed or failed")
            await asyncio.sleep(0.3)
        except Exception as e:
            print(f"❌ {name} subscription failed: {e}")
        finally:
            await client.close()


async def setup_moltbook() -> None:
    """
    Full Moltbook setup:
    1. Register all bots
    2. Create m/clawbrawl submolt
    3. Subscribe all bots to it
    """
    print("🦞 Moltbook Setup for Claw Brawl Bots")
    print("=" * 50)
    
    # Step 1: Register all bots
    print("\n📋 Step 1: Registering bots on Moltbook...")
    credentials = await register_all_bots_moltbook()
    
    if not credentials:
        print("❌ No bots registered. Aborting.")
        return

    # Step 2: Create submolt (use first bot's key)
    print(f"\n📋 Step 2: Creating m/{CLAWBRAWL_SUBMOLT} submolt...")
    first_key = list(credentials.values())[0]
    await create_clawbrawl_submolt(first_key)
    
    # Step 3: Subscribe all bots
    print(f"\n📋 Step 3: Subscribing all bots to m/{CLAWBRAWL_SUBMOLT}...")
    await subscribe_all_to_clawbrawl()
    
    print("\n" + "=" * 50)
    print("🎉 Moltbook setup complete!")
    print(f"   - {len(credentials)} bots registered")
    print(f"   - m/{CLAWBRAWL_SUBMOLT} ready")
    print("\n⚠️ Note: Bots need to be claimed by humans to be fully active.")
    print("   Check the claim URLs in the registration output.")


def get_moltbook_key(bot_name: str) -> Optional[str]:
    """Get a bot's Moltbook API key"""
    credentials = load_moltbook_credentials()
    return credentials.get(bot_name)


def main():
    """CLI entry point"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python -m bots.register_moltbook setup    # Full setup")
        print("  python -m bots.register_moltbook register # Register bots only")
        print("  python -m bots.register_moltbook submolt  # Create submolt only")
        print("  python -m bots.register_moltbook subscribe # Subscribe all to submolt")
        print("  python -m bots.register_moltbook status   # Show registered bots")
        return

    command = sys.argv[1].lower()

    if command == "setup":
        asyncio.run(setup_moltbook())
    elif command == "register":
        asyncio.run(register_all_bots_moltbook())
    elif command == "submolt":
        credentials = load_moltbook_credentials()
        if not credentials:
            print("❌ No credentials found. Register bots first.")
            return
        first_key = list(credentials.values())[0]
        asyncio.run(create_clawbrawl_submolt(first_key))
    elif command == "subscribe":
        asyncio.run(subscribe_all_to_clawbrawl())
    elif command == "status":
        credentials = load_moltbook_credentials()
        if not credentials:
            print("No Moltbook credentials found.")
            return
        print(f"📊 {len(credentials)} bots registered on Moltbook:")
        for name, key in credentials.items():
            print(f"  ✅ {name}: {key[:20]}...")
    else:
        print(f"❌ Unknown command: {command}")


if __name__ == "__main__":
    main()
