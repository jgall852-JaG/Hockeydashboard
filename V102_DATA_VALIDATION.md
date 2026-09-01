# V1.0.2 Data Validation

## Purpose

This document verifies that the Draft Hub is using actual league data and identifies what is loaded, what is missing, and what assumptions still need to be treated carefully.

It is a validation report only.

- no implementation
- no code
- no new features
- no V1.1 work

---

## Validation scope

Confirmed league data sources:

- League Roster
- Prospects
- Veterans

The current league files show real team and player records, including ownership, cost, term remaining, and matching-rights style fields where applicable.

---

## Loaded datasets

### 1. League Roster

Loaded from:

- `Data/Rosters/AHL Draft - Roster.csv`

What it contains:

- team / owner rows
- player rows grouped by owner
- year columns for roster history or retention context

What it is good for:

- ownership visibility
- roster structure
- team composition
- current roster context

### 2. Prospects

Loaded from:

- `Data/Rosters/AHL Draft - Prospects.csv`

What it contains:

- owner / team
- player name
- cost
- term remaining
- year flags
- matching rights

What it is good for:

- ownership
- cost
- term
- rights
- retention context
- player pool intelligence

### 3. Veterans

Loaded from:

- `Data/Rosters/AHL Draft - Veterans.csv`

What it contains:

- owner / team
- player name
- cost
- term remaining
- year flags
- matching rights

What it is good for:

- veteran ownership
- cost visibility
- roster pressure
- retention / rights context

---

## Missing datasets

The current validation package does not show a single unified official league database.

Missing or not explicitly loaded here:

- live Google Sheet connection
- explicit draft-order sheet
- explicit auction budget sheet
- explicit commissioner override log
- explicit retention summary sheet
- explicit transaction history feed inside the validation workflow

These may exist operationally elsewhere, but they are not part of the directly validated dataset set here.

---

## Missing fields

### League Roster

Missing or not explicit in the roster sheet:

- cost
- term remaining
- matching rights
- explicit retention flag
- explicit draft status
- timestamps

### Prospects

Missing or not explicit in the prospects sheet:

- unique player ID
- explicit timestamp / last-updated field
- explicit draft order
- explicit pick number
- explicit status field beyond owner assignment

### Veterans

Missing or not explicit in the veterans sheet:

- unique player ID
- explicit timestamp / last-updated field
- explicit draft order
- explicit pick number
- explicit status field beyond owner assignment

---

## Broken assumptions

1. The Draft Hub is not reading from one perfect normalized data model.
   - The roster sheet and the prospect/veteran sheets use different structures.

2. Retentions are only partially explicit.
   - Term remaining and year columns help, but there is no universal retention flag in the visible CSV layout.

3. Ownership is visible, but not always in the same schema.
   - League Roster uses owner-grouped rows.
   - Prospects and Veterans use direct owner/team columns.

4. The Dashboard cannot assume every player appears in every sheet.
   - Some players are only in Prospects.
   - Some players are only in Veterans.
   - The same player may need cross-sheet reconciliation.

5. “Actual league data” does not automatically mean “fully synchronized live state.”
   - The data is real, but freshness still depends on the last sheet update or import.

---

## Player validation

### Macklin Celebrini

Available data:

- owner / team
- cost
- term remaining
- year flags
- matching rights

Missing data:

- explicit unique ID
- explicit timestamp
- explicit status field

Panels that consume it:

- Ownership / roster context
- Team Needs
- Value Profile
- Comparison
- Confidence Labels

### Michael Misa

Available data:

- owner / team
- cost
- term remaining
- year flags
- matching rights

Missing data:

- explicit unique ID
- explicit timestamp
- explicit status field

Panels that consume it:

- Ownership / roster context
- Team Needs
- Scarcity
- Value Profile
- Comparison

### Lane Hutson

Available data:

- owner / team
- cost
- term remaining
- year flags
- matching rights

Missing data:

- explicit unique ID
- explicit timestamp
- explicit status field

Panels that consume it:

- Ownership / roster context
- Position Scarcity
- Value Profile
- Comparison
- Confidence Labels

### Dylan Guenther

Available data:

- owner / team
- cost
- term remaining
- year flags
- matching rights

Missing data:

- explicit unique ID
- explicit timestamp
- explicit status field

Panels that consume it:

- Ownership / roster context
- Team Fit
- Value Profile
- Comparison
- Confidence Labels

### Beckett Sennecke

Available data:

- owner / team
- cost
- term remaining
- year flags
- matching rights

Missing data:

- explicit unique ID
- explicit timestamp
- explicit status field

Panels that consume it:

- Ownership / roster context
- Team Needs
- Value Profile
- Comparison
- Queue

---

## Recommendations

1. Treat the current league CSVs as real league inputs.
2. Keep the Google Sheet as the operational truth.
3. Use roster, prospects, and veterans together, not as isolated lists.
4. Add explicit freshness awareness if the workflow depends on current sheet state.
5. Do not assume retention is fully explicit unless the sheet or import confirms it.
6. Reconcile player identity across sheets before treating any one player record as final.

---

## Conclusion

The Draft Hub is using actual league data, and the core fields needed for draft-day decision support are present.

What is still missing is not the league data itself, but a fully normalized, live-synced operational model.

That is acceptable for V1.0.2 as long as the Dashboard is treated as a snapshot-driven intelligence layer.
