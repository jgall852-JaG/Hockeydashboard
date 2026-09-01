# V1.0.1 Snake Draft Simulation

## Purpose

This document prepares a realistic supplementary snake draft mock session using the league's actual workflow.

It is a planning and testing document only.

- no implementation
- no code
- no UI changes
- no new features

The goal is to describe how the Draft Hub should be used during snake drafting and where the current workflow is strong or still limited.

---

## Real league workflow assumption

The supplementary draft is treated as an order-driven, board-driven workflow.

Assumed flow:

1. Draft order is imported or manually entered
2. The current pick is identified
3. Best Available is reviewed
4. Player comparisons are reviewed
5. Queue options are checked
6. The selection is made
7. The Draft Log is updated

The Google Sheet remains the official record.

The Draft Hub is the decision-support layer that helps the GM decide what to do on the clock.

---

## What the Draft Hub helps with

During snake draft, the Draft Hub should help answer:

- Who is best available right now?
- Should I fill a need or take the best value?
- Will this player still be there when I pick again?
- Is the queue still aligned with the board?
- Which player best fits the roster plan?

### Helpful surfaces

- Best Available
- Comparison
- Queue
- Team Needs
- Position Scarcity
- Value Profile
- Confidence Labels

---

## What comes from Google Sheets

The Draft Hub should rely on the official sheet for live snake state.

### Sheet-provided information

- draft order
- current round
- current pick
- owner on the clock
- players already selected
- current board state
- roster ownership
- current league roster shape
- available player pool

---

## Snake simulation walk-through

### 1. Draft order

The draft order is imported or manually entered before the mock session begins.

#### Draft Hub uses this to determine:

- who is on the clock
- which owner follows next
- when the user picks again
- how snake direction changes by round

#### Missing information risk

- if order is stale, the board will mislead the GM
- if a live adjustment occurs and is not entered, the next pick logic may be wrong

### 2. Best Available review

The Draft Hub shows the best players still available.

#### Draft Hub helps with:

- top-value identification
- board awareness
- quick fallback selection

#### Improvement still needed

- if the board snapshot is stale, Best Available loses trust
- if player identity or status is inconsistent, the ranking may feel less reliable

### 3. Comparison

The GM compares two or more players before selecting.

#### Draft Hub helps with:

- head-to-head evaluation
- roster fit differences
- scarcity-based tradeoffs
- confidence in the final choice

#### Improvement still needed

- comparison needs the current roster and board context to stay useful
- if one player is already removed in the sheet, the comparison must reflect that immediately

### 4. Queue management

The GM checks the queue to see whether the preferred targets are still realistic.

#### Draft Hub helps with:

- priority target order
- alternate targets
- backup plans if the board moves quickly

#### Improvement still needed

- queue health depends on current board state
- stale refreshes can make the queue feel better than it is

### 5. Selection

The GM makes the pick and records it in the official sheet.

#### Google Sheets records:

- selected player
- owner
- round
- pick number
- updated board state

#### Draft Hub then updates:

- availability
- best available list
- scarcity
- team fit
- comparison context

---

## Where the Draft Hub helps most

The Draft Hub is strongest in snake mode when the user needs quick confidence on the clock.

It is especially useful for:

- Best Available
- queue fallback planning
- position scarcity
- team-fit clarity
- value-based tradeoff review

---

## Where improvements may be needed

The current workflow may still need improvement in these areas:

- clearer draft order refresh procedure
- more explicit stale-data warnings
- faster visibility into when the board has changed
- clearer handling when a manually entered order changes mid-draft
- tighter linkage between board state and queue state

These are workflow gaps, not new feature requests.

---

## Snake readiness criteria

The snake mock session is ready when:

- draft order is current
- current pick is clear
- Best Available is trustworthy
- comparison is usable
- queue is organized
- team needs are aligned with roster state
- the GM can make and record the pick without confusion

---

## Final recommendation

For snake drafting, the Draft Hub should be used as a board-driven decision aid that stays synchronized with the official Google Sheet.

The sheet owns the order and record.
The Dashboard owns the analysis.
The GM owns the selection.
