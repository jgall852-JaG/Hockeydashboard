# V10 Scope Recommendation

## Executive recommendation

The Draft Hub should launch as a focused, single-screen decision support surface that answers three questions quickly:

- Who is best available?
- What is scarce?
- What fits my roster strategy?

That is the smallest version that still deserves to be called "Draft Hub".

Anything beyond that should be deliberately deferred until the team proves the core flow works under real draft pressure.

## Recommended V1.0 scope

### V1.0 definition

V1.0 is a lean Front Office / War Room experience built on the existing platform. It does not try to become a full board suite, auction engine, league operations console, or commissioner system.

The V1.0 Draft Hub should contain:

1. A top-of-screen status rail
2. A compact strategy / team-needs summary
3. Best Available panel
4. Scarcity and opportunity panel
5. Value intelligence panel
6. Simple draft queue
7. Minimal overall board with tiering, filters, and search
8. Watchlist and favorites support
9. Lightweight player context and notes

This is the minimal set required to make a draft-day decision without drowning the user in data.

### V1.0 feature classification

#### Draft Hub primary screen
- Header / status rail — MUST HAVE
- Strategy and roster summary — MUST HAVE
- Available player pulse — MUST HAVE
- Scarcity and opportunity panel — MUST HAVE
- Value intelligence panel — MUST HAVE
- Fit matrix — SHOULD HAVE
- Quick actions (add to queue, favorite, note, compare) — MUST HAVE

#### Core board support
- Overall board — MUST HAVE
- Tiering — MUST HAVE
- Filters — SHOULD HAVE
- Search — SHOULD HAVE
- Watchlists — SHOULD HAVE
- Favorites — SHOULD HAVE
- Notes — NICE TO HAVE
- Positional board — SHOULD HAVE (but only after base board works)
- Prospect board — NICE TO HAVE
- Veteran board — NICE TO HAVE

#### War Room core
- Best Available — MUST HAVE
- Position Scarcity — MUST HAVE
- Value Engine — MUST HAVE
- Draft Queue — MUST HAVE
- Team Needs — MUST HAVE
- Player Intelligence — SHOULD HAVE
- Historical Stats — SHOULD HAVE
- Schedule Opportunity — SHOULD HAVE

#### Team Needs engine
- Need Center — MUST HAVE
- Need RW — MUST HAVE
- Need Prospect Depth — SHOULD HAVE
- Need Goaltending — SHOULD HAVE
- Need Cheap Assets — SHOULD HAVE
- Need Immediate Production — SHOULD HAVE
- Dynamic team needs engine — SHOULD HAVE

#### Draft workflow
- Open Dashboard — MUST HAVE
- Load League Data — MUST HAVE
- Review Team — MUST HAVE
- Review Draft Board — MUST HAVE
- Build Queue — MUST HAVE
- Monitor Scarcity — MUST HAVE
- Make Pick — MUST HAVE
- Update Board — MUST HAVE

#### Portability / release-readiness requirements
- GitHub-backed canonical source of truth — MUST HAVE
- Portable local bundle or release artifact — SHOULD HAVE
- One-minute launch checklist — SHOULD HAVE
- LocalStorage treated as ephemeral — MUST HAVE
- Live data remains optional enrichment, not critical startup dependency — MUST HAVE

### V1.0 release scope in plain English

V1.0 should be a single-screen draft decision assistant that lets a user:

- see the current draft state
- know the team’s roster gaps and strategy
- see the best players remaining
- understand which positions are scarce
- know which players are over- or undervalued
- build a short queue of targets
- filter and search the board quickly enough to act under pressure

It does not need to be a full league management suite.

---

## What belongs in V1.1

V1.1 is the polish and expansion phase. It adds depth without changing the core shape of the product.

### V1.1 feature classification

#### Board expansion
- Positional board — SHOULD HAVE
- Prospect board — SHOULD HAVE
- Veteran board — SHOULD HAVE
- Expanded filters — SHOULD HAVE
- Better board sorting logic — SHOULD HAVE
- Better notes UX — SHOULD HAVE

#### War Room depth
- Player intelligence panel — SHOULD HAVE
- Historical stats section — SHOULD HAVE
- Schedule opportunity section — SHOULD HAVE
- More advanced fit scoring logic — SHOULD HAVE
- Improved queue management — SHOULD HAVE

#### Team Needs maturity
- More dynamic needs engine — SHOULD HAVE
- More granular need definitions by roster type — SHOULD HAVE
- Need scoring versus actual roster composition — SHOULD HAVE

#### Operational polish
- Stronger watchlist/favorites UX — SHOULD HAVE
- More robust board persistence across the session — SHOULD HAVE
- Better data-status messaging for stale or missing live data — SHOULD HAVE
- More complete draft-day portability documentation and packaged release path — SHOULD HAVE

### V1.1 should not include
- commissioner console
- draft trade tracking
- league activity monitoring
- future pick ownership dashboards
- auction engine analysis

V1.1 is where the product becomes reliable and user-friendly, not where it becomes broad.

---

## What belongs in V2.0

V2.0 is the full command center and strategic operations layer. This is the point at which the product becomes a true front office / commissioner platform.

### V2.0 feature classification

#### Advanced strategic modules
- Auction engine discovery / auction strategy modeling — FUTURE
- Auction inputs: remaining budget, roster spots, scarcity, player pool, inflation, nomination effects — FUTURE
- Full intrinsic-value-vs-auction-value separation — FUTURE

#### League operations
- Draft tracking — FUTURE
- Pick tracking — FUTURE
- Trade tracking — FUTURE
- League activity — FUTURE
- Future pick ownership — FUTURE
- Draft history — FUTURE
- Commissioner view — FUTURE

#### Advanced analytics and board logic
- Multi-board orchestration as a first-class cross-view dashboard — FUTURE
- Deeper historical and schedule modeling — FUTURE
- More complicated value engine outputs beyond board-level context — FUTURE
- True roster optimization workflows — FUTURE

#### Platform maturity
- Cloud or hosted convenience layer as a primary operating environment — FUTURE
- Full cross-device synchronization and shared league state — FUTURE
- League-wide strategic intelligence beyond one user’s draft decisions — FUTURE

### V2.0 is intentionally not a requirement for the first release

The Draft Hub should not become a league system before it proves the individual user can draft successfully from a single laptop screen.

---

## Deferred scope

The following items should be deferred beyond V1.0 and likely beyond V1.1 unless adoption proves they are needed:

- Auction engine
- Commissioner view
- Trade tracking
- Future pick ownership
- Full league activity engine
- Complete prospect/veteran board stack
- Broad historical modeling beyond current available player context
- Multi-surface analytics dashboard beyond the single Draft Hub flow
- Cloud-first or hosted workflow as a primary path

## Risk assessment

### 1. Scope creep risk
The biggest risk is turning the Draft Hub into a mini league operations platform too early. That would add screens, data models, and complexity without proving the core use case.

### 2. Over-precision risk
A value engine or fit engine can look more scientific than it actually is. Draft-day decisions are human decisions under incomplete data. The product should surface signals, not pretend to eliminate judgment.

### 3. Data confusion risk
The project already has a strict source-of-truth model: local CSV data is authoritative; live NHL data is enrichment only. The Draft Hub must not blur that boundary.

### 4. Draft-day stress risk
Any feature that requires a lot of clicks, deep drill-down, or ambiguous filters will fail under real-time pressure. The V1.0 product must prioritize clarity and speed.

### 5. Portability risk
A Draft Hub that depends on one machine, one browser profile, or one fragile state path is not successful. Portability must be considered as a release requirement, even if it is not a visible product feature.

---

## Complexity assessment

### V1.0 complexity: Medium
Reason:
- one main screen
- a small number of data views
- a manageable board model
- moderate data filtering
- no new backend or architecture
- still built on the existing platform

This is the right complexity for a successful release.

### V1.1 complexity: Medium-High
Reason:
- expanded board views
- richer player context
- deeper filters and queue logic
- harder UX polish
- more cross-feature state management

### V2.0 complexity: High
Reason:
- multiple operational systems
- commissioner workflows
- auction strategy logic
- league-wide data and state
- much larger QA and release burden

---

## Recommended implementation order

### Phase 1: Draft Hub core
1. Build the single-screen Draft Hub shell
2. Add status rail and user context
3. Add strategy / team-needs summary
4. Add Best Available panel
5. Add Scarcity and Value panels
6. Add simplified queue
7. Add overall board with tiering

### Phase 2: board usability
8. Add search and filters
9. Add watchlist and favorites
10. Add lightweight notes and quick actions
11. Add fit indicators and basic player context

### Phase 3: V1.0 hardening
12. Validate the flow under real draft pressure
13. Test board updates and queue changes
14. Verify local-first behavior and data-status clarity
15. Document portability and release bundle path

### Phase 4: V1.1 expansion
16. Add positional/prospect/veteran board views
17. Add rich historical and schedule context
18. Improve team needs engine and queue workflow

### Phase 5: V2.0 only after success
19. Evaluate auction engine
20. Add commissioner and league operations modules
21. Broaden into a full front office platform only after the Draft Hub proves itself

---

## Final recommendation

The smallest release-worthy Draft Hub is not the largest possible product. It is the smallest product that clearly solves the draft-day decision problem.

The V1.0 release should include:

- status rail
- team strategy / needs context
- best available ranking
- scarcity and value panels
- draft queue
- minimal overall board with tiering, search, and filtering
- watchlist and favorites
- local-first, portable, release-ready execution

Everything else should be scheduled as V1.1 or V2.0.

This keeps the product aligned with the project’s disciplined architecture, preserves successful release probability, and prevents the Draft Hub from growing into a second product before the first one is proven.
