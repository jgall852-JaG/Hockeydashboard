# V11 Decision Confidence Discovery

## Purpose

This document defines the V1.1 discovery for the next draft-question layer:

Why should I make this pick?

The V1.0 Draft Hub answers the operational question:
- What should I do?

V1.1 should answer the decision-quality question:
- Why is this the right pick right now?

This is not a redesign of the product. It is a focused discovery for a small but meaningful improvement in decision confidence.

The project’s authoritative design boundary remains:
- Google Sheet = Operations
- Hockey Dashboard = Intelligence
- V1.0 = single-screen decision support
- V1.1 = stronger draft-day confidence and rationale

---

## Core product question

The Draft Hub is strongest when the user can make a decision under pressure without a long explanation cycle.

The required experience is simple:

- compare the realistic player options
- understand how the player fits the team
- understand what happens if the user waits
- understand why the player is valued highly
- know whether the pick is a strong call or a risky reach

The Draft Hub should not just tell the user what is available. It should help the user decide whether the pick is actually a smart one.

---

## 1. Player Comparison

### Question to answer

Player A vs Player B.

The draft decision is often not a question of “who is best overall?” but rather:
- Which of these options is the better fit for my team at this moment?
- Which option is more likely to produce value at the right position and at the right time?
- Which option holds more upside while staying within my roster plan?

### Required comparison information

A useful comparison should be built from the same decision view the user already trusts in the Draft Hub:

1. Value tier
- where each player sits relative to the board
- whether the player is a top-tier available asset or a mid-round fallback

2. Position scarcity
- how deep or thin the position remains at this point in the draft
- whether waiting would create a meaningful drop-off

3. Team fit
- does the player address an immediate need?
- does the player fit the roster build and timeline?
- is the player a better long-term fit than the alternative?

4. Risk band
- upside volatility
- injury or role risk
- probability the player delivers the expected value

5. Role fit and production outlook
- can the player realistically contribute in the roster plan?
- is the player a high-probability contributor or a speculative upside swing?

6. Draft timing
- is this player likely to be available later?
- is the user reaching relative to current board behavior?

### Comparison output

The ideal comparison should produce a clear answer, not just a list of stats.

Example output structure:
- Player A is better value
- Player B fits my roster more cleanly
- Player A is a stronger immediate need fill
- Player B has higher upside but higher volatility
- Player A is the stronger pick if the user has a narrow position need

This should be concise and actionable.

### Why it matters

A GM will usually only need to compare a small number of candidates at a time. The feature does not need to be exhaustive. It needs to be quick, readable, and decisive.

---

## 2. Team Fit Analysis

### Question to answer

How well does this player fit my roster?

The draft is not just a ranking contest. It is a roster construction problem.

A strong player may still be a poor fit if the team is already overloaded at the same position or if the roster has a different long-term build.

### Required fit information

1. Roster gaps
- which positions are open or underrepresented
- which positions are pressing now
- which positions are future priorities

2. Current team build
- what the roster already has at the player’s position
- depth and redundancy by role
- whether the team needs a starter, replacement, or upside swing

3. Timeline
- is the user contending now or rebuilding?
- does the player fit the short-term or long-term plan?

4. Need urgency
- is the need critical or flexible?
- can the user afford to wait?

5. Positional pressure
- can the team tolerate a gap if the player is not chosen now?
- is the position likely to vanish before the next pick window?

6. Fit confidence
- how confident is the user that this player fills the right need without overcommitting?

### Fit output

The system should express fit in a way that is easy to read at a glance:

- Strong fit
- Good fit
- Neutral fit
- Poor fit

These labels should be paired with a short explanation:
- addresses a current need at a scarce position
- fits the roster build and timeline
- strong upside but not immediate fit
- likely overpay relative to roster need

### Why it matters

This is where the Draft Hub moves from raw player ranking to strategic decision support.

The strongest V1.1 feature is not simply “who is higher.” It is “who is better for my team right now.”

---

## 3. Scarcity Drop-Off Analysis

### Question to answer

What happens if I wait?

This is one of the most important real draft decisions. Waiting is not a neutral move. It creates a cost.

### Required scarcity information

1. Position depth
- how many players at the same position remain
- whether the pool is deep or thin

2. Tier drop-off
- what are the meaningful breaks between tiers
- does the next tier represent a real drop in value or just a small shift?

3. Time-to-next-pick window
- is the user likely to be on the clock again before the position thins significantly?

4. Pick probability by position
- which position is likely to disappear before the next opportunity?

5. Roster risk
- if the user waits, will the roster gap worsen?
- is there a position risk that must be addressed immediately?

### Decision pattern

The system should help the user answer:
- If I wait, is the drop-off material?
- Is this current position still available when I return to the clock?
- Am I paying a premium now to avoid a structural gap later?

### Output format

Example:
- Waiting is risky: top-tier centers are likely gone before your next pick.
- This position is still deep enough to wait.
- The drop-off is significant at this position; take now if the value remains acceptable.

### Why it matters

Scarcity is often as important as player quality. A player who is a good value can still be the wrong pick if the user is waiting on a position that is about to evaporate.

---

## 4. Value Rationale

### Question to answer

Why is this player rated highly?

A value profile is only useful if the user understands why it is high.

### What should the rationale include

A strong value explanation should combine several factors:

1. Player quality
- projected production or role value
- current board standing
- quality relative to his pool position

2. Position value
- how strong the player is at his position
- how scarce the position is in the current pool

3. Team relevance
- does the player fill a meaningful need?
- does the player fit the roster build and timeline?

4. Risk and volatility
- why the player is valuable despite risk
- what is the upside case and downside case

5. Draft-time fit
- why the current pick is sensible in context
- what makes this a quality value rather than an emotional pick

### Output format

The rationale should be concise but grounded.

Example:
- High value because the player projects as a strong long-term contributor at a scarce position.
- Good fit because the roster needs immediate production and this player fills that need without a major reach.
- High risk because the position is volatile and the role is uncertain, but the upside remains meaningful.

### Why it matters

The Draft Hub should reduce guesswork. If a GM cannot explain why a player is ranked highly, the product feels thin and unconvincing.

---

## 5. Decision Confidence

### Question to answer

How strongly should I trust this pick?

The system should not only identify a player. It should label the quality of the decision itself.

### Confidence categories

1. Strong Pick
- the player is highly ranked, fits the roster, and the value is appropriately aligned with the board
- the pick is not a reach and does not create a clear strategic mistake

2. Good Pick
- the pick is solid but not perfect
- the player may not be the absolute best value, but the fit and timing are acceptable

3. Reach
- the player is still reasonable, but the pick is ahead of the board or inconsistent with the team’s actual need
- this should trigger a caution flag

4. High Risk Pick
- the player may be talented, but the draft timing, roster fit, or value profile is weak
- there is a meaningful chance the pick worsens the team’s draft position or roster plan

### Confidence inputs

The confidence model should consider:
- player value versus board position
- team fit and need urgency
- position scarcity and wait cost
- expected value relative to alternative available players
- volatility and downside risk

### Why it matters

This is the cleanest way to answer the final V1.1 question:

Why should I make this pick?

A Draft Hub that can explain both the choice and the confidence level feels like a true decision-support tool rather than a static list.

---

## Recommended V1.1 decision model

The best V1.1 version is not a broad operating system. It is a compact decision-confidence workflow.

The model should answer five questions in a tight sequence:

1. Who are the realistic alternatives?
2. Which player fits my roster best?
3. What happens if I wait?
4. Why is this player valuable right now?
5. How confident am I that this is the correct pick?

That sequence is concise, realistic, and aligned with a draft-day operating environment.

---

## Minimal V1.1 value proposition

The smallest meaningful V1.1 release should include:

- side-by-side comparison between available players
- clear team-fit analysis for each player
- scarcity and drop-off explanation
- value rationale tied to player quality, position, and roster fit
- confidence labels that indicate whether the pick is strong, reasonable, or risky

This delivers the core improvement without overreaching into league operations, auction mechanics, trade logic, or commissioner features.

---

## What is intentionally out of scope

The following remain outside the V1.1 decision-confidence release because they are not required to answer “Why should I make this pick?” and they would broaden the project too early:

- auction engine
- trade engine
- league commissioner operations
- full draft ledger workflows inside the dashboard
- broad strategic league intelligence beyond the pick decision
- historical draft analytics as a primary feature

The release should stay in the intelligence lane and avoid becoming an operations product.

---

## Final recommendation

The best V1.1 theme is:

Decision Confidence for the Pick

It is the smallest release that meaningfully improves the Draft Hub in the way users actually need it:

- compare options
- understand roster fit
- measure the cost of waiting
- explain player value
- know whether the pick is strong or risky

This is the right V1.1 scope because it improves decision quality without adding unnecessary complexity or product drift.
