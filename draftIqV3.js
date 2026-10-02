import { normalizeLookupKey } from './liveNhlApi.js';
import { buildPositionalScarcity, buildTeamNeeds, getDraftIqV2Inputs } from './draftIqV2.js';

// DraftIQ v3 is a second Best Available ranking score shown alongside DraftIQ v2. Like v2 it is
// separate from the pricing DraftIQ (PPS/RSS/BPS/RRS/KVS), so ranking never moves auction values.
export const DRAFT_IQ_V3_WEIGHTS = Object.freeze({
  forecastedPoints: 1,
  upsideScore: 0.3,
  positionalScarcity: 0.25,
  pedigreeMinusRisk: 0.2,
  teamNeedsBoost: 0.15,
  consistencyScore: 0.1,
  projectionConfidence: 0.1,
  shotsPerGame: 0.1,
  contractValue: 0.1,
  ageCurve: 0.1,
  noProjection: 0.2,
});

const AGE_CURVE_PEAK = 27;
const AGE_CURVE_PENALTY_PER_YEAR = 10;
const finite = (value) => (Number.isFinite(value) ? value : null);
const round1 = (value) => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function poolEntries(ahlPool) {
  if (ahlPool instanceof Map) return [...ahlPool];
  return Object.entries(ahlPool || {});
}

function poolPositions(poolPlayer) {
  return [...(poolPlayer?.positions instanceof Set ? poolPlayer.positions : poolPlayer?.positions || [])];
}

// Upside (0-100, in points): Dobber Upside minus the points projection; without Upside, the
// projection's gain over the 3-year average (3YP delta). Without a projection, Upside itself.
export function buildUpsideScore({ forecastedPoints, upside, threeYearPoints } = {}) {
  const points = finite(forecastedPoints);
  if (finite(upside) !== null) return round1(clamp(upside - (points ?? 0), 0, 100));
  if (points !== null && finite(threeYearPoints) !== null) return round1(clamp(points - threeYearPoints, 0, 100));
  return null;
}

// Age regression penalty (0-100): zero through age 27, then 10 per year, capped at 100.
export function buildAgeCurve(age) {
  if (finite(age) === null) return null;
  return round1(clamp((age - AGE_CURVE_PEAK) * AGE_CURVE_PENALTY_PER_YEAR, 0, 100));
}

// AHL splits trend (-100..100): second-half vs first-half points per game. Only actual AHL
// Scores splits count; Dobber-derived splits are an upside/3YP estimate already in upsideScore.
export function buildConsistencyScore({ FHPPG, SHPPG, splitsMethod } = {}) {
  if (splitsMethod !== 'actual' || finite(SHPPG) === null || !(FHPPG > 0)) return null;
  return round1(100 * clamp((SHPPG - FHPPG) / FHPPG, -1, 1));
}

// Contract value (0-100): pool percentile of projected points per $ of estimated auction value.
export function buildContractValues(entries = []) {
  const ratios = entries
    .filter(({ forecastedPoints, auctionValue }) => finite(forecastedPoints) !== null && auctionValue > 0)
    .map(({ key, forecastedPoints, auctionValue }) => ({ key, ratio: forecastedPoints / auctionValue }));
  const sorted = ratios.map(({ ratio }) => ratio).sort((left, right) => left - right);
  return new Map(ratios.map(({ key, ratio }) => {
    if (sorted.length === 1) return [key, 50];
    const below = sorted.filter((value) => value < ratio).length;
    const equal = sorted.filter((value) => value === ratio).length;
    return [key, round1(100 * (below + (equal - 1) / 2) / (sorted.length - 1))];
  }));
}

// Collect DraftIQ v3 inputs from a draft-intelligence player. Missing inputs stay NULL.
export function getDraftIqV3Inputs(player = {}) {
  const base = getDraftIqV2Inputs(player);
  const forecast = player.forecast || {};
  return {
    ...base,
    upsideScore: buildUpsideScore({
      forecastedPoints: base.forecastedPoints,
      upside: finite(player.dobberUpside),
      threeYearPoints: finite(player.threeYearPoints),
    }),
    age: finite(player.age),
    ageCurve: buildAgeCurve(player.age),
    consistencyScore: buildConsistencyScore(forecast),
    auctionValue: finite(player.auctionValue),
  };
}

// DraftIQv3 = 1.0*points + 0.3*upside + 0.25*scarcity + 0.2*(pedigree - risk) + 0.15*teamNeeds
//   + 0.1*consistency + 0.1*confidence + 0.1*(shots/games) + 0.1*contractValue - 0.1*ageCurve.
// Without a points projection: 0.2*(upside + pedigree - risk + scarcity). NULL inputs count as 0.
export function calculateDraftIqV3(inputs = {}, weights = DRAFT_IQ_V3_WEIGHTS) {
  const value = (key) => finite(inputs[key]) ?? 0;
  const pedigreeMinusRisk = value('pedigreeScore') - value('riskScore');
  const points = finite(inputs.forecastedPoints);
  if (points === null) {
    return {
      draftIQ: round1(weights.noProjection * (value('upsideScore') + pedigreeMinusRisk + value('positionalScarcity'))),
      projected: false,
    };
  }
  const shotsPerGame = Number.isFinite(inputs.shots) && Number.isFinite(inputs.games) && inputs.games > 0
    ? inputs.shots / inputs.games
    : 0;
  const draftIQ = weights.forecastedPoints * points
    + weights.upsideScore * value('upsideScore')
    + weights.positionalScarcity * value('positionalScarcity')
    + weights.pedigreeMinusRisk * pedigreeMinusRisk
    + weights.teamNeedsBoost * value('teamNeedsBoost')
    + weights.consistencyScore * value('consistencyScore')
    + weights.projectionConfidence * value('projectionConfidence')
    + weights.shotsPerGame * shotsPerGame
    + weights.contractValue * value('contractValue')
    - weights.ageCurve * value('ageCurve');
  return { draftIQ: round1(draftIQ), projected: true };
}

// Computes DraftIQ v3 for every canonical pool player. Returns a JSON-safe object keyed by
// playerKey so it can live in appState.datasets.draftIQv3 alongside the pool.
export function computeDraftIQv3({
  ahlPool,
  availableKeys,
  players = [],
  ownersByPlayerKey = new Map(),
  team = '',
  openSlots = null,
  rosterSlots,
} = {}) {
  const { scarcity } = buildPositionalScarcity(ahlPool, availableKeys);
  const needs = buildTeamNeeds(ahlPool, ownersByPlayerKey, team, { openSlots, rosterSlots });
  const playersByKey = new Map();
  (players || []).forEach((player) => {
    const key = normalizeLookupKey(player?.name);
    if (key && !playersByKey.has(key)) playersByKey.set(key, player);
  });
  const entries = poolEntries(ahlPool).map(([playerKey, poolPlayer]) => {
    const positions = poolPositions(poolPlayer);
    return [playerKey, {
      ...getDraftIqV3Inputs(playersByKey.get(playerKey) || {}),
      positionalScarcity: positions.length ? Math.max(...positions.map((position) => scarcity[position] ?? 0)) : 0,
      teamNeedsBoost: positions.length ? Math.max(...positions.map((position) => needs[position] ?? 0)) : 0,
    }];
  });
  const contractValues = buildContractValues(entries.map(([key, inputs]) => ({ key, ...inputs })));
  const result = {};
  entries.forEach(([playerKey, partialInputs]) => {
    const inputs = { ...partialInputs, contractValue: contractValues.get(playerKey) ?? null };
    result[playerKey] = { ...calculateDraftIqV3(inputs), inputs };
  });
  return result;
}
