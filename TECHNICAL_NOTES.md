# Technical Notes

## Architecture
- Static HTML/CSS/JavaScript app
- Browser-first
- No framework
- No backend
- Local-first workflow

## Source of truth
- The AHL Draft and AHL Scores Google workbooks are the only operational authority. The Draft workbook supplies AHL Position, Utility, roster/ownership, retention, keeper rights, keeper costs, and draft state. The Scores workbook supplies raw score tabs.
- Dobber Excel supplements NHL Position only. Its NHL position must never be used as AHL pool position, eligibility, or availability.
- A prior-year OneDrive roster example and the separate house-budget workbook are not ingested.
- Source availability uses `AHLSheets`, `DobberExcel`, and `DobberPDFs`; mark each true only after its data loads and validates.
- The current Scores workbook tabs contain team schedules/standings, not player-level score inputs. Missing player metrics and Dobber positions remain null; DraftIQ and prices stay UNPRICED until inputs exist.
- Static hosting cannot write back to repository JSON assets. Refreshed JSON views are generated in browser memory and can be exported as a local JSON bundle.

## Persistence
- The app stores working state in browser `localStorage`.
- `localStorage` is browser-specific and not portable by itself.
- The app now supports export/import of saved state to move work between devices.
- A same-origin service worker caches the static app shell and generated JSON; IndexedDB holds the last fully loaded AHL Sheets state and generated outputs. Offline startup labels the snapshot timestamp and never presents the cache as a live refresh.
- Personal Draft List remains local-first in `localStorage`, with explicit JSON import/export for manual device handoff. No backend or cross-device sync is implied.

## Hosting
- The app can be deployed as a static site.
- GitHub Pages is deployed at `https://jgall852-jag.github.io/Hockeydashboard/`; it does not require the local Node.js launcher. The local URL `http://127.0.0.1:3000/index.html` requires `Launch-Hockey-Dashboard.bat` to be running on the same computer. An `ERR_CONNECTION_REFUSED` at `127.0.0.1` means the local server is not reachable, not that Pages failed to deploy.
- Hosted access improves reach from laptop/phone, but does not automatically carry browser state between devices.
- Browser state is origin-specific: export from the local dashboard and import on Pages when transferring working state; Personal Draft List uses separate JSON export/import. Do not clear site data while troubleshooting without backing up local state.
- `manifest.json`, install icons, and `service-worker.js` provide installability and offline shell caching on secure origins. The first successful online visit is required before offline use.
- The service worker is network-first for same-origin GET requests: online reloads always fetch the deployed files (bypassing the HTTP cache) and refresh the `hockeydashboard-<version>` cache; the cache is used only when the network fails, with `./index.html` as the navigation fallback. Non-GET and cross-origin requests (Google Sheets, NHL API) are not intercepted. Bump `CACHE_VERSION` in `service-worker.js` when the asset list changes; activation deletes older `hockeydashboard-*` and legacy `hockey-dashboard-static-*` caches.

## Live data limitation
- Direct browser requests to the NHL API are limited by CORS, so NHL career GP, positions, and roster data are preloaded into a static snapshot (`data/nhl-snapshot.json`, generated offline by `scripts/build-nhl-snapshot.mjs`) and read locally at runtime — there is no live NHL API call from the browser or the local launcher.
- Historical AHL bid costs (`avgCost`/`minCost`/`maxCost`/`yearsDrafted`) are likewise preloaded into `data/ahl-historical-bids.json` (generated offline by `scripts/build-ahl-historical-bids.mjs`, which parses the Draft 2024 and Draft 2025 retained-grid tabs with the existing roster parser and matches players by normalized name or first-initial/last-name alias). `ahlHistoricalBids.js` fetches and caches this bundle once per session; players with no historical match report `NA` for all four fields instead of a blank or zero value.
- The product must remain useful when live enrichment is unavailable.
- Cached live data is a convenience layer, not a runtime dependency.
- Google Sheets and OneDrive sources are network-only. Offline mode serves the last successful IndexedDB snapshot and cannot refresh authoritative league state.
- The supplied Dobber OneDrive shares currently respond HTTP 401/403 from an unauthenticated static fetch. The app surfaces that error and supports local Excel/PDF import; cached successfully parsed Dobber data remains available offline.
- The vendored SheetJS and PDF.js browser builds are cached by the PWA and retain their upstream licenses in `vendor/`.
- Dobber projection text is not treated as a score. The real bundled Dobber Excel's "EVERYTHING (Skaters)" tab has no literal BPS/KVS/PPS/RSS/RRS columns; when they are absent, `normalizeDobberRows` (`dobberIngestion.js`) re-derives all five DraftIQ pricing inputs from Rank, Upside, 3YP, Games, Points, and PP Unit using league-wide percentile scoring, and the player record's `pricingMethod` reports `excel` (literal columns present), `derived` (re-derived), or `unavailable` (neither signal exists). Explicit BPS/KVS/PPS/RSS/RRS columns, when present, always take priority over the derived values.
- Dobber remote responses never establish source availability. HTTP 401/403 leaves `metadata.dobberStatus`, `dobberExcel.status`, and `dobberPdfs.status` as `unavailable`; only successfully parsed local files use `loaded-local`.
- PDF pedigree/confidence/sleeper/bust metadata is explainability-only. It does not modify DraftIQ or tier because no numeric adjustment was defined.
- The `compositeScore` in `forecastedStats.js` is a distinct, separate metric from DraftIQ's `auctionValue`/`classification`. The AHL Scores workbook tabs still contain no player-level FH/SH split inputs, so `buildForecastedStats` falls back to a trend-based `FHPPG`/`SHPPG` estimate derived from the same Rank/Upside/3YP signals used for pricing (see above) whenever actual AHL splits are unavailable but Dobber projections exist. `forecast.splitsMethod` reports `actual` (real AHL FH/SH split), `derived` (trend-estimated), or `unavailable` (no signal at all); `compositeScore` now resolves for any player with a derived or actual split plus complete projected points/games/shots, instead of staying permanently null.

## Draft-day operating model
- GitHub repo = code and doc source of truth
- hosted static app = anywhere access
- local laptop copy = fallback path
- exported state JSON = portable working-state handoff
- Local Working Assignments and Personal Draft List entries are browser-only overlays; completed ownership and draft state remain authoritative in the AHL Sheets.
- Draft-workflow Final Position uses Utility Position when listed, otherwise AHL Position. NHL Position is supplemental scoring metadata only. Players listed only on AHL Utility are still canonical pool members, with positions parsed from Utility (`C/R` → C, RW).
- Unavailable players (drafted in AHL) are always routed to Draft Board. Best Available uses the refreshed `availableKeys` set as its eligibility authority, excludes drafted, removed-local, and non-AHL players, builds rows from canonical pool entries in `availableKeys` (enriched by the matching draft-intelligence player), takes positions only from the pool, sorts ADP ascending or Forecasted Points descending (nulls last), applies the position filter before limiting to the top 25, and displays no stale unavailable records. An active name search spans all available pool players, ignoring the position filter and the top-10 cap.
- Monies (`teamMonies.js`) run inside the unified rebuild pipeline: `rebuildCanonicalAhlPoolState` → `buildAvailableAhlPoolKeys` → `getCanonicalAhlPoolOwnership` → `rebuildTeamBudgets` (stores `datasets.monies` with `teamSpendMap`, `teamRemainingMap`, `teamSlotMap`, `teamPenaltyMap`, `teamAdjustmentMap`, `teamMaxBidMap`) → `rebuildDraftValidationReport`. `renderOwnerView` calls `rebuildDraftState` before rendering, and refresh, import, local edits, and working-assignment changes rebuild before persisting. The Draft 2026 sheet totals are the baseline; only ownership deltas not yet reflected in the grid are applied. Each Team Budgets entry exposes `totalSpent`, `remainingBudget`, `openSlots`, `maxPossibleBid`, `keeperCosts`, `rookieCosts`, `farmCosts`, `draftCosts`, `penalties`, `adjustments`, and `unreconciledSpend`. Cost categories follow `keeperTypeByPlayerKey` from `getCanonicalAhlPoolOwnership` (Veterans sheet = keeper, unreleased Keeper Rights prospect = rookie, otherwise auction) applied to each grid row's effective owner after manual reassign/unassign. The roster parser reports raw sheet `gridCosts` and `farmCosts` only; it no longer labels them as keeper costs.
