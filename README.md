Hockey Dashboard v0.8 — Live Hockey Intelligence

Overview
- This lightweight client is pure HTML/CSS/JavaScript (no frameworks).
- It uses the existing parsers in the repo:
  - prospectParser.js (ESM — imported by app.js)
  - veteranParser.js (ESM — imported by app.js)
  - rosterParser.js (ESM/CommonJS compatible)
- liveNhlApi.js provides optional NHL API enrichment and local caching.
- Pool Position and NHL Position are displayed separately in player intelligence.
- Local NHL Team identity and live current team metadata are displayed separately.
- loadLeagueData.js is a Node utility and is NOT used by the browser UI.

Files added
- index.html        — main UI
- styles.css        — minimal styling
- app.js            — main client logic (type="module")
- liveNhlApi.js     — optional NHL API enrichment helpers
- README.md         — this file

Design notes
- Header-first detection: the app reads the CSV header (first non-empty line) and matches tokens to identify dataset type. No parser trial-and-error is performed.
- Detection rules:
  - Prospects: header contains "TERM REMAINING", "MATCHING RIGHTS", or YR1/YR2/YR3 tokens
  - Veterans: header contains multiple year columns (e.g., 2022, 2023, 2024)
  - Roster: generic player rows parsed by rosterParser.js
- If detection is ambiguous the user is prompted to pick the dataset type.
- Once identified, exactly one parser is invoked:
  - parseProspects(csvText) — for prospects
  - parseVeterans(csvText)  — for veterans
  - parseRoster(csvText) — rosterParser.js is imported as a module
  - transaction logs and live draft boards are maintained in Google Sheets and are not imported into the dashboard

How to run locally (recommended)
1) Place this project in a folder that contains the app/ parser files (already in this repo).
2) Start a static HTTP server from the project root. ESM imports (used by app.js) typically require serving files over HTTP.

Recommended quick options:
- Python 3 (if installed):
  - Open PowerShell or cmd in the project root (the folder containing index.html) and run:
    python -m http.server 8000
  - Then open http://localhost:8000 in your browser.

- Node (http-server) (if you prefer):
  - npm install -g http-server
  - http-server -p 8000
  - Open http://localhost:8000

- VS Code Live Server extension: right-click index.html and "Open with Live Server".

Notes
- rosterParser.js is intentionally loaded as a classic <script> (not module) so it exposes parseRoster on window and requires no changes to the parser source.
- loadLeagueData.js is Node-only and will not work in the browser — do not include it in index.html.
- If you open index.html directly via file:// URLs, module imports (import ... from './app/xxx.js') may fail due to browser restrictions. Use an HTTP server as above.

Usage
- Drag and drop a CSV or click to select.
- App reads the header, identifies type, and calls the proper parser.
- Preview shows dataset type, record count and the first 10 parsed records.
- Click Confirm Import to finalize — the data is persisted locally.
- Click Upload Another to reset.

Troubleshooting
- If live NHL data fails, the dashboard falls back to local CSV data and shows the API error inline.
- If you see parser errors, the file might not match expected CSV structure; try the chooser when the app reports ambiguous header detection.

Transaction logs and live draft boards are not player snapshots and should not be uploaded here. Import the Prospects, Veterans, or Roster CSV tab used by the dashboard.
