# V0.8 Deployment Decision

## Decision
**Recommend Option C: Browser → Cached Data Only**

## Why
- Browser direct fetch to NHL API is blocked by CORS in production-like browser use.
- A local Node proxy (Option B) only works when a Node process is already present and available to the user, which is not a safe default for a browser app.
- Cached data preserves the frozen V0.8 architecture and keeps local data authoritative.
- The app already degrades cleanly to cached/offline behavior without changing the identity model.

## Rejected paths
- **Option A**: Rejected because browser CORS blocks direct NHL API access.
- **Option B**: Useful technically, but not a stable production default for a browser-first release.
- **Option D**: Good future direction, but it requires new infrastructure and is outside frozen V0.8.

## Production recommendation
Ship V0.8 with:
- local authoritative data
- cached live enrichment when available
- no dependency on direct browser-to-NHL API calls

## If live refresh is required later
Adopt **Option D** in a later version with a dedicated cloud proxy.

## Summary
V0.8 should be released as a stable cached/offline-first dashboard. Live NHL data remains an enrichment layer, not a runtime dependency.
