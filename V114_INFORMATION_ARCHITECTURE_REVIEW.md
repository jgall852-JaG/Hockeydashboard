# V1.1 Information Architecture Review

## Purpose

This review classifies the current dashboard surface into four tabs:

- Draft Hub
- Players
- Teams
- League

It identifies what should be kept, moved, removed, or deferred so the Draft Hub stays focused and the broader league context becomes easier to use.

No implementation is included.

---

## Core finding

The Draft Hub works.

Its strongest features are:

- Comparison
- Scarcity
- Value Profile

But the Hub is becoming overloaded because league-context fields are not visible enough elsewhere:

- Ownership
- Cost
- Term
- Rights
- Retention

Those belong more naturally in Players and Teams than inside Draft Hub.

---

## Recommended tab ownership

### 1. League

Purpose:
- league-wide overview
- overall context
- data coverage

Keep here:
- League Overview
- Data Quality
- League Intelligence
- standings / league context if available

Move here:
- nothing from Draft Hub core

Future:
- richer standings views
- league timeline / season-level context

---

### 2. Teams

Purpose:
- owner/roster view
- roster composition
- team needs
- retention / control context

Keep here:
- Owner List
- Owner Summary
- Prospects list by owner
- Veterans list by owner
- Farm Players
- Matching Rights
- Team Needs
- roster-based player detail

Move here:
- owner-centric breakdowns currently embedded in Draft Hub
- team-need interpretation that depends on roster ownership

Future:
- team comparison views
- roster depth charts
- team-specific planning panels

---

### 3. Players

Purpose:
- player directory
- player profile
- detailed league context

Keep here:
- searchable player list
- player detail panel
- ownership
- cost
- term
- matching rights
- retention status
- live NHL intelligence
- historical context

Move here:
- detailed Value Profile content
- contract / control context
- ownership-heavy player detail

Future:
- richer player comparison archives
- player history timelines
- player-centric filters and sort modes

---

### 4. Draft Hub

Purpose:
- live draft decision screen
- pick-time support
- fast comparison and ranking

Keep here:
- Best Available
- Draft Board
- Draft Queue
- Position Scarcity
- Comparison
- concise Value Profile summary
- Confidence Labels

Move here:
- only the minimum league context needed to make the pick quickly

Future:
- auction engine
- commissioner tools
- trade engine
- market-value modeling

---

## Feature classification

### Keep

#### Draft Hub
- Best Available
- Draft Board
- Draft Queue
- Position Scarcity
- Comparison
- Confidence Labels

#### Players
- searchable player directory
- player profile
- ownership
- cost
- term
- rights
- retention status
- live NHL context

#### Teams
- owner list
- owner summary
- team needs
- roster composition
- prospect / veteran split
- matching-rights context

#### League
- league overview
- data quality
- loaded dataset status
- league-wide intelligence

---

### Move

#### From Draft Hub to Players
- detailed Value Profile
- ownership detail
- cost detail
- term detail
- rights detail
- retention detail

#### From Draft Hub to Teams
- owner list emphasis
- roster-based needs
- owner-centric player groupings

#### From Draft Hub to League
- league-wide context cards
- data status / coverage
- summary-level intelligence

---

### Remove

These should not remain duplicated across tabs:

- repeated owner summaries in Draft Hub
- repeated contract/context detail in Draft Hub
- league-level summary cards inside Draft Hub

Remove does not mean delete the data.
It means stop showing it in the wrong place.

---

### Future

These remain out of scope for the current architecture pass:

- auction engine
- commissioner dashboard
- trade engine
- market value engine
- live synced draft ledger
- full league operations tooling

---

## Feature-by-feature recommendation

| Feature | Keep / Move / Remove / Future | Best location |
|---|---|---|
| Owner List | Move | Teams |
| Owner Summary | Move | Teams |
| Prospects by owner | Keep | Teams |
| Veterans by owner | Keep | Teams |
| Matching Rights | Move | Teams / Players |
| Team Needs | Keep | Teams + Draft Hub summary |
| Search | Keep | Players + Draft Hub |
| Best Available | Keep | Draft Hub |
| Draft Board | Keep | Draft Hub |
| Draft Queue | Keep | Draft Hub |
| Position Scarcity | Keep | Draft Hub |
| Comparison | Keep | Draft Hub |
| Value Profile | Move | Players, with short Draft Hub summary |
| Confidence Labels | Keep | Draft Hub |
| Ownership | Move | Players / Teams |
| Cost | Move | Players / Teams |
| Term | Move | Players |
| Retention Status | Move | Players / Teams |
| League Overview | Keep | League |
| Data Quality | Keep | League |
| League Intelligence | Move | League |

---

## Recommended screen behavior

### Draft Hub
Should answer:
- Who is best?
- Who fits?
- Who is scarce?
- Which player should I take now?

It should not try to also be the full league browser.

### Players
Should answer:
- Who is this player?
- What do they cost?
- How long are they controlled?
- What rights or retention context matter?

### Teams
Should answer:
- What does each owner need?
- What is already controlled on that roster?
- Which players sit in which owner context?

### League
Should answer:
- What is happening across the league?
- Is the data current?
- What is the overall shape of the league state?

---

## Recommendation

Move the league-context burden out of Draft Hub and into Players and Teams.

Keep Draft Hub focused on pick-time decision support only.

### Best split

- **League** = overview and health
- **Teams** = ownership and roster context
- **Players** = detailed player context
- **Draft Hub** = pick-time decision support

### Final answer

Draft Hub should keep the decision surfaces.
Players and Teams should own the context surfaces.
League should own the overview surfaces.

That gives the GM enough information without overloading the draft screen.
