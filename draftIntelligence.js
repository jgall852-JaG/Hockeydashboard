const DATA_VERSION = 2;
const LEAGUE_SETTINGS = Object.freeze({
  budget: 250,
  rosterSlots: 25,
  minimumBid: 0.5,
  scoring: { goals: 1, assists: 0.5, goalsAgainst: -0.5 },
  categories: { eligibilitySource: 'AHLSheets', values: ['Farm', 'Rookie', 'Veteran'] },
});
const CLASSIFICATION_THRESHOLDS = Object.freeze({
  lowRegressionRisk: 33,
  highRegressionRisk: 67,
  usageDecline: 0.67,
  agingCurveRisk: 0.67,
  bandMidpointTolerance: 0.1,
});
const PRICE_BANDS = Object.freeze({
  1: { min: 40, max: 60, midpoint: 50 },
  2: { min: 25, max: 39, midpoint: 32 },
  3: { min: 10, max: 24, midpoint: 17 },
  4: { min: 5, max: 9, midpoint: 7 },
  5: { min: 1, max: 4, midpoint: 2.5 },
});
const SOURCE_REGISTRY = Object.freeze({
  AHLSheets: false,
  DobberExcel: false,
  DobberPDFs: false,
});

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text || '');

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePosition(value) {
  const position = String(value || '').trim().toUpperCase();
  if (position === 'L' || position === 'LW' || position === 'LD') return position === 'LD' ? 'D' : 'LW';
  if (position === 'R' || position === 'RW' || position === 'RD') return position === 'RD' ? 'D' : 'RW';
  if (position === 'G' || position === 'GOALIE' || position === 'GT') return 'G';
  if (position === 'C' || position === 'D') return position;
  return '';
}

function normalizeAhlCategory(value, prospect) {
  const category = String(value || '').trim().toLowerCase();
  if (category === 'farm') return 'Farm';
  if (category === 'rookie') return 'Rookie';
  if (category === 'veteran') return 'Veteran';
  if (prospect) return prospect.farm ? 'Farm' : 'Rookie';
  return null;
}

function normalizedMetric(value, label, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${label} must be a normalized number between 0 and 1.`);
  }
  return parsed;
}

function weightedScore(inputs, weights) {
  if (inputs.some((value) => value === null)) return null;
  return inputs.reduce((score, value, index) => score + value * weights[index], 0);
}

function sourcesAvailable(sources, required) {
  return required.every((source) => sources[source] === true);
}

export function getTier(auctionValue) {
  if (auctionValue === null) return null;
  if (auctionValue >= 40) return 1;
  if (auctionValue >= 25) return 2;
  if (auctionValue >= 10) return 3;
  if (auctionValue >= 5) return 4;
  return 5;
}

function getStrengths({ deployment, production, prospect, keeper }, sources) {
  const strengths = [];
  if (sources.DobberExcel && deployment.ppWeight === 1) strengths.push('PP1 deployment');
  if (sources.DobberExcel && deployment.lineWeight === 1) strengths.push('Top line role');
  if (sources.AHLSheets && production.PPS !== null && production.PPS >= 75) strengths.push('High projected production score');
  if (sources.AHLSheets && keeper.KVS !== null && keeper.KVS >= 75) strengths.push('Strong keeper value');
  if (sources.AHLSheets && prospect.BPS !== null && prospect.BPS >= 75) strengths.push('Breakout candidate');
  return strengths;
}

function getRisks({ deployment, prospect, keeper }, sources) {
  const risks = [];
  if (sources.AHLSheets && deployment.RRS !== null && deployment.RRS >= CLASSIFICATION_THRESHOLDS.highRegressionRisk) {
    risks.push('High regression risk');
  }
  if (sources.AHLSheets && deployment.usageDrop !== null && deployment.usageDrop >= CLASSIFICATION_THRESHOLDS.usageDecline) {
    risks.push('Usage decline');
  }
  if (sources.AHLSheets && deployment.injuryRisk !== null && deployment.injuryRisk >= 0.5) risks.push('Elevated injury risk');
  if (sources.AHLSheets && deployment.ageDecline !== null && deployment.ageDecline >= CLASSIFICATION_THRESHOLDS.agingCurveRisk) {
    risks.push('Aging curve risk');
  }
  if (sources.AHLSheets && keeper.KVS !== null && keeper.KVS < 25 && prospect.BPS !== null) risks.push('Low keeper value');
  return risks;
}

export function getClassification({ auctionValue, tier, regressionRisk, usageDrop, ageDecline }) {
  if (auctionValue === null || tier === null) return 'UNPRICED';
  const band = PRICE_BANDS[tier];
  const midpointTolerance = Math.max(0.5, (band.max - band.min) * CLASSIFICATION_THRESHOLDS.bandMidpointTolerance);
  const aboveMidpoint = auctionValue > band.midpoint;
  const riskIsHigh = regressionRisk !== null && regressionRisk >= CLASSIFICATION_THRESHOLDS.highRegressionRisk;
  const usageDeclining = usageDrop !== null && usageDrop >= CLASSIFICATION_THRESHOLDS.usageDecline;
  const aging = ageDecline !== null && ageDecline >= CLASSIFICATION_THRESHOLDS.agingCurveRisk;

  if (aboveMidpoint && (riskIsHigh || usageDeclining || aging)) return 'RISK';
  if (
    Math.abs(auctionValue - band.midpoint) <= midpointTolerance
    && !riskIsHigh
    && !usageDeclining
    && !aging
  ) return 'FAIR';
  if (aboveMidpoint && regressionRisk !== null && regressionRisk <= CLASSIFICATION_THRESHOLDS.lowRegressionRisk) {
    return 'VALUE';
  }
  return 'FAIR';
}

function getMissingSources(metricValues, dependencySources, sources) {
  const missingSources = {};
  Object.entries(metricValues).forEach(([metric, value]) => {
    if (value !== null) return;
    (dependencySources[metric] || []).forEach((source) => {
      const missingSource = sources[source] === true ? `${source} metric inputs` : source;
      missingSources[missingSource] = true;
    });
  });
  return missingSources;
}

export function calculateRecommendedMaxBid(auctionValue, tier, remainingBudget, openSlots) {
  if (
    !Number.isFinite(auctionValue)
    || !Number.isInteger(tier)
    || tier < 1
    || tier > 5
    || !Number.isFinite(remainingBudget)
    || !Number.isInteger(openSlots)
    || openSlots < 1
  ) return null;

  const teamMaxPossibleBid = remainingBudget - ((openSlots - 1) * LEAGUE_SETTINGS.minimumBid);
  if (teamMaxPossibleBid < LEAGUE_SETTINGS.minimumBid) return null;
  const aggressionFactor = tier === 1 ? 1.3 : tier === 2 ? 1.2 : tier === 3 ? 1.1 : 1;
  const recommended = Math.round(Math.min(auctionValue * aggressionFactor, teamMaxPossibleBid) / 0.5) * 0.5;
  return Math.min(recommended, Math.floor(teamMaxPossibleBid / 0.5) * 0.5);
}

export function getCategoryMultiplier(category, { RSS, BPS, RRS, KVS }) {
  if (!category) return null;
  if (category === 'Veteran') {
    return RSS === null || RRS === null ? null : 1 + (RSS / 100) * 0.03 - (RRS / 100) * 0.02;
  }

  if (category === 'Rookie') {
    return BPS === null || RRS === null ? null : 1 + (BPS / 100) * 0.05 - (RRS / 100) * 0.03;
  }
  return BPS === null || KVS === null || RRS === null
    ? null
    : 1 + (BPS / 100) * 0.1 + (KVS / 100) * 0.1 - (RRS / 100) * 0.05;
}

export function calculateDraftIqScores({ category, PPS, RSS, BPS, RRS, KVS }) {
  const metrics = [PPS, RSS, BPS, RRS, KVS];
  if (metrics.some((value) => !Number.isFinite(value))) {
    return { draftIQ: null, categoryMultiplier: null, adjustedDraftIQ: null };
  }
  const categoryMultiplier = getCategoryMultiplier(category, { RSS, BPS, RRS, KVS });
  if (categoryMultiplier === null) {
    return { draftIQ: null, categoryMultiplier: null, adjustedDraftIQ: null };
  }
  const draftIQ = Math.max(0, Math.min(100,
    (0.45 * PPS) + (0.2 * RSS) + (0.15 * BPS) - (0.1 * RRS) + (0.1 * KVS)));
  return {
    draftIQ,
    categoryMultiplier,
    adjustedDraftIQ: Math.max(0, Math.min(100, draftIQ * categoryMultiplier)),
  };
}

export function calculateAuctionValue(adjustedDraftIQ, scarcityMultiplier, keeperInflation, priceCurveFactor) {
  if (![adjustedDraftIQ, scarcityMultiplier, keeperInflation, priceCurveFactor].every(Number.isFinite)) {
    return null;
  }
  return Math.max(1, Math.min(
    60,
    adjustedDraftIQ * scarcityMultiplier * keeperInflation * priceCurveFactor,
  ));
}

function parseNhlStats(csvText) {
  const [header, ...rows] = parseCsv(csvText);
  if (!header) throw new Error('NHL stats CSV is empty.');

  const index = Object.fromEntries(header.map((name, column) => [name, column]));
  const requiredColumns = [
    'season', 'name', 'position', 'situation', 'games_played', 'icetime',
    'I_F_goals', 'I_F_primaryAssists', 'I_F_secondaryAssists', 'I_F_shotsOnGoal',
  ];
  const missingColumns = requiredColumns.filter((name) => index[name] === undefined);
  if (missingColumns.length) {
    throw new Error(`NHL stats CSV is missing columns: ${missingColumns.join(', ')}`);
  }

  const season = rows.reduce((latest, row) => Math.max(latest, asNumber(row[index.season]) || 0), 0);
  const stats = new Map();

  rows.forEach((row) => {
    if (asNumber(row[index.season]) !== season || row[index.situation]?.toLowerCase() !== 'all') return;
    const name = row[index.name];
    const position = normalizePosition(row[index.position]);
    const key = `${normalizeName(name)}|${position}`;
    if (!name || !position) return;
    stats.set(key, {
      playerId: row[index.playerId] || null,
      name,
      position,
      team: row[index.team] || '',
      season,
      gamesPlayed: asNumber(row[index.games_played]),
      iceTimeSeconds: asNumber(row[index.icetime]),
      goals: asNumber(row[index.I_F_goals]),
      primaryAssists: asNumber(row[index.I_F_primaryAssists]),
      secondaryAssists: asNumber(row[index.I_F_secondaryAssists]),
      shots: asNumber(row[index.I_F_shotsOnGoal]),
      powerPlayIceTimeSeconds: 0,
    });
  });

  rows.forEach((row) => {
    if (asNumber(row[index.season]) !== season) return;
    const situation = String(row[index.situation] || '').toLowerCase();
    if (!/^(5on4|5on3|4on3|4on2)$/.test(situation)) return;
    const key = `${normalizeName(row[index.name])}|${normalizePosition(row[index.position])}`;
    const stat = stats.get(key);
    const seconds = asNumber(row[index.icetime]);
    if (stat && seconds !== null) stat.powerPlayIceTimeSeconds += seconds;
  });

  return { season, stats: [...stats.values()] };
}

function buildScoringInputs(stat) {
  if (!stat) {
    return {
      gamesPlayed: null,
      goals: null,
      assists: null,
      shots: null,
      fantasyPoints: null,
    };
  }

  const assists = (stat.primaryAssists || 0) + (stat.secondaryAssists || 0);

  return {
    gamesPlayed: stat.gamesPlayed,
    goals: stat.goals || 0,
    assists,
    shots: stat.shots || 0,
    fantasyPoints: (stat.goals || 0) * LEAGUE_SETTINGS.scoring.goals
      + assists * LEAGUE_SETTINGS.scoring.assists,
  };
}

function nullable(value) {
  return value === undefined ? null : value;
}

export function buildDraftIntelligence({
  rosterData,
  prospectsData,
  nhlStatsCsv,
  supplementalData = {},
  sourceAvailability = {},
  leagueImportedAt = null,
  generatedAt = new Date().toISOString(),
}) {
  const parsedStats = parseNhlStats(nhlStatsCsv);
  if (!sourceAvailability || typeof sourceAvailability !== 'object' || Array.isArray(sourceAvailability)) {
    throw new Error('Source availability must be an object of boolean flags.');
  }
  Object.entries(sourceAvailability).forEach(([source, available]) => {
    if (!Object.prototype.hasOwnProperty.call(SOURCE_REGISTRY, source)) {
      throw new Error(`Unknown source availability flag: ${source}.`);
    }
    if (typeof available !== 'boolean') {
      throw new Error(`${source} source availability must be true or false.`);
    }
  });
  const sources = { ...SOURCE_REGISTRY, ...sourceAvailability };
  const statsByName = new Map();
  parsedStats.stats.forEach((stat) => {
    const key = normalizeName(stat.name);
    if (!statsByName.has(key)) statsByName.set(key, []);
    statsByName.get(key).push(stat);
  });
  const prospects = Object.values(prospectsData?.prospects || {});
  const prospectByName = new Map(prospects.map((player) => [normalizeName(player.name), player]));
  const rosterPlayers = Object.values(rosterData?.players || {});
  const inputPlayers = rosterPlayers
    .filter((player) => player?.name && !['x', 'n/a', 'na'].includes(normalizeName(player.name)));
  sources.AHLSheets = Boolean(
    (inputPlayers.length > 0 || prospects.length > 0)
    && sourceAvailability.AHLSheets !== false,
  );
  const inventoryByName = new Map(Object.values(rosterData?.sources?.inventory?.players || {})
    .map((player) => [normalizeName(player.name), player]));
  const utilityByName = new Map(Object.values(rosterData?.sources?.utility?.players || {})
    .map((player) => [normalizeName(player.name), player]));
  const rows = inputPlayers.map((player) => {
    const name = String(player.name).trim();
    const inventoryPlayer = inventoryByName.get(normalizeName(name));
    const utilityPlayer = utilityByName.get(normalizeName(name));
    const utilityPosition = utilityPlayer?.poolposition || '';
    const position = normalizePosition(inventoryPlayer?.position || inventoryPlayer?.poolposition)
      || normalizePosition(player.position)
      || normalizePosition(utilityPosition.split('/')[0]);
    const nameStats = statsByName.get(normalizeName(name)) || [];
    const stat = nameStats.find((entry) => entry.position === position)
      || (nameStats.length === 1 ? nameStats[0] : null);
    return {
      player,
      name,
      position,
      utilityPosition,
      stat,
      prospect: prospectByName.get(normalizeName(name)) || null,
    };
  });

  const players = rows.map(({ player, name, position, utilityPosition, stat, prospect }) => {
    const nhl = buildScoringInputs(stat);
    const gamesPlayed = nhl.gamesPlayed;
    const category = normalizeAhlCategory(player.classification, prospect);
    const id = normalizeName(name).replace(/\s+/g, '-');
    const supplied = supplementalData.players?.[id] || supplementalData.players?.[normalizeName(name)] || {};
    const deploymentInput = supplied.deployment || {};
    const productionInput = supplied.production || {};
    const prospectInput = supplied.prospect || {};
    const keeperInput = supplied.keeper || {};
    const lineWeight = normalizedMetric(deploymentInput.lineWeight, `${name}.lineWeight`);
    const ppWeight = normalizedMetric(deploymentInput.ppWeight, `${name}.ppWeight`);
    const toiNorm = normalizedMetric(deploymentInput.toiNorm, `${name}.toiNorm`);
    const ppToiNorm = normalizedMetric(deploymentInput.ppToiNorm, `${name}.ppToiNorm`);
    const lineStability = normalizedMetric(deploymentInput.lineStability, `${name}.lineStability`);
    const ppStability = normalizedMetric(deploymentInput.ppStability, `${name}.ppStability`);
    const injuryRisk = normalizedMetric(deploymentInput.injuryRisk, `${name}.injuryRisk`);
    const depthSafety = normalizedMetric(deploymentInput.depthSafety, `${name}.depthSafety`);
    const gamesNorm = normalizedMetric(deploymentInput.gamesNorm, `${name}.gamesNorm`);
    const opponentWeakness = normalizedMetric(deploymentInput.opponentWeakness, `${name}.opponentWeakness`);
    const homeBoost = normalizedMetric(deploymentInput.homeBoost, `${name}.homeBoost`);
    const restFactor = normalizedMetric(deploymentInput.restFactor, `${name}.restFactor`);
    const shReg = normalizedMetric(deploymentInput.SHreg, `${name}.SHreg`);
    const pdoReg = normalizedMetric(deploymentInput.PDOreg, `${name}.PDOreg`);
    const usageDrop = normalizedMetric(deploymentInput.usageDrop, `${name}.usageDrop`);
    const ageDecline = normalizedMetric(deploymentInput.ageDecline, `${name}.ageDecline`);
    const goalProjNorm = normalizedMetric(productionInput.goalProjNorm, `${name}.goalProjNorm`);
    const assistProjNorm = normalizedMetric(productionInput.assistProjNorm, `${name}.assistProjNorm`);
    const shotNorm = normalizedMetric(productionInput.shotNorm, `${name}.shotNorm`);
    const ppUsageNorm = normalizedMetric(productionInput.ppUsageNorm, `${name}.ppUsageNorm`);
    const consistency = normalizedMetric(productionInput.consistency, `${name}.consistency`);
    const ageCurve = normalizedMetric(prospectInput.ageCurve ?? keeperInput.ageCurve, `${name}.ageCurve`);
    const pedigree = normalizedMetric(prospectInput.pedigree, `${name}.pedigree`);
    const usageTrend = normalizedMetric(prospectInput.usageTrend, `${name}.usageTrend`);
    const shotGrowth = normalizedMetric(prospectInput.shotGrowth, `${name}.shotGrowth`);
    const opportunity = normalizedMetric(prospectInput.opportunity, `${name}.opportunity`);
    const contractSecurity = normalizedMetric(keeperInput.contractSecurity, `${name}.contractSecurity`);
    const orgCommitment = normalizedMetric(keeperInput.orgCommitment, `${name}.orgCommitment`);
    const multiYearProj = normalizedMetric(keeperInput.multiYearProj, `${name}.multiYearProj`);
    const keeperScarcity = normalizedMetric(keeperInput.scarcity, `${name}.keeperScarcity`);
    const deploymentScore = sourcesAvailable(sources, ['AHLSheets', 'DobberExcel'])
      ? weightedScore([lineWeight, ppWeight, toiNorm, ppToiNorm], [25, 25, 25, 25])
      : null;
    const roleSecurityScore = sourcesAvailable(sources, ['AHLSheets', 'DobberExcel'])
      ? weightedScore([
      lineStability,
      ppStability,
      injuryRisk === null ? null : 1 - injuryRisk,
      depthSafety,
    ], [30, 30, 20, 20])
      : null;
    const opportunityScore = sourcesAvailable(sources, ['AHLSheets'])
      ? weightedScore([gamesNorm, opponentWeakness, homeBoost, restFactor], [40, 30, 20, 10])
      : null;
    const regressionRiskScore = sourcesAvailable(sources, ['AHLSheets', 'DobberExcel'])
      ? weightedScore([shReg, pdoReg, usageDrop, ageDecline], [30, 30, 20, 20])
      : null;
    const projectedProductionScore = sourcesAvailable(sources, ['AHLSheets', 'DobberExcel'])
      ? weightedScore([goalProjNorm, assistProjNorm, shotNorm, ppUsageNorm, consistency], [40, 20, 20, 10, 10])
      : null;
    const breakoutProbabilityScore = sourcesAvailable(sources, ['AHLSheets', 'DobberExcel'])
      ? weightedScore([ageCurve, pedigree, usageTrend, shotGrowth, opportunity], [25, 25, 25, 15, 10])
      : null;
    const keeperValueScore = sourcesAvailable(sources, ['AHLSheets'])
      ? weightedScore([ageCurve, contractSecurity, orgCommitment, multiYearProj, keeperScarcity], [25, 25, 20, 20, 10])
      : null;
    const { draftIQ, categoryMultiplier, adjustedDraftIQ } = calculateDraftIqScores({
      category,
      PPS: projectedProductionScore,
      RSS: roleSecurityScore,
      BPS: breakoutProbabilityScore,
      RRS: regressionRiskScore,
      KVS: keeperValueScore,
    });
    const missingSources = getMissingSources({
      DS: deploymentScore,
      RSS: roleSecurityScore,
      OS: opportunityScore,
      RRS: regressionRiskScore,
      PPS: projectedProductionScore,
      BPS: breakoutProbabilityScore,
      KVS: keeperValueScore,
      category,
    }, {
      DS: ['AHLSheets', 'DobberExcel'],
      RSS: ['AHLSheets', 'DobberExcel'],
      OS: ['AHLSheets'],
      RRS: ['AHLSheets', 'DobberExcel'],
      PPS: ['AHLSheets', 'DobberExcel'],
      BPS: ['AHLSheets', 'DobberExcel'],
      KVS: ['AHLSheets'],
      category: ['AHLSheets'],
    }, sources);
    const deployment = {
      DS: deploymentScore,
      RSS: roleSecurityScore,
      OS: opportunityScore,
      RRS: regressionRiskScore,
      toiNorm,
      ppToiNorm,
      lineWeight,
      ppWeight,
      lineStability,
      ppStability,
      injuryRisk,
      depthSafety,
      gamesNorm,
      opponentWeakness,
      homeBoost,
      restFactor,
      SHreg: shReg,
      PDOreg: pdoReg,
      usageDrop,
      ageDecline,
    };
    const production = {
      PPS: projectedProductionScore,
      BPS: breakoutProbabilityScore,
      RRS: regressionRiskScore,
      goalProjNorm,
      assistProjNorm,
      shotNorm,
      ppUsageNorm,
      consistency,
    };
    const prospectMetrics = {
      BPS: breakoutProbabilityScore,
      KVS: keeperValueScore,
      ageCurve,
      pedigree,
      usageTrend,
      shotGrowth,
      opportunity,
    };
    const keeper = {
      KVS: keeperValueScore,
      categoryMultiplier,
      contractSecurity,
      orgCommitment,
      multiYearProjection: multiYearProj,
      scarcity: keeperScarcity,
    };
    return {
      id,
      name,
      team: String(player.nhlteam || stat?.team || ''),
      position: position || null,
      ahlPosition: position || null,
      utilityPosition: utilityPosition || null,
      nhlPosition: null,
      category,
      deployment,
      production,
      prospect: prospectMetrics,
      keeper,
      draftIQ,
      adjustedDraftIQ,
      scarcityMultiplier: null,
      keeperInflation: null,
      priceCurveFactor: null,
      auctionValue: null,
      recommendedMaxBid: null,
      tier: null,
      classification: 'UNPRICED',
      strengths: getStrengths({ deployment, production, prospect: prospectMetrics, keeper }, sources),
      risks: getRisks({ deployment, prospect: prospectMetrics, keeper }, sources),
      sourcesUsed: sources,
      missingSources,
      generatedAt,
      ownership: player.owner || null,
      available: !player.owner
        && !player.retained
        && !player.drafted
        && !(prospect && !prospect.farm && prospect.termRemaining === 0),
      seasonStats: {
        season: parsedStats.season,
        gamesPlayed: nhl.gamesPlayed,
        statMatchStatus: stat ? 'matched' : 'no-nhl-record',
        goals: nhl.goals,
        assists: nhl.assists,
        shots: nhl.shots,
        fantasyPoints: nhl.fantasyPoints,
        iceTimeSeconds: stat?.iceTimeSeconds ?? null,
        powerPlayIceTimeSeconds: stat?.powerPlayIceTimeSeconds ?? null,
        age: null,
        goalieGoalsAgainst: null,
      },
      valuationStatus: adjustedDraftIQ === null ? 'unpriced' : 'partial',
    };
  });

  const playersById = new Map(players.map((player) => [player.id, player]));
  const keeperMap = new Map();
  players.forEach((player) => {
    if (!player.ownership) return;
    keeperMap.set(player.id, {
      id: player.id,
      name: player.name,
      owner: player.ownership,
      team: player.team,
      position: player.position,
      category: player.category,
      currentCost: rosterPlayers.find((entry) => normalizeName(entry.name) === normalizeName(player.name))?.cost ?? null,
      gamesPlayed: player.seasonStats.gamesPlayed,
      matchingRights: false,
    });
  });

  const prospectOutput = prospects.map((prospect) => {
    const id = normalizeName(prospect.name).replace(/\s+/g, '-');
    const player = playersById.get(id) || null;
    const term = prospect.termRemaining;
    return {
      id,
      name: prospect.name,
      owner: prospect.owner || null,
      termRemaining: nullable(term),
      category: player?.category ?? null,
      matchingRights: Boolean(prospect.matchingRights),
      matchingRightsEligible: term === 0 && Boolean(prospect.matchingRights),
      activeRookieEligible: !prospect.farm && Number.isFinite(term) && term > 0,
      gamesPlayed: player?.seasonStats.gamesPlayed ?? null,
      auctionValue: player?.auctionValue ?? null,
      draftIQ: player?.draftIQ ?? null,
    };
  });

  prospectOutput.forEach((prospect) => {
    if (!prospect.owner || keeperMap.has(prospect.id)) return;
    const source = prospects.find((entry) => normalizeName(entry.name) === normalizeName(prospect.name));
    keeperMap.set(prospect.id, {
      id: prospect.id,
      name: prospect.name,
      owner: prospect.owner,
      team: playersById.get(prospect.id)?.team || '',
      position: playersById.get(prospect.id)?.position || null,
      category: prospect.category,
      currentCost: source?.cost ?? null,
      gamesPlayed: prospect.gamesPlayed,
      matchingRights: prospect.matchingRightsEligible,
    });
  });

  const matchingRightsByName = new Map(prospects.map((prospect) => [normalizeName(prospect.name), prospect]));
  for (const [id, keeper] of keeperMap) {
    const rightsRecord = matchingRightsByName.get(normalizeName(keeper.name));
    if (rightsRecord) {
      keeper.matchingRights = rightsRecord.termRemaining === 0 && Boolean(rightsRecord.matchingRights);
    }
    keeperMap.set(id, keeper);
  }

  const missingSources = [
    'Dobber Excel NHL-position inputs',
    'AHL Scores player-level metric inputs',
    'Position-specific roster slot counts for scarcity',
  ];
  const sourceCoverage = {
    ahlSheets: {
      status: 'loaded',
      rosterRecords: rosterPlayers.length,
      prospectRecords: prospects.length,
      importedAt: leagueImportedAt,
    },
    nhlSkaterStats: {
      status: 'loaded',
      season: parsedStats.season,
      playerRecords: parsedStats.stats.length,
      matchedLeaguePlayers: rows.filter(({ stat }) => stat).length,
      unmatchedLeaguePlayers: rows.filter(({ stat }) => !stat).length,
      source: 'Provided NHL 2025-26 skater-stats CSV',
    },
    missingSources,
  };
  const derivedViableCounts = players.reduce((counts, player) => {
    if (player.available && player.position) counts[player.position] = (counts[player.position] || 0) + 1;
    return counts;
  }, {});
  const viablePlayersByPosition = supplementalData.viablePlayersByPosition || derivedViableCounts;
  const rosterSlotsByPosition = supplementalData.rosterSlotsByPosition || {};
  const scarcityIndexes = Object.keys(rosterSlotsByPosition)
    .map((position) => {
      const slots = Number(rosterSlotsByPosition[position]);
      const viable = Number(viablePlayersByPosition[position]);
      return slots > 0 && viable > 0 ? slots / viable : null;
    })
    .filter(Number.isFinite);
  const maxScarcityIndex = scarcityIndexes.length ? Math.max(...scarcityIndexes) : null;
  const rankedPlayers = players
    .filter((player) => player.adjustedDraftIQ !== null)
    .sort((left, right) => right.adjustedDraftIQ - left.adjustedDraftIQ || left.name.localeCompare(right.name));

  rankedPlayers.forEach((player, index) => {
    const rank = index + 1;
    const rankPercentile = rank / rankedPlayers.length;
    const priceCurveFactor = rankPercentile <= 0.05 ? 5
      : rankPercentile <= 0.15 ? 3
        : rankPercentile <= 0.65 ? 1.2
          : 0.3;
    const rosterSlots = Number(rosterSlotsByPosition[player.position]);
    const viablePlayers = Number(viablePlayersByPosition[player.position]);
    const scarcityIndex = rosterSlots > 0 && viablePlayers > 0 ? rosterSlots / viablePlayers : null;
    const scarcityNorm = scarcityIndex !== null && maxScarcityIndex > 0
      ? scarcityIndex / maxScarcityIndex
      : null;
    const scarcityMultiplier = scarcityNorm === null ? null : 1 + (scarcityNorm * 0.2);
    const keeperInflation = player.keeper.KVS === null ? null : 1 + ((player.keeper.KVS / 100) * 0.08);
    const auctionValue = !sources.AHLSheets
      ? null
      : calculateAuctionValue(player.adjustedDraftIQ, scarcityMultiplier, keeperInflation, priceCurveFactor);
    const tier = getTier(auctionValue);

    Object.assign(player, {
      priceCurveRank: rank,
      priceCurvePercentile: rankPercentile,
      priceCurveFactor,
      scarcityIndex,
      scarcityMultiplier,
      keeperInflation,
      auctionValue,
      tier,
      recommendedMaxBid: null,
      classification: getClassification({
        auctionValue,
        tier,
        regressionRisk: player.deployment.RRS,
        usageDrop: player.deployment.usageDrop,
        ageDecline: player.deployment.ageDecline,
      }),
      valuationStatus: auctionValue === null ? 'unpriced' : 'priced',
    });
  });

  players.forEach((player) => {
    if (!sources.AHLSheets) player.missingSources.AHLSheets = true;
    if (!sources.DobberExcel) player.missingSources.DobberExcel = true;
    if (player.scarcityMultiplier === null) player.missingSources['Position scarcity rules'] = true;
    if (player.recommendedMaxBid === null) player.missingSources['Team budget and open slots'] = true;
  });

  const unpricedIds = players.filter((player) => player.auctionValue === null).map((player) => player.id);
  const auctionRows = players.map((player) => ({
    id: player.id,
    name: player.name,
    category: player.category,
    position: player.position,
    draftIQ: player.draftIQ,
    adjustedDraftIQ: player.adjustedDraftIQ,
    scarcityMultiplier: player.scarcityMultiplier,
    keeperInflation: player.keeperInflation,
    priceCurveFactor: player.priceCurveFactor,
    auctionValue: player.auctionValue,
    recommendedMaxBid: player.recommendedMaxBid,
    tier: player.tier,
    classification: player.classification,
    status: player.valuationStatus,
  }));
  const tierGroups = Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [
    tier,
    auctionRows.filter((player) => player.tier === tier).map((player) => player.id),
  ]));

  return {
    'players.json': {
      schemaVersion: DATA_VERSION,
      generatedAt,
      status: 'partial',
      league: LEAGUE_SETTINGS,
      sourceAvailability: sources,
      normalization: {
        productionInputs: 'Projection scores require source-backed projection inputs; historical NHL results are not used as projections.',
        toiInputs: 'Historical NHL ice time is retained as season data and is not used as a projection input.',
        scoreScale: '0-100',
        unavailableInputsRemainNull: true,
        classificationThresholds: CLASSIFICATION_THRESHOLDS,
        priceBands: PRICE_BANDS,
      },
      sourceCoverage,
      players,
    },
    'auction.json': {
      schemaVersion: DATA_VERSION,
      generatedAt,
      status: 'partial',
      league: LEAGUE_SETTINGS,
      sourceAvailability: sources,
      formulas: {
        draftIQ: '0.45*PPS + 0.20*RSS + 0.15*BPS - 0.10*RRS + 0.10*KVS',
        categoryMultipliers: {
          veteran: '1 + ((RSS / 100) * 0.03) - ((RRS / 100) * 0.02)',
          rookie: '1 + ((BPS / 100) * 0.05) - ((RRS / 100) * 0.03)',
          farm: '1 + ((BPS / 100) * 0.10) + ((KVS / 100) * 0.10) - ((RRS / 100) * 0.05)',
        },
        scarcityMultiplier: '1 + (Scarcity_norm * 0.20)',
        keeperInflation: '1 + ((KVS / 100) * 0.08)',
        priceCurve: [
          { rankPercentileMax: 0.05, factor: 5 },
          { rankPercentileMax: 0.15, factor: 3 },
          { rankPercentileMax: 0.65, factor: 1.2 },
          { rankPercentileMax: 1, factor: 0.3 },
        ],
        dollarClamp: { min: 1, max: 60 },
        recommendedMaxBid: 'min(AuctionValue * tier aggression, TeamMaxPossibleBid), rounded to $0.50; TeamMaxPossibleBid = remaining budget - ((open slots - 1) * $0.50)',
        classificationThresholds: CLASSIFICATION_THRESHOLDS,
        priceBandMidpoints: Object.fromEntries(Object.entries(PRICE_BANDS).map(([tier, band]) => [tier, band.midpoint])),
      },
      pricedPlayerCount: players.length - unpricedIds.length,
      rankedPlayerCount: rankedPlayers.length,
      rosterSlotsByPosition,
      viablePlayersByPosition,
      unpricedPlayerCount: unpricedIds.length,
      unpricedPlayerIds: unpricedIds,
      players: auctionRows,
      sourceCoverage,
    },
    'tiers.json': {
      schemaVersion: DATA_VERSION,
      generatedAt,
      status: 'partial',
      sourceAvailability: sources,
      tiers: tierGroups,
      unpricedPlayerIds: unpricedIds,
      thresholds: { 1: 40, 2: 25, 3: 10, 4: 5, 5: 1 },
    },
    'keepers.json': {
      schemaVersion: DATA_VERSION,
      generatedAt,
      status: 'partial',
      sourceAvailability: sources,
      keepers: [...keeperMap.values()].sort((a, b) => a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name)),
      sourceCoverage,
    },
    'prospects.json': {
      schemaVersion: DATA_VERSION,
      generatedAt,
      status: 'partial',
      sourceAvailability: sources,
      prospects: prospectOutput,
      matchingRightsCount: prospectOutput.filter((player) => player.matchingRightsEligible).length,
      sourceCoverage,
    },
  };
}

export { LEAGUE_SETTINGS, normalizeName };
