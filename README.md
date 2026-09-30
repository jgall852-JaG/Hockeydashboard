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
1. Install Node.js and run `Start-Hockeydashboard.cmd` from the folder containing `index.html`; keep the launcher running.
2. Open `http://127.0.0.1:3000/index.html` on that computer. On another device on the same network, use the host's LAN IPv4 address instead of `127.0.0.1`.
3. Follow [Hockeydashboard_Access.md](./Hockeydashboard_Access.md) for the manual Dobber uploads and cross-device setup.

## How to access away from your desktop
- **Hosted access:** enable GitHub Pages for this repository and use the published URL on laptop or phone.
- **Portable access:** use **Export State** before leaving your main machine, then **Import Saved State** on another browser or laptop.
- **Phone use:** the draft board, insights, and winning-bid form are available in the responsive dashboard.
- **Installable/offline use:** open the HTTPS Pages URL once while online, allow the offline app cache to finish, then use **Install Dashboard** or the browser's install/Add to Home Screen command. Refresh AHL Sheets before going offline.
- **Offline limits:** cached app files, generated JSON, the last successful AHL snapshot, and browser-local draft state are available offline. AHL refresh and other network sources require a connection. The static app does not synchronize LocalStorage or IndexedDB between devices; export/import is the portable handoff.

## Data you need
To work reliably, the app expects current CSV snapshots for any of these datasets:
- Prospects
- Veterans
- Roster

## AHL Sheets ingestion
- The Google AHL Draft workbook is the only authority for player pool, AHL Position, Utility eligibility, ownership, retention, keeper costs, budgets, skater counts, and draft state. Its Position, Utility, Draft/Budget, Roster, and Keeper Rights data are refreshed together.
- The AHL Scores workbook is refreshed with its Scores, Scorebulator, and Games Played tabs. These tabs are retained as raw AHL score data; team standings and schedule rows are not treated as player projections.
- The prior-year OneDrive roster example and separate house-budget workbook are not ingested.
- The dashboard loads all configured AHL tabs on page startup and **Refresh AHL Sheets** repeats the load. A failed or empty tab stops the refresh and surfaces an error instead of marking the source loaded.
- GitHub Pages is static and cannot overwrite files in `data/`. A successful browser refresh updates the five Draft Intelligence JSON views in memory; **Export generated Draft Intelligence JSON** downloads those five named JSON outputs in a local bundle.

## Draft Intelligence data
- The dashboard exposes Draft Board, Best Available, Team Budgets, Personal Draft List, and Tools & Validation.
- Draft Board lists players in the Draft 2026 grid and local winning bids. Owner and paid Auction Value come from the grid (which takes precedence over a conflicting local bid), or from the local winning bid when the player has not yet appeared in the grid; the model's estimated auction value is not shown as a paid price. Only Best Available offers the Add to Personal List action. Draft Board Experience Tier uses career GP already on the player, from a live NHL profile, or from the saved NHL profile cache: Farm 0–9, Rookie 10–82, Veteran 83+; only missing career GP displays Veteran by default with a warning.
- Team Budgets and roster validation use the AHL Draft sheet's team balances and open slots; local working assignments subtract their bid and consume one slot. Missing sheet balances remain unavailable and are never replaced with a fixed-cap estimate.
- Budget values normalize currency strings such as `$71.50`; explicit skater values such as `6/23` normalize to `{ count: 6, max: 23 }`. The current Draft 2026 retained grid supplies TOTAL SPENT and BALANCE, with skater counts derived from its player rows.
- Final Position is the Utility tab position when a player is listed there; otherwise it is the AHL Position tab position. NHL Position never supplies pool position or eligibility.
- Personal Draft List supports rank, notes, Target/Avoid/Keeper/Breakout flags, max-bid notes, and local JSON import/export. It remains browser-local unless the user exports and imports the file on another device.
- Run `node scripts/generate-draft-intelligence.mjs <nhl-skater-stats.csv> [normalized-source-metrics.json]` from this directory to refresh those outputs from the current Google Sheets, a provided NHL skater-stat snapshot, and optional normalized source metrics.
- Dobber Excel is read only from `EVERYTHING (Skaters)`. Player, Team, POS, Salary, AAV, BPS, KVS, Projections, and RiskFlags are normalized by player key and merged without changing Final Position.
- The app attempts the configured OneDrive sources during refresh. Microsoft currently returns HTTP 401/403 to unauthenticated static requests, so Dobber remains `unavailable` and the failure is shown. **Import Dobber Excel** and **Import Dobber PDFs** provide the local ingestion path; successful parsing marks the relevant source and aggregate `dobberStatus` as `loaded-local` and triggers a full recompute.
- Dobber BPS/KVS accept explicit 0–1 or 0–100 values. DraftIQ remains null unless Projections or explicit columns provide PPS, RSS, and RRS; text projections are retained but never converted into invented scores.
- The pre-DraftIQ forecast overlay reads explicit projected points, games, and shots from Dobber Projections or matching workbook columns, and FHPPG/SHPPG from matched AHL Scores rows. The composite forecast score is `projectedPoints + 0.25 * (SHPPG - FHPPG) * projectedGames + 0.1 * projectedShots`, rounded to two decimals; it stays null unless all five metrics are present. It is exposed for Best Available sorting and player details, but does not change DraftIQ or auction pricing.
- Best Available lists only AHL-eligible players, showing Final Position, Experience Tier, projected points, composite score, and availability. Sort by ADP (placeholder), projected points, composite score, FHPPG, or SHPPG; unavailable numeric values sort last. NHL POS is shown in the player pop-up, not in the Best Available table.
- Dobber PDF metadata is attached only when the PDFs explicitly label pedigree or projection confidence, or explicitly tag a sleeper/bust. These fields add explanations only and do not numerically alter DraftIQ or tiers.
- AHL Position is used for pool position unless Utility lists the player, in which case Utility is the Final Position. NHL Position comes only from parsed Dobber Excel and never changes pool position.
- DraftIQ uses `0.45*PPS + 0.20*RSS + 0.15*BPS - 0.10*RRS + 0.10*KVS`, clamped to 0–100. `VALUE` requires price above its band midpoint and RRS `<=33`; `RISK` requires price above midpoint plus RRS `>=67`, usage-decline `>=0.67`, or aging-risk `>=0.67`; `FAIR` is within 10% of band width (minimum $0.50) of midpoint when no high-risk signal applies. Band midpoints are $50, $32, $17, $7, and $2.50 for tiers 1–5. Outputs remain `UNPRICED` when required scores or auction inputs are missing.
- Winning bids are recorded as local Working Assignments and update Draft Board ownership, availability, and team budget calculations immediately; the Google Sheets remain the operational source of truth. Remove Locally hides drafted rows until Show Removed Players is enabled, where they can be restored.
- Personal Draft List ranks and notes are stored only in browser local storage and can be exported locally as JSON.

## Source-of-truth rules
- AHL Google Sheets are authoritative for ownership, availability, AHL positions, budgets, keeper costs, rookie/farm eligibility, and draft state.
- Dobber Excel is supplemental scoring/NHL-position intelligence only; it does not override AHL pool positions or eligibility.
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
The PWA manifest, same-origin service worker, and install icons are deployed with the static app. The service worker caches the application shell and generated JSON, while IndexedDB stores the latest successfully loaded AHL snapshot and matching generated outputs for offline startup.

## Active docs
- `README.md`
- `DRAFT_DAY_RUNBOOK.md`
- `PRODUCT_SCOPE.md`
- `TECHNICAL_NOTES.md`

Older planning and status docs are preserved in `docs/archive/`.
