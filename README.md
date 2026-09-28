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
- **Phone use:** treat phone mode as lookup/emergency mode, not your main drafting workspace.

## Data you need
To work reliably, the app expects current CSV snapshots for any of these datasets:
- Prospects
- Veterans
- Roster

## Draft Intelligence data
- The dashboard loads the five static JSON outputs from `data/` and shows available NHL production context in the existing Player Intelligence panel.
- Run `node scripts/generate-draft-intelligence.mjs <nhl-skater-stats.csv> [normalized-source-metrics.json]` from this directory to refresh those outputs from the current Google Sheets, a provided NHL skater-stat snapshot, and optional normalized source metrics.
- Optional metrics are keyed by player ID (normalized name with hyphens) under `players`, with `deployment`, `production`, `prospect`, and `keeper` objects; position scarcity inputs use top-level `rosterSlotsByPosition` and optional `viablePlayersByPosition`. Component inputs must be normalized 0–1.
- Current outputs are explicitly partial: unavailable source metrics and dependent scores/auction values remain `null`; supplied complete inputs are scored by the engine.

## Source-of-truth rules
- Local CSV data remains authoritative.
- NHL API data is optional enrichment only.
- Cached live data may help, but the app must remain useful without it.
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
