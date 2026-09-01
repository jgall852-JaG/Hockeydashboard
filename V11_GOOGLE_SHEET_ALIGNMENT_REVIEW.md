# V11 Google Sheet Alignment Review

## Purpose

This review defines how the Hockey Dashboard should leverage the live league Google Sheet without forcing managers to maintain the same information in two places. It is a design-only document and does not implement or change the product.

The key principle is simple:

- the Google Sheet is the operational source of truth for league actions
- the Dashboard is the intelligence layer for decision support
- both systems should share only the minimum necessary data, and they should not duplicate operational logic

---

## 1. Current Data Flows

The AHL Draft Google Sheet currently contains multiple active tabs that are already maintained by the league:

1. League Roster
2. Draft Log
3. Prospects
4. Veterans

These are real operational sheets and should be treated as living league records, not as a convenience copy of the dashboard.

### Current flow pattern

- League Roster tracks current ownership and roster state.
- Draft Log tracks actual transactions and draft progression.
- Prospects and Veterans contain player pools and ownership context that already matter to league operations.
- The Dashboard consumes this data only as a structured snapshot or import for intelligence analysis.

This means the Dashboard is not the system of record. It is downstream of the league’s operational truth.

---

## 2. Which Google Sheet tabs should become inputs?

### Recommended input tabs

#### League Roster
Use as an input for:
- current owner roster structure
- team need signals
- roster gaps and depth
- current ownership context

This is valuable to the Dashboard for fit analysis and team-needs logic, but it should remain authoritative in the sheet.

#### Draft Log
Use as an input for:
- picks made
- current order and sequence
- actual draft progression
- the current draft state snapshot

This is the most important operational input for the Dashboard because it determines available players, order, and draft timing.

#### Prospects
Use as an input for:
- available player pool
- player identity context
- cost / player value context when relevant to the league environment
- roster and fit analysis

This data overlaps with dashboard intelligence but should not be treated as a second source of truth.

#### Veterans
Use as an input for:
- current veteran roster state
- retention updates
- cost and roster pressure
- asset comparison and roster fit analysis

This overlaps with dashboard intelligence, but the sheet remains the authority for operational roster ownership and cost logic.

### Tabs that should not be treated as inputs without clear reason

The Dashboard should not import raw operational data that the sheet already owns for the purpose of re-creating the same legal state in another system. The Dashboard should consume enough to run decision support, but not duplicate the core governance layer.

---

## 3. Which Dashboard datasets are duplicated by the sheet?

These are the highest-risk duplicate areas:

### A. Ownership and roster state

Duplicate between:
- Google Sheet League Roster
- Dashboard roster / owner view

This is overlapping data. The Dashboard can read it for fit analysis, but the actual official roster state belongs in the sheet.

### B. Player pool / player list

Duplicate between:
- Google Sheet Prospects / Veterans
- Dashboard player pool and board

This is a strong overlap. The Dashboard should not maintain a separate authoritative player list if the sheet is already tracking it.

### C. Draft results / pick history

Duplicate between:
- Google Sheet Draft Log
- Dashboard board status or pick tracking

The Dashboard can derive board state from it, but it should not become the legal source of record for the draft log.

### D. Draft order and pick sequencing

Duplicate between:
- Google Sheet Draft Log / order structure
- Dashboard order logic and board state

The Dashboard may calculate board direction and timing from the sheet, but the league order remains in the sheet.

### E. Retentions and ownership changes

Duplicate between:
- Google Sheet roster and veteran tabs
- Dashboard ownership, cost, and fit analysis

These must be refreshed from the sheet or the Dashboard will drift.

---

## 4. Which data should remain authoritative in Google Sheets?

These should remain authoritative in the Google Sheet:

1. official roster composition
2. current owner assignments
3. actual draft picks and sequence
4. draft order and snake adjustments
5. retentions and ownership changes
6. auction results if the league records them there
7. any rule-based operational record or commissioner notes
8. league-wide legal state and corrections

These are not just data points. They are the ledger of the actual league.

---

## 5. Which data should remain authoritative in the Dashboard?

These should remain authoritative in the Dashboard:

1. value profile
2. risk band and upside interpretation
3. position scarcity analysis
4. draft queue and alternate target list
5. team need analysis
6. comparison logic
7. fit analysis against current roster state
8. decision confidence scoring
9. strategic explanation: why this pick is sensible

These are not operational facts; they are intelligence derived from the sheet and the dashboard’s own logic.

The Dashboard should compute them from the sheet’s official inputs, not maintain a separate legal copy of the league state.

---

## 6. Where are we manually maintaining the same information twice?

The biggest duplication risk is in these areas:

### 1. Roster ownership

The league is already maintaining roster ownership in the Google Sheet, while the Dashboard has its own local roster and owner logic. This is acceptable only if the Dashboard treats the sheet as the source of truth and updates from snapshots.

### 2. Player pool / prospect and veteran data

If the league updates the prospect and veteran tabs and the Dashboard also stores a local copy or parallel list, the two can drift apart. That creates confusion and stale decision support.

### 3. Draft order and live transactions

If the sheet records draft order and the Dashboard separately tracks a board order state, the two can diverge. The Dashboard should recompute its order from the sheet snapshot, not maintain a parallel official record.

### 4. Retention and auction updates

Retentions, ownership changes, and auction results are especially sensitive because they affect both roster state and player value assumptions. These must remain explicit sheet-driven updates.

---

## 7. Mock Draft Impact

The current Draft Hub would remain accurate only if the relevant imported data is refreshed after league changes.

### Scenario: auction results entered into Draft Log

If auction results are logged in the Draft Log, then:
- actual player ownership and draft sequence change
- the board state should be refreshed
- the Dashboard must re-read the updated draft log to maintain an accurate available pool

Without a refresh, the Dashboard would be stale and may mislead the GM.

### Scenario: retentions updated

If retentions change, then:
- owner roster shapes shift
- team need logic may change
- player fit and value assumptions may change

This means the Dashboard must refresh when retention updates occur.

### Scenario: supplementary draft order changes

If order changes due to a supplemental snake or reordering event:
- the Dashboard must update current board sequencing
- the draft order must be reinterpreted from the sheet snapshot
- the user should not rely on stale local order state

### Scenario: ownership changes

If ownership changes after a move or correction:
- the roster fit analysis changes
- the queue and comparison context can drift
- the Dashboard needs a refresh or re-import to stay aligned

### Net effect

The Dashboard remains useful only if it is treated as a snapshot-driven intelligence layer refreshed from the sheet at meaningful points in the draft or roster cycle.

---

## 8. Draft-Day Workflow

Recommended workflow:

1. League updates the official Google Sheet.
2. Sheet remains the system of record for roster, picks, order, and league activity.
3. Dashboard refreshes from a snapshot or import at the relevant draft moment.
4. Dashboard computes intelligence: value, scarcity, fit, queue, comparison, decision confidence.
5. Manager uses the dashboard for decision support.
6. Manager executes the pick or roster action in the official sheet.

This keeps the operating loop clean:

Google Sheet = official league state
Dashboard = recommendation layer
Manager = actual decision-maker

---

## 9. Risks

### 1. Double-maintenance risk

The main risk is that managers maintain the same info in both the sheet and the dashboard, which leads to drift and confusion.

### 2. Stale data risk

If the dashboard is not refreshed after the sheet changes, the board may be wrong even if the sheet is correct.

### 3. Operational drift risk

If the dashboard starts behaving like an operational ledger, it will create conflicting records and incorrect decision logic.

### 4. Inconsistent roster assumptions

If team fit is calculated from stale owner info, the dashboard may tell the user to draft for the wrong roster context.

### 5. Manual refresh fatigue

This is a risk only if the workflow becomes too cumbersome. The integration should stay simple and low-friction.

---

## 10. Recommended Future Integration Strategy

### Recommended approach

Use a snapshot-based intelligence refresh model.

This means:
- Google Sheet remains the operational authority
- Dashboard import remains lightweight and intentional
- import updates are triggered at meaningful draft moments
- Dashboard logic is recomputed from the latest sheet snapshot

### The best future model

A practical future strategy is:

- official league state stays in Google Sheets
- dashboard consumes a selected subset of relevant tabs
- data is imported as a structured snapshot for analysis
- dashboard caches the snapshot locally and labels it as a current or stale snapshot
- dashboard never claims to own the official league record

### Why this works

It preserves both realities:
- the sheet stays trustworthy and legal
- the dashboard stays useful and focused on insight instead of operations

This is the best path for avoiding duplicate maintenance while still giving managers a strong draft intelligence layer.

---

## Final recommendation

The Dashboard should leverage the existing Google Sheet workflow by reading only the official operational data that matters for intelligence, not by duplicating the league’s operational records.

Specifically:
- League Roster, Draft Log, Prospects, and Veterans should be treated as inputs to the Dashboard
- The Dashboard should own only its derived intelligence layer
- all legal state, roster ownership, draft picks, and operational corrections stay in Google Sheets
- the Dashboard should refresh from sheet snapshots when roster, order, or draft conditions change

This is the cleanest way to use the current sheet without forcing managers to maintain the same information twice.
