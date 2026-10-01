// Loads the preloaded AHL historical bid bundle (data/ahl-historical-bids.json,
// generated offline by scripts/build-ahl-historical-bids.mjs from the Draft
// 2024 and Draft 2025 retained-grid tabs) and exposes avgCost/minCost/maxCost/
// yearsDrafted lookups keyed by player name. Any player with no historical
// entry falls back to NA for every field rather than throwing or omitting
// the stats.
import { normalizeLookupKey, getRosterPlayerIdentityAliases } from './liveNhlApi.js';

export const AHL_HISTORICAL_BIDS_URL = './data/ahl-historical-bids.json';

export const NA_HISTORICAL_BID_STATS = Object.freeze({
  avgCost: 'NA',
  minCost: 'NA',
  maxCost: 'NA',
  yearsDrafted: 'NA',
});

async function fetchJson(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available');
  }
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

// Loaded once and cached on the shared live-cache object (same pattern as
// loadNhlSnapshot) so there is only ever one network request per session.
export async function loadAhlHistoricalBids(cache, fetchImpl = globalThis.fetch) {
  if (cache?.historicalBids) {
    return cache.historicalBids;
  }
  if (cache?.historicalBidsRequest) {
    return cache.historicalBidsRequest;
  }

  const request = fetchJson(AHL_HISTORICAL_BIDS_URL, fetchImpl).then((bundle) => {
    if (cache) {
      cache.historicalBids = bundle;
      delete cache.historicalBidsRequest;
    }
    return bundle;
  }).catch((error) => {
    if (cache) delete cache.historicalBidsRequest;
    throw error;
  });
  if (cache) {
    cache.historicalBidsRequest = request;
  }
  return request;
}

// Returns { avgCost, minCost, maxCost, yearsDrafted } for the given player
// name, matching on the normalized full name or the "first initial + last
// name" alias used by the historical draft tabs (e.g. "D Strome"). Falls
// back to NA_HISTORICAL_BID_STATS when no historical bundle or no matching
// entry is available.
export function getHistoricalBidStats(bundle, playerName) {
  const players = bundle?.players;
  if (!players || !playerName) return { ...NA_HISTORICAL_BID_STATS };

  const directKey = normalizeLookupKey(playerName);
  const entry = players[directKey]
    || getRosterPlayerIdentityAliases(playerName).map((alias) => players[alias]).find(Boolean);

  if (!entry) return { ...NA_HISTORICAL_BID_STATS };

  return {
    avgCost: Number.isFinite(entry.avgCost) ? entry.avgCost : 'NA',
    minCost: Number.isFinite(entry.minCost) ? entry.minCost : 'NA',
    maxCost: Number.isFinite(entry.maxCost) ? entry.maxCost : 'NA',
    yearsDrafted: Array.isArray(entry.yearsDrafted) && entry.yearsDrafted.length ? entry.yearsDrafted : 'NA',
  };
}
