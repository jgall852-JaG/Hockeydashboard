# NHL API Integration Plan

## Goal
Add optional live NHL enrichment without replacing local CSV data.

## Authoritative data order
1. Local CSV imports
2. Local roster reference rows
3. NHL API enrichment

## Endpoints used

### Player landing
- `GET https://api-web.nhle.com/v1/player/{playerId}/landing`
- Used for:
  - current team
  - current position
  - roster status
  - sweater number
  - shoot/catch hand
  - current season stats
  - career totals

### Team roster
- `GET https://api-web.nhle.com/v1/roster/{teamAbbrev}/current`
- Used for:
  - active roster lookup
  - matching a local player name to an NHL player id
  - roster counts by position

### Standings
- `GET https://api-web.nhle.com/v1/standings/now`
- Used for:
  - division
  - conference
  - points, wins, losses, overtime losses
  - current team context

### Schedule
- `GET https://api-web.nhle.com/v1/club-schedule-season/{teamAbbrev}/current`
- Used for:
  - upcoming games
  - games remaining
  - short-term schedule opportunity

## Fields surfaced in V0.8

### Identity
- Player name
- NHL player id
- current team
- current position
- roster status
- sweater number
- shoots/catches

### Historical
- career GP
- career G
- career A
- career PTS
- career shots
- career average TOI

### Current season
- current GP
- current G
- current A
- current PTS
- current shots
- season id

### Team intelligence
- team name
- conference
- division
- points / wins / losses
- active roster counts
- next game
- games remaining

## Reliability
- Public, unauthenticated endpoints.
- No formal SLA.
- Schema can change without notice.
- Team roster and landing data are usually stable enough for enrichment, but the app must tolerate missing or partial fields.

## Rate limits
- No published limit.
- Use conservative client-side caching.
- Avoid refetching on every render.
- Keep enrichment best-effort only.

## Failure modes
- Network unavailable
- 404 for unknown player/team ids
- Roster name mismatch
- Schema drift in landing or standings payloads
- Partial API response missing a field

## Fallback behavior
- Local CSV values remain primary.
- Live NHL fields only enrich the profile.
- When live requests fail, the profile still renders and shows the API error inline.

## Validation
- Verified with automated tests for:
  - landing payload summarization
  - player lookup by roster match
  - team roster, standings, and schedule hydration
- Verified local parser tests still pass.
