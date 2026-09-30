# Hockeydashboard access

## Setup

1. Install [Node.js](https://nodejs.org/) on the computer hosting the dashboard. Run `Start-Hockeydashboard.cmd` from this repository's `app` folder (or `node scripts/serve-dashboard.mjs`). Keep the launcher window open while using the dashboard.
2. Open the [dashboard on this computer](http://127.0.0.1:3000/index.html). Wait for **AHL Sheets** to load; use **Refresh AHL Sheets** if needed. The configured AHL Draft and AHL Scores tabs load automatically and do not need to be uploaded manually when the refresh succeeds.
3. **Manually upload the Dobber Excel `.xlsx` workbook** containing `EVERYTHING (Skaters)` using **Import Dobber Excel** or the drop zone. **Manually upload the Dobber PDF file(s)** using **Import Dobber PDFs** or its drop zone if you want PDF risk/pedigree insights. The configured OneDrive links do not reliably permit unauthenticated browser imports. If you are moving between devices or browsers, also use **Import Saved State** with a previously exported state JSON. If the AHL Sheets refresh fails, use a recent saved state or the supported CSV uploads rather than assuming stale data is current.

## Access from another device

The dashboard is accessible from a laptop or cellphone **on the same network as the hosting computer** while the launcher is running. `127.0.0.1` works only on the hosting computer. On another device, open `http://<hosting-computer-LAN-IPv4>:3000/index.html` (for example `http://192.168.1.20:3000/index.html`). Find the host IPv4 with `ipconfig` on Windows; allow Node.js through the private-network firewall if prompted. Browser-local uploads, bids, and saved state do not sync between devices: import the files or exported state on each device as needed.
