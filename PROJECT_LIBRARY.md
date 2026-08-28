# Project Library

## Purpose
This document is the permanent memory of the Hockey Dashboard project. It captures the design decisions, source-of-truth rules, known limits, and future direction that define the frozen architecture for V0.8 and the V0.75 reliability session.

## V0.6 Summary
V0.6 established the local-first foundation of the dashboard:
- CSV upload and import flow
- parser-driven data ingestion
- basic owner-centric aggregation
- persisted local state in the browser
- UI surfaces for league and owner visibility

This version proved the project could ingest local data and compute useful league context without introducing a backend.

## V0.7 Summary
V0.7 extended the dashboard into a more useful operational product:
- improved owner and player visibility
- richer summary and intelligence panels
- more resilient local storage and state handling
- better dataset status and data quality awareness
- clearer interpretation of imported data under the local-first architecture

This version strengthened trust in the app as a practical tool while preserving the no-framework, browser-first model.

## V0.8 Summary
V0.8 adds live hockey intelligence without changing the authoritative design:
- local CSV data remains authoritative
- NHL API data is enrichment only
- player identity, historical stats, and local roster context stay separate from live metadata
- the app shows team, current roster, standings, and schedule context as optional enrichment
- direct browser-to-NHL requests are not treated as a production dependency

V0.8 answers:
- Who is this player?
- How good is this player?
- How much opportunity does this player have?
- What is happening with this player right now?

## Architecture Decisions
- Browser-first HTML/CSS/JavaScript app
- no backend and no framework
- localStorage persists the dashboard state for the browser session and repeated loads
- local CSV imports remain the authoritative source of truth
- live NHL data enriches the profile and is displayed separately from authoritative fields
- app behavior must remain usable when live data is unavailable or fails

## Source-of-Truth Rules
1. Local CSV imports are authoritative.
2. NHL API data is enrichment only.
3. Pool Position remains the league-facing field and is not overwritten by NHL Position.
4. Local NHL team identity remains separate from live team/current-team metadata.
5. If live data fails, the dashboard still works from local data.
6. Parser outputs and localStorage schema are preserved unless a specific migration is required and explicitly documented.

## Known Limitations
- Browser direct fetches to the NHL API are blocked by CORS.
- Live data may be partial, delayed, or schema-shifting.
- localStorage is browser-specific and not a portable archive or deployment mechanism.
- A fresh machine does not automatically inherit the same local browser state.
- The app is not designed to rely on a desktop PC, a specific browser profile, or a single machine being online.

## Deferred Work
These are intentionally deferred to preserve the architecture and product focus:
- player intelligence feature expansion
- historical-performance modeling beyond current scope
- draft rankings and value-engine logic
- draft war room features
- V0.9 reports and reporting suites
- draft hub or asset management builds

These items are not rejected forever; they are simply not part of the V0.75 or V0.8 contract.

## Future Vision
The future vision remains intentionally narrow and discipline-driven:
- local-first and portable by default
- resilient on a draft laptop and on a fresh machine
- robust without depending on the desktop machine being powered on
- easy to run from a repo-backed or packaged workflow
- able to degrade gracefully when live data fails

The long-range strategic goal is not a new intelligence engine. It is dependable access, trustworthy defaults, and operational clarity during a real draft-day environment.

## Operational Guidance
- Treat local data as the trusted layer.
- Treat live data as context, not truth.
- Treat localStorage as a convenience, not a deployment strategy.
- Treat GitHub and versioned repo artifacts as the durable source of project history and operational continuity.
- Treat portability as a first-class requirement for draft-day success.

## Final Position
The project’s durable identity is a local-first, browser-based dashboard that remains useful when data sources are incomplete, delayed, or unavailable. The V0.75 session is about surviving the real-world conditions of draft day, laptop-only access, and fresh-machine startup without undermining the frozen architecture.

## V1.0 Draft Hub

### Question Answered
Given everything the platform knows...

WHAT SHOULD I DO?

### Capabilities
- Best Available
- Draft Board
- Draft Queue
- Position Scarcity
- Team Needs
- Value Profile

### Product definition
The V1.0 Draft Hub is the smallest release-worthy draft-day command center. It is a single-screen workflow that helps a GM answer the critical draft questions without leaving the hub:
- Who is available?
- Who is best available?
- What is scarce?
- What is the asset value?
- What fits my team needs?
- What should I queue up next?

### Scope boundaries
This release intentionally does not include:
- auction engine
- commissioner dashboard
- trade engine
- league operations tooling
- inflation or budget modeling
- advanced multi-board analytics

These belong to future releases. V1.0 is a focused operational decision-support tool designed to help the user draft successfully from a single screen.

### Release status
The V1.0 Draft Hub is an operational release candidate for a single-screen draft workflow. It is intentionally limited in scope so that it can ship successfully under real draft-day pressure while preserving the project’s local-first architecture and disciplined roadmap.
