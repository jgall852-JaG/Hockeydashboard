function readProjection(projections, aliases) {
  if (!projections || typeof projections !== 'object' || Array.isArray(projections)) return null;
  const keys = Object.keys(projections);
  const key = aliases.map((alias) => keys.find((candidate) => (
    candidate.replace(/[^a-z0-9]/gi, '').toLowerCase() === alias.replace(/[^a-z0-9]/gi, '').toLowerCase()
  ))).find(Boolean);
  if (!key || projections[key] === null || String(projections[key]).trim() === '') return null;
  const value = Number(String(projections[key]).replace(/,/g, '').trim());
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Dobber projection ${key} must be a nonnegative number.`);
  }
  return value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// When the AHL Scores workbook has no player-level first/second-half splits, estimate a
// trend-based FHPPG/SHPPG pair from Dobber's Rank/Upside/3YP signals so Composite Score is
// not permanently null for real Dobber players. A positive trend (upside gap or points above
// the 3-year baseline) skews more production toward the second half; a negative trend skews
// toward the first half. Requires at least one trend signal — without one, splits stay unavailable.
function deriveTrendSplits({ projectedPoints, projectedGames, threeYearPoints, upside }) {
  if (!Number.isFinite(projectedPoints) || !Number.isFinite(projectedGames) || projectedGames <= 0) return null;
  const seasonPPG = projectedPoints / projectedGames;
  const trendSignals = [];
  if (Number.isFinite(threeYearPoints) && threeYearPoints > 0) {
    trendSignals.push(clamp((projectedPoints - threeYearPoints) / threeYearPoints, -1, 1));
  }
  if (Number.isFinite(upside) && upside > 0) {
    trendSignals.push(clamp((upside - projectedPoints) / upside, -1, 1));
  }
  if (!trendSignals.length) return null;
  const trend = clamp(trendSignals.reduce((sum, value) => sum + value, 0) / trendSignals.length, -0.4, 0.4);
  return {
    FHPPG: Math.round(seasonPPG * (1 - trend / 2) * 1000) / 1000,
    SHPPG: Math.round(seasonPPG * (1 + trend / 2) * 1000) / 1000,
  };
}

export function buildForecastedStats(projections, historicalSplits, trendInputs = {}) {
  const projectedPoints = readProjection(projections, ['ProjPts', 'Projected Points', 'Forecasted Points', 'projectedPoints']);
  const projectedGames = readProjection(projections, ['ProjGP', 'Proj Games', 'Projected Games', 'projectedGames', 'GP']);
  const projectedShots = readProjection(projections, ['ProjSOG', 'ProjShots', 'Proj Shots', 'Projected Shots', 'projectedShots', 'SOG', 'Shots']);
  let FHPPG = historicalSplits?.FHPPG ?? null;
  let SHPPG = historicalSplits?.SHPPG ?? null;
  let splitsMethod = Number.isFinite(FHPPG) && Number.isFinite(SHPPG) ? 'actual' : null;
  if (splitsMethod !== 'actual') {
    const derived = deriveTrendSplits({
      projectedPoints,
      projectedGames,
      threeYearPoints: trendInputs.threeYearPoints,
      upside: trendInputs.upside,
    });
    if (derived) {
      FHPPG = derived.FHPPG;
      SHPPG = derived.SHPPG;
      splitsMethod = 'derived';
    } else {
      FHPPG = null;
      SHPPG = null;
      splitsMethod = 'unavailable';
    }
  }
  const complete = [projectedPoints, projectedGames, projectedShots, FHPPG, SHPPG]
    .every((value) => Number.isFinite(value) && value >= 0);
  const compositeScore = complete
    ? Math.round((projectedPoints + 0.25 * (SHPPG - FHPPG) * projectedGames + 0.1 * projectedShots) * 100) / 100
    : null;
  return { projectedPoints, projectedGames, projectedShots, FHPPG, SHPPG, splitsMethod, compositeScore };
}

export function applyForecastedStats(player, projections, trendInputs) {
  const forecast = buildForecastedStats(projections, player.historicalSplits, trendInputs);
  const strengths = forecast.splitsMethod === 'derived'
    ? [...new Set([...(player.strengths || []), 'Forecasted FH/SH splits estimated from Rank/Upside/3YP trend (actual AHL splits unavailable)'])]
    : player.strengths;
  return {
    ...player,
    strengths,
    forecast,
    forecastedPoints: forecast.projectedPoints,
    compositeForecastScore: forecast.compositeScore,
  };
}
