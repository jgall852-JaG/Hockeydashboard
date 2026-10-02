import { parseCSVLine } from './rosterParser.js';
import { normalizeLookupKey } from './liveNhlApi.js';
import { buildPositionalScarcity } from './draftIqV2.js';

// fairPriceV2 = basePrice * scarcityFactor * productionFactor * poolGamesFactor, in draft dollars.
// basePrice is the player's most recent past auction price (Post Draft 2025, then 2024); otherwise
// the league-average past price for the player's tier. NHL salary, AAV and keeper cost are never used.
export const PAST_AUCTION_SEASONS = Object.freeze(['2025', '2024']);
export const FAIR_PRICE_V2_RANGES = Object.freeze({
  scarcity: Object.freeze({ min: 0.8, max: 1.4 }),
  production: Object.freeze({ min: 0.9, max: 1.3 }),
  poolGames: Object.freeze({ min: 0.85, max: 1.15 }),
});
// D and C scale within their band by canonical pool depth; wingers are fixed.
const SCARCITY_BANDS = Object.freeze({
  D: Object.freeze({ min: 1.3, max: 1.4 }),
  RW: Object.freeze({ min: 1.15, max: 1.15 }),
  LW: Object.freeze({ min: 1.05, max: 1.05 }),
  C: Object.freeze({ min: 0.8, max: 0.9 }),
});
const TIER_PRICE_MIDPOINTS = Object.freeze({ 1: 50, 2: 32, 3: 17, 4: 7, 5: 2.5 });
const GOALIE_POSITIONS = new Set(['G', 'GT', 'GOALIE', 'GOALIE TEAM']);

const finite = (value) => (Number.isFinite(value) ? value : null);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round2 = (value) => Math.round(value * 100) / 100;
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

function parseMoney(value) {
  const numeric = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return String(value ?? '').trim() && Number.isFinite(numeric) ? numeric : null;
}

// Parses a post-draft roster grid (owner row, "#,Player Name,Pos.,Cost" header, 4-column team
// blocks). Goalie-team rows and TOTAL SPENT / BALANCE rows are skipped.
export function parsePastAuctionSheet(csvText) {
  const players = [];
  let owners = [];
  const rows = String(csvText || '').split(/\r?\n/).filter((line) => line.trim()).map(parseCSVLine);
  rows.forEach((values, index) => {
    if (values.some((cell) => String(cell || '').trim().toLowerCase() === 'player name')) {
      const ownerRow = rows[index - 1] || [];
      owners = [];
      for (let column = 0; column < values.length; column += 4) owners.push(String(ownerRow[column] || '').trim());
      return;
    }
    if (!owners.length) return;
    owners.forEach((owner, block) => {
      const column = block * 4;
      const name = String(values[column + 1] || '').trim();
      const position = String(values[column + 2] || '').trim();
      const cost = parseMoney(values[column + 3]);
      if (!owner || !name || /^(TOTAL SPENT|BALANCE)$/i.test(name)) return;
      if (GOALIE_POSITIONS.has(position.toUpperCase()) || cost === null) return;
      players.push({ name, owner, position, cost });
    });
  });
  return { layout: 'past-auction', players };
}

// Sheet position codes: C, LW, RW, D, or utility combos like CL / CR / RL.
export function parsePastAuctionPositions(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'LW' || code === 'RW') return [code];
  return [...new Set([...code].flatMap((letter) => ({ C: ['C'], L: ['LW'], R: ['RW'], D: ['D'] }[letter] || [])))];
}

// Matches an abbreviated sheet name ("D Strome", "JT Miller", "PL Dubois") to a unique canonical
// pool key. Exact keys win; otherwise the surname must match and the leading token must be the
// first name's initial(s). Ties are broken by the sheet position (Leo C vs Lucas D Carlsson);
// still-ambiguous or unknown names stay unmatched.
export function matchPastAuctionName(name, poolKeys, { position = '', positionsByKey = null } = {}) {
  const key = normalizeLookupKey(name);
  if (!key) return '';
  const keys = poolKeys instanceof Set ? poolKeys : new Set(poolKeys || []);
  if (keys.has(key)) return key;
  const [abbr, ...surnameTokens] = key.split(' ');
  if (!abbr || !surnameTokens.length) return '';
  const surname = surnameTokens.join(' ');
  const matches = [...keys].filter((candidate) => {
    const tokens = candidate.split(' ');
    for (let split = 1; split < tokens.length; split += 1) {
      if (tokens.slice(split).join(' ') !== surname) continue;
      const firstNames = tokens.slice(0, split);
      const initials = firstNames.map((token) => token[0]).join('');
      if (initials === abbr || firstNames.join('') === abbr) return true;
      if (abbr.length === 1 && firstNames[0].startsWith(abbr)) return true;
    }
    return false;
  });
  if (matches.length === 1) return matches[0];
  const sheetPositions = parsePastAuctionPositions(position);
  if (matches.length < 2 || !sheetPositions.length || !positionsByKey) return '';
  const byPosition = matches.filter((candidate) => {
    const candidatePositions = positionsByKey instanceof Map ? positionsByKey.get(candidate) : positionsByKey[candidate];
    return [...(candidatePositions || [])].some((candidatePosition) => sheetPositions.includes(candidatePosition));
  });
  return byPosition.length === 1 ? byPosition[0] : '';
}

// Most recent past auction price per pool key: { [playerKey]: { price, season, sheetName } }.
// poolKeys may be a Set/array of keys, or a Map of playerKey -> positions for position tie-breaks.
export function buildPastAuctionPrices(pastAuctions, poolKeys, seasons = PAST_AUCTION_SEASONS) {
  const result = {};
  const positionsByKey = poolKeys instanceof Map ? poolKeys : null;
  const keys = positionsByKey ? new Set(positionsByKey.keys()) : poolKeys instanceof Set ? poolKeys : new Set(poolKeys || []);
  seasons.forEach((season) => {
    (pastAuctions?.seasons?.[season]?.players || []).forEach((record) => {
      const playerKey = matchPastAuctionName(record?.name, keys, { position: record?.position, positionsByKey });
      if (!playerKey || result[playerKey] || !(finite(record?.cost) > 0)) return;
      result[playerKey] = { price: record.cost, season, sheetName: record.name };
    });
  });
  return result;
}

// Scarcity factor from canonical pool depth (scarcity 0-100): D 1.3-1.4, RW 1.15, LW 1.05,
// C 0.8-0.9. Multi-position players take their highest factor; unknown positions are neutral.
export function getScarcityFactor(positions = [], scarcityByPosition = {}) {
  const factors = (positions || []).flatMap((position) => {
    const band = SCARCITY_BANDS[position];
    if (!band) return [];
    const depthShare = clamp((finite(scarcityByPosition?.[position]) ?? 0) / 100, 0, 1);
    return [band.min + (band.max - band.min) * depthShare];
  });
  if (!factors.length) return 1;
  const { min, max } = FAIR_PRICE_V2_RANGES.scarcity;
  return clamp(Math.max(...factors), min, max);
}

export function getPoolPoints(forecastedGoals, forecastedAssists) {
  const goals = finite(forecastedGoals);
  const assists = finite(forecastedAssists);
  if (goals === null && assists === null) return null;
  return (goals ?? 0) + 0.5 * (assists ?? 0);
}

// Ratio to the league average, clamped to range; missing values are neutral (1.0).
export function getRatioFactor(value, leagueAverage, { min, max }) {
  if (finite(value) === null || !(finite(leagueAverage) > 0)) return 1;
  return clamp(value / leagueAverage, min, max);
}

export function calculateFairPriceV2({ basePrice, scarcityFactor = 1, productionFactor = 1, poolGamesFactor = 1 } = {}) {
  if (!(finite(basePrice) > 0)) return null;
  return round2(basePrice * scarcityFactor * productionFactor * poolGamesFactor);
}

// Computes fairPriceV2 for every canonical pool player. Returns a JSON-safe object keyed by
// playerKey so it can live in appState.datasets.fairPriceV2 alongside DraftIQ.
export function computeFairPriceV2({
  ahlPool,
  availableKeys,
  players = [],
  pastAuctions = null,
  getPoolGamesForTeam = () => null,
} = {}) {
  const pool = ahlPool instanceof Map ? [...ahlPool] : Object.entries(ahlPool || {});
  const positionsByKey = new Map(pool.map(([playerKey, poolPlayer]) => [
    playerKey,
    [...(poolPlayer?.positions instanceof Set ? poolPlayer.positions : poolPlayer?.positions || [])],
  ]));
  const { scarcity } = buildPositionalScarcity(ahlPool, availableKeys);
  const pastPrices = buildPastAuctionPrices(pastAuctions, positionsByKey);
  const playersByKey = new Map();
  (players || []).forEach((player) => {
    const key = normalizeLookupKey(player?.name);
    if (key && !playersByKey.has(key)) playersByKey.set(key, player);
  });

  const entries = pool.map(([playerKey, poolPlayer]) => {
    const player = playersByKey.get(playerKey) || {};
    const positions = [...(poolPlayer?.positions instanceof Set ? poolPlayer.positions : poolPlayer?.positions || [])];
    const poolGames = player.poolGames || getPoolGamesForTeam(poolPlayer?.team || player.team) || null;
    return {
      playerKey,
      positions,
      tier: Number.isInteger(player.tier) ? player.tier : null,
      pastPrice: pastPrices[playerKey] || null,
      poolPoints: getPoolPoints(
        player.forecastedGoals ?? player.forecast?.projectedGoals,
        player.forecastedAssists ?? player.forecast?.projectedAssists,
      ),
      totalPoolGames: finite(poolGames?.totalPoolGames),
    };
  });

  const tierPrices = {};
  entries.forEach(({ tier, pastPrice }) => {
    if (tier === null || !pastPrice) return;
    (tierPrices[tier] ||= []).push(pastPrice.price);
  });
  const tierAverages = Object.fromEntries(Object.entries(tierPrices).map(([tier, prices]) => [tier, average(prices)]));
  const leagueAveragePoolPoints = average(entries.map(({ poolPoints }) => poolPoints).filter((value) => value !== null));
  const leagueAveragePoolGames = average(entries.map(({ totalPoolGames }) => totalPoolGames).filter((value) => value !== null));

  const result = {};
  entries.forEach(({ playerKey, positions, tier, pastPrice, poolPoints, totalPoolGames }) => {
    let basePrice = null;
    let baseSource = null;
    if (pastPrice) {
      basePrice = pastPrice.price;
      baseSource = `Post Draft ${pastPrice.season} (${pastPrice.sheetName})`;
    } else if (tier !== null && finite(tierAverages[tier]) !== null) {
      basePrice = round2(tierAverages[tier]);
      baseSource = `Tier ${tier} league average`;
    } else if (tier !== null) {
      basePrice = TIER_PRICE_MIDPOINTS[tier];
      baseSource = `Tier ${tier} price band midpoint`;
    }
    const factors = {
      scarcityFactor: round2(getScarcityFactor(positions, scarcity)),
      productionFactor: round2(getRatioFactor(poolPoints, leagueAveragePoolPoints, FAIR_PRICE_V2_RANGES.production)),
      poolGamesFactor: round2(getRatioFactor(totalPoolGames, leagueAveragePoolGames, FAIR_PRICE_V2_RANGES.poolGames)),
    };
    result[playerKey] = {
      fairPriceV2: calculateFairPriceV2({ basePrice, ...factors }),
      basePrice,
      baseSource,
      ...factors,
      poolPoints,
      totalPoolGames,
    };
  });
  return result;
}
