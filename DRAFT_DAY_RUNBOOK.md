# Draft Day Runbook

## One-minute startup checklist
1. Open the hosted dashboard URL **or** start the local static server; on first use, stay online to install and cache the app.
2. Wait for the startup AHL Sheets refresh, or use **Refresh AHL Sheets**.
3. Import your saved state file if you are moving from another machine.
4. Confirm the AHL source status is loaded and validation shows no blocking ownership or availability conflicts.
5. Confirm UNPRICED warnings when Dobber Excel or player-level score inputs have not been supplied.
6. If OneDrive refresh reports 401/403, use **Import Dobber Excel** and select the workbook containing `EVERYTHING (Skaters)`; optionally import both Dobber PDFs.
7. Confirm Dobber shows `loaded-local` only after the selected files parse; remote failures must remain visibly `unavailable`.
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
- Does Team Budgets show each AHL Draft balance? A missing balance is reported unavailable rather than estimated; local working assignments reduce that balance and open-slot count.
- Are there validation errors?
- Is the player available?
- Does ownership look correct?
- Is NHL Position present from Dobber Excel? If not, scoring dependent on it must remain null.
- If Dobber is imported, do the required PPS/RSS/RRS projection fields exist? BPS/KVS alone do not complete DraftIQ.
- Are player-level score inputs available? If not, DraftIQ and auction values must remain UNPRICED.
- Is Final Position sourced from Utility when listed, and from AHL Position otherwise?
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
