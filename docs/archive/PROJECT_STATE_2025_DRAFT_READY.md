# Hockey Dashboard - Master Project State

This file is the handoff document for a new chat or contributor. It records the
state of the project as of the current worktree. The filename is retained as
requested; the active draft context is the 2026-2027 season.

## Current alignment

- Active worktree:
  `C:\Users\galla\OneDrive\Desktop\Hockeydashboard\Hockeydashboard\app.worktrees\pasted-text-processing-8c5fd86c`
- Active branch: `agents/pasted-text-processing-8c5fd86c`
- Repository: `jgall852-JaG/Hockeydashboard`
- Architecture: local-first browser application; plain HTML, CSS, and
  JavaScript; no backend and no framework.
- Current uncommitted changes:
  - `app.js`
  - `rosterParser.js`
  - `tests/draftValidation.test.js`
  - `tests/rosterParser.test.js`
  - `V16_REAL_DRAFT_REHEARSAL.md`
  - this file

Do not move future work to another branch or worktree without explicitly
confirming the change first.

## Source of truth and operating workflow

Google Sheets remain the source of truth for league data, ownership,
retentions, draft results, and league structure. The dashboard is a local
research, validation, draft-workspace, and decision-support layer. It must not
silently become a second league-management system.

Normal workflow:

1. Export or download current Google Sheet tabs as CSV.
2. Import the snapshots into the dashboard.
3. Review Snapshot Refresh and Validation Center.
4. Resolve or document ownership, retention, duplicate, and availability issues.
5. Use Available Player Center, Draft Hub, comparison, and Team-Fit Context for
   decisions.
6. Record provisional selections in Draft Workspace / Working State.
7. Reconcile final results back to Google Sheets; local assignments do not
   overwrite sheet data.

## Current Google Sheet sources

All provided sources are tabs in the AHL Draft workbook:

- Workbook:
  [AHL Draft Google Sheet](https://docs.google.com/spreadsheets/d/1_RbnvnxnMzzwty7jdq8I9SN3mWfp187xKVnyPackzeA/edit)
- Position inventory matrix:
  `gid=663280764`
- Utility inventory and eligibility:
  `gid=1551984288`
- Retained player owner/cost grid:
  `gid=1727331506`
- League owner-column layout:
  `gid=910545566`

The exact live contents of these tabs are not stored in the repository. The
latest imported CSV snapshot is therefore authoritative for a given dashboard
session, and snapshot age must be checked before draft decisions.

## Data model

### Browser persistence

- Storage key: `hockey-dashboard-owner-view`
- State version: `2`
- Persistence medium: browser `localStorage`
- Main state shape:
  - `version`
  - `datasets.prospects`
  - `datasets.veterans`
  - `datasets.roster`
  - `datasets.transactions`
  - `metadata` for import status, source name, timestamp, and record count
  - `manualOverrides`
  - `workingAssignments`

`localStorage` is convenient working state, not a portable archive or source
of truth.

### Player fields

The canonical player records preserve the source values and commonly include:

- name / normalized player key
- owner
- position and pool position
- NHL team
- cost
- source layout
- classification where supplied or manually assigned
- retention and availability indicators where supplied

Pool Position is the league-facing eligibility field. NHL position or live NHL
metadata is enrichment and must not overwrite pool eligibility.

### Player state classifications

- **Owned**: the source data has an owner.
- **Available**: the player is eligible for selection and has no authoritative
  owner, subject to validation.
- **Retained**: the player is held by an owner under the retained-player data
  and cost rules.
- **Drafted**: a final league result recorded in the source sheet. A local
  Working State assignment is provisional and is not automatically a final
  drafted result.
- **Working Assignment**: a local `workingAssignments` entry representing a
  provisional winner/team, bid, classification, status, and timestamp.
- **Classification**: a normalized roster/draft category such as Rookie,
  Veteran, or another league classification supplied by the source or user.
- **Team Assignment**: the owner/team selected in Working State, distinct from
  source ownership until reconciled.

### Where state is calculated

- Source ownership, retention, and availability fields are parsed by
  `rosterParser.js` and dataset parsers.
- State normalization, migration, persistence, and snapshot metadata are in
  `app.js`.
- The validation report built by `buildDraftValidationReport` combines
  prospects, veterans, roster, manual overrides, and Working State.
- Available Player Center excludes source-owned players and locally assigned
  players. Conflicts are surfaced as validation errors rather than treated as
  silently available.
- Best Available uses the same filtered available pool.
- Draft Workspace groups local assignments by assigned team.
- Owner View shows source owner information and local draft assignments
  separately.

## Draft rules

- Example budget cap: `$250`.
- Minimum slot cost: `$0.50`.
- Target roster: `23 skaters` plus `2 goalie teams`.
- Goalie teams are represented by NHL city/team names and recognized goalie
  aliases.
- Skater positions include forwards and defensemen; utility and eligibility
  values come from the imported sheet layouts.
- Roster validation calculates remaining budget, open slots, minimum funding,
  and budget shortfall.
- Auction simulations used increasing ADP/points pressure to drive bid prices,
  but simulations are examples and do not write league results.

## Dashboard architecture

### League

League-level ownership, cost, retention, snapshot, and validation context.
This is the primary trust and integrity surface after importing a snapshot.

### Teams

Team identity, NHL context, roster/team intelligence, and team-fit context.
This remains primarily a context surface rather than a league transaction
system.

### Players

Player detail, identity, historical/live context, comparison, position,
classification, and handoff into related team or draft context.

### Draft Hub

The fastest decision-support surface: available players, Best Available,
validation status, compact league context, and Working State entry points.

### Draft Workspace

The local operational layer for provisional assignments. It records:

- player
- assigned team / winner
- bid
- position
- classification
- status
- update timestamp

Assignments persist locally, are visible by team, and remove assigned players
from available pools without modifying the Google Sheet snapshot.

### Supporting layers

- Snapshot Refresh: manual CSV bridge from Google Sheets.
- Validation Center: ownership, duplicate, classification, retention,
  availability, roster-rule, and snapshot-age checks.
- Available Player Center: searchable filtered pool plus manual overrides.
- Manual Overrides: temporary local entries for missing or late-added players,
  clearly labeled and audited.
- Team-Fit Context: player-to-team context for decisions.
- Comparison: side-by-side decision support.
- One-Click Handoff: moves from Draft Hub decisions to deeper Players/Teams
  context.

## Completed features

- Snapshot Refresh
- Validation Center
- Available Player Center
- Manual Overrides and override audit
- Draft Workspace
- Draft Workspace assignments
- Persistent Working State
- Assigned-player removal from available pools
- Team-grouped Working State view
- Team-Fit Context
- Player/team Comparison
- One-Click Handoff
- Ownership and duplicate validation
- Retention integrity validation
- Available-player integrity validation
- `$0.50` slot minimum and `23 skaters + 2 goalie teams` roster rules
- Budget, open-slot, and shortfall validation
- Multi-layout roster parsing:
  - position inventory matrix
  - utility inventory
  - retained owner/cost grid
  - league owner-column layout
  - flat roster tables
- 25-player real-draft rehearsal documented in `V16_REAL_DRAFT_REHEARSAL.md`

## Validation completed

- `tests/draftValidation.test.js` passes.
- `tests/rosterParser.test.js` passes.
- Browser validation confirmed that assigning Dylan Guenther and Connor Bedard:
  - persisted two Working State assignments
  - reduced the available count
  - increased Draft Workspace rows
  - removed assigned players from available rows

## Known issues and draft blockers

### Critical

1. Player state inconsistencies can still arise when ownership, retention,
   availability, and position data come from different sheet layouts.
2. There is no canonical imported player-state reconciliation layer shared by
   every parser and dataset.
3. Final draft results still require manual reconciliation back to Google
   Sheets.

### High

1. Snapshot refresh is manual; there is no live Google Sheet sync.
2. Draft Workspace is local and browser-specific.
3. Draft-day execution is not a commissioner-grade transaction workflow.
4. One-click assignment still needs to be made faster and more inline.
5. Comparison and team impact require too much cross-view navigation.

### Medium

1. Exact semantics of some league position sections, especially goalie-team
   rows, need confirmation against the live sheet.
2. Budget and cost quality depend on what the source sheet provides.
3. Manual override players are temporary and local only.
4. Trade workflow and automated draft-log reconciliation are not implemented.
5. Available-player correctness still depends on source-sheet hygiene.

### Low

1. `localStorage` has no built-in export/archive workflow.
2. The repository contains historical status documents with different naming
   and dates; this file is the current handoff authority.
3. Older referenced V11/V12/V13/V14/V15 documents are not all present in this
   worktree. Present versioned references include `V08_*` and
   `V16_REAL_DRAFT_REHEARSAL.md`.

## Top 10 next priorities

1. Build one canonical player-state reconciliation model across all imported
   sheet formats.
2. Make ownership, retention, availability, and Working Assignment precedence
   explicit and test it with conflict cases.
3. Add true one-click assignment from a Draft Hub row with winner, bid,
   classification, and status in one action.
4. Show inline roster need, budget pressure, and team impact beside each
   available player.
5. Improve comparison deltas so close decisions are understandable in one read.
6. Add a safe local export/import path for Working State and Draft Workspace.
7. Reconcile local assignments to source-sheet draft results with an explicit
   review step.
8. Confirm and harden goalie-team and league-position parsing against current
   sheet exports.
9. Add targeted tests for parser precedence, duplicate names, retained players,
   manual overrides, and assignment removal.
10. Reduce Draft Hub tab switching by combining the most useful League, Teams,
    Players, and Draft Workspace context.

## Next implementation target

Implement the canonical player-state reconciliation and precedence rules first.
The target behavior is deterministic:

1. Source ownership and retention are authoritative for imported league state.
2. A source-owned or retained player is not available.
3. A local Working State assignment is provisional, visible, and excluded from
   available pools.
4. Manual overrides are local additions and never silently replace source
   records.
5. Conflicts are reported with enough detail to resolve them before draft use.

After that foundation is verified, implement the one-click Draft Hub
assignment flow identified as the highest-value live-draft improvement.

## Handoff instruction

Start future work in this worktree and branch. Read this file before changing
code. Preserve Google Sheets as source of truth, preserve the existing
`localStorage` schema unless a migration is explicitly designed, and do not
overwrite user changes already present in the worktree.
