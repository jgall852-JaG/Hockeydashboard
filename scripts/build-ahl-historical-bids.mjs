// One-time/offline data generator: fetches the Draft 2024 and Draft 2025
// retained-grid tabs from the AHL Draft Google workbook and aggregates each
// player's historical winning-bid cost across both seasons into a single
// static bundle at data/ahl-historical-bids.json. The dashboard reads this
// file (loadAhlHistoricalBids in ahlHistoricalBids.js) instead of parsing the
// historical tabs live, so Tools & Validation can show avgCost/minCost/
// maxCost/yearsDrafted without any runtime Google Sheets fetch.
//
// Run with: node scripts/build-ahl-historical-bids.mjs
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRoster } from '../rosterParser.js';
import { normalizeLookupKey } from '../liveNhlApi.js';

const AHL_DRAFT_SPREADSHEET_ID = '1_RbnvnxnMzzwty7jdq8I9SN3mWfp187xKVnyPackzeA';
const OUTPUT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'ahl-historical-bids.json');

// Historical retained-grid draft tabs, one per prior draft season.
const HISTORICAL_DRAFT_TABS = [
  { year: 2024, gid: '483115229' },
  { year: 2025, gid: '1971572547' },
];

function buildCsvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${AHL_DRAFT_SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
}

async function fetchCsv(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.text();
}

async function buildHistoricalBids() {
  const playerYears = new Map();

  for (const { year, gid } of HISTORICAL_DRAFT_TABS) {
    console.log(`Fetching Draft ${year} tab (gid=${gid}) ...`);
    const csv = await fetchCsv(buildCsvUrl(gid));
    const parsed = parseRoster(csv);
    const players = Object.values(parsed.players || {});
    console.log(`  Draft ${year}: ${players.length} player rows parsed (layout: ${parsed.layout})`);

    players.forEach((player) => {
      const name = String(player.name || '').trim();
      const cost = Number(player.cost);
      if (!name || !Number.isFinite(cost)) return;
      const key = normalizeLookupKey(name);
      if (!key) return;
      if (!playerYears.has(key)) {
        playerYears.set(key, { name, costsByYear: new Map() });
      }
      playerYears.get(key).costsByYear.set(year, cost);
    });
  }

  const players = {};
  playerYears.forEach((entry, key) => {
    const costs = [...entry.costsByYear.values()];
    const yearsDrafted = [...entry.costsByYear.keys()].sort();
    players[key] = {
      name: entry.name,
      avgCost: Number((costs.reduce((sum, cost) => sum + cost, 0) / costs.length).toFixed(2)),
      minCost: Math.min(...costs),
      maxCost: Math.max(...costs),
      yearsDrafted,
    };
  });

  const bundle = {
    version: 1,
    generatedAt: new Date().toISOString(),
    years: HISTORICAL_DRAFT_TABS.map((tab) => tab.year),
    playerCount: Object.keys(players).length,
    players,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(bundle), 'utf8');
  console.log(`Wrote historical bids bundle: ${OUTPUT_PATH}`);
  console.log(`Players with historical bid data: ${bundle.playerCount}`);
}

buildHistoricalBids().catch((error) => {
  console.error('Failed to build AHL historical bids bundle:', error);
  process.exitCode = 1;
});
