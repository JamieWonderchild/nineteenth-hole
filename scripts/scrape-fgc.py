#!/usr/bin/env python3
"""
FGC Competition Scraper → The 19th Hole
=========================================
Scrapes finchleygolfclub.com and imports competition results and upcoming
fixtures into The 19th Hole platform via its import API.

The FGC website is behind Cloudflare, so we drive a real Chromium browser
(Playwright + playwright-stealth) — same approach as Alan's Excel script.
A visible browser window opens for login; you may need to solve a CAPTCHA.

Install dependencies (once, in a venv):
  pip install playwright playwright-stealth beautifulsoup4 requests
  playwright install chromium

Credentials — set as environment variables:
  export FGC_MEMBERID=your_member_id
  export FGC_PIN=your_pin

Usage:
  python scripts/scrape-fgc.py --token TOKEN [options]

Options:
  --token TOKEN           Import token (Manage → Settings → Import token)
  --api-url URL           Override API base URL (default: https://www.nineteenth.golf)
  --club-slug SLUG        Club slug (default: finchley-golf-club)
  --year YYYY             Season year (default: current year)
  --season-start DATE     Season start YYYY-MM-DD (overrides --year)
  --season-end DATE       Season end YYYY-MM-DD (overrides --year)
  --upcoming              Also create draft competitions for future fixtures
  --no-results            Skip past results; only import upcoming fixtures
  --since DATE            Skip competitions before YYYY-MM-DD
  --comp-id ID            Scrape a single competition by FGC comp ID only
  --limit N               Stop after N past results (for testing)
  --dry-run               Print payloads; do not POST to the API
"""

import argparse
import csv
import datetime
import json
import os
import re
import sys
from typing import Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
import requests
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

# ── URLs ──────────────────────────────────────────────────────────────────────

BASE_URL      = "https://www.finchleygolfclub.com"
LOGIN_URL     = f"{BASE_URL}/login.php"
COMP_LIST_URL = f"{BASE_URL}/competition2.php"
COMP_BASE_URL = f"{BASE_URL}/competition.php"

DEFAULT_API_URL   = "https://polite-cassowary-357.eu-west-1.convex.site"
DEFAULT_CLUB_SLUG = "finchley-golf-club"

# Competition names containing these keywords are always scored as Stableford
# even when the HTML table header says Nett/Gross.
STABLEFORD_NAMES = ["masters", "steve biggs", "stableford"]


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description="Scrape Finchley Golf Club → The 19th Hole import API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--token",        required=True,
                   help="Import token from Manage → Settings → Import token")
    p.add_argument("--api-url",      default=DEFAULT_API_URL,
                   help=f"API base URL (default: {DEFAULT_API_URL})")
    p.add_argument("--club-slug",    default=DEFAULT_CLUB_SLUG,
                   help=f"Club slug (default: {DEFAULT_CLUB_SLUG})")
    p.add_argument("--year",         type=int, default=datetime.date.today().year,
                   help="Season year (default: current year)")
    p.add_argument("--season-start", metavar="YYYY-MM-DD",
                   help="Season start date (overrides --year)")
    p.add_argument("--season-end",   metavar="YYYY-MM-DD",
                   help="Season end date (overrides --year)")
    p.add_argument("--upcoming",     action="store_true",
                   help="Also create draft competitions for future fixtures")
    p.add_argument("--no-results",   action="store_true",
                   help="Skip past results; only import upcoming fixtures")
    p.add_argument("--since",        metavar="YYYY-MM-DD",
                   help="Skip competitions before this date")
    p.add_argument("--comp-id",      metavar="ID",
                   help="Scrape and import a single competition by FGC comp ID")
    p.add_argument("--limit",        type=int, metavar="N",
                   help="Stop after N past results (for testing)")
    p.add_argument("--no-scorecards", action="store_true",
                   help="Skip per-player scorecard pages (faster, no hole data)")
    p.add_argument("--export-csv",   metavar="FILE",
                   help="Write results to a CSV file instead of (or in addition to) posting to the API")
    p.add_argument("--dry-run",      action="store_true",
                   help="Print payloads without POSTing to the API")
    return p.parse_args()


# ── Date utilities ─────────────────────────────────────────────────────────────

def parse_fgc_date(date_str: str, year_hint: int = None) -> Optional[datetime.date]:
    """
    Parse FGC date strings:
      "Saturday 14th June 2026"
      "Saturday 14th June 2026 - Sunday 15th June 2026"  → takes later date
      "14 Jun 2026"
    Returns None if unparseable.
    """
    if not date_str:
        return None

    # Two-day events: take the second (later) date
    if " - " in date_str:
        date_str = date_str.split(" - ", 1)[1].strip()

    # Remove ordinal suffixes: 1st→1, 22nd→22, etc.
    clean = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", date_str).strip()

    yr = year_hint or datetime.date.today().year

    for fmt in ("%A %d %B %Y", "%d %B %Y", "%A %d %B", "%d %B", "%d %b %Y", "%d %b"):
        try:
            d = datetime.datetime.strptime(clean, fmt)
            if d.year == 1900:
                d = d.replace(year=yr)
            return d.date()
        except ValueError:
            continue

    return None


# ── Entry fee detection ────────────────────────────────────────────────────────

def guess_entry_fee_pence(name: str, date: datetime.date) -> Optional[int]:
    """
    Return the entry fee in pence for FGC Walk-On Stablefords and Medals.
      Weekday (Mon–Fri): £3 → 300 pence
      Weekend (Sat–Sun): £5 → 500 pence
    Returns None for named trophies, knockouts, and majors (no standard entry fee).
    """
    category = guess_category(name)
    if category not in ("stableford", "medal"):
        return None
    is_weekend = date.weekday() >= 5  # 5 = Saturday, 6 = Sunday
    return 500 if is_weekend else 300


# ── Category detection ─────────────────────────────────────────────────────────

def guess_category(name: str) -> str:
    """
    Map an FGC competition name to a 19th Hole category:
      stableford | medal | trophy | knockout | major
    """
    lo = name.lower()
    def has(s): return s.lower() in lo

    if any(has(k) for k in ("knockout", "cansick", "cronshaw", "holmes")):
        return "knockout"
    if any(has(k) for k in ("stableford", "steve biggs", "walk on", "midweek")):
        return "stableford"
    if has("medal"):
        return "medal"
    if any(has(k) for k in ("dibben", "ward trophy", "captain", "president",
                             "tiger of the year", "fox of the year")):
        return "trophy"
    if any(has(k) for k in ("championship", "masters")):
        return "major"

    return "stableford"   # most common at FGC


# ── Playwright login ───────────────────────────────────────────────────────────

def playwright_login(page, member_id: str, pin: str) -> None:
    """
    Navigate to login page, fill credentials, and wait for successful redirect.
    The browser window must stay visible — Cloudflare may require a CAPTCHA.
    """
    print("Opening login page...")
    page.goto(LOGIN_URL)
    page.wait_for_selector("#memberid", timeout=30_000)
    page.fill("#memberid", member_id)
    page.fill("#pin", pin)

    print("Credentials filled.")
    print("Solve any Cloudflare CAPTCHA in the browser, then click Login.")
    print("Waiting up to 2 minutes for redirect...")

    page.wait_for_url(
        lambda url: "login.php" not in url,
        timeout=120_000,
    )
    print(f"Logged in → {page.url}")

    # Shrink browser to corner — must stay open for scraping but can be out of the way
    try:
        page.evaluate(
            "window.resizeTo(800, 600); "
            "window.moveTo(window.screen.width - 820, window.screen.height - 640);"
        )
    except Exception:
        pass


# ── Competition list ────────────────────────────────────────────────────────────

def fetch_competition_list(
    page,
    season_start: datetime.date,
    season_end: datetime.date,
) -> list[dict]:
    """
    Retrieve all competitions for the season by making bi-weekly POST requests
    to competition2.php?requestType=ajax inside the authenticated Playwright
    browser context (same approach as Alan's Excel script).

    Returns list of {id, name, date_str}.
    """
    post_url = f"{COMP_LIST_URL}?requestType=ajax&ajaxaction=compsfilter"

    seen_ids    = set()
    competitions = []

    cur_year    = season_start.year
    start_month = season_start.month
    end_month   = season_end.month

    # Loop months in reverse (newest first, matching VBA behaviour)
    for month in range(end_month, start_month - 1, -1):
        for period in (1, 2):   # period 1 = 15th–end-of-month, period 2 = 1st–14th
            if period == 1:
                from_date = f"15/{month:02d}/{cur_year}"
                if month == 12:
                    to_date = f"31/12/{cur_year}"
                else:
                    last_day = (datetime.date(cur_year, month + 1, 1) - datetime.timedelta(days=1)).day
                    to_date = f"{last_day:02d}/{month:02d}/{cur_year}"
            else:
                from_date = f"01/{month:02d}/{cur_year}"
                to_date   = f"14/{month:02d}/{cur_year}"

            body = (
                f"fromdate={from_date}&todate={to_date}"
                "&entrants=all&offset=0&all_loaded=0&loadmore=1"
                "&requestType=ajax&ajaxaction=compsfilter"
            )

            try:
                html = page.evaluate(
                    """async ({url, body}) => {
                        const r = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body
                        });
                        if (!r.ok) throw new Error('HTTP ' + r.status);
                        return r.text();
                    }""",
                    {"url": post_url, "body": body},
                )
            except Exception as exc:
                print(f"  Warning: fetch failed for {from_date}–{to_date}: {exc}")
                continue

            for comp in _parse_comp_list_response(html):
                if comp["id"] not in seen_ids:
                    seen_ids.add(comp["id"])
                    competitions.append(comp)

    print(f"Found {len(competitions)} competition(s) for the season.")
    return competitions


def _parse_comp_list_response(html_content: str) -> list[dict]:
    """
    Parse the JSON+HTML response from the competition list endpoint.
    Response is JSON with {html: "...escaped HTML..."}.
    Returns list of {id, name, date_str}.
    """
    seen = set()
    results = []

    # Unwrap JSON envelope
    try:
        payload = json.loads(html_content)
        raw = payload.get("html", "")
        raw = raw.replace('\\"', '"').replace("\\/", "/")
        raw = raw.replace("\\n", "\n").replace("\\r", "")
    except (json.JSONDecodeError, AttributeError):
        raw = html_content   # fall back to treating as plain HTML

    soup = BeautifulSoup(raw, "html.parser")

    for link in soup.find_all("a", href=True):
        m = re.search(r"competition\.php\?compid=(\d+)", link["href"])
        if not m:
            continue
        comp_id = m.group(1)
        if comp_id in seen:
            continue
        seen.add(comp_id)

        # Competition name from .comp-name sibling, or the link text itself
        name_tag  = link.find_next(class_="comp-name")
        comp_name = name_tag.get_text(strip=True) if name_tag else link.get_text(strip=True)
        comp_name = comp_name.replace("OPEN COMPETITION", "").strip()

        # Date from .comp-date sibling
        date_tag  = link.find_next(class_="comp-date")
        comp_date = date_tag.get_text(strip=True) if date_tag else ""

        if comp_name:
            results.append({"id": comp_id, "name": comp_name, "date_str": comp_date})

    return results


# ── Competition results scraping ────────────────────────────────────────────────

def scrape_competition(comp_id: str, page, year_hint: int = None, fetch_scorecards: bool = True) -> dict:
    """
    Fetch and parse a single competition results page.
    Automatically re-fetches with ?sort=0 if results are sorted by Gross
    instead of Nett (so leaderboard reflects Nett positions).
    When fetch_scorecards is True (default), navigates to each player's
    individual scorecard page to collect hole-by-hole data.
    """
    comp_url = f"{COMP_BASE_URL}?compid={comp_id}"
    page.goto(comp_url)
    page.wait_for_load_state("domcontentloaded")
    soup = BeautifulSoup(page.content(), "html.parser")

    comp = _parse_competition_page(soup, comp_url, year_hint=year_hint)

    # Re-fetch with sort=0 if Gross appears before Nett in the header
    table_el = soup.find("table", class_=lambda c: c and "table-striped" in c)
    if table_el:
        thead = table_el.find("thead")
        if thead:
            hdr       = thead.get_text()
            gross_pos = hdr.lower().find("gross")
            nett_pos  = hdr.lower().find("nett")
            if gross_pos != -1 and (nett_pos == -1 or gross_pos < nett_pos):
                sort_url = comp_url + "&sort=0"
                page.goto(sort_url)
                page.wait_for_load_state("domcontentloaded")
                soup = BeautifulSoup(page.content(), "html.parser")
                comp = _parse_competition_page(soup, sort_url, year_hint=year_hint)

    # Fetch individual scorecards
    if fetch_scorecards:
        players_with_url = [p for p in comp["players"] if p.get("scorecard_url")]
        if players_with_url:
            print(f"  Fetching {len(players_with_url)} scorecards…", end="", flush=True)
            ok = 0
            parsed_date = parse_fgc_date(comp["date"], year_hint=year_hint)
            comp_date_str = str(parsed_date) if parsed_date else None
            for player in players_with_url:
                try:
                    holes, whs_handicap = scrape_scorecard(
                        player["scorecard_url"], page,
                        comp_id=comp_id, comp_date=comp_date_str,
                    )
                    if holes:
                        player["holes"] = holes
                        ok += 1
                    if whs_handicap is not None:
                        player["whs_handicap"] = whs_handicap
                except Exception as exc:
                    print(f"\n    Warning: scorecard failed for {player['name']}: {exc}")
            print(f" {ok}/{len(players_with_url)} ok")

    return comp


def _parse_competition_page(soup: BeautifulSoup, comp_url: str,
                              year_hint: int = None) -> dict:
    """
    Extract structured data from a competition results page.
    Handles three table layouts:
      class="global table table-striped"      → standard Stableford / Stroke Play
      class="resultstable table table-striped" → two-round aggregate (Captain's Prize etc.)
      class="table table-striped"             → Singles Bogey / fallback
    """
    result = {
        "name":         "Finchley Golf Club Competition",
        "date":         "",
        "scoring":      "Stableford",
        "url":          comp_url,
        "player_count": 0,
        "players":      [],
    }

    # ── Name and date from div.global > h3 / h4 ──────────────────────────────
    global_div = soup.find("div", class_="global")
    if global_div:
        h3 = global_div.find("h3")
        if h3:
            result["name"] = h3.get_text(strip=True)

        h4 = global_div.find("h4")
        if h4:
            # Replace <br> with comma so date and tees are comma-separated
            raw      = re.sub(r"<br\s*/?>", ", ", str(h4), flags=re.IGNORECASE)
            dt_str   = BeautifulSoup(raw, "html.parser").get_text(strip=True)
            date_part = dt_str.split(", ", 1)[0].strip() if ", " in dt_str else dt_str.strip()

            # Two-day events: "Sat 14th June - Sun 15th June" → take later date
            if " - " in date_part:
                date_part = date_part.split(" - ", 1)[1].strip()

            # If first token isn't a day name or digit, h4 is tees not a date.
            # Fall back to finding the date in the "Aggregate of ..." <p> tag.
            day_names = {"monday","tuesday","wednesday","thursday","friday","saturday","sunday"}
            first = date_part.split()[0].lower().rstrip(",") if date_part else ""
            if first and first not in day_names and not first[0].isdigit():
                date_part = ""
                for p in global_div.find_all("p"):
                    p_text = p.get_text(strip=True)
                    if not re.match(r"Aggregate of", p_text, re.IGNORECASE):
                        continue
                    date_hits = re.findall(r"\((\d{1,2}(?:st|nd|rd|th)\s+\w+)\)", p_text)
                    if date_hits:
                        yr = year_hint or datetime.date.today().year
                        latest = None
                        for ds in date_hits:
                            clean_ds = re.sub(r"(st|nd|rd|th)", "", ds)
                            for fmt in ("%d %b %Y", "%d %B %Y"):
                                try:
                                    d = datetime.datetime.strptime(f"{clean_ds.strip()} {yr}", fmt)
                                    if latest is None or d > latest:
                                        latest = d
                                    break
                                except ValueError:
                                    continue
                        if latest:
                            suffix = re.search(r"\d+(st|nd|rd|th)", date_hits[-1])
                            sfx    = suffix.group(1) if suffix else "th"
                            date_part = (latest.strftime("%A ")
                                         + str(latest.day) + sfx
                                         + latest.strftime(" %B %Y"))
                    break

            result["date"] = date_part

    # ── Locate results table ──────────────────────────────────────────────────
    is_results_table = False   # True for two-round "resultstable" layout
    two_rounds       = False   # True when player IDs are missing (need fallback)

    table = soup.find("table", class_=lambda c: c and "global" in c and "table-striped" in c)
    if table is None:
        table = soup.find("table", class_=lambda c: c and "resultstable" in c and "table-striped" in c)
        if table:
            is_results_table = True
            two_rounds       = True
    if table is None:
        table = soup.find("table", class_=lambda c: c and "table-striped" in c)
    if table is None:
        # Last-resort: any table with a results-like header row
        for t in soup.find_all("table"):
            rows = t.find_all("tr")
            if len(rows) > 2:
                hdr = rows[0].get_text().lower()
                if "position" in hdr or "results" in hdr:
                    table = t
                    break

    if table is None:
        return result

    # ── Detect scoring format ─────────────────────────────────────────────────
    thead = table.find("thead")
    if thead:
        hdr_text = thead.get_text()
        if re.search(r"nett|gross", hdr_text, re.IGNORECASE):
            forced = any(kw in result["name"].lower() for kw in STABLEFORD_NAMES)
            result["scoring"] = "Stableford" if forced else "Stroke Play"

    # ── Parse player rows ─────────────────────────────────────────────────────
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

        # Position — strip ordinal suffixes and tied-place "="
        pos_text = cells[0].get_text(strip=True)
        position = re.sub(r"(st|nd|rd|th|=)", "", pos_text).strip()
        if position in ("WD", "DQ", ""):
            continue

        try:
            pos_int = int(position)
        except ValueError:
            continue   # not a numeric position

        # ── Name cell ────────────────────────────────────────────────────────
        # Two-round tables insert a photo column so name is at td[3], not td[1]
        name_cell = (row.find("td", class_="namecol")
                     or row.find("td", class_="playername"))
        if name_cell is None:
            name_col  = 3 if is_results_table else 1
            if len(cells) <= name_col:
                continue
            name_cell = cells[name_col]

        cell_text = name_cell.get_text(strip=True)

        # Handicap is bracketed after the name: "J Smith (14)"
        if "(" in cell_text:
            player_name = cell_text[: cell_text.rfind("(")].strip()
            hcap_raw    = cell_text[cell_text.rfind("(") + 1:]
            handicap    = hcap_raw.split(")")[0].strip()
        else:
            player_name = cell_text
            handicap    = ""

        # ── Player ID from playerid= in href ─────────────────────────────────
        player_id = ""
        for search_cell in [name_cell] + ([cells[1]] if len(cells) > 1 else []):
            link = search_cell.find("a", href=True)
            if link:
                m = re.search(r"playerid=(\d+)", link["href"])
                if m:
                    player_id = m.group(1)
                    break

        if not player_id:
            two_rounds = True   # flag so we use the right points column below

        # ── Points column ─────────────────────────────────────────────────────
        # Standard:     td[2]
        # Two-round:    td[5]
        # resultstable: td[6]
        if is_results_table:
            points_col = 6
        elif two_rounds:
            points_col = 5
        else:
            points_col = 2

        points        = ""
        countback     = ""
        scorecard_url = ""
        if len(cells) > points_col:
            pts_cell = cells[points_col]
            pts_link = pts_cell.find("a") if not is_results_table and not two_rounds else None
            points   = (pts_link or pts_cell).get_text(strip=True)
            countback = (pts_link or pts_cell).get("title", "") or ""
            if pts_link:
                href = pts_link.get("href", "")
                scorecard_url = urljoin(comp_url, href) if href else ""

            # For resultstable the aggregate cell has no title; check previous round
            if is_results_table and not countback and points_col >= 1:
                prev     = cells[points_col - 1]
                prev_lnk = prev.find("a")
                countback = (prev_lnk or prev).get("title", "") or ""

        result["players"].append({
            "position":     pos_int,
            "name":         player_name,
            "handicap":     handicap,
            "player_id":    player_id,
            "points":       points,
            "countback":    countback,
            "scorecard_url": scorecard_url,
        })

    return result


# ── Scorecard scraping (2-step: roundmgmt → viewround) ───────────────────────────

def _extract_whs_handicap(soup: BeautifulSoup) -> Optional[float]:
    """Pull the WHS Handicap Index from a roundmgmt.php page."""
    for tag in soup.find_all(string=re.compile(r"Handicap Index", re.I)):
        m = re.search(r"Handicap Index[:\s]+([0-9.]+)", str(tag), re.I)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                pass
    return None


def _find_viewround_url(soup: BeautifulSoup, comp_id: str = None,
                        comp_date: str = None) -> Optional[str]:
    """
    From a roundmgmt.php page, find the viewround.php href for the round
    that matches comp_id (preferred) or comp_date (fallback).

    The round history table has columns: Competition | Date | Course | Gross | Nett | Sford
    Each row has two links:
      - competition name link  → competition.php?compid=XXXX
      - gross score link       → viewround.php?roundid=YYYY   ← this is what we want
    """
    target_table = None
    for table in soup.find_all("table"):
        hdr = table.find("tr")
        if hdr and "Gross" in hdr.get_text():
            target_table = table
            break
    if not target_table:
        return None

    for row in target_table.find_all("tr")[1:]:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue

        row_links = {a["href"]: a.get_text(strip=True) for a in row.find_all("a", href=True)}

        matched = False
        if comp_id:
            if f"competition.php?compid={comp_id}" in row_links:
                matched = True
        if not matched and comp_date:
            date_text = cells[1].get_text(strip=True) if len(cells) > 1 else ""
            parsed = parse_fgc_date(date_text)
            if parsed and str(parsed) == comp_date:
                matched = True

        if matched:
            for href in row_links:
                if href.startswith("viewround.php"):
                    return href
    return None


def _parse_viewround(soup: BeautifulSoup) -> list[dict]:
    """
    Parse the TRANSPOSED scorecard on viewround.php.

    Layout — rows are stat types, columns are holes:
      Row "Hole":       1   2   3  …  9   OUT  10  11  …  18   IN  TOTAL
      Row "Yards":      …
      Row "SI":         …
      Row "Par":        …
      Row "Score":      …  (cells may carry colour classes for eagle/birdie etc.)
      Row "Stableford": …

    Returns list of {hole, par, si, gross, points} for holes 1–18.
    """
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 4:
            continue

        # Find the row where first cell is "Hole" (may not be rows[0] —
        # some pages have a player/course header above the scorecard)
        hole_row_idx = None
        for ri, row in enumerate(rows):
            cells = row.find_all(["th", "td"])
            if cells and cells[0].get_text(strip=True).lower() == "hole":
                hole_row_idx = ri
                break
        if hole_row_idx is None:
            continue

        # Map hole number → column index from the Hole header row
        hole_row_cells = rows[hole_row_idx].find_all(["th", "td"])
        hole_cols: dict[int, int] = {}
        for i, cell in enumerate(hole_row_cells):
            if i == 0:
                continue
            try:
                h = int(cell.get_text(strip=True))
                if 1 <= h <= 18:
                    hole_cols[h] = i
            except ValueError:
                pass  # OUT, IN, TOTAL — skip

        if len(hole_cols) < 9:
            continue  # not a scorecard table

        # Collect each named stat row: label → {col_idx: text}
        row_data: dict[str, dict[int, str]] = {}
        for row in rows[hole_row_idx + 1:]:
            cells = row.find_all(["th", "td"])
            if not cells:
                continue
            label = cells[0].get_text(strip=True).lower()
            if label in ("si", "par", "score", "stableford", "yards"):
                row_data[label] = {i: cells[i].get_text(strip=True)
                                   for i in range(1, len(cells))}

        def get_int(label: str, col: int) -> int:
            val = row_data.get(label, {}).get(col, "")
            m = re.match(r"(\d+)", str(val).strip())
            return int(m.group(1)) if m else 0

        holes = []
        for h in range(1, 19):
            ci = hole_cols.get(h)
            if ci is None:
                continue
            holes.append({
                "hole":   h,
                "par":    get_int("par", ci),
                "si":     get_int("si", ci),
                "gross":  get_int("score", ci),
                "points": get_int("stableford", ci),
            })

        if len(holes) >= 9:
            return holes

    return []


def scrape_scorecard(scorecard_url: str, page,
                     comp_id: str = None,
                     comp_date: str = None) -> tuple[list[dict], Optional[float]]:
    """
    Navigate to the scorecard URL (viewround.php?roundid=XXXX) and parse
    the 18-hole transposed table.

    Returns (holes, whs_handicap).
    whs_handicap is always None here — the FGC competition page links directly
    to viewround, not to roundmgmt, so there is no WHS handicap on this page.
    holes is [] if the page cannot be parsed.
    """
    full_url = (scorecard_url if scorecard_url.startswith("http")
                else urljoin(BASE_URL + "/", scorecard_url.lstrip("/")))
    page.goto(full_url)
    page.wait_for_load_state("domcontentloaded")
    holes = _parse_viewround(BeautifulSoup(page.content(), "html.parser"))
    return holes, None


# ── CSV export ──────────────────────────────────────────────────────────────────

CSV_COLUMNS = [
    "fgc_comp_id", "competition", "date", "category",
    "player_id", "player_name",
    "position", "score", "handicap", "whs_handicap",
    "gross_total",
    "h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8", "h9",
    "h10", "h11", "h12", "h13", "h14", "h15", "h16", "h17", "h18",
]

def write_csv_rows(comp: dict, comp_id: str, writer: "csv.DictWriter",
                   year_hint: int = None) -> int:
    """Append one row per player to an open CSV writer. Returns rows written."""
    parsed_date = parse_fgc_date(comp["date"], year_hint=year_hint)
    if not parsed_date:
        return 0

    category = guess_category(comp["name"])
    rows_written = 0

    for p in comp["players"]:
        holes_by_num: dict[int, int] = {}
        gross_total = 0
        if p.get("holes"):
            for h in p["holes"]:
                holes_by_num[h["hole"]] = h["gross"]
                gross_total += h["gross"]

        row = {
            "fgc_comp_id":  comp_id,
            "competition":  comp["name"],
            "date":         str(parsed_date),
            "category":     category,
            "player_id":    p.get("player_id", ""),
            "player_name":  p["name"],
            "position":     p["position"],
            "score":        p.get("points", ""),
            "handicap":     p.get("handicap", ""),
            "whs_handicap": p.get("whs_handicap", ""),
            "gross_total":  gross_total if gross_total else "",
        }
        for h in range(1, 19):
            row[f"h{h}"] = holes_by_num.get(h, "")

        writer.writerow(row)
        rows_written += 1

    return rows_written


# ── API posting ─────────────────────────────────────────────────────────────────

def post_results(comp: dict, comp_id: str, args) -> None:
    """POST competition results to /api/import-results."""
    if not comp["players"]:
        print("  No players found — skipping.")
        return

    parsed_date = parse_fgc_date(comp["date"], year_hint=args.year)
    if not parsed_date:
        print(f"  Could not parse date '{comp['date']}' — skipping.")
        return

    def _safe_handicap(val: str) -> Optional[float]:
        try:
            return float(val) if val and val.strip() else None
        except (ValueError, TypeError):
            return None

    results = []
    for p in comp["players"]:
        # Prefer WHS Handicap Index (from individual roundmgmt page) over the
        # playing handicap shown on the competition results page — it's more accurate.
        best_handicap = (
            p["whs_handicap"]
            if p.get("whs_handicap") is not None
            else _safe_handicap(p.get("handicap", ""))
        )
        entry: dict = {
            "position": p["position"],
            "name":     p["name"],
        }
        if p.get("player_id"):
            entry["memberId"] = p["player_id"]
        if p.get("points"):
            entry["score"] = p["points"]
        if best_handicap is not None:
            entry["handicap"] = best_handicap
        if p.get("holes"):
            entry["holes"] = p["holes"]
        results.append(entry)

    entry_fee = guess_entry_fee_pence(comp["name"], parsed_date)

    payload = {
        "clubSlug":        args.club_slug,
        "competitionName": comp["name"],
        "competitionDate": str(parsed_date),
        "category":        guess_category(comp["name"]),
        "fgcCompId":       comp_id,
        "results":         results,
        **({"entryFee": entry_fee} if entry_fee is not None else {}),
    }

    if args.dry_run:
        print(f"  [DRY RUN] POST /api/import-results")
        print(f"  {json.dumps(payload, indent=2)}")
        return

    try:
        resp = requests.post(
            f"{args.api_url}/api/import-results",
            json=payload,
            headers={"Authorization": f"Bearer {args.token}"},
            timeout=30,
        )
        data = resp.json()
        if resp.status_code == 200:
            print(f"  ✓ {data.get('entriesCreated', 0)} created, "
                  f"{data.get('entriesUpdated', 0)} updated "
                  f"(series: {data.get('linkedSeries') or 'none'})")
        else:
            print(f"  ✗ Error {resp.status_code}: {data}")
    except Exception as exc:
        print(f"  ✗ Request failed: {exc}")


def post_fixtures(upcoming: list[tuple], args) -> None:
    """POST upcoming fixtures in a single batch to /api/import-fixtures."""
    if not upcoming:
        return

    fixtures = [
        {
            "name":      comp_meta["name"],
            "date":      str(comp_date),
            "category":  guess_category(comp_meta["name"]),
            "fgcCompId": comp_meta["id"],
        }
        for comp_meta, comp_date in upcoming
    ]

    payload = {
        "clubSlug": args.club_slug,
        "fixtures": fixtures,
    }

    if args.dry_run:
        print(f"\n[DRY RUN] POST /api/import-fixtures ({len(fixtures)} fixtures)")
        for f in fixtures:
            print(f"  {f['name']} — {f['date']} ({f['category']})")
        return

    try:
        resp = requests.post(
            f"{args.api_url}/api/import-fixtures",
            json=payload,
            headers={"Authorization": f"Bearer {args.token}"},
            timeout=30,
        )
        data = resp.json()
        if resp.status_code == 200:
            print(f"  ✓ {data.get('created', 0)} created, "
                  f"{data.get('skipped', 0)} already existed")
        else:
            print(f"  ✗ Error {resp.status_code}: {data}")
    except Exception as exc:
        print(f"  ✗ Request failed: {exc}")


# ── Main ─────────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    # Resolve season date range
    year = args.year
    season_start = (
        datetime.date.fromisoformat(args.season_start)
        if args.season_start
        else datetime.date(year, 1, 1)
    )
    season_end = (
        datetime.date.fromisoformat(args.season_end)
        if args.season_end
        else datetime.date(year, 12, 31)
    )

    since = datetime.date.fromisoformat(args.since) if args.since else None
    today = datetime.date.today()

    member_id = os.environ.get("FGC_MEMBERID", "")
    pin       = os.environ.get("FGC_PIN", "")

    if not member_id or not pin:
        print("ERROR: Set your credentials as environment variables:")
        print("  export FGC_MEMBERID=your_member_id")
        print("  export FGC_PIN=your_pin")
        sys.exit(1)

    print("=" * 60)
    print("FGC → The 19th Hole Importer")
    print("=" * 60)
    print(f"Season:    {season_start} → {season_end}")
    print(f"API:       {args.api_url}")
    print(f"Club slug: {args.club_slug}")
    if args.dry_run:
        print("DRY RUN — no changes will be made to the API")
    if args.export_csv:
        print(f"CSV export: {args.export_csv}")
    print()

    # Open CSV file if requested (append so multiple runs can accumulate)
    csv_file   = None
    csv_writer = None
    if args.export_csv:
        csv_file   = open(args.export_csv, "w", newline="", encoding="utf-8")
        csv_writer = csv.DictWriter(csv_file, fieldnames=CSV_COLUMNS,
                                    extrasaction="ignore")
        csv_writer.writeheader()

    def handle_comp(comp: dict, comp_id: str) -> None:
        """Write CSV rows (if requested) and post to API (respects --dry-run)."""
        if csv_writer:
            n = write_csv_rows(comp, comp_id, csv_writer, year_hint=year)
            if csv_file:
                csv_file.flush()
            print(f"  → {n} row(s) written to CSV")
        post_results(comp, comp_id, args)  # post_results handles --dry-run internally

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page    = browser.new_page()
        Stealth().apply_stealth_sync(page)

        try:
            playwright_login(page, member_id, pin)
        except Exception as exc:
            print(f"\nLogin failed: {exc}")
            browser.close()
            if csv_file:
                csv_file.close()
            sys.exit(1)

        # ── Single competition mode ───────────────────────────────────────────
        if args.comp_id:
            print(f"\nScraping competition ID {args.comp_id}...")
            try:
                comp = scrape_competition(args.comp_id, page, year_hint=year,
                                          fetch_scorecards=not args.no_scorecards)
                print(f"  {comp['name']} — {comp['date']} — {comp['player_count']} players")
                handle_comp(comp, args.comp_id)
            except Exception as exc:
                print(f"  ERROR: {exc}")
            browser.close()
            if csv_file:
                csv_file.close()
            return

        # ── Fetch full season competition list ────────────────────────────────
        print("\nFetching competition list...")
        competitions = fetch_competition_list(page, season_start, season_end)

        if not competitions:
            print("No competitions found for the given date range.")
            browser.close()
            if csv_file:
                csv_file.close()
            return

        # Split into past and upcoming based on parsed dates
        past     = []
        upcoming = []

        for comp_meta in competitions:
            comp_date = parse_fgc_date(comp_meta["date_str"], year_hint=year)
            if comp_date is None:
                print(f"  Skipping (unparseable date): {comp_meta['name']} — '{comp_meta['date_str']}'")
                continue
            if since and comp_date < since:
                continue
            if comp_date <= today:
                past.append((comp_meta, comp_date))
            else:
                upcoming.append((comp_meta, comp_date))

        print(f"\nPast competitions:  {len(past)}")
        print(f"Upcoming fixtures:  {len(upcoming)}")

        # ── Import past results ───────────────────────────────────────────────
        if not args.no_results and past:
            print(f"\n{'─' * 50}")
            print(f"Importing past results ({len(past)} competitions)")
            print(f"{'─' * 50}")

            count = 0
            for comp_meta, comp_date in past:
                if args.limit and count >= args.limit:
                    print(f"\nReached --limit {args.limit}, stopping.")
                    break

                count += 1
                print(f"\n[{count}/{len(past)}] {comp_meta['name']}  ({comp_date})  id={comp_meta['id']}")

                try:
                    comp = scrape_competition(comp_meta["id"], page, year_hint=year,
                                              fetch_scorecards=not args.no_scorecards)
                    print(f"  Scraped: {comp['player_count']} players, format={comp['scoring']}")
                    handle_comp(comp, comp_meta["id"])
                except Exception as exc:
                    print(f"  ERROR: {exc}")
                    continue

        # ── Import upcoming fixtures ──────────────────────────────────────────
        if args.upcoming and upcoming:
            print(f"\n{'─' * 50}")
            print(f"Importing upcoming fixtures ({len(upcoming)} competitions)")
            print(f"{'─' * 50}")
            post_fixtures(upcoming, args)

        browser.close()

    if csv_file:
        csv_file.close()
        print(f"\nCSV saved → {args.export_csv}")

    print("\nDone.")


if __name__ == "__main__":
    main()
