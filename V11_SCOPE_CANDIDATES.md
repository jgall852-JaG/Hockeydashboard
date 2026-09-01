# V11 Scope Candidates

## Purpose

This document applies the project’s authoritative V1.0 and V1.1 guidance to determine the smallest high-value V1.1 release that meaningfully improves the Draft Hub without turning it into a broad operations or league-management product.

The design basis is explicit:

- Google Sheet = Operations
- Hockey Dashboard = Intelligence
- V1.0 solved: “What should I do?”
- V1.1 should solve: “Why is this my best decision right now?”

The release theme should be narrow, reliable, and draft-day useful.

---

## Evaluation criteria

The strongest V1.1 candidate is the one that:

1. materially improves decision quality at the pick moment
2. reduces emotional or process mistakes under pressure
3. saves time during a live draft
4. is small enough to ship without adding architecture or operational sprawl

---

## Candidate ranking

### 1. Player Comparison

- Rank: HIGH
- User Value: Very high. Draft decisions are often binary or near-binary. A GM needs to compare the realistic alternatives in the same view.
- Complexity: Medium. This is not a large feature, but it requires well-defined comparison logic and a clean UI pattern.
- Risk: Low to medium. It is additive and stays inside the intelligence layer.
- Draft-Day Impact: Very high. This would have changed actual draft decisions because it directly supports the critical “pick this player over that player” moment.
- Why it matters: This is the clearest missing capability after V1.0.

### 2. Team Fit Analysis

- Rank: HIGH
- User Value: High. The Draft Hub needs to do more than rank players; it must explain whether the player fits the team’s roster need and time horizon.
- Complexity: Medium. It can be implemented as a focused roster-fit model rather than a full front-office engine.
- Risk: Low. It stays within the current product lane and strengthens the Draft Hub instead of expanding into new product territory.
- Draft-Day Impact: Very high. A player who is “good” is not always “right.” Fit helps the GM avoid bad value or wrong-position reaches.
- Why it matters: This is the most direct way to make the hub feel strategic instead of list-based.

### 3. Position Scarcity and Drop-off Clarity

- Rank: HIGH
- User Value: High. The board already has scarcity, but the user still needs stronger signals about whether the next tier is meaningfully worse.
- Complexity: Low to medium. This is an enhancement on an existing concept rather than a new system.
- Risk: Low. It reinforces existing logic without adding architecture.
- Draft-Day Impact: High. It reduces mistakes like waiting too long for a position or reaching for a weak tier because the scarcity signal was too weak.
- Why it matters: Scarcity is one of the biggest drivers of real draft behavior.

### 4. Value Profile Rationale

- Rank: HIGH
- User Value: High. The current value profile is useful but still too thin. The user wants to know why a player matters beyond a score.
- Complexity: Medium. It is about explanation quality, not a large modeling project.
- Risk: Low. It improves user confidence without broadening the product.
- Draft-Day Impact: High. This reduces second-guessing and helps the GM understand when a player is still worth the pick.
- Why it matters: The post-V1.0 review identified this as a major gap.

### 5. Draft Import / Sheet Snapshot Sync

- Rank: MEDIUM
- User Value: High for live usability, but not as directly tied to strategic decision-making as comparison or fit.
- Complexity: Low to medium. This is manageable and appropriate for the current architecture.
- Risk: Low if kept as a snapshot-based workflow rather than a live operational system.
- Draft-Day Impact: High in operational efficiency. It reduces stale board issues and saves time during the live draft.
- Why it matters: It prevents the Dashboard from operating on stale information, but it is still a support layer, not the core decision feature.

### 6. Queue Prioritization and Strategy State

- Rank: MEDIUM
- User Value: Medium to high. A queue is useful, but it still feels more like a task list than a strategy plan in V1.0.
- Complexity: Medium. This is not hard, but it benefits from good UX and state discipline.
- Risk: Low. It is a natural extension of the current queue model.
- Draft-Day Impact: Medium. It saves time and keeps the GM organized, but it is less likely to change a decision in the moment than comparison or fit.
- Why it matters: It improves planning depth but is not the single biggest leap in draft quality.

### 7. Draft History Tracking

- Rank: LOW
- User Value: Medium for retrospective review and learning, but less important during the live draft.
- Complexity: Medium, depending on how much historical state is tracked.
- Risk: Low, but the value is largely retrospective rather than immediate.
- Draft-Day Impact: Low. It helps after the draft, not necessarily during it.
- Why it matters: Useful for analysis, but not the best V1.1 release priority.

### 8. Advanced Search / Strategic Filters

- Rank: MEDIUM
- User Value: Medium. It improves productivity but does not by itself improve the decision quality of a pick.
- Complexity: Low to medium.
- Risk: Low.
- Draft-Day Impact: Medium. Better filtering helps identify candidates faster.
- Why it matters: Helpful refinement, but not the highest-value core release theme.

---

## Ranking summary

### HIGH

1. Player Comparison
2. Team Fit Analysis
3. Position Scarcity and Drop-off Clarity
4. Value Profile Rationale

### MEDIUM

5. Draft Import / Sheet Snapshot Sync
6. Queue Prioritization and Strategy State
7. Advanced Search / Strategic Filters

### LOW

8. Draft History Tracking

---

## What creates the biggest decision-making improvement?

The answer is: Player Comparison.

A Draft Hub becomes dramatically more useful when the GM can answer the critical question in one place:

- This player is available.
- That player is also available.
- Which one fits the team better?
- Which one is better value given the board and scarcity?
- Which one is the smarter pick right now?

That is the highest-leverage improvement because it turns the Draft Hub from a ranking list into a decision-support product.

---

## What reduces draft-day mistakes?

The answer is: Team Fit Analysis + Position Scarcity + Value Rationale.

These features reduce the common errors:

- reaching too early for a position because the board is confusing
- taking a player who is “good” but wrong for the roster
- waiting too long and losing a key position because the drop-off is hidden
- second-guessing a pick because the value profile lacked rationale

These are not just UX improvements. They are judgment safeguards.

---

## What saves the most time?

The answer is: Draft Import / Sheet Snapshot Sync.

This reduces the operational cost of keeping the Dashboard current and prevents stale board decisions. It is not the most strategic feature, but it is the most operationally efficient one.

---

## What would have changed actual draft decisions?

The answer is: Player Comparison + Team Fit Analysis.

Those are the features a GM would actually use when deciding between two or three players in a real pick window. They change behavior in the moment, not later during review.

---

## Recommended V1.1 release theme

### Theme: Decision Confidence for the Pick

This is the smallest V1.1 that still deserves to be called a meaningful Draft Hub improvement.

It is not a broad feature grab. It is a focused release built around one idea:

The Draft Hub should help a GM decide with more confidence in the exact moment a pick is on the clock.

### Recommended scope

#### Must Have

- Side-by-side Player Comparison
- Team Fit Analysis
- Clearer Value Profile rationale
- Better position scarcity + drop-off explanation

#### Should Have

- Queue prioritization and strategy-state improvements
- Snapshot-based draft import from the Google Sheet
- Better search/filter context aligned with fit and scarcity

#### Deferred

- Draft history tracking as a major feature
- broader operations tooling
- auction engine
- commissioner tools
- full league management features

---

## Why this is the best V1.1

This release theme is the best fit for the project’s real constraints:

- it directly addresses the gaps discovered after V1.0
- it improves the real pick decision instead of broadening the product
- it stays inside the intelligence lane and does not invade Google Sheet operations
- it keeps the Draft Hub simple enough to ship successfully
- it preserves the signal that the product is still a draft support system, not a league operating system

It is the narrowest release that still meaningfully improves the user’s confidence and decision quality.

---

## Final recommendation

Choose one V1.1 theme only:

Decision Confidence for the Pick

Not a broad systems expansion.
Not a formal league operations platform.
Not a draft engine.

Just the release that makes the Draft Hub smarter at the exact moment where a GM must decide.
