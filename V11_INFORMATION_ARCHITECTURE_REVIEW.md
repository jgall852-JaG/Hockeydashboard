# V1.1 Information Architecture Review

## Purpose

This document defines the cleanest scalable organization for Hockey Dashboard using four primary tabs:

- League
- Teams
- Players
- Draft Hub

The goal is to keep Draft Hub focused on pick-time decisions and move league context to the right place.

No implementation is included.

---

## Core conclusion

Draft Hub works.

But it should not become the place where every useful field lives.

The best structure is:

- **League** = overview and health
- **Teams** = ownership and roster context
- **Players** = detailed player context
- **Draft Hub** = live draft decision support

This keeps the app scalable and easier to use.

---

## 1. League Tab Contents

### Purpose

League-wide context and system health.

### Keep here

- League Overview
- Data Quality
- League Intelligence
- dataset coverage / load status
- general standings or league context if available

### Move here

- summary-level league cards currently sitting inside Draft Hub

### Remove from here

- owner-by-owner roster detail
- detailed player profiles
- pick-time draft tools

### Future

- standings expansion
- league timeline / season view
- broader league analytics

### League question answered

- What is happening in the league?
- Is the data current?
- What is the overall landscape?

---

## 2. Teams Tab Contents

### Purpose

Owner and roster context.

### Keep here

- Owner List
- Owner Summary
- Prospects by owner
- Veterans by owner
- Farm Players
- Matching Rights
- Team Needs
- roster-based player detail
- team-specific summary cards

### Move here

- ownership-heavy player context
- roster composition views
- team-need interpretation that depends on current roster state

### Remove from here

- Draft Hub pick logic
- Best Available
- board/ranking tools
- confidence labels

### Future

- team comparison
- roster depth charts
- owner planning notes

### Teams question answered

- Who owns what?
- What does each roster look like?
- What does each team still need?

---

## 3. Players Tab Contents

### Purpose

Detailed player directory and profile.

### Keep here

- searchable player list
- player profile
- ownership
- cost
- term
- matching rights
- retention status
- live NHL intelligence
- historical context
- player-level league context cards

### Move here

- detailed Value Profile content
- contract/control details
- player-specific context that is not time-critical

### Remove from here

- Draft Hub ranking widgets
- queue tools
- live pick-time decision controls

### Future

- player comparison archive
- player timeline view
- more detailed player filters

### Players question answered

- Who is this player?
- What do they cost?
- How long are they controlled?
- What rights or retention context matters?

---

## 4. Draft Hub Contents

### Purpose

Pick-time decision support only.

### Keep here

- Best Available
- Draft Board
- Draft Queue
- Position Scarcity
- Comparison
- Confidence Labels
- short Value Profile summary
- short Team Fit summary

### Move here

- only the minimum context needed to choose quickly

### Remove from here

- full ownership detail
- full contract detail
- full retention breakdown
- league overview cards
- owner roster walls

### Future

- auction engine
- commissioner dashboard
- trade engine
- market value system

### Draft Hub question answered

- What should I do now?
- Who should I take?
- Who is best available?
- Who is the best fit?

---

## Feature classification

| Feature | Classification | Best location |
|---|---|---|
| Owner List | MOVE | Teams |
| Owner Summary | MOVE | Teams |
| Prospects by owner | KEEP | Teams |
| Veterans by owner | KEEP | Teams |
| Farm Players | KEEP | Teams |
| Matching Rights | MOVE | Teams / Players |
| Team Needs | KEEP | Teams, with a compact Draft Hub summary only |
| Roster Composition | MOVE | Teams |
| Search (players) | KEEP | Players |
| Search (draft board) | KEEP | Draft Hub |
| Best Available | KEEP | Draft Hub |
| Draft Board | KEEP | Draft Hub |
| Draft Queue | KEEP | Draft Hub |
| Position Scarcity | KEEP | Draft Hub |
| Comparison | KEEP | Draft Hub |
| Value Profile | MOVE | Players, with short Draft Hub summary |
| Confidence Labels | KEEP | Draft Hub |
| Ownership | MOVE | Players / Teams |
| Cost | MOVE | Players / Teams |
| Term | MOVE | Players |
| Retention Status | MOVE | Players / Teams |
| League Overview | KEEP | League |
| Data Quality | KEEP | League |
| League Intelligence | KEEP | League |

---

## What belongs where

### League
- overview
- health
- loaded data status
- league-wide intelligence

### Teams
- owner list
- roster composition
- team needs
- ownership context

### Players
- player search
- player profile
- ownership
- cost
- term
- rights
- retention

### Draft Hub
- Best Available
- Draft Board
- Draft Queue
- Scarcity
- Comparison
- Confidence
- quick decision summaries

---

## Recommended startup page

**League**

Why:
- it orients the GM before draft work starts
- it shows whether the data is loaded and current
- it avoids making Draft Hub the default dumping ground

---

## Recommended navigation order

1. League
2. Teams
3. Players
4. Draft Hub

Why:
- League gives context
- Teams shows roster state
- Players shows detailed player context
- Draft Hub is the final decision surface

---

## Cleanest scalable model

The cleanest way to organize Hockey Dashboard is:

- keep broad context out of Draft Hub
- keep roster context in Teams
- keep detailed player context in Players
- keep only draft decisions in Draft Hub

### Rule of thumb

If a feature helps understand the league, put it in League.

If it helps understand a roster, put it in Teams.

If it helps understand a player, put it in Players.

If it helps make a pick, put it in Draft Hub.

---

## Final recommendation

Use the four-tab structure permanently:

- **League** for overview
- **Teams** for roster ownership
- **Players** for detailed player context
- **Draft Hub** for live draft decisions

This is the cleanest and most scalable way to organize Hockey Dashboard without turning Draft Hub into a dumping ground.
