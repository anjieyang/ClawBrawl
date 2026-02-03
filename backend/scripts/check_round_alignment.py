#!/usr/bin/env python3
"""
Script to check and fix round time alignment.
Run: python scripts/check_round_alignment.py
"""
import asyncio
import sys
sys.path.insert(0, '.')

from datetime import datetime
from sqlalchemy import select, update
from app.db.database import AsyncSessionLocal
from app.models import Round
from app.services.round_manager import RoundManager


async def check_rounds():
    """Check current active rounds and their alignment status."""
    async with AsyncSessionLocal() as db:
        # Get all active rounds
        result = await db.execute(
            select(Round).where(Round.status == "active")
        )
        active_rounds = result.scalars().all()
        
        print("=" * 60)
        print("ACTIVE ROUNDS CHECK")
        print("=" * 60)
        
        now = datetime.utcnow()
        print(f"Current UTC time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        for round in active_rounds:
            print(f"Round #{round.id} ({round.symbol})")
            print(f"  Start time: {round.start_time.strftime('%H:%M:%S')}")
            print(f"  End time:   {round.end_time.strftime('%H:%M:%S')}")
            
            # Check if aligned to 10-min boundary
            is_start_aligned = round.start_time.second == 0 and round.start_time.minute % 10 == 0
            is_end_aligned = round.end_time.second == 0 and round.end_time.minute % 10 == 0
            
            remaining = (round.end_time - now).total_seconds()
            
            print(f"  Remaining:  {int(remaining // 60)}:{int(remaining % 60):02d}")
            print(f"  Start aligned: {'✓' if is_start_aligned else '✗ NOT ALIGNED'}")
            print(f"  End aligned:   {'✓' if is_end_aligned else '✗ NOT ALIGNED'}")
            print()
        
        # Show what aligned times should look like
        print("=" * 60)
        print("EXPECTED ALIGNMENT")
        print("=" * 60)
        aligned_start, aligned_end = RoundManager.get_aligned_round_times(now, 600)
        print(f"Current interval should be:")
        print(f"  Start: {aligned_start.strftime('%H:%M:%S')}")
        print(f"  End:   {aligned_end.strftime('%H:%M:%S')}")
        

async def force_settle_and_realign():
    """Force settle all active rounds and let scheduler create aligned ones."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Round).where(Round.status == "active")
        )
        active_rounds = result.scalars().all()
        
        for round in active_rounds:
            print(f"Force settling Round #{round.id}...")
            round.status = "settled"
            round.close_price = round.open_price  # Same as open (no change)
            round.price_change = 0
            round.result = "draw"
        
        await db.commit()
        print("Done! Restart the scheduler to create new aligned rounds.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true", help="Force settle active rounds")
    args = parser.parse_args()
    
    if args.fix:
        asyncio.run(force_settle_and_realign())
    else:
        asyncio.run(check_rounds())
