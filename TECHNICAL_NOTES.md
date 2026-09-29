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
- Source availability is limited to `AHLSheets` and `DobberExcel`; mark each true only after its data loads and validates.
- The current Scores workbook tabs contain team schedules/standings, not player-level score inputs. Missing player metrics and Dobber positions remain null; DraftIQ and prices stay UNPRICED until inputs exist.
- Static hosting cannot write back to repository JSON assets. Refreshed JSON views are generated in browser memory and can be exported as a local JSON bundle.

## Persistence
- The app stores working state in browser `localStorage`.
- `localStorage` is browser-specific and not portable by itself.
- The app now supports export/import of saved state to move work between devices.

## Hosting
- The app can be deployed as a static site.
- GitHub Pages is the preferred low-friction hosted option in this repo.
- Hosted access improves reach from laptop/phone, but does not automatically carry browser state between devices.

## Live data limitation
- Direct browser requests to the NHL API are limited by CORS.
- The product must remain useful when live enrichment is unavailable.
- Cached live data is a convenience layer, not a runtime dependency.

## Draft-day operating model
- GitHub repo = code and doc source of truth
- hosted static app = anywhere access
- local laptop copy = fallback path
- exported state JSON = portable working-state handoff
- Local Working Assignments and Personal Draft List entries are browser-only overlays; completed ownership and draft state remain authoritative in the AHL Sheets.
