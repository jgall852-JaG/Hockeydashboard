# V1.0.1 League Data Review

## Purpose

This document reviews the real league data sources that the Draft Hub should use during the mock draft and real draft workflow.

This is a review-only document. It does not implement, redesign, or expand the product.

The source-of-truth principle is:

- Google Sheet is the official operational layer
- the Dashboard is the intelligence layer
- the Dashboard should consume the sheet data it needs without becoming a second league ledger

---

## Approved data sources

The league’s operational source of truth is expected to be the following tabs:

1. League Roster
2. Draft Log
3. Prospects
4. Veterans

The Draft Hub should consume these as inputs for board intelligence, team needs, value profile, scarcity, and decision support.

---

## 1. League Roster

### Expected information

The League Roster is expected to represent the current operational state of owner roster composition. It is the clearest source for team shape, needs, and current roster status.

### What the Dashboard needs from this tab

- current owner roster assignments
- current roster size and roster gaps
- team composition by position
- current roster pressure and open slots
- retention or carryover assumptions if applicable
- ownership context for team fit analysis

### Required fields

At minimum, the tab should include:

- Owner
- Team Name
- Player Name
- Position
- Status or roster status
- Roster slot / roster count
- Whether the player is currently active or retained
- Team ownership mapping

### Recommended fields

For better Draft Hub use, the following fields are strongly recommended:

- Owner ID or owner label
- Team name
- Player name
- Position
- Current roster slot category
- NHL or league team association
- Retention status if applicable
- Current value or cost band if tracked by the league
- Notes for roster flexibility or strategic constraints

### Interpretation

This sheet is essential for:

- team-fit analysis
- roster need identification
- draft queue prioritization
- gap analysis before each pick

It should remain authoritative in Google Sheets and should not be re-created as a separate official state in the Dashboard.

---

## 2. Draft Log

### Expected information

The Draft Log is expected to represent the actual operational record of picks, draft sequence, and current draft progression.

This is the most important sheet for the live board state because it tells the Dashboard which players are gone and which picks are still pending.

### What the Dashboard needs from this tab

- current pick number
- round and direction status
- owner on the clock
- players selected
- draft order sequence
- which players are still available
- actual prior picks by round
- rule or override details if applicable

### Required fields

At minimum, the tab should include:

- Pick Number
- Round
- Owner
- Draft Order / Owner Sequence
- Selected Player
- Player Position
- Timestamp or sequence marker if tracked
- Draft status indicator

### Recommended fields

For a stronger Draft Hub workflow, the following fields are recommended:

- Round number
- Pick number within round
- Draft direction (snake / auction / special mode)
- Current owner on the clock
- Previous pick history
- Player team or league association
- Pick notes or comments
- Manual override flag if order changes or corrections occur

### Interpretation

This sheet is the operational record of what happened and what happens next. It should not be duplicated by the Dashboard as a second official ledger.

It is the main source for:

- board availability
- pick sequencing
- draft-order state
- dynamic board adjustments
- realism during auction and snake mock-draft usage

---

## 3. Prospects

### Expected information

The Prospects tab is expected to represent the long-list of current players being considered for the draft pool. It is a key input for the available board and value analysis.

### What the Dashboard needs from this tab

- player identity
- position
- current team / league association
- current pool status
- player value or projected relevance
- comparison basis across the prospect board
- availability assumptions within the relevant draft window

### Required fields

At minimum, the tab should include:

- Player Name
- Position
- Current Team / league association
- Prospect status indicator
- Whether the player is considered active / available / eligible

### Recommended fields

For best use in the Draft Hub, the following fields are strongly recommended:

- First and last name
- Position
- Team / league association
- Age or draft age if tracked
- Category (prospect / veteran / special case)
- Current production or prior-season context where available
- Value tier or projection band
- Player notes or remarks
- Whether the player is currently rostered, retained, or eliminated from the active pool

### Interpretation

The Prospect list should feed:

- Best Available
- scarcity math
- comparison logic
- value profile
- fit and risk analysis

The Draft Hub should use this data as an input, not as a duplicate operational record.

---

## 4. Veterans

### Expected information

The Veterans tab is expected to represent the current veteran pool, including players who are already part of the league's rostered or retained structure. This matters because veteran status often interacts with roster pressure, retention decisions, and team-fit logic.

### What the Dashboard needs from this tab

- current veteran pool status
- ownership context
- veteran value or role in the roster
- whether the player is in or out of the draft-relevant ecosystem
- retention or roster pressure information if tracked by the league

### Required fields

At minimum, the tab should include:

- Player Name
- Position
- Team / owner association
- Veteran status indicator
- Current roster relationship

### Recommended fields

For a more useful Dashboard workflow, the following fields are recommended:

- Player name
- Position
- Team / owner association
- Age and role context
- Retention status or cost if part of league rules
- Current roster category or status
- Notes about value / role / trade or retention relevance
- Whether the player adds roster pressure or impacts team needs

### Interpretation

Veterans help the Draft Hub understand:

- current roster shape
- which positions are already occupied or congested
- where team needs are most acute
- whether a prospect is a better fit than a current veteran option

This is a key input to team-fit and value analysis, but it remains operationally owned by the league sheet.

---

## Cross-tab review and data overlaps

The main overlap risk is that the same information appears in multiple tabs and can drift if the Dashboard starts treating the sheet data as a duplicate ledger.

### High-risk overlap areas

1. Ownership and roster state
   - overlap between League Roster and the Dashboard team view

2. Player pool and player availability
   - overlap between Prospects, Veterans, and the Dashboard board

3. Draft progression and current board state
   - overlap between Draft Log and the Dashboard board / pick tracker

4. Retention and roster adjustments
   - overlap between Veterans and League Roster

### Rule

The Dashboard may derive intelligence from these overlaps, but the official league state should remain in the Google Sheet.

---

## Minimum acceptable dataset for Draft Hub use

The Dashboard should be able to operate with a minimum data model that includes:

- Owner / team identity
- Player identity
- Position
- Current roster or status flag
- Draft availability / selected status
- Current board order if this is a live or mock draft
- Team gap / roster need signals

### Required operational baseline

Before a mock draft is treated as valid, the following must be true:

- roster state is current
- draft log is current
- prospects and veterans are current
- ownership is consistent across tabs
- all player identity fields align

---

## Recommended fields summary

### Core required fields for all tabs

- Player Name
- Position
- Owner or Team association
- Status or availability flag
- Current roster or league context

### Strongly recommended fields for Board intelligence

- Current availability
- Draft order / pick status
- Team gap / position need
- Retention or roster pressure context
- Notes or value/role comments

---

## Final recommendation

The league data should be treated as a set of operational inputs, not as a second platform state.

The best model is:

- Sheet keeps the official data
- Dashboard reads the current snapshot
- Dashboard computes intelligence from the imported data
- user decisions are made in the sheet as the legal record

This preserves the real league process while allowing the Draft Hub to remain a focused decision-support tool.
