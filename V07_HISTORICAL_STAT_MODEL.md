# V0.7 HISTORICAL STAT MODEL

## Purpose

Define the canonical historical player model for V0.7 without changing app code, parsers, UI, or architecture.

## Historical sources

- [skaters_2008_to_2024.csv](<C:/Users/galla/OneDrive/Desktop/Hockey DB's/Projections/Custom/skaters_2008_to_2024.csv>)
- [skaters 2025 to 2026.csv](<C:/Users/galla/OneDrive/Desktop/Hockey DB's/Projections/Custom/skaters 2025 to 2026.csv>)

Both files share the same 154-column schema.

## Full schema inventory

### Identity and context

- playerId
- season
- name
- team
- position
- situation

### Usage and core volume

- games_played
- icetime
- shifts
- gameScore
- iceTimeRank

### Player event generation

- I_F_xOnGoal
- I_F_xGoals
- I_F_xRebounds
- I_F_xFreeze
- I_F_xPlayStopped
- I_F_xPlayContinuedInZone
- I_F_xPlayContinuedOutsideZone
- I_F_flurryAdjustedxGoals
- I_F_scoreVenueAdjustedxGoals
- I_F_flurryScoreVenueAdjustedxGoals
- I_F_primaryAssists
- I_F_secondaryAssists
- I_F_shotsOnGoal
- I_F_missedShots
- I_F_blockedShotAttempts
- I_F_shotAttempts
- I_F_points
- I_F_goals
- I_F_rebounds
- I_F_reboundGoals
- I_F_freeze
- I_F_playStopped
- I_F_playContinuedInZone
- I_F_playContinuedOutsideZone
- I_F_savedShotsOnGoal
- I_F_savedUnblockedShotAttempts

### Discipline, faceoffs, and physical play

- penalties
- I_F_penalityMinutes
- I_F_faceOffsWon
- I_F_hits
- I_F_takeaways
- I_F_giveaways
- I_F_lowDangerShots
- I_F_mediumDangerShots
- I_F_highDangerShots
- I_F_lowDangerxGoals
- I_F_mediumDangerxGoals
- I_F_highDangerxGoals
- I_F_lowDangerGoals
- I_F_mediumDangerGoals
- I_F_highDangerGoals
- I_F_scoreAdjustedShotsAttempts
- I_F_unblockedShotAttempts
- I_F_scoreAdjustedUnblockedShotAttempts
- I_F_dZoneGiveaways
- I_F_xGoalsFromxReboundsOfShots
- I_F_xGoalsFromActualReboundsOfShots
- I_F_reboundxGoals
- I_F_xGoals_with_earned_rebounds
- I_F_xGoals_with_earned_rebounds_scoreAdjusted
- I_F_xGoals_with_earned_rebounds_scoreFlurryAdjusted
- I_F_shifts
- I_F_oZoneShiftStarts
- I_F_dZoneShiftStarts
- I_F_neutralZoneShiftStarts
- I_F_flyShiftStarts
- I_F_oZoneShiftEnds
- I_F_dZoneShiftEnds
- I_F_neutralZoneShiftEnds
- I_F_flyShiftEnds
- faceoffsWon
- faceoffsLost
- timeOnBench
- penalityMinutes
- penalityMinutesDrawn
- penaltiesDrawn
- shotsBlockedByPlayer

### On-ice for metrics

- OnIce_F_xOnGoal
- OnIce_F_xGoals
- OnIce_F_flurryAdjustedxGoals
- OnIce_F_scoreVenueAdjustedxGoals
- OnIce_F_flurryScoreVenueAdjustedxGoals
- OnIce_F_shotsOnGoal
- OnIce_F_missedShots
- OnIce_F_blockedShotAttempts
- OnIce_F_shotAttempts
- OnIce_F_goals
- OnIce_F_rebounds
- OnIce_F_reboundGoals
- OnIce_F_lowDangerShots
- OnIce_F_mediumDangerShots
- OnIce_F_highDangerShots
- OnIce_F_lowDangerxGoals
- OnIce_F_mediumDangerxGoals
- OnIce_F_highDangerxGoals
- OnIce_F_lowDangerGoals
- OnIce_F_mediumDangerGoals
- OnIce_F_highDangerGoals
- OnIce_F_scoreAdjustedShotsAttempts
- OnIce_F_unblockedShotAttempts
- OnIce_F_scoreAdjustedUnblockedShotAttempts
- OnIce_F_xGoalsFromxReboundsOfShots
- OnIce_F_xGoalsFromActualReboundsOfShots
- OnIce_F_reboundxGoals
- OnIce_F_xGoals_with_earned_rebounds
- OnIce_F_xGoals_with_earned_rebounds_scoreAdjusted
- OnIce_F_xGoals_with_earned_rebounds_scoreFlurryAdjusted

### On-ice against metrics

- OnIce_A_xOnGoal
- OnIce_A_xGoals
- OnIce_A_flurryAdjustedxGoals
- OnIce_A_scoreVenueAdjustedxGoals
- OnIce_A_flurryScoreVenueAdjustedxGoals
- OnIce_A_shotsOnGoal
- OnIce_A_missedShots
- OnIce_A_blockedShotAttempts
- OnIce_A_shotAttempts
- OnIce_A_goals
- OnIce_A_rebounds
- OnIce_A_reboundGoals
- OnIce_A_lowDangerShots
- OnIce_A_mediumDangerShots
- OnIce_A_highDangerShots
- OnIce_A_lowDangerxGoals
- OnIce_A_mediumDangerxGoals
- OnIce_A_highDangerxGoals
- OnIce_A_lowDangerGoals
- OnIce_A_mediumDangerGoals
- OnIce_A_highDangerGoals
- OnIce_A_scoreAdjustedShotsAttempts
- OnIce_A_unblockedShotAttempts
- OnIce_A_scoreAdjustedUnblockedShotAttempts
- OnIce_A_xGoalsFromxReboundsOfShots
- OnIce_A_xGoalsFromActualReboundsOfShots
- OnIce_A_reboundxGoals
- OnIce_A_xGoals_with_earned_rebounds
- OnIce_A_xGoals_with_earned_rebounds_scoreAdjusted
- OnIce_A_xGoals_with_earned_rebounds_scoreFlurryAdjusted

### Off-ice and after-shift metrics

- OffIce_F_xGoals
- OffIce_A_xGoals
- OffIce_F_shotAttempts
- OffIce_A_shotAttempts
- xGoalsForAfterShifts
- xGoalsAgainstAfterShifts
- corsiForAfterShifts
- corsiAgainstAfterShifts
- fenwickForAfterShifts
- fenwickAgainstAfterShifts

## Tier recommendations

### Tier 1 — required

These are the minimum fields needed for a useful V0.7 historical view:

- playerId
- season
- name
- team
- position
- situation
- games_played
- I_F_goals
- I_F_primaryAssists
- I_F_secondaryAssists
- I_F_points
- I_F_shotsOnGoal
- icetime

Recommended derived Tier 1 display fields:

- gamesPlayed
- goals
- assists
- points
- shotsOnGoal
- timeOnIceMinutes
- timeOnIcePerGame

### Tier 2 — useful

These add strong analytical value and should be shown where space allows:

- I_F_shifts
- iceTimeRank
- I_F_shotAttempts
- I_F_unblockedShotAttempts
- I_F_hits
- I_F_takeaways
- I_F_giveaways
- I_F_faceOffsWon
- faceoffsWon
- faceoffsLost
- penalties
- I_F_penalityMinutes
- penalityMinutes
- penalityMinutesDrawn
- penaltiesDrawn
- shotsBlockedByPlayer
- OnIce_F_goals
- OnIce_A_goals
- OnIce_F_xGoals
- OnIce_A_xGoals
- OnIce_F_shotAttempts
- OnIce_A_shotAttempts
- OnIce_F_unblockedShotAttempts
- OnIce_A_unblockedShotAttempts

### Tier 3 — future

These are best reserved for later valuation and comparison work:

- all low/medium/high danger splits
- all rebound splits
- all xG and flurry-adjusted variants
- all off-ice metrics
- all after-shift metrics
- all zone-start / zone-finish metrics
- all derived rates and share metrics

## Canonical V0.7 stat model

### 1. Historical player season summary

One canonical row per:

- playerId
- season
- situation = `all`

This is the primary record for dashboard display.

Recommended summary fields:

- playerId
- season
- name
- team
- position
- gamesPlayed
- timeOnIceSeconds
- timeOnIceMinutes
- shifts
- goals
- assists
- points
- shotsOnGoal
- shotAttempts
- hits
- takeaways
- giveaways
- faceoffsWon
- faceoffsLost
- penalties
- penaltyMinutes
- shotsBlockedByPlayer
- gameScore

### 2. Historical player situation splits

Keep the per-situation rows as a second layer:

- `all`
- `5on5`
- `5on4`
- `4on5`
- any other source-provided strength state

These rows power:

- special-teams analysis
- power-play production
- even-strength comparisons
- matchup / usage context

### 3. Derived metrics

Recommended derived fields:

- pointsPerGame
- goalsPerGame
- assistsPerGame
- shotsPerGame
- timeOnIcePerGame
- pointsPer60
- goalsPer60
- assistsPer60
- shotsPer60
- powerPlayPoints
- evenStrengthPoints
- powerPlayShotShare
- xGoalsFor
- xGoalsAgainst
- xGoalsDifferential
- corsiFor
- corsiAgainst
- corsiDifferential
- fenwickFor
- fenwickAgainst
- fenwickDifferential

### 4. Important source rules

- Use `situation = all` for season totals.
- Use split rows only for context-specific stat lines.
- Do not average across all situation rows to recreate totals.
- Treat `icetime` as raw source time-on-ice; normalize it for display.
- Treat `team` as historical context, not identity.

## Join strategy

### Preferred join order

Player Name
→ canonical player identity
→ historical stats
→ existing player intelligence layer

### Recommended matching logic

1. Normalize player name in both datasets.
2. Use `playerId` when it exists on both sides.
3. Fall back to normalized name + season.
4. If needed, add team and position as tie-breakers.
5. Keep manual override support for edge cases.

### Why this order matters

- The historical files are player-centric.
- The player intelligence layer is league/player-context centric.
- Owner and franchise context should not be used as the primary historical join key.

### Canonical identity rule

The best long-term bridge is:

- canonicalPlayerId
- normalizedName
- source aliases
- externalIds when present

## Validation examples

The following players resolve in the historical dataset:

- Macklin Celebrini
  - found in both historical files
  - `playerId`: 8484801
  - example 2025 row: 82 GP, 45 G, 46 A, 115 PTS, SJS, C
- Lane Hutson
  - found in both historical files
  - `playerId`: 8483457
  - example 2025 row: 82 GP, 12 G, 31 A, 78 PTS, MTL, D
- Dylan Guenther
  - found in both historical files
  - `playerId`: 8482699
  - example 2025 row: 79 GP, 40 G, 23 A, 73 PTS, UTA, R
- Michael Misa
  - found in the 2025 file
  - `playerId`: 8485402
  - example 2025 row: 45 GP, 9 G, 3 A, 21 PTS, SJS, C

## Implementation risks

- `icetime` appears to be stored as raw seconds, so display logic must convert it.
- `situation` introduces multiple rows per player-season, so the canonical model must select the `all` row first.
- Power-play points are not a dedicated source column; they must be derived from split rows.
- Historical player identity may not always align with league import naming, so alias resolution remains necessary.
- The 2025 file should be treated as provisional until the season is final.
- No goalie file was found, so historical coverage is skater-only for now.

## Recommendation

Use a two-layer historical model:

1. season summary from `situation = all`
2. situation splits for special-teams and usage context

That gives V0.7 the highest-value historical view while staying compatible with the current player intelligence layer.
