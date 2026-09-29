# Hockey Dashboard

Hockey Dashboard is a browser-first draft aid for hockey pool management.

## What it is
- A static HTML/CSS/JavaScript app
- A local-first dashboard for importing league CSV snapshots
- A draft-day workspace for checking availability, ownership, player context, and data trust

Design notes
- Header-first detection: the app reads the CSV header (first non-empty line) and matches tokens to identify dataset type. No parser trial-and-error is performed.
- Detection rules:
  - Prospects: header contains "TERM REMAINING", "MATCHING RIGHTS", or YR1/YR2/YR3 tokens
  - Veterans: header contains multiple year columns (e.g., 2022, 2023, 2024)
  - Roster: generic player rows parsed by rosterParser.js
- If detection is ambiguous the user is prompted to pick the dataset type.
- Once identified, exactly one parser is invoked:
  - parseProspects(csvText) — for prospects
  - parseVeterans(csvText)  — for veterans
  - parseRoster(csvText) — rosterParser.js is imported as a module
  - transaction logs and live draft boards are maintained in Google Sheets and are not imported into the dashboard

## What it is not
- Not a backend app
- Not a live-sync league manager
- Not dependent on live NHL API access to function

## Core draft workflow
Use the app to answer four questions:
1. Who is available?
2. Who owns what?
3. What is this player’s draft value/context?
4. Can I trust this data right now?

## How to launch locally
1. Open the repository root on your machine.
2. Start a static server from the project root (the folder containing `index.html`).
3. Open the served URL in your browser.

Example:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

## How to access away from your desktop
- **Hosted access:** enable GitHub Pages for this repository and use the published URL on laptop or phone.
- **Portable access:** use **Export State** before leaving your main machine, then **Import Saved State** on another browser or laptop.
- **Phone use:** the draft board, insights, and winning-bid form are available in the responsive dashboard.

## Data you need
To work reliably, the app expects current CSV snapshots for any of these datasets:
- Prospects
- Veterans
- Roster

## AHL Sheets ingestion
- The Google AHL Draft workbook is the only authority for player pool, AHL Position, Utility eligibility, ownership, retention, keeper costs, and draft state. Its Position, Utility, Draft, Roster, and Keeper Rights tabs are refreshed together.
- The AHL Scores workbook is refreshed with its Scores, Scorebulator, and Games Played tabs. These tabs are retained as raw AHL score data; team standings and schedule rows are not treated as player projections.
- The prior-year OneDrive roster example and separate house-budget workbook are not ingested.
- The dashboard loads all configured AHL tabs on page startup and **Refresh AHL Sheets** repeats the load. A failed or empty tab stops the refresh and surfaces an error instead of marking the source loaded.
- GitHub Pages is static and cannot overwrite files in `data/`. A successful browser refresh updates the five Draft Intelligence JSON views in memory; **Export generated Draft Intelligence JSON** downloads those five named JSON outputs in a local bundle.

## Draft Intelligence data
- The dashboard exposes Draft Board, Best Available, Team Budgets, Personal Draft List, and Tools & Validation.
- Team Budgets and roster validation use the AHL Draft sheet's team balances and open slots; local working assignments subtract their bid and consume one slot. Missing sheet balances remain unavailable and are never replaced with a fixed-cap estimate.
- Run `node scripts/generate-draft-intelligence.mjs <nhl-skater-stats.csv> [normalized-source-metrics.json]` from this directory to refresh those outputs from the current Google Sheets, a provided NHL skater-stat snapshot, and optional normalized source metrics.
- Supplemental metrics remain keyed by player ID under `players`; component inputs must be normalized 0–1. Source flags are limited to `AHLSheets` and `DobberExcel`, and may be true only after that source is ingested.
- AHL Position is used for pool position and filters; Utility supplies multi-position eligibility. NHL Position is a separate field sourced only from the Dobber Excel sheet. That file has not yet been provided, and the live AHL Scores tabs currently contain team schedules/standings rather than player-level score inputs, so unsupported positions, DraftIQ scores, and auction values remain null and players remain UNPRICED.
- DraftIQ uses `0.45*PPS + 0.20*RSS + 0.15*BPS - 0.10*RRS + 0.10*KVS`, clamped to 0–100. `VALUE` requires price above its band midpoint and RRS `<=33`; `RISK` requires price above midpoint plus RRS `>=67`, usage-decline `>=0.67`, or aging-risk `>=0.67`; `FAIR` is within 10% of band width (minimum $0.50) of midpoint when no high-risk signal applies. Band midpoints are $50, $32, $17, $7, and $2.50 for tiers 1–5. Outputs remain `UNPRICED` when required scores or auction inputs are missing.
- Shortlists are stored in browser local storage. Winning bids are recorded as local Working Assignments and update availability and team budget calculations immediately; the Google Sheets remain the operational source of truth.
- Personal Draft List ranks and notes are stored only in browser local storage and can be exported locally as JSON.

## Source-of-truth rules
- AHL Google Sheets are authoritative for ownership, availability, AHL positions, budgets, keeper costs, rookie/farm eligibility, and draft state.
- Dobber Excel is a supplemental NHL-position source only; it does not override AHL pool positions or eligibility.
- Cached, imported, and historical data must not override current AHL Sheet draft data.
- Browser `localStorage` is convenience state, not the only backup path.

## Portable state workflow
- Click **Export State** to download your saved dashboard state.
- Move that JSON file to another device.
- Click **Import Saved State** to restore the same working view elsewhere.

Transaction logs and live draft boards are not player snapshots and should not be uploaded here. Import the Prospects, Veterans, or Roster CSV tab used by the dashboard.

## Hosted deployment
A GitHub Pages workflow is included in `.github/workflows/pages.yml`.
It publishes the static dashboard files without adding a backend.

## Active docs
- `README.md`
- `DRAFT_DAY_RUNBOOK.md`
- `PRODUCT_SCOPE.md`
- `TECHNICAL_NOTES.md`

Older planning and status docs are preserved in `docs/archive/`.
