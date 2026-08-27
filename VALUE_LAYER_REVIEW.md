# VALUE_LAYER_REVIEW

## Scope of this review

This review validates the current V0.9 Value Layer implementation against the framework goal:

- independent category outputs
- intrinsic asset context only
- no final valuation math yet

Reviewed implementation source:

- [app.js](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/app.worktrees/pasted-text-processing-4d385e81/app.js)
- [V09_VALUE_FRAMEWORK.md](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/app.worktrees/pasted-text-processing-4d385e81/V09_VALUE_FRAMEWORK.md)

---

## Current architecture

Current runtime flow remains aligned with the existing architecture:

Identity -> Historical -> Schedule -> Live -> Value

Value is generated at read/render time through `buildValueLayer(player, rosterRecord, liveProfile)` and displayed per category card. Existing source-of-truth layers were not redesigned.

Current Value outputs are independent and category-specific:

- Prospect Value
- Veteran Value
- Draft Pick Value
- Contract Value
- Matching Rights Value

No universal combined value score is produced.

---

## Current calculations in Value Layer (present today)

The Value Layer currently performs qualitative classification (labels), not final valuation math:

- production classification (`High` / `Medium` / `Limited` / `Unknown`) using point thresholds
- opportunity classification using active roster status and games-remaining checks
- age proxy classification using years since draft
- scarcity classification by pool position map
- modifier classifications for cost, term, retention, and rights
- profile-label assignment (example: `High-Upside Prospect Asset`)

These are rule-based framework signals and display labels. They are not final numeric valuation formulas.

---

## Category review

## 1) Prospect Value

### Inputs currently used
- `player.sourceType`
- `player.draftYear`
- `player.poolPosition`
- `player.cost`
- `player.termRemaining`
- `player.matchingRights`
- `liveProfile.currentSeason.points`
- `liveProfile.historical.points`
- `liveProfile.identity.rosterStatus`
- `liveProfile.schedule.gamesRemaining`
- fallback roster points/GP fields from `rosterRecord`

### Factors currently stored
- Primary: Production, Opportunity
- Secondary: Age Curve, Pool Position Scarcity
- Modifiers: Cost, Term, Matching Rights
- Informational: NHL Position, Sweater Number, Shoots/Catches

### Factors currently calculated
- production impact label from thresholds
- opportunity impact label from status + games remaining
- age impact label from draft-year proxy
- scarcity impact label from position map
- cost/term/rights modifier labels
- profile label (`High-Upside Prospect Asset`, `Opportunity-Driven Prospect Asset`, `Developing Prospect Asset`)

### Any implied weighting
- Production and Opportunity are treated as first-order gates for profile label.
- Age/Scarcity are secondary annotations.
- Cost/Term/Rights are modifier annotations.

### Any implied scoring
- No numeric score.
- Yes: qualitative tiering via impact labels and profile label logic.

---

## 2) Veteran Value

### Inputs currently used
- `player.sourceType`
- `player.poolPosition`
- `player.currentCost`
- `player.retentionHistory`
- `liveProfile.currentSeason.points`
- `liveProfile.historical.points`
- `liveProfile.identity.rosterStatus`
- `liveProfile.schedule.gamesRemaining`
- fallback roster points/GP fields from `rosterRecord`

### Factors currently stored
- Primary: Production, Opportunity
- Secondary: Age Curve, Pool Position Scarcity
- Modifiers: Cost, Retention
- Informational: NHL Position, Sweater Number, Shoots/Catches

### Factors currently calculated
- production/opportunity/age/scarcity impacts
- cost and retention modifier impacts
- profile label (`High-Impact Veteran Asset`, `Core Veteran Asset`, `Depth Veteran Asset`)

### Any implied weighting
- Production is the dominant profile driver.
- Opportunity contributes to factor state but does not directly override veteran profile branches today.
- Cost/Retention remain modifier-level outputs.

### Any implied scoring
- No numeric score.
- Yes: qualitative profile tiering.

---

## 3) Contract Value

### Inputs currently used
- `player.cost` or `player.currentCost`
- `player.termRemaining`
- `player.retentionHistory`
- `player.matchingRights`

### Factors currently stored
- Primary: Cost Efficiency
- Secondary: Term Control, Retention
- Modifiers: Matching Rights
- Informational: NHL Position, Sweater Number, Shoots/Catches

### Factors currently calculated
- cost modifier label
- term modifier label
- retention modifier label
- rights modifier label
- profile label (`Efficient Contract Asset`, `Neutral Contract Asset`, `High-Cost Contract Asset`)

### Any implied weighting
- Cost drives contract profile label directly.
- Term/Retention/Rights are supporting factor outputs.

### Any implied scoring
- No numeric score.
- Yes: qualitative contract profile tier.

---

## 4) Draft Pick Value

### Inputs currently used
- No draft-pick entity inputs from player context are currently consumed.

### Factors currently stored
- Primary: Round Tier, Year Proximity
- Secondary: Conditionality
- Modifiers: Protection Rules
- Informational: Player Profile Context note

### Factors currently calculated
- None. All entries are `Pending` with notes indicating required future inputs.

### Any implied weighting
- Structural ordering only (Primary > Secondary > Modifiers).

### Any implied scoring
- No numeric score.
- No qualitative scoring from real inputs yet.

---

## 5) Rights Value

### Inputs currently used
- `player.matchingRights`
- `player.sourceType`
- `player.cost` / `player.currentCost`
- `player.termRemaining`

### Factors currently stored
- Primary: Rights Presence
- Secondary: Prospect Status
- Modifiers: Cost, Term
- Informational: NHL Position, Sweater Number, Shoots/Catches

### Factors currently calculated
- rights presence impact
- prospect-status impact (`High` for prospect source type, otherwise `Limited`)
- cost and term modifier impacts
- profile label (`Strong Rights Asset` or `No Standalone Rights Premium`)

### Any implied weighting
- Rights presence is the primary gate.
- Prospect status influences supporting context.
- Cost/Term are modifiers.

### Any implied scoring
- No numeric score.
- Yes: qualitative rights profile and impact labels.

---

## Confirmation statements

## No final valuation math exists yet

Confirmed.

Current implementation does **not** compute:

- final numeric valuation
- cross-category blended score
- market/auction valuation
- budget/inflation/open-slot dynamics

## Current Value Layer is structural only (with qualitative framework signals)

Confirmed with clarification:

- Structural: category separation, factor grouping, and output schema are in place.
- Qualitative only: rule-based impact labels and profile labels exist.
- Not final valuation: no numeric value engine math has been implemented.

---

## Future calculations deferred to Phase 2

Deferred work for Phase 2 includes:

- explicit factor weighting model per category
- true valuation equations and/or weighted composites
- confidence handling and missing-data penalties
- calibration of thresholds from league data
- draft-pick valuation inputs (round/year/conditional metadata)
- conversion from qualitative labels to formal valuation outputs (if required by design)

No new features are required for this review step. The current Value Layer is a framework scaffold with qualitative signal logic, not final asset valuation math.
