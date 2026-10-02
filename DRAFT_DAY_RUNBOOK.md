# Draft Day Runbook

## One-minute startup checklist
1. Open the hosted dashboard URL **or** start the local static server; on first use, stay online to install and cache the app.
2. Wait for the startup AHL Sheets refresh, or use **Refresh AHL Sheets**.
3. Import your saved state file if you are moving from another machine.
4. Confirm the AHL source status is loaded and validation shows no blocking ownership or availability conflicts.
5. Confirm UNPRICED warnings when Dobber Excel or player-level score inputs have not been supplied.
6. If OneDrive refresh reports 401/403, use **Import Dobber Excel** or its drop zone with the workbook containing `EVERYTHING (Skaters)`; optionally import both Dobber PDFs using their button or drop zone.
7. Confirm successful local imports show `loaded-local`, a parsed player count, and the last-import time. Invalid workbook/PDF warnings remain visible; remote failures stay `unavailable`. If the status says a saved Dobber Excel import "predates forecast Goals/Assists", click **Import Dobber Excel** again.
8. Confirm the offline snapshot timestamp and install the dashboard from the browser or use **Install Dashboard**.
9. Use your laptop for drafting. Use your phone only for quick lookup or emergency access.

## Best working setup
- **Primary:** laptop
- **Backup:** hosted URL on phone
- **Portable backup:** exported saved-state JSON file
- **Offline fallback:** installed PWA with a successfully refreshed AHL snapshot

## If your desktop is unavailable
1. Open the hosted dashboard from your laptop.
2. If needed, import your saved state JSON.
3. If the saved state is old, import the latest CSV snapshots.
4. Keep drafting from the laptop copy.

## If hosted access fails
1. Open the repository on your laptop.
2. Start a static server from the project root (the folder containing `index.html`).
3. Open the local URL in your browser.
4. Import your saved state JSON.

## What to check before making a pick
- Is the snapshot current?
- Did all configured AHL Draft and AHL Scores tabs load? Those Google Sheets are authoritative for ownership, availability, AHL positions, budgets, keeper costs, rookie/farm eligibility, and completed draft state.
- Does Team Budgets show each AHL Draft balance? A missing balance is reported unavailable rather than estimated. Recorded bids for players not yet in the Draft 2026 grid reduce that balance and open-slot count; bids already entered in the sheet are not counted twice.
- Are there validation errors?
- Is the player available?
- Does ownership look correct?
- Is NHL Position present from Dobber Excel? If not, scoring dependent on it must remain null.
- If Dobber is imported, do the required PPS/RSS/RRS projection fields exist? BPS/KVS alone do not complete DraftIQ.
- Are player-level score inputs available? If not, DraftIQ and auction values must remain UNPRICED.
- Is Final Position sourced from Utility when listed, and from AHL Position otherwise?
- Are manual removals, assignments, and unassignments intentional? They are browser-local overlays, remain offline, and clear only after a successful AHL refresh. Local Dobber imports preserve them.
- Best Available lists only currently available players from the canonical AHL pool (top 25 per position; columns Final Position, Forecasted Goals/Assists/Points, and DraftIQ; sorted by Forecasted Points, DraftIQ, or ADP once ADP data exists). Positions come only from AHL Position + Utility. Pick your team in the **Team needs** selector so DraftIQ includes your positional needs; use its Search box to find any available player by name. **Show Removed Players** controls visibility of commissioner removals.
- Draft Board shows Draft 2026 owners and prices plus local winning bids; Best Available shows the remaining eligible players. Show Removed Players reveals locally hidden rows so they can be restored. NHL career GP may be unavailable, in which case the displayed Draft Board Experience Tier defaults to Veteran with a warning.
- **Reset Local Edits** is in Tools & Validation and runs the normal authoritative AHL refresh. Edits clear only when that refresh succeeds; local Dobber files are retained and reapplied.
- Have you exported your Personal Draft List JSON if using another device? LocalStorage and IndexedDB do not sync between devices.

The previous-year OneDrive roster example and separate house-budget workbook are not part of the operational workflow. Refreshed JSON can be exported from Tools & Validation; GitHub Pages cannot write repository files.

## Offline draft use
- While online, refresh AHL Sheets and wait for the app to report the refresh and offline snapshot are complete.
- Install the app from the HTTPS Pages site, then test by opening it once with the device offline before draft day.
- Offline mode is a timestamped snapshot. Do not treat it as current if the league sheet changed after the last successful refresh.
- No GitHub or Google Sheets writes are performed by the offline app; winning bids are local Working Assignments until the authoritative sheet is updated.

## Export habit
Before you leave your main machine, always click **Export State**.
That file is the fastest way to restore your draft workspace somewhere else.
