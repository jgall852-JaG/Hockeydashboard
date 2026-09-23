# Hockey Dashboard - Tomorrow Handoff Prompt

Copy and paste the prompt below into the new Copilot instance.

---

Continue work on the Hockey Dashboard from the exact current state.

## Required alignment

- Worktree:
  `C:\Users\galla\OneDrive\Desktop\Hockeydashboard\Hockeydashboard\app.worktrees\pasted-text-processing-8c5fd86c`
- Branch: `agents/pasted-text-processing-8c5fd86c`
- Repository: `jgall852-JaG/Hockeydashboard`
- Desktop launcher:
  `C:\Users\galla\OneDrive\Desktop\Launch-Hockey-Dashboard.bat`

Before changing anything:

1. Confirm the current branch and worktree.
2. Run `git status --short`.
3. Read `PROJECT_MEMORY.md` and `PROJECT_STATE_2025_DRAFT_READY.md`.
4. Read the latest Git commits and treat committed code as the current implementation.
5. Run the existing test suite.

## Source of truth

Google Sheets are authoritative. The dashboard is a view, validator, research
tool, and local Draft Workspace. Do not invent ownership, retention, cost, or
classification data.

Workbook:
`https://docs.google.com/spreadsheets/d/1_RbnvnxnMzzwty7jdq8I9SN3mWfp187xKVnyPackzeA/edit`

Important tabs:

- Position inventory: `gid=663280764`
- Utility inventory: `gid=1551984288`
- Retained owner/cost grid: `gid=1727331506`
- Live league roster: `gid=910545566`
- Rookie Matching Rights: `gid=1065921002`
- Veterans: `gid=1905579914`

## Current completed behavior

- Live Google Sheet refresh atomically rebuilds ownership, availability, team
  displays, validation, and counters.
- Owned, retained, drafted, and Working Assignment players are unavailable.
- Working Assignments propagate immediately throughout the dashboard.
- Retained players are separated into Veterans, Rookies, Farm, and visible
  Unclassified records.
- `YR3 = X` makes a player ineligible for rookie retention.
- Matching Rights `N` releases the player and removes the rights owner.
- Matching Rights `Y` with unused YR3 keeps the player eligible.
- Team displays show retained groups rather than raw historical prospect lists.
- Rosters use 25 flexible slots; goalie teams use position `G`.
- ACPSR equals remaining budget divided by remaining open slots.
- Bids and money use two decimal places and `$0.01` increments.
- Available Player search retains focus and team matching accepts partial names.
- Best Available excludes unevaluated raw inventory records.

## Last verified live example

Drunken Flyboys:

- Retained Rookies: Cole Hutson, Arseny Gritsyuk, Matthew Schaefer
- Retained Veterans: Jake Guentzel, Drake Batherson
- Dylan Strome: released, unowned, and not retained

The full regression suite passed: 5 suites and 35 tests.

## Operating rule

Correctness over new features. Refresh from Google Sheets and validate real
league data before making draft decisions. Preserve valid local Working
Assignments during refresh. Do not create alternate ownership logic.

Start by reporting branch, worktree, Git status, latest commit, test result, and
live refresh health. Then wait for the next requested dashboard task.

---
