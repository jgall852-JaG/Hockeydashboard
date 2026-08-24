# HISTORICAL DATA AUDIT

## Scope

Audit of historical-stat sources currently available in Hockey DB's source folders for V0.7 Historical Performance Intelligence.

## Inventory

| File | Location | Type | Seasons covered | Rows | Columns | Use for V0.7 |
| --- | --- | --- | --- | ---: | ---: | --- |
| [skaters_2008_to_2024.csv](<C:/Users/galla/OneDrive/Desktop/Hockey DB's/Projections/Custom/skaters_2008_to_2024.csv>) | `Projections/Custom/` | CSV | 2008-2024 | 76,655 | 154 | Yes |
| [skaters 2025 to 2026.csv](<C:/Users/galla/OneDrive/Desktop/Hockey DB's/Projections/Custom/skaters 2025 to 2026.csv>) | `Projections/Custom/` | CSV | 2025 | 4,700 | 154 | Yes, but provisional |

## Exclusions

These files are present in Hockey DB's but are not historical performance sources:

- `Documentation/*` files — project guidance only
- `League Data/Games played/*` — schedule intelligence, not player performance history
- Projection files from Dobber/FantasyPros — forward-looking inputs, not historical stat lines

## Field availability

Both skater exports share the same schema family:

- Identity: `playerId`, `season`, `name`, `team`, `position`, `situation`
- Usage: `games_played`, `icetime`, `shifts`, `iceTimeRank`
- Production: `gameScore`, `points`, `goals`, `assists`, shots, rebounds, penalties, hits, takeaways, giveaways, faceoffs, blocked shots
- Possession / expected-goals: `onIce_*`, `offIce_*`, `xGoals*`, `corsi*`, `fenwick*`
- Shot-quality / zone splits: low / medium / high danger fields, rebound fields, after-shift fields
- Special-teams split rows: `all`, `5on5`, `4on5`, `5on4`, and similar contexts

The schema is broad enough for trendlines, role analysis, and season-over-season comparisons.

## Reliability

- `skaters_2008_to_2024.csv`: high reliability for historical skater performance; large multi-season coverage.
- `skaters 2025 to 2026.csv`: high reliability as a current-season stat export, but treat as provisional until the season closes.

Known limitations:

- Skaters only; no goalie performance source was found.
- No dedicated team-level historical summary file was found.
- No separate historical league export bundle was found in the current source tree.

## Recommended loading order

1. `skaters_2008_to_2024.csv`
2. `skaters 2025 to 2026.csv`

This keeps the long-run baseline first, then layers the current season on top.

## Recommended placement in production

Move both files into:

`Data/Historical/`

Recommended names:

- `Data/Historical/skaters_2008_to_2024.csv`
- `Data/Historical/skaters_2025_to_2026.csv`

## Readiness for V0.7

**Partially ready.**

What is ready:

- multi-season skater performance history
- enough fields for historical dashboards, comparisons, and player trend cards

What is still missing:

- goalie history
- team history exports
- clearly separated season snapshots for future snapshot-based trend analysis

## Recommendation

Use the two skater exports as the initial `Data/Historical/` foundation for V0.7, then expand the historical layer only after goalie and team-history sources are identified.
