# V11 Draft Modes Discovery

## Purpose

This document defines the real league workflow for the next draft-mode discovery phase. It is intentionally design-only and does not implement or redesign the product.

The design basis is the league’s actual operating pattern:
- main draft is conducted as an auction
- a supplementary draft follows as a snake draft workflow
- the system must support both modes with the same core player intelligence, value context, and decision support

The goal is to answer not what a hypothetical platform might do, but what a real GM needs during live league drafting.

---

## Core principle

Auction and snake drafting are not the same decision environment.

The system must treat them as two different draft modes, but with a shared underlying player and roster model.

- Auction mode is budget-driven and market-driven
- Snake mode is order-driven and board-driven
- Both modes still need the same player intelligence, scarcity context, and strategy fit

---

## 1. What information is needed during auction?

Auction draft work is dominated by budget pressure, roster vacancy, and live bidding behavior.

### Required information

1. Remaining budget
- current auction bankroll
- amount still available to spend
- what remaining room exists after mandatory roster obligations

2. Remaining roster spots
- open roster slots by position
- open slots overall
- whether the owner is still eligible to add a player at a particular position

3. Position scarcity
- which positions are thinning out in the available pool
- which positions are still deep enough to wait on
- whether the owner is at risk of missing a required position

4. Player pool and availability
- players still on the board
- players nominated or recently nominated
- players excluded by added cost or roster pressure

5. Bid state / live auction state
- current bid
- leading owner
- bid increments and escalation rules
- time left on the nomination
- current price band

6. Ownership and roster context
- current roster composition
- current need gaps
- prospective future roster shape at the end of the draft
- how many roster spots remain by position

7. Value context
- intrinsic player value
- current price relative to value band
- whether the player is over- or undervalued in the current auction environment

8. Auction risk indicators
- whether the player is likely to be a core asset or a short-term luxury spend
- whether the roster can support a high spend without damaging future flexibility
- whether the auction is at a point where inflation is distorting value

9. League rules and constraints
- salary or budget rules
- roster limits
- cap structure
- penalties or restrictions
- nomination rules

### Auction design implication

During auction, the system should not try to act like a pricing engine. It should help the user answer:
- Is this player worth the current price?
- Does the cost fit my roster and remaining budget?
- Is this position now scarce enough to justify the spend?
- Do I have enough flexibility left to compete after this move?

---

## 2. What information is needed during snake draft?

Snake draft mode is driven by draft order, board flow, roster gaps, and board dynamics rather than live bidding and budget pressure.

### Required information

1. Draft order and round status
- current owner on the clock
- pick number
- round number
- direction of the snake
- same owner’s next pick timing

2. Remaining pool
- players still available
- board rank by value
- positional pool depth remaining

3. On-the-clock context
- who is likely to be picked next
- who is the next likely target at the current position
- whether a value cliff is likely before the owner is on the clock again

4. Position scarcity
- what positions are evaporating before the owner returns to the clock
- whether waiting is viable
- whether a position is becoming structurally scarce

5. Team needs and roster strategy
- roster holes to fill
- immediate-production need vs long-term upside
- which positions are most urgent
- which picks are strategic vs opportunistic

6. Value profile
- intrinsic value
- expected value band
- risk band
- player fit relative to team strategy

7. Queue and target list
- priority targets
- alternate options
- must-have tier
- value escape hatches if selected players disappear

8. Board health and volatility
- players trending up or down in the board
- whether the market is moving faster than expected
- whether a player’s value is compressing or expanding in the current draft

9. Draft workflow state
- round-by-round status
- picks already made
- last picks and momentum of the draft
- which positions have already been drafted and who is left at the owner’s need spots

### Snake design implication

During snake draft, the system should help the user answer:
- Who is best available at this pick?
- Is this a good time to take the position I need?
- Is the drop-off too severe if I wait?
- Is my queue still intact, or is the board shifting?
- Is this player still the right fit for my roster plan?

---

## 3. What draft-state information should the system track?

The system should track a single shared set of draft-state data across auction and snake modes.

### Draft-state core fields

1. Draft mode
- auction
- snake supplement
- snake main draft
- paused or manual mode

2. Current pick state
- draft round
- pick number
- owner on the clock
- time remaining (if applicable)
- draft direction
- current status

3. Draft order state
- full order list
- owner sequence
- override flags for manual changes
- current owner index and next owner index

4. Player availability state
- board status by player
- selected / nominated / unavailable
- whether a player was drafted, nominated, or skipped

5. Ownership and roster state
- current roster composition per owner
- roster slots filled
- roster slots remaining
- league roster rules in effect

6. Budget and auction state
- remaining budget per owner
- highest bid and current bid position
- nominal price band for the player under discussion
- spent vs remaining budget

7. Queue and strategy state
- priority queue
- favorite players
- watchlist
- notes and strategy tags
- owner-specific ranking by target position

8. Position state
- remaining players by pool position
- position scarcity metrics
- current depth by position
- tier cliffs by position

9. Historical draft state
- prior picks
- previous rounds
- auction results or completed bids
- completed draft actions and timestamps

10. Data-status state
- source of truth for player data
- whether live enrichment is available
- whether the data is stale
- whether the board is synced to the current round

### Draft-state recommendation

The system should track draft state as an operational record, not as a set of disconnected screens. The board, queue, scarcity, and owner needs should all read from the same draft-state model.

---

## 4. How should draft order be managed?

Draft order is the central state variable in both auction and snake flows.

### Recommended order management model

1. Source-of-truth order record
- the system keeps a canonical draft-order list for the league
- the order should live in a single place and be visible in one view

2. Imported baseline order
- a draft order may be imported from league data or a pre-existing league calendar
- this gives the system a clean starting point and limits manual risk

3. Manual override for live draft changes
- if the league changes the order, pauses, or re-sequences picks, the GM must be able to edit the live order manually
- overrides should be tracked explicitly and not silently replaced

4. Snake behavior must be computed, not guessed
- snake direction should be derived from round and pick number rather than hand-maintained by the user
- the system should compute the next on-the-clock owner from the underlying order and round model

5. Auction order must be separate from snake sequence logic
- auction occasionally uses nomination order, not a traditional pick sequence
- the system should distinguish between nomination order and roster order
- nomination order should be visible and editable without confusing it with the snake sequence

6. Draft order should support both static and dynamic changes
- static order for a standard snake draft
- dynamic order for live auction nomination rotation or special-case league adjustments

### Operational rule

The system should never require the GM to manually rebuild the draft order from scratch every time the league changes a pick or resets a round. It should support an imported baseline plus a clear live override path.

---

## 5. Should draft order be imported or manually managed?

### Recommendation: hybrid model

The best operational answer is:
- import the draft order as the default baseline
- allow manual override during the draft when real-world league changes occur

### Why import is valuable

- reduces the chance of human error
- creates a clean canonical order for the league
- makes draft tracking easier across the season and across the board
- lowers setup time before a live draft begins

### Why manual management is necessary

- the league may change order after a trade or a league adjustment
- the GM may need to adjust a draft if a pick is missed or re-sequenced
- the system must support in-draft corrections without resetting the whole flow
- auction nomination order can change in real time in a way that is not always captured in static league data

### Recommended policy

1. Use import for the initial order
2. Treat imported data as authoritative baseline state
3. Permit manual override with explicit audit awareness
4. Save the final order state as the live draft order
5. Preserve the version/history of any manual change

### Rule of thumb

If the order is part of the league rules, import it.
If the order is part of the live draft operating environment, manually manage it.

The system should support both without confusion.

---

## Draft-mode design conclusion

The real draft workflow in this league is not one-size-fits-all.

The system should support:
- auction mode for budget-driven decisions and live bidding pressure
- supplementary snake draft mode for board-driven, order-based selection
- a shared state model that tracks draft order, roster state, player availability, value context, and queue strategy across both modes

The system should be built around the league’s real operational realities, not around a single abstract draft model.

The draft order should be imported as a baseline but remain manually adjustable in live draft conditions. This gives the product the reliability of structured setup and the flexibility of real draft execution.

The product is not really a draft system until it handles both modes without creating a separate strain on the GM.
