# V1.0.1 Auction Simulation

## Purpose

This document prepares a realistic auction-draft mock session using the league's actual workflow.

It is a planning and testing document only.

- no implementation
- no code
- no UI changes
- no new features

The goal is to define how the Draft Hub should be used during a real auction draft without turning it into a commissioner system or a pricing engine.

---

## Real league workflow assumption

The auction draft is treated as the live operational environment for the league.

Assumed flow:

1. Retentions are completed
2. League roster is updated
3. Budgets are available
4. A player is nominated
5. Bidding proceeds
6. A player is won
7. The Draft Log is updated

The Google Sheet remains the operational source of truth throughout the process.

The Draft Hub is the intelligence layer that helps the GM decide whether to bid, when to stop, and how the pick affects the roster.

---

## What the Draft Hub provides

During auction, the Draft Hub should help answer:

- Is this player worth the current price?
- Can I afford this without breaking the rest of my roster plan?
- Is the position scarce enough to justify the spend?
- What is the best alternative if I lose the bid?
- Does this player fit the current roster shape?

### Draft Hub support surfaces

- Best Available
- Team Needs
- Position Scarcity
- Queue
- Comparison
- Value Profile
- Confidence Labels

---

## What comes from Google Sheets

The Draft Hub should not invent auction state.

It should read the current live situation from the official league sheets:

- League Roster
- Draft Log
- Prospects
- Veterans

### Sheet-provided information

- completed retentions
- roster ownership
- current roster gaps
- budget availability
- nomination order or current auction order
- current player availability
- players already won
- official draft log updates
- commissioner corrections or overrides

---

## Auction simulation walk-through

### 1. Retentions complete

The league first finalizes retained players.

#### Draft Hub uses this to determine:

- current roster shape
- remaining positional holes
- budget pressure created by retentions
- whether certain positions must be targeted early

#### Missing information risk

- if retentions are not current, team needs and budget assumptions may be wrong
- if a roster correction is pending, the Draft Hub may overstate or understate need

### 2. League roster updated

The League Roster is refreshed to reflect the current team state.

#### Draft Hub uses this to determine:

- owner-by-owner roster needs
- open roster slots
- roster congestion at a position
- fit against the current owner structure

#### Missing information risk

- stale roster data can make a bad target look urgent
- the Draft Hub cannot reliably judge fit without current roster state

### 3. Budgets available

The auction begins with each owner's budget known from the official sheet.

#### Draft Hub uses this to determine:

- remaining spend room
- whether a bid is realistic
- whether a player fits the owner's remaining flexibility

#### Missing information risk

- if budget data is not current, the Draft Hub can only give partial guidance
- the Draft Hub should not attempt to become the budget authority

### 4. Player nomination

A player is nominated and enters the live auction state.

#### Draft Hub uses this to determine:

- current player under discussion
- player value versus current price pressure
- whether the player is a target or a pass
- alternate targets if the bid moves too high

#### Missing information risk

- if nomination state is not reflected promptly, the board may be stale
- the Draft Hub may still show the player as available if the sheet has not been refreshed

### 5. Bidding sequence

The live bidding process begins.

#### Draft Hub helps with:

- price vs value judgment
- roster fit under increasing cost
- scarcity awareness
- confidence in whether to continue bidding

#### Decision support boundary

The Draft Hub supports the decision.
It does not decide the bid for the user.

### 6. Player won

The player is awarded to an owner.

#### Google Sheets records:

- winning owner
- final cost
- pick or auction log entry
- updated roster state

#### Draft Hub then updates:

- player availability
- board state
- owner roster context
- queue and comparison context

### 7. Draft Log updated

The official Draft Log is the legal record of the transaction.

#### Draft Hub uses the updated log to:

- remove the player from availability
- refresh scarcity and best-available logic
- keep comparison and queue data current

---

## Where decisions are supported

The Draft Hub supports the GM most strongly at these moments:

1. before a nomination is nominated
2. immediately after a nomination appears
3. during an escalating bid
4. when deciding whether to stop bidding
5. when choosing the next target after losing a bid
6. after the transaction is recorded in the sheet

This is the real value of the Draft Hub in auction mode:

- decision support
- not operational control
- not live rule enforcement

---

## Where information may still be missing

The following gaps may still exist during auction simulation:

- delay between sheet update and dashboard refresh
- incomplete budget visibility if the sheet is not current
- incomplete nomination context if the auction order changes live
- missing or stale roster corrections
- uncertainty around manual commissioner overrides

These are acceptable as long as they are visible and the user knows the Dashboard is a snapshot-based intelligence layer.

---

## Auction readiness criteria

The auction mock session is ready when:

- retentions are confirmed
- roster data is current
- budgets are visible
- draft log is current
- nomination and winning-state updates can be reviewed
- queue, comparison, scarcity, and value profile are usable

---

## Final recommendation

For auction, the Draft Hub should be used as a live decision-support panel backed by the Google Sheet's official state.

The sheet owns the record.
The Dashboard owns the recommendation.
The GM owns the decision.
