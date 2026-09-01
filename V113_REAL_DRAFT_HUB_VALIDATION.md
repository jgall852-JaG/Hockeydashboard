# V1.1 Real Draft Hub Validation

## Purpose

This report validates whether the current Draft Hub provides enough information for a GM to make confident draft decisions using real league data.

It is a validation report only.

- no implementation
- no feature work
- no refactoring

---

## Bottom line

Yes, the Draft Hub is usable for real draft decisions.

But it is not equally strong across all surfaces.

### Strong enough now

- Best Available
- Queue
- Scarcity
- Value Profile
- Team Fit

### Still weaker than it should be

- Comparison
- Board-level league context visibility
- Fast read of ownership / cost / term / rights / retention without opening details

---

## Scenario 1: Auction starts in 10 minutes

### What information was needed immediately

At auction speed, the GM needs:

- current Best Available
- current queue
- position scarcity
- roster needs
- player value
- ownership context
- cost
- term
- matching rights
- retention status

### What the Draft Hub gives well

- Best Available
- Queue management
- Scarcity view
- Team Needs
- Value Profile

### What is missing or too hidden

- ownership is not prominent enough at a glance
- cost is not visible enough on the fastest surfaces
- term is more explanation-level than decision-level
- matching rights are visible, but not central enough
- retention status is not surfaced as strongly as a GM would want before an auction

### Verdict

The hub is good enough to start the auction, but the GM would still need to open deeper detail panels to make fully confident decisions.

---

## Scenario 2: Compare real players

Players reviewed:

- Macklin Celebrini
- Michael Misa
- Lane Hutson
- Dylan Guenther
- Beckett Sennecke

### Most likely take

**Macklin Celebrini** is the strongest default choice.

### Why

- elite-tier profile
- strong value signal
- low-risk profile
- matching rights support the case
- term is already favorable

### Other strong cases

- **Michael Misa**: excellent upside and strong control context
- **Lane Hutson**: strong fit if defense scarcity matters
- **Dylan Guenther**: strong value if cost efficiency matters
- **Beckett Sennecke**: attractive upside/value play, but more situational

### Did Draft Hub help?

Yes, partially.

It helped most with:

- value
- scarcity
- fit
- confidence

It helped less with:

- fast comparison of ownership
- cost
- term
- rights
- retention status as decision inputs

### Verdict

The hub can support the pick, but comparison still leans too heavily on value framing and not enough on league-context framing.

---

## Scenario 3: How often do league fields matter?

### Ownership

- **How often needed:** often
- **Influence:** high
- **Why:** ownership changes roster context immediately

### Cost

- **How often needed:** always in auction, often in broader decision-making
- **Influence:** high
- **Why:** cost determines whether the player is a value or a burden

### Term

- **How often needed:** often
- **Influence:** medium to high
- **Why:** term shapes how long the GM is committing resources

### Matching Rights

- **How often needed:** often when comparing similar players or long-term assets
- **Influence:** medium to high
- **Why:** rights affect flexibility and future control

### Retention Status

- **How often needed:** sometimes, but critical when relevant
- **Influence:** high
- **Why:** retention changes control, stability, and planning

### Verdict

All five fields matter.

Cost and ownership are the most immediately influential.
Retentions and rights become highly important when the GM is deciding between close options.

---

## Scenario 4: What would the GM still need?

Even with the current Draft Hub, a GM still wants:

- a quick way to see who owns a player
- a quick way to see what the player costs
- a quick way to see how long the player is controlled
- a quick way to see whether rights are active
- a quick way to see whether the player is retained or otherwise protected

### Current state

These are available in the data and visible in deeper panels.

### Remaining gap

They are not prominent enough on the fastest draft surfaces.

---

## Current Draft Hub decision quality

### What it does well

- narrows the board
- highlights top value
- shows scarcity
- supports fit-based thinking
- gives a confidence label

### What it still lacks

- immediate league-context visibility
- richer side-by-side decision framing
- stronger auction-speed readability

---

## Recommendation

The Draft Hub should continue to surface league context in a layered way:

1. **Draft Board** for quick context
2. **Comparison** for decision tradeoffs
3. **Team Fit** for roster logic
4. **Value Profile** for explanation
5. **Confidence Labels** for quick synthesis

### Most important fields to surface more clearly

- ownership
- cost
- term
- matching rights
- retention status

---

## Final answer

Can a GM actually draft from the current Draft Hub?

**Yes — with some caution.**

The hub is strong enough to make decisions from, but the GM will still need to inspect deeper context for the most confident picks.

The biggest remaining improvement is not more player intelligence.
It is making league context easier to see at draft speed.
