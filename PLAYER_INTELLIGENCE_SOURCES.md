# Player Intelligence Sources

## Purpose

This document inventories the current and future data sources needed to power the Player Intelligence Layer. It is a design-only catalog intended to support future implementation without changing the current app architecture, parser layer, or storage schema.

The sources below are grouped into:
- Current sources already in the project flow
- Future sources needed for richer intelligence, schedule modeling, projection, and valuation

---

## Source Inventory Format

Each source is described using the following fields:

- Source
- File Type
- Current Availability
- Refresh Frequency
- Data Owner
- Future Usage
- Player Intelligence fields provided
- Dependent future systems

---

## Current Sources

### 1. Prospects.csv

- Source: Prospects.csv
- File Type: CSV
- Current Availability: Available in the current import workflow
- Refresh Frequency: Manual import as needed
- Data Owner: Local league import / user-driven data entry
- Future Usage: Core prospect source for player identity, owner context, cost, farm status, matching rights, draft year, and term tracking
- Player Intelligence fields provided:
  - playerId
  - name
  - owner
  - cost
  - farm
  - matchingRights
  - draftYear
  - termRemaining
  - position (if present)
  - prospect status
- Dependent future systems:
  - Prospect Explorer
  - Draft War Room
  - Valuation Engine
  - Trade Analyzer

### 2. Veterans.csv

- Source: Veterans.csv
- File Type: CSV
- Current Availability: Available in the current import workflow
- Refresh Frequency: Manual import as needed
- Data Owner: Local league import / user-driven data entry
- Future Usage: Core veteran source for roster valuation, cost tracking, and comparison against prospect value
- Player Intelligence fields provided:
  - playerId
  - name
  - owner
  - currentCost
  - retentionHistory
  - retentionYear
  - veteran status
- Dependent future systems:
  - Valuation Engine
  - Trade Analyzer
  - Draft War Room (for comparing veteran vs prospect value)
  - Prospect Explorer (contextual owner-level comparison)

### 3. Roster.csv

- Source: Roster.csv
- File Type: CSV
- Current Availability: Planned / future dataset in current model shape
- Refresh Frequency: Manual import as needed
- Data Owner: Local league import / user-driven data entry
- Future Usage: Supporting roster context, ownership detail, and owner-level roster composition analysis
- Player Intelligence fields provided:
  - roster ownership
  - player assignments
  - owner roster composition
  - role context for players
- Dependent future systems:
  - Trade Analyzer
  - Valuation Engine
  - Draft War Room
  - Prospect Explorer (owner and roster fit context)

### 4. Transactions.csv

- Source: Transactions.csv
- File Type: CSV
- Current Availability: Planned / future dataset in current model shape
- Refresh Frequency: Manual import as needed
- Data Owner: Local league import / user-driven data entry
- Future Usage: Future trade, acquisition, and roster movement context
- Player Intelligence fields provided:
  - trade activity
  - acquisition history
  - player movement history
  - owner behavior patterns
- Dependent future systems:
  - Trade Analyzer
  - Valuation Engine
  - Draft War Room
  - Prospect Explorer (historical owner behavior context)

### 5. GamesPlayedBulator

- Source: GamesPlayedBulator
- File Type: Structured schedule intelligence dataset (local data source, project-defined)
- Current Availability: Documented in project memory, not yet integrated into the app
- Refresh Frequency: Seasonal or as needed; league-specific annual refresh
- Data Owner: League intelligence / project-maintained dataset
- Future Usage: Core schedule opportunity layer for valuation and prospect analysis
- Player Intelligence fields provided:
  - teamId
  - teamName
  - totalEligibleGames
  - homeEligibleGames
  - awayEligibleGames
  - firstHalfEligibleGames
  - secondHalfEligibleGames
  - eligibleGameDifferential
  - leagueAverageEligibleGames
- Dependent future systems:
  - Prospect Explorer
  - GamesPlayedBulator Integration
  - Draft War Room
  - Valuation Engine
  - Trade Analyzer

---

## Future Sources

### 6. NHL API

- Source: NHL API
- File Type: API / JSON
- Current Availability: Future source
- Refresh Frequency: Daily or near-real-time depending on data needs
- Data Owner: NHL / public API source
- Future Usage: Player metadata, team metadata, game data, roster or status context, league-relevant hockey statistics
- Player Intelligence fields provided:
  - player metadata
  - team metadata
  - player status
  - NHL team identity
  - historical and current season statistics
  - roster context
- Dependent future systems:
  - GamesPlayedBulator Integration
  - Historical Statistics
  - Valuation Engine
  - Draft War Room
  - Trade Analyzer

### 7. NHL EDGE

- Source: NHL EDGE
- File Type: API / analytics feed
- Current Availability: Future source
- Refresh Frequency: Event-driven or periodic analytic refresh
- Data Owner: NHL / performance analytics source
- Future Usage: Advanced player movement, usage, event, and opportunity data
- Player Intelligence fields provided:
  - skating metrics
  - puck possession indicators
  - usage metrics
  - role context
  - goal/shot quality context
  - advanced player opportunity signals
- Dependent future systems:
  - Valuation Engine
  - Draft War Room
  - Trade Analyzer
  - Historical Statistics

### 8. Historical Statistics

- Source: Historical NHL statistics and league history data
- File Type: CSV / JSON / local intelligence dataset
- Current Availability: Future source
- Refresh Frequency: Seasonal / annual refresh
- Data Owner: Local hockey research / league intelligence repository
- Future Usage: Multi-season trend analysis for production, role, and opportunity evaluation
- Player Intelligence fields provided:
  - season
  - gamesPlayed
  - goals
  - assists
  - points
  - plusMinus
  - shots
  - shootingPct
  - TOI
  - fantasy-relevant metrics
  - trendlines
- Dependent future systems:
  - Historical Statistics layer
  - Valuation Engine
  - Draft War Room
  - Trade Analyzer

### 9. Projections

- Source: Excel projections / custom forecast models / external projection files
- File Type: CSV / XLSX / JSON / custom model output
- Current Availability: Future source
- Refresh Frequency: Seasonal / pre-season / weekly depending on source
- Data Owner: Local league model / user-maintained research
- Future Usage: Forecasted production and expected future value signals
- Player Intelligence fields provided:
  - projectionSeason
  - projectedGoals
  - projectedAssists
  - projectedPoints
  - projectedShots
  - forecasted value
  - projectionConfidence
  - projectionSource
- Dependent future systems:
  - Draft War Room
  - Valuation Engine
  - Prospect Explorer
  - Trade Analyzer

### 10. Draft Guides

- Source: Draft guides / scouting publications
- File Type: PDF / CSV / spreadsheet / text export
- Current Availability: Future source
- Refresh Frequency: Seasonal or event-driven
- Data Owner: External draft guides / league research pool
- Future Usage: Draft pedigree, player profile, risk classification, role and talent indicators
- Player Intelligence fields provided:
  - draft pedigree
  - player ranking
  - scouting grade
  - role signal
  - ceiling / floor labels
- Dependent future systems:
  - Prospect Explorer
  - Draft War Room
  - Valuation Engine

### 11. Prospect Rankings

- Source: Prospect ranking outputs / scouting rank data
- File Type: CSV / spreadsheet / JSON
- Current Availability: Future source
- Refresh Frequency: Periodic / season-based
- Data Owner: League research / external prospect ranking sources
- Future Usage: Prospect value context beyond current cost; ranking signal by position or threshold
- Player Intelligence fields provided:
  - rankings
  - position rank
  - prospect tier
  - projected ceiling / risk band
- Dependent future systems:
  - Prospect Explorer
  - Draft War Room
  - Valuation Engine

### 12. Scouting Reports

- Source: Scouting reports / analyst writeups / notes
- File Type: PDF / document / text / markdown
- Current Availability: Future source
- Refresh Frequency: Periodic / event-driven
- Data Owner: League research / external scout analysis
- Future Usage: Qualitative signal enrichment for player role, usage, and development trajectory
- Player Intelligence fields provided:
  - role evaluation
  - development notes
  - player strengths / weaknesses
  - opportunity risk factors
- Dependent future systems:
  - Draft War Room
  - Valuation Engine
  - Prospect Explorer

### 13. Auction Histories

- Source: Historical auction results / previous league pricing / owner behavior records
- File Type: CSV / spreadsheet / local research data
- Current Availability: Future source
- Refresh Frequency: Season-based / on-demand
- Data Owner: League records / local historical exports
- Future Usage: Historical value context, bid behavior, owner tendencies, overpay/underpay patterns
- Player Intelligence fields provided:
  - prior auction prices
  - owner behavior patterns
  - historical valuation context
  - fair-value signal for draft/auction decisions
- Dependent future systems:
  - Draft War Room
  - Valuation Engine
  - Trade Analyzer

---

## Cross-Source Mapping to Future Systems

### Prospect Explorer

Depends on:
- Prospects.csv
- GamesPlayedBulator
- Draft Guides
- Prospect Rankings
- NHL API (optional for roster / team context)
- Scouting Reports (optional qualitative enrichment)

Provides:
- owner filter
- farm filter
- matching-rights filter
- draft-year filter
- cost filter
- player search
- schedule-aware prospect analysis

### GamesPlayedBulator Integration

Depends on:
- GamesPlayedBulator
- NHL API
- NHL Team mapping metadata
- owner-to-franchise mapping

Provides:
- eligible games
- home/away splits
- schedule differential
- opportunity-weighted player context

### Draft War Room

Depends on:
- Prospects.csv
- GamesPlayedBulator
- Projections
- Draft Guides
- Auction Histories
- NHL API / historical statistics

Provides:
- target value calculation
- current bid tracking
- bargain / fair / overpay assessment
- draft watchlist

### Valuation Engine

Depends on:
- Prospects.csv
- Veterans.csv
- Roster.csv
- Transactions.csv
- GamesPlayedBulator
- Historical Statistics
- Projections
- Auction Histories
- Draft Guides
- Position scarcity rules
- Matching right and farm logic

Provides:
- expected value
- current cost
- cost per eligible game
- cost per point
- value score
- undervalued / fair / overpriced labels

### Trade Analyzer

Depends on:
- Prospects.csv
- Veterans.csv
- Roster.csv
- Transactions.csv
- GamesPlayedBulator
- Historical Statistics
- Auction Histories
- Valuation Engine outputs

Provides:
- asset comparison
- team-value impact
- roster trade evaluation
- schedule gain/loss analysis

---

## Source Priority

### Tier 1: Source of truth for current app
- Prospects.csv
- Veterans.csv
- Roster.csv
- Transactions.csv
- GamesPlayedBulator

### Tier 2: Enrichment sources for player intelligence
- NHL API
- NHL EDGE
- Historical Statistics
- Projections

### Tier 3: Advanced valuation and draft intelligence
- Draft Guides
- Prospect Rankings
- Scouting Reports
- Auction Histories

---

## Design Conclusions

1. The current app is already built around a strong core data layer: imported league records and owner-centric state.
2. Future intelligence requires layered enrichment rather than schema changes.
3. GamesPlayedBulator is the first major schedule intelligence source and should sit between owner mapping and player valuation.
4. Historical statistics, projections, and valuation logic should all be modeled as derived intelligence layers rather than core imported data.
5. The long-term player intelligence layer will be a composite of raw league data, team context, statistical signal, and projection/valuation overlays.

This catalog defines the source foundation required for the Player Intelligence Layer without changing any current parser or storage behavior.
