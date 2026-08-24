# Master Player Dataset Spec

## Purpose

This document defines the first canonical Player Intelligence dataset for the Hockey Dashboard.

It is intended to be the unified, player-centric dataset that combines:

- the current league import data
- owner and roster context
- NHL team and franchise resolution
- GamesPlayedBulator schedule opportunity
- future NHL performance and projection enrichment
- future valuation outputs

This dataset is a design specification only. It does not change the parser layer, localStorage schema, or app architecture.

---

## 1. Design principles

1. The imported CSV records remain the source of truth for league ownership and cost.
2. Player identity is resolved through a canonical player identity layer.
3. NHL team is a derived field, not a raw CSV field.
4. Schedule intelligence is attached via owner -> franchise -> GamesPlayedBulator mapping.
5. Projection and valuation data are layered on top of the player identity, not embedded in the imported source.
6. The dataset is designed to support Prospect Explorer, Draft War Room, valuation, and trade analysis without changing the current app contract.

---

## 2. Dataset name

`master_player_dataset_v1`

This is the first real player intelligence table for the project.

---

## 3. Column specification

Each column below includes:

- column name
- data type
- description
- source
- availability status
- update frequency

Availability status labels are:

- Available Now
- Available From NHL API
- Available From GamesPlayedBulator
- Requires Future Projection Data

Note: some columns are currently derived in the design model but not yet populated in the app. The status reflects the expected primary source of truth for that field.

| Column | Type | Description | Source | Availability | Update Frequency |
| --- | --- | --- | --- | --- | --- |
| canonicalPlayerId | string | Stable internal player identity across league data and future enrichment | local canonical identity registry | Available Now | On ingest / as needed |
| normalizedName | string | Lowercase, punctuation-normalized version of the player name for matching | local normalization rules | Available Now | On ingest |
| displayName | string | Preferred display name shown in the dashboard | Prospects.csv / Veterans.csv | Available Now | Manual import |
| sourceAliases | array<string> | All known aliases, variations, nicknames, and source spellings | imported CSVs + alias map | Available Now | On ingest / periodic |
| externalIdNhl | string | NHL API player ID, if known | NHL API | Available From NHL API | Seasonal / periodic |
| externalIdDraft | string | Optional draft or ranking identifier | draft guides / rankings | Requires Future Projection Data | Seasonal |
| firstName | string | Normalized first name | imported name or NHL metadata | Available From NHL API | Seasonal |
| lastName | string | Normalized last name | imported name or NHL metadata | Available From NHL API | Seasonal |
| playerType | enum | prospect / veteran / unknown | imported dataset type | Available Now | On import |
| currentLeagueState | enum | current status in league data | imported records + roster context | Available Now | Seasonal |
| owner | string | Current league owner / fantasy team | Prospects.csv / Veterans.csv / Roster.csv | Available Now | Manual import / seasonal |
| ownerId | string | Local owner identifier | local app owner registry | Available Now | On import |
| ownerNameNormalized | string | Normalized owner name used for franchise mapping | local owner registry | Available Now | On import |
| sourceDataset | string | Which imported dataset supplied the base record | Prospects.csv / Veterans.csv / roster records | Available Now | On import |
| sourceRecordId | string | Original record identifier or import row key | parser output | Available Now | On import |
| cost | number | Current league cost / spend | Prospects.csv / Veterans.csv | Available Now | Seasonal |
| farm | boolean | Whether the player is marked as farm eligible | Prospects.csv | Available Now | Seasonal |
| matchingRights | boolean | Whether matching rights are active | Prospects.csv | Available Now | Seasonal |
| termRemaining | integer | Remaining term in league terms | Prospects.csv | Available Now | Seasonal |
| draftYear | integer | Draft year associated with the prospect | Prospects.csv | Available Now | Seasonal |
| prospectStatus | string | Prospect status or value class | imported prospect file / rankings | Available Now | Seasonal |
| position | string | League-defined position label | import if present, NHL metadata if available | Available From NHL API | Seasonal |
| age | integer | Current age or season age | NHL API / player metadata | Available From NHL API | Annual |
| ageAsOfSeason | integer | Age at the relevant season start | NHL API / historic metadata | Available From NHL API | Annual |
| nhlTeam | string | NHL franchise name resolved from owner mapping | owner-to-franchise mapping + NHL API | Available From NHL API | Seasonal |
| nhlTeamId | string | NHL franchise ID | NHL API | Available From NHL API | Seasonal |
| franchiseAliasList | array<string> | Alternate franchise names used in mapping | NHL API + local mapping file | Available From NHL API | Seasonal |
| ownerToFranchiseConfidence | string | Confidence rating for owner-to-franchise mapping | local mapping layer | Available Now | On mapping |
| eligibleGames | integer | Total league-eligible fantasy games for the team | GamesPlayedBulator | Available From GamesPlayedBulator | Seasonal |
| homeEligibleGames | integer | Home-eligible fantasy games for the team | GamesPlayedBulator | Available From GamesPlayedBulator | Seasonal |
| awayEligibleGames | integer | Away-eligible fantasy games for the team | GamesPlayedBulator | Available From GamesPlayedBulator | Seasonal |
| firstHalfEligibleGames | integer | First-half eligible games according to league rules | GamesPlayedBulator | Available From GamesPlayedBulator | Seasonal |
| secondHalfEligibleGames | integer | Second-half eligible games according to league rules | GamesPlayedBulator | Available From GamesPlayedBulator | Seasonal |
| eligibleGameDifferential | integer | Difference from league average or baseline | GamesPlayedBulator | Available From GamesPlayedBulator | Seasonal |
| scheduleOpportunityLabel | string | e.g. strong / neutral / weak schedule | derived from GamesPlayedBulator + rules | Available From GamesPlayedBulator | Seasonal |
| scheduleSource | string | Source used for schedule intelligence | GamesPlayedBulator / NHL schedule metadata | Available From GamesPlayedBulator | Seasonal |
| season | string | Season label for historical or projection row | historical stats / projections | Available From NHL API | Seasonal |
| gamesPlayed | integer | NHL games played in a season | NHL API / historical stats | Available From NHL API | Daily to seasonal |
| goals | integer | NHL goals scored | NHL API / historical stats | Available From NHL API | Daily to seasonal |
| assists | integer | NHL assists earned | NHL API / historical stats | Available From NHL API | Daily to seasonal |
| points | integer | NHL points total | NHL API / historical stats | Available From NHL API | Daily to seasonal |
| plusMinus | integer | NHL plus/minus value | NHL API / historical stats | Available From NHL API | Daily to seasonal |
| shots | integer | NHL shots on goal | NHL API / historical stats | Available From NHL API | Daily to seasonal |
| shootingPct | decimal | NHL shooting percentage | NHL API / historical stats | Available From NHL API | Seasonal |
| timeOnIcePerGame | decimal | Average TOI per game | NHL API / NHL EDGE | Available From NHL API | Daily to seasonal |
| fantasyRelevantMetrics | json | Additional local fantasy-relevant stats or derived value signals | local intelligence layer | Available Now | Seasonal |
| projectionSeason | string | Projection season label | custom projections spreadsheet | Requires Future Projection Data | Seasonal |
| projectedGoals | decimal | Projected goals for upcoming season | projection spreadsheet / model | Requires Future Projection Data | Seasonal |
| projectedAssists | decimal | Projected assists for upcoming season | projection spreadsheet / model | Requires Future Projection Data | Seasonal |
| projectedPoints | decimal | Projected points for upcoming season | projection spreadsheet / model | Requires Future Projection Data | Seasonal |
| projectedShots | decimal | Projected shots for upcoming season | projection spreadsheet / model | Requires Future Projection Data | Seasonal |
| projectionConfidence | string | Confidence band or model confidence | projection source metadata | Requires Future Projection Data | Seasonal |
| projectionSource | string | Source of the projection data | projection spreadsheet / draft guide / model | Requires Future Projection Data | Seasonal |
| projectionTimestamp | datetime | Last update timestamp for projection record | projection metadata | Requires Future Projection Data | Seasonal |
| valueBand | string | Label such as bargain / fair / premium | custom valuation model | Requires Future Projection Data | Seasonal |
| expectedValue | decimal | Expected league value | valuation model | Requires Future Projection Data | Seasonal |
| currentCost | number | Current league cost used in comparison | imported CSV or valuation layer | Available Now | Seasonal |
| costPerEligibleGame | decimal | Cost divided by schedule opportunity | derived valuation layer | Requires Future Projection Data | Seasonal |
| costPerPoint | decimal | Cost relative to projected or historical points | valuation model | Requires Future Projection Data | Seasonal |
| valueScore | decimal | Composite valuation score | valuation model | Requires Future Projection Data | Seasonal |
| valuationLabel | string | Overvalued / fair / undervalued | valuation model | Requires Future Projection Data | Seasonal |
| valuationSource | string | Source of valuation calculation | local model / spreadsheet | Requires Future Projection Data | Seasonal |
| valuationTimestamp | datetime | Timestamp of latest valuation computation | valuation model | Requires Future Projection Data | Seasonal |
| confidenceFlags | string | Data quality, name resolution, or merge confidence notes | local identity resolution layer | Available Now | On ingestion / review |
| dataCompleteness | string | high / medium / low completeness score | derived from populated fields | Available Now | On update |
| createdAt | datetime | Record creation time | local dataset creation | Available Now | On ingest |
| updatedAt | datetime | Last update time | local dataset reconciliation | Available Now | On update |

---

## 4. Join keys

The master dataset should be built using a layered join architecture rather than a single raw key.

### 4.1 Primary join keys

#### `canonicalPlayerId`
- Primary key for the master player dataset
- Used across all future enrichment layers
- Stable regardless of imported dataset or source format

#### `sourceRecordId`
- Used to trace the original imported row back to the CSV source
- Required for debugging and data lineage

### 4.2 Secondary join keys

#### `ownerId` -> `owner`
- Links a player to the fantasy owner in the current league data
- Required for owner-level analytics and owner-to-franchise mapping

#### `ownerNameNormalized` -> `nhlTeamId`
- Resolves owner context into NHL franchise context
- Required for GamesPlayedBulator mapping

#### `externalIdNhl`
- Joins to NHL API player metadata and season data
- Required for robust player matching across multiple sources

#### `normalizedName` + `season`
- Useful for historical-stat joins when NHL ID is missing or incomplete
- Must be treated as a secondary fallback, not the primary identity source

### 4.3 Join hierarchy

The recommended join flow is:

1. `Prospects.csv` / `Veterans.csv` -> local player identity -> `canonicalPlayerId`
2. `canonicalPlayerId` -> `ownerId` / `owner`
3. `ownerNameNormalized` -> `franchise mapping` -> `nhlTeamId`
4. `nhlTeamId` -> `GamesPlayedBulator` schedule data
5. `externalIdNhl` -> NHL stats / season data
6. `canonicalPlayerId` -> projection and valuation layers

This preserves the current architecture while enabling future enrichment.

---

## 5. Required source mapping matrix

| Data family | Primary source | Secondary source | Notes |
| --- | --- | --- | --- |
| League identity | Prospects.csv / Veterans.csv / roster records | transactions / local owner registry | Maintains current league context |
| Player identity | canonical identity registry | NHL API | Resolves duplicates and aliases |
| NHL team | owner-to-franchise mapping | NHL API | Needed to bridge owner data to schedule data |
| Schedule opportunity | GamesPlayedBulator | NHL team metadata | Team-scoped and league-specific |
| Current season stat data | NHL API | historical CSV archive | Used for 2025-26 and onward |
| Historical stat data | historical CSVs | NHL API archives | Needed for 2024-25 and earlier |
| Projections | projection spreadsheet / custom model | draft guide / ranking files | Future-only |
| Valuation | custom valuation model | derived cost + schedule + projection model | Future-only |

---

## 6. Availability model

The dataset should explicitly keep the column status for each field so downstream features can tell whether a value is:

- already present in current local data
- available from NHL API
- available from GamesPlayedBulator
- only available when future projection data exists

This is especially important for Prospect Explorer and valuation logic because those features depend on a mixture of current and future-enriched fields.

---

## 7. Refresh schedule

| Category | Refresh Frequency | Notes |
| --- | --- | --- |
| Imported league data | Manual import / seasonal | Source of truth for league ownership and cost |
| Owner mapping and player alias registry | On ingest / as needed | Changes when imports or resolved identities change |
| NHL team mapping | Seasonal / annual review | Happens when franchise mappings are reviewed |
| NHL API stats | Daily to seasonal | Based on production data cadence |
| GamesPlayedBulator | Seasonal | League-specific schedule logic |
| historical stats | Seasonal | Archived after each season |
| projections | Seasonal | Usually refreshed before season begins |
| valuation model | Seasonal / as needed | Computed after schedule and projections are loaded |

---

## 8. Data quality rules

The master dataset should enforce these rules:

1. `canonicalPlayerId` must be populated for every record.
2. `normalizedName` must be populated for matching.
3. `owner` and `ownerId` must be retained even when NHL team metadata is added.
4. `nhlTeam` and `nhlTeamId` must be derived, not imported directly.
5. `eligibleGames` must originate from the franchise-level GamesPlayedBulator table.
6. Projection and valuation columns must remain separate from base imported data.
7. Any ambiguous player identity must be flagged with `confidenceFlags` and not silently merged.

---

## 9. Recommended first implementation scope

The first real Player Intelligence dataset should include the following minimum core fields:

- canonicalPlayerId
- normalizedName
- displayName
- owner
- ownerId
- playerType
- currentLeagueState
- cost
- farm
- matchingRights
- termRemaining
- draftYear
- position
- nhlTeam
- nhlTeamId
- eligibleGames
- homeEligibleGames
- awayEligibleGames
- firstHalfEligibleGames
- secondHalfEligibleGames
- eligibleGameDifferential
- season
- gamesPlayed
- goals
- assists
- points
- shots
- projectionSeason
- projectedPoints
- projectedGoals
- projectedAssists
- expectedValue
- valueScore
- valuationLabel

This gives the project a practical first dataset that is rich enough for Prospect Explorer and future valuation work without forcing a full upstream data warehouse.

---

## 10. Final recommendation

The canonical dataset should be ordered as a player-centric table with strong identity resolution and derived enrichment. The key success factor is not raw column count; it is the correct separation of concerns:

- league records remain the source of truth
- identity and alias resolution are layered on top
- NHL team and schedule data are attached by derived mapping
- projections and valuation are additive future layers

This structure supports the roadmap and preserves the project’s no-parser, no-schema-change constraints while creating the foundation for Prospect Explorer, Draft War Room, and valuation tools.
