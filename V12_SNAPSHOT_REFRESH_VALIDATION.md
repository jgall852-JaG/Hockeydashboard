# V12 Snapshot Refresh Validation

## Answer

**Partially.**

The current Snapshot Refresh workflow can keep the Dashboard aligned for several league changes, but only if the right sheet snapshots are re-imported after each change. It does **not** fully eliminate duplicate data entry or manual refresh discipline.

---

## 1. Supported Changes

### Retentions completed

- **Google Sheet tab changes:** Veterans, League Roster, possibly Draft Log
- **Dashboard dataset changes:** veterans, roster, team context, value profile
- **Refresh Snapshot updates it:** yes, if the updated Veterans snapshot is re-imported
- **Manual action still required:** yes

### Ownership changes

- **Google Sheet tab changes:** League Roster, Prospects, Veterans
- **Dashboard dataset changes:** roster, prospects, veterans, League/Teams context
- **Refresh Snapshot updates it:** yes, if the affected snapshot is re-imported
- **Manual action still required:** yes

### New roster sheet created

- **Google Sheet tab changes:** League Roster
- **Dashboard dataset changes:** roster, team needs, fit analysis
- **Refresh Snapshot updates it:** yes, if the new roster snapshot is imported
- **Manual action still required:** yes

### Prospect ownership changes

- **Google Sheet tab changes:** Prospects, League Roster
- **Dashboard dataset changes:** prospects, team context, comparison, draft hub context
- **Refresh Snapshot updates it:** yes, if the updated Prospects snapshot is imported
- **Manual action still required:** yes

### Veteran ownership changes

- **Google Sheet tab changes:** Veterans, League Roster
- **Dashboard dataset changes:** veterans, team context, comparison, draft hub context
- **Refresh Snapshot updates it:** yes, if the updated Veterans snapshot is imported
- **Manual action still required:** yes

---

## 2. Unsupported Changes

### Draft log updated

- **Google Sheet tab changes:** Draft Log
- **Dashboard dataset changes:** draft order, available pool, board state, queue timing
- **Refresh Snapshot updates it:** not fully
- **Manual action still required:** yes

Current limitation:
- the workflow is snapshot-based, but the dashboard does not yet have a dedicated draft-log import path that fully drives live board state from Draft Log updates

### Trade executed

- **Google Sheet tab changes:** League Roster, Draft Log, Prospects, Veterans
- **Dashboard dataset changes:** roster, ownership, comparison context, team fit, draft board state
- **Refresh Snapshot updates it:** only partially
- **Manual action still required:** yes, across multiple tabs

Current limitation:
- trades can change several league records at once, so one refreshed snapshot is not enough unless every impacted tab is re-imported

---

## 3. Refresh Workflow

Current workflow:

1. League makes the official change in Google Sheets.
2. User exports or uploads the relevant CSV snapshot.
3. Dashboard re-imports that snapshot.
4. Dashboard recomputes derived intelligence from the refreshed data.

What works:
- keeps the Dashboard aligned with sheet-backed snapshots
- supports manual refresh after real league changes
- preserves the sheet as the operational source of truth

What does not work yet:
- automatic sync
- multi-tab refresh orchestration
- single-action update for all affected league changes
- live draft-log reconciliation

---

## 4. Risks

- **Stale snapshot risk:** one tab may be refreshed while another related tab remains old.
- **Partial-update risk:** retentions or trades may touch multiple datasets, but only one snapshot gets imported.
- **Manual discipline risk:** the workflow still depends on the user remembering to refresh after each league event.
- **Draft-log gap risk:** draft activity is the hardest case because it can change the board faster than manual uploads.
- **False confidence risk:** the UI can look current even when one or more imported tabs are stale.

---

## 5. Recommended Next Improvements

1. Show freshness per dataset more prominently.
2. Warn when related tabs are out of sync.
3. Add a dedicated Draft Log refresh path.
4. Add a single “refresh all impacted snapshots” workflow.
5. Make stale-state warnings unavoidable during draft decisions.

---

## Final verdict

The current Snapshot Refresh workflow is good enough for manual league updates, but it does **not** yet guarantee full alignment with real league activity without some duplicate data entry and refresh discipline.
