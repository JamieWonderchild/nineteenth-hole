# Play The Pool — Data Import Instructions for Allan

This guide explains how to set up and run the Finchley GC results importer
that pushes competition results into Play The Pool.

---

## One-Time Setup

### Step 1 — Install Python dependencies

Open a terminal (Command Prompt or PowerShell) and run:

```
pip install -r requirements.txt
playwright install chromium
```

### Step 2 — Set environment variables

You need to store three values as Windows environment variables so the
scripts can find them automatically. Run these three commands **once** in
PowerShell (then close and reopen any terminal windows for them to take effect):

```powershell
[System.Environment]::SetEnvironmentVariable("CONVEX_URL", "https://kindly-opossum-400.eu-west-1.convex.site", "User")
[System.Environment]::SetEnvironmentVariable("FGC_IMPORT_TOKEN", "ptp_rp21a14d2d4r4orfjihfc43z", "User")
[System.Environment]::SetEnvironmentVariable("FGC_CLUB_SLUG", "finchley-golf-club", "User")
```

> **Keep the token private** — treat it like a password. It authorises
> imports for Finchley GC only. If it ever needs changing, Jamie can
> regenerate it from the Play The Pool admin dashboard.

To confirm the variables are saved, run:

```powershell
[System.Environment]::GetEnvironmentVariable("CONVEX_URL", "User")
[System.Environment]::GetEnvironmentVariable("FGC_IMPORT_TOKEN", "User")
```

Both should print their values.

---

## Running the Importer

### Option A — Automatic (via Finchley_Results.py)

Once the main scraper finishes running, results are pushed automatically.
Just run the scraper as normal:

```
python Finchley_Results.py
```

### Option B — Manual push for a specific competition

Open a Python terminal in this folder and run:

```python
from convex_push import push_competition

push_competition(
    competition_name="Monthly Medal",
    competition_date="2026-04-06",   # YYYY-MM-DD format
    results=[
        {"position": 1, "name": "Jamie Aronson", "memberId": "1001"},
        {"position": 2, "name": "Alan Smith",    "memberId": "1002"},
        {"position": 3, "name": "Bob Jones",     "memberId": "1003"},
    ],
)
```

The `memberId` is the Finchley member number — it helps match players to
existing accounts. It's optional but useful.

### Dry run (no data sent)

To preview what would be sent without actually pushing anything:

```python
push_competition(
    competition_name="Monthly Medal",
    competition_date="2026-04-06",
    results=[...],
    dry_run=True,
)
```

---

## Category Detection

The category is detected automatically from the competition name.
You can also set it explicitly with `category="medal"` etc.

| Category     | Competitions                                              |
|------------- |-----------------------------------------------------------|
| `stableford` | Walk On, Midweek Stableford, anything with "Stableford"   |
| `medal`      | Monthly Medal, Coronation, Singles Bogey, Masters, etc.   |
| `major`      | Captain's Prize, Ward Trophy, Dibben, President, Tiger    |
| `knockout`   | Cansick Cup, Cronshaw Cup, Holmes Cup                     |
| `trophy`     | All other trophies                                        |

For **pairs events** (e.g. Ward Trophy pairs), add `is_pairs_event=True`.

---

## What Happens on a Successful Push

You'll see a confirmation line like:

```
[convex_push] OK — Monthly Medal | 24 created, 2 updated | linked to: Race to Swinley Forest 2026
```

The competition will appear immediately in Play The Pool as completed, with
all players listed in finishing order and linked to the active season series.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `FGC_IMPORT_TOKEN not set` | Re-run the PowerShell SetEnvironmentVariable commands and reopen your terminal |
| `CONVEX_URL not set` | Same as above — check the CONVEX_URL variable is saved |
| `HTTP 401` | Token is wrong or has been regenerated — ask Jamie for the new one |
| `HTTP 404` | Club slug is wrong — should be `finchley-golf-club` |
| `competition_date must be 'YYYY-MM-DD'` | Check the date format — use `"2026-04-06"` not `"06/04/2026"` |
