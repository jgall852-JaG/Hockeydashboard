# Player Identity Strategy

## Purpose

This document defines the canonical identity strategy for players in the Hockey Dashboard. It is a design-only contract intended to support all current and future intelligence layers without changing the import workflow, parser layer, localStorage schema, or application architecture.

The core principle is simple:

- imported league data remains the source of truth
- player identity is separate from owner identity and franchise identity
- identity is stable across prospects, veterans, league records, NHL metadata, projections, and valuation layers
- the project stays local-first and does not require a server-backed identity registry

---

## 1. Player Identity

### Decision

The recommended strategy is a hybrid identity model.

A player should have:

- a canonical internal player ID
- a normalized canonical name
- one or more source aliases
- optional external IDs when available (especially NHL player ID)

This is the best fit for the project because it balances:

- local-first simplicity
- future enrichment from NHL and other external datasets
- duplicate-name safety
- stable linkage across multiple datasets and future systems

### Why not name only?

Using name only is not sufficient.

Problems:

- duplicate names across different players
- name variations (e.g. `J. Smith` vs `John Smith`)
- nicknames and shortened forms
- data source inconsistency across imports
- same player appearing in different states (prospect, veteran, NHL player)

Name-only identity creates collisions and makes future enrichment unreliable.

### Why not internal player ID only?

An internal player ID is useful, but it is not enough by itself if the project has to connect to external sources.

Problems:

- an internal ID is only meaningful within the current app
- it does not help when matching against NHL data, historical stats, or projections
- it makes cross-source enrichment weak unless a stable alias map is maintained

Internal IDs are still required, but they should not be the only identity dimension.

### Why not NHL API Player ID only?

NHL API IDs are valuable, but they are not available for every player and not always stable across all league contexts.

Problems:

- some prospects may not yet have a current NHL player record
- imported league records may predate or bypass the NHL source
- external identifiers can be absent or incomplete
- a player may exist in multiple local league datasets before a canonical NHL link exists

NHL player ID is a strong external key, but it is not the authoritative local identity.

### Canonical strategy: hybrid

The canonical strategy should therefore be:

- `canonicalPlayerId`: stable local identity used inside the app
- `normalizedName`: stable canonical display key for matching logic
- `sourceAliases`: all known names, variants, and nicknames from imported sources
- `externalIds`: optional NHL player ID and other source-specific IDs
- `confidenceFlags`: whether a player mapping is exact, inferred, or manual

This creates a player identity that works for both local league data and future enrichment without forcing the app to depend on a single external data source.

---

## 2. Canonical Identifier Model

### Recommended fields

A canonical player record should include:

- `canonicalPlayerId`
  - generated stable ID used throughout app logic
- `normalizedName`
  - lowercase, punctuation normalized, diacritics removed
- `displayName`
  - the preferred label shown in the dashboard
- `sourceAliases`
  - array of name variants from each source
- `externalIds`
  - object with optional IDs such as `nhlPlayerId`, `draftId`, legacy IDs, etc.
- `currentLeagueState`
  - prospect, veteran, free agent, active roster, or unknown
- `identityConfidence`
  - exact, inferred, or manual review
- `createdAt`
- `updatedAt`

### Recommended ID generation rules

The local canonical player ID should be deterministic and stable, ideally derived from a normalized identity key when known.

Preferred logic:

1. If NHL player ID is known, use it as the strongest external anchor.
2. Else if a stable local identity exists, use a normalized name + optional birth year / draft metadata combination.
3. Else use a generated local canonical ID and keep all aliases for later resolution.

Important rule:

- The app should never assume that a player’s displayed name alone is uniquely identifying.

### Relationship to imported data

A canonical player may appear across multiple imported source records:

- prospect record
- veteran record
- roster record
- transaction record
- future NHL record

These should all resolve to the same `canonicalPlayerId` when the identity is matched or inferred.

The app should keep the imported CSV records intact and resolve them into a player intelligence layer, rather than altering the parser output.

---

## 3. Duplicate Names and Normalization Rules

### Problem set

Duplicate names are expected because the project spans:

- same player name across different owners or datasets
- same player with naming variants
- nicknames and shortened names
- inconsistent capitalization or punctuation
- spelling inconsistencies from source exports

### Normalization rules

The following normalization should be applied to compare names reliably:

- lowercase all names
- trim spaces
- remove punctuation
- remove diacritics / accent marks
- collapse repeated spaces
- normalize hyphen/apostrophe variants
- compare by first and last name tokens, not just raw display strings

Examples:

- `A. Anderson` -> `a anderson`
- `Anderson, A.` -> `a anderson`
- `A. J. Smith` -> `a j smith`
- `AJ Smith` -> `aj smith`

The system should preserve the original display names for UI use while using normalized values for identity matching.

### Alias handling

Each player should maintain an alias list containing:

- local import names
- nickname variants
- alternate first-name formats
- data-source-specific spellings
- prior team or owner labels when relevant

Examples:

- `John Smith`
- `J. Smith`
- `Smith, John`
- `Johnny Smith`

### Duplicate resolution precedence

The system should resolve duplicates in this order:

1. exact NHL API player ID match
2. exact normalized name + birth year match
3. exact normalized name + source-specific record match
4. same normalized name but manual review flag
5. unresolved identity remains distinct until user or future source confirms merge

### Ambiguity policy

If a name is ambiguous and there is no strong match signal, the system should:

- keep the records distinct
- add a `manualReviewRequired` or `identityConfidence = low` flag
- avoid collapsing records prematurely

This is especially important in prospect pipelines where the same name may appear across different years, teams, or source exports.

---

## 4. League Data Mapping

The current app is built around imported league data, especially:

- `Prospects.csv`
- `Veterans.csv`
- `Roster.csv`
- `Transactions.csv`

These remain the source of truth for ownership, cost, prospect status, and roster context. The identity model must map them into the canonical player system without modifying their data contracts.

### 4.1 Prospects.csv mapping

Prospects are the strongest starting point for player identity because they explicitly carry:

- player ID or import ID
- name
- owner
- cost
- farm status
- matching rights
- draft year
- term remaining
- optional position

The imported prospect record should map as follows:

- `playerId` or imported record key -> `sourceRecordId`
- `name` -> `displayName` + alias list
- `owner` -> `owner` / `ownerId`
- `cost` -> `cost`
- `farm` -> `farm`
- `matchingRights` -> `matchingRights`
- `draftYear` -> `draftYear`
- `termRemaining` -> `termRemaining`

This record provides the local league identity starting point and should be treated as the canonical record for prospect players unless a stronger external match is later available.

### 4.2 Veterans.csv mapping

Veterans map into the same identity layer but may represent a different league state of the same underlying player.

Key fields:

- player name
- owner
- current cost
- veteran status
- retention history
- retention year

Mapping rules:

- veteran records should resolve to the same `canonicalPlayerId` when they match an existing prospect or NHL identity
- if the player is new to the system, create a new canonical identity with veteran scope and alias metadata
- do not rewrite the imported veteran row; attach the canonical identity as enrichment metadata only

### 4.3 Roster.csv mapping

Roster data provides ownership and roster-context certainty.

It should be used to confirm:

- which owner or roster records hold a player
- whether the player is on a current major roster or farm status
- role-level context for future trade and valuation analysis

This dataset should reinforce identity resolution but not replace the imported source records.

### 4.4 Transactions.csv mapping

Transaction history is useful for:

- ownership movement
- trade flow
- roster-composition changes
- owner behavior context

Transactions should not be used as the identity source of truth, but they can help resolve duplicate or historical player records when the same player appears under different names or ownership states.

---

## 5. NHL Team Association

### Core rule

NHL team is not a raw imported field.

It is a derived field that should be attached through the identity and ownership relationship.

Correct relationship:

- player -> owner -> franchise mapping -> NHL team

This is essential because:

- league data is owner-centric
- GamesPlayedBulator is team-centric
- schedule and valuation logic require team context

### Canonical mapping model

A player may inherit NHL team context through the owner mapping layer.

Example:

- `Player X` owned by `Owner A`
- `Owner A` maps to `Boston Bruins`
- `Player X` gets `nhlTeam = Boston Bruins`

This is not the same as a raw imported field; it is derived intelligence.

### Lookup structure

The project should define an NHL team lookup layer containing:

- `ownerName`
- `franchiseName`
- `nhlTeamId`
- `franchiseAliasList`
- `confidenceFlag`
- `sourceMetadata`

The team lookup should be separate from the canonical player identity model so that player records stay portable and future systems can swap in more complete NHL mappings without mutating the imported league records.

---

## 6. Schedule, Statistics, and Valuation Layers

The canonical player identity should support later enrichment layers without forcing a schema rewrite.

### 6.1 Schedule intelligence

Schedule information should not be stored directly in the imported data. Instead, it should be attached to the canonical player as an enrichment layer.

Examples:

- `eligibleGames`
- `homeEligibleGames`
- `awayEligibleGames`
- `firstHalfEligibleGames`
- `secondHalfEligibleGames`
- `scheduleOpportunityLabel`
- `scheduleSource`

This preserves the imported contract while allowing derived analytics and future valuation logic to consume schedule information cleanly.

### 6.2 Historical statistics

Historical stats belong to the player intelligence layer and should be keyed by canonical player ID and time dimension.

Examples:

- season
- gamesPlayed
- goals
- assists
- points
- shots
- plusMinus
- fantasy-relevant metrics
- source

These should not overwrite the core CSV-derived player record; they should enrich it.

### 6.3 Projections

Projection data should be attached with source metadata and confidence values.

Examples:

- projectedPoints
- projectedGoals
- projectedAssists
- forecasted value
- projectionSource
- projectionTimestamp

### 6.4 Valuation engine

Valuation should consume the canonical player record plus enrichment layers:

- cost
- owner and roster context
- farm status
- matching rights
- position scarcity
- schedule opportunity
- projection quality
- external performance signals

The valuation layer should output derived metrics such as:

- expectedValue
- currentCost
- valueScore
- bargain/fair/overpriced label
- valuationSource

---

## 7. Future Systems That Depend on This Identity Layer

The canonical identity structure supports all of the project’s future system goals.

### Prospect Explorer

- requires stable player identity across multiple imported records
- needs owner context, farm flags, matching rights, and draft-year metadata
- benefits from derived NHL team and schedule opportunity fields

### GamesPlayedBulator Integration

- requires a clean linkage from player -> owner -> team schedule
- needs team- and opportunity-based enrichment without mutating league imports

### Draft War Room

- needs consistent player identity across draft year, scouting, rankings, and cost data
- benefits from projection and valuation signals attached to the same canonical player

### Valuation Engine

- depends on player identity being durable across cost, team, stats, and schedule layers
- requires a stable source for comparisons, trends, and trade decisions

### Trade Analyzer

- needs player identity that survives ownership changes, cost comparisons, and historical review
- benefits from comparing the same player under different league states

---

## 8. Identity Resolution Policy

### Recommended operating model

The project should adopt a layered identity policy:

1. Keep imported records unchanged.
2. Create canonical identity records in an intelligence layer.
3. Resolve identities using best available signals.
4. Preserve alias history and confidence metadata.
5. Keep manual review for uncertain matches.
6. Attach external metadata only as enrichment.

### Matching hierarchy

Best-practice matching order:

- exact external ID match
- exact normalized name + birth year or draft metadata
- exact normalized name + strong owner / team context
- fuzzy alias resolution with manual review

### Data quality rules

The system should not silently merge records when confidence is low.

When there is disagreement, prefer:

- separate canonical IDs
- manual review flag
- explicit override metadata

This is safer than forcing incorrect merges in a local-first system.

---

## 9. Recommendation Summary

### Canonical strategy

Use a hybrid identity system:

- canonical local player ID
- normalized name
- alias history
- optional NHL player ID and other external IDs
- confidence metadata

### Recommended implementation principle

Do not treat any single field as the only identity source.

The correct design is a layered identity graph:

- imported league record
- canonical player identity
- external identifier map
- owner and franchise context
- enriched schedule and stat layers
- valuation output layer

### Final decision

The best canonical identifier strategy for this project is:

- `canonicalPlayerId` as the app’s internal identity anchor
- `normalizedName` as the primary matching key
- `sourceAliases` for real-world variability
- `externalIds` including NHL player ID where available
- `confidenceFlags` to preserve uncertainty without hard-coding bad merges

This is the most robust design for the current project constraints and for all future systems identified in the roadmap and data contract documents.

---

## 10. Design Constraints

This strategy satisfies the project constraints:

- no parser changes
- no localStorage schema changes
- no app architecture redesign
- no code generation
- design remains local-first and client-side
- all identity logic is additive and derived

This creates a stable foundation for:

- Prospect Explorer
- GamesPlayedBulator Integration
- Draft War Room
- League Valuation Engine
- Trade Analyzer
