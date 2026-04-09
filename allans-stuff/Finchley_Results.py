"""
Finchley_Results.py
====================
Retrieves Finchley Golf Club competition results and writes them to
RTSF_2026_Worksheet.xlsx using xlwings (so the file can remain open in Excel
while the script runs).

Workflow
--------
1.  Opens RTSF_2026_Worksheet.xlsx via xlwings (attaches if already open).
2.  Reads SeasonStart / SeasonEnd from the Inputs tab.
3.  Fetches the full competition list for the season via bi-weekly POST
    requests to competition2.php (same approach as the original VBA).
4.  Shows a Tkinter dialog listing all competitions not yet on the
    TournamentList — user ticks which ones to add and sets Weighting.
5.  For each selected competition:
      a. Scrapes the results page with Playwright (Cloudflare bypass).
      b. Parses player rows: position, name, handicap, player ID, points,
         countback (CB9 / CB6 / CB3 / CB1), and calculates RTSF points.
      c. Creates a new worksheet tab named after the competition.
      d. Writes a formatted Excel table via xlwings.
      e. Updates the TournamentList on the Inputs tab.

Installation (run once in your venv)
--------------------------------------
    pip install playwright playwright-stealth beautifulsoup4 xlwings requests
    playwright install chromium

Credentials — stored as Windows user environment variables:
    $env:FGC_MEMBERID = "your_member_id"
    $env:FGC_PIN      = "your_pin"
Or run W11_Env_login_credentials.ps1 once to set them permanently.
"""

# ---------------------------------------------------------------------------
# Standard library
# ---------------------------------------------------------------------------
import os
import re
import sys
import time
import json
import datetime
import tkinter as tk
from tkinter import ttk, messagebox

# ---------------------------------------------------------------------------
# Third-party
# ---------------------------------------------------------------------------
import requests
from bs4 import BeautifulSoup
import xlwings as xw
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
WORKBOOK_NAME   = "RTSF_2026_Worksheet.xlsm"
BASE_URL        = "https://www.finchleygolfclub.com"
LOGIN_URL       = f"{BASE_URL}/login.php"
COMP_LIST_URL   = f"{BASE_URL}/competition2.php"
COMP_BASE_URL   = f"{BASE_URL}/competition.php"
DIRECTORY_URL   = f"{BASE_URL}/directory.php?mode=list"

MEMBER_ID = os.environ.get("FGC_MEMBERID", "")
PIN       = os.environ.get("FGC_PIN", "")

# Competitions whose name matches any of these strings are forced to Stableford
# scoring even if the table header says Nett/Gross.
STABLEFORD_NAMES = ["masters", "steve biggs", "stableford"]

# Column headers written to every competition worksheet table
COMP_TABLE_HEADERS = [
    "Position", "Player Name", "Player ID", "Playing Handicap",
    "Points", "RTSF Points", "CB 9", "CB 6", "CB 3", "CB 1", "Countback",
]

# Weighting options presented in the UI
WEIGHT_OPTIONS = [1, 2, 3]

# Full-name → shortened display name for competitions whose auto-truncation
# produces an ugly result. Matched as a substring (case-insensitive).
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

# Match play tables whose name contains one of these strings (case-insensitive)
# are treated as Knockout events; all other tables on 'Knockout Competitions'
# are treated as Trophy events.
KNOCKOUT_TABLE_NAMES = ["cansick", "cronshaw", "holmes"]

# Maximum number of scores counted per weight band toward the RTSF total.
# Match play (Knockouts + Trophies) has no cap — all scores count.
BEST_N = {3: 3, 2: 4, 1: 4}

def auto_weight(comp_name: str) -> int:    
    """
    Function which returns the default RTSF weight for a competition based on its name.

      1 — Stableford, or anything else not matched below
      2 — Any Medal, Coronation, Biggs, Open Pairs, Singles Bogey,
          Braid, Rabbit of the Year, Senior of the Year
      3 — Dibben, Ward, Captain (incl. Captain's Day/Prize),
          President (incl. Presidents Day/Putter),
          Tiger of the Year, Fox of the Year

    Fuzzy matching: substring checks are case-insensitive so spelling
    variants (apostrophe, suffix) are all captured automatically, e.g.
    "President's Day", "Presidents Day", "President's Putter" → all weight 3.
    """
    def has(substring):
        return substring.lower() in comp_name.lower()

    # Weight 1 — exit early
    if has("Stableford"): return 1

    # Weight 2
    if has("Medal"):              return 2
    if has("Masters"):            return 2
    if has("Coronation"):         return 2
    if has("Club Championships"): return 2
    if has("Biggs"):              return 2
    if has("Open Pairs"):         return 2
    if has("Singles Bogey"):      return 2
    if has("Braid Trophy"):              return 2
    if has("Rabbit of the Year"):             return 2
    if has("Senior of the Year"): return 2

    # Weight 3
    if has("Dibben"):    return 3
    if has("Ward Trophy"):      return 3
    if has("Captain"):   return 3
    if has("President"): return 3
    if has("Tiger of the Year"):     return 3
    if has("Fox of the Year"):       return 3

    return 1


# ===========================================================================
# SECTION 1 — xlwings helpers
# ===========================================================================

def open_workbook() -> xw.Book:
    """
    Attach to the workbook if it is already open in Excel, otherwise open it.

    Path resolution order:
      1. Command-line argument (passed by the VBA macro via ThisWorkbook.FullName)
      2. WORKBOOK_NAME constant in the same directory as this script
    """
    # Filter out flag arguments (e.g. --rename) to find the workbook path
    # sys. argv is a list that stores command-line arguments passed to a Python
    # script. The first element, sys. argv[0] , represents the script name, 
    # while the remaining elements are the actual arguments provided by the user.
    # sys.argv[1:] skips the script name; we only want additional arguments
    # In the next line, a is a variable name for arguments and we're looking for
    # arguments that don't begin with "--"    
    path_args = [a for a in sys.argv[1:] if not a.startswith("--")]
    # `if path_args` checks if the list is not empty 
    # (i.e., if there is at least one argument that doesn't start with "--").
    # The VBA macro which call the Python script pass ThisWorkbook.FullName as a
    # command-line argument when calling the script. So when run from an Excel 
    # button, the path arrives via sys.argv and the lines immediately below handle it.
    if path_args:  
        # Take the first non-flag argument as the workbook path
        wb_path = path_args[0]  
    else:
        # These lines are the fallback for when you run directly from 
        # the terminal without specifying a path — it assumes the workbook
        # is in the same directory as the script. 
        # os.path.dirname gets the directory of this Python script, 
        # os.path.abspath resolves it to an absolute path (i.e. the full path name,
        # no just the filename and extension)
        # os.path.join combines the script directory with the 
        # WORKBOOK_NAME to get the full path to the workbook
        script_dir = os.path.dirname(os.path.abspath(__file__))
        wb_path    = os.path.join(script_dir, WORKBOOK_NAME)

    # Check if already open
    for RTSF_book in xw.books:
        if os.path.normcase(RTSF_book.fullname) == os.path.normcase(wb_path):
            print(f"Attached to open workbook: {RTSF_book.name}")
            return RTSF_book

    RTSF_book = xw.Book(wb_path)
    print(f"Opened workbook: {RTSF_book.name}")
    return RTSF_book


def read_inputs(RTSF_book: xw.Book) -> dict:    # -> dict is a return type annotation: documents that this function returns a dict
                                                # This is not enforced at runtime, but can be checked by static analysis tools and 
                                                # helps readers understand the expected return type.
    """
    Read configuration values from the Inputs worksheet and return them
    as a single dict so callers can access everything via inputs["key"].

    The returned dict contains a mix of types — not all values are dicts:
        season_start  : datetime.date  — season start date (named range SeasonStart)
        season_end    : datetime.date  — season end date (named range SeasonEnd)
        rtsf_start    : datetime.date  — date from which RTSF points count (RTSFStartDate)
        players       : dict           — {player_id (int): player_name (str)}, built from
                                         the Player_Alpha_List table (cols M-N, rows 5+)
        existing_comps: set            — set of competition name strings already present
                                         in the TournamentList table; used to filter the
                                         competition selector UI so already-added comps
                                         are not shown again
        tournament_tbl: xw.Range       — xlwings Range object pointing to the TournamentList
                                         header cell (A4); used as an anchor throughout the
                                         code to offset into table rows without needing to
                                         know the absolute row number
    """
    wks = RTSF_book.sheets["Inputs"]

    # the read_date function reads a date from a named range, handling 
    # both Excel date formats and string formats
    def read_date(named_range: str) -> datetime.date:
        # Each date named range points to a label cell; 
        # the value is one column to the right
        val = RTSF_book.names[named_range].refers_to_range.offset(0, 1).value
        if isinstance(val, datetime.datetime):
            return val.date()
        return datetime.datetime.strptime(str(val), "%Y-%m-%d").date()

    season_start = read_date("SeasonStart")
    season_end   = read_date("SeasonEnd")
    rtsf_start   = read_date("RTSFStartDate")

    # Build players dict from the Player_Alpha_List table (col M = name, col N = ID)
    # Only players with a populated ID are included — blanks are skipped
    # Blank ID's are updated later in the update_player_ids() function after looking up from the directory
    # This function is then re-run to repopulate the players dict
    player_start = wks.range("M5")
    players = {}  # {player_id (int): player_name (str)}
    row = 0
    while True:
        name = player_start.offset(row, 0).value
        pid  = player_start.offset(row, 1).value
        if name is None:
            break
        if pid is not None:
            players[int(pid)] = str(name).strip()
        row += 1

    # Build existing_comps set from TournamentList col A (rows below the header)
    # This is a set of strings, not a dict — used only for membership testing
    tl_header = wks.range("TournamentList")  # named range anchored at header cell A4
    existing_comps = set()
    r = 1  # start at row offset 1 (first data row below header)
    while True:
        val = tl_header.offset(r, 0).value
        if val is None:
            break
        existing_comps.add(str(val).strip())
        r += 1

    # Package everything into a named dict for convenient access by callers
    # Returned dict is assigned to the variable 'inputs' in main()
    inputs_data = {
        "season_start":   season_start,
        "season_end":     season_end,
        "rtsf_start":     rtsf_start,
        "players":        players,        # dict: {id: name}
        "existing_comps": existing_comps, # set of comp name strings
        "tournament_tbl": tl_header,      # xw.Range anchor at A4
    }
    return inputs_data


# ===========================================================================
# SECTION 2 — Player ID lookup from member directory
# ===========================================================================

def fetch_player_id_dict(page) -> dict:  
    """
    Fetch the member directory page and return {player_name: player_id}.
    Mirrors VBA GetIDDictionary / ParsePlayerIDs.

    The directory table (class 'nametable') has one row per member:
      td[0] = blank / flag
      td[1] = player name
      td[-1] = action links including messages.php?users=<id>
      
    The page.goto() command is from the Playwright library and represents a browser tab
    page.goto(DIRECOTY_URL) loads the members directory page in the Playwright 
    browser context, which is already authenticated via the login() function. 
    This allows us to bypass Cloudflare and access the page content directly. 
    After loading the page, we wait for the DOM content to be fully loaded with 
    page.wait_for_load_state("domcontentloaded"). Then we use BeautifulSoup to 
    parse the HTML content of the page and extract the player names and IDs from
    the directory table. The resulting dictionary maps player names to their
    corresponding IDs, which can be used later to populate missing IDs in the 
    Inputs tab.
    """
    page.goto(DIRECTORY_URL)
    page.wait_for_load_state("domcontentloaded")
    # The content() method retrieves the full HTML content of the page 
    # as a string, which is then parsed by BeautifulSoup to create a soup object
    # that allows us to navigate and search the HTML structure easily.
    # page.content() — the raw HTML string of the page, retrieved from Playwright. 
    # This is the input to parse.
    # "html.parser" — tells BeautifulSoup which parser engine to use. 
    # html.parser is Python's built-in HTML parser (no extra install needed). 
    soup = BeautifulSoup(page.content(), "html.parser")
    
    # After being parsed, soup is a is a navigable object that lets you search
    # the HTML by tag, class, attribute etc. — which is what the next line does:
    table = soup.find("table", class_=lambda c: c and "sortableTable" in c)
    if table is None:
        print("  Warning: member directory table not found on directory page.")
        return {}

    id_dict = {}
    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        # Player name from td[1] — collapse whitespace, strip friend-request text
        raw_name = cells[1].get_text(separator=" ", strip=True)
        name = re.sub(r"Send\s+a\s+friend\s+request", "", raw_name, flags=re.IGNORECASE)
        name = re.sub(r"\s+", " ", name).strip()

        # Player ID from messages.php?users= link in last cell
        # The cell contains something like this:
        # <a class="btn button" href="/messages.php?edit=new&amp;users=XXXXX">
        #   Message
        #  </a>
        # the "users=XXXXX" contains the player ID we want to extract
        # First set player_id to a null value
        player_id = ""
        for a in cells[-1].find_all("a", href=True):
            # re.search is from Python's built-in re (regular expressions) module. 
            # Breaking down the full line:
            # m = re.search(r"messages\.php.*?users=(\d+)", a["href"])
            # a["href"] — the URL string being searched, e.g. messages.php?mode=post&users=12345
            # re.search(...) — scans through the string looking for the first place where the 
            # pattern matches. Returns a match object if found, or None if not.
            # The pattern r"messages\.php.*?users=(\d+)":
            # messages\.php — matches the literal text messages.php (the \. escapes the dot, 
            # which otherwise means "any character" in regex)
            # .*? — matches any characters in between, as few as possible (? makes it non-greedy)
            # users= — matches the literal text users=
            # (\d+) — matches one or more digits (\d+) and the parentheses capture that group so 
            # it can be retrieved separately
            # if m: — checks whether a match was found (match object is truthy, None is falsy)
            # m.group(1) — retrieves the first captured group, i.e. just the digits after users= — the player ID
            m = re.search(r"messages\.php.*?users=(\d+)", a["href"])
            if m:
                player_id = m.group(1)
                break

        if name and player_id:
            id_dict[name] = player_id

    print(f"  Directory loaded: {len(id_dict)} players found.")
    return id_dict


def update_player_ids(RTSF_book: xw.Book, page,
                       limit: int = None, dry_run: bool = False) -> tuple[int, dict]:
    """
    For each player in the Inputs tab player list (M5 downward) whose ID
    cell (column N) is blank, look up the ID from the member directory
    and fill it in.

    Returns (number_of_ids_written, dir_dict) where dir_dict is the full
    {name: player_id} directory — always fetched so it can be used as a
    fallback when scraping two-round competitions.

    Parameters
    ----------
    limit   : if set, only check the first N rows (useful for testing)
    dry_run : if True, print matches but do not write anything to the workbook
    """
    ws           = RTSF_book.sheets["Inputs"]
    player_start = ws.range("M5")

    # Always fetch the directory — it is needed as a fallback for two-round
    # competitions where the HTML contains no playerid= link.
    print("  Fetching member directory...")
    id_dict = fetch_player_id_dict(page)

    # Collect rows with blank IDs
    candidates = []
    row = 0
    while True:
        name = player_start.offset(row, 0).value
        if name is None:
            break
        pid = player_start.offset(row, 1).value
        blank_id = pid is None or str(pid).strip() == ""
        if dry_run or blank_id:
            candidates.append((row, str(name).strip()))
        row += 1
        if limit and len(candidates) >= limit:
            break

    if not candidates:
        print("  All player IDs already populated.")
        return 0, id_dict

    label = "DRY RUN — " if dry_run else ""
    print(f"  {label}{len(candidates)} player(s) with blank IDs — writing matches...")

    updated = 0
    for row_offset, name in candidates:
        pid = id_dict.get(name)
        if pid:
            if dry_run:
                print(f"  [DRY RUN] '{name}' → ID {pid}")
            else:
                player_start.offset(row_offset, 1).value = int(pid)
            updated += 1
        else:
            print(f"  No directory match for '{name}'")

    if updated and not dry_run:
        RTSF_book.save()
    print(f"  {'Would write' if dry_run else 'Written'}: {updated} of {len(candidates)} IDs")

    return updated, id_dict


# ===========================================================================
# SECTION 3 — Login & competition list
# ===========================================================================

def login_requests() -> requests.Session:
    """
    Log in to the Finchley Golf Club website using the requests library.
    Returns an authenticated Session with cookies set.
    Raises RuntimeError if login fails.
    """
    if not MEMBER_ID or not PIN:
        raise RuntimeError(
            "Credentials not set. Please set environment variables "
            "FGC_MEMBERID and FGC_PIN, or run W11_Env_login_credentials.ps1."
        )

    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.5",
    })

    login_data = {
        "task":     "login",
        "topmenu":  "1",
        "memberid": MEMBER_ID,
        "pin":      PIN,
        "cachemid": "1",
        "Submit":   "Login",
    }

    resp = session.post(BASE_URL + "/", data=login_data, timeout=30)

    if resp.status_code not in (200, 302):
        raise RuntimeError(f"Login HTTP error: {resp.status_code}")
    if "Invalid login" in resp.text or "Incorrect password" in resp.text:
        raise RuntimeError("Login failed — check MEMBER_ID and PIN.")

    print("Logged in successfully via requests.")
    return session


def fetch_competition_list(page,
                           season_start: datetime.date,
                           season_end:   datetime.date) -> list[dict]:
    """
    Retrieve all competitions for the season via bi-weekly POST requests,
    mirroring the VBA GetGolfComps logic.

    Uses page.request.fetch() so the POST runs within the authenticated
    Playwright browser context, bypassing Cloudflare.

    Returns a list of dicts: {id, name, date_str}
    """
    post_url = (
        f"{COMP_LIST_URL}"
        "?requestType=ajax&ajaxaction=compsfilter"
    )

    seen_ids = set()
    competitions = []

    cur_year     = season_start.year
    start_month  = season_start.month
    end_month    = season_end.month

    # Loop months in reverse (most recent first, matches VBA)
    for month in range(end_month, start_month - 1, -1):
        for period in (1, 2):   # period 1 = 15th-end, period 2 = 1st-14th
            if period == 1:
                from_date = f"15/{month:02d}/{cur_year}"
                # Last day of month
                if month == 12:
                    to_date = f"31/12/{cur_year}"
                else:
                    last = (datetime.date(cur_year, month + 1, 1)
                            - datetime.timedelta(days=1)).day
                    to_date = f"{last:02d}/{month:02d}/{cur_year}"
            else:
                from_date = f"01/{month:02d}/{cur_year}"
                to_date   = f"14/{month:02d}/{cur_year}"

            post_data = (
                f"fromdate={from_date}&todate={to_date}"
                "&entrants=all&offset=0&all_loaded=0&loadmore=1"
                "&requestType=ajax&ajaxaction=compsfilter"
            )

            try:
                response_text = page.evaluate(
                    """async ({url, body}) => {
                        const resp = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body: body
                        });
                        if (!resp.ok) throw new Error('HTTP ' + resp.status);
                        return await resp.text();
                    }""",
                    {"url": post_url, "body": post_data}
                )
            except Exception as exc:
                print(f"  Warning: POST failed for {from_date}–{to_date}: {exc}")
                print(f"  URL: {post_url}")
                continue

            new_comps = _parse_comp_list_response(response_text)
            for comp in new_comps:
                if comp["id"] not in seen_ids:
                    seen_ids.add(comp["id"])
                    competitions.append(comp)

    print(f"Found {len(competitions)} competitions for the season.")
    return competitions


def _parse_comp_list_response(html_content: str) -> list[dict]:
    """
    Parse the JSON/HTML response from the bi-weekly POST request.
    Mirrors VBA ParseCompJSON logic.
    Returns list of {id, name, date_str}.
    """
    results = []
    seen    = set()

    # The response is JSON with an "html" key containing escaped HTML
    try:
        payload  = json.loads(html_content)
        raw_html = payload.get("html", "")
        # Unescape
        raw_html = raw_html.replace('\\"', '"').replace("\\/", "/")
        raw_html = raw_html.replace("\\n", "\n").replace("\\r", "")
    except (json.JSONDecodeError, AttributeError):
        raw_html = html_content  # fall back to treating as plain HTML

    soup = BeautifulSoup(raw_html, "html.parser")

    for link in soup.find_all("a", href=True):
        href = link["href"]
        m = re.search(r"competition\.php\?compid=(\d+)", href)
        if not m:
            continue
        comp_id = m.group(1)
        if comp_id in seen:
            continue
        seen.add(comp_id)

        # Competition name: look for comp-name class nearby
        name_tag  = link.find_next(class_="comp-name")
        comp_name = ""
        if name_tag:
            comp_name = name_tag.get_text(strip=True)
            comp_name = comp_name.replace("OPEN COMPETITION", "").strip()

        # Date: look for comp-date class
        date_tag  = link.find_next(class_="comp-date")
        comp_date = date_tag.get_text(strip=True) if date_tag else ""

        if comp_name:
            results.append({"id": comp_id, "name": comp_name, "date_str": comp_date})

    return results


# ===========================================================================
# SECTION 3 — Competition selection UI (Tkinter)
# ===========================================================================

def show_competition_selector(competitions: list[dict],
                               existing_comps: set) -> list[dict]:
    """
    Show a Tkinter window listing competitions not yet added.
    User ticks which ones to include and sets a Weighting (1–4) for each.

    Returns a list of selected dicts, each extended with a 'weight' key.
    """
    # Filter out already-added competitions
    new_comps = [c for c in competitions
                 if c["name"] not in existing_comps]

    if not new_comps:
        messagebox.showinfo(
            "No new competitions",
            "All competitions for this season are already in the worksheet."
        )
        return []

    selected = []

    root = tk.Tk()
    root.title("Select Competitions to Add")
    root.resizable(True, True)
    root.lift()
    root.attributes("-topmost", True)
    root.after(100, lambda: root.attributes("-topmost", False))

    # --- Instructions ---
    tk.Label(
        root,
        text="Tick the competitions to add, then set their Weighting (1–4).\n"
             "Weight 1 = standard, 2 = major, 3 = championship, 4 = season finale.",
        justify=tk.LEFT,
        padx=10, pady=6,
        font=("Segoe UI", 10),
    ).pack(anchor="w")

    # --- Scrollable frame ---
    container = tk.Frame(root)
    container.pack(fill=tk.BOTH, expand=True, padx=10, pady=4)

    canvas     = tk.Canvas(container, width=680, height=420)
    scrollbar  = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
    inner      = tk.Frame(canvas)

    inner.bind(
        "<Configure>",
        lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
    )
    canvas.create_window((0, 0), window=inner, anchor="nw")
    canvas.configure(yscrollcommand=scrollbar.set)
    canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    # Column headers
    hdr_font = ("Segoe UI", 9, "bold")
    tk.Label(inner, text="Include", font=hdr_font, width=7).grid(
        row=0, column=0, padx=4, pady=2)
    tk.Label(inner, text="Competition Name", font=hdr_font, width=36, anchor="w").grid(
        row=0, column=1, padx=4, pady=2, sticky="w")
    tk.Label(inner, text="Date", font=hdr_font, width=18, anchor="w").grid(
        row=0, column=2, padx=4, pady=2, sticky="w")
    tk.Label(inner, text="Weight", font=hdr_font, width=8).grid(
        row=0, column=3, padx=4, pady=2)

    row_vars = []   # list of (comp_dict, BooleanVar, IntVar)

    for i, comp in enumerate(new_comps, start=1):
        chk_var    = tk.BooleanVar(value=True)
        weight_var = tk.IntVar(value=auto_weight(comp["name"]))

        tk.Checkbutton(inner, variable=chk_var).grid(
            row=i, column=0, padx=4, pady=1)
        tk.Label(inner, text=comp["name"], anchor="w",
                 font=("Segoe UI", 9), width=36).grid(
            row=i, column=1, padx=4, pady=1, sticky="w")
        tk.Label(inner, text=comp.get("date_str", ""), anchor="w",
                 font=("Segoe UI", 9), width=18).grid(
            row=i, column=2, padx=4, pady=1, sticky="w")

        weight_spin = tk.Spinbox(
            inner, from_=1, to=4, textvariable=weight_var,
            width=4, font=("Segoe UI", 9),
        )
        weight_spin.grid(row=i, column=3, padx=4, pady=1)

        row_vars.append((comp, chk_var, weight_var))

    # --- Buttons ---
    btn_frame = tk.Frame(root)
    btn_frame.pack(fill=tk.X, padx=10, pady=8)

    def on_select_all():
        for _, chk, _ in row_vars:
            chk.set(True)

    def on_deselect_all():
        for _, chk, _ in row_vars:
            chk.set(False)

    def on_ok():
        for comp, chk, wt in row_vars:
            if chk.get():
                selected.append({**comp, "weight": wt.get()})
        root.destroy()

    def on_cancel():
        root.destroy()

    tk.Button(btn_frame, text="Select All",   command=on_select_all,
              width=12, font=("Segoe UI", 9)).pack(side=tk.LEFT, padx=4)
    tk.Button(btn_frame, text="Deselect All", command=on_deselect_all,
              width=12, font=("Segoe UI", 9)).pack(side=tk.LEFT, padx=4)
    tk.Button(btn_frame, text="Add Selected", command=on_ok,
              width=14, font=("Segoe UI", 9, "bold"),
              bg="#0078d7", fg="white").pack(side=tk.RIGHT, padx=4)
    tk.Button(btn_frame, text="Cancel",       command=on_cancel,
              width=10, font=("Segoe UI", 9)).pack(side=tk.RIGHT, padx=4)

    root.mainloop()
    return selected


# ===========================================================================
# SECTION 4 — Playwright scraper for individual competition pages
# ===========================================================================

def scrape_competition(comp_id: str,
                       playwright_page,
                       year_hint: int = None) -> dict:
    """
    Fetch and parse a single competition page using an already-authenticated
    Playwright page object.

    year_hint : calendar year of the competition (from the competition list),
                used as a fallback when the page h4 contains no date.
    Returns the same structure as parse_competition_page() in the original
    Finchley_Results.py, extended with parsed CB fields per player.
    """
    comp_url = f"{COMP_BASE_URL}?compid={comp_id}"
    playwright_page.goto(comp_url)
    playwright_page.wait_for_load_state("domcontentloaded")
    soup = BeautifulSoup(playwright_page.content(), "html.parser")

    comp = _parse_competition_page(soup, comp_url, year_hint=year_hint)

    # Re-fetch with sort=0 if page shows Gross ordering (not Nett)
    table_el = soup.find("table", class_=lambda c: c and "table-striped" in c)
    if table_el:
        thead = table_el.find("thead")
        if thead:
            hdr        = thead.get_text()
            gross_pos  = hdr.lower().find("gross")
            nett_pos   = hdr.lower().find("nett")
            needs_sort = (
                gross_pos != -1 and (nett_pos == -1 or gross_pos < nett_pos)
            )
            if needs_sort:
                sep      = "&" if "?" in comp_url else "?"
                sort_url = comp_url + sep + "sort=0"
                playwright_page.goto(sort_url)
                playwright_page.wait_for_load_state("domcontentloaded")
                soup = BeautifulSoup(playwright_page.content(), "html.parser")
                comp = _parse_competition_page(soup, sort_url, year_hint=year_hint)

    return comp


def _parse_competition_page(soup: BeautifulSoup, comp_url: str,
                             year_hint: int = None) -> dict:
    """
    Extract structured data from a single competition page.
    Mirrors parse_competition_page() from the original Finchley_Results.py,
    with countback values parsed into CB9/CB6/CB3/CB1.
    """
    result = {
        "name":    "Finchley Golf Club Competition",
        "date":    "",
        "tees":    "",
        "scoring": "Stableford",
        "url":     comp_url,
        "hcap_adj": "100%",
        "players": [],
    }

    # Competition name and date from h3/h4 in div.global
    global_div = soup.find("div", class_="global")
    if global_div:
        h3 = global_div.find("h3")
        if h3:
            result["name"] = h3.get_text(strip=True)

        h4 = global_div.find("h4")
        if h4:
            raw    = re.sub(r"<br\s*/?>", ", ", str(h4), flags=re.IGNORECASE)
            dt_str = BeautifulSoup(raw, "html.parser").get_text(strip=True)
            if ", " in dt_str:
                parts     = dt_str.split(", ", 1)
                date_part = parts[0].strip()
                result["tees"] = re.sub(r",?\s*Finchley Golf Course$", "", parts[1].strip(), flags=re.IGNORECASE)
            else:
                date_part = dt_str.strip()

            # Two-day events: "Saturday 14th June 2025 - Sunday 15th June 2025"
            # Use the later (second) date.
            if " - " in date_part:
                date_part = date_part.split(" - ", 1)[1].strip()

            # Some aggregate competitions omit the date from h4 entirely
            # (h4 contains only tees, e.g. "Red Tees, Finchley Golf Course").
            # Detect this by checking the first token — a real date starts with
            # a day name or a digit; tees start with a colour/word like "Red".
            day_names = ("monday","tuesday","wednesday","thursday","friday","saturday","sunday")
            first_token = date_part.split()[0].lower().rstrip(",") if date_part else ""
            if first_token and first_token not in day_names and not first_token[0].isdigit():
                # date_part is actually tees — move it and look for date in <p> tag
                if not result["tees"]:
                    result["tees"] = re.sub(r",?\s*Finchley Golf Course$", "", date_part, flags=re.IGNORECASE)
                date_part = ""
                # Extract the latest date from the "Aggregate of ..." <p>, e.g.
                # "Aggregate of ... (15th Jun) & ... (17th Jun)"
                for p in global_div.find_all("p"):
                    p_text = p.get_text(strip=True)
                    if not re.match(r"Aggregate of", p_text, re.IGNORECASE):
                        continue
                    # Find all "(DDth Mon)" style dates within this paragraph
                    date_hits = re.findall(r"\((\d{1,2}(?:st|nd|rd|th)\s+\w+)\)", p_text)
                    if date_hits:
                        # Parse each, keep the latest
                        yr = year_hint or datetime.date.today().year
                        latest = None
                        latest_str = ""
                        for ds in date_hits:
                            clean_ds = re.sub(r"(st|nd|rd|th)", "", ds)
                            for fmt in ("%d %b %Y", "%d %B %Y"):
                                try:
                                    d = datetime.datetime.strptime(
                                        f"{clean_ds.strip()} {yr}", fmt
                                    )
                                    if latest is None or d > latest:
                                        latest = d
                                        latest_str = ds
                                    break
                                except ValueError:
                                    continue
                        if latest:
                            day_num   = str(latest.day)
                            suffix    = re.search(r"\d+(st|nd|rd|th)", latest_str).group(1)
                            date_part = latest.strftime("%A ") + day_num + suffix + latest.strftime(" %B %Y")
                        break

            result["date"] = date_part

    # Handicap allowance (e.g. "95%")
    page_text = soup.get_text()
    m = re.search(r"\((\d+)%\s+handicap\s+allowance\)", page_text, re.IGNORECASE)
    if m:
        result["hcap_adj"] = f"{m.group(1)}%"

    # Locate results table — three CSS class patterns in priority order
    is_results_table = False
    two_rounds       = False

    table = soup.find("table", class_=lambda c: c and "global" in c and "table-striped" in c)
    if table is None:
        table = soup.find("table", class_=lambda c: c and "resultstable" in c and "table-striped" in c)
        if table:
            is_results_table = True
            two_rounds       = True
    if table is None:
        table = soup.find("table", class_=lambda c: c and "table-striped" in c)
    if table is None:
        for t in soup.find_all("table"):
            rows = t.find_all("tr")
            if len(rows) > 2:
                hdr = rows[0].get_text().lower()
                if "position" in hdr or "results" in hdr:
                    table = t
                    break

    if table is None:
        return result

    # Scoring type detection
    thead = table.find("thead")
    if thead:
        hdr_text = thead.get_text()
        if re.search(r"nett|gross", hdr_text, re.IGNORECASE):
            forced = any(kw in result["name"].lower() for kw in STABLEFORD_NAMES)
            result["scoring"] = "Stableford" if forced else "Stroke Play"

    # Player rows
    rows      = table.find_all("tr")
    data_rows = [r for r in rows if not r.find("th") and r.parent.name != "thead"]

    player_count = sum(
        1 for r in data_rows
        if r.find_all("td") and "WD" not in r.find_all("td")[0].get_text()
    )
    result["player_count"] = player_count

    for row in data_rows:
        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        # Position
        pos_text = cells[0].get_text(strip=True)
        position = re.sub(r"(st|nd|rd|th|=)", "", pos_text).strip()

        # Skip withdrawn / DQ rows with no numeric position
        if position in ("WD", "DQ", ""):
            continue

        # Name cell — prefer explicit namecol/playername class (two-round comps insert a photo column)
        name_cell = row.find("td", class_="namecol") or row.find("td", class_="playername")
        if name_cell is None:
            name_col = 3 if is_results_table else 1
            if len(cells) <= name_col:
                continue
            name_cell = cells[name_col]

        cell_text = name_cell.get_text(strip=True)

        if "(" in cell_text:
            player_name = cell_text[: cell_text.rfind("(")].strip()
            hcap_raw    = cell_text[cell_text.rfind("(") + 1 :]
            handicap    = hcap_raw.split(")")[0].strip()
        else:
            player_name = cell_text
            handicap    = ""

        # Player ID from href — check name cell first, then td[1]
        player_id = ""
        for search_cell in ([name_cell] + ([cells[1]] if len(cells) > 1 else [])):
            link = search_cell.find("a", href=True)
            if link:
                m = re.search(r"playerid=(\d+)", link["href"])
                if m:
                    player_id = m.group(1)
                    break

        if not player_id:
            two_rounds = True

        # Points column
        if is_results_table:
            points_col = 6
        elif two_rounds:
            points_col = 5
        else:
            points_col = 2

        points    = ""
        countback = ""

        if len(cells) > points_col:
            pts_cell    = cells[points_col]
            link        = pts_cell.find("a") if not is_results_table and not two_rounds else None
            points_text = (link or pts_cell).get_text(strip=True)
            points      = points_text
            title_tag   = link if link else pts_cell
            countback   = title_tag.get("title", "") or ""

            # For resultstable the Total cell has no countback title — use the last round cell (points_col - 1)
            if is_results_table and not countback and points_col >= 1 and len(cells) > points_col - 1:
                prev_cell = cells[points_col - 1]
                prev_link = prev_cell.find("a")
                countback = (prev_link or prev_cell).get("title", "") or ""

        cb9, cb6, cb3, cb1 = _parse_countback(countback)

        result["players"].append({
            "position":   position,
            "name":       player_name,
            "handicap":   handicap,
            "player_id":  player_id,
            "points":     points,
            "countback":  countback,
            "cb9":        cb9,
            "cb6":        cb6,
            "cb3":        cb3,
            "cb1":        cb1,
        })

    return result


def _parse_countback(countback_str: str) -> tuple[int, int, int, int]:
    """
    Parse countback strings in two formats:
      Standard:  "Back 9 - 19, Back 6 - 11, Back 3 - 6, Back 1 - 3"
      Two-round: "Countback - 9:37.0000 6:26.0000 3:14.0000 1:4.6670"
    Returns (cb9, cb6, cb3, cb1) as integers (0 if not found).
    """
    values = {9: 0, 6: 0, 3: 0, 1: 0}

    # Standard format: "Back N - M"
    for m in re.finditer(r"Back\s+(\d+)\s+-\s+(\d+)", countback_str):
        holes = int(m.group(1))
        score = int(m.group(2))
        if holes in values:
            values[holes] = score

    # Two-round format: "N:M.dddd" — only try if standard matched nothing
    if not any(values.values()):
        for m in re.finditer(r"(\d+):([\d.]+)", countback_str):
            holes = int(m.group(1))
            score = int(float(m.group(2)))
            if holes in values:
                values[holes] = score

    return values[9], values[6], values[3], values[1]


# ===========================================================================
# SECTION 5 — RTSF scoring
# ===========================================================================

def rtsf_points(rank: int, total_players: int) -> int:
    """
    Calculate RTSF points for a player based on rank and field size.

    Formula (from VBA RTSFPoints / Macro_Structure doc):
        1st  →  50 + n
        2nd  →  25 + n
        3rd  →  10 + n
        4th  →   5 + n
        5th  →       n
        6th+ →  n - (rank - 5)
    where n = total_players
    """
    n = total_players
    if rank == 1:
        return 50 + n
    elif rank == 2:
        return 25 + n
    elif rank == 3:
        return 10 + n
    elif rank == 4:
        return 5 + n
    elif rank == 5:
        return n
    else:
        return max(0, n - (rank - 5))


# ===========================================================================
# SECTION 6 — Write competition worksheet via xlwings
# ===========================================================================

def write_competition_sheet(RTSF_book: xw.Book,
                             comp: dict,
                             weight: int,
                             players_dict: dict,
                             dir_dict: dict = None) -> xw.Sheet:
    """
    Create (or overwrite) a worksheet for this competition and write a
    formatted table of results.

    Parameters
    ----------
    book        : open xlwings Book
    comp        : parsed competition dict from scrape_competition()
    weight      : RTSF weighting (1–4) as set by user in the UI
    players_dict: {player_id (int): name (str)} from Inputs tab

    Returns the created xlwings Sheet.
    """
    # --- Derive worksheet name (max 31 chars, Excel limit) ---
    comp_date_str = comp.get("date", "")
    try:
        clean = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", comp_date_str)
        comp_dt     = datetime.datetime.strptime(clean.strip(), "%A %d %B %Y")
        date_suffix = comp_dt.strftime("%y%m%d")   # e.g. 250628
    except ValueError:
        date_suffix = re.sub(r"\D", "", comp_date_str)[:6]  # digits only, fallback

    comp_name = comp["name"]

    # Apply abbreviations for names that truncate poorly
    for pattern, replacement in COMP_NAME_ABBREVIATIONS.items():
        if pattern.lower() in comp_name.lower():
            comp_name = replacement
            break

    if re.search(r"\bguests?\b", comp_name, re.IGNORECASE):
        # Split on the first occurrence of Guest/Guests to get the base name,
        # then truncate to 18 chars and strip any trailing separator (" -", ",")
        base = re.split(r"\bguests?\b", comp_name, maxsplit=1, flags=re.IGNORECASE)[0]
        base = re.sub(r"[\s\-,]+$", "", base).strip()[:18]
        wks_name = base + " Guest " + date_suffix
    else:
        wks_name = comp_name[:24].strip() + " " + date_suffix

    wks_name = wks_name[:31]  # hard safety cap

    # Delete existing sheet with same name if present
    if wks_name in [s.name for s in RTSF_book.sheets]:
        RTSF_book.sheets[wks_name].delete()

    # Insert new sheet before Inputs tab
    inputs_sheet = RTSF_book.sheets["Inputs"]
    ws = RTSF_book.sheets.add(name=wks_name, before=inputs_sheet)

    # --- Header block (rows 1–4) — written as two batch range writes ---
    scoring_str = comp.get("scoring", "Stableford")

    ws.range("A1:B4").value = [
        ["Competition:", comp["name"]],
        ["Date:",        comp_date_str],
        ["Scoring:",     scoring_str],
        ["Weight:",      weight],
    ]
    ws.range("D1:E4").value = [
        ["Tees:",               comp.get("tees", "")],
        ["Competitors:",        comp.get("player_count", len(comp["players"]))],
        ["Handicap Allowance:", comp.get("hcap_adj", "100%")],
        ["Source URL:",         comp.get("url", "")],
    ]

    # Bold labels
    ws.range("A1:A4").font.bold = True
    ws.range("D1:D4").font.bold = True
    ws.range("B1").font.bold    = True

    # --- Table headers (row 6) ---
    header_row = 6
    ws.range(f"A{header_row}").value = COMP_TABLE_HEADERS

    # --- Player data rows ---
    players          = comp["players"]
    total_in_field   = comp.get("player_count", len(players))
    data_start_row   = header_row + 1

    # Reverse lookup: name → player_id, for filling blanks in two-round comps
    # where the HTML has no playerid= link.
    # Priority: Inputs player list first, then full member directory.
    name_to_id = {name.strip(): str(pid) for pid, name in players_dict.items()}
    if dir_dict:
        for name, pid in dir_dict.items():
            if name not in name_to_id:
                name_to_id[name] = pid

    # Build 2-D list for efficient single write
    rows_data = []
    for i, p in enumerate(players):
        rank = i + 1
        try:
            pos_int = int(p["position"])
        except (ValueError, TypeError):
            pos_int = rank

        rtsf = rtsf_points(pos_int, total_in_field)

        try:
            hcap = float(p["handicap"])
        except (ValueError, TypeError):
            hcap = p["handicap"]

        try:
            pts = float(p["points"]) if p["points"] not in ("", "DQ", "WD") else p["points"]
        except (ValueError, TypeError):
            pts = p["points"]

        # Fill missing player ID from Inputs player list (two-round comps have no playerid= link)
        player_id = p["player_id"] or name_to_id.get(p["name"].strip(), "")

        rows_data.append([
            pos_int,                                          # Position
            p["name"],                                        # Player Name
            player_id,                                        # Player ID
            hcap,                                             # Playing Handicap
            pts,                                              # Points
            rtsf,                                             # RTSF Points
            p["cb9"],                                         # CB 9
            p["cb6"],                                         # CB 6
            p["cb3"],                                         # CB 3
            p["cb1"],                                         # CB 1
            re.sub(r'\s+', ' ', p["countback"]).strip(),     # Countback (raw string)
        ])

    if rows_data:
        RTSF_book.app.screen_updating = False
        try:
            ws.range(f"A{data_start_row}").value = rows_data
        finally:
            RTSF_book.app.screen_updating = True

    # --- Format as Excel table ---
    last_data_row = data_start_row + len(rows_data) - 1
    if last_data_row >= data_start_row:
        tbl_range = ws.range(
            f"A{header_row}:K{last_data_row}"
        )
        table_name = re.sub(r"[^A-Za-z0-9_]", "_", wks_name)[:40]
        try:
            ws.tables.add(
                source=tbl_range,
                name=table_name,
                table_style_name="TableStyleMedium2",
                has_headers=True,
            )
        except Exception as e:
            print(f"  Note: could not create Excel table ({e}); data written without table style.")

    # --- Column widths ---
    widths = {
        "A": 15,  # Position
        "B": 20,  # Player Name
        "C": 10,  # Player ID
        "D": 18,  # Playing Handicap
        "E": 8,   # Points
        "F": 14,  # RTSF Points
        "G": 8,   # CB 9
        "H": 8,   # CB 6
        "I": 8,   # CB 3
        "J": 8,   # CB 1
        "K": 75 if scoring_str == "Stroke Play" else 60,  # Countback string
    }
    for col, width in widths.items():
        ws.range(f"{col}1").column_width = width

    # --- Autofit row heights and align all cells to top ---
    ws.autofit("rows")
    ws.used_range.api.VerticalAlignment = -4160  # xlTop

    # --- Turn off gridlines ---
    ws.activate()
    RTSF_book.app.api.ActiveWindow.DisplayGridlines = False

    print(f"  Written sheet: '{wks_name}' ({len(rows_data)} players)")
    return ws


# ===========================================================================
# SECTION 7 — Update TournamentList on Inputs tab
# ===========================================================================

def setup_tournament_list_table(RTSF_book: xw.Book):
    """
    Convert the TournamentList range on the Inputs tab into a named Excel
    Table called 'Tournament_List', if it does not already exist.
    Safe to call on every run — skips silently if the table is present.
    """
    ws = RTSF_book.sheets["Inputs"]

    # Already a table — nothing to do
    if any(t.name == "Tournament_List" for t in ws.tables):
        return

    tl_anchor = RTSF_book.names["TournamentList"].refers_to_range  # header cell (A4)

    # Find the last occupied row in the list
    r = 0
    while tl_anchor.offset(r, 0).value is not None:
        r += 1
    # r is now the number of rows including the header; minimum 1 (header only)
    last_row_offset = max(r - 1, 0)

    tbl_range = ws.range(
        tl_anchor,
        tl_anchor.offset(last_row_offset, 4)   # 5 columns: A–E
    )
    ws.tables.add(
        source=tbl_range,
        name="Tournament_List",
        table_style_name="TableStyleMedium2",
        has_headers=True,
    )
    RTSF_book.save()
    print("  Created Excel Table 'Tournament_List' on Inputs tab.")


def update_tournament_list(RTSF_book: xw.Book,
                            comp: dict,
                            weight: int,
                            wks_name: str):
    """
    Append a new row to the Tournament_List Excel Table on the Inputs tab,
    then remove any duplicate rows (matching on name + date).
    Columns: Included Tournaments | Date | Tees | Weighting | Merge
    """
    ws        = RTSF_book.sheets["Inputs"]
    tl_anchor = RTSF_book.names["TournamentList"].refers_to_range  # A4 header

    comp_date_str = comp.get("date", "")
    try:
        clean    = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", comp_date_str)
        comp_dt  = datetime.datetime.strptime(clean.strip(), "%A %d %B %Y")
        date_val = comp_dt.date()
    except ValueError:
        date_val = comp_date_str

    # Append at first empty row below the header
    r = 1
    while tl_anchor.offset(r, 0).value is not None:
        r += 1

    RTSF_book.app.screen_updating = False
    try:
        tl_anchor.offset(r, 0).value = [[wks_name, date_val, comp.get("tees", ""), weight, False]]
        tl_anchor.offset(r, 1).number_format = "dd/mm/yyyy"
    finally:
        RTSF_book.app.screen_updating = True

    # Remove duplicates on columns 1 (name) and 2 (date) using Excel's built-in
    tbl = next((t for t in ws.tables if t.name == "Tournament_List"), None)
    if tbl is not None:
        tbl.range.api.RemoveDuplicates(Columns=(1, 2), Header=1)  # Header=xlYes

        # Sort in Python: read all data rows, sort by (date, name), write back
        tbl_anchor = RTSF_book.names["TournamentList"].refers_to_range  # header row
        rows = []
        r = 1
        while tbl_anchor.offset(r, 0).value is not None:
            row_vals = [tbl_anchor.offset(r, c).value for c in range(5)]
            rows.append(row_vals)
            r += 1

        if rows:
            def sort_key(row):
                date_val = row[1]
                if isinstance(date_val, datetime.datetime):
                    date_val = date_val.date()
                return (date_val or datetime.date.min, str(row[0] or ""))

            rows.sort(key=sort_key)

            RTSF_book.app.screen_updating = False
            try:
                # Clear existing data rows then rewrite
                ws.range(
                    tbl_anchor.offset(1, 0),
                    tbl_anchor.offset(len(rows), 4)
                ).value = rows
            finally:
                RTSF_book.app.screen_updating = True

    print(f"  Updated TournamentList: '{wks_name}' (weight={weight})")


# ===========================================================================
# SECTION 8 — Playwright login (for scraping individual comp pages)
# ===========================================================================

def playwright_login(page) -> bool:
    """
    Navigate to the login page, fill credentials, and wait for successful
    redirect.  Returns True on success.
    The user may need to solve a CAPTCHA manually.
    """
    page.goto(LOGIN_URL)
    page.wait_for_selector("#memberid", timeout=30_000)
    page.fill("#memberid", MEMBER_ID)
    page.fill("#pin", PIN)

    print("Credentials filled. Solve any CAPTCHA then click Login.")
    print("Waiting up to 2 minutes for successful login...")

    page.wait_for_url(
        lambda url: "login.php" not in url,
        timeout=120_000,
    )
    print(f"Login successful. URL: {page.url}")

    # Minimise browser — it must stay open for scraping but doesn't need to be visible
    try:
        page.evaluate("window.resizeTo(800, 600); window.moveTo(window.screen.width - 820, window.screen.height - 80);")
    except Exception:
        pass  # Non-fatal — browser stays where it is

    return True


# ===========================================================================
# SECTION 9 — Main orchestration
# ===========================================================================

def main():
    print("=" * 60)
    print("Finchley Golf Club — RTSF Results Importer")
    print("=" * 60)

    # 1. Open workbook
    RTSF_book = open_workbook()

    # 2. Ensure TournamentList is an Excel-defined Table
    setup_tournament_list_table(RTSF_book)

    # 3. Read Inputs
    inputs = read_inputs(RTSF_book)
    print(f"Season: {inputs['season_start']} → {inputs['season_end']}")
    print(f"Players loaded: {len(inputs['players'])}")
    print(f"Existing competitions: {len(inputs['existing_comps'])}")

    # 3. Playwright login first — needed to bypass Cloudflare for all requests
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page    = browser.new_page()
        Stealth().apply_stealth_sync(page)

        try:
            playwright_login(page)
        except Exception as exc:
            messagebox.showerror("Login Error", str(exc))
            browser.close()
            return

        # 4. Fill in any blank player IDs from the member directory
        print("\nChecking player IDs...")
        _, dir_dict = update_player_ids(RTSF_book, page)

        # Re-read Inputs so players dict reflects any newly filled IDs
        inputs = read_inputs(RTSF_book)
        print(f"Players loaded: {len(inputs['players'])}")

        # 5. Fetch competition list using the authenticated Playwright page
        print("\nFetching competition list...")
        try:
            competitions = fetch_competition_list(
                page,
                inputs["season_start"],
                inputs["season_end"],
            )
        except RuntimeError as exc:
            messagebox.showerror("Competition List Error", str(exc))
            browser.close()
            return

        if not competitions:
            messagebox.showinfo("No competitions found",
                                "No competitions were found for the season date range.")
            browser.close()
            return

        # 5. Show selection UI
        selected = show_competition_selector(competitions, inputs["existing_comps"])

        if not selected:
            print("No competitions selected. Exiting.")
            browser.close()
            return

        print(f"\n{len(selected)} competition(s) selected.")

        # 6. Scrape each selected competition with the same Playwright page
        for comp_meta in selected:
            print(f"\nProcessing: {comp_meta['name']} ({comp_meta['date_str']})")
            try:
                comp = scrape_competition(comp_meta["id"], page,
                                          year_hint=inputs["season_start"].year)
            except Exception as exc:
                print(f"  ERROR scraping comp {comp_meta['id']}: {exc}")
                continue

            weight   = comp_meta["weight"]
            wks_name = write_competition_sheet(
                RTSF_book, comp, weight, inputs["players"], dir_dict
            ).name

            update_tournament_list(RTSF_book, comp, weight, wks_name)

            # Save after each competition so progress is not lost
            RTSF_book.save()
            print(f"  Saved workbook.")

        browser.close()

    print("\nAll done. Workbook saved.")
    messagebox.showinfo("Complete",
                        f"{len(selected)} competition(s) added to {WORKBOOK_NAME}.")


def _build_wks_name(comp_name: str, comp_date_str: str) -> str:
    """
    Shared name-building logic used by both write_competition_sheet and
    rename_competition_sheets.
    """
    try:
        clean = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", comp_date_str)
        comp_dt     = datetime.datetime.strptime(clean.strip(), "%A %d %B %Y")
        date_suffix = comp_dt.strftime("%y%m%d")
    except ValueError:
        date_suffix = re.sub(r"\D", "", comp_date_str)[:6]

    # Merged competitions: "(Merged)" suffix → "Merge" label in sheet name
    is_merged = bool(re.search(r"\(Merged\)", comp_name, re.IGNORECASE))
    if is_merged:
        comp_name = re.sub(r"\s*\(Merged\)", "", comp_name, flags=re.IGNORECASE).strip()

    for pattern, replacement in COMP_NAME_ABBREVIATIONS.items():
        if pattern.lower() in comp_name.lower():
            comp_name = replacement
            break

    if is_merged:
        prefix   = comp_name[:18].strip()
        wks_name = prefix + " Merge " + date_suffix
    elif re.search(r"\bguests?\b", comp_name, re.IGNORECASE):
        base = re.split(r"\bguests?\b", comp_name, maxsplit=1, flags=re.IGNORECASE)[0]
        base = re.sub(r"[\s\-,]+$", "", base).strip()[:18]
        wks_name = base + " Guest " + date_suffix
    else:
        wks_name = comp_name[:24].strip() + " " + date_suffix

    return wks_name[:31].strip()


def rename_competition_sheets(RTSF_book: xw.Book):
    """
    Rename all competition worksheets (every sheet except 'Inputs') using the
    competition name from B1 and the date from B2, applying the same
    abbreviation and formatting logic as write_competition_sheet.

    Also updates the matching row in Tournament_List (col A) to keep them in sync.
    Run with:  python Finchley_Results.py --rename [workbook_path]
    """
    skip = {"Inputs", "HTML_Debug", "Tournament Scores"}
    tl_anchor = RTSF_book.names["TournamentList"].refers_to_range

    # Read all TL rows into a list for flexible searching
    # Each entry: (row_offset, name, date)
    tl_rows = []
    r = 1
    while tl_anchor.offset(r, 0).value is not None:
        tl_name = str(tl_anchor.offset(r, 0).value).strip()
        tl_date = tl_anchor.offset(r, 1).value
        if isinstance(tl_date, datetime.datetime):
            tl_date = tl_date.date()
        tl_rows.append((r, tl_name, tl_date))
        r += 1

    def find_tl_row(old_name, new_name, comp_date, comp_name):
        """Find the TL row offset for a competition sheet, trying multiple strategies."""
        def is_guest(s):
            return bool(re.search(r"\bguests?\b", str(s), re.IGNORECASE))

        new_is_guest = is_guest(new_name)

        # 1. Exact match on old or new sheet name
        for r, tl_name, tl_date in tl_rows:
            if tl_name == old_name or tl_name == new_name:
                return r
        if not comp_date:
            return None
        # 2. Same date + guest status matches + name prefix overlap
        comp_lower = str(comp_name).lower()
        new_lower  = new_name.lower()
        for r, tl_name, tl_date in tl_rows:
            if tl_date != comp_date:
                continue
            if is_guest(tl_name) != new_is_guest:
                continue
            tl_lower = tl_name.lower()
            if (comp_lower.startswith(tl_lower[:15]) or tl_lower.startswith(comp_lower[:15])
                    or new_lower.startswith(tl_lower[:15]) or tl_lower.startswith(new_lower[:15])):
                return r
        return None

    renamed = 0
    for ws in RTSF_book.sheets:
        if ws.name in skip:
            continue

        if ws.range("A1").value != "Competition:" or ws.range("A2").value != "Date:":
            print(f"  Skipping '{ws.name}' — not a competition worksheet.")
            continue

        comp_name     = ws.range("B1").value
        comp_date_val = ws.range("B2").value

        if not comp_name:
            print(f"  Skipping '{ws.name}' — B1 is empty.")
            continue


        if isinstance(comp_date_val, datetime.datetime):
            comp_date_str = comp_date_val.strftime("%A %d %B %Y")
            comp_date     = comp_date_val.date()
        else:
            comp_date_str = str(comp_date_val) if comp_date_val else ""
            comp_date     = None
            # B2 is written as a text string — try to parse it
            if comp_date_str:
                try:
                    clean     = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", comp_date_str)
                    comp_date = datetime.datetime.strptime(clean.strip(), "%A %d %B %Y").date()
                except ValueError:
                    pass

        new_name = _build_wks_name(str(comp_name), comp_date_str)

        old_name = ws.name
        if new_name != old_name:
            ws.name = new_name
            print(f"  Renamed: '{old_name}' → '{new_name}'")
            renamed += 1
        else:
            print(f" Worksheet name OK: '{old_name}'")

        # Update Tournament_List
        tl_row = find_tl_row(old_name, new_name, comp_date, comp_name)
        if tl_row is not None:
            tl_anchor.offset(tl_row, 0).value = new_name
            # Update tl_rows so a later sheet on the same date doesn't re-match this row
            tl_rows[tl_row - 1] = (tl_row, new_name, comp_date)

    # ── Add TL entries for competition sheets not yet in Tournament_List ──────
    # Collect all names currently in TL (after the rename pass above)
    current_tl_names: set[str] = set()
    r = 1
    while tl_anchor.offset(r, 0).value is not None:
        current_tl_names.add(str(tl_anchor.offset(r, 0).value).strip())
        r += 1

    added = 0
    for ws in RTSF_book.sheets:
        if ws.name in skip:
            continue
        if ws.range("A1").value != "Competition:" or ws.range("A2").value != "Date:":
            continue
        if ws.name in current_tl_names:
            continue

        # Competition sheet has no TL row — read its header block and add one
        sheet_name    = ws.name
        date_raw      = ws.range("B2").value
        if isinstance(date_raw, datetime.datetime):
            date_val = date_raw.date()
        elif isinstance(date_raw, datetime.date):
            date_val = date_raw
        else:
            # Stored as text — try to parse
            try:
                clean    = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", str(date_raw or ""))
                date_val = datetime.datetime.strptime(clean.strip(), "%A %d %B %Y").date()
            except ValueError:
                date_val = None

        tees_val   = ws.range("E1").value or ""
        weight_raw = ws.range("B4").value
        try:
            weight_int = int(weight_raw)
        except (TypeError, ValueError):
            weight_int = auto_weight(str(ws.range("B1").value or ""))

        # Append at first empty row in TL
        r = 1
        while tl_anchor.offset(r, 0).value is not None:
            r += 1
        tl_anchor.offset(r, 0).value = [[sheet_name, date_val, tees_val, weight_int, False]]
        if date_val:
            tl_anchor.offset(r, 1).number_format = "dd/mm/yyyy"
        current_tl_names.add(sheet_name)
        added += 1
        print(f"  Added missing TL entry: '{sheet_name}' (weight={weight_int})")

    if added:
        # Re-sort TL after inserting new entries (reuses the same sort logic as
        # update_tournament_list)
        inp_ws = RTSF_book.sheets["Inputs"]
        tbl    = next((t for t in inp_ws.tables if t.name == "Tournament_List"), None)
        if tbl is not None:
            tbl.range.api.RemoveDuplicates(Columns=(1, 2), Header=1)

        rows = []
        r = 1
        while tl_anchor.offset(r, 0).value is not None:
            rows.append([tl_anchor.offset(r, c).value for c in range(5)])
            r += 1

        def _tl_sort_key(row):
            dv = row[1]
            if isinstance(dv, datetime.datetime):
                dv = dv.date()
            return (dv or datetime.date.min, str(row[0] or ""))

        rows.sort(key=_tl_sort_key)
        inp_ws.range(
            tl_anchor.offset(1, 0),
            tl_anchor.offset(len(rows), 4)
        ).value = rows

    # Remove TL rows whose sheet no longer exists (stale entries from merges etc.)
    # Read all rows, filter out stale ones, then rewrite — avoids EntireRow.Delete()
    # failures that occur when deleting rows inside an Excel-defined Table.
    current_sheets = {s.name for s in RTSF_book.sheets}
    tl_data: list[list] = []
    r = 1
    old_tl_count = 0
    while tl_anchor.offset(r, 0).value is not None:
        sheet_name = str(tl_anchor.offset(r, 0).value).strip()
        row_vals   = [tl_anchor.offset(r, c).value for c in range(5)]
        old_tl_count += 1
        if sheet_name in current_sheets:
            tl_data.append(row_vals)
        else:
            print(f"  Removing stale TL entry: '{sheet_name}'")
        r += 1

    inp_ws = RTSF_book.sheets["Inputs"]
    if tl_data:
        inp_ws.range(
            tl_anchor.offset(1, 0), tl_anchor.offset(len(tl_data), 4)
        ).value = tl_data
    # Delete excess table rows left over from removed stale entries.
    # Must use ListRows.Delete() — clear_contents() blanks cells but leaves
    # the table rows in place, resulting in blank rows inside the table.
    # Delete bottom-up so row indices stay valid as each deletion shifts rows up.
    if old_tl_count > len(tl_data):
        tl_obj = tl_anchor.offset(1, 0).api.ListObject
        for offset in range(old_tl_count, len(tl_data), -1):
            row_idx = tl_anchor.offset(offset, 0).api.Row - tl_obj.DataBodyRange.Row + 1
            tl_obj.ListRows(row_idx).Delete()

    # Add/update hyperlinks from Tournament_List col A to each competition sheet
    r = 1
    while tl_anchor.offset(r, 0).value is not None:
        sheet_name = str(tl_anchor.offset(r, 0).value).strip()
        if sheet_name in [s.name for s in RTSF_book.sheets]:
            cell = tl_anchor.offset(r, 0)
            cell.api.Hyperlinks.Add(
                Anchor=cell.api,
                Address="",
                SubAddress=f"'{sheet_name.replace(chr(39), chr(39)*2)}'!A1",
                TextToDisplay=sheet_name,
            )
        r += 1

    RTSF_book.save()
    print(f"\nDone. {renamed} sheet(s) renamed, {added} TL entry/entries added, hyperlinks updated.")


# ===========================================================================
# SECTION 11 — Merge competitions
# ===========================================================================

def _read_sheet_players(ws: xw.Sheet) -> list[dict]:
    """Read all data rows from the first Excel table on a competition sheet."""
    if not ws.tables:
        return []
    tbl = ws.tables[0]
    if tbl.data_body_range is None:
        return []
    data = tbl.data_body_range.value
    if not data:
        return []
    if not isinstance(data[0], list):
        data = [data]
    return [
        {
            "position":  row[0],
            "name":      row[1],
            "player_id": row[2],
            "handicap":  row[3],
            "points":    row[4],
            "rtsf":      row[5],
            "cb9":       row[6]  or 0,
            "cb6":       row[7]  or 0,
            "cb3":       row[8]  or 0,
            "cb1":       row[9]  or 0,
            "countback": row[10] or "",
        }
        for row in data
    ]


def _merge_sort_key(p: dict, stroke_play: bool):
    """
    Sort key for merged player list.
    Stableford : descending points, then descending CB (higher = better)
    Stroke Play : ascending points, then ascending CB (lower = better)
    """
    try:
        pts = float(p["points"]) if p["points"] not in (None, "", "WD", "DQ") else (
            9999 if stroke_play else -9999
        )
    except (TypeError, ValueError):
        pts = 9999 if stroke_play else -9999

    cb9 = float(p["cb9"] or 0)
    cb6 = float(p["cb6"] or 0)
    cb3 = float(p["cb3"] or 0)
    cb1 = float(p["cb1"] or 0)

    if stroke_play:
        # Lower score better → ascending; lower CB better → ascending
        return (pts, cb9, cb6, cb3, cb1)
    else:
        # Higher points better → negate for ascending sort; higher CB better → negate
        return (-pts, -cb9, -cb6, -cb3, -cb1)




def _merge_pair(RTSF_book: xw.Book, e1: dict, e2: dict, tl_anchor):
    """Merge two competition worksheets and update the TournamentList."""
    sheet_names = [s.name for s in RTSF_book.sheets]
    for e in (e1, e2):
        if e["name"] not in sheet_names:
            print(f"  Sheet '{e['name']}' not found — skipping merge.")
            return

    ws1 = RTSF_book.sheets[e1["name"]]
    ws2 = RTSF_book.sheets[e2["name"]]

    # Base = higher weight (or e1 on tie).
    # Read weight directly from each sheet's B4 cell — more reliable than the
    # TournamentList entry, which may be stale after a partial/failed run.
    # Fall back to the TL value if B4 is missing or non-numeric.
    def _sheet_weight(ws: xw.Sheet, tl_weight) -> int:
        try:
            return int(ws.range("B4").value)
        except (TypeError, ValueError):
            return int(tl_weight or 1)

    w1, w2 = _sheet_weight(ws1, e1["weight"]), _sheet_weight(ws2, e2["weight"])
    if w1 >= w2:
        base_e, base_ws, sec_e, sec_ws = e1, ws1, e2, ws2
    else:
        base_e, base_ws, sec_e, sec_ws = e2, ws2, e1, ws1

    # Metadata from base sheet — but comp_name always from the host (non-Guest) sheet
    host_ws   = sec_ws if re.search(r"\bguests?\b", str(base_ws.range("B1").value or ""), re.IGNORECASE) else base_ws
    comp_name = re.sub(r"\s*-?\s*\bguests?\b.*", "", str(host_ws.range("B1").value or base_e["name"]), flags=re.IGNORECASE).strip()
    comp_date_str = base_ws.range("B2").value
    scoring       = str(base_ws.range("B3").value or "Stableford")
    weight        = max(w1, w2)
    tees          = base_ws.range("E1").value or base_e["tees"] or ""
    hcap_adj      = base_ws.range("E3").value or "100%"

    if isinstance(comp_date_str, datetime.datetime):
        comp_date_str = comp_date_str.strftime("%A %d %B %Y")
    else:
        comp_date_str = str(comp_date_str) if comp_date_str else ""

    wks_name   = _build_wks_name(comp_name + " (Merged)", comp_date_str)
    stroke_play = "stroke" in scoring.lower()

    # Combine and sort players
    players = _read_sheet_players(base_ws) + _read_sheet_players(sec_ws)
    players.sort(key=lambda p: _merge_sort_key(p, stroke_play))

    # Recalculate positions and RTSF points
    total = len(players)
    for i, p in enumerate(players):
        p["position"] = i + 1
        p["rtsf"]     = rtsf_points(i + 1, total)

    # Create merged worksheet.
    # Capture source names before any deletion — base_ws or sec_ws may share
    # wks_name if a previous partial run left a half-built merged sheet behind,
    # in which case the delete-existing step would invalidate the object reference.
    base_name = base_ws.name
    sec_name  = sec_ws.name
    if wks_name in sheet_names:
        RTSF_book.sheets[wks_name].delete()
    merge_ws = RTSF_book.sheets.add(name=wks_name, before=RTSF_book.sheets["Inputs"])

    # Header block
    merge_ws.range("A1:B4").value = [
        ["Competition:", comp_name + " (Merged)"],
        ["Date:",        comp_date_str],
        ["Scoring:",     scoring],
        ["Weight:",      weight],
    ]
    merge_ws.range("D1:E4").value = [
        ["Tees:",               tees],
        ["Competitors:",        total],
        ["Handicap Allowance:", hcap_adj],
        ["Source URL:",         ""],
    ]
    merge_ws.range("A1:A4").font.bold = True
    merge_ws.range("D1:D4").font.bold = True
    merge_ws.range("B1").font.bold    = True

    # Table headers and data
    header_row     = 6
    data_start_row = header_row + 1
    merge_ws.range(f"A{header_row}").value = COMP_TABLE_HEADERS

    rows_data = []
    for p in players:
        try:
            hcap = float(p["handicap"])
        except (TypeError, ValueError):
            hcap = p["handicap"]
        try:
            pts = float(p["points"]) if p["points"] not in (None, "", "WD", "DQ") else p["points"]
        except (TypeError, ValueError):
            pts = p["points"]
        rows_data.append([
            p["position"], p["name"], p["player_id"], hcap, pts, p["rtsf"],
            p["cb9"], p["cb6"], p["cb3"], p["cb1"],
            re.sub(r"\s+", " ", str(p["countback"])).strip(),
        ])

    last_data_row = data_start_row + len(rows_data) - 1
    RTSF_book.app.screen_updating = False
    try:
        if rows_data:
            merge_ws.range(f"A{data_start_row}").value = rows_data
    finally:
        RTSF_book.app.screen_updating = True

    # Excel table
    if last_data_row >= data_start_row:
        tbl_range  = merge_ws.range(f"A{header_row}:K{last_data_row}")
        table_name = re.sub(r"[^A-Za-z0-9_]", "_", wks_name)[:40]
        try:
            merge_ws.tables.add(
                source=tbl_range, name=table_name,
                table_style_name="TableStyleMedium2", has_headers=True,
            )
        except Exception as ex:
            print(f"  Note: could not create Excel table ({ex})")

    # Column widths and formatting
    widths = {"A":15,"B":20,"C":10,"D":18,"E":8,"F":14,"G":8,"H":8,"I":8,"J":8,
              "K": 75 if stroke_play else 60}
    for col, width in widths.items():
        merge_ws.range(f"{col}1").column_width = width
    merge_ws.autofit("rows")
    merge_ws.used_range.api.VerticalAlignment = -4160  # xlTop

    # Update TournamentList — replace base row with merged name, delete sec row.
    # TournamentList is an Excel Table so rows must be deleted via ListRows,
    # not EntireRow.Delete() (which Excel rejects for table-interior rows).
    def _delete_tl_row(offset: int):
        c       = tl_anchor.offset(offset, 0)
        tl_obj  = c.api.ListObject
        row_idx = c.api.Row - tl_obj.DataBodyRange.Row + 1
        tl_obj.ListRows(row_idx).Delete()

    # Remove any stale TL rows already named wks_name (left over from a prior
    # partial or failed merge run) before writing the new entry.  Scan bottom-up
    # so deletions don't shift the indices of rows still to be checked.
    stale_offsets = []
    r = 1
    while tl_anchor.offset(r, 0).value is not None:
        if str(tl_anchor.offset(r, 0).value).strip() == wks_name:
            stale_offsets.append(r)
        r += 1
    for stale_r in reversed(stale_offsets):
        _delete_tl_row(stale_r)
        # Adjust base_r and sec_r for any rows that shifted up
        if stale_r < base_e["row"]:
            base_e = dict(base_e, row=base_e["row"] - 1)
        if stale_r < sec_e["row"]:
            sec_e = dict(sec_e, row=sec_e["row"] - 1)

    base_r, sec_r = base_e["row"], sec_e["row"]
    if sec_r < base_r:
        _delete_tl_row(sec_r)
        base_r -= 1  # base shifted up by one after deletion

    tl_anchor.offset(base_r, 0).value = wks_name
    tl_anchor.offset(base_r, 3).value = weight
    tl_anchor.offset(base_r, 4).value = False   # clear Merge flag

    # Add hyperlink to the merged sheet name in col A
    cell = tl_anchor.offset(base_r, 0)
    cell.api.Hyperlinks.Add(
        Anchor=cell.api,
        Address="",
        SubAddress=f"'{wks_name}'!A1",
        TextToDisplay=wks_name,
    )

    if sec_r > base_r:
        _delete_tl_row(sec_r)

    # Delete source worksheets.  Use saved names rather than the original object
    # references — if a prior partial run left a sheet whose name matched wks_name,
    # the delete-existing step above will have already removed it, invalidating the
    # xlwings object.  Checking by name avoids the resulting OLE error.
    RTSF_book.app.display_alerts = False
    live = {ws.name for ws in RTSF_book.sheets}
    if base_name in live and base_name != wks_name:
        RTSF_book.sheets[base_name].delete()
    if sec_name in live and sec_name != wks_name:
        RTSF_book.sheets[sec_name].delete()
    RTSF_book.app.display_alerts = True

    print(f"  Merged '{e1['name']}' + '{e2['name']}' → '{wks_name}' ({total} players)")


def merge_competitions(RTSF_book: xw.Book):
    """
    Scan Tournament_List for pairs of entries where Merge=True and dates match.
    For each pair, merge the player lists, sort, recalculate RTSF points,
    write a new worksheet, update Tournament_List, and delete the source sheets.

    Run with:  python Finchley_Results.py --merge
    """
    from collections import defaultdict

    tl_anchor = RTSF_book.names["TournamentList"].refers_to_range

    # Read all TL entries
    tl_entries = []
    r = 1
    while tl_anchor.offset(r, 0).value is not None:
        name   = str(tl_anchor.offset(r, 0).value).strip()
        date   = tl_anchor.offset(r, 1).value
        tees   = tl_anchor.offset(r, 2).value
        weight = tl_anchor.offset(r, 3).value
        merge  = tl_anchor.offset(r, 4).value
        if isinstance(date, datetime.datetime):
            date = date.date()
        tl_entries.append({
            "row": r, "name": name, "date": date,
            "tees": tees, "weight": weight, "merge": bool(merge),
        })
        r += 1

    # Group Merge=True entries by date
    by_date = defaultdict(list)
    for entry in tl_entries:
        if entry["merge"]:
            by_date[entry["date"]].append(entry)

    pairs = []
    for date, entries in by_date.items():
        if len(entries) < 2:
            print(f"  Warning: only one Merge=True entry for {date} — skipping.")
            continue
        if len(entries) > 2:
            print(f"  Warning: {len(entries)} Merge=True entries for {date} — taking first two.")
        pairs.append((entries[0], entries[1]))
        print(f"  Found merge pair for {date}: '{entries[0]['name']}' + '{entries[1]['name']}'")
        
        
    if not pairs:
        print("  No merge pairs found. Set Merge=True for two same-date competitions.")
        return

    for e1, e2 in pairs:
        _merge_pair(RTSF_book, e1, e2, tl_anchor)

    RTSF_book.save()
    print(f"\nMerge complete — {len(pairs)} pair(s) processed.")


# ===========================================================================
# SECTION 10 — RTSF Score calculation
# ===========================================================================

def _read_player_alpha_list(RTSF_book: xw.Book) -> list[dict]:
    """
    Read the Player_Alpha_List table from the Inputs tab and return a list of
    player dicts.  Gender is not stored on the Inputs tab; it is preserved from
    whatever is currently in column C of the 'Tournament Scores' sheet so that a
    full rewrite does not lose manually entered gender values.

    Returns list of dicts:
        name        : str
        id          : int | None
        date_joined : datetime.date | None  — None means no joining restriction
        gender      : str                  — "Male", "Female", or ""
    """
    wks = RTSF_book.sheets["Inputs"]

    # Preserve existing gender values from Tournament Scores (col C, rows 5+)
    gender_by_id: dict[int, str] = {}
    try:
        ts_ws = RTSF_book.sheets["Tournament Scores"]
        r = 5  # first player row (1-based)
        while True:
            pid_val    = ts_ws.range((r, 2)).value   # col B = Player ID
            gender_val = ts_ws.range((r, 3)).value   # col C = Gender
            if pid_val is None:
                break
            try:
                gender_by_id[int(pid_val)] = str(gender_val).strip() if gender_val else ""
            except (ValueError, TypeError):
                pass
            r += 1
    except Exception:
        pass  # sheet may not exist yet on first run

    # Read Player_Alpha_List: col M = Name, col N = ID, col O = Date Joined
    player_start = wks.range("M5")
    players: list[dict] = []
    row = 0
    while True:
        name = player_start.offset(row, 0).value
        if name is None:
            break
        pid_raw        = player_start.offset(row, 1).value
        joined_raw     = player_start.offset(row, 2).value   # col O

        pid_int: int | None = None
        if pid_raw is not None:
            try:
                pid_int = int(pid_raw)
            except (ValueError, TypeError):
                pass

        date_joined: datetime.date | None = None
        if isinstance(joined_raw, datetime.datetime):
            date_joined = joined_raw.date()
        elif joined_raw:
            try:
                date_joined = datetime.datetime.strptime(str(joined_raw), "%Y-%m-%d").date()
            except ValueError:
                pass

        players.append({
            "name":        str(name).strip(),
            "id":          pid_int,
            "date_joined": date_joined,
            "gender":      gender_by_id.get(pid_int, "") if pid_int else "",
        })
        row += 1

    return players


def _read_tournament_list_for_scoring(RTSF_book: xw.Book) -> list[dict]:
    """
    Read all rows from the Tournament_List table on the Inputs tab that have a
    corresponding worksheet in the workbook.

    Returns list of dicts (one per competition):
        name   : str             — worksheet name (= Tournament_List col A value)
        date   : datetime.date | None
        weight : int             — 1, 2, or 3
    """
    tl_anchor  = RTSF_book.names["TournamentList"].refers_to_range  # A4 header
    sheet_names = {ws.name for ws in RTSF_book.sheets}

    comps: list[dict] = []
    r = 1
    while True:
        name_val = tl_anchor.offset(r, 0).value
        if name_val is None:
            break
        name = str(name_val).strip()
        if name in sheet_names:
            date_val = tl_anchor.offset(r, 1).value
            if isinstance(date_val, datetime.datetime):
                date_val = date_val.date()
            weight_raw = tl_anchor.offset(r, 3).value
            try:
                weight = int(weight_raw)
            except (TypeError, ValueError):
                weight = 1
            comps.append({"name": name, "date": date_val, "weight": weight})
        r += 1

    return comps


def _refresh_ts_players(ts_ws: xw.Sheet, players: list[dict]):
    """
    Overwrite rows 5+ of columns A–C in 'Tournament Scores' with the current
    player list (Name, ID, Gender).  Any rows below the new list that held old
    data are cleared.
    """
    # How many player rows currently exist?
    old_count = 0
    while ts_ws.range((5 + old_count, 1)).value is not None:
        old_count += 1

    new_rows = [[p["name"], p["id"], p["gender"]] for p in players]
    n = len(new_rows)

    if new_rows:
        ts_ws.range((5, 1), (4 + n, 3)).value = new_rows

    # Clear leftover rows from a shorter previous player list
    if old_count > n:
        ts_ws.range((5 + n, 1), (4 + old_count, 3)).clear_contents()

    print(f"  Tournament Scores: refreshed {n} player rows.")


def _sync_ts_columns(tscores_wks: xw.Sheet, comps: list[dict]) -> dict:
    """
    Rebuild the competition columns in 'Tournament Scores' from column E
    onwards, ordered newest-first (T1 = most recent competition).

    After the competition columns, two fixed columns are written:
        Knockouts  (category label, weight 1, no date, header "KO")
        Trophies   (category label, weight 1, no date, header "TR")

    Any columns beyond this new layout are cleared (handles shrinking comp list).

    Returns a col_map dict:
        comp_cols : {comp_name: col_index (1-based)}
        ko_col    : int   — 1-based column index for Knockouts
        tr_col    : int   — 1-based column index for Trophies
    """
    # Sort newest-first so T1 is the most recent competition
    sorted_comps = sorted(
        comps,
        key=lambda c: c["date"] or datetime.date.min,
        reverse=True,
    )

    START_COL = 5  # column E

    comp_cols: dict[str, int] = {}
    for i, comp in enumerate(sorted_comps):
        col = START_COL + i
        comp_cols[comp["name"]] = col

        tscores_wks.range((1, col)).value = comp["name"]
        tscores_wks.range((2, col)).value = comp["weight"]
        tscores_wks.range((3, col)).value = comp["date"]   # actual date — number format applied below
        tscores_wks.range((4, col)).value = f"T{i + 1}"

    # Fixed Knockouts and Trophies columns immediately after competition columns
    knockout_col = START_COL + len(sorted_comps)
    trophy_col = knockout_col + 1

    for col, label, hdr in [(knockout_col, "Knockouts", "KO"), (trophy_col, "Trophies", "TR")]:
        tscores_wks.range((1, col)).value = label
        tscores_wks.range((2, col)).value = 1
        tscores_wks.range((3, col)).value = ""
        tscores_wks.range((4, col)).value = hdr

    # Clear any stale columns to the right (previous run may have had more comps)
    clear_col = trophy_col + 1
    while tscores_wks.range((4, clear_col)).value is not None:
        tscores_wks.range((1, clear_col), (200, clear_col)).clear()
        clear_col += 1

    # ---- Formatting ----
    # COM alignment constants
    XL_CENTER = -4108   # xlCenter
    XL_TOP    = -4160   # xlTop

    # Column width = 15 for all competition + KO + TR columns
    tscores_wks.range((1, START_COL), (1, trophy_col)).column_width = 15

    # Row 1 (comp name): bold, wrap, centre, top-align
    row1 = tscores_wks.range((1, START_COL), (1, trophy_col)).api
    row1.Font.Bold             = True
    row1.WrapText              = True
    row1.HorizontalAlignment   = XL_CENTER
    row1.VerticalAlignment     = XL_TOP

    # Turn off WrapText from the Component Aggregates section rightwards (row 1).
    # agg_col = trophy_col + 2 (one empty gap column between TR and the block).
    tscores_wks.range((1, trophy_col + 2), (1, 16384)).api.WrapText = False

    # Rows 2–4: centre-aligned
    tscores_wks.range((2, START_COL), (4, trophy_col)).api.HorizontalAlignment = XL_CENTER

    # Row 4 (T-number): bold
    tscores_wks.range((4, START_COL), (4, trophy_col)).api.Font.Bold = True

    # Row 3 (date): date number format for competition columns only
    if sorted_comps:
        tscores_wks.range(
            (3, START_COL), (3, START_COL + len(sorted_comps) - 1)
        ).number_format = "mmm d, yyyy"

    print(
        f"  Tournament Scores columns: {len(sorted_comps)} competitions "
        f"(cols E–{_col_letter(knockout_col - 1)}) + Knockouts ({_col_letter(knockout_col)}) "
        f"+ Trophies ({_col_letter(trophy_col)})."
    )
    return {"comp_cols": comp_cols, "ko_col": knockout_col, "tr_col": trophy_col}


def _col_letter(col: int) -> str:
    """Convert 1-based column index to Excel column letter(s), e.g. 5 → 'E'."""
    result = ""
    while col > 0:
        col, remainder = divmod(col - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _populate_ts_scores(ts_ws: xw.Sheet,
                        comps: list[dict],
                        players: list[dict],
                        RTSF_book: xw.Book,
                        col_map: dict):
    """
    For each competition, read the RTSF Points column from the competition
    worksheet, multiply by the competition's weight, apply the Date Joined
    filter, then write the results as a single batch into 'Tournament Scores'.

    Players who joined AFTER the competition date receive a blank cell (not 0)
    so that they are excluded from the best-N score selection.

    Competition sheet structure (from write_competition_sheet):
        Rows 1–4 : metadata header
        Row 6    : table column headers
        Row 7+   : player data
        Col C (3): Player ID
        Col F (6): RTSF Points
    This is read via the sheet's first Excel Table (same as _read_sheet_players).
    """
    comp_cols  = col_map["comp_cols"]
    n_players  = len(players)

    # Build {player_id: index in players list} for fast lookup
    id_to_idx: dict[int, int] = {}
    for i, p in enumerate(players):
        if p["id"] is not None:
            id_to_idx[p["id"]] = i

    for comp in comps:
        col = comp_cols.get(comp["name"])
        if col is None:
            continue

        try:
            ws = RTSF_book.sheets[comp["name"]]
        except Exception:
            print(f"  Warning: sheet '{comp['name']}' not found — skipping.")
            continue

        # Read RTSF Points from the competition sheet via its Excel Table
        # (reuses the same _read_sheet_players pattern)
        comp_rtsf: dict[int, float] = {}
        if ws.tables:
            tbl = ws.tables[0]
            if tbl.data_body_range is not None:
                raw = tbl.data_body_range.value
                if raw:
                    if not isinstance(raw[0], list):
                        raw = [raw]
                    for row in raw:
                        pid_val  = row[2]   # col C = Player ID (0-based index 2)
                        rtsf_val = row[5]   # col F = RTSF Points (0-based index 5)
                        if pid_val is None:
                            continue
                        try:
                            comp_rtsf[int(pid_val)] = float(rtsf_val or 0)
                        except (ValueError, TypeError):
                            pass

        weight    = comp["weight"]
        comp_date = comp["date"]

        # Build one column of values aligned to the player list order
        col_vals: list[list] = []
        for p in players:
            pid = p["id"]
            # Date Joined filter: blank if player joined after this competition.
            # A blank date_joined means "not yet recorded" — treated as season
            # end, so the player is excluded from all competitions until updated.
            dj = p["date_joined"]
            if not dj or (comp_date and dj > comp_date):
                col_vals.append([None])
                continue
            raw_pts = comp_rtsf.get(pid, 0) if pid is not None else 0
            col_vals.append([raw_pts * weight if raw_pts else None])

        # Batch-write the entire column at once
        ts_ws.range((5, col), (4 + n_players, col)).value = col_vals

    print(f"  Populated RTSF scores for {len(comps)} competitions.")


def _read_match_play_scores(RTSF_book: xw.Book) -> dict:
    """
    Read all named tables from the 'Knockout Competitions' worksheet and return
    {player_id: {"knockouts": int, "trophies": int}}.

    Tables whose name contains one of KNOCKOUT_TABLE_NAMES are classed as
    knockouts; all other tables are classed as trophies.

    Each table must have a 'PlayerID' column and a 'Points' column.  The exact
    position of those columns is determined by reading the header row so the
    table layout is flexible.
    """
    try:
        ko_ws = RTSF_book.sheets["Knockout Competitions"]
    except Exception:
        print("  Warning: 'Knockout Competitions' sheet not found — match play scores skipped.")
        return {}

    scores: dict[int, dict] = {}

    for tbl in ko_ws.tables:
        # Classify as knockout or trophy by table name
        is_knockout = any(k in tbl.name.lower() for k in KNOCKOUT_TABLE_NAMES)
        category    = "knockouts" if is_knockout else "trophies"

        # Find column positions by header name (case-insensitive, spaces stripped)
        if tbl.header_row_range is None:
            continue
        headers = [
            str(c.value).strip().lower().replace(" ", "") if c.value else ""
            for c in tbl.header_row_range
        ]
        try:
            id_idx  = next(i for i, h in enumerate(headers) if h == "playerid")
            pts_idx = next(i for i, h in enumerate(headers) if h == "points")
        except StopIteration:
            print(f"  Warning: table '{tbl.name}' missing PlayerID or Points column — skipped.")
            continue

        if tbl.data_body_range is None:
            continue
        raw = tbl.data_body_range.value
        if not raw:
            continue
        if not isinstance(raw[0], list):
            raw = [raw]

        for row in raw:
            pid_val = row[id_idx]
            pts_val = row[pts_idx]
            if pid_val is None:
                continue
            try:
                pid_int = int(pid_val)
                pts_int = int(pts_val) if pts_val else 0
            except (ValueError, TypeError):
                continue
            if pid_int not in scores:
                scores[pid_int] = {"knockouts": 0, "trophies": 0}
            scores[pid_int][category] += pts_int

    total_players = sum(1 for v in scores.values() if v["knockouts"] + v["trophies"] > 0)
    print(f"  Match play scores read: {total_players} players with points.")
    return scores


def _aggregate_rtsf_scores(ts_ws: xw.Sheet,
                            players: list[dict],
                            comps: list[dict],
                            match_play: dict,
                            col_map: dict) -> list[dict]:
    """
    For each player, compute the aggregate RTSF Score:

        Best BEST_N[3] scores from Weight-3 (Major) competition columns
      + Best BEST_N[2] scores from Weight-2 (Medal/Named) competition columns
      + Best BEST_N[1] scores from Weight-1 (Stableford) competition columns,
        with the single highest Stableford score doubled (2× bonus)
      + ALL Knockout points  (no cap)
      + ALL Trophy points    (no cap)

    The values already stored in Tournament Scores are RTSF Points × weight,
    so no further multiplication is needed here.

    Writes:
      - Knockout total  → ko_col
      - Trophy total    → tr_col
      - Final RTSF Score → col D

    Returns a list of component dicts (one per player) used by
    _write_rtsf_components() for the diagnostic block.
    """
    comp_cols = col_map["comp_cols"]
    ko_col    = col_map["ko_col"]
    tr_col    = col_map["tr_col"]

    # Group competition columns by weight band
    w3_cols = [comp_cols[c["name"]] for c in comps if c["weight"] == 3 and c["name"] in comp_cols]
    w2_cols = [comp_cols[c["name"]] for c in comps if c["weight"] == 2 and c["name"] in comp_cols]
    w1_cols = [comp_cols[c["name"]] for c in comps if c["weight"] == 1 and c["name"] in comp_cols]

    n_players = len(players)

    # Batch-read all competition columns at once for performance
    # Range covers rows 5..(4+n) and cols E..(ko_col-1)
    max_comp_col = ko_col - 1
    if max_comp_col >= 5:
        all_data    = ts_ws.range((5, 5), (4 + n_players, max_comp_col)).value
        n_comp_cols = max_comp_col - 5 + 1
        # xlwings returns a scalar, flat list, or 2-D list depending on range shape.
        # Normalise to a 2-D list [n_players][n_comp_cols] for uniform indexing.
        if n_players == 1 and n_comp_cols == 1:
            all_data = [[all_data]]                    # single cell → scalar
        elif n_players == 1:
            all_data = [all_data]                      # single row → flat list
        elif n_comp_cols == 1:
            all_data = [[v] for v in all_data]         # single column → flat list
        # else: already a 2-D list — no change needed
    else:
        all_data = [[] for _ in players]

    def player_scores_for_cols(row_idx: int, cols: list[int]) -> list[float]:
        """Extract non-None score values for a player from specific columns."""
        row = all_data[row_idx]
        vals = []
        for col in cols:
            idx = col - 5  # offset from START_COL (E = col 5)
            if 0 <= idx < len(row):
                v = row[idx]
                if v is not None:
                    try:
                        vals.append(float(v))
                    except (TypeError, ValueError):
                        pass
        return vals

    components: list[dict] = []

    # Prepare batch-write arrays for ko_col, tr_col, and col D
    ko_vals:    list[list] = []
    tr_vals:    list[list] = []
    rtsf_vals:  list[list] = []

    for i, player in enumerate(players):
        pid = player["id"]
        mp  = match_play.get(pid, {"knockouts": 0, "trophies": 0}) if pid else {"knockouts": 0, "trophies": 0}

        w3_scores = sorted(player_scores_for_cols(i, w3_cols), reverse=True)
        w2_scores = sorted(player_scores_for_cols(i, w2_cols), reverse=True)
        w1_scores = sorted(player_scores_for_cols(i, w1_cols), reverse=True)

        best_w3 = sum(w3_scores[:BEST_N[3]])
        best_w2 = sum(w2_scores[:BEST_N[2]])
        # Best BEST_N[1] Stableford scores, with the highest score doubled.
        w1_top = w1_scores[:BEST_N[1]]
        best_w1 = (w1_top[0] * 2 + sum(w1_top[1:])) if w1_top else 0
        ko_pts  = mp["knockouts"]
        tr_pts  = mp["trophies"]
        total   = best_w3 + best_w2 + best_w1 + ko_pts + tr_pts

        ko_vals.append([ko_pts or None])
        tr_vals.append([tr_pts or None])
        rtsf_vals.append([total if total else None])

        w1_rounds = len(w1_scores[:BEST_N[1]])
        w2_rounds = len(w2_scores[:BEST_N[2]])
        w3_rounds = len(w3_scores[:BEST_N[3]])
        total_rounds = w1_rounds + w2_rounds + w3_rounds

        # Points-per-round efficiency (rounded to 1 dp; 0 when no rounds played)
        def _ppr(pts, rds): return round(pts / rds, 1) if rds > 0 else 0

        components.append({
            "player":        player["name"],
            "pid":           pid,
            "ts_row":        5 + i,
            "w1_rounds":     w1_rounds,
            "w1_pts":        best_w1,
            "w1_ppr":        _ppr(best_w1, w1_rounds),
            "w2_rounds":     w2_rounds,
            "w2_pts":        best_w2,
            "w2_ppr":        _ppr(best_w2, w2_rounds),
            "w3_rounds":     w3_rounds,
            "w3_pts":        best_w3,
            "w3_ppr":        _ppr(best_w3, w3_rounds),
            "ko_pts":        ko_pts,
            "tr_pts":        tr_pts,
            "total_rounds":  total_rounds,
            "total":         total,
            "total_ppr":     _ppr(best_w1 + best_w2 + best_w3, total_rounds),
        })

    # Batch-write match play totals and final RTSF scores
    ts_ws.range((5, ko_col),   (4 + n_players, ko_col)).value   = ko_vals
    ts_ws.range((5, tr_col),   (4 + n_players, tr_col)).value   = tr_vals
    ts_ws.range((5, 4),        (4 + n_players, 4)).value        = rtsf_vals  # col D

    return components


def _write_rtsf_components(tscores_wks: xw.Sheet,
                            components: list[dict],
                            col_map: dict):
    """
    Write the RTSFComponents diagnostic block to the right of the Trophies
    column, leaving an 8-column gap.  The gap contains a 5-column Component
    Aggregates summary table (cols start_col-6 to start_col-2), 1 true-empty
    col either side, matching the VBA layout (RTSFComponents.Offset(0, 8)).

    Gap layout (relative to Trophies = trophy_col):
        trophy_col+1  : empty
        trophy_col+2  : Component Aggregates col 1 (Stablefords best-N)
        trophy_col+3  : Component Aggregates col 2 (Medals best-N)
        trophy_col+4  : Component Aggregates col 3 (Majors best-N)
        trophy_col+5  : Component Aggregates col 4 (Match Play total)
        trophy_col+6  : Component Aggregates col 5 (Grand total)
        trophy_col+7  : empty
        trophy_col+8  : start_col — RTSFComponents title / data begin

    20-column RTSFComponents layout (offsets from start_col):
        +0   Rank
        +1   Player
        +2   W1 (Stableford) Rounds
        +3   W1 Points
        +4   W1 Pts/Rnd
        +5   W1 Stfd Efficiency rank
        +6   W2 (Medal/Named) Rounds
        +7   W2 Points
        +8   W2 Pts/Rnd
        +9   W2 Med Efficiency rank
        +10  W3 (Major) Rounds
        +11  W3 Points
        +12  W3 Pts/Rnd
        +13  W3 Maj Efficiency rank
        +14  KnockOut Points
        +15  Trophy Points
        +16  Total Rounds
        +17  Total RTSF Score
        +18  Total Pts/Rnd
        +19  RTSF Efficiency rank

    Row layout (matching VBA CalcRTSFScores / RTSFComponentsTitles):
        Row 1 : titles ("Component Aggregates" and "RTSF Components Summary")
        Row 2 : (empty — aligns with Tournament Scores weight row)
        Row 3 : section-group labels (Stablefords / Medals / Majors / Match Play / Total)
        Row 4 : sub-column headers (Rank, Player, Rounds, Points, …)
        Rows 5+: player data
    """
    trophy_col = col_map["tr_col"]
    start_col = trophy_col + 8   # 8-column gap — 2 empty + 5 Component Aggregates + 1 empty
    n_players = len(components)
    WIDTH     = 20            # total columns in the RTSFComponents block
    last_row  = 4 + n_players

    # ── COM constants ─────────────────────────────────────────────────────────
    XL_CENTER      = -4108   # xlCenter
    XL_CTR_ACROSS  = 7       # xlCenterAcrossSelection
    XL_LEFT        = -4131   # xlLeft
    XL_TOP         = -4160   # xlTop
    XL_CONTINUOUS  = 1       # xlContinuous (border line style)
    XL_MEDIUM      = -4138   # xlMedium (border weight)

    # ═════════════════════════════════════════════════════════════════════════
    # COMPONENT AGGREGATES BLOCK
    # 5 columns (start_col-6 to start_col-2), matching VBA Offset(0, -6) from
    # RTSFComponents.  Rows 3–4 are the header; rows 5+ are per-player totals.
    # ═════════════════════════════════════════════════════════════════════════
    agg_col = start_col - 6  # first column of the Component Aggregates block

    # ── Row 1: "Component Aggregates" title ───────────────────────────────────
    agg_title = tscores_wks.range((1, agg_col)).api
    agg_title.Value = "Component Aggregates"
    agg_title.Font.Bold = True
    agg_title.Font.Size = 14
    agg_title.VerticalAlignment = XL_TOP
    agg_title.HorizontalAlignment = XL_LEFT

    # ── Row 3: weight-category numbers (1, 2, 3, 1) and column widths ─────────
    tscores_wks.range((3, agg_col), (3, agg_col + 3)).value = [[1, 2, 3, 1]]
    wt_rng = tscores_wks.range((3, agg_col), (3, agg_col + 4)).api
    wt_rng.NumberFormat = "0"
    wt_rng.HorizontalAlignment = XL_CENTER
    wt_rng.ColumnWidth = 12

    # ── Row 4: category labels (bold) ─────────────────────────────────────────
    tscores_wks.range((4, agg_col), (4, agg_col + 4)).value = [
        ["Stablefords", "Medals", "Majors", "Match Play", "Total"]
    ]
    lbl_rng = tscores_wks.range((4, agg_col), (4, agg_col + 4)).api
    lbl_rng.Font.Bold = True
    lbl_rng.HorizontalAlignment = XL_CENTER
    lbl_rng.NumberFormat = "#,##0"

    # ── Rows 5+: per-player aggregate values ──────────────────────────────────
    if n_players:
        agg_data = [[
            c["w1_pts"]  or 0,
            c["w2_pts"]  or 0,
            c["w3_pts"]  or 0,
            (c["ko_pts"] or 0) + (c["tr_pts"] or 0),
            c["total"]   or 0,
        ] for c in components]
        tscores_wks.range((5, agg_col), (last_row, agg_col + 4)).value        = agg_data
        tscores_wks.range((5, agg_col), (last_row, agg_col + 4)).number_format = "#,##0"

    # ═════════════════════════════════════════════════════════════════════════
    # RTSF COMPONENTS SUMMARY BLOCK
    # ═════════════════════════════════════════════════════════════════════════

    # ── Row 1: title ──────────────────────────────────────────────────────────
    RTSFcomp_range = tscores_wks.range((1, start_col)).api  # first cell of the RTSFComponents block
    RTSFcomp_range.Value = "Detailed RTSF Components Summary"
    RTSFcomp_range.Font.Bold = True
    RTSFcomp_range.Font.Size = 14
    RTSFcomp_range.WrapText = False
    RTSFcomp_range.VerticalAlignment = -4160  # xlTop

    # ── Row 3: section-group labels (VBA: Offset(2, col) from title at row 1) ─
    # Each label is centred across its column span using xlCenterAcrossSelection.
    # Match Play spans 2 cols; all others span 4 cols.
    # Reset row 3 alignment and values across the full block first — stale
    # xlCenterAcrossSelection format persists across runs even after clear_contents().
    # Extend 5 cols past WIDTH so any stale alignment on the cell immediately after
    # the Total section (which xlCenterAcrossSelection reads to determine span) is cleared.
    tscores_wks.range((3, start_col), (3, start_col + WIDTH + 4)).clear()

    
    # section_groups is a list of tuples, one per section. Each tuple has three values:
    # col_off is the column offset to the right of start_col where the section begins.
    # label is the text written into the first cell of that section in row 3.
    # span is the number of columns the section covers.
    # Offsets match the 20-column layout: Players(+0–1), Stblfd(+2–5), Medal(+6–9),
    # Major(+10–13), Match(+14–15), Total(+16–19).
    section_groups = [
        (2,  f"Stablefords (Best {BEST_N[1]})", 4),
        (6,  f"Medals (Best {BEST_N[2]})",       4),
        (10, f"Majors (Best {BEST_N[3]})",        4),
        (14, "Match Play",                        2),
        (16, "Total",                             4),
    ]
    # This loop unpacks each tuple into those three named variables — standard Python
    # tuple unpacking.  The same section_groups list drives the border loop below.
    for col_off, label, span in section_groups:
        # Write label in the first cell of the span only; xlCenterAcrossSelection
        # visually centres it over the full span without merging cells.
        sec_hdr = tscores_wks.range(
            (3, start_col + col_off), (3, start_col + col_off + span - 1)
        ).api
        sec_hdr.Cells(1, 1).Value = label
        sec_hdr.HorizontalAlignment = XL_CTR_ACROSS
        # Explicitly reset the cell just past this section's right edge to xlLeft
        # so Excel knows where xlCenterAcrossSelection stops.
        tscores_wks.range((3, start_col + col_off + span)).api.HorizontalAlignment = XL_LEFT

    # ── Row 4: sub-column headers (VBA: Offset(3, col) from title at row 1) ───
    sub_hdrs = [
        "Rank", "Player",
        "Rounds", "Points", "Pts/Rnd", "Stfd Efficiency",
        "Rounds", "Points", "Pts/Rnd", "Med Efficiency",
        "Rounds", "Points", "Pts/Rnd", "Maj Efficiency",
        "KnockOut Pts", "Trophy Pts",
        "Rounds", "Points", "Pts/Rnd", "RTSF Efficiency",
    ]
    tscores_wks.range((4, start_col), (4, start_col + WIDTH - 1)).value = sub_hdrs
    r4 = tscores_wks.range((4, start_col), (4, start_col + WIDTH - 1)).api
    r4.Font.Bold           = True
    r4.HorizontalAlignment = XL_CENTER

    # ── Column widths (VBA: all → 8, then specific overrides) ────────────────
    tscores_wks.range((1, start_col), (1, start_col + WIDTH - 1)).column_width = 8
    col_widths = {0: 5, 1: 18, 5: 12, 9: 12, 13: 12, 14: 15, 15: 16, 19: 14}
    for offset, width in col_widths.items():
        tscores_wks.range((1, start_col + offset)).column_width = width

    # ── Number formats ────────────────────────────────────────────────────────
    # All data cells default to "#,##0"; override Pts/Rnd cols to "0.0".
    if n_players:
        tscores_wks.range((5, start_col), (last_row, start_col + WIDTH - 1)).number_format = "#,##0"
        for offset in [4, 8, 12, 18]:
            tscores_wks.range(
                (5, start_col + offset), (last_row, start_col + offset)
            ).number_format = "0.0"

    # ═════════════════════════════════════════════════════════════════════════
    # CLEAR STALE BORDERS
    # clear_contents() only removes values; borders persist across runs.
    # Explicitly reset all borders in the entire block (agg_col through the
    # last RTSFComponents column) before applying the new BorderAround calls.
    # xlNone = -4142
    tscores_wks.range(
        (1, agg_col), (last_row, start_col + WIDTH - 1)
    ).api.Borders.LineStyle = -4142

    # ═════════════════════════════════════════════════════════════════════════
    # NAMED RANGE VARIABLES — one per column group in the RTSFComponents block.
    # Each covers the full vertical extent of that group:
    #   - Players: row 4 (sub-header) downwards — no section header in row 3.
    #   - All other groups: row 3 (section header) downwards.
    # Column offsets match the 20-column layout in the docstring:
    #   +0–+1   Rank / Player
    #   +2–+5   Stablefords (Rounds, Points, Pts/Rnd, Stfd Efficiency)
    #   +6–+9   Medals      (Rounds, Points, Pts/Rnd, Med Efficiency)
    #   +10–+13 Majors      (Rounds, Points, Pts/Rnd, Maj Efficiency)
    #   +14–+15 Match Play  (KnockOut Pts, Trophy Pts)
    #   +16–+19 Total       (Rounds, Points, Pts/Rnd, RTSF Efficiency)
    # ═════════════════════════════════════════════════════════════════════════
    RTSF_comp_players = tscores_wks.range((4, start_col),       (last_row, start_col + 1))
    RTSF_comp_stblfd  = tscores_wks.range((3, start_col + 2),   (last_row, start_col + 5))
    RTSF_comp_medal   = tscores_wks.range((3, start_col + 6),   (last_row, start_col + 9))
    RTSF_comp_major   = tscores_wks.range((3, start_col + 10),  (last_row, start_col + 13))
    RTSF_comp_match   = tscores_wks.range((3, start_col + 14),  (last_row, start_col + 15))
    RTSF_comp_total   = tscores_wks.range((3, start_col + 16),  (last_row, start_col + 19))

    # ═════════════════════════════════════════════════════════════════════════
    # BORDERS — BorderAround each group (all medium weight).
    # ═════════════════════════════════════════════════════════════════════════
    for grp in (RTSF_comp_players, RTSF_comp_stblfd, RTSF_comp_medal,
                RTSF_comp_major, RTSF_comp_match, RTSF_comp_total):
        grp.api.BorderAround(LineStyle=XL_CONTINUOUS, Weight=XL_MEDIUM)

    # BorderAround the full row 4 header bar — from Rank (start_col) to the
    # last Total column (start_col + 19).
    tscores_wks.range((4, start_col), (4, start_col + 19)).api.BorderAround(
        LineStyle=XL_CONTINUOUS, Weight=XL_MEDIUM
    )

    # ═════════════════════════════════════════════════════════════════════════
    # EFFICIENCY RANKS (computed in Python, written as static values)
    # ═════════════════════════════════════════════════════════════════════════

    # ── Compute efficiency ranks in Python ────────────────────────────────────
    def _rank_desc(values: list[float]) -> list[int]:
        """Return 1-based descending rank for each value (ties share the best rank)."""
        sorted_vals = sorted(set(v for v in values if v), reverse=True)
        rank_map    = {v: i + 1 for i, v in enumerate(sorted_vals)}
        return [rank_map.get(v, 0) for v in values]

    w1_ppr_vals   = [c["w1_ppr"]    for c in components]
    w2_ppr_vals   = [c["w2_ppr"]    for c in components]
    w3_ppr_vals   = [c["w3_ppr"]    for c in components]
    rtsf_ppr_vals = [c["total_ppr"] for c in components]
    total_vals    = [c["total"]      for c in components]

    w1_eff_ranks   = _rank_desc(w1_ppr_vals)
    w2_eff_ranks   = _rank_desc(w2_ppr_vals)
    w3_eff_ranks   = _rank_desc(w3_ppr_vals)
    rtsf_eff_ranks = _rank_desc(rtsf_ppr_vals)
    rtsf_ranks     = _rank_desc(total_vals)

    # ═════════════════════════════════════════════════════════════════════════
    # DATA ROWS 5+ (batch write per column group)
    # ═════════════════════════════════════════════════════════════════════════

    def _col_vals(getter):
        """Build a column-vector list from components."""
        return [[getter(c)] for c in components]

    # Rank (col +0) and Player (col +1)
    tscores_wks.range((5, start_col),     (last_row, start_col)).value     = [[r] for r in rtsf_ranks]
    tscores_wks.range((5, start_col + 1), (last_row, start_col + 1)).value = [[c["player"]] for c in components]

    # W1 block (+2..+5)
    tscores_wks.range((5, start_col + 2), (last_row, start_col + 2)).value = _col_vals(lambda c: c["w1_rounds"] or None)
    tscores_wks.range((5, start_col + 3), (last_row, start_col + 3)).value = _col_vals(lambda c: c["w1_pts"] or None)
    tscores_wks.range((5, start_col + 4), (last_row, start_col + 4)).value = _col_vals(lambda c: c["w1_ppr"] or None)
    tscores_wks.range((5, start_col + 5), (last_row, start_col + 5)).value = [[r or None] for r in w1_eff_ranks]

    # W2 block (+6..+9)
    tscores_wks.range((5, start_col + 6), (last_row, start_col + 6)).value = _col_vals(lambda c: c["w2_rounds"] or None)
    tscores_wks.range((5, start_col + 7), (last_row, start_col + 7)).value = _col_vals(lambda c: c["w2_pts"] or None)
    tscores_wks.range((5, start_col + 8), (last_row, start_col + 8)).value = _col_vals(lambda c: c["w2_ppr"] or None)
    tscores_wks.range((5, start_col + 9), (last_row, start_col + 9)).value = [[r or None] for r in w2_eff_ranks]

    # W3 block (+10..+13)
    tscores_wks.range((5, start_col + 10), (last_row, start_col + 10)).value = _col_vals(lambda c: c["w3_rounds"] or None)
    tscores_wks.range((5, start_col + 11), (last_row, start_col + 11)).value = _col_vals(lambda c: c["w3_pts"] or None)
    tscores_wks.range((5, start_col + 12), (last_row, start_col + 12)).value = _col_vals(lambda c: c["w3_ppr"] or None)
    tscores_wks.range((5, start_col + 13), (last_row, start_col + 13)).value = [[r or None] for r in w3_eff_ranks]

    # Match play (+14, +15)
    tscores_wks.range((5, start_col + 14), (last_row, start_col + 14)).value = _col_vals(lambda c: c["ko_pts"] or None)
    tscores_wks.range((5, start_col + 15), (last_row, start_col + 15)).value = _col_vals(lambda c: c["tr_pts"] or None)

    # Total block (+16..+19)
    tscores_wks.range((5, start_col + 16), (last_row, start_col + 16)).value = _col_vals(lambda c: c["total_rounds"] or None)
    tscores_wks.range((5, start_col + 17), (last_row, start_col + 17)).value = _col_vals(lambda c: c["total"] or None)
    tscores_wks.range((5, start_col + 18), (last_row, start_col + 18)).value = _col_vals(lambda c: c["total_ppr"] or None)
    tscores_wks.range((5, start_col + 19), (last_row, start_col + 19)).value = [[r or None] for r in rtsf_eff_ranks]

    print(f"  RTSFComponents ({WIDTH} cols) written starting at column {_col_letter(start_col)}.")


def _sort_worksheet_tabs(RTSF_book: xw.Book):
    """
    Sort all worksheet tabs into the required order:

        1.  Competition sheets   — newest-first, alphabetical within same date
        2.  Knockout Competitions
        3.  Tournament Scores
        4.  Inputs
        5.  LeaderBoard sheets   — newest-first (most recent leaderboard first)
        6.  HTML_Debug           — always last (if present)

    Special sheets (non-competition) are identified by name; any sheet not in
    that set and whose A1 cell equals "Competition:" is treated as a competition
    tab and sorted by its B2 date.  LeaderBoard sheets are identified by the
    "LeaderBoard YYMMDD" name pattern and sorted by the embedded date.
    """
    SPECIAL_NAMES = {"Inputs", "Tournament Scores", "HTML_Debug", "Knockout Competitions"}

    # ── Collect and sort competition sheets ───────────────────────────────────
    comp_sheets: list[tuple[xw.Sheet, datetime.date]] = []
    for ws in RTSF_book.sheets:
        if ws.name in SPECIAL_NAMES:
            continue
        if ws.name.startswith("LeaderBoard"):
            continue
        if ws.range("A1").value != "Competition:":
            continue
        date_raw = ws.range("B2").value
        if isinstance(date_raw, datetime.datetime):
            date_val = date_raw.date()
        elif isinstance(date_raw, datetime.date):
            date_val = date_raw
        else:
            try:
                clean    = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", str(date_raw))
                date_val = datetime.datetime.strptime(clean.strip(), "%A %d %B %Y").date()
            except (ValueError, TypeError):
                date_val = datetime.date.min
        comp_sheets.append((ws, date_val))

    comp_sheets.sort(key=lambda x: (-x[1].toordinal(), x[0].name))

    # ── Collect and sort LeaderBoard sheets (newest first) ────────────────────
    lb_sheets: list[tuple[datetime.date, xw.Sheet]] = []
    for ws in RTSF_book.sheets:
        if not ws.name.startswith("LeaderBoard "):
            continue
        suffix = ws.name[len("LeaderBoard "):]
        try:
            d = datetime.datetime.strptime(suffix, "%y%m%d").date()
        except ValueError:
            continue
        lb_sheets.append((d, ws))
    lb_sheets.sort(key=lambda x: x[0], reverse=True)   # newest first

    # ── Move competition sheets to front ──────────────────────────────────────
    # Iterate reversed so that the newest sheet lands at index 0 after all moves.
    for ws, _ in reversed(comp_sheets):
        ws.api.Move(Before=RTSF_book.sheets[0].api)

    # ── Move fixed special sheets to end: KO → TS → Inputs ───────────────────
    for name in ["Knockout Competitions", "Tournament Scores", "Inputs"]:
        try:
            RTSF_book.sheets[name].api.Move(
                After=RTSF_book.sheets[RTSF_book.sheets.count - 1].api
            )
        except Exception:
            pass  # sheet may not exist

    # ── Move LeaderBoard sheets after Inputs, newest first ────────────────────
    # Iterate reversed so newest ends up immediately after Inputs.
    for _, ws in reversed(lb_sheets):
        ws.api.Move(After=RTSF_book.sheets[RTSF_book.sheets.count - 1].api)

    # ── HTML_Debug always last ────────────────────────────────────────────────
    try:
        RTSF_book.sheets["HTML_Debug"].api.Move(
            After=RTSF_book.sheets[RTSF_book.sheets.count - 1].api
        )
    except Exception:
        pass

    print(f"  Sorted {len(comp_sheets)} competition tabs, {len(lb_sheets)} leaderboard tabs.")


# ─────────────────────────────────────────────────────────────────────────────
# LeaderBoard helpers  (equivalent to VBA Results / WinAvgRatio modules)
# ─────────────────────────────────────────────────────────────────────────────

def _get_rounds_played_from_ts(
    ts_ws: xw.Sheet,
    n_players: int,
    ko_col: int | None,
    tr_col: int | None,
) -> list[dict]:
    """
    For each player row (5 .. 4+n_players) in Tournament Scores, count every
    non-empty, non-zero numeric cell across competition columns E .. tr_col,
    excluding the Knockouts (KO) and Trophies (TR) fixed columns.

    Equivalent to VBA GetRoundsPlayed (with the Or→And bug corrected so KO/TR
    are properly excluded).

    Returns a list of {"rounds": int, "total": float, "avg": float} aligned to
    the player order currently on the Tournament Scores sheet.
    """
    if n_players == 0 or tr_col is None:
        return [{"rounds": 0, "total": 0.0, "avg": 0.0}] * n_players

    last_row = 4 + n_players
    data = ts_ws.range((5, 5), (last_row, tr_col)).value
    # Normalise xlwings shape quirks
    if n_players == 1:
        data = [data if isinstance(data, list) else [data]]

    ko_offset = (ko_col - 5) if ko_col else None
    tr_offset = (tr_col - 5) if tr_col else None

    result = []
    for row in data:
        if not isinstance(row, list):
            row = [row]
        rounds = 0
        total  = 0.0
        for j, val in enumerate(row):
            if j == ko_offset or j == tr_offset:
                continue                   # exclude KO and TR columns
            if val is not None and val != 0:
                try:
                    v = float(val)
                    if v:
                        rounds += 1
                        total  += v
                except (TypeError, ValueError):
                    pass
        avg = round(total / rounds, 2) if rounds > 0 else 0.0
        result.append({"rounds": rounds, "total": total, "avg": avg})
    return result


def _calc_war(
    RTSF_book: xw.Book,
    player_ids: list[int | None],
) -> dict[int, float | None]:
    """
    Compute Win Average Ratio (WAR) for each player.

    For each competition worksheet that carries an Excel Table with "Position",
    "Player Name", and "Player ID" columns:
        WAR_comp = (position / total_field) * 100

    A player's overall WAR = average WAR_comp across all competitions they
    entered.  Lower is better (1st in an 80-player field → 1.25%).

    Equivalent to VBA CollectPlayerRankings / CalculatePlayerAverages
    (WinAvgRatio module).

    Returns {player_id: float | None}  — None means no competitions entered.
    """
    SPECIAL = {
        "Inputs", "Tournament Scores", "HTML_Debug", "Knockout Competitions"
    }

    # Accumulate (sum, count) per player
    war_accum: dict[int, list[float]] = {
        pid: [] for pid in player_ids if pid is not None
    }

    for ws in RTSF_book.sheets:
        if ws.name in SPECIAL or ws.name.startswith("LeaderBoard"):
            continue
        if not ws.tables:
            continue

        tbl = ws.tables[0]
        if tbl.header_row_range is None or tbl.data_body_range is None:
            continue

        # Locate "Position" and "Player ID" columns by header name
        headers = [
            str(c.value).strip().lower().replace(" ", "") if c.value else ""
            for c in tbl.header_row_range
        ]
        try:
            pos_idx = next(i for i, h in enumerate(headers) if h == "position")
            id_idx  = next(i for i, h in enumerate(headers) if h == "playerid")
        except StopIteration:
            continue   # not a competition results table

        raw = tbl.data_body_range.value
        if not raw:
            continue
        if not isinstance(raw[0], list):
            raw = [raw]

        total_players = len(raw)
        if total_players == 0:
            continue

        for row in raw:
            try:
                pos = int(row[pos_idx])
                pid = int(row[id_idx])
            except (ValueError, TypeError, IndexError):
                continue
            if pid in war_accum:
                war_accum[pid].append((pos / total_players) * 100)

    return {
        pid: (sum(vals) / len(vals) if vals else None)
        for pid, vals in war_accum.items()
    }


def _get_last_leaderboard(
    RTSF_book: xw.Book,
    current_name: str,
) -> xw.Sheet | None:
    """
    Return the most recent prior LeaderBoard worksheet (name starts with
    "LeaderBoard " followed by a YYMMDD suffix), excluding the sheet named
    current_name.  Returns None if no prior leaderboard exists.

    Equivalent to VBA GetLastLeaderBoard (Results module) combined with
    StrToDate / IsYYMMDD helpers.
    """
    lb_sheets: list[tuple[datetime.date, xw.Sheet]] = []
    for ws in RTSF_book.sheets:
        if not ws.name.startswith("LeaderBoard "):
            continue
        if ws.name == current_name:
            continue
        suffix = ws.name[len("LeaderBoard "):]      # e.g. "250418"
        try:
            d = datetime.datetime.strptime(suffix, "%y%m%d").date()
        except ValueError:
            continue
        lb_sheets.append((d, ws))

    if not lb_sheets:
        return None
    lb_sheets.sort(key=lambda x: x[0], reverse=True)
    return lb_sheets[0][1]   # most recent previous leaderboard


def _write_leaderboard_file(RTSF_book: xw.Book, lb_ws: xw.Sheet,
                            lb_name: str, n_players: int, hdr_row: int):
    """
    Save the leaderboard worksheet as a standalone XLSX in a 'Leaderboard'
    subdirectory next to the workbook.

    Only rows from hdr_row (row 4 — column headers) downwards are copied;
    the title and date rows at the top are omitted.

    The file is always overwritten so it stays current with the sheet.
    """
    wb_full = RTSF_book.fullname
    if wb_full.lower().startswith("http"):
        local_dir = os.path.join(
            os.environ.get("USERPROFILE", ""),
            "OneDrive - Lancea Partners",
            "Personal", "Golf", "RTSF Website", "RTSF Spreadsheets",
        )
        print("  Warning: workbook path is a URL; using derived local path for Leaderboard file.")
    else:
        local_dir = os.path.dirname(os.path.abspath(wb_full))

    lb_dir = os.path.join(local_dir, "Leaderboard")
    os.makedirs(lb_dir, exist_ok=True)

    file_path = os.path.join(lb_dir, lb_name + ".xlsx")

    # Read from hdr_row down through the last player data row (8 cols wide)
    last_row = hdr_row + n_players   # hdr_row = headers, hdr_row+1..+n = data
    src_range = lb_ws.range((hdr_row, 1), (last_row, 8))

    new_wb = RTSF_book.app.books.add()
    try:
        new_ws = new_wb.sheets[0]
        new_ws.name = lb_name[:31]

        # Copy values and number formats cell by cell for the header + data rows
        src_vals = src_range.value
        if src_vals:
            if not isinstance(src_vals[0], list):
                src_vals = [src_vals]
            new_ws.range((1, 1), (len(src_vals), 8)).value = src_vals

        # Replicate number formats from the source sheet
        n_rows_out = last_row - hdr_row + 1
        for r in range(n_rows_out):
            for c in range(8):
                src_cell  = lb_ws.range((hdr_row + r, 1 + c))
                dest_cell = new_ws.range((1 + r, 1 + c))
                fmt = src_cell.number_format
                if fmt and fmt != "General":
                    dest_cell.number_format = fmt

        # Bold the header row and replicate column widths
        new_ws.range((1, 1), (1, 8)).font.bold = True
        for c in range(1, 9):
            new_ws.range((1, c)).column_width = lb_ws.range((hdr_row, c)).column_width

        new_wb.save(file_path)
        print(f"  Leaderboard file saved: {os.path.basename(file_path)}")
    finally:
        new_wb.api.Close(SaveChanges=False)


def write_leaderboard(RTSF_book: xw.Book):
    """
    Create (or refresh) a LeaderBoard YYMMDD worksheet for the most recently
    scored competition.

    Equivalent to VBA WriteLeaderBoard (Results module) calling:
        GetRoundsPlayed   → _get_rounds_played_from_ts
        GetWinAvgRatio    → _calc_war
        GetLastLeaderBoard → _get_last_leaderboard

    Leaderboard layout
    ──────────────────
        Row 1  : "Race to Swinley Forest Leader Board"  (bold, size 16)
        Row 2  : "As of: "  |  <date>  (bold, size 14)
        Row 4  : Column headers (bold, wrap, top-aligned)
        Rows 5+: One row per player, sorted by descending RTSF score

    Columns:
        A  Player                 B  Position
        C  Total Points           D  Pts per Round
        E  Change in Pts          F  Change in Rank
        G  No of Rounds           H  Avg Win Percentile (%)
    """
    print("\n--- Writing LeaderBoard ---")
    RTSF_book.app.screen_updating = False

    try:
        ts_ws = RTSF_book.sheets["Tournament Scores"]
    except Exception:
        print("  ERROR: 'Tournament Scores' sheet not found.")
        RTSF_book.app.screen_updating = True
        return

    try:
        # ── Step 1: Determine the competition date ────────────────────────────
        # Row 3 of Tournament Scores holds competition dates; col E (col 5) is
        # the most recent competition (T1 = newest-first).
        comp_date_raw = ts_ws.range((3, 5)).value
        if isinstance(comp_date_raw, datetime.datetime):
            comp_date = comp_date_raw.date()
        elif isinstance(comp_date_raw, datetime.date):
            comp_date = comp_date_raw
        else:
            comp_date = datetime.date.today()

        # ── Step 2: Determine leaderboard sheet name ──────────────────────────
        lb_name = "LeaderBoard " + comp_date.strftime("%y%m%d")
        if len(lb_name) > 31:
            lb_name = lb_name[:31]

        # ── Step 3: Create or clear the leaderboard sheet ─────────────────────
        # Target position: immediately after the Inputs sheet.  Any existing
        # LeaderBoard sheets are then re-sorted (newest first) after Inputs.
        try:
            lb_ws = RTSF_book.sheets[lb_name]
            lb_ws.api.Cells.Clear()
            print(f"  Cleared existing sheet '{lb_name}'.")
        except Exception:
            # Insert after Inputs if it exists, otherwise after the last sheet.
            try:
                inputs_ws = RTSF_book.sheets["Inputs"]
                lb_ws = RTSF_book.sheets.add(after=inputs_ws)
            except Exception:
                lb_ws = RTSF_book.sheets.add(
                    after=RTSF_book.sheets[RTSF_book.sheets.count - 1]
                )
            lb_ws.name = lb_name
            print(f"  Created new sheet '{lb_name}'.")

        # Turn off gridlines on the leaderboard sheet
        lb_ws.activate()
        RTSF_book.app.api.ActiveWindow.DisplayGridlines = False

        # Re-sort all LeaderBoard sheets so they appear after Inputs, newest first.
        # Collect them (including the just-created/cleared one), sort descending.
        lb_all: list[tuple[datetime.date, xw.Sheet]] = []
        for ws in RTSF_book.sheets:
            if not ws.name.startswith("LeaderBoard "):
                continue
            try:
                d = datetime.datetime.strptime(ws.name[len("LeaderBoard "):], "%y%m%d").date()
            except ValueError:
                continue
            lb_all.append((d, ws))
        lb_all.sort(key=lambda x: x[0], reverse=True)   # newest first

        # Move them after Inputs in reverse order so newest lands directly after Inputs.
        try:
            inputs_ws = RTSF_book.sheets["Inputs"]
            for _, ws in reversed(lb_all):
                ws.api.Move(After=inputs_ws.api)
        except Exception:
            pass

        # ── Step 4: Write heading rows ────────────────────────────────────────
        XL_CENTER = -4108
        XL_LEFT   = -4131
        XL_RIGHT  = -4152
        XL_TOP    = -4160

        lb_ws.range("A1").value = "Race to Swinley Forest Leader Board"
        lb_ws.range("A1").api.Font.Bold = True
        lb_ws.range("A1").api.Font.Size = 16

        lb_ws.range("A2").value = "As of: "
        lb_ws.range("A2").api.Font.Bold = True
        lb_ws.range("A2").api.HorizontalAlignment = XL_RIGHT

        lb_ws.range("B2").value = comp_date.strftime("%b %d, %Y")
        lb_ws.range("B2").api.Font.Bold = True
        lb_ws.range("B2").api.Font.Size = 14
        lb_ws.range("B2").api.HorizontalAlignment = XL_LEFT

        # ── Step 5: Column headers at row 4 ───────────────────────────────────
        HDR_ROW  = 4
        HDR_COL  = 1   # col A
        DATA_ROW = HDR_ROW + 1

        col_headers = [
            "Player",
            "Position",
            "Total\nPoints",
            "Pts per\nRound",
            "Change\nin Pts",
            "Change\nin Rank",
            "No of\nRounds",
            "Avg Win\nPercentile",
        ]
        lb_ws.range((HDR_ROW, HDR_COL), (HDR_ROW, HDR_COL + 7)).value = col_headers
        hdr_rng = lb_ws.range((HDR_ROW, HDR_COL), (HDR_ROW, HDR_COL + 7)).api
        hdr_rng.Font.Bold         = True
        hdr_rng.VerticalAlignment = XL_TOP
        hdr_rng.WrapText          = True

        # Column widths
        lb_ws.range((HDR_ROW, 1)).column_width = 20   # A: Player name
        lb_ws.range((HDR_ROW, 2)).column_width = 12   # B: Position
        for col in range(3, 9):
            lb_ws.range((HDR_ROW, col)).column_width = 12

        # Alignment: col A left, all others centred
        lb_ws.range((HDR_ROW, 1)).api.HorizontalAlignment = XL_LEFT
        lb_ws.range(
            (HDR_ROW, 2), (HDR_ROW, 8)
        ).api.HorizontalAlignment = XL_CENTER

        # ── Step 6: Read player data from Tournament Scores (already sorted) ──
        # Tournament Scores rows 5+: col A = name, col B = player ID, col D = RTSF
        raw_ts = ts_ws.range((5, 1), (500, 4)).value   # read up to 500 rows
        player_rows: list[dict] = []
        for row in (raw_ts or []):
            if row[0] is None:
                break
            try:
                pid = int(row[1]) if row[1] is not None else None
            except (ValueError, TypeError):
                pid = None
            player_rows.append({
                "name": str(row[0]).strip(),
                "id":   pid,
                "rtsf": float(row[3]) if row[3] is not None else 0.0,
            })

        n_players = len(player_rows)
        if n_players == 0:
            print("  No players found in Tournament Scores.")
            return

        # ── Step 7: Locate KO and TR columns by scanning row 4 ───────────────
        hdr4 = ts_ws.range((4, 5), (4, 300)).value or []
        if not isinstance(hdr4, list):
            hdr4 = [hdr4]
        ko_col = tr_col = None
        for j, h in enumerate(hdr4):
            if h is None:
                break
            s = str(h).strip()
            if s == "KO" and ko_col is None:
                ko_col = 5 + j
            elif s == "TR" and tr_col is None:
                tr_col = 5 + j

        # ── Step 8: Rounds played and average score ────────────────────────────
        rounds_data = _get_rounds_played_from_ts(ts_ws, n_players, ko_col, tr_col)

        # ── Step 9: Win Average Ratio ──────────────────────────────────────────
        pid_list   = [p["id"] for p in player_rows]
        war_by_pid = _calc_war(RTSF_book, pid_list)

        # ── Step 10: Write player data (cols A–D, G–H; E–F filled next) ───────
        data_block: list[list] = []
        for i, player in enumerate(player_rows):
            rd  = rounds_data[i] if i < len(rounds_data) else {"rounds": 0, "avg": 0.0}
            war = war_by_pid.get(player["id"])   # None → no competitions
            data_block.append([
                player["name"],                              # A
                i + 1,                                       # B  Position
                player["rtsf"],                              # C  Total Points
                rd["avg"],                                   # D  Pts per Round
                None,                                        # E  Change in Pts (filled below)
                None,                                        # F  Change in Rank (filled below)
                rd["rounds"],                                # G  No of Rounds
                (war / 100) if war is not None else None,    # H  WAR as decimal
            ])

        lb_ws.range(
            (DATA_ROW, 1), (DATA_ROW + n_players - 1, 8)
        ).value = data_block

        # Number formats
        lb_ws.range(
            (DATA_ROW, 4), (DATA_ROW + n_players - 1, 4)
        ).number_format = "0.0"       # D: Pts per Round
        lb_ws.range(
            (DATA_ROW, 8), (DATA_ROW + n_players - 1, 8)
        ).number_format = "0.0%"      # H: WAR

        # ── Step 11: Changes vs previous leaderboard ──────────────────────────
        prev_lb = _get_last_leaderboard(RTSF_book, lb_name)

        if prev_lb is not None:
            # Batch-read previous leaderboard cols A–C rows 5..204
            prev_raw = prev_lb.range((DATA_ROW, 1), (DATA_ROW + 199, 3)).value or []
            prev_data: dict[str, tuple[int, float]] = {}
            for row in prev_raw:
                if row[0] is None:
                    break
                try:
                    prev_data[str(row[0]).strip()] = (
                        int(row[1] or 0),
                        float(row[2] or 0),
                    )
                except (ValueError, TypeError):
                    pass

            changes: list[list] = []
            for i, player in enumerate(player_rows):
                if player["name"] in prev_data:
                    prev_pos, prev_total = prev_data[player["name"]]
                    pts_change  = player["rtsf"] - prev_total
                    rank_change = prev_pos - (i + 1)   # positive = moved up
                else:
                    pts_change  = 0
                    rank_change = 0
                changes.append([pts_change, rank_change])

            lb_ws.range(
                (DATA_ROW, 5), (DATA_ROW + n_players - 1, 6)
            ).value = changes

        else:
            # First leaderboard — no prior data to compare
            lb_ws.range(
                (DATA_ROW, 5), (DATA_ROW + n_players - 1, 6)
            ).value = [[0, 0]] * n_players

        # ── Step 12: Save standalone LeaderBoard XLSX ────────────────────────
        _write_leaderboard_file(RTSF_book, lb_ws, lb_name, n_players, HDR_ROW)

        RTSF_book.save()
        print(f"  LeaderBoard '{lb_name}' written with {n_players} players.")

    finally:
        RTSF_book.app.screen_updating = True

    print("--- LeaderBoard complete ---\n")


def _write_tscores_files(RTSF_book: xw.Book, comps: list[dict], players: list[dict]):
    """
    Write standalone Results XLSX files for each competition into a 'Results'
    subdirectory next to the workbook.  Mirrors the VBA WriteTScores macro.

    Two files are created per competition:
      Results_{wks_name}.xlsx       — full version: player data + 999-sentinel
                                      metadata rows (name, weight, date, etc.)
      Results_{wks_name} Clean.xlsx — identical player data without metadata rows

    Files are only created if the main version does not already exist.  Delete
    the existing file to force a refresh after results are updated.

    Columns written: Rank | Player | Player ID | Gender | RTSF Points
    Players are sorted descending by RTSF Points; only eligible players (those
    in the Inputs player list with pts > 0) are included.
    """
    # ── Resolve local Results directory ──────────────────────────────────────
    wb_full = RTSF_book.fullname
    if wb_full.lower().startswith("http"):
        # Workbook opened via OneDrive/SharePoint URL — fall back to a
        # derived local path (matches the VBA LocalPath logic)
        local_dir = os.path.join(
            os.environ.get("USERPROFILE", ""),
            "OneDrive - Lancea Partners",
            "Personal", "Golf", "RTSF Website", "RTSF Spreadsheets",
        )
        print("  Warning: workbook path is a URL; using derived local path for Results.")
    else:
        local_dir = os.path.dirname(os.path.abspath(wb_full))

    results_dir = os.path.join(local_dir, "Results")
    os.makedirs(results_dir, exist_ok=True)

    # ── Player lookups ───────────────────────────────────────────────────────
    eligible_ids: set[int] = {p["id"] for p in players if p["id"] is not None}
    gender_by_id: dict[int, str] = {
        p["id"]: p["gender"] for p in players if p["id"] is not None
    }

    created = 0
    skipped = 0

    for comp in comps:
        wks_name  = comp["name"]
        file_stem = f"Results_{wks_name}"
        main_path  = os.path.join(results_dir, file_stem + ".xlsx")
        clean_path = os.path.join(results_dir, file_stem + " Clean.xlsx")

        if os.path.exists(main_path):
            skipped += 1
            continue

        # ── Read competition sheet ────────────────────────────────────────────
        try:
            comp_ws = RTSF_book.sheets[wks_name]
        except Exception:
            print(f"  Warning: sheet '{wks_name}' not found — skipping Results file.")
            skipped += 1
            continue

        # Metadata from header block (rows 1–4, cols A–E)
        comp_name   = comp_ws.range("B1").value or wks_name
        comp_date   = comp_ws.range("B2").value or ""
        weight      = comp_ws.range("B4").value or comp["weight"]
        tees        = comp_ws.range("E1").value or ""
        competitors = comp_ws.range("E2").value or ""
        url         = comp_ws.range("E4").value or ""

        if isinstance(comp_date, datetime.datetime):
            comp_date = comp_date.strftime("%b %d, %Y")

        # Player rows from the sheet's Excel table
        score_rows: list[list] = []   # [rank_placeholder, name, pid, gender, pts]
        if comp_ws.tables:
            tbl = comp_ws.tables[0]
            if tbl.data_body_range is not None:
                raw = tbl.data_body_range.value
                if raw:
                    if not isinstance(raw[0], list):
                        raw = [raw]
                    for row in raw:
                        pid_val  = row[2]   # Player ID  (col C, index 2)
                        name_val = row[1]   # Player Name (col B, index 1)
                        rtsf_val = row[5]   # RTSF Points (col F, index 5)
                        if pid_val is None:
                            continue
                        try:
                            pid = int(pid_val)
                        except (ValueError, TypeError):
                            continue
                        if pid not in eligible_ids:
                            continue
                        try:
                            pts = float(rtsf_val or 0)
                        except (ValueError, TypeError):
                            pts = 0.0
                        if pts > 0:
                            score_rows.append([
                                None,                       # rank — assigned after sort
                                str(name_val or "").strip(),
                                pid,
                                gender_by_id.get(pid, ""),
                                pts,
                            ])

        if not score_rows:
            print(f"  Warning: no eligible scores for '{wks_name}' — skipping Results file.")
            skipped += 1
            continue

        # Sort descending by RTSF Points and assign ranks
        score_rows.sort(key=lambda r: r[4], reverse=True)
        for rank_i, row in enumerate(score_rows, 1):
            row[0] = rank_i

        # ── Create standalone workbook ────────────────────────────────────────
        new_wb = RTSF_book.app.books.add()
        try:
            new_ws = new_wb.sheets[0]
            new_ws.name = wks_name[:31]

            # Row 1: column headers
            new_ws.range("A1:E1").value = [
                ["Rank", "Player", "Player ID", "Gender", "RTSF Points"]
            ]
            new_ws.range("A1:E1").font.bold = True

            # Rows 2+: player data
            n_rows = len(score_rows)
            new_ws.range((2, 1), (1 + n_rows, 5)).value = score_rows

            # Autofit A:E before saving
            new_ws.range("A:E").api.EntireColumn.AutoFit()

            # ── Clean version: save before adding metadata ────────────────────
            new_wb.save(clean_path)

            # ── Metadata rows with 999 sentinel in col A ─────────────────────
            # VBA layout: 2 blank-sentinel gap rows, then 6 labelled rows
            #   last_player_row + 1 : 999 (gap)
            #   last_player_row + 2 : 999 (gap)
            #   last_player_row + 3 : 999 | "Competition:" | value
            #   last_player_row + 4 : 999 | "RTSF Weight:" | value
            #   last_player_row + 5 : 999 | "Date:"        | value
            #   last_player_row + 6 : 999 | "Competitors:" | value
            #   last_player_row + 7 : 999 | "Tees:"        | value
            #   last_player_row + 8 : 999 | "URL:"         | value
            last_player_row = 1 + n_rows   # 1-based Excel row of last player

            for gap in (1, 2):
                new_ws.range((last_player_row + gap, 1)).value = 999

            meta_items = [
                ("Competition:", comp_name),
                ("RTSF Weight:", weight),
                ("Date:",        comp_date),
                ("Competitors:", competitors),
                ("Tees:",        tees),
                ("URL:",         url),
            ]
            for offset, (label, value) in enumerate(meta_items):
                row_i = last_player_row + 3 + offset
                new_ws.range((row_i, 1)).value = 999
                lbl = new_ws.range((row_i, 2))
                lbl.value = label
                lbl.font.bold = True
                new_ws.range((row_i, 3)).value = value

            # Autofit col C again to fit metadata values
            new_ws.range("C:C").api.EntireColumn.AutoFit()

            # ── Main version: save with metadata ─────────────────────────────
            new_wb.save(main_path)

            created += 1
            print(f"  Results: {file_stem}.xlsx + Clean")

        finally:
            new_wb.api.Close(SaveChanges=False)

    print(f"  Results files: {created} created, {skipped} skipped.")


def _fill_missing_player_ids(RTSF_book: xw.Book):
    """
    For each player in Player_Alpha_List (Inputs col M) whose ID cell (col N)
    is blank, scan all competition worksheets for a row whose Player Name
    matches and read the Player ID from that row (col C of the table, index 2).

    Writes any found IDs back to the Inputs tab and saves.  This lets --score
    pick up IDs for newly-added players without requiring a Playwright login.
    """
    ws           = RTSF_book.sheets["Inputs"]
    player_start = ws.range("M5")

    # Collect rows with blank IDs: {row_offset: normalised_name}
    blanks: dict[int, str] = {}
    row = 0
    while True:
        name = player_start.offset(row, 0).value
        if name is None:
            break
        pid = player_start.offset(row, 1).value
        if pid is None or str(pid).strip() == "":
            blanks[row] = str(name).strip().lower()
        row += 1

    if not blanks:
        return

    print(f"  Filling IDs for {len(blanks)} player(s) with blank IDs from competition sheets...")

    # Build {normalised_name: player_id} by scanning all competition sheets
    skip = {"Inputs", "Tournament Scores", "Knockout Competitions",
            "HTML_Debug", "Leaderboard"}
    name_to_id: dict[str, int] = {}
    for comp_ws in RTSF_book.sheets:
        if comp_ws.name in skip:
            continue
        if comp_ws.name.startswith("LeaderBoard "):
            continue
        if not comp_ws.tables:
            continue
        tbl = comp_ws.tables[0]
        if tbl.data_body_range is None:
            continue
        raw = tbl.data_body_range.value
        if not raw:
            continue
        if not isinstance(raw[0], list):
            raw = [raw]
        for tbl_row in raw:
            name_val = tbl_row[1]   # col B = Player Name (index 1)
            pid_val  = tbl_row[2]   # col C = Player ID   (index 2)
            if name_val is None or pid_val is None:
                continue
            try:
                pid_int = int(pid_val)
            except (TypeError, ValueError):
                continue
            name_to_id[str(name_val).strip().lower()] = pid_int

    updated = 0
    for row_offset, norm_name in blanks.items():
        pid = name_to_id.get(norm_name)
        if pid:
            player_start.offset(row_offset, 1).value = pid
            print(f"    '{player_start.offset(row_offset, 0).value}' → ID {pid}")
            updated += 1
        else:
            print(f"    No match found for '{player_start.offset(row_offset, 0).value}'")

    if updated:
        RTSF_book.save()
    print(f"  Player IDs filled: {updated} of {len(blanks)}")


def calc_rtsf_scores(RTSF_book: xw.Book):
    """
    Orchestrator for RTSF score calculation.  Equivalent to the VBA RTSFSummary
    macro.

    Steps:
      1.  Sort worksheet tabs (competition tabs newest-first, special sheets last).
      1b. Fill any blank Player IDs in Player_Alpha_List from competition sheets.
      2.  Read Player_Alpha_List from the Inputs tab (preserving gender from
          Tournament Scores).
      3.  Refresh the player rows (A–C, rows 5+) in 'Tournament Scores'.
      4.  Read the Tournament_List from Inputs to get all competitions that
          have a corresponding worksheet.
      5.  Rebuild the competition columns in Tournament Scores (col E onwards,
          newest-first = T1), plus fixed Knockouts and Trophies columns.
      6.  Populate per-player RTSF scores in each competition column
          (×weight, Date Joined filter applied).
      7.  Read match play scores from the 'Knockout Competitions' sheet.
      8.  Aggregate scores per player: best-N per weight band + all match play.
      9.  Write Knockout / Trophy totals and final RTSF Score (col D).
     10.  Format col D (RTSF Score): number format "#,##0".
     11.  Write the RTSFComponents diagnostic block.
     12.  Save the workbook.
    """
    print("\n--- RTSF Score Calculation ---")

    RTSF_book.app.screen_updating = False
    RTSF_book.app.calculation     = "manual"

    try:
        ts_ws = RTSF_book.sheets["Tournament Scores"]
    except Exception:
        print("  ERROR: 'Tournament Scores' sheet not found in workbook.")
        RTSF_book.app.screen_updating = True
        RTSF_book.app.calculation     = "automatic"
        return

    try:
        _sort_worksheet_tabs(RTSF_book)
        _fill_missing_player_ids(RTSF_book)

        players = _read_player_alpha_list(RTSF_book)
        comps   = _read_tournament_list_for_scoring(RTSF_book)
        print(f"  {len(players)} players, {len(comps)} competitions.")

        # Clear everything from col E (competition columns) rightwards and from
        # row 1 downwards before rewriting.  This prevents stale data from a
        # previous run (different comp count, removed competitions, player list
        # changes) from surviving into the new output.
        # 16384 is the last column in Excel, ensuring the Component Aggregates
        # and RTSFComponents blocks are fully cleared regardless of comp count.
        ts_ws.range((1, 5), (4 + len(players) + 5, 16384)).clear()
        print("  Cleared previous Tournament Scores data.")

        _refresh_ts_players(ts_ws, players)
        col_map = _sync_ts_columns(ts_ws, comps)

        _populate_ts_scores(ts_ws, comps, players, RTSF_book, col_map)

        match_play = _read_match_play_scores(RTSF_book)

        components = _aggregate_rtsf_scores(ts_ws, players, comps, match_play, col_map)

        # Format the RTSF Score column (col D, rows 5+)
        n = len(players)
        if n:
            ts_ws.range((5, 4), (4 + n, 4)).number_format = "#,##0"

        # ── Sort player rows descending by RTSF Score (col D) ─────────────────
        # Read the entire data area (cols A–tr_col, rows 5+), sort in Python,
        # rewrite, and sort the components list to match so RTSFComponents is
        # written in the same order.
        tr_col = col_map["tr_col"]
        if n > 1:
            raw = ts_ws.range((5, 1), (4 + n, tr_col)).value
            # xlwings returns a flat list for a single row; wrap it
            if n == 1:
                raw = [raw]
            # Sort: descending RTSF Score (col D = index 3); players with no
            # score (None) sort to the bottom
            raw.sort(
                key=lambda r: (r[3] is None, -(r[3] or 0))
            )
            ts_ws.range((5, 1), (4 + n, tr_col)).value = raw
            # Re-align the components list to the new row order (match by name)
            name_to_comp = {c["player"]: c for c in components}
            sorted_components = []
            for row_idx, row in enumerate(raw):
                player_name = row[0]  # col A = name
                comp = name_to_comp.get(player_name)
                if comp:
                    comp = dict(comp)          # shallow copy
                    comp["ts_row"] = 5 + row_idx
                    sorted_components.append(comp)
            components = sorted_components

        _write_rtsf_components(ts_ws, components, col_map)

        # ── Write standalone Results XLSX files ───────────────────────────────
        _write_tscores_files(RTSF_book, comps, players)

        # ── Freeze panes at E5 (first player row, first competition column) ───
        try:
            RTSF_book.activate()
            ts_ws.activate()
            win = RTSF_book.app.api.ActiveWindow
            win.FreezePanes = False
            win.SplitRow    = 4   # freeze after row 4 → row 5 is first scrollable
            win.SplitColumn = 4   # freeze after col D → col E is first scrollable
            win.FreezePanes = True
            win.DisplayGridlines = False
        except Exception as e:
            print(f"  Warning: could not set freeze panes ({e})")

        RTSF_book.save()
        print("  Workbook saved.")

    finally:
        RTSF_book.app.calculation     = "automatic"
        RTSF_book.app.screen_updating = True

    print("--- RTSF Score Calculation complete ---\n")


if __name__ == "__main__":
    if "--rename" in sys.argv:
        _book = open_workbook()
        rename_competition_sheets(_book)
    elif "--merge" in sys.argv:
        _book = open_workbook()
        merge_competitions(_book)
    elif "--score" in sys.argv:
        _book = open_workbook()
        calc_rtsf_scores(_book)
    elif "--leaderboard" in sys.argv:
        _book = open_workbook()
        write_leaderboard(_book)
    else:
        main()
