"""
convex_push.py — Push Finchley competition results to the Play The Pool app.

Usage (standalone test):
    python convex_push.py

Usage (from Finchley_Results.py):
    from convex_push import push_competition

    push_competition(
        competition_name="Monthly Medal",
        competition_date="2026-04-15",   # YYYY-MM-DD
        category="medal",                # major | medal | stableford | knockout | trophy
        results=[
            {"position": 1, "name": "Jamie Aronson", "memberId": "12345"},
            {"position": 2, "name": "Alan Smith",    "memberId": "6789"},
        ],
        is_pairs_event=False,            # set True for Ward Trophy pairs, etc.
    )

Configuration:
    Set the following as Windows environment variables (same approach as FGC credentials):
        CONVEX_URL        — Convex HTTP URL, e.g. https://happy-animal-123.convex.site
        FGC_IMPORT_TOKEN  — the club import token shown in the Play The Pool admin panel
                            (Manage → scroll to "Data Import" → copy the ptp_... token)

    Or pass them directly to push_competition() as keyword args.

    The import token is club-scoped — it can only push results for Finchley GC.
    If it ever needs to be changed, the admin regenerates it from the dashboard.

Category mapping (matches Finchley RTSF weights):
    "stableford" — Walk On, Midweek Stableford, etc.          (weight 1, best 4 count)
    "medal"      — Monthly Medal, Coronation, Singles Bogey    (weight 2, best 4 count)
    "major"      — Captain's, Ward, Dibben, President, Tiger   (weight 3, best 3 count)
    "knockout"   — Cansick, Cronshaw, Holmes cups              (300/150/75/50 pts, all count)
    "trophy"     — All other trophies                          (100/50 pts, all count)
"""

import os
import json
import datetime
import requests


# ---------------------------------------------------------------------------
# Default config from environment (same pattern as FGC credentials)
# ---------------------------------------------------------------------------
CONVEX_URL    = os.environ.get("CONVEX_URL", "")
IMPORT_TOKEN  = os.environ.get("FGC_IMPORT_TOKEN", "")
CLUB_SLUG     = os.environ.get("FGC_CLUB_SLUG", "finchley-golf-club")

# Competition name → RTSF category
# Mirrors the auto_weight() logic in Finchley_Results.py but maps to category strings
def auto_category(comp_name: str) -> str:
    """
    Return the RTSF category string for a competition based on its name.
    Mirrors the weight logic from Finchley_Results.py.
    """
    def has(s):
        return s.lower() in comp_name.lower()

    if has("Stableford"):
        return "stableford"

    # Knockout competitions (by table name convention)
    for knockout in ["Cansick", "Cronshaw", "Holmes"]:
        if has(knockout):
            return "knockout"

    # Trophy competitions
    if has("Ward Trophy") or has("Dibben") or has("Captain") or has("President") \
            or has("Tiger of the Year") or has("Fox of the Year"):
        return "major"

    # Medal / named events (weight 2)
    if has("Medal") or has("Coronation") or has("Biggs") or has("Open Pairs") \
            or has("Singles Bogey") or has("Braid") or has("Rabbit") or has("Senior of the Year") \
            or has("Club Championship") or has("Masters"):
        return "medal"

    return "stableford"


def push_competition(
    competition_name: str,
    competition_date: str,
    results: list[dict],
    category: str | None = None,
    is_pairs_event: bool = False,
    convex_url: str | None = None,
    api_key: str | None = None,
    club_slug: str | None = None,
    dry_run: bool = False,
) -> dict:
    """
    Push competition results to the Play The Pool app.

    Args:
        competition_name:  Full competition name, e.g. "Monthly Medal"
        competition_date:  ISO date string "YYYY-MM-DD"
        results:           List of dicts, each with:
                               position (int)
                               name     (str)  — player's full name
                               memberId (str, optional) — Finchley member ID
        category:          RTSF category override. If None, auto-detected from name.
        is_pairs_event:    True for Trophy pairs events (points halved per partner).
        convex_url:        Override CONVEX_URL env var.
        api_key:           Override CONVEX_API_KEY env var.
        club_slug:         Override FGC_CLUB_SLUG env var.
        dry_run:           If True, print payload but don't send.

    Returns:
        Response JSON dict from the server (or dry_run payload).
    """
    url     = (convex_url or CONVEX_URL).rstrip("/") + "/api/import-results"
    key     = api_key or CONVEX_API_KEY
    slug    = club_slug or CLUB_SLUG
    cat     = category or auto_category(competition_name)

    if not url or "/api/import-results" == url:
        raise ValueError("CONVEX_URL not set. Add it as an environment variable or pass convex_url=...")
    if not key:
        raise ValueError("CONVEX_API_KEY not set. Add it as an environment variable or pass api_key=...")

    # Validate / normalise date
    if isinstance(competition_date, datetime.date):
        competition_date = competition_date.isoformat()
    elif not isinstance(competition_date, str) or len(competition_date) != 10:
        raise ValueError(f"competition_date must be 'YYYY-MM-DD', got: {competition_date!r}")

    payload = {
        "clubSlug":        slug,
        "competitionName": competition_name,
        "competitionDate": competition_date,
        "category":        cat,
        "isPairsEvent":    is_pairs_event or None,
        "results": [
            {
                "position": int(r["position"]),
                "name":     str(r["name"]),
                **({"memberId": str(r["memberId"])} if r.get("memberId") else {}),
            }
            for r in results
        ],
    }
    # Remove None values
    payload = {k: v for k, v in payload.items() if v is not None}

    if dry_run:
        print("=== DRY RUN — would POST to:", url)
        print(json.dumps(payload, indent=2))
        return payload

    resp = requests.post(
        url,
        json=payload,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type":  "application/json",
        },
        timeout=30,
    )

    if resp.status_code == 200:
        data = resp.json()
        print(f"[convex_push] OK — {data.get('competitionName')} | "
              f"{data.get('entriesCreated', 0)} created, {data.get('entriesUpdated', 0)} updated"
              + (f" | linked to: {data['linkedSeries']}" if data.get('linkedSeries') else ""))
        return data
    else:
        raise RuntimeError(
            f"[convex_push] HTTP {resp.status_code}: {resp.text[:400]}"
        )


# ---------------------------------------------------------------------------
# Standalone smoke test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("convex_push.py — smoke test (dry run)")
    push_competition(
        competition_name="Monthly Medal",
        competition_date="2026-04-15",
        category="medal",
        results=[
            {"position": 1, "name": "Jamie Aronson", "memberId": "1001"},
            {"position": 2, "name": "Alan Smith",    "memberId": "1002"},
            {"position": 3, "name": "Bob Jones",     "memberId": "1003"},
        ],
        dry_run=True,
    )
