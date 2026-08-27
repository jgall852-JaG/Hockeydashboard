# V09_VALUE_WEIGHTING_STRATEGY

## Purpose

Define the Phase 2 weighting philosophy for V0.9 intrinsic asset valuation without implementing numeric scoring, rankings, or final asset values.

## Guardrails

- No ValueScore implementation
- No rankings
- No numeric valuation outputs
- No auction or market valuation logic
- No budget, inflation, open-slot, or draft-room dynamics

---

## Category: Prospect Value

### 1) Primary Factors
- Upside trajectory
- Age / development window
- Draft pedigree

### 2) Secondary Factors
- Historical production trend
- Opportunity path (role access, schedule opportunity)
- Pool-position scarcity support

### 3) Modifiers
- Cost
- Term remaining
- Matching rights
- Farm flag

### 4) Informational Fields
- NHL position
- Sweater number
- Shoots/catches
- Team narrative context

### 5) Reasoning
Prospect value is primarily future-outcome value. Upside, age, and pedigree should lead because current production can be incomplete or context-limited early in development.

### 6) Risks
- Overvaluing pedigree over real progression
- Overvaluing youth without role path
- Underweighting production trend in older prospects

---

## Category: Veteran Value

### 1) Primary Factors
- Current production
- Opportunity stability (role and usage)

### 2) Secondary Factors
- Age curve
- Pool-position scarcity
- Historical consistency trend

### 3) Modifiers
- Cost
- Term
- Retention
- Matching rights (if applicable in league rules)

### 4) Informational Fields
- Team standings
- NHL position
- Sweater number
- Shoots/catches

### 5) Reasoning
Veteran value is current-output-centric. Veterans should be valued first on present contribution and role reliability, then adjusted for decline risk and scarcity context.

### 6) Risks
- Overweighting short-term hot streaks
- Under-accounting for age decline
- Overpaying for name value over role value

---

## Category: Contract Value

### 1) Primary Factors
- Effective cost efficiency versus contribution potential
- Contract control quality (term utility)

### 2) Secondary Factors
- Retention profile
- Rights control quality

### 3) Modifiers
- Matching rights
- Term edge (long control vs flexibility tradeoff)
- Retention edge

### 4) Informational Fields
- Contract label formatting
- Team branding metadata
- Cosmetic historical tags

### 5) Reasoning
Contract value is intrinsic leverage on an underlying asset, not the asset itself. It should reward efficient control and discount expensive or inflexible structures.

### 6) Risks
- Treating low cost as automatic quality
- Ignoring whether term aligns to player lifecycle
- Overstating rights when not actionable

---

## Category: Draft Pick Value

### 1) Primary Factors
- Round tier
- Year proximity (time-to-realization)

### 2) Secondary Factors
- Conditional structure quality
- Expected conversion profile by tier

### 3) Modifiers
- Protection rules
- Conditional triggers and certainty

### 4) Informational Fields
- Prior pick ownership history
- Display metadata not tied to conversion value

### 5) Reasoning
Draft picks are future option assets. Value should be anchored to expected conversion quality and certainty timing, not player-level production metrics.

### 6) Risks
- Treating all picks in a round as equivalent
- Ignoring long-horizon uncertainty for distant picks
- Ignoring condition complexity and trigger risk

---

## Category: Rights Value

### 1) Primary Factors
- Rights presence and enforceability
- Asset linkage quality (especially prospect-linked rights)

### 2) Secondary Factors
- Prospect status / development stage
- Time horizon to rights utility

### 3) Modifiers
- Cost context
- Term context
- Retention context (if rights interact with retained contracts)

### 4) Informational Fields
- NHL position
- Sweater number
- Shoots/catches
- Team narrative metadata

### 5) Reasoning
Rights value is option value. It should be primarily driven by whether rights are real, usable, and linked to a meaningful underlying asset path.

### 6) Risks
- Treating rights as guaranteed value realization
- Overvaluing dormant rights with no near-term path
- Underweighting cost/term friction on conversion

---

## Cross-category weighting philosophy (non-numeric)

At Phase 2, every factor should be classified by contribution tier only:

- **Primary**: drives intrinsic value identity of the asset class
- **Secondary**: materially informs value confidence and context
- **Modifier**: adjusts value interpretation after core assessment
- **Informational**: visible context that should not affect value determination

## Deferred to implementation phase

- Numeric weights
- Category formulas
- Final valuation outputs
- Cross-category consolidation math
- Ranking logic

This completes Phase 2 strategy definition while keeping valuation implementation deferred.
