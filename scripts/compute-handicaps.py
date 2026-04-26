#!/usr/bin/env python3
"""
WHS Handicap Computer — Finchley Golf Club
============================================
Reads fgc-season-2026.csv, computes a WHS Handicap Index for every player
who has ≥ 3 qualifying rounds, then batch-patches the provisional clubMembers
records in Convex via clubMembers:batchPatchHandicaps.

Usage:
  python scripts/compute-handicaps.py [--dry-run] [--min-rounds N]

Options:
  --dry-run       Print results without patching Convex
  --min-rounds N  Minimum rounds to compute HI (default: 3)
  --csv PATH      Path to CSV (default: fgc-season-2026.csv)
"""

import argparse
import csv
import json
import subprocess
import sys
from collections import defaultdict

# ── Finchley course data (Yellow tees) ────────────────────────────────────────

COURSE_RATING = 69.1
SLOPE_RATING  = 125.0
PAR           = 72

# (par, stroke_index) per hole, index 0 = hole 1
HOLES = [
    (4, 17),  # 1
    (4,  5),  # 2
    (3, 15),  # 3
    (4,  3),  # 4
    (4,  9),  # 5
    (4,  1),  # 6
    (3,  7),  # 7
    (5, 11),  # 8
    (5, 13),  # 9
    (4, 16),  # 10
    (4, 14),  # 11
    (3,  8),  # 12
    (5, 10),  # 13
    (4,  2),  # 14
    (3, 18),  # 15
    (4,  4),  # 16
    (5, 12),  # 17
    (4,  6),  # 18
]

# ── WHS table: number of rounds → number of best differentials to use ─────────

WHS_TABLE = {
    3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2,
    9: 3, 10: 3, 11: 3, 12: 4, 13: 4, 14: 4,
    15: 5, 16: 5, 17: 6, 18: 6, 19: 7,
}

def whs_use_count(n_rounds: int) -> int:
    return WHS_TABLE.get(min(n_rounds, 19), 8)  # 20+ rounds → use best 8

# ── WHS formulas ───────────────────────────────────────────────────────────────

def strokes_received(si: int, playing_hcp: int) -> int:
    """Allocation strokes for a hole given playing handicap."""
    if playing_hcp <= 0:
        return 0
    s = 1 if si <= playing_hcp else 0
    if playing_hcp > 18:
        s += 1 if si <= (playing_hcp - 18) else 0
    if playing_hcp > 36:
        s += 1 if si <= (playing_hcp - 36) else 0
    return s

def net_double_bogey(par: int, si: int, playing_hcp: int) -> int:
    return par + 2 + strokes_received(si, playing_hcp)

def adjusted_gross(hole_scores: list, playing_hcp: int) -> int:
    """Apply NDB cap per hole; substitute NDB for pickups (score = 0)."""
    total = 0
    for i, gross in enumerate(hole_scores):
        par, si = HOLES[i]
        cap = net_double_bogey(par, si, playing_hcp)
        if gross == 0:
            # Pickup / not holed out → substitute NDB
            total += cap
        else:
            total += min(gross, cap)
    return total

def score_differential(adj_gross: int) -> float:
    return (113.0 / SLOPE_RATING) * (adj_gross - COURSE_RATING)

def compute_whs_index(rounds: list) -> tuple:
    """
    rounds = list of (hole_scores_18, playing_hcp, competition_name, date)
    Returns (handicap_index, details_list) or (None, []) if < min rounds.
    """
    diffs = []
    for hole_scores, playing_hcp, comp_name, date in rounds:
        if len(hole_scores) != 18:
            continue
        # Skip rounds with no data at all
        if all(s == 0 for s in hole_scores):
            continue
        adj = adjusted_gross(hole_scores, playing_hcp)
        d = round(score_differential(adj), 1)
        diffs.append((d, comp_name, date, adj))

    if not diffs:
        return None, []

    diffs_sorted = sorted(diffs, key=lambda x: x[0])
    use_n = whs_use_count(len(diffs_sorted))
    best = diffs_sorted[:use_n]
    avg = sum(d[0] for d in best) / len(best)
    hi = round(avg * 0.96, 1)
    # Cap at WHS maximum of 54.0
    hi = min(hi, 54.0)
    return hi, diffs_sorted

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Compute WHS handicaps from FGC CSV")
    parser.add_argument("--dry-run", action="store_true", help="Print without patching Convex")
    parser.add_argument("--min-rounds", type=int, default=3, help="Minimum qualifying rounds")
    parser.add_argument("--csv", default="fgc-season-2026.csv", help="Path to CSV file")
    parser.add_argument("--club-id", default="j9701ee467w0d5vkamjjcjsmsd84e5vf",
                        help="Convex clubs._id for Finchley")
    args = parser.parse_args()

    # ── Load CSV ──────────────────────────────────────────────────────────────
    players: dict = defaultdict(lambda: {"name": "", "rounds": []})

    with open(args.csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = row["player_id"].strip()
            if not pid:
                continue  # skip rows without a FGC member ID (team events etc.)

            # Extract per-hole gross scores
            try:
                hole_scores = [int(row.get(f"h{i}", 0) or 0) for i in range(1, 19)]
            except (ValueError, TypeError):
                continue

            # Need all 18 holes present
            if len(hole_scores) != 18:
                continue

            try:
                playing_hcp = int(float(row.get("handicap", 0) or 0))
            except (ValueError, TypeError):
                playing_hcp = 0

            gross_total = row.get("gross_total", "")
            try:
                gross_total = int(gross_total)
            except (ValueError, TypeError):
                gross_total = None

            # Skip rows with no gross total (team events, walk-ons with no scorecard)
            if gross_total is None or gross_total == 0:
                continue

            players[pid]["name"] = row["player_name"].strip()
            players[pid]["rounds"].append((
                hole_scores,
                playing_hcp,
                row.get("competition", ""),
                row.get("date", ""),
            ))

    # ── Compute handicaps ─────────────────────────────────────────────────────
    print(f"\n{'Player':<30} {'Rounds':>6} {'HI':>6}  Best differentials used")
    print("-" * 80)

    updates = []
    skipped = 0

    for pid, data in sorted(players.items(), key=lambda x: x[1]["name"]):
        name = data["name"]
        rounds = data["rounds"]

        hi, details = compute_whs_index(rounds)

        if hi is None or len([d for d in details]) < args.min_rounds:
            skipped += 1
            continue

        use_n = whs_use_count(len(details))
        best_diffs = [f"{d[0]:.1f} ({d[1]}, {d[3]})" for d in details[:use_n]]

        print(f"{name:<30} {len(details):>6} {hi:>6.1f}  {', '.join(best_diffs)}")
        updates.append({"fgcMemberId": pid, "handicap": hi})

    print(f"\n{len(updates)} players computed, {skipped} skipped (< {args.min_rounds} rounds)")

    if not updates:
        print("Nothing to update.")
        return

    if args.dry_run:
        print("\n[DRY RUN] Would patch:")
        print(json.dumps(updates[:5], indent=2), "..." if len(updates) > 5 else "")
        return

    # ── Batch patch Convex ────────────────────────────────────────────────────
    payload = json.dumps({
        "clubId": args.club_id,
        "updates": updates,
    })
    print(f"\nPatching {len(updates)} members in Convex…")
    result = subprocess.run(
        ["npx", "convex", "run", "clubMembers:batchPatchHandicaps", payload],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("ERROR:", result.stderr)
        sys.exit(1)
    print("Convex response:", result.stdout.strip())

if __name__ == "__main__":
    main()
