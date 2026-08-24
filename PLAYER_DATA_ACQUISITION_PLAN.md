# Player Data Acquisition Plan

## Purpose

This document defines how the Hockey Dashboard will obtain the data required to populate the Player Intelligence Layer without changing the current parser layer, localStorage schema, or app architecture.

The plan is intentionally designed to preserve the current local-first model:

- imported CSVs remain the source of truth for league ownership and roster context
- future enrichment sources are layered on top of those records
- player identity is resolved through a canonical player model
- NHL team and schedule intelligence are derived via lookup and enrichment layers

---

## 1. Canonical Data Requirement Inventory

The canonical player model requires the following categories of data.

### A. Identity and league metadata

| Field | Current Source | Future Source | Availability | Update Frequency |
| --- | --- | --- | --- | --- |
| canonicalPlayerId | local generated ID from imported records | NHL player ID or merged identity map | Available in design layer only | On ingest / on merge |
| normalizedName | applicant import names | NHL / historical datasets | Available after normalization rules | On ingest / periodic |
| displayName | imported CSV name | preferred external name | Available in imports | As imported |
| sourceAliases | imported CSV names and variations | NHL/API ranking datasets | Partial now | On ingest / periodic |
| externalIds | none currently | NHL API, draft IDs, historical files | Future | Periodic |
| owner | Prospects.csv / Veterans.csv / Roster.csv | Transactions.csv / roster refreshes | Current | Manual or seasonal |
| ownerId | local app state | normalized owner registry | Current in app | On import |
| playerType | imported dataset type | classification rules | Current | On import |
| currentLeagueState | imported dataset status | roster / transaction data | Partial | Seasonal |
| cost | Prospects.csv / Veterans.csv | auction data or historical league exports | Current | Seasonal |
| farm | Prospects.csv | roster / prospect ranking data | Current | Seasonal |
| matchingRights | Prospects.csv | auction or ownership records | Current | Seasonal |
| draftYear | Prospects.csv | draft guide / rankings | Current | Seasonal |
| termRemaining | Prospects.csv | historical league exports | Current | Seasonal |
| position | import if present | NHL API / draft guides / roster feeds | Partial | Seasonal or periodic |
| prospectStatus | imported prospect status | rankings / scouting / roster context | Partial | Seasonal |

### B. NHL team and franchise context

| Field | Current Source | Future Source | Availability | Update Frequency |
| --- | --- | --- | --- | --- |
| nhlTeam | owner-to-franchise lookup | NHL API / team registry | Not yet available | Periodic |
| nhlTeamId | owner-to-franchise lookup | NHL API / team registry | Not yet available | Periodic |
| franchiseAliasList | local team mapping file | NHL metadata / team aliases | Future | Periodic |
| confidenceFlag | internal mapping metadata | source confidence review | Future | On mapping |

### C. Schedule opportunity and GamesPlayedBulator data

| Field | Current Source | Future Source | Availability | Update Frequency |
| --- | --- | --- | --- | --- |
| eligibleGames | not yet integrated | GamesPlayedBulator | Future | Seasonal |
| homeEligibleGames | not yet integrated | GamesPlayedBulator | Future | Seasonal |
| awayEligibleGames | not yet integrated | GamesPlayedBulator | Future | Seasonal |
| firstHalfEligibleGames | not yet integrated | GamesPlayedBulator | Future | Seasonal |
| secondHalfEligibleGames | not yet integrated | GamesPlayedBulator | Future | Seasonal |
| eligibleGameDifferential | not yet integrated | GamesPlayedBulator | Future | Seasonal |
| scheduleOpportunityLabel | derived from schedule metrics | derived analytics | Future | Seasonal |
| scheduleSource | manual dataset | GamesPlayedBulator + NHL | Future | Seasonal |

### D. Historical stats and performance

| Field | Current Source | Future Source | Availability | Update Frequency |
| --- | --- | --- | --- | --- |
| season | historical CSVs / future data import | historical NHL statistics | Future | Seasonal |
| gamesPlayed | none currently | NHL API / historical CSVs | Future | Daily to seasonal |
| goals | none currently | NHL API / historical CSVs | Future | Daily to seasonal |
| assists | none currently | NHL API / historical CSVs | Future | Daily to seasonal |
| points | none currently | NHL API / historical CSVs | Future | Daily to seasonal |
| plusMinus | none currently | NHL API / historical CSVs | Future | Daily to seasonal |
| shots | none currently | NHL API / historical CSVs | Future | Daily to seasonal |
| shootingPct | derived / future | NHL API / historical CSVs | Future | Seasonal |
| toi | none currently | NHL API / NHL EDGE | Future | Daily to seasonal |
| fantasyRelevantMetrics | none currently | historical local model | Future | Seasonal |
| source | source metadata | source metadata | Future | On import |

### E. Projections and valuation

| Field | Current Source | Future Source | Availability | Update Frequency |
| --- | --- | --- | --- | --- |
| projectionSeason | none currently | projection spreadsheet / model output | Future | Seasonal |
| projectedPoints | none currently | projections feed | Future | Seasonal |
| projectedGoals | none currently | projections feed | Future | Seasonal |
| projectedAssists | none currently | projections feed | Future | Seasonal |
| valueBand | none currently | projection model | Future | Seasonal |
| projectionConfidence | none currently | model metadata | Future | Seasonal |
| projectionSource | none currently | spreadsheet / custom model | Future | Seasonal |
| projectionTimestamp | none currently | model output metadata | Future | Seasonal |
| expectedValue | none currently | valuation model | Future | Seasonal / as needed |
| currentCost | imported CSV | local valuation / auction data | Current to future | Seasonal |
| costPerEligibleGame | derived | valuation engine | Future | Seasonal |
| costPerPoint | derived | valuation engine | Future | Seasonal |
| valueScore | none currently | valuation model | Future | Seasonal |
| valuationLabel | none currently | valuation model | Future | Seasonal |
| valuationSource | none currently | valuation logic / spreadsheet | Future | Seasonal |
| valuationTimestamp | none currently | model output metadata | Future | Seasonal |

---

## 2. Required Data Acquisition by Field

### 2.1 NHL Team

#### Recommended source
- NHL API as the canonical source for franchise identity and roster/team metadata
- local owner-to-franchise mapping as the necessary bridge from league owners to NHL teams

#### How to obtain
1. Use the imported owner names as the local league key.
2. Map each owner to a franchise using a maintained owner-to-franchise lookup table.
3. Use NHL API team metadata to confirm franchise names, IDs, and aliases.
4. Store mapping as derived intelligence, not in the parser or localStorage import schema.

#### Availability
- Not currently available in app data
- Requires a new local mapping layer or manual curation file

#### Update frequency
- Seasonal or when franchise identities change
- Should be reviewed when an owner name or franchise identity changes

#### Recommended data contract
- `ownerName`
- `franchiseName`
- `nhlTeamId`
- `franchiseAliasList`
- `confidenceFlag`
- `sourceMetadata`

### 2.2 Position

#### Recommended source
- NHL API for active NHL roster metadata
- draft guides and prospect rankings for draft-eligible players with incomplete NHL metadata
- imported league CSV if the source file already includes position

#### How to obtain
- First preference: use current NHL roster metadata and player profile data.
- Second preference: use imported league position fields if already present.
- Third preference: fill from draft guide or ranking profile metadata where available.

#### Availability
- Partial in current import sources
- Not fully trusted across all players

#### Update frequency
- Seasonally, with updates during roster changes and new prospect tracking

### 2.3 Age

#### Recommended source
- NHL API player profile metadata, if available
- historical team/player records when NHL API lacks the needed date or age field
- draft guide or prospect ranking metadata when the player is not active in the league

#### How to obtain
- Use birth date or age at season start from a reliable external source.
- Store as derived data tied to a season context if age changes over time.

#### Availability
- Not currently imported in the project’s CSV schema
- Future acquisition required

#### Update frequency
- Annual or when player metadata is refreshed

### 2.4 2024-25 Stats

#### Recommended source
- historical NHL statistics CSVs or archival hockey data files
- NHL API historical endpoints if available and quality is acceptable
- local historical league exports when the project already has matching data for players

#### How to obtain
- Resolve player identity to canonical player ID.
- Attach the correct NHL player ID where available.
- Pull the season-specific stats table.
- Normalize metrics to the canonical player schema.

#### Availability
- Not currently available in the local app
- Requires a historical stats layer

#### Update frequency
- Annual refresh or seasonal archive update

### 2.5 2025-26 Stats

#### Recommended source
- NHL API as the primary current-season source
- local historical CSV sets when API access is incomplete
- NHL EDGE for advanced usage metrics where needed

#### How to obtain
- Pull current-season player stats and team context.
- Merge with canonical player identity and owner mapping.
- Keep the season as a time dimension in the model.

#### Availability
- Future source, not currently present in app

#### Update frequency
- Daily or near-real-time for active stats; seasonal when archived

### 2.6 2026-27 Projections

#### Recommended source
- projection spreadsheets
- custom valuation model output
- draft guide or ranking-derived projection files

#### How to obtain
1. Create a normalized projection table keyed by player identity.
2. Include season, projected goals, assists, points, and confidence.
3. Attach projection source and timestamp metadata.
4. Keep as a separate layer from actual historical stats.

#### Availability
- Not currently available in project data

#### Update frequency
- Seasonal, pre-season, and possibly mid-season refreshes

### 2.7 GamesPlayedBulator Metrics

#### Recommended source
- Hockey DB’s GamesPlayedBulator repository or league-maintained schedule dataset
- project-owned local schedule intelligence layer

#### How to obtain
1. Maintain a team-level schedule dataset keyed by NHL franchise.
2. Map owners to franchises.
3. Attach team eligible games to all players connected to that franchise.
4. Use the derived values as schedule opportunity inputs in prospect and valuation analysis.

#### Availability
- Documented in project memory as authoritative but not yet integrated into the app

#### Update frequency
- Seasonal or annually, aligned with league schedule rules

---

## 3. Candidate Sources Evaluation

### 3.1 NHL API

#### Strengths
- Best source for franchise IDs and player metadata
- Good for current roster and team identity
- Useful for current-season player stats
- Strong support for player matching and external key resolution

#### Limitations
- Not a full replacement for league-specific valuation inputs
- May not include all custom league metadata, projections, or draft data
- Requires clean player identity resolution

#### Best use
- determine `nhlTeam`, `nhlTeamId`, current roster, current season stats, and player metadata

### 3.2 nhl-api-py

#### Strengths
- Useful as a local extraction utility for bulk NHL data pulls
- Makes repeated data collection easier than hand-calling APIs
- Can support a local intelligence pipeline without changing app runtime

#### Limitations
- Not the source of truth by itself
- Still depends on identity mapping and normalization
- Requires a disciplined local data ingestion workflow

#### Best use
- local data harvesting, not direct UI logic

### 3.3 NHL EDGE

#### Strengths
- High-value advanced performance and usage dataset
- Strong candidate for future valuation and player opportunity analysis
- Helps explain why two players with similar output may differ in fantasy value

#### Limitations
- More complex and less necessary for initial player data acquisition
- Not required to establish the identity and schedule foundation

#### Best use
- advanced metrics tier after the core player identity and team schedule layers are in place

### 3.4 Projection spreadsheets

#### Strengths
- Most realistic source for 2026-27 production projections in a local-first project
- Easy to maintain manually or through curated seasonal imports
- Works well with existing CSV-first workflow

#### Limitations
- Quality varies widely by source
- Needs normalization and confidence metadata
- Can drift if not versioned or curated

#### Best use
- future forecast layer for draft and valuation models

### 3.5 Historical CSVs

#### Strengths
- Best fit for a local-first, static-data-based workflow
- Easy to normalize into a canonical player table
- Supports 2024-25 and 2025-26 stat history without a backend

#### Limitations
- Requires disciplined data ownership and freshness rules
- Can be incomplete if historical sources are inconsistent

#### Best use
- build the canonical historical stats layer

### 3.6 Draft guides

#### Strengths
- Useful for prospect pedigree, scouting position, and ceiling/floor metadata
- Essential for prospect-specific intelligence

#### Limitations
- Not standardized across sources
- Can contain inconsistent player names and ranking structures
- Requires manual mapping and confidence classification

#### Best use
- enrich prospect scouting profiles and draft valuation inputs

### 3.7 Hockey DB’s repository

#### Strengths
- Likely the best project-local source for league schedule intelligence and team-level data
- Matches the project’s operational context and the GamesPlayedBulator design
- Good place to maintain region-specific and league-specific datasets

#### Limitations
- Must be treated as a curated local data source, not a universal NHL source
- May need crosswalks for franchise mapping and identity matching

#### Best use
- maintain authoritative GamesPlayedBulator / season schedule intelligence and local league supplements

---

## 4. Data Gaps

The project has major gaps before it can fully populate the Player Intelligence Layer.

### Identity gaps
- No canonical player crosswalk across all imported league datasets
- No standard external ID map for players across sources
- No enforced alias registry beyond display names
- No duplicate-player resolution framework in the app

### Team mapping gaps
- No owner-to-franchise mapping layer
- No canonical NHL team registry tied to league owners
- No derived schedule attachment model yet

### Schedule gaps
- GamesPlayedBulator is not yet integrated into the app
- No team-level eligible games dataset mapped to prospects or owners
- No first-half / second-half schedule attachment logic

### Statistics gaps
- No historical performance layer for 2024-25 / 2025-26 stats
- No player-time / season dimension in the model yet
- No normalized fantasy-relevance metrics layer

### Projection gaps
- No projection source integrated into the schema
- No projection confidence or source metadata layer
- No data contract for 2026-27 forecast inputs

### Valuation gaps
- No valuation formula or scoring model defined yet
- No cost-adjusted schedule or scarcity layer
- No derived value score and output labels in the app

---

## 5. Risks

### Data quality risks
- name mismatches between league data and NHL data
- duplicate players with nearly identical names
- stale or partial historical statistics
- incomplete projection coverage for prospects

### Mapping risks
- owner name mismatch versus franchise naming
- franchise alias differences (e.g., old and new city names)
- bad or ambiguous team-to-owner resolution

### Source dependency risks
- reliance on one source without a fallback
- inconsistent season definitions across tools
- manual spreadsheet drift over time
- external sources changing formats or access rules

### Project risk
- the app is local-first and simple by design, so adding a richer intelligence model creates operational complexity
- data ingestion can become fragmented if every future feature uses a slightly different source format
- the project could accidentally mutate the parser or storage contracts if enrichment is not clearly separated

---

## 6. Dependencies

### Required before full acquisition
- stable canonical player identity model
- owner-to-franchise mapping layer
- local data source discipline for all external feeds
- clear source ownership and source metadata
- standard normalization rules for names and aliases
- a consistent season-key model

### External dependencies
- NHL API or equivalent source for franchise and player metadata
- finishable local data repository for GamesPlayedBulator and historical stat archives
- projection spreadsheet or model owner
- agreement on what counts as authoritative schedule data

### Internal dependencies
- imported CSV workflow stays unchanged
- data enrichment remains layered, not embedded in imported records
- future systems consume a canonical player intelligence layer rather than ad hoc source data

---

## 7. Phased Acquisition Plan

### Phase 1 — Foundation and identity

Objectives:
- establish canonical player identity
- resolve owner data and source aliases
- build a local player registry

Acquire:
- imported league records from Prospects.csv, Veterans.csv, and roster data
- source aliases and normalized names
- owner mapping metadata
- internal identity records

Outputs:
- canonical player IDs
- owner-to-player resolution
- unresolved identity queue

### Phase 2 — NHL team and schedule layer

Objectives:
- map owners to franchises
- add NHL team context to players
- import GamesPlayedBulator metrics

Acquire:
- NHL API team metadata
- local team mapping file or crosswalk
- GamesPlayedBulator dataset from project-maintained repository

Outputs:
- `nhlTeam`, `nhlTeamId`
- eligible games
- home/away/first-half/second-half schedule values
- derived schedule-opportunity tags

### Phase 3 — Historical statistics layer

Objectives:
- build player performance history
- support 2024-25 and 2025-26 stats
- create season-level metrics for valuation and comparison

Acquire:
- historical stats CSVs or NHL API season archives
- current-season stats feed
- crosswalk from player identity to NHL IDs

Outputs:
- season-by-season player stat records
- performance trend data
- fantasy-relevant metrics layer

### Phase 4 — Projection layer

Objectives:
- load 2026-27 projections
- normalize projection sources and confidence levels
- prepare a base forecast layer for valuation and draft tools

Acquire:
- projection spreadsheets
- draft guide metadata
- custom model outputs

Outputs:
- projected goals, assists, points
- value band / confidence / source metadata

### Phase 5 — Valuation and draft intelligence

Objectives:
- combine cost, schedule opportunity, projections, and scarcity
- produce a valuation-ready layer

Acquire:
- all prior data layers
- position scarcity inputs
- farm/matching rights metadata
- custom valuation rules

Outputs:
- expected value
- value score
- bargain/fair/overpriced labels
- draft/valuation decision support

---

## 8. Recommended Acquisition Order

The acquisition sequence should be:

1. League records and player identity
2. Owner-to-franchise mapping
3. NHL Team lookup
4. GamesPlayedBulator metrics
5. Historical statistics
6. Projections
7. Valuation model inputs

This order is the safest because it builds the foundation first: without stable identity and team mapping, everything else is noisy and unreliable.

---

## 9. Final Recommendation

The project should not try to acquire every data source at once. It should build a layered acquisition system where:

- imported league data provides the first layer
- NHL API and team mapping provide the franchise layer
- GamesPlayedBulator provides the schedule layer
- historical stats provide the performance layer
- projections and draft guides provide the forecast layer
- valuation logic combines all of the above into a league-specific player intelligence model

This preserves the project’s architecture and keeps the tool local-first while still enabling the future systems identified in the roadmap and data contracts.

The most important first step is not finding the most advanced data source; it is establishing the identity and team mapping foundation. Once player identity and NHL franchise mapping are stable, schedule and valuation data become accurate and actionable.
