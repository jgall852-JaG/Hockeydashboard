# V1.1 Implementation Plan

## Purpose

This plan sequences the approved four-tab information architecture so it can be implemented with minimal disruption to existing functionality.

Approved navigation:

1. League
2. Teams
3. Players
4. Draft Hub

The safest approach is to build the shared shell first, then move context outward from Draft Hub into the more appropriate tabs, and only then trim Draft Hub down to decision support.

No code is included here.

---

## Implementation strategy

### Guiding rules

- keep the current Draft Hub working at every step
- move context outward before removing it from Draft Hub
- ship the new shell before changing the detailed screens
- preserve local data flow and current render logic where possible
- avoid simultaneous layout and logic rewrites

### Safest sequence

1. Build the shared tab shell and routing
2. Add League as the startup page
3. Move Teams-owned context into the Teams tab
4. Add the Players tab and move player context there
5. Reduce Draft Hub to pick-time decision support only

---

## Phase 1 — Shared navigation shell

### Goal

Introduce the four-tab navigation framework without changing the meaning of the current screens.

### Features moved

- none yet
- this phase should mostly wrap existing content in the new tab shell

### New views required

- shared tab navigation shell
- League tab placeholder / entry view
- Teams tab placeholder / existing owner view container
- Players tab placeholder / directory container
- Draft Hub tab container

### Dependencies

- current data loading must remain intact
- existing Draft Hub render must continue to work
- tab state must persist across rerenders
- startup page must default to League

### Risk

Low to medium.

Main risk:
- navigation shell breaks existing single-screen rendering or loses input focus during rerenders

### User value

High.

This makes the app feel organized immediately and creates room for the rest of the IA change without removing functionality.

---

## Phase 2 — League tab

### Goal

Make League the startup and overview page.

### Features moved

- league overview cards
- data quality
- league-wide intelligence
- coverage / load status
- summary-level league context currently embedded in Draft Hub

### New views required

- League overview panel
- data health panel
- league intelligence panel

### Dependencies

- shared tab shell from Phase 1
- existing summary and aggregate helpers
- dataset metadata must remain available

### Risk

Low.

Main risk:
- duplicating summary logic instead of reusing the existing aggregate helpers

### User value

Medium to high.

League gives the GM context before they enter roster or draft work, and it becomes the clean startup page.

---

## Phase 3 — Teams and Players tabs

### Goal

Move roster ownership and detailed player context out of Draft Hub.

### Features moved

#### To Teams
- Owner List
- Owner Summary
- roster composition
- team needs
- prospects by owner
- veterans by owner
- farm players
- matching rights

#### To Players
- searchable player directory
- player profile
- ownership
- cost
- term
- matching rights
- retention status
- detailed Value Profile
- live NHL intelligence

### New views required

- Teams roster / owner view
- Players searchable directory
- player detail panel
- player context summary card

### Dependencies

- tab shell and League startup from previous phases
- owner and player data shaping functions
- roster matching helper
- live profile hydration must continue to work

### Risk

Medium.

Main risks:
- duplicate ownership logic across Teams and Players
- losing the current owner/player selection behavior
- focus or rerender issues during search

### User value

High.

This is the biggest usability win because it removes clutter from Draft Hub while making ownership, cost, term, rights, and retention easier to find.

---

## Phase 4 — Draft Hub cleanup and final trim

### Goal

Constrain Draft Hub back to pick-time decision support only.

### Features moved

- full Value Profile detail
- ownership-heavy context
- full contract / retention detail
- league overview cards
- roster walls

### Keep in Draft Hub

- Best Available
- Draft Board
- Draft Queue
- Position Scarcity
- Comparison
- Confidence Labels
- short Value Profile summary
- short Team Fit summary

### New views required

- compact Draft Hub summary row / pick context
- optional cross-links to Players and Teams for deeper detail

### Dependencies

- Teams tab must already contain the roster context
- Players tab must already contain player detail
- League tab must already contain health / overview

### Risk

Medium to high.

Main risks:
- removing information too early before Players and Teams fully cover it
- reducing Draft Hub usefulness if the summaries are too thin
- changing the user’s existing draft rhythm too abruptly

### User value

Very high.

This is where the information architecture becomes clean:
- Draft Hub stays fast
- context lives in the right places
- the GM sees less clutter during a live pick

---

## Recommended phase order

### Phase 1
Shared navigation shell

### Phase 2
League tab and startup page

### Phase 3
Teams tab and Players tab

### Phase 4
Draft Hub cleanup and context trimming

---

## Minimal-disruption implementation notes

- keep the current data model during the first phases
- do not remove Draft Hub detail until Teams and Players are complete
- move, then verify, then trim
- preserve current search and rerender safeguards
- keep League as the default startup page once the shell is active

---

## Recommended startup page

**League**

Reason:
- it is the least disruptive entry point
- it confirms data coverage first
- it avoids dropping the user directly into a crowded decision screen

---

## Final recommendation

The safest implementation sequence is:

1. shared tab shell
2. League
3. Teams
4. Players
5. Draft Hub cleanup

This sequence protects existing Draft Hub behavior while steadily moving the overloaded context into the correct tabs.
