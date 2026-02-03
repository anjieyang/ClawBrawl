#!/usr/bin/env python3
"""
Claw Brawl Bot Runner - Entry Point
独立运行，与主项目解耦

Usage:
    # Register all bots first (one-time)
    python -m bots.run register

    # Run one betting round immediately
    python -m bots.run once

    # Run continuously (scheduler)
    python -m bots.run start

    # Check credentials
    python -m bots.run status
"""

import asyncio
import sys
import json

from .config import config
from .personalities import PERSONALITIES, get_all_names
from .register_all import register_all_bots, load_credentials
from .bot_runner import get_runner


def print_banner():
    """Print startup banner"""
    print("""
╔═══════════════════════════════════════════════════════════╗
║                    🦀 CLAW BRAWL BOTS 🦀                  ║
║               18 Personalities, One Arena                 ║
╚═══════════════════════════════════════════════════════════╝
""")


def cmd_register():
    """Register all bots"""
    print("📝 Registering all bots...")
    print()

    # Validate config first
    if not config.CLAWBRAWL_API_BASE:
        print("❌ CLAWBRAWL_API_BASE not set")
        return

    asyncio.run(register_all_bots())


def cmd_once():
    """Run one betting round"""
    print("🎲 Running one betting round...")
    print()

    errors = config.validate()
    if errors:
        print("❌ Configuration errors:")
        for e in errors:
            print(f"  - {e}")
        return

    runner = get_runner()
    asyncio.run(runner.run_once())


def cmd_start():
    """Start continuous runner"""
    print("🚀 Starting continuous runner...")
    print()

    errors = config.validate()
    if errors:
        print("❌ Configuration errors:")
        for e in errors:
            print(f"  - {e}")
        return

    runner = get_runner()
    asyncio.run(runner.run_forever())


def cmd_status():
    """Show status of all bots"""
    print("📊 Bot Status")
    print("=" * 50)

    credentials = load_credentials()
    all_names = get_all_names()

    registered = 0
    missing = 0

    for name in all_names:
        if name in credentials:
            key = credentials[name]
            print(f"✅ {name}: {key[:15]}...")
            registered += 1
        else:
            print(f"❌ {name}: NOT REGISTERED")
            missing += 1

    print()
    print(f"Total: {registered} registered, {missing} missing")

    if missing > 0:
        print()
        print("💡 Run 'python -m bots.run register' to register missing bots")


def cmd_help():
    """Show help"""
    print(__doc__)


def main():
    print_banner()

    if len(sys.argv) < 2:
        cmd_help()
        return

    command = sys.argv[1].lower()

    commands = {
        "register": cmd_register,
        "once": cmd_once,
        "start": cmd_start,
        "status": cmd_status,
        "help": cmd_help,
    }

    if command in commands:
        commands[command]()
    else:
        print(f"❌ Unknown command: {command}")
        print()
        cmd_help()


if __name__ == "__main__":
    main()
