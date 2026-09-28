# V0.8 Live Fetch Report

## Root cause
Browser-side requests to `https://api-web.nhle.com/...` fail because the NHL API does not allow direct cross-origin browser access here. The browser reports:
- `player landing lookup failed: Failed to fetch`
- `team context lookup failed: Failed to fetch`

This is a browser CORS failure, not a local data-model problem.

## Browser behavior
Validated from the app page:
- Direct `fetch()` to NHL API fails in the browser with a CORS error.
- The request is blocked before the app can read the response.
- Local authoritative data still renders.
- If cached live data exists, the app can render live-enriched fields without making a new network request.

## Node behavior
Validated with Node fetch:
- Direct Node `fetch()` to `https://api-web.nhle.com/v1/player/8478402/landing` succeeds with HTTP 200.
- A tiny local proxy server that fetches the NHL API server-side also succeeds with HTTP 200.

## Cached response behavior
Validated with cache short-circuiting:
- When `hockey-dashboard-live-cache` contains a successful profile, `resolveLivePlayerProfile()` returns the cached response.
- In that path, no live fetch is attempted.
- Cached mode preserves local identity, pool position, historical stats, and schedule data.

## Answers
1. **Is this a browser CORS issue?**  
   Yes.

2. **Is NHL API rejecting direct browser requests?**  
   The browser request is blocked by CORS. Server-side requests succeed.

3. **Is a proxy layer required?**  
   Yes, if live NHL enrichment must work reliably from production browser sessions.

4. **Is cached mode becoming the expected production behavior?**  
   Cached mode should be the fallback behavior, not the sole source of truth. Local data remains authoritative.

## Recommended production solution
- Keep local CSV data authoritative.
- Keep cached live enrichment as the first fallback.
- Add a minimal server-side proxy for NHL API requests if true live refresh is required in production.
- Do not move NHL API data into the authoritative identity model.

## Validation summary
- Browser fetch: failed with CORS
- Local server fetch: succeeded via server-side proxy
- Node fetch: succeeded directly
- Cached response behavior: succeeded without live fetch
