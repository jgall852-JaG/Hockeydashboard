# V1.1 Context Gap Analysis

## Purpose

This review answers a narrow question:

How much of the league data is currently influencing Draft Hub decisions?

It compares the available league context against the fields the Draft Hub actually uses today.

No implementation changes are made here.

---

## 1. Available League Context

The current league data includes these meaningful context layers:

- Ownership
- Cost
- Term remaining
- Matching rights
- Veterans
- Prospects
- League roster state

### What the data can tell the GM

- who owns the player
- how much the player costs
- how long the player remains controlled
- whether matching rights exist
- whether the player is a prospect or veteran
- how the current roster shape affects need

### Real data availability

The league CSVs confirm that these fields exist in practice, especially in the Prospects and Veterans files.

---

## 2. Context Currently Used

### A. Comparison

Currently used:

- player value
- position
- relative value between two players

What this means:

- comparison is mostly value-versus-value
- roster fit only enters as a secondary fallback

Not currently used directly:

- ownership
- cost
- term
- rights
- roster history beyond position fit

### B. Team Fit

Currently used:

- roster context
- position
- value
- matching rights
- risk band

What this means:

- team fit is partially contextual
- it understands the player type and basic roster shape
- it does not yet fully reason from ownership or contract structure

Not currently used directly:

- exact ownership pressure
- roster-specific retention strategy
- full term-based planning

### C. Scarcity

Currently used:

- position counts in the active player pool

What this means:

- scarcity is a board-depth signal
- it is not a league-economic signal

Not currently used:

- ownership
- cost
- term
- rights
- retention status

### D. Confidence Labels

Currently used:

- value band
- risk band
- matching rights
- comparison value
- scarcity score

What this means:

- confidence is the most decision-like layer
- it combines several signals, but still leans heavily on value and scarcity

Not currently used directly:

- explicit ownership logic
- contract pressure modeling
- full retention context

### E. Value Profile

Currently used:

- player value
- contract value / cost
- term remaining
- age
- matching rights
- source type
- value band
- risk band

What this means:

- this is the richest context panel today
- it already uses most of the available league fields
- it is the closest thing to a full explanation layer

Not currently used directly:

- ownership strategy
- league-wide budget pressure
- roster-wide retention planning

---

## 3. Context Currently Missing

The following context exists in the league data or workflow but is not strongly influencing the Draft Hub yet:

- explicit ownership pressure as a decision factor
- explicit retention strategy by owner
- contract-term planning beyond simple risk wording
- league-side budget or auction state
- live roster-construction intent by owner
- transaction history as a decision input

### Missing by panel

#### Comparison

Needs:

- ownership
- cost
- term
- rights
- roster fit

#### Team Fit

Needs:

- current owner context
- retained/controlled asset pressure
- longer-term roster shape

#### Scarcity

Needs:

- not more player depth alone
- scarcity combined with ownership and roster need

#### Confidence Labels

Needs:

- stronger use of ownership and contract context
- clearer distinction between “good player” and “good pick”

#### Value Profile

Needs:

- a clearer bridge from raw league data to GM action
- more direct ownership and retention interpretation

---

## 4. Highest-Impact Improvements

The highest-value improvement is not adding more data.

It is surfacing the data the league already has in a way the GM can use quickly.

### Highest-impact context to surface

1. Ownership
2. Cost
3. Term remaining
4. Matching rights
5. Retention status

### Why these matter most

- ownership changes the decision context immediately
- cost changes whether a player is a value or a burden
- term changes whether the player is a short-term or long-term fit
- matching rights change flexibility
- retention status changes the whole roster picture

### Best panels to expose them in

- Value Profile
- Team Fit
- Comparison
- Confidence Labels

---

## 5. Recommendation

The Draft Hub is already using real league data, but the influence is uneven.

### Current shape

- Value Profile: strongest use of league context
- Confidence Labels: good synthesis, but still value-heavy
- Team Fit: useful but still simplified
- Comparison: too value-centric
- Scarcity: board-centric, not league-context-rich

### Recommended direction

Surface league context to the GM in this order:

1. ownership
2. cost
3. term
4. matching rights
5. retention status

Then use that context to make Comparison and Team Fit more decision-relevant.

### Final judgment

The Draft Hub currently uses some of the league context well, especially in Value Profile.

But the most operationally important fields are still underused in Comparison and Team Fit, and almost absent from Scarcity.

If the goal is better draft decisions, the next priority is clearer surfacing of ownership, cost, term, rights, and retention context to the GM.
