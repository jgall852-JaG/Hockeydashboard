# Live Data Delivery Strategy

## Summary
The project already has the right principle: local CSV data remains authoritative, and NHL data is optional enrichment. The live delivery question is therefore not whether to make NHL data central to the app; it is how to deliver that enrichment in a way that remains reliable, portable, and safe for a browser-first dashboard.

The main constraint is clear: browser-originated fetches to the NHL API are blocked by CORS. The app can still work with cached live data, but it cannot depend on direct browser-to-NHL calls in the default path.

## Findings

### 1. Direct browser requests are blocked
Verified behavior in the project documentation:
- Browser → NHL API: fails due to CORS
- Node → NHL API: works
- Proxy → NHL API: works
- Cache → UI: works

This means the system cannot depend on direct browser fetches as the default production connection.

### 2. Cached data is already the stability layer
The app can render with cached live values and still preserve the identity and local data model. This is a strong compatibility feature and a good operational safety net.

### 3. Live data is best treated as enrichment, not truth
The repo’s design is correct here. Local data stays authoritative, while live data adds context such as current team, position, roster status, and schedule.

## Option review

### Option A: Cached Data Only
This is the simplest and most reliable production strategy for V0.75.

Pros:
- no new architecture
- no backend dependency
- no browser CORS problem
- aligns with local-first product goals
- low operational risk

Cons:
- no real-time freshness
- stale live context is possible if the cache is old
- not ideal for a true live dashboard

Verdict:
- best fit for the current product maturity and for the no-architecture-change requirement

### Option B: Local Proxy
This means a small local server-side fetch layer that calls the NHL API and returns the data to the browser.

Pros:
- improves live freshness
- works around browser CORS
- compatible with the existing product model

Cons:
- requires a Node or server process to be running
- adds operational complexity for the end user
- not robust enough for a laptop-first, travel-first user workflow unless properly packaged

Verdict:
- useful but not the best default production strategy

### Option C: Cloud Proxy
This means an external hosted service proxies NHL requests.

Pros:
- strong live freshness potential
- centralizes logic and avoids CORS issues
- easier to support for many users

Cons:
- dependent on internet and service availability
- requires infrastructure and operations
- not aligned with the product’s local-first, low-ceremony objective

Verdict:
- viable as an eventual enhancement, not as the default low-risk strategy

### Option D: Server-side Cache Generation
This means a backend process generates and maintains cached NHL data before the browser reads it.

Pros:
- predictable cache freshness
- centralized data generation
- can reduce browser complexity

Cons:
- requires new infrastructure and operational ownership
- exceeds the current V0.75 constraint of no architecture changes
- more than the project needs today

Verdict:
- good future direction, not a current production recommendation

## Recommendation
Recommend Option A: Cached Data Only as the production strategy for V0.75. [Critical]

This is the best fit for:
- the existing architecture
- the no-backend constraint
- the no-coding requirement for this enhancement
- the need for a reliable dashboard on draft day and on a laptop
- the project’s source-of-truth model

The system should keep:
- local CSV data as authoritative
- cached NHL enrichment as the first fallback
- no browser dependency on direct NHL API calls

### Why this is the right final strategy [Critical]
- it works with the current browser-first app
- it avoids CORS failure without adding infrastructure
- it preserves the identity and local data model
- it degrades gracefully when live data is unavailable
- it is the safest operational choice for draft-day reliability

## Risks

- stale live metadata if cache is not refreshed
- user confusion when cached values differ from current NHL state
- false assumptions that cached data is fully live
- local data still needs to be trusted even when the live layer is stale

## Recommendations

### 1. Treat cached live data as a safe enrichment layer
Never allow it to replace local identity or league data.

### 2. Keep the browser path simple
The browser should not be responsible for live NHL fetching in the default production path.

### 3. Preserve graceful degradation
If the cache is empty or stale, the dashboard should still render and work from local data.

### 4. Use proxy or server-side strategies only as future enhancements
If live freshness becomes a hard requirement, evaluate a proxy-based path later rather than adding it now.

## Quick Wins

- Document that local data wins over live data.
- Make cached-data behavior a known and intentional default.
- Keep the UI explicit when live data is stale or unavailable.
- Use live API data only as context, not as a source-of-truth upgrade.

## Future Work

- Add a documented refresh policy for cached live enrichment.
- Evaluate a lightweight server-side proxy only if real-time requirements become non-negotiable.
- Keep the current architecture stable while improving the clarity of caching status in the UI.

## Final recommendation
For the current V0.75 scope, Option A is the correct production strategy: cached data only. It is the safest, simplest, and most reliable path for a local-first dashboard that must survive draft day, fallback behavior, and laptop-only access.
