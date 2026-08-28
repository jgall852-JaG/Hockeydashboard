# V10 Draft Hub Discovery

Status: V1.0 discovery draft

This document is a design-only discovery memo for the future Draft Hub. It is not an implementation plan, not a production build, and not a redesign of V0.6–V0.9. It intentionally assumes the completed Hockey Dashboard platform is already in place and uses the existing architecture and source-of-truth rules as the starting point.

## Source-of-truth assumptions

The platform already answers:
- Who is this player?
- How good is this player?
- How much opportunity does this player have?
- What is happening right now?
- What is this asset worth?

The Draft Hub must extend that platform into a practical decision-making surface for draft day without breaking the principles already defined in the project library and roadmap:
- local CSV data remains authoritative
- live NHL data remains enrichment only
- browser-first, local-first execution remains the default
- the app must remain useful on a draft laptop, on a fresh machine, and under imperfect connectivity
- no backend redesign or framework change is introduced as part of this discovery

## Strategic intent

The new question is not a new data model. It is a new operating model: What should I do?

The Draft Hub is the fantasy hockey draft-day command center. It is not a standalone ranking engine. It is a decision support layer that helps the user interpret the board, understand scarcity, compare value, and act with confidence under pressure.

The product should feel like:
- Fantasy GM
- Draft War Room
- Front Office Dashboard
- Decision Support System

## Core design objective

The Draft Hub must help the user answer, in under a few seconds:
- Who is available?
- Who is best available?
- What positions are scarce?
- What assets are undervalued?
- What players fit my strategy?

This is a decision surface for human judgment, not a black-box recommender. It should reveal context, not hide it.

---

# 1. Draft Hub Vision

## Purpose

The Draft Hub is the main draft-day screen. It is the single place where the user can absorb the pool, understand the board, and decide what to do next. It should feel calm, fast, and high-signal, even when the draft is moving quickly.

## Main job to be done

The Draft Hub should synthesize the board into a short list of meaningful answers:
- which players remain available
- which players are the highest-value names still on the board
- which positions are thinning out
- whether a player is being pushed up/down relative to intrinsic value
- whether a target aligns with the user’s strategy or roster gap

## Recommended screen structure

### A. Header / status rail
The top of the screen should show the user’s current operating context:
- current pick number
- draft clock / time remaining
- league format
- roster slots remaining
- current owner position and draft order
- data status (local data, live enrichment, stale cache warning if applicable)

### B. Strategy and roster summary
This should provide a compact “why am I drafting here?” context block:
- team needs
- roster gaps
- preferred build strategy
- target ranges by position
- next pick concerns
- picks remaining before the user is on the clock again

### C. Available player pulse
This is the most important action surface:
- a ranked list of best available players
- positional grouping or tier grouping
- value delta against current board
- icons for fit, scarcity, team need, and undervaluation
- quick actions: add to queue, favorite, note, compare

### D. Scarcity and opportunity panel
This should make market conditions obvious:
- most scarce positions
- position depth summary
- overrepresented position groups
- positions with real breakout opportunity
- “drop-off threshold” between tiers

### E. Value intelligence panel
This panel explains whether a player is a buy or a hold:
- intrinsic value
- market value
- value gap
- relative ranking against peers
- “undervalued” and “overvalued” flags based on context

### F. Fit matrix
The Draft Hub should answer whether a player matches the user’s plan:
- roster need match
- position strategy match
- timeline fit
- cost / price sensitivity
- prospect vs veteran preference
- immediate production vs future upside

## Draft Hub design principles

- show the board, not a wall of data
- prioritize ranked decisions over raw player lists
- separate player identity from player decision context
- make scarcity obvious before detail overload sets in
- keep the “best available” answer visible without requiring drill-down
- treat strategic fit as a first-class output, not a secondary filter

## Success criteria

The draft screen should make the user feel like they are running a real draft with a front office dashboard, not browsing a spreadsheet.

---

# 2. Draft Board Vision

## Purpose

The Draft Board is the foundational planning surface beneath the Draft Hub. It gives the user a broader, structured view of the available talent and organizes it by board logic instead of raw roster noise.

## Board types

### Overall Board
The overall board is the primary draft map. It should rank the best available players across the full pool and allow the user to move between context layers without losing the board state.

Features:
- overall rank
- positional context
- projected value band
- tier assignment
- opportunity and schedule context
- watchlist, favorite, and notes markers

### Positional Board
The positional board highlights scarcity and depth by position. It should make it obvious where the market is thin and where the user can wait.

Ideal features:
- rank by position
- position scarcity heatmap
- drop-off between top-tier and next-tier players
- position-specific value windows
- ability to compare between similar players at the same spot

### Prospect Board
The prospect board should surface the players with future upside and developmental timelines.

Use it to answer:
- who is the best upside play still available?
- which prospects fit the team’s timeline?
- how much future upside exists in the pool versus immediate production?

### Veteran Board
The veteran board helps distinguish current production from future value.

Use it to answer:
- who is already valuable in the current season?
- who is an aging asset with limited upside?
- which veterans are being overvalued relative to availability and team need?

## Board functionality

### Tiering
Board segments should be grouped into clear tiers, not just raw rank order. Tiering helps the user understand value cliffs and drop-offs.

Examples:
- Tier 1: franchise anchors
- Tier 2: immediate starters
- Tier 3: playoff starters / high upside
- Tier 4: depth or role players
- Tier 5: speculative upside

### Filters
The board should support high-quality filtering without becoming a maze.

Recommended filters:
- position
- league format
- team need match
- value range
- prospect/veteran flag
- age / cohort
- playing time / opportunity context
- owner favorites / watchlist

### Search
Search should support fast player lookup with context.

Examples:
- player name
- team
- position
- owner or roster fit
- current value band
- watchlist membership

### Watchlists
A watchlist captures players the user is monitoring without committing to a pick.

Best uses:
- handoff from discovery to draft queue
- queue building for a later round
- tracking likely landing spots
- watching scarcity shifts as the board evolves

### Favorites
Favorites are a more intentional commitment than a watchlist. They should represent players who matter most to the user’s strategy.

### Notes
Notes should remain lightweight and contextual rather than product-heavy.

Useful examples:
- “best value if RW drops”
- “great fit for my aging core”
- “watch this one if he falls into round 6”
- “needs a roster spot soon”

## Board design principle

The board should be the user’s source of truth for the current draft environment, not just a static list. It should make value, scarcity, and fit visible at a glance.

---

# 3. War Room

## Purpose

The War Room is the single-screen decision experience for draft day. It is the moment where the user turns board awareness into a pick decision.

## Core experience

The War Room should combine every high-signal input in one place without forcing the user to switch tabs or hunt for data.

### Best Available
The front-and-center answer to “who is still worth taking?”

Includes:
- best player available by overall value
- best player available by position need
- value-tier comparisons
- immediate fit indicators

### Position Scarcity
This should make the market conditions explicit:
- which positions are drying up
- which spots are deeper than expected
- whether the user should take a scarce position now or wait

### Player Intelligence
This is the user’s operational context for a specific player:
- who they are
- current role and opportunity
- history and trend lines
- team or roster fit
- upside or risk profile

### Historical Stats
This is the trusted player-performance history layer. It should surface the evidence, not drown the user in noise.

Examples:
- recent performance trend
- season-long baseline
- production consistency by role
- role-specific stat context

### Schedule Opportunity
The War Room should include the tactical impact of the schedule and the team context.

Examples:
- upcoming games and matchup quality
- short-window opportunity spikes
- schedule-driven value shifts
- how schedule interacts with roster need and lineup certainty

### Value Engine
This section should show why a player is, or is not, worth the pick.

It should separate:
- intrinsic asset value
- current market value
- opportunity-adjusted value
- strategy-fit value

This should support better decision-making without pretending to remove the human element.

### Draft Queue
The queue is the user’s order of preference and decision list.

Includes:
- ranked targets
- handoff from board to pick
- priority by need and value
- watchlist-to-queue conversion
- ability to revise the queue as the board changes

### Team Needs
This should show the roster gaps and strategic priorities at a glance.

Examples:
- Need Center
- Need RW
- Need Prospect Depth
- Need Goaltending
- Need Cheap Assets
- Need Immediate Production

## War Room tradeoff philosophy

The user needs one-screen clarity, not dozens of disconnected panels. The War Room should favor explicit signal and fast choices over deep exploration at the wrong moment.

## War Room output

The ideal war room makes the user able to declare:
- I am taking the best available player
- I am taking the highest-value positionally scarce player
- I am punting to fill a strategic need
- I am waiting because the board is still strong enough
- I am buying upside even if the valuation is not perfect

---

# 4. Auction Engine Discovery

## Scope

This is a future concept only, not a current implementation target. It must be separated completely from intrinsic asset value.

## Purpose

Auction strategy is a different problem from player valuation. The Draft Hub can estimate intrinsic asset value, but auction decisions depend on dynamic economics that the board alone cannot solve.

## Potential inputs

Possible auction inputs include:
- remaining budget
- remaining roster spots
- position scarcity
- available player pool
- inflation pressures
- nomination effects

## Critical design rule

Intrinsic asset value and auction strategy must remain distinct concepts.

The player valuation engine answers:
- How good is this asset?
- How much is it worth in a balanced market?

The auction engine answers:
- What should I spend given the league dynamics, remaining roster slots, and budget pressure?

## Why it stays separate

A player may be intrinsically valuable while still being a poor auction spend in a specific moment. Auction behavior is influenced by league psychology, roster construction, and dynamic scarcity, not just player quality.

## Future concept only

This module should be documented as a future area of study, not folded into the current value engine or draft board.

---

# 5. Team Needs Engine

## Why it matters

A roster page should not merely show players. It should tell the user what the team is missing and what is most important to solve next.

## What a team needs view should know

Examples of roster intelligence signals:
- Need Center
- Need RW
- Need Prospect Depth
- Need Goaltending
- Need Cheap Assets
- Need Immediate Production

The needs engine should translate roster context into a clear operating plan:
- which positions are underrepresented
- which needs are urgent versus optional
- which players are designated to fill gaps
- what the roster will look like after the next few picks
- what value remains available to solve each gap

## Team needs should not be treated as static labels

Needs are dynamic. They evolve as:
- players are drafted
- current roster composition changes
- a team chooses an aggressive or conservative build
- scarcity at a position spikes or cools

## Strategic value

The team needs engine turns a simple roster summary into an actual strategy layer. This is essential for a draft-day decision support system.

---

# 6. Draft Workflow

## Ideal flow

Open Dashboard
↓
Load League Data
↓
Review Team
↓
Review Draft Board
↓
Build Queue
↓
Monitor Scarcity
↓
Make Pick
↓
Update Board

## Workflow intent

The draft-day flow should be simple and resilient:
- open a known-good dashboard
- load the league state
- review team needs and fit
- scan the board for scarcity and value
- prioritize targets in a queue
- monitor changes as the board evolves
- make a pick with enough context to act confidently
- update state and reset for the next decision

This isn’t a complicated process. It is a disciplined loop with clear signals.

---

# 7. Commissioner View

## Purpose

The Commissioner View is the league-wide control surface. It is designed for draft tracking and league operations rather than for user-specific decision-making.

## Major surfaces

- Draft Tracking
- Pick Tracking
- Trade Tracking
- League Activity
- Future Pick Ownership
- Draft History

## Why it matters

The commissioner experience keeps the league organized and visible without making the draft environment chaotic. It should surface the operational truth of what is happening while allowing the Draft Hub to remain focused on decisions.

## Operational design goals

- track who is on the clock
- show the sequence of picks and trades
- preserve league activity history
- highlight future pick ownership
- provide a clean retrospective of past decisions

---

# 8. Portability

## Operating assumption

The draft is done from a laptop. The desktop is off.

The Draft Hub should therefore behave as a laptop-first decision tool, not a desktop-only workflow.

## Findings from the portability and delivery strategy

The project already establishes the correct direction:
- GitHub is the durable source of truth
- local data stays authoritative
- live NHL data remains enrichment
- portable launch methods are a real requirement for draft day
- the app must survive fresh-machine startup and laptop-only operation

## Recommendation

Use a hybrid model:
- GitHub repo as the canonical project state
- portable local bundle as the emergency draft-day execution path
- optional cloud access only as a convenience layer
- localStorage treated as ephemeral and not the primary reliability mechanism

## Portability design principles

- no dependence on one physical machine
- no dependence on one browser profile
- no dependence on a powered desktop machine
- no dependence on a fragile live data connection for the basic draft workflow
- clear launch process that can be repeated by a user under pressure

## Operational conclusion

The Draft Hub should be designed to work on a draft laptop with a clean startup path, clear versioning, and a known-good portable bundle. It should feel operationally reliable even when the environment is not.

---

# Final discovery summary

The V1.0 Draft Hub should not replace the platform; it should extend it into a fast, high-signal, draft-day decision surface.

The correct product posture is:
- use the completed dashboard as the foundation
- keep the local-first source-of-truth rules intact
- make scarcity, value, team fit, and opportunity visible immediately
- give the user a board and a real-time war room, not a heavy reporting app
- support draft-day portability and resilient access without redesigning the architecture

The end goal is a command center that helps the user answer the one question that matters most during a draft:

What should I do?
