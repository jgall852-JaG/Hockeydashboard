# Technical Notes

## Architecture
- Static HTML/CSS/JavaScript app
- Browser-first
- No framework
- No backend
- Local-first workflow

## Source of truth
- Imported local CSV data is authoritative.
- NHL API data is optional enrichment only.
- Cached live data must never replace local league data.

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
