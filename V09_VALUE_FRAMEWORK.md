# V0.9 Value Framework

## Purpose

This document defines the weighting philosophy for the V0.9 value engine before implementation. It is a design-only framework intended to answer:

- what should drive value the most
- what should adjust value after the core picture is established
- what should remain informational and not directly affect valuations

This framework does not implement scoring, does not calculate a final value, and does not alter the local-first architecture described in PROJECT_LIBRARY.md.

## Scope Guardrails (V0.9 Intrinsic Asset Value)

This framework is for intrinsic asset valuation only.

Explicitly out of scope for V0.9 weighting:

- budgets
- inflation
- open roster slots
- draft dynamics and negotiation context
- market-clearing or auction behavior

Those belong to a later market-value model in Draft Hub.

## Core Principle

The value engine should be built from the player-first truth path:

Identity -> Historical performance -> Opportunity -> Live context -> Value

In other words:

- production matters most
- opportunity matters nearly as much
- age, role path, and scarcity matter as context
- cost, term, and rights matter as value modifiers
- sweater number, handedness, or cosmetic identity details remain informational only

## Weighting Philosophy

### 1. Primary factors: strongest influence on value
These should carry the most weight because they explain whether the player is actually valuable now or likely to become valuable.

- Production
  - current production
  - historical production trend
  - sustained output over a meaningful sample
  - efficiency or usage quality when available

- Opportunity
  - roster role
  - team context
  - games available or eligible games
  - first-half / second-half schedule quality
  - NHL path / roster access

- Role / usage clarity
  - top-six vs bottom-six
  - power-play usage
  - shutdown / penalty kill role
  - role stability over time

- Age / entry curve
  - young players with meaningful upside are not treated as equal to older players with similar current output
  - veteran value must account for age decline risk

These are the main drivers of value because they answer:

- Is this player producing?
- Is the player likely to keep producing?
- Is the situation giving the player a path to value?

### 2. Secondary factors: meaningful but not primary drivers
These should influence value meaningfully, but only after production and opportunity are understood.

- Position scarcity
  - center value
  - goalie value
  - premium positions when replacement depth is thin

- Historical trend and trajectory
  - whether the player is improving, plateauing, or declining

- Draft pedigree
  - for prospects, especially when comparing players with similar current data

- NHL status / roster status
  - active roster, fringe roster, farm role, injured status, or major-league path

- Pool position / franchise role
  - league-specific positional leverage matters, but it should not overwhelm real production or opportunity

### 3. Modifiers: should adjust value, not define it
These should not be the main source of a player’s value but should meaningfully change the final value after the core picture is understood.

- Cost
  - effective acquisition cost
  - cost efficiency relative to output
  - intrinsic contract efficiency relative to expected contribution

- Term
  - longer term can increase certainty or decrease flexibility depending on the context
  - term should matter when it shifts the value of a contract or asset

- Retention / rights / matching rights
  - rights give strategic optionality
  - rights increase flexibility only when they are real and actionable

- Farm / prospect status
  - farm assets are worth something, but usually less than a player with a confirmed NHL role

- Conditionality
  - a draft pick or rights that are contingent on a trigger should be discounted based on actual probability

### 4. Informational only: should not materially influence value
These should be available to the user but should not drive value decisions directly.

- Sweater number
- Handedness
- Favorite team narrative
- Cosmetic team labels that are not tied to value impact
- Local label metadata without operational impact
- Non-decision-making display-only context

These can be surfaced in a profile for context, but they should not change value rankings in a meaningful way.

## Value Framework by Asset Type

## Prospect Value Framework

### Primary value inputs
- production profile
  - goals, assists, points, shots, TOI, usage trend
- age
  - younger prospects with a real role path should be valued above older prospects with similar raw output
- draft pedigree
  - selection quality, year, and consensus tier
- opportunity
  - team context, schedule, NHL path, roster access
- NHL status
  - active, likely call-up, fringe depth, farm-only, or blocked by a clear depth chart
- projected role
  - top-six, power-play, shutdown, or depth profile

### Weighted philosophy
Prospect value should be upside-first, not current-output-only.

The order of significance should be:

1. Opportunity and role path
2. Age and developmental timing
3. Historical production trend
4. Draft pedigree and scouting signal
5. Position scarcity and roster scarcity
6. Contract / rights / cost modifiers

### Prospect framework rule
A prospect should not be valued as a finished veteran. The score should favor future NHL probability and upside, with a visible risk penalty for uncertainty.

### Prospect decision guidance
- If a player is young, high-upside, and has a real NHL path, value should be driven primarily by that path despite incomplete production.
- If a player is older, has weaker role path, or is blocked by roster depth, his value should be discounted even if his raw numbers look strong.

### Prospect factors by category
- Primary: production trend, opportunity, age, role path
- Secondary: draft pedigree, position scarcity, NHL status
- Modifiers: contract cost, matching rights, farm status
- Informational: nationality, handedness, sweater number, styling metadata

## Veteran Value Framework

### Primary value inputs
- current production
- historical production/consistency
- opportunity and role stability
- age curve and expected decline
- position scarcity

### Weighted philosophy
Veteran value should be current-output-first, with a moderate decline adjustment for age and usage risk.

The order of significance should be:

1. Current production and historical consistency
2. Role and opportunity stability
3. Age curve and durability risk
4. Position scarcity and roster scarcity
5. Cost and contract structure

### Veteran framework rule
A veteran’s value should be anchored to what he is producing now, not just what he has done historically. Age and role degradation are important secondary filters because production can be overstated by a favorable role or a short sample.

### Veteran factors by category
- Primary: current production, historical production, role stability, opportunity
- Secondary: age curve, position scarcity, roster status
- Modifiers: cost, term, retention, rights
- Informational: sweater number, handedness, stylistic labels

## Draft Pick Value Framework

### Primary value inputs
- pick round
- pick year proximity
- pick quality and strategic value
- conditionality
- asset utility in the current league context

### Weighted philosophy
Draft picks are not players; they are future assets. Their value should be judged as option value, not as current production.

The order of significance should be:

1. Round and pick tier
2. Future pick certainty and timing
3. Conditionality and trigger probability
4. Expected talent-conversion profile by tier
5. Asset stability across draft-year uncertainty

### Draft framework rule
Pick value should be treated as a discounted future asset:

- earlier round = materially higher baseline value
- later round = less certain and lower value
- future picks should be discounted heavily based on year distance
- conditional picks should be risk-adjusted before comparison to non-conditional picks

### Draft factors by category
- Primary: round, pick quality, timing, contingency risk
- Secondary: expected conversion profile, uncertainty horizon
- Modifiers: conditional triggers and protection rules
- Informational: exactly which team made the pick in a historical sense if unrelated to value

## Contract Value Framework

### Primary value inputs
- effective cost
- term length
- retention / buy-down
- rights attached to the asset

### Weighted philosophy
Contract value should not define a player’s worth by itself; it should adjust the intrinsic value of the player after production, opportunity, and age are evaluated.

The order of significance should be:

1. Effective cost
2. Term and flexibility
3. Retention and rights value
4. Contract control horizon and risk profile

### Contract framework rule
The value engine should first estimate the player’s underlying value, then adjust that value based on whether the contract is favorable, neutral, or overextended.

### Contract factors by category
- Primary: cost, effective cost relative to output
- Secondary: term, retention, rights, flexibility
- Informational: salary formatting, historical contract labels, team branding, non-economic metadata

## Final Weighting Summary

### Most influential (first-order factors)
- Production
- Opportunity
- Role path and usage
- Age / timing curve

### Moderately influential (second-order factors)
- Position scarcity
- Draft pedigree for prospects
- Historical trend and continuity
- NHL status and roster access

### Value modifiers
- Cost
- Term
- Retention
- Matching rights
- Conditionality
- Farm status

### Informational only
- Sweater number
- Handedness
- Cosmetic labels
- Non-operational metadata

## Recommended Implementation Principle

Before implementation, the engine should follow this sequence:

1. Establish baseline player value from production and opportunity.
2. Adjust for age, role path, scarcity, and roster context.
3. Adjust for contract economics and rights value.
4. Keep only the most relevant metadata visible as informational context.

This sequence intentionally excludes market effects (budget pressure, inflation, open-slot urgency, and draft-room dynamics).

This preserves the project’s core principle: value is earned through actual performance and path to opportunity, not through surface-level labels or contract noise alone.

## Final Decision

The V0.9 value engine should be weighted around a simple truth:

- Real output and real opportunity are the primary drivers.
- Scarcity and age are strong secondary drivers.
- Cost, term, retention, and rights are leverage modifiers.
- Most identity and cosmetic metadata is informational, not value-bearing.

This provides a disciplined weighting philosophy before any implementation begins.
