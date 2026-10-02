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
- Not dependent on live NHL API access to function (NHL career GP, positions, and roster data come from a preloaded static snapshot, `data/nhl-snapshot.json`, regenerated offline via `scripts/build-nhl-snapshot.mjs`)

## Core draft workflow
Use the app to answer four questions:
1. Who is available?
2. Who owns what?
3. What is this player’s draft value/context?
4. Can I trust this data right now?

## How to launch locally
1. Install Node.js and run `Launch-Hockey-Dashboard.bat` from the folder containing `index.html` (the older `Start-Hockeydashboard.cmd` also works); keep the launcher running.
2. Open `http://127.0.0.1:3000/index.html` on that computer. On another device on the same network, use the LAN URL printed by the launcher instead of `127.0.0.1`.
3. Follow [Hockeydashboard_Access.md](./Hockeydashboard_Access.md) for the manual Dobber uploads and cross-device setup.

## Open the hosted dashboard (no launcher required)
Open **https://jgall852-jag.github.io/Hockeydashboard/** in Edge or another modern browser, then click **Refresh AHL Sheets** for current league data. You do not need Node.js or a running local server for this address. If you previously used the local dashboard, use **Export State** there (while its launcher is running) and **Import Saved State** on the hosted page to move browser-local changes; then refresh the sheets. Personal Draft List entries have their own JSON export/import. State and uploads do not automatically sync between `127.0.0.1` and GitHub Pages.

If Edge says **"127.0.0.1 refused to connect"**, you opened a local bookmark or installed local copy, not the hosted site. Either open the hosted URL above or run `Launch-Hockey-Dashboard.bat` before opening `http://127.0.0.1:3000/index.html`. Unregistering an offline service worker does not start the local server. Do not clear browser site data to fix this; that can delete locally stored state.

## How to access away from your desktop
- **Hosted access:** use **https://jgall852-jag.github.io/Hockeydashboard/** on laptop or phone.
- **Portable access:** use **Export State** before leaving your main machine, then **Import Saved State** on another browser or laptop.
- **Phone use:** the draft board, insights, and winning-bid form are available in the responsive dashboard.
- **Installable/offline use:** open the HTTPS Pages URL once while online, allow the offline app cache to finish, then use **Install Dashboard** or the browser's install/Add to Home Screen command. Refresh AHL Sheets before going offline. While online, the app always loads the latest deployed files (network-first); the offline cache is only a fallback, so a normal reload picks up new releases.
- **Offline limits:** cached app files, generated JSON, the last successful AHL snapshot, and browser-local draft state are available offline. AHL refresh and other network sources require a connection. The static app does not synchronize LocalStorage or IndexedDB between devices; export/import is the portable handoff.

## Data you need
To work reliably, the app expects current CSV snapshots for any of these datasets:
- Prospects
- Veterans
- Roster

## AHL Sheets ingestion
- The Google AHL Draft workbook is the only authority for player pool, AHL Position, Utility eligibility, ownership, retention, keeper costs, budgets, skater counts, and draft state. Its Position, Utility, Draft/Budget, Roster, Keeper Rights, and Veterans data are refreshed together.
- The AHL Scores workbook is refreshed with its Scores, Scorebulator, and Games Played tabs. These tabs are retained as raw AHL score data; team standings and schedule rows are not treated as player projections.
- AHL Position defines the canonical player pool and primary positions; AHL Utility adds eligibility positions and also adds Utility-only players (for example Nazem Kadri C/R → C/RW) to the pool. Best Available is derived only from this pool minus players owned by prospects/veterans, matching rights, the Draft 2026 grid, the league roster, or local assignments. The pool and available keys are rebuilt on sheet refresh and kept in JSON-safe saved-state form.
- Prospect term is derived from the draft year in the Keeper Rights sheet (three-season contract measured against `AHL_DRAFT_SEASON` in `prospectParser.js`, currently 2026), not the sheet's Term Remaining column. Expired prospects with Matching Rights `Y` stay rights-held; expired prospects with Matching Rights `N` are released: they leave the team roster and return to the available pool. Update `AHL_DRAFT_SEASON` each draft year.
- Manual unassign only undoes Draft 2026 grid, draft-board, and working-assignment ownership. Prospect, veteran, matching-rights, and league-roster owners are kept, so retained keepers never become available after an unassign.
- Importing a saved state that has no canonical AHL pool (or an empty one) is not trusted: availability is cleared, a warning is shown, and Best Available stays empty until **Refresh AHL Sheets** rebuilds the pool from AHL Position + Utility.
- The prior-year OneDrive roster example and separate house-budget workbook are not ingested.
- The dashboard loads all configured AHL tabs on page startup and **Refresh AHL Sheets** repeats the load. A failed or empty tab stops the refresh and surfaces an error instead of marking the source loaded.
- GitHub Pages is static and cannot overwrite files in `data/`. A successful browser refresh updates the five Draft Intelligence JSON views in memory; **Export generated Draft Intelligence JSON** downloads those five named JSON outputs in a local bundle.

## Draft Intelligence data
- The dashboard exposes Draft Board, Best Available, Team Budgets, Personal Draft List, and Tools & Validation.
- Draft Board lists players in the Draft 2026 grid and local winning bids. Owner and paid Auction Value come from the grid (which takes precedence over a conflicting local bid), or from the local winning bid when the player has not yet appeared in the grid; the model's estimated auction value is not shown as a paid price. Only Best Available offers the Add to Personal List action. Draft Board Experience Tier uses career GP already on the player, or from the preloaded NHL snapshot (`data/nhl-snapshot.json`): Farm 0–9, Rookie 10–82, Veteran 83+; only missing career GP displays Veteran by default with a warning, while invalid GP displays Unknown. GP lookups read entirely from the static snapshot, so there are no live NHL API calls, no CORS issues, and no rate limits at runtime on either the local launcher or the hosted site. Regenerate the snapshot periodically with `node scripts/build-nhl-snapshot.mjs` to pick up trades/roster moves.
- Each team detail includes a Draft Roster read directly from the refreshed Draft 2026 grid. The Prospects and Veterans sections remain sourced from their separate lists; adding or removing a Draft 2026 row changes only the draft roster. Team spend and balance follow the grid's TOTAL SPENT and BALANCE values.
- Team Budgets, Tools & Validation, and Dobber max bids share one Monies ledger (`teamMonies.js`). It starts from each team's AHL Draft sheet TOTAL SPENT/BALANCE and open slots, then applies canonical ownership deltas: a recorded bid on a non-grid pool player is charged and uses one slot; a bid already in the Draft 2026 grid is not charged again; a manual reassignment of a grid player moves its cost; a manual unassign refunds a grid pick but never a protected keeper; manual assigns of non-grid players use a slot at $0. Assignments that do not resolve to the canonical pool are excluded and flagged. Monies recompute after every refresh, import, local edit, and assignment change. Each team row shows Total Spent, Budget Remaining, Open Slots, Max Possible Bid, and a cost breakdown derived from ownership: Keeper Costs (Draft 2026 grid players retained on the Veterans sheet), Rookie Costs (grid players held on the Keeper Rights sheet and not released), Farm Costs (the sheet's farm deductions: TOTAL SPENT minus grid costs when a farm-deduction row exists), Auction Costs (all other grid rows and recorded bids), Penalties, and Adjustments. Tools & Validation warns when TOTAL SPENT does not reconcile with that breakdown. Missing sheet balances remain unavailable and are never replaced with a fixed-cap estimate.
- Budget values normalize currency strings such as `$71.50`; explicit skater values such as `6/23` normalize to `{ count: 6, max: 23 }`. The current Draft 2026 retained grid supplies TOTAL SPENT and BALANCE, with skater counts derived from its player rows.
- Final Position is the Utility tab position when a player is listed there; otherwise it is the AHL Position tab position. NHL Position never supplies pool position or eligibility.
- Personal Draft List supports rank, notes, Target/Avoid/Keeper/Breakout flags, max-bid notes, and local JSON import/export. It remains browser-local unless the user exports and imports the file on another device.
- Run `node scripts/generate-draft-intelligence.mjs <nhl-skater-stats.csv> [normalized-source-metrics.json]` from this directory to refresh those outputs from the current Google Sheets, a provided NHL skater-stat snapshot, and optional normalized source metrics.
- Dobber Excel is read only from `EVERYTHING (Skaters)`. Player, Team, POS, Salary, AAV, BPS, KVS, Projections, and RiskFlags are normalized by player key and merged without changing Final Position.
- The app attempts the configured OneDrive sources during refresh. Microsoft currently returns HTTP 401/403 to unauthenticated static requests, so Dobber remains `unavailable` and the failure is shown. **Import Dobber Excel** and **Import Dobber PDFs** provide the local ingestion path; successful parsing marks the relevant source and aggregate `dobberStatus` as `loaded-local` and triggers a full recompute.
- Dobber BPS/KVS accept explicit 0–1 or 0–100 values. DraftIQ remains null unless Projections or explicit columns provide PPS, RSS, and RRS; text projections are retained but never converted into invented scores.
- The pre-DraftIQ forecast overlay reads explicit projected points, games, and shots from Dobber Projections or matching workbook columns, and FHPPG/SHPPG from matched AHL Scores rows. The composite forecast score is `projectedPoints + 0.25 * (SHPPG - FHPPG) * projectedGames + 0.1 * projectedShots`, rounded to two decimals; it stays null unless all five metrics are present. It is shown in player details, but does not change DraftIQ or auction pricing. Dobber `Goals`/`Assists` columns (or `ProjG`/`ProjA`) become `forecastedGoals`/`forecastedAssists`; an invalid cell (e.g. the workbook's `-1` assists rows) leaves that field NULL instead of rejecting the import.
- Best Available is built from the canonical AHL pool (AHL Position + AHL Utility) intersected with the refreshed `availableKeys` set, so it updates after every unified rebuild (`rebuildCanonicalAhlPoolState` → `buildAvailableAhlPoolKeys` → `rebuildTeamBudgets` → `rebuildDraftValidationReport`). Removed-local, drafted, owned, and non-AHL players are excluded. Positions come only from the canonical pool — never NHL API, Dobber, or utility inference — and drive both the Final Position column and the position filter (All, C, LW, RW, D). Columns: Player, Final Position, Forecasted Goals, Forecasted Assists, Forecasted Points (NULL when Dobber has no projection). Sort by ADP (ascending) or Forecasted Points (descending); missing values sort last and ADP ties fall back to Forecasted Points. Without a search it shows the top 25 for the selected position; the search box matches player names across every available pool player, ignores the position filter, and lists all matches. NHL POS and composite score remain in the player pop-up only.
- Tools & Validation's owner-detail player cards and intelligence panel use a unified player object (`availability`, `experienceTier`, `cost`, `years`, `draftStatus`, `farmStatus`, `nhlProfile`, `dobberProjection`, plus `avgCost`/`minCost`/`maxCost`/`yearsDrafted`). `data/ahl-historical-bids.json` (generated by `node scripts/build-ahl-historical-bids.mjs` from the Draft 2024 and Draft 2025 tabs) supplies the historical bid-cost stats; any player without a historical match shows `NA` for those four fields instead of a blank value.
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
