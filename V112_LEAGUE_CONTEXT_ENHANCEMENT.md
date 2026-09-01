# V1.1 League Context Enhancement

## Purpose

This document recommends how to surface league-context fields so the GM can make better draft decisions without adding unnecessary complexity.

No implementation is included.

The focus is narrow:

- keep the Draft Hub decision-support first
- avoid turning it into an operations or ledger system
- surface only the fields that change the draft decision quickly

---

## Core principle

The Draft Hub should not add more data just because the league has more data.

It should surface the league context that helps answer:

- Is this player worth it?
- Is this player a fit?
- Is this pick urgent?
- Is this player still a value?

That means the league-context fields should be exposed where they directly improve decision quality.

---

## 1. Draft Board

### Recommended surfaced fields

- **Ownership**: shown as a compact owner/team label
- **Cost**: shown as a small value tag
- **Term**: shown as a short control-length indicator
- **Rights**: shown only as a badge when active
- **Retention status**: shown as a small status flag

### Why here

The draft board is the fastest scanning surface.
It should show just enough league context to prevent the GM from overvaluing a player who looks good in isolation.

### Board impact

- ownership helps identify where the player sits in the league ecosystem
- cost helps distinguish cheap upside from expensive commitment
- term helps show whether the player is short- or long-horizon
- rights help flag future leverage
- retention status helps identify controlled assets or protected players

### UI density rule

Only one or two compact indicators should be visible per row.
Anything heavier belongs in the detail panels.

---

## 2. Comparison View

### Recommended surfaced fields

- **Ownership**: who controls each player
- **Cost**: direct side-by-side cost comparison
- **Term**: side-by-side control horizon
- **Rights**: whether one player has matching rights and the other does not
- **Retention status**: whether one player is retained/controlled

### Why here

Comparison is where league context matters most because the GM is deciding between two similar players.

The view should explain not just who is better, but which player has the better total draft-day shape.

### Comparison impact

- ownership clarifies roster/asset context
- cost clarifies value versus burden
- term clarifies future flexibility
- rights clarify optionality
- retention status clarifies control and permanence

### Decision rule

Comparison should answer:

“Which player is the better draft decision, not just the better player?”

---

## 3. Team Fit

### Recommended surfaced fields

- **Ownership**: show whether the player fits the GM’s current roster ownership picture
- **Cost**: show whether the player fits the team’s current cost structure
- **Term**: show whether the player fits the team’s planning window
- **Rights**: show whether the player adds control or flexibility
- **Retention status**: show whether the player is a controlled asset or a long-term hold

### Why here

Team fit should not only mean position fit.

It should also reflect the reality of the roster’s control, cost, and planning horizon.

### Team-fit impact

- ownership helps connect the player to current roster structure
- cost helps show whether the move is practical
- term helps show whether the fit is short-term or long-term
- rights help show whether the player is strategically protected
- retention status helps show whether the player supports future roster stability

### Decision rule

Team fit should answer:

“Does this player fit my roster plan as well as my position need?”

---

## 4. Confidence Labels

### Recommended surfaced fields

- **Ownership**: used as supporting context, not primary scoring
- **Cost**: increases or lowers confidence depending on value
- **Term**: improves confidence when the control horizon matches the GM’s need
- **Rights**: boosts confidence when flexibility or protection matters
- **Retention status**: boosts confidence when the asset is stable and controlled

### Why here

Confidence labels should remain simple.

They should synthesize league context instead of exposing every detail separately.

### Confidence impact

- good ownership context can raise confidence
- favorable cost can raise confidence
- stronger term can raise confidence
- matching rights can raise confidence
- retention stability can raise confidence

### Guardrail

Confidence should not become a hidden scoring model.
It should remain an explanation layer.

---

## 5. Value Profile

### Recommended surfaced fields

- **Ownership**: show who owns the asset
- **Cost**: show contract or acquisition cost
- **Term**: show control length
- **Rights**: show matching rights where relevant
- **Retention status**: show whether the player is retained, controlled, or otherwise protected

### Why here

Value Profile is the best place to expose these fields in depth.

It already exists as the most explanation-oriented panel.

### Value impact

- ownership clarifies asset context
- cost clarifies actual value pressure
- term clarifies future commitment
- rights clarify leverage
- retention status clarifies whether the asset is truly available or strategically locked

### Decision rule

Value Profile should answer:

“Why is this player a good or bad draft-day asset?”

---

## GM workflow impact

The GM should experience the context in this order:

1. **Draft Board** for quick scanning
2. **Comparison View** for the decision between two players
3. **Team Fit** for roster context
4. **Value Profile** for deeper explanation
5. **Confidence Labels** for a final quick read

### Workflow effect

This keeps the app fast:

- board = glance
- comparison = choose
- fit = confirm
- value = explain
- confidence = summarize

### What this avoids

- too many new panels
- duplicate explanations
- operational clutter
- hidden complexity

---

## High-value surfaces

The highest-value surfaces for these fields are:

1. **Value Profile**
2. **Comparison View**
3. **Team Fit**
4. **Draft Board**
5. **Confidence Labels**

### Why this order

- Value Profile can absorb the most detail
- Comparison makes the context actionable
- Team Fit connects the context to the roster
- Draft Board keeps it visible at draft speed
- Confidence Labels summarize the result

---

## Recommended V1.1 scope

The smallest useful V1.1 scope is:

- surface ownership
- surface cost
- surface term
- surface matching rights
- surface retention status

But only in the following way:

- compact on the Draft Board
- explicit in Comparison
- explanatory in Team Fit
- detailed in Value Profile
- summarized in Confidence Labels

### What not to do

- do not add new league-operations screens
- do not add auction engine behavior
- do not add commissioner tooling
- do not add budget modeling
- do not create another authoritative league record

### Release rule

If a field does not help the GM decide faster, it should not be surfaced.

---

## Recommendation

Surface the league-context fields in a layered way:

- **Board:** compact indicators
- **Comparison:** side-by-side decision context
- **Team Fit:** roster and planning interpretation
- **Value Profile:** detailed explanation
- **Confidence Labels:** short decision summary

### Final answer

The best league-context information to surface is:

- ownership
- cost
- term
- matching rights
- retention status

These fields improve draft decisions without adding much complexity because they fit naturally into the existing Draft Hub surfaces.
