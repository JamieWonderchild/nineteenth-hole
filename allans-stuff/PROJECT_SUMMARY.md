# Finchley Golf Club RTSF Results Importer — Project Summary

Python replacement for a VBA macro suite (`Results.bas`, `Scoring.bas`, `CountBack.bas`, et al.) that retrieved competition results from [finchleygolfclub.com](https://www.finchleygolfclub.com) and wrote them to an Excel RTSF tracking workbook. The VBA approach stopped working due to Cloudflare bot protection returning 403 errors on direct HTTP requests.

---

## Files

| File | Purpose |
|------|---------|
| `Finchley_Results.py` | Main script — competition list, UI, scraping, Excel output, rename, merge |
| `RTSF_2026_Worksheet.xlsm` | Excel workbook — Inputs tab plus one tab per competition |
| `W11_Env_login_credentials.ps1` | Run once to set credentials as Windows environment variables |
| `requirements.txt` | Python package dependencies |

Both Python files and the workbook live in the same directory.

---

## Environment

| Item | Detail |
|------|--------|
| Python | 3.14 (system) |
| Virtual environment | `venv\` — activate before running |
| Key packages | `playwright`, `playwright-stealth`, `beautifulsoup4`, `requests`, `xlwings` |

**Activate venv (PowerShell):**
```powershell
& "c:\...\Python\RTSF\venv\Scripts\Activate.ps1"
```

**Installation (run once):**
```powershell
pip install playwright playwright-stealth beautifulsoup4 requests xlwings
playwright install chromium
```

---

## Why Playwright

Cloudflare requires JavaScript execution to pass its bot challenge. The `requests` library and VBA's `MSXML2.ServerXMLHTTP` both return 403 on the main login page. Playwright drives a real Chromium browser and passes the challenge. `playwright-stealth` additionally masks the `navigator.webdriver` fingerprint that Cloudflare uses to detect automation.

The competition **list** endpoint (`competition2.php?requestType=ajax`) does not trigger Cloudflare once a valid session cookie is established, so that step uses `page.evaluate()` JS fetch inside the browser context.

---

## Login Strategy

Two separate login mechanisms are used:

### 1. Playwright (individual competition pages and competition list)
Cloudflare's CAPTCHA must be solved manually. The script opens the login page in a visible Chromium window, auto-fills the credentials, and waits up to 2 minutes for the URL to move away from `login.php`. After login the competition list is fetched via `page.evaluate()` JS fetch inside the authenticated browser context.

### Credentials
Stored as permanent Windows user environment variables — not hardcoded. Run `W11_Env_login_credentials.ps1` once in PowerShell:
```powershell
[System.Environment]::SetEnvironmentVariable("FGC_MEMBERID", "your_member_id", "User")
[System.Environment]::SetEnvironmentVariable("FGC_PIN",      "your_pin",       "User")
```

---

## Command-line Modes

The script supports four modes selected by command-line argument:

| Command | Action |
|---------|--------|
| `python Finchley_Results.py [workbook_path]` | Normal run — scrape and import new competitions |
| `python Finchley_Results.py --rename [workbook_path]` | Rename all competition sheets to current naming convention, update Tournament_List, add/fix hyperlinks, remove stale entries |
| `python Finchley_Results.py --merge [workbook_path]` | Merge competition pairs where Merge=TRUE in Tournament_List |
| `python Finchley_Results.py --score [workbook_path]` | Recalculate RTSF scores and refresh the Tournament Scores sheet |
| `python Finchley_Results.py --leaderboard [workbook_path]` | Create or refresh the LeaderBoard sheet for the current date |

All five are also callable from Excel VBA buttons via `RunPythonScript` in the workbook's VBA module.

---

## Workflow (normal run)

1. **Open workbook** — attaches to `RTSF_2026_Worksheet.xlsm` via xlwings if already open in Excel, otherwise opens it.
2. **Setup** — ensures Tournament_List is an Excel-defined Table named `Tournament_List`.
3. **Read Inputs tab** — reads `SeasonStart`, `SeasonEnd`, `RTSFStartDate`, player list (columns M–R), and existing `TournamentList`.
4. **Playwright login** — opens Chromium, auto-fills credentials, waits for CAPTCHA/login.
5. **Player ID lookup** — fetches member directory via `page.goto()`, matches names against Inputs player list, fills blank IDs.
6. **Fetch competition list** — bi-weekly JS fetch POSTs to `competition2.php?requestType=ajax` covering every fortnight of the season.
7. **Competition selector UI** — Tkinter dialog listing all competitions not yet in the worksheet. User ticks which to add and sets Weighting (1–3).
8. **Scrape results** — for each selected competition, Playwright fetches the results page, detects scoring type, handles Gross→Nett sort, and extracts all player rows.
9. **Write competition sheet** — a new worksheet tab is created per competition with a formatted Excel table.
10. **Update TournamentList** — appended, de-duplicated (via `RemoveDuplicates`), and sorted by date then name.
11. **Save** — workbook is saved after each competition so a mid-run failure loses at most one result.

---

## Worksheet Naming Convention

Sheet names follow a strict format to fit Excel's 31-character limit:

| Case | Format | Example |
|------|--------|---------|
| Standard | `CompName[24] yymmdd` | `Fox of the Year 251004` |
| Guest competition | `BaseName[18] Guest yymmdd` | `Fox of the Year Guest 251004` |
| Merged competition | `BaseName[18] Merge yymmdd` | `Fox of the Year Merge 251004` |

`COMP_NAME_ABBREVIATIONS` dict maps long competition names to shorter display names before truncation. `_build_wks_name()` is the single function used for all three modes.

---

## Excel Workbook Structure

### Inputs Tab (named ranges)

| Named Range | Cell | Contents |
|-------------|------|----------|
| `SeasonStart` | A1 | Season start date |
| `SeasonEnd` | A2 | Season end date |
| `RTSFStartDate` | M2 | Date from which RTSF points count |
| `TournamentList` | A4 | Header of Tournament_List Excel Table |
| `Player_Alpha` | M4 | Header of player list table |

The **Tournament_List** Excel Table columns: Included Tournaments, Date, Tees, Weighting, Merge.
Column A entries are hyperlinked to their respective competition worksheets.

The **Player list** table columns: Player Full Name, Player ID, Date Joined, First Name, Surname, On Current List?

### Competition Tabs

Each competition gets its own worksheet tab. Structure:

| Rows | Content |
|------|---------|
| 1–4 | Header block: Competition/Date/Scoring/Weight (cols A–B) and Tees/Competitors/Handicap Allowance/Source URL (cols D–E) |
| 6 | Table column headers |
| 7+ | One row per player |

**Table columns:** Position, Player Name, Player ID, Playing Handicap, Points, RTSF Points, CB 9, CB 6, CB 3, CB 1, Countback

---

## Merge Competitions (`--merge`)

Merges two same-date competitions where both have `Merge=TRUE` in Tournament_List.

- **Base sheet** = higher-weight competition (its metadata, tees, handicap allowance are used)
- **Competition name** = always taken from the host (non-Guest) sheet, with `" (Merged)"` appended to B1
- **Sort** = descending points + descending CB for Stableford; ascending score + ascending CB for Stroke Play
- **RTSF points** = recalculated based on combined field size
- **Tournament_List** = base row updated with merged name and hyperlink, secondary row deleted, Merge flag cleared
- **Source sheets** = deleted after merge

---

## Rename Sheets (`--rename`)

Applies the current naming convention to all existing competition worksheets:
- Detects competition sheets by checking A1 = `"Competition:"` and A2 = `"Date:"`
- Skips sheets whose B1 ends with `"(Merged)"` — those are handled by merge logic
- Updates Tournament_List col A to match any renamed sheets
- Removes stale Tournament_List rows whose sheet no longer exists
- Rebuilds all hyperlinks in Tournament_List col A

---

## Two-Round / Aggregate Competitions

Three CSS class patterns detected in priority order:

| CSS class | Competition type |
|-----------|-----------------|
| `global table table-striped` | Standard (Stableford or stroke play) |
| `resultstable table table-striped` | Two-round (e.g. Captain's Prize) |
| `table table-striped` | Singles Bogey |

Date handling for two-day events:
- `"Saturday 14th June - Sunday 15th June"` → takes the later date (`Sunday 15th June`)
- Aggregate competitions with no date in h4 → parses `"Aggregate of ... (15th Jun) & ... (17th Jun)"` paragraph, takes latest date, uses `season_start.year` as year hint

Player IDs missing from two-round HTML are filled from the member directory lookup dict.

---

## RTSF Points Formula

| Position | RTSF Points |
|----------|-------------|
| 1st | 50 + n |
| 2nd | 25 + n |
| 3rd | 10 + n |
| 4th | 5 + n |
| 5th | n |
| 6th+ | n − (rank − 5), minimum 0 |

where n = total competitors in the field.

---

## Configuration Constants

Defined at the top of `Finchley_Results.py`:

```python
WORKBOOK_NAME           = "RTSF_2026_Worksheet.xlsm"
STABLEFORD_NAMES        = ["masters", "steve biggs", "stableford"]
WEIGHT_OPTIONS          = [1, 2, 3]
COMP_NAME_ABBREVIATIONS = {
    "Middlesex Coronation":          "Coronation Bowl",
    "Captain's Prize Women's 18":    "Captains Prize Women-18",
    "Captain's Prize Women's 12":    "Captains Prize Women-12",
    "Captain's Prize RTSF":          "Captains Prize Women-30",
    "Dibben's Cup":                  "Womens Dibbens Cup",
    "Ward Trophy-Overall":           "Ward Trophy",
    "Captain's Prize Overall":       "Captains Prize",
    "Women's Senior Bronze Overall": "Womens Senior Bronze",
    "Masters Shootout":              "Masters Shootout",
    "Monthly Medal":                 "Monthly Medal",
    "Walk On Stableford":            "Walk On Stableford",
    "Midweek Stableford":            "Midweek Stableford",
    "Women's Club Championship":     "Womens Club Championship",
    "Club Championship":             "Club Championship",
    "Singles Bogey Competition":     "Singles Bogey",
}
```

---

## RTSF Score Calculation (`--score`)

Implemented in `calc_rtsf_scores()` and its helpers (Section 10 of `Finchley_Results.py`).

### Tournament Scores sheet layout

| Row | Col A–C              | Col D                 | Col E onwards                   |
|-----|----------------------|-----------------------|---------------------------------|
| 1   | "RTSF Player List"   | "Tournament" (label)  | Competition name                |
| 2   | —                    | "Weight" (label)      | Weight (1/2/3)                  |
| 3   | "Eligible Players"   | "Date" (label)        | Date ("Aug 9, 2025")            |
| 4   | Player / ID / Gender | "RTSF Score"          | T1, T2, T3 … (T1 = most recent) |
| 5+  | Player data          | Final aggregate score | RTSF Points × weight per player |

After the last competition column: **Knockouts** and **Trophies** fixed columns (both Weight 1, no cap on count).

A gap of 8 columns is left after the Trophies column. The first 5 of those gap columns form a **Component Aggregates** block that summarises each player's best-N rounds and points totals per weight band (W3/W2/W1), plus Knockout and Trophy points. The next 3 columns remain blank as a visual spacer before the **RTSFComponents** diagnostic block.

The **RTSFComponents** block layout (row numbering relative to sheet row 1):

| Row | Content |
|-----|---------|
| 1 | Section title spanning the full block |
| 2 | Empty |
| 3 | Section group labels: "Stableford", "Medals", "Majors", "Match Play", "Total" (centred across their respective columns using xlCenterAcrossSelection) |
| 4 | Sub-headers: Rounds, Points, Pts/Rnd per group; Win, Loss for Match Play; Rounds, Points, Pts/Rnd, Rank for Total |
| 5+ | Player data |

Column groupings use named range variables for border formatting:

| Variable | Columns (offset from start_col) | Content |
|----------|---------------------------------|---------|
| `RTSF_comp_players` | +0 to +1 | Rank, Player |
| `RTSF_comp_stblfd`  | +2 to +5 | Stableford rounds/pts/pts-per-rnd |
| `RTSF_comp_medal`   | +6 to +9 | Medal rounds/pts/pts-per-rnd |
| `RTSF_comp_major`   | +10 to +13 | Major rounds/pts/pts-per-rnd |
| `RTSF_comp_match`   | +14 to +15 | Match Play wins/losses |
| `RTSF_comp_total`   | +16 to +19 | Total rounds/pts/pts-per-rnd/rank |

A medium `BorderAround` is applied to each group independently, plus a medium `BorderAround` across the full row 4 sub-header range.

### Score aggregation

| Weight band      | Competitions                            | Best-N counted      |
|------------------|-----------------------------------------|---------------------|
| 3 — Majors       | Captain's Prize, Ward Trophy, etc.      | Best 3              |
| 2 — Medal/Named  | Monthly Medal, Named events             | Best 4              |
| 1 — Stableford   | Walk On, Midweek Stableford, etc.       | Best 4              |
| Match play       | Tables on "Knockout Competitions" sheet | All scores (no cap) |

The competition worksheet stores RTSF Points **before** the weight multiplier. The multiplier is applied when writing to Tournament Scores (stored value = RTSF Points × weight).

### Date Joined filter

Applied at the Tournament Scores level only. If a player's `Date Joined` (from `Player_Alpha_List` col O) is later than the competition date, that cell in Tournament Scores is left blank and excluded from the best-N selection. Competition worksheets are never modified.

### Match play competitions

Tables on the **"Knockout Competitions"** worksheet. Each table must have `PlayerID` and `Points` columns. Tables are classified as:

- **Knockout** if the table name contains "cansick", "cronshaw", or "holmes" (`KNOCKOUT_TABLE_NAMES` constant)
- **Trophy** otherwise

Knockout points table: QF = 50, SF = 75, F = 150, W = 300.
Trophy points: Finalist = 50, Winner = 100. Pairs events — each partner receives half points (entered manually in the table).

---

## LeaderBoard (`--leaderboard`)

Creates or refreshes a sheet named `LeaderBoard YYMMDD` (e.g. `LeaderBoard 260407`) reflecting the current standings.

### Helper functions

| Function | Purpose |
|----------|---------|
| `_get_rounds_played_from_ts()` | Reads the Tournament Scores sheet to count how many competitions each player has scores in (excluding KO/Trophy columns) |
| `_calc_war()` | Computes the Win Average Ratio per player across all competition sheets — `(position / field_size) * 100` averaged; lower = better |
| `_get_last_leaderboard()` | Finds the most recent prior `LeaderBoard YYMMDD` sheet (excluding today's) for computing rank changes |

### LeaderBoard sheet layout

| Column | Content |
|--------|---------|
| A | Rank |
| B | Player Name |
| C | Player ID |
| D | Rounds played |
| E | RTSF Score |
| F | Win Average Ratio (WAR) |
| G | Change vs previous LeaderBoard (numeric delta) |
| H | Direction indicator |

Sorted by RTSF Score descending. Gridlines are turned off on creation.

### Win Average Ratio (WAR)

For each competition sheet the player appears in: `WAR = (position / field_size) * 100`. The player's overall WAR is the mean across all competitions entered. A lower WAR indicates better relative performance (higher rankings).

### Tab ordering

Worksheet tabs are kept in the following order by `_sort_worksheet_tabs()`:

1. Competition sheets — newest first (by date in sheet name)
2. Knockout Competitions
3. Tournament Scores
4. Inputs
5. LeaderBoard sheets — newest first
6. HTML_Debug

---

## Not Yet Implemented

| Module | Function |
|--------|---------|
| `AdjustPoints` | One-off RTSF point adjustments for specific merged competitions |
| `Reports.bas` | Per-player summary workbook generation |
| `Formatting.bas` | Navigation buttons on competition tabs |
