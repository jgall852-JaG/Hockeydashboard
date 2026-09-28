# PROJECT_CONTEXT

## Project name
Hockey Dashboard

## Purpose
Local-first hockey dashboard for importing league CSVs and combining:
- identity
- historical performance
- schedule opportunity
- live NHL context

## Architecture
- HTML + CSS + JavaScript
- no backend
- no framework
- browser-first
- localStorage persistence

## Current version
v0.8

## Data sources
- Prospect CSVs
- Veteran CSVs
- Roster CSVs
- NHL API enrichment

## Position model
- Pool Position is the league-facing eligibility field and remains authoritative
- NHL Position is live metadata only and never overwrites Pool Position

## Team model
- NHL Team identity comes from local reference data
- Live current team metadata is displayed separately and never replaces identity

## Source-of-truth rules
- Local CSV files remain authoritative
- NHL API is enrichment only
- If the API is unavailable, the app still works from local data

## Current UI surfaces
- Owner view
- Player intelligence panel
- League intelligence summary
- Data quality panel

## V0.8 release focus
Answer:
- Who is this player?
- How good is this player?
- How much opportunity does this player have?
- What is happening with this player right now?

## Guardrails
- Preserve parser outputs
- Preserve localStorage schema
- Build incrementally
- Do not introduce React or a backend
