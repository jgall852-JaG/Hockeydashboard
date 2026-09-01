# V11 Draft Operations Integration

## Purpose

This document defines the operational boundary between the AHL Draft Google Sheet and the Hockey Dashboard during the league’s actual draft process. It is intentionally design-only and does not implement or redesign the product.

The core principle is simple:

- the Google Sheet is the operational source of truth for live draft transactions
- the Hockey Dashboard is the intelligence layer for decision support
- the dashboard should not become a second operational ledger that can drift away from the actual league process

This keeps the real draft workflow grounded in the league’s source of truth while preserving the Dashboard’s value as a decision tool.

---

## 1. Operational model

The league already has a working operational process: a live draft sheet captures the legal transactions and the current state of the draft. The Dashboard should augment that process, not duplicate it.

### Recommended split of responsibilities

Google Sheet owns:
- actual picks made
- draft order and round status
- owner on the clock
- player selected by each owner
- timestamps or recorded draft moments
- commissioner notes, overrides, and exceptions
- any rules enforcement or official league state

Hockey Dashboard owns:
- best available rankings
- value profile and risk bands
- position scarcity
- team needs and roster fit
- draft queue and alternate targets
- player comparison and board logic
- strategic advice and draft planning
- decision support for the next pick

This is not a theoretical distinction. It is the practical separation between a legal ledger and an intelligence product.

---

## 2. Data ownership matrix

### A. Data that belongs in the Google Sheet

These are operational facts that have to be impossible to question at draft time.

1. Draft result log
- pick number
- round
- owner
- chosen player
- timestamp or sequential order
- picks remaining

2. Draft order
- baseline order
- snake direction
- current owner on the clock
- order adjustments for live changes
- manual overrides

3. League state
- roster counts
- owner status
- commissioner-controlled exceptions
- draft pauses or hold states

4. Rule state
- budget or auction conditions if applicable
- nomination rules
- penalties or corrections
- document of what actually happened

5. Official notes
- abandoned picks
- waiver/reserved exceptions
- manual corrections
- final recorded state for league record

### B. Data that belongs in the Hockey Dashboard

These are decision-support facts that help the GM decide what to do next.

1. Player intelligence
- value score
- risk band
- upside profile
- position scarcity
- relative strength versus board

2. Team strategy
- roster gaps
- positional need urgency
- queue priorities
- preferred targets and backups
- board fit analysis

3. Draft planning context
- best available at the moment
- player comparison matrix
- likely next picks by other owners
- draft cliff analysis
- dynamic board changes

4. Tactical recommendations
- “take this now or wait” guidance
- queue health and drop-off risk
- position replacement options
- best fit under current roster circumstances

### C. Data that should not be duplicated in both places without a clear contract

The Dashboard should avoid becoming a second authoritative record for:
- actual draft picks already made
- official league order
- league rule outcomes
- commissioner-approved overrides
- final transaction history

If the Dashboard attempts to own these directly, it will drift and create confusion.

---

## 3. Recommended workflow

### Draft-day operating flow

1. The league records the live draft in the Google Sheet.
2. The sheet remains the canonical record of actual picks and current board state.
3. The Dashboard reads the sheet or a structured export as a reference snapshot.
4. The Dashboard computes intelligence based on that snapshot.
5. The GM uses the Dashboard to decide the next move.
6. The decision is then executed in the sheet as the official draft record.

This creates a clean operating loop:

Sheet = official state
Dashboard = recommendation layer
User = decision-maker

### The important boundary

The Dashboard should never be the place where a pick becomes “official” without reconciliation to the sheet. The Dashboard may analyze and recommend, but it must not overwrite or silently replace the league’s actual operational record.

---

## 4. Integration options

### Option A: Manual import from Google Sheet

This means the sheet is updated live by the league, and the Dashboard is refreshed by importing the relevant sheet data or CSV export.

Pros:
- very low complexity
- keeps governance in the spreadsheet
- aligns with current browser-first architecture
- easy to operate under real draft pressure
- no backend or new infrastructure required

Cons:
- requires a manual refresh step
- can lag behind the live sheet if not done carefully
- creates some operational friction in fast-moving drafts

Verdict:
- best V1.1 option for low-risk and successful release

### Option B: CSV export / import cycle

This means the dashboard accepts a prepared CSV snapshot exported from the sheet at set intervals.

Pros:
- structured and simple
- easy to inspect and audit
- stable and portable
- works well with the project’s local-first model

Cons:
- still manual
- export/import must be disciplined to avoid stale data
- not ideal if the league expects live synchronization

Verdict:
- viable and low-risk
- good fallback or baseline integration method

### Option C: Direct sheet sync or API-backed connection

This would allow the dashboard to read live sheet data automatically.

Pros:
- strongest live experience
- reduces repeated manual steps
- better for fast draft operations

Cons:
- adds complexity, access requirements, and infrastructure dependencies
- introduces brittle integration risk
- does not fit the project’s current disciplined no-architecture-change posture
- likely too much for V1.1 if the team wants a successful release

Verdict:
- not recommended for the approved V1.1 scope unless a real operational requirement emerges

### Option D: Hybrid model

This means the sheet remains authoritative and the dashboard accepts periodic imports or snapshots. This is the most realistic and safest operational approach.

Pros:
- preserves clean source-of-truth structure
- keeps the project in its current architectural lane
- enables rapid value without introducing new infrastructure risk
- supports offline and laptop-based drafting

Cons:
- not truly live
- depends on disciplined refresh steps

Verdict:
- recommended default operating model for V1.1

---

## 5. Risks and failure modes

### 1. Dual-source confusion

The biggest risk is that the Dashboard and the Google Sheet drift apart and the user cannot tell which one is authoritative.

Mitigation:
- keep the Google Sheet as the only official draft ledger
- ensure the Dashboard clearly labels imported data as a snapshot, not the official record

### 2. Stale intelligence

If the Dashboard is not refreshed, a GM may act on outdated board conditions.

Mitigation:
- refresh from a sheet snapshot before each decision window
- keep a visible “last synced” timestamp
- define a required refresh procedure during draft day

### 3. Over-automation of a human process

The Dashboard could become expensive to maintain if it tries to act like a commissioner tool or a real-time operational system.

Mitigation:
- keep the Dashboard focused on decision support
- avoid implementing league operational rules inside the dashboard

### 4. Browser/local state mismatch

Because the dashboard is browser-local and machine-specific, the user may have stale local data when moving between laptop and desktop.

Mitigation:
- treat imported sheet snapshots as the reliability layer
- avoid making localStorage the only draft-day continuity mechanism

### 5. Manual work burden

If the workflow depends on too many manual import steps, users may skip them under stress.

Mitigation:
- define a very small set of required actions
- keep the import flow as simple as possible
- prefer a single structured snapshot import over a multi-step process

---

## 6. Offline strategy

The dashboard should remain usable even if:
- the spreadsheet is inaccessible
- the internet is down
- the draft is being run from a fresh laptop
- the user is away from the usual workstation

### Offline-safe design principles

1. The Dashboard should run from a local bundle or repo-backed static workflow.
2. The Google Sheet should be treated as a convenience source for live updates, not as the only route to usable draft intelligence.
3. If the sheet is unavailable, the last imported snapshot should still be usable as a working state.
4. The Dashboard must not hard-depend on a live connection to function.

### Recommended offline behavior

- maintain the last imported board snapshot locally
- allow the user to continue drafting based on the last known board state
- clearly mark snapshot age and data freshness
- do not claim the snapshot is live if it is not

This is consistent with the project’s local-first operating model and reduces risk under real-world draft conditions.

---

## 7. V1.1 recommended scope

The recommended V1.1 draft-operations integration is intentionally narrow.

### Must Have

1. Sheet-to-dashboard import of draft state
- current picks
- remaining board status
- draft order
- owner on the clock

2. Clear source-of-truth rules
- sheet is official
- dashboard is advisory

3. Snapshot freshness labeling
- last import time
- whether state is stale
- whether data is current enough to trust

4. Simple manual refresh process
- one clear import or sync action
- minimal steps for a busy draft room

5. Offline-safe local snapshot support
- use last good state when network access fails

### Should Have

1. CSV export from the sheet for dashboard import
2. board snapshot formatting aligned to dashboard expectations
3. manual override support where the live sheet changes outside the normal order pattern
4. visible draft-status indicators in the dashboard

### Nice to Have

1. automatic refresh via direct sheet connection
2. richer import validation and mismatch warnings
3. import history and snapshot comparison
4. notes or tags carried from sheet to dashboard

### Future

1. live synced operational environment
2. commissioner workflow inside the dashboard
3. auction engine or budget modeling
4. full league operations dashboard
5. bi-directional operational updates from dashboard to sheet

---

## 8. Implementation order

### Phase 1: define the boundary
- confirm the Google Sheet is official
- confirm the Dashboard is decision support only
- document the exact fields the dashboard should consume

### Phase 2: establish import discipline
- define a simple import contract
- standardize column names and sheet layout
- decide whether the import is CSV or structured sheet export

### Phase 3: add snapshot workflow
- import draft state into dashboard
- show last synced time
- show stale state warnings
- keep a local fallback snapshot

### Phase 4: evaluate operational polish
- improve manual override handling
- improve mismatch alerts
- add board-state confidence indicators

### Phase 5: only later, consider automation
- direct live sync
- API-backed integration
- richer commissioner workflow
- further operational features

---

## 9. Final recommendation

The right V1.1 model is a hybrid but disciplined one:

- Google Sheet remains the official operational record
- Hockey Dashboard remains the intelligence and strategy layer
- the dashboard reads draft snapshots from the sheet, not vice versa
- the system is designed to tolerate offline conditions and stale connectivity
- the integration remains intentionally simple so that the project ships successfully without creating a second ledger or an operationally fragile platform

This is the smallest version of the integration that still deserves to be called “draft operations support.” It preserves the project’s architecture, respects the league’s actual workflow, and keeps the Dashboard useful without letting it become a second draft system.

## Recommendation summary

Use manual import + snapshot continuity as the V1.1 standard.
Do not make the dashboard a live operational sheet replacement.
Do not add a new backend or a real-time sync layer unless the league later identifies a true operational requirement.

That is the correct release-safe direction for the next phase.
