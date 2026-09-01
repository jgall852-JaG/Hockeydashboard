# V1.0.1 Mock Draft Checklist

## Purpose

This checklist defines how the Draft Hub should be used during a realistic mock draft based on the league’s actual operating model.

The checklist is intentionally operational and review-only. It does not implement new features, change architecture, or add product scope.

The core principle is:

- Google Sheet remains the official league record
- the Dashboard is the intelligence layer for draft decision support
- a mock draft should be executed using the same discipline as the real league process

---

## Source-of-truth assumptions

The following sheets are the authoritative operational inputs:

- League Roster
- Draft Log
- Prospects
- Veterans

The Dashboard should read these as inputs for analysis, not as a separate legal ledger.

---

## Pre-Draft checklist

### A. Import requirements

- [ ] Import the most current League Roster data
- [ ] Import the current Draft Log or latest draft sequence snapshot
- [ ] Import the current Prospect pool
- [ ] Import the current Veteran list
- [ ] Confirm the imported data reflects the current league state, not a stale or partial export
- [ ] Confirm the imported data is consistent with the current draft calendar or round order
- [ ] Verify that the Draft Hub is using a current snapshot and not an old local copy

### B. Data verification

- [ ] Every owner in the league is represented in the imported roster data
- [ ] Each team has a current roster summary and team needs context
- [ ] Each drafted player is marked as selected or otherwise removed from the current board state
- [ ] Unselected prospects remain available for board analysis
- [ ] Veteran and prospect records are not duplicated across tabs without a clear rule
- [ ] Data conflicts are resolved in favor of the Google Sheet source of truth
- [ ] Missing or blank values are explicitly checked before the mock draft begins

### C. Retention verification

- [ ] Retained players are correctly reflected in roster state
- [ ] Any retained assets are excluded from the available pool where required
- [ ] All ownership assignments align with the latest league record
- [ ] Roster gaps are observable before the draft starts
- [ ] Retention-driven holes are visible to the Draft Hub for team need analysis

### D. Roster verification

- [ ] Each team's roster position counts are current
- [ ] Team needs are visible by position and roster priority
- [ ] Open slots are known before the first pick
- [ ] Current roster depth is understood for fit and scarcity analysis
- [ ] The Dashboard is not using stale team assumptions from a prior draft cycle

### E. Prospect verification

- [ ] Prospect list is complete and current
- [ ] Prospects are associated with the correct position and team context
- [ ] Available players are clearly distinguishable from already drafted or retired assets
- [ ] Player identity is consistent across the relevant tabs
- [ ] Any missing prospect metadata is noted before the mock draft begins

### F. Veteran verification

- [ ] Veterans are aligned with the current roster state
- [ ] Veterans are accurately associated with owners and team context
- [ ] Veteran status and roster pressure are consistent with the operating sheet
- [ ] Retention or aging assumptions are known before the draft starts
- [ ] Any veteran player that is not available or not relevant is excluded from the active board logic

---

## Draft Hub verification

Before running the mock draft, verify that the Dashboard's main decision-support surfaces are operating as designed.

### Search

- [ ] Player name lookup works reliably
- [ ] Searching by full name is stable and not interrupted by re-render behavior
- [ ] Search results align with the current imported player pool
- [ ] Searches do not produce a false sense of availability when a player has already been drafted

### Filters

- [ ] Filters are working against the correct imported player range
- [ ] Position filters are accurate and reflect the real board
- [ ] Team or owner filters align with the current roster state
- [ ] Filters are usable without losing the current draft context

### Queue

- [ ] Priority targets can be queued properly
- [ ] Alternate targets are visible and understandable
- [ ] Queue ordering reflects the manager’s actual draft strategy
- [ ] Queue state is not relying on stale board assumptions

### Best Available

- [ ] Best Available is being calculated from the current board, not a stale cached board
- [ ] Best Available is personal to the current draft context and latest imported state
- [ ] The list makes sense under the real draft flow, not just in a static test

### Scarcity

- [ ] Position scarcity reflects the current state of the available pool
- [ ] Scarcity signals are meaningful during a live mock draft timing window
- [ ] Scarcity is clear enough to support the decision: wait, take now, or pivot
- [ ] Scarcity analysis is not based on outdated or partial player data

### Team Needs

- [ ] Team needs are aligned to the actual roster state
- [ ] Priority holes are correctly identified by position and roster urgency
- [ ] Team needs are visible before and during the draft decision window
- [ ] The system distinguishes between immediate roster need and long-term strategic preference

### Comparison

- [ ] The manager can compare players against each other in a useful way
- [ ] Comparison is explainable and grounded in board value and roster fit
- [ ] Comparison does not require hidden assumptions or the latest data to be manually re-entered

### Value Profile

- [ ] Value profile is presented in a way the manager can interpret quickly
- [ ] Value signals align with the board and the team context
- [ ] High-value players are clearly separated from overvalued or opportunistic picks
- [ ] The manager can quickly decide whether a player matches the current value band

---

## Mock draft execution discipline

During the mock draft, the team should follow this order:

1. Refresh from the current sheet snapshot
2. Verify roster state and team needs
3. Recheck board availability and player pool
4. Review Best Available and scarcity
5. Check queue and alternate targets
6. Compare likely picks against roster fit and value profile
7. Make the pick in the official sheet
8. Refresh the dashboard after each meaningful change or board update

This preserves the correct operating loop:

- Google Sheet = official state
- Dashboard = recommendation layer
- Manager = decision-maker

---

## Release readiness check

A mock draft is ready to use when all of the following are true:

- [ ] the latest sheet data has been imported
- [ ] roster and retention state is verified
- [ ] the draft log and board order are current
- [ ] search, filters, queue, and scarcity are functional
- [ ] team needs and comparison tools are aligned to the real roster context
- [ ] the manager can explain why a pick is being made using the dashboard’s rationale

If any of these fail, the draft is not ready to be treated as a real or meaningful mock draft workflow.

---

## Final recommendation

The Draft Hub should be validated as a real decision-support tool under realistic draft conditions, not as a static demo. The goal is to confirm that the product helps a manager answer: “What should I do?” and, in the next phase, “Why should I make this pick?”
