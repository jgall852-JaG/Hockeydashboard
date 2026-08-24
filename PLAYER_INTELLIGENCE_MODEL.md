# Player Intelligence Model

## Purpose

This document defines the canonical design for player intelligence in the Hockey Dashboard. It is a design-only contract intended to support future enrichment for:

- GamesPlayedBulator integration
- Historical statistics
- NHL API enrichment
- Forecast / projection integration
- Draft War Room
- League Valuation Engine
- Trade Analyzer

The design preserves the current architecture:

- no parser changes
- no localStorage schema changes
- no app architecture redesign
- no backend requirement
- local-first, client-side-only model

---

## Design Principles

1. Raw imported league data remains the source of truth.
2. All intelligence beyond imported data is derived or enrichment data.
3. Player identity is separated from owner identity and franchise identity.
4. NHL team is a derived field, not a raw imported field.
5. Schedule opportunity is a distinct intelligence layer.
6. Historical statistics, projections, and valuation are layered on top of the canonical player record.
7. The player model is designed to support both league operations and future valuation workflows without mutating the CSV import model.

---

## 1. Canonical Player Model

The canonical player model is a unified, read-time view built from the imported player dataset plus additional intelligence layers.

### Canonical player record

- playerId
  - canonical unique player identifier
- name
  - display name
- leagueName
  - name as imported in the league data
- firstName
  - optional normalized first name
- lastName
  - optional normalized last name
- owner
  - current league owner / fantasy team name
- ownerId
  - internal owner identifier where needed
- playerType
  - prospect | veteran | unknown
- nhlTeam
  - resolved NHL franchise name
- nhlTeamId
  - resolved NHL franchise identifier
- position
  - league-defined position label
- age
  - optional age reference
- draftYear
  - if applicable
- cost
  - league cost or current value
- termRemaining
  - prospect term remaining if applicable
- farm
  - boolean
- matchingRights
  - boolean
- prospectStatus
  - active prospect, veteran, farm, etc.

### Schedule intelligence

- eligibleGames
- homeEligibleGames
- awayEligibleGames
- firstHalfEligibleGames
- secondHalfEligibleGames
- eligibleGameDifferential
- scheduleOpportunityLabel
- scheduleSource

### Historical statistics

- season
- gamesPlayed
- goals
- assists
- points
- plusMinus
- shots
- shootingPct
- toi
- fantasyRelevantMetrics
- source

### Projection data

- projectionSeason
- projectedPoints
- projectedGoals
- projectedAssists
- valueBand
- projectionConfidence
- projectionSource
- projectionTimestamp

### Valuation data

- expectedValue
- currentCost
- costPerEligibleGame
- costPerPoint
- valueScore
- valuationLabel
  - bargain | fair | overpriced
- valuationSource
- valuationTimestamp

### Metadata

- sourceDataset
- sourceRecordId
- createdAt
- updatedAt
- confidenceFlags
- dataCompleteness

---

## 2. Player Identity Strategy

### Identity requirement

A player must be identified in a way that remains stable across:

- imported league records
- future NHL statistical feeds
- projection datasets
- valuation models
- draft and trade analytics

### Canonical identity rules

A player should have a canonical identity composed of:

- playerId
- normalizedName
- sourceAliases
- optional externalIds

### Recommended identity model

The best long-term strategy is a stable canonical player identity with flexible alias resolution.

#### Player identity fields

- canonicalPlayerId
  - generated from a normalized player name and supporting identifiers
- normalizedName
  - lowercase, diacritics removed, punctuation normalized
- sourceAliases
  - external names from different data sources
- externalIds
  - NHL player id, legacy id, draft id, etc.

### How a player is uniquely identified

A player should be uniquely identified by a canonical id generated from a stable, normalized identity key.

In practice, the canonical id should combine:

- normalized full name
- optional birth year if available
- optional NHL id when available
- optional source-specific identifiers

This prevents collisions between players with the same name while still allowing a simple local-first system to work without a server.

### Duplicate names

Duplicate names should be handled in one of three ways:

1. Exact textual match with same external identifier when known
2. Same name + same birth year or same NHL id when available
3. Manual resolution metadata for ambiguous records

The app should not assume a single name uniquely identifies a player.

### Identity relationship to imported records

Player identity should link all of the following:

- prospect record
- veteran record
- owner assignment
- future NHL player stats
- future projections
- valuation outputs

This creates a unified player record without modifying parser outputs.

### Relationship to prospects and veterans

A single canonical player may appear in multiple league records:

- prospect record: draft-eligible player
- veteran record: current roster player
- future NHL stats: active player record

These represent different states of the same underlying player identity.

The canonical model should therefore support:

- multiple record states per canonical player
- a current league state pointer
- historical league record snapshots when relevant

This is especially important for:
- valuation over time
- draft comparisons
- trend analysis
- trade evaluation

---

## 3. NHL Team Relationship

### Whether NHL Team should be a core field

NHL team should not be a raw imported field in the current data model. It should be a derived field in the canonical player model.

Reason:

- current league records are owner-centric
- schedule data is team-centric
- the project explicitly treats owners as the league unit
- NHL team is a contextual intelligence field, not a CSV source field

### Canonical rule

The owner-to-franchise relationship is the bridge:

- player -> owner -> NHL team

This relationship is required because:

- the imported league data identifies ownership
- GamesPlayedBulator identifies schedule by NHL team
- the valuation model needs team-level opportunity data

### NHL Team mapping model

A team relationship layer should include:

- ownerName
- mappedNhlTeamName
- nhlTeamId
- franchiseAliasList
- mappingConfidence
- source

### How players map to NHL teams

A player is mapped to an NHL team by:

1. reading the player’s league owner
2. matching the owner to an NHL franchise mapping
3. attaching the resolved franchise schedule context

This mapping is not a raw player property and should be treated as a derived intelligence relationship.

### How GamesPlayedBulator attaches

GamesPlayedBulator attaches at the franchise level, then flows down to the player record.

Canonical flow:

- player record
- resolves to owner
- resolves to NHL franchise
- franchise schedule dataset is looked up
- schedule metrics are attached to player view

This preserves the correct semantics:

- schedule opportunity belongs to the team
- player value is affected by team context
- league owner remains the central structure in the app

---

## 4. Schedule Intelligence Structure

Schedule intelligence is derived from team-level schedule data and attached to player records.

### Core schedule model

Each team schedule entry should contain:

- nhlTeamId
- nhlTeam
- season
- totalEligibleGames
- homeEligibleGames
- awayEligibleGames
- firstHalfEligibleGames
- secondHalfEligibleGames
- eligibleGameDifferential
- leagueAverageEligibleGames
- scheduleQualityLabel
- source

### Player schedule enrichment

Player-level schedule data includes:

- eligibleGames
- homeEligibleGames
- awayEligibleGames
- firstHalfEligibleGames
- secondHalfEligibleGames
- eligibleGameDifferential
- scheduleOpportunityLabel

### Differential logic

Differential should answer:

- how far above or below the league average this team’s schedule opportunity is

Example conceptual output:

- totalEligibleGames: 68
- leagueAverageEligibleGames: 62.1
- eligibleGameDifferential: +5.9

This metric supports:
- Prospect Explorer sorting
- draft valuation filters
- trade analyzer comparisons
- schedule-risk analysis

### Why it is necessary

The project rules explicitly state that schedule opportunity is a major valuation input and should be considered alongside cost, matching rights, farm eligibility, and position scarcity.

---

## 5. Historical Statistics Structure

Historical statistics should be a separate enrichment layer keyed to each canonical player.

### Supported seasons

This design supports:

- 2024-25
- 2025-26

### Example historical stat structure

- season
- gamesPlayed
- goals
- assists
- points
- plusMinus
- shots
- shootingPct
- hits
- blocks
- toi
- fantasyRelevantMetrics
- source

### Example fields

A historical record may look conceptually like this:

- playerId: "player-123"
- season: "2024-25"
- gamesPlayed: 82
- goals: 22
- assists: 31
- points: 53
- plusMinus: 12
- shots: 192
- toi: 18.4
- source: "NHL API"

### Design goal

Historical statistics answer:
- what has the player done in recent seasons
- how much opportunity and production has the player had
- how should that inform future valuation or trade analysis

---

## 6. Projection Structure

Projection data should be treated as a forward-looking enrichment layer.

### Supported season

This design supports:

- 2026-27 forecast season

### Example projection fields

- playerId
- projectionSeason
- projectedGoals
- projectedAssists
- projectedPoints
- projectedShots
- projectedValue
- valueBand
- projectionConfidence
- projectionSource
- projectionTimestamp

### Additional metadata

- sourceType
  - draft guide | model | Excel export | personal projection
- confidenceScore
- methodologyTag
- assumptions

### Design goal

Projections answer:
- what is the expected future output
- how confident is the forecast
- which source generated the forecast
- how does the projection relate to current cost and opportunity

---

## 7. Valuation Structure

The valuation layer sits on top of the canonical player record after all other intelligence has been attached.

### Core valuation model fields

- playerId
- season
- currentCost
- expectedValue
- costPerEligibleGame
- costPerPoint
- valueScore
- valuationLabel
- undervalued
- fairValue
- overpriced
- source

### Example valuation outputs

- Cost per Eligible Game
- Cost per Point
- Expected Value
- Value Score
- Bargain / Fair / Overpriced

### Example logic model

Valuation should be computed from:

- league cost
- schedule opportunity
- historical production
- projection signal
- farm status
- matching rights
- position scarcity
- player age and pedigree

This means valuation is not a raw source dataset. It is a derived, computed intelligence layer.

---

## 8. Data Source Layers

### Layer 1: League Imports

Primary source dataset(s):

- Prospects.csv
- Veterans.csv
- owner-level import data

This layer is the raw league truth.

### Layer 2: Player Identity Resolution

This layer resolves canonical identity and cross-mapping across imported records and future datasets.

Includes:

- canonical player id generation
- alias tracking
- duplicate-name handling
- owner-to-player identity mapping

### Layer 3: NHL Team Resolution

This layer resolves league owners to NHL franchises.

Includes:

- owner-to-franchise mapping
- NHL team metadata
- team aliases
- mapping confidence

### Layer 4: GamesPlayedBulator

This layer provides schedule opportunity context per NHL team.

Includes:

- total eligible games
- home eligible games
- away eligible games
- first-half / second-half schedule
- differential

### Layer 5: Historical Statistics

This layer adds historical performance context.

Includes:

- recent seasons
- stat line history
- trend and volume metrics

### Layer 6: Projections

This layer adds forward-looking forecasts.

Includes:

- projected output
- expected value proxy
- source and confidence metadata

### Layer 7: League Valuation Engine

This layer produces the player value output used by:

- Draft War Room
- Trade Analyzer
- Prospect Explorer
- Rankings and league reporting

---

## 9. Relationship Summary

### Data relationship chain

- Player source record
  - imported via prospect or veteran CSV
- Player identity resolution
  - resolves aliases, duplicates, and canonical id
- Owner context
  - league owner and cost structure
- NHL team lookup
  - maps owner to NHL franchise
- Schedule intelligence
  - total eligible games and splits
- Historical statistics
  - past output and usage context
- Projections
  - future output expectations
- Valuation
  - expected value and opportunity-adjusted assessment

This creates a single canonical player intelligence model without damaging the core architecture.

---

## 10. Dependencies

### Required for future implementation

- stable import outputs from current parsers
- consistent owner labels across datasets
- stable owner-to-franchise mapping layer
- team schedule dataset keyed by NHL team
- player identity normalization strategy
- projection source metadata and confidence model
- valuation formula framework aligned to league rules

### Constraints

- no parser changes
- no localStorage schema changes
- no app architecture redesign
- all intelligence layers remain additive

---

## 11. Future Implementation Phases

### Phase 1: Canonical player identity and owner mapping

- establish canonical player id strategy
- define name normalization and alias handling
- map league owners to NHL franchise identities

### Phase 2: Schedule enrichment

- attach GamesPlayedBulator team metrics to each player through owner-to-franchise mapping
- add schedule columns to Prospect Explorer

### Phase 3: Historical statistics integration

- add historical stat feeds
- normalize season-based stat records
- align with canonical player ids

### Phase 4: Projection integration

- add projection sources and confidence metadata
- compare projection vs current cost

### Phase 5: Valuation engine

- compute expected value and fairness labels
- produce draft and trade decision support inputs

---

## Final Decision Summary

The canonical player intelligence model should be a layered, derived player view that sits on top of the current imported league data rather than replacing it.

This design keeps the project aligned with its current architecture:

- imported data stays intact
- identity is normalized across sources
- NHL team is derived from owner mapping
- GamesPlayedBulator attaches via franchise context
- historical stats, projections, and valuation are layered on top

This is the correct foundation for:

- GamesPlayedBulator Integration
- Historical Statistics
- NHL API enrichment
- Projection integration
- League Valuation Engine
- Draft War Room
- Trade Analyzer
