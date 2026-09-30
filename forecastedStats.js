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

export function buildForecastedStats(projections, historicalSplits) {
  const projectedPoints = readProjection(projections, ['ProjPts', 'Projected Points', 'Forecasted Points', 'projectedPoints']);
  const projectedGames = readProjection(projections, ['ProjGP', 'Proj Games', 'Projected Games', 'projectedGames', 'GP']);
  const projectedShots = readProjection(projections, ['ProjSOG', 'ProjShots', 'Proj Shots', 'Projected Shots', 'projectedShots', 'SOG', 'Shots']);
  const FHPPG = historicalSplits?.FHPPG ?? null;
  const SHPPG = historicalSplits?.SHPPG ?? null;
  const complete = [projectedPoints, projectedGames, projectedShots, FHPPG, SHPPG]
    .every((value) => Number.isFinite(value) && value >= 0);
  const compositeScore = complete
    ? Math.round((projectedPoints + 0.25 * (SHPPG - FHPPG) * projectedGames + 0.1 * projectedShots) * 100) / 100
    : null;
  return { projectedPoints, projectedGames, projectedShots, FHPPG, SHPPG, compositeScore };
}

export function applyForecastedStats(player, projections) {
  const forecast = buildForecastedStats(projections, player.historicalSplits);
  return {
    ...player,
    forecast,
    forecastedPoints: forecast.projectedPoints,
    compositeForecastScore: forecast.compositeScore,
  };
}
