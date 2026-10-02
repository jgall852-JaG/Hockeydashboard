import { normalizeLookupKey } from './liveNhlApi.js';

// DraftIQ v2 is a Best Available ranking score. It is separate from the v1 DraftIQ
// (PPS/RSS/BPS/RRS/KVS) that feeds auction pricing, so ranking changes never move prices.
export const DRAFT_IQ_V2_WEIGHTS = Object.freeze({
  forecastedPoints: 1,
  positionalScarcity: 0.25,
  pedigreeMinusRisk: 0.15,
  teamNeedsBoost: 0.2,
  shotsPerGame: 5,
  noProjection: 0.1,
});

const DEFAULT_ROSTER_SLOTS = 25;
const finite = (value) => (Number.isFinite(value) ? value : null);
const round1 = (value) => Math.round(value * 10) / 10;

function poolEntries(ahlPool) {
  if (ahlPool instanceof Map) return [...ahlPool];
  return Object.entries(ahlPool || {});
}

function poolPositions(poolPlayer) {
  return [...(poolPlayer?.positions instanceof Set ? poolPlayer.positions : poolPlayer?.positions || [])];
}

function ownersFor(ownersByPlayerKey, playerKey) {
  const owners = ownersByPlayerKey instanceof Map ? ownersByPlayerKey.get(playerKey) : ownersByPlayerKey?.[playerKey];
  return [...(owners || [])];
}

// Scarcity per position from canonical pool depth: 0 for the deepest available position,
// approaching 100 as a position's available depth runs out.
export function buildPositionalScarcity(ahlPool, availableKeys) {
  const available = availableKeys instanceof Set ? availableKeys : new Set(availableKeys || []);
  const depth = {};
  poolEntries(ahlPool).forEach(([playerKey, poolPlayer]) => {
    poolPositions(poolPlayer).forEach((position) => {
      depth[position] ||= 0;
      if (available.has(playerKey)) depth[position] += 1;
    });
  });
  const maxDepth = Math.max(0, ...Object.values(depth));
  const scarcity = Object.fromEntries(Object.entries(depth).map(([position, count]) => [
    position,
    maxDepth > 0 ? round1(100 * (1 - count / maxDepth)) : 0,
  ]));
  return { depth, scarcity };
}

// Team needs (0-100) by position for one team: how far its owned pool players at each position
// fall short of that position's share of a full roster. Zero when the team has no open slots.
export function buildTeamNeeds(ahlPool, ownersByPlayerKey, team, { openSlots = null, rosterSlots = DEFAULT_ROSTER_SLOTS } = {}) {
  const teamKey = normalizeLookupKey(team || '');
  if (!teamKey || openSlots === 0) return {};
  const poolCount = {};
  const owned = {};
  let positionSlots = 0;
  poolEntries(ahlPool).forEach(([playerKey, poolPlayer]) => {
    const positions = poolPositions(poolPlayer);
    const ownedByTeam = ownersFor(ownersByPlayerKey, playerKey).some((owner) => normalizeLookupKey(owner) === teamKey);
    positions.forEach((position) => {
      poolCount[position] = (poolCount[position] || 0) + 1;
      positionSlots += 1;
      if (ownedByTeam) owned[position] = (owned[position] || 0) + 1;
    });
  });
  if (!positionSlots) return {};
  return Object.fromEntries(Object.entries(poolCount).map(([position, count]) => {
    const target = rosterSlots * (count / positionSlots);
    const shortfall = Math.max(0, target - (owned[position] || 0));
    return [position, target > 0 ? round1(100 * Math.min(1, shortfall / target)) : 0];
  }));
}

function parseConfidence(value) {
  if (Number.isFinite(value)) return value;
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return null;
  const numeric = Number(text.replace(/%$/, ''));
  if (Number.isFinite(numeric)) return numeric;
  if (text.startsWith('high')) return 80;
  if (text.startsWith('med')) return 50;
  if (text.startsWith('low')) return 20;
  return null;
}

// Collect DraftIQ v2 inputs from a draft-intelligence player. Missing inputs stay NULL.
export function getDraftIqV2Inputs(player = {}) {
  const forecast = player.forecast || {};
  const pedigree = finite(player.prospect?.pedigree);
  return {
    forecastedGoals: finite(player.forecastedGoals ?? forecast.projectedGoals),
    forecastedAssists: finite(player.forecastedAssists ?? forecast.projectedAssists),
    forecastedPoints: finite(player.forecastedPoints ?? forecast.projectedPoints),
    shots: finite(forecast.projectedShots),
    games: finite(forecast.projectedGames),
    FHPPG: finite(forecast.FHPPG),
    SHPPG: finite(forecast.SHPPG),
    riskScore: finite(player.deployment?.RRS ?? player.production?.RRS),
    pedigreeScore: pedigree !== null ? pedigree * 100 : finite(player.prospect?.BPS ?? player.production?.BPS),
    projectionConfidence: parseConfidence(player.intelEdge?.projectionConfidence),
    adp: finite(player.adp ?? forecast.adp),
    classification: player.category || null,
  };
}

// DraftIQ = w1*points + w2*scarcity + w3*(pedigree - risk) + w4*teamNeeds + w5*(shots/games).
// Without a points projection, DraftIQ = (scarcity + pedigree - risk) at a low weight.
export function calculateDraftIqV2(inputs = {}, weights = DRAFT_IQ_V2_WEIGHTS) {
  const scarcity = finite(inputs.positionalScarcity) ?? 0;
  const pedigree = finite(inputs.pedigreeScore) ?? 0;
  const risk = finite(inputs.riskScore) ?? 0;
  const teamNeeds = finite(inputs.teamNeedsBoost) ?? 0;
  const points = finite(inputs.forecastedPoints);
  if (points === null) {
    return { draftIQ: round1(weights.noProjection * (scarcity + pedigree - risk)), projected: false };
  }
  const shotsPerGame = Number.isFinite(inputs.shots) && Number.isFinite(inputs.games) && inputs.games > 0
    ? inputs.shots / inputs.games
    : 0;
  const draftIQ = weights.forecastedPoints * points
    + weights.positionalScarcity * scarcity
    + weights.pedigreeMinusRisk * (pedigree - risk)
    + weights.teamNeedsBoost * teamNeeds
    + weights.shotsPerGame * shotsPerGame;
  return { draftIQ: round1(draftIQ), projected: true };
}

// Computes DraftIQ v2 for every canonical pool player. Returns a JSON-safe object keyed by
// playerKey so it can live in appState.datasets.draftIQ alongside the pool.
export function computeDraftIQ({
  ahlPool,
  availableKeys,
  players = [],
  ownersByPlayerKey = new Map(),
  team = '',
  openSlots = null,
  rosterSlots = DEFAULT_ROSTER_SLOTS,
} = {}) {
  const { scarcity } = buildPositionalScarcity(ahlPool, availableKeys);
  const needs = buildTeamNeeds(ahlPool, ownersByPlayerKey, team, { openSlots, rosterSlots });
  const playersByKey = new Map();
  (players || []).forEach((player) => {
    const key = normalizeLookupKey(player?.name);
    if (key && !playersByKey.has(key)) playersByKey.set(key, player);
  });
  const result = {};
  poolEntries(ahlPool).forEach(([playerKey, poolPlayer]) => {
    const positions = poolPositions(poolPlayer);
    const inputs = {
      ...getDraftIqV2Inputs(playersByKey.get(playerKey) || {}),
      positionalScarcity: positions.length ? Math.max(...positions.map((position) => scarcity[position] ?? 0)) : 0,
      teamNeedsBoost: positions.length ? Math.max(...positions.map((position) => needs[position] ?? 0)) : 0,
    };
    result[playerKey] = { ...calculateDraftIqV2(inputs), inputs };
  });
  return result;
}
