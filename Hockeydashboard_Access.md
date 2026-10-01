# Hockeydashboard access

## Setup

1. Install [Node.js](https://nodejs.org/) on the computer hosting the dashboard. Run `Launch-Hockey-Dashboard.bat` from this repository's `app` folder (the older `Start-Hockeydashboard.cmd` launches the same server). The launcher prints the local and LAN URLs; keep its window open while using the dashboard.

   The complete `Launch-Hockey-Dashboard.bat` launcher is:

   ```bat
   @echo off
   cd /d "%~dp0"
   node scripts\serve-dashboard.mjs
   if errorlevel 1 pause
   ```

2. Open the [dashboard on this computer](http://127.0.0.1:3000/index.html). Wait for **AHL Sheets** to load; use **Refresh AHL Sheets** if needed. The configured AHL Draft and AHL Scores tabs load automatically and do not need to be uploaded manually when the refresh succeeds.
3. **Manually upload the Dobber Excel `.xlsx` workbook** containing `EVERYTHING (Skaters)` using **Import Dobber Excel** or the drop zone. **Manually upload the Dobber PDF file(s)** using **Import Dobber PDFs** or its drop zone if you want PDF risk/pedigree insights. The configured OneDrive links do not reliably permit unauthenticated browser imports. If you are moving between devices or browsers, also use **Import Saved State** with a previously exported state JSON. If the AHL Sheets refresh fails, use a recent saved state or the supported CSV uploads rather than assuming stale data is current.

## Access from another device

The dashboard is accessible from a laptop, phone, or tablet **on the same network as the hosting computer** while the launcher is running. `127.0.0.1` works only on the hosting computer. On a phone or tablet, open the `Mobile (same network)` LAN IP URL printed by the launcher, for example `http://192.168.1.20:3000/index.html`. If multiple LAN URLs appear, use the address on the same network as the device. Allow Node.js through the private-network firewall if prompted; the device must be able to reach the host (some guest Wi-Fi networks isolate devices). NHL career GP, positions, and roster data for Experience Tier come from a preloaded static snapshot (`data/nhl-snapshot.json`) bundled with the app — there is no live NHL API call, so this works identically on the local launcher and the hosted site. Browser-local uploads, bids, and saved state do not sync between devices: manually upload the Dobber Excel workbook and PDFs (and import exported state if needed) on each device.
