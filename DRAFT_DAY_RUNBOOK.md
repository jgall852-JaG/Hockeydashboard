# Draft Day Runbook

## One-minute startup checklist
1. Open the hosted dashboard URL **or** start the local static server.
2. Wait for the startup AHL Sheets refresh, or use **Refresh AHL Sheets**.
3. Import your saved state file if you are moving from another machine.
4. Confirm the AHL source status is loaded and validation shows no blocking ownership or availability conflicts.
5. Confirm UNPRICED warnings when Dobber Excel or player-level score inputs have not been supplied.
6. Use your laptop for drafting. Use your phone only for quick lookup or emergency access.

## Best working setup
- **Primary:** laptop
- **Backup:** hosted URL on phone
- **Portable backup:** exported saved-state JSON file

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
- Are player-level score inputs available? If not, DraftIQ and auction values must remain UNPRICED.

The previous-year OneDrive roster example and separate house-budget workbook are not part of the operational workflow. Refreshed JSON can be exported from Tools & Validation; GitHub Pages cannot write repository files.

## Export habit
Before you leave your main machine, always click **Export State**.
That file is the fastest way to restore your draft workspace somewhere else.
