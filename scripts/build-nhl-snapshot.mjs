// One-time/offline data generator: fetches all 32 NHL team rosters and every
// rostered player's "landing" profile, then writes a single static bundle to
// data/nhl-snapshot.json. The dashboard reads this file instead of calling
// the NHL API live, so there are no CORS/rate-limit concerns at runtime.
//
// Run with: node scripts/build-nhl-snapshot.mjs
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  summarizeRoster,
  summarizeSchedule,
  summarizeStandings,
  summarizePlayerLanding,
} from '../liveNhlApi.js';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';
const OUTPUT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'nhl-snapshot.json');

// Official current 3-letter abbreviations for all 32 NHL teams.
const OFFICIAL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK',
  'WPG', 'WSH',
];

const CONCURRENCY = 3;
const RETRY_LIMIT = 5;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, attempt = 1) {
  const response = await fetch(url);
  if (response.status === 429 && attempt <= RETRY_LIMIT) {
    await sleep(RETRY_DELAY_MS * attempt);
    return fetchJsonWithRetry(url, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

async function runInBatches(items, worker, concurrency) {
  const results = [];
  for (let offset = 0; offset < items.length; offset += concurrency) {
    const batch = items.slice(offset, offset + concurrency);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
    await sleep(400);
  }
  return results;
}

async function buildSnapshot() {
  console.log(`Fetching standings/now ...`);
  const standingsPayload = await fetchJsonWithRetry(`${NHL_API_BASE}/standings/now`);

  const teams = {};
  const allPlayerIds = new Set();

  console.log(`Fetching rosters and schedules for ${OFFICIAL_TEAMS.length} teams ...`);
  await runInBatches(OFFICIAL_TEAMS, async (teamAbbrev) => {
    try {
      const [rosterPayload, schedulePayload] = await Promise.all([
        fetchJsonWithRetry(`${NHL_API_BASE}/roster/${teamAbbrev}/current`),
        fetchJsonWithRetry(`${NHL_API_BASE}/club-schedule-season/${teamAbbrev}/now`),
      ]);
      const roster = summarizeRoster(rosterPayload);
      [...roster.forwards, ...roster.defensemen, ...roster.goalies].forEach((player) => {
        if (Number.isFinite(player.playerId)) allPlayerIds.add(player.playerId);
      });
      teams[teamAbbrev] = {
        teamAbbrev,
        roster,
        schedule: summarizeSchedule(teamAbbrev, schedulePayload),
        standings: summarizeStandings(teamAbbrev, standingsPayload),
      };
      console.log(`  ${teamAbbrev}: ${roster.playerCount} players`);
    } catch (error) {
      console.error(`  ${teamAbbrev}: failed (${error.message})`);
    }
  }, CONCURRENCY);

  const playerIds = [...allPlayerIds];
  console.log(`Fetching landing profiles for ${playerIds.length} players ...`);
  const players = {};
  let completed = 0;
  await runInBatches(playerIds, async (playerId) => {
    try {
      const landingPayload = await fetchJsonWithRetry(`${NHL_API_BASE}/player/${playerId}/landing`);
      players[playerId] = summarizePlayerLanding(landingPayload);
    } catch (error) {
      console.error(`  player ${playerId}: failed (${error.message})`);
    } finally {
      completed += 1;
      if (completed % 50 === 0 || completed === playerIds.length) {
        console.log(`  ${completed}/${playerIds.length} player profiles fetched`);
      }
    }
  }, CONCURRENCY);

  const snapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    teamCount: Object.keys(teams).length,
    playerCount: Object.keys(players).length,
    teams,
    players,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(snapshot), 'utf8');
  console.log(`Wrote snapshot: ${OUTPUT_PATH}`);
  console.log(`Teams: ${snapshot.teamCount}, Players: ${snapshot.playerCount}`);
}

buildSnapshot().catch((error) => {
  console.error('Failed to build NHL snapshot:', error);
  process.exitCode = 1;
});
