# DATA DIRECTORY STANDARD

## Purpose

Define the production folder structure for a local-first dashboard workflow where a league manager only updates spreadsheets, exports CSVs, drops files into folders, and launches the app.

## Current file categorization

### Roster data
- [Data/Rosters/AHL Draft - Prospects.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Rosters/AHL%20Draft%20-%20Prospects.csv)
- [Data/Rosters/AHL Draft - Veterans.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Rosters/AHL%20Draft%20-%20Veterans.csv)
- [Data/Rosters/AHL Draft - Roster.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Rosters/AHL%20Draft%20-%20Roster.csv)
- [Data/Rosters/AHL Draft - Transactions.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Rosters/AHL%20Draft%20-%20Transactions.csv)

### Reference data
- [Data/Reference/AHL Draft - Positions.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Reference/AHL%20Draft%20-%20Positions.csv)
- [Data/Reference/AHL Draft - Utility.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Reference/AHL%20Draft%20-%20Utility.csv)

### Schedule intelligence
- [Data/Scoring/AHL Scores 25-26 - Games played(bulator).csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Scoring/AHL%20Scores%2025-26%20-%20Games%20played(bulator).csv)
- [Data/Scoring/AHL Scores 25-26 - Scorebulator!.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Scoring/AHL%20Scores%2025-26%20-%20Scorebulator!.csv)
- [Data/Scoring/AHL Scores 25-26 - Scores.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Scoring/AHL%20Scores%2025-26%20-%20Scores.csv)

### Draft data
- [Data/Drafts/AHL Draft - Draft 2024.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Drafts/AHL%20Draft%20-%20Draft%202024.csv)
- [Data/Drafts/AHL Draft - Draft 2025.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Drafts/AHL%20Draft%20-%20Draft%202025.csv)
- [Data/Drafts/AHL Draft - Pick Log.csv](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Drafts/AHL%20Draft%20-%20Pick%20Log.csv)

### Backup / non-production
- [Data__reparse_backup/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data__reparse_backup/)

This folder contains duplicate copies of production CSVs and should not be used as a live source.

## Current data source audit

| File | Location | Purpose | Consumer(s) |
| --- | --- | --- | --- |
| AHL Draft - Prospects.csv | [Data/Rosters/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Rosters/) | Prospect import | Owner View, Prospect Explorer, Player Intelligence |
| AHL Draft - Veterans.csv | [Data/Rosters/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Rosters/) | Veteran import | Owner View, veteran analytics, owner aggregates |
| AHL Draft - Roster.csv | [Data/Rosters/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Rosters/) | Roster context | Future roster enrichment |
| AHL Draft - Transactions.csv | [Data/Rosters/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Rosters/) | Transaction history | Future ownership/context analysis |
| AHL Draft - Positions.csv | [Data/Reference/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Reference/) | Player-to-team/position lookup | Prospect Explorer, Player Intelligence |
| AHL Draft - Utility.csv | [Data/Reference/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Reference/) | Player-to-team/position lookup | Prospect Explorer, Player Intelligence |
| AHL Scores 25-26 - Games played(bulator).csv | [Data/Scoring/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Scoring/) | Schedule intelligence | Prospect Explorer, future valuation |
| AHL Scores 25-26 - Scores.csv | [Data/Scoring/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Scoring/) | Scoring reference | Future league intelligence |
| AHL Scores 25-26 - Scorebulator!.csv | [Data/Scoring/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Scoring/) | Scoring reference | Future league intelligence |
| AHL Draft - Draft 2024.csv | [Data/Drafts/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Drafts/) | Draft history | Future draft analytics |
| AHL Draft - Draft 2025.csv | [Data/Drafts/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Drafts/) | Draft history | Future draft analytics |
| AHL Draft - Pick Log.csv | [Data/Drafts/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Drafts/) | Pick history | Future draft analytics |

## Sources still outside the production system

Known source families that may still live outside `Data/` should be copied into the production tree before launch:

- Dobber files -> [Data/Reference/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Reference/) or [Data/Projections/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Projections/) depending on whether they provide identity coverage or forecasts
- Prospect reports -> [Data/Reference/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Reference/) or [Data/Historical/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Historical/)
- Draft guides -> [Data/Drafts/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Drafts/) or [Data/Reference/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Reference/)
- Historical stats exports -> [Data/Historical/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Historical/)
- NHL data exports -> [Data/Historical/](C:/Users/galla/OneDrive/Desktop/Hockeydashboard/Hockeydashboard/Data/Historical/)

## Recommended final folder structure

```text
Data/
  Rosters/
    AHL Draft - Prospects.csv
    AHL Draft - Veterans.csv
    AHL Draft - Roster.csv
    AHL Draft - Transactions.csv
  Reference/
    AHL Draft - Positions.csv
    AHL Draft - Utility.csv
  Scoring/
    AHL Scores 25-26 - Games played(bulator).csv
    AHL Scores 25-26 - Scores.csv
    AHL Scores 25-26 - Scorebulator!.csv
  Drafts/
    AHL Draft - Draft 2024.csv
    AHL Draft - Draft 2025.csv
    AHL Draft - Pick Log.csv
  Historical/
  Projections/
  Overrides/
```

## Folder definitions

### `Data/Rosters/`
Purpose: league-owned roster and ownership exports.

Expected files:
- prospects
- veterans
- roster
- transactions

Required files:
- `AHL Draft - Prospects.csv`
- `AHL Draft - Veterans.csv`

Optional files:
- `AHL Draft - Roster.csv`
- `AHL Draft - Transactions.csv`

### `Data/Reference/`
Purpose: player identity and team lookup inputs.

Expected files:
- position reference
- utility reference

Required files:
- `AHL Draft - Positions.csv`
- `AHL Draft - Utility.csv`

Optional files:
- future alias or coverage supplements

### `Data/Scoring/`
Purpose: schedule intelligence and eligible-game models.

Expected files:
- GamesPlayedBulator
- scoring snapshots

Required files:
- `AHL Scores 25-26 - Games played(bulator).csv`

Optional files:
- `AHL Scores 25-26 - Scores.csv`
- `AHL Scores 25-26 - Scorebulator!.csv`

### `Data/Drafts/`
Purpose: historical draft context and pick tracking.

Expected files:
- draft boards
- pick logs

Required files:
- none for current dashboard boot

Optional files:
- `AHL Draft - Draft 2024.csv`
- `AHL Draft - Draft 2025.csv`
- `AHL Draft - Pick Log.csv`

### `Data/Historical/`
Purpose: archived stat lines, season history, and legacy comparisons.

Required files:
- none yet

Optional files:
- season stat exports
- player history snapshots

### `Data/Projections/`
Purpose: forward-looking player projections and model outputs.

Required files:
- none yet

Optional files:
- projection CSV exports
- valuation model outputs

### `Data/Overrides/`
Purpose: local manual overrides, alias maps, and exception tables.

Required files:
- none yet

Optional files:
- override registry CSV/JSON
- alias expansion tables

## Required CSV formats

### Prospects
- player name
- owner
- cost
- farm
- matching rights
- draft year
- term remaining

### Veterans
- player name
- owner
- cost
- contract / retention fields as exported

### Reference files
- player name
- team code
- position label

### GamesPlayedBulator
- NHL team
- first half eligible games
- second half eligible games
- total eligible games

## Bootstrap priority

1. Load `Data/Rosters/`
2. Load `Data/Reference/`
3. Load `Data/Scoring/`
4. Load `Data/Drafts/`
5. Load `Data/Historical/`
6. Load `Data/Projections/`
7. Load `Data/Overrides/`

## Files currently in the wrong location

- `Data__reparse_backup/` is not a production directory.
- It contains duplicate production files and should stay outside the live bootstrap path.

## Future v0.7 compatibility

This structure supports:
- automatic local bootstrapping
- player intelligence enrichment
- manual override persistence
- schedule intelligence expansion
- draft-history ingestion
- future projection layers

## Recommendation

Keep `Data/` as the only production root for live dashboard inputs.
Use `Data__reparse_backup/` only as archival safety copy, never as a dashboard source.
