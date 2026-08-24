# Data Contract: Player Intelligence Model

## Purpose

This document defines the canonical data relationship model for player intelligence in the Hockey Dashboard. It is intended to preserve the current local-first CSV architecture while establishing a clear contract for future enrichment with NHL team identity, schedule opportunity, and valuation inputs.

This contract is authoritative for future implementation work and is intentionally designed to avoid changing the current parser outputs or localStorage schema.

---

## Core Principle

The project currently stores imported league data as owner-centric CSV-derived records. Future intelligence fields must be treated as derived or enrichment data, not as parser outputs.

This preserves:
- existing import workflow
- localStorage schema stability
- parser stability
- no backend dependency

---

## 1. Prospect Record

### Canonical imported prospect record

The current prospect dataset is the source-of-truth record imported from Prospects.csv. It is defined by the parser contract already used by the application and should remain unchanged.

Required fields in the imported record model:
- playerId
- name
- owner
- cost
- prospect
- farm
- termRemaining
- matchingRights
- draftYear

Optional or derived fields already used by the current app:
- position (if present in source data)
- team ownership labels
- roster ownership context

### Interpretation

This prospect record answers:
- who the player is
- which owner owns the player
- what the player costs in league terms
- whether the player is a farm player
- whether matching rights are available
- the draft year and prospect status

It does not answer:
- which NHL team the player belongs to
- how much schedule opportunity the player has
- which team schedule quality affects the player
- whether the player is undervalued or overvalued

### Design constraint

The imported prospect record must remain stable. Future schedule and valuation data must be layered on top of this record rather than inserted into the imported structure.

---

## 2. Identity Layer

### Relationship problem

The dashboard needs stable player name, alias, position, and NHL team resolution before historical stats or schedule opportunity can be attached.

### Source of truth

The identity layer is sourced from:

- `Data/Reference/AHL Draft - Positions.csv`
- `Data/Reference/AHL Draft - Utility.csv`

### Canonical relationship

Player record -> alias resolution -> identity layer -> position / NHL team

This is not a parser output and should not be embedded in the CSV import.

### Canonical lookup model

The identity lookup should contain:

- playerName
- normalizedName
- aliasList
- position
- nhlTeam
- teamCode
- optional confidence flag
- optional source metadata

### Why this is necessary

The app needs one authoritative identity layer so player naming, position, and NHL team stay consistent across Prospect Explorer, historical stats, and schedule display.

### Design rule

Position and NHL team must be treated as resolved identity fields, not raw imported fields.

That means:

- imported league data answers ownership and league context
- reference data answers player identity, position, and NHL team
- the resolved result is used by historical and schedule enrichment

---

## 3. GamesPlayedBulator Relationship

### Canonical source model

GamesPlayedBulator is a league intelligence dataset representing franchise schedule opportunity under league-defined fantasy rules.

Each NHL team record carries:
- teamId
- teamName
- homeEligibleGames
- awayEligibleGames
- totalEligibleGames
- firstHalfEligibleGames
- secondHalfEligibleGames
- leagueAverageEligibleGames
- optional differential fields
- optional classification metadata

### Relationship to prospects

The correct relationship is:

- prospect -> identity layer -> resolved NHL team -> GamesPlayedBulator team record

### Derived enrichment fields

A prospect should not store schedule data as raw imported CSV content. Instead, enriched prospect data should contain the following derived fields when a mapping is available:
- nhlTeam
- nhlTeamId
- eligibleGames
- homeEligibleGames
- awayEligibleGames
- firstHalfEligibleGames
- secondHalfEligibleGames
- eligibleGameDifferential
- scheduleOpportunityLabel

### Example semantics

If a prospect resolves to a franchise with 68 total eligible games, the prospect view may show:
- NHL Team: Boston Bruins
- Eligible Games: 68
- 1st Half Games: 34
- 2nd Half Games: 34

If no mapping exists:
- NHL Team: Unmapped
- Eligible Games: —
- 1st Half Games: —
- 2nd Half Games: —

### Design rule

Schedule metrics must be attached via enrichment, never by modifying the imported league CSV contract.

---

## 4. Future Statistics Integration

### Purpose

The project’s long-term vision makes clear that player value is broader than raw cost or projections. Future analytics should integrate schedule, role, and performance data with the prospect record.

### Required future intelligence sources

The project documents the following future source areas:
- NHL API
- NHL EDGE data
- historical NHL data
- Excel projection files
- draft guides
- prospect rankings
- scouting reports
- historical auction results
- historical league exports
- position scarcity models
- personal research

### Canonical data layering model

The future statistics architecture should be:

1. Core imported data
   - Prospect records
   - Veteran records
   - Owner records

2. Franchises and schedule intelligence
   - NHL team identity
   - GamesPlayedBulator metrics
   - home/away and first/second-half splits

3. Player intelligence enrichment
   - projection data
   - performance data
   - age, role, opportunity, scenarios

4. Valuation layer
   - price / cost comparison
   - schedule opportunity adjustment
   - position scarcity adjustment
   - matching rights and farm-related modifiers

### Recommendation

A dedicated Player Intelligence Database is recommended as the long-term canonical model for these enriched records, even if it is not required immediately.

Why it is valuable:
- it separates raw imports from derived intelligence
- it supports multiple enrichment sources without mutating the imported data
- it allows future valuation and draft logic to query a stable player-centric model
- it keeps the app local-first while supporting richer analytics in the future

This database does not need to be implemented as a server or external system in the first step. It can be an app-layer intelligence registry that is designed to behave like a canonical player database.

---

## 5. Future Valuation Engine Integration

### Canonical philosophy

The project explicitly states that player value should not be based solely on projections. Value should consider:
- position scarcity
- games played
- first-half schedule
- second-half schedule
- playoff schedule
- farm eligibility
- matching rights
- contract cost
- age
- draft pedigree
- league-specific rules
- owner behavior patterns

### Valuation dependency chain

Future valuation should consume the enriched player intelligence model, which includes:
- prospect source record
- franchise schedule context
- cost and ownership context
- farm and matching rights flags
- draft year and pedigree
- optional projection and performance values

### Expected outputs

The valuation engine should ultimately produce outputs such as:
- expected value
- current cost
- difference
- undervalued rating
- overvalued rating
- fair value assessment

### Relationship to this data contract

This contract establishes the canonical player intelligence model required for valuation:
- the imported player record remains stable
- schedule and team information is resolved through a derived relationship
- additional intelligence is layered in a separate model
- valuation consumes a unified enriched view instead of raw CSV fields

---

## 6. Final Canonical Model

### Raw imported record
- Prospect record from Prospects.csv
- Veteran record from Veterans.csv
- Owner data derived from imported records

### Derived intelligence record
- Prospect derived view model
- NHL team identity from the identity layer
- schedule metrics from GamesPlayedBulator
- optional projected value and statistics from future sources

### Canonical principle

The canonical player intelligence model is:

Prospect Record
  + Derived Identity Layer
  + Derived Schedule Intelligence
  + Historical Performance Enrichment
  = V0.7 Player Intelligence View

This model ensures:
- parser outputs remain stable
- localStorage remains stable
- the project keeps its local-first no-framework approach
- future valuation and draft logic can grow without reworking the raw import model

---

## 7. Decision Summary

1. Current prospect data does not contain NHL team information.
2. NHL team identity should be modeled as a separate identity-layer resolution, not as a parsed field.
3. Historical performance should come from `Data/Historical/`.
4. Schedule opportunity should come from `GamesPlayedBulator`.
5. Future enrichment sources should include schedule data, NHL/statistical feeds, projections, scouting data, and contextual valuation inputs.

This document establishes the canonical architecture for player intelligence before schedule enrichment is implemented.
