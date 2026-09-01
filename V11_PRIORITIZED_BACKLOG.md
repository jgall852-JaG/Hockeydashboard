# V11 Prioritized Backlog

## Bottom line

The next 90 days should prioritize draft-day speed, league truth freshness, and clearer decision context.

## P0 (Must Fix)

### 1. Google Sheet refresh workflow

- Description: make the operational truth refresh fast and reliable so ownership changes, retentions, trades, and draft-order updates are reflected before decisions are made.
- Draft-day value: very high
- User impact: very high
- Complexity: medium
- Risk: high
- Dependencies: current sheet import/load flow, data refresh triggers, error handling, source-state reconciliation
- Why now: real league operations change constantly, and stale truth is the fastest way to make a bad pick.

### 2. Compact league context on Draft Hub rows and comparison

- Description: surface ownership, cost, term, matching rights, and retention status directly in the fastest Draft Hub surfaces.
- Draft-day value: very high
- User impact: very high
- Complexity: medium
- Risk: medium
- Dependencies: player data shaping, Draft Board row rendering, comparison rendering, field normalization
- Why now: the biggest hesitation is still "I wish I could see..." during fast decisions.

### 3. Stronger comparison delta

- Description: make comparison explain the actual difference between two close players in one clear read.
- Draft-day value: very high
- User impact: high
- Complexity: low to medium
- Risk: low to medium
- Dependencies: existing comparison logic, value/risk signals, team-fit summary
- Why now: comparison is already useful; it just needs to be more decisive.

## P1 (Highest Value)

### 4. One-click handoff from Draft Hub to Players and Teams

- Description: make it easy to jump from a draft decision into deeper player or team context without re-searching.
- Draft-day value: high
- User impact: high
- Complexity: medium
- Risk: medium
- Dependencies: tab routing, selected-player state, selected-team state, link targets
- Why now: the workflow still feels manual when a quick draft question needs deeper context.

### 5. Team Context that is more decision-ready

- Description: make team context more actionable by emphasizing roster shape, budget pressure, and retention/ownership structure.
- Draft-day value: high
- User impact: high
- Complexity: medium
- Risk: medium
- Dependencies: Teams tab summaries, roster aggregation, owner statistics, budget/retention source fields
- Why now: team need is useful today, but it still reads more like a summary than a decision aid.

### 6. Retention workflow visibility

- Description: make retentions easier to spot, understand, and use in draft decisions across Players and Teams.
- Draft-day value: high
- User impact: high
- Complexity: medium
- Risk: medium
- Dependencies: retention fields, roster context, ownership context, sheet refresh workflow
- Why now: retentions change the roster picture immediately and are part of active league behavior.

## P2 (Strong Improvement)

### 7. Draft workflow friction reduction

- Description: reduce the extra selection steps needed before queue, scarcity, and full decision context become obvious.
- Draft-day value: medium to high
- User impact: medium to high
- Complexity: low to medium
- Risk: low
- Dependencies: Draft Hub row behavior, selection state, queue interaction patterns

### 8. Tighter Draft Hub labels and scanning copy

- Description: replace generic labels with draft-speed wording that is easier to scan in real time.
- Draft-day value: medium
- User impact: medium
- Complexity: low
- Risk: low
- Dependencies: Draft Hub copy and layout only

### 9. Budget context where data already exists

- Description: expose budget signals only as far as the current source data can support them.
- Draft-day value: medium
- User impact: medium
- Complexity: medium
- Risk: medium
- Dependencies: source data availability, league import fields, sheet truth refresh
- Why not higher: the current source data does not fully track budget state, so this should not block core draft decisions.

## P3 (Nice To Have)

### 10. Queue persistence validation and polish

- Description: keep queue behavior stable across refreshes, tab switches, and long draft sessions.
- Draft-day value: medium
- User impact: medium
- Complexity: low
- Risk: low
- Dependencies: existing local queue storage and queue rendering
- Why not higher: queue persistence already exists and is usable; it needs confidence more than redesign.

### 11. Deeper rights and retention interpretation

- Description: explain the draft implications of matching rights and retention more explicitly in deeper panels.
- Draft-day value: medium
- User impact: medium
- Complexity: medium
- Risk: medium
- Dependencies: Players detail, Team Context, comparison summary
- Why not higher: the fields are already visible; the next gain is interpretive clarity, not new availability.

## FUTURE (Not Yet)

### 12. Trade workflow support

- Description: add a more formal workflow for trades, trade-side reconciliation, and ownership resets.
- Draft-day value: high when trades are active, but not the next bottleneck
- User impact: high when needed
- Complexity: high
- Risk: high
- Dependencies: league workflow rules, source-of-truth reconciliation, ownership and roster update mechanics
- Why future: important in real leagues, but it expands beyond the current draft-decision focus.

### 13. Full budget modeling

- Description: model remaining budget and auction constraints as a first-class planning surface.
- Draft-day value: medium to high
- User impact: medium to high
- Complexity: high
- Risk: high
- Dependencies: reliable budget source data and a defined operating model
- Why future: useful only if the league source becomes budget-complete and stable.

### 14. Broader operational tooling

- Description: add commissioner-style or league-operations features beyond draft support.
- Draft-day value: low
- User impact: low to medium
- Complexity: very high
- Risk: high
- Dependencies: a broader product scope than the current release contract
- Why future: this is outside the current decision-support roadmap.

## If only ONE thing gets built next

Build the Google Sheet refresh workflow.

Why:
- real league changes are constant
- stale truth makes every other surface less trustworthy
- draft decisions are only as good as the current roster and retention state

## If only THREE things get built next

1. Google Sheet refresh workflow
2. Compact league context on Draft Hub rows and comparison
3. Stronger comparison delta

Why this order:
- freshness first
- decision context second
- decision clarity third

## Optimal 90-day sequence

### Days 1-30

- Lock down the Google Sheet refresh workflow.
- Confirm league truth updates cleanly for retentions, trades, and ownership changes.

### Days 31-60

- Surface compact league context in Draft Hub rows and comparison.
- Make ownership, cost, term, rights, and retention readable at a glance.

### Days 61-90

- Strengthen the comparison delta.
- Add one-click handoff into Players and Teams.
- Tighten Team Context and reduce Draft Hub friction.

## Priority rationale

- P0 items protect decision quality during active league change.
- P1 items improve the actual draft workflow once truth is current.
- P2 items reduce hesitation and speed up scanning.
- P3 items are worthwhile polish, but not the main blocker.
- FUTURE items are real needs, but they expand scope beyond the current draft-day roadmap.
