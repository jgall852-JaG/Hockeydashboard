const DATA_VERSION = 1;
const LEAGUE_SETTINGS = Object.freeze({
  budget: 250,
  rosterSlots: 25,
  scoring: { goals: 1, assists: 0.5, goalsAgainst: -0.5 },
  categories: { veteranMinGames: 82, rookieMinGames: 9, farmMaxGames: 8 },
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

function maxNormalize(value, maximum) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return null;
  return Math.max(0, Math.min(1, value / maximum));
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

function getCategoryMultiplier(category, { RSS, BPS, RRS, KVS }) {
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

function classifyPlayer(gamesPlayed, prospect) {
  if (prospect?.farm || gamesPlayed < LEAGUE_SETTINGS.categories.rookieMinGames) return 'Farm';
  if (gamesPlayed < LEAGUE_SETTINGS.categories.veteranMinGames) return 'Rookie';
  return 'Veteran';
}

function buildScoringInputs(stat, maxima) {
  if (!stat || !stat.gamesPlayed || stat.gamesPlayed < 0) {
    return {
      gamesPlayed: stat?.gamesPlayed ?? null,
      goals: stat?.goals ?? null,
      assists: stat ? (stat.primaryAssists || 0) + (stat.secondaryAssists || 0) : null,
      shots: stat?.shots ?? null,
      fantasyPoints: null,
      toiNorm: null,
      ppToiNorm: null,
      goalProjNorm: null,
      assistProjNorm: null,
      shotNorm: null,
      ppUsageNorm: null,
    };
  }

  const assists = (stat.primaryAssists || 0) + (stat.secondaryAssists || 0);
  const games = stat.gamesPlayed;
  const goalsPerGame = (stat.goals || 0) / games;
  const assistsPerGame = assists / games;
  const shotsPerGame = (stat.shots || 0) / games;
  const toiPerGame = (stat.iceTimeSeconds || 0) / games;
  const ppToiPerGame = stat.powerPlayIceTimeSeconds / games;

  return {
    gamesPlayed: games,
    goals: stat.goals || 0,
    assists,
    shots: stat.shots || 0,
    fantasyPoints: (stat.goals || 0) * LEAGUE_SETTINGS.scoring.goals
      + assists * LEAGUE_SETTINGS.scoring.assists,
    toiNorm: maxNormalize(toiPerGame, maxima.toiPerGame),
    ppToiNorm: maxNormalize(ppToiPerGame, maxima.ppToiPerGame),
    goalProjNorm: maxNormalize(goalsPerGame, maxima.goalsPerGame),
    assistProjNorm: maxNormalize(assistsPerGame, maxima.assistsPerGame),
    shotNorm: maxNormalize(shotsPerGame, maxima.shotsPerGame),
    ppUsageNorm: maxNormalize(ppToiPerGame, maxima.ppToiPerGame),
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
  leagueImportedAt = null,
  generatedAt = new Date().toISOString(),
}) {
  const parsedStats = parseNhlStats(nhlStatsCsv);
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
  const rows = inputPlayers.map((player) => {
    const name = String(player.name).trim();
    const position = normalizePosition(player.poolposition || player.position);
    const nameStats = statsByName.get(normalizeName(name)) || [];
    const stat = nameStats.find((entry) => entry.position === position)
      || (nameStats.length === 1 ? nameStats[0] : null);
    return { player, name, position, stat, prospect: prospectByName.get(normalizeName(name)) || null };
  });

  const maxima = {
    toiPerGame: Math.max(0, ...rows.map(({ stat }) => stat?.gamesPlayed ? (stat.iceTimeSeconds || 0) / stat.gamesPlayed : 0)),
    ppToiPerGame: Math.max(0, ...rows.map(({ stat }) => stat?.gamesPlayed ? stat.powerPlayIceTimeSeconds / stat.gamesPlayed : 0)),
    goalsPerGame: Math.max(0, ...rows.map(({ stat }) => stat?.gamesPlayed ? (stat.goals || 0) / stat.gamesPlayed : 0)),
    assistsPerGame: Math.max(0, ...rows.map(({ stat }) => stat?.gamesPlayed
      ? ((stat.primaryAssists || 0) + (stat.secondaryAssists || 0)) / stat.gamesPlayed : 0)),
    shotsPerGame: Math.max(0, ...rows.map(({ stat }) => stat?.gamesPlayed ? (stat.shots || 0) / stat.gamesPlayed : 0)),
  };

  const players = rows.map(({ player, name, position, stat, prospect }) => {
    const nhl = buildScoringInputs(stat, maxima);
    const gamesPlayed = nhl.gamesPlayed ?? 0;
    const category = classifyPlayer(gamesPlayed, prospect);
    const id = normalizeName(name).replace(/\s+/g, '-');
    const supplied = supplementalData.players?.[id] || supplementalData.players?.[normalizeName(name)] || {};
    const deploymentInput = supplied.deployment || {};
    const productionInput = supplied.production || {};
    const prospectInput = supplied.prospect || {};
    const keeperInput = supplied.keeper || {};
    const lineWeight = normalizedMetric(deploymentInput.lineWeight, `${name}.lineWeight`);
    const ppWeight = normalizedMetric(deploymentInput.ppWeight, `${name}.ppWeight`);
    const toiNorm = normalizedMetric(deploymentInput.toiNorm, `${name}.toiNorm`, nhl.toiNorm);
    const ppToiNorm = normalizedMetric(deploymentInput.ppToiNorm, `${name}.ppToiNorm`, nhl.ppToiNorm);
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
    const goalProjNorm = normalizedMetric(productionInput.goalProjNorm, `${name}.goalProjNorm`, nhl.goalProjNorm);
    const assistProjNorm = normalizedMetric(productionInput.assistProjNorm, `${name}.assistProjNorm`, nhl.assistProjNorm);
    const shotNorm = normalizedMetric(productionInput.shotNorm, `${name}.shotNorm`, nhl.shotNorm);
    const ppUsageNorm = normalizedMetric(productionInput.ppUsageNorm, `${name}.ppUsageNorm`, nhl.ppUsageNorm);
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
    const deploymentScore = weightedScore([lineWeight, ppWeight, toiNorm, ppToiNorm], [25, 25, 25, 25]);
    const roleSecurityScore = weightedScore([
      lineStability,
      ppStability,
      injuryRisk === null ? null : 1 - injuryRisk,
      depthSafety,
    ], [30, 30, 20, 20]);
    const opportunityScore = weightedScore(
      [gamesNorm, opponentWeakness, homeBoost, restFactor],
      [40, 30, 20, 10],
    );
    const regressionRiskScore = weightedScore([shReg, pdoReg, usageDrop, ageDecline], [30, 30, 20, 20]);
    const projectedProductionScore = weightedScore(
      [goalProjNorm, assistProjNorm, shotNorm, ppUsageNorm, consistency],
      [40, 20, 20, 10, 10],
    );
    const breakoutProbabilityScore = weightedScore(
      [ageCurve, pedigree, usageTrend, shotGrowth, opportunity],
      [25, 25, 25, 15, 10],
    );
    const keeperValueScore = weightedScore(
      [ageCurve, contractSecurity, orgCommitment, multiYearProj, keeperScarcity],
      [25, 25, 20, 20, 10],
    );
    const categoryMultiplier = getCategoryMultiplier(category, {
      RSS: roleSecurityScore,
      BPS: breakoutProbabilityScore,
      RRS: regressionRiskScore,
      KVS: keeperValueScore,
    });
    const draftIQ = weightedScore([
      projectedProductionScore,
      roleSecurityScore,
      breakoutProbabilityScore,
      regressionRiskScore,
      keeperValueScore,
    ], [0.45, 0.2, 0.15, 0.1, 0.1]);
    const adjustedDraftIQ = draftIQ === null || categoryMultiplier === null
      ? null
      : draftIQ * categoryMultiplier;
    return {
      id,
      name,
      team: String(player.nhlteam || stat?.team || ''),
      position: position || stat?.position || null,
      category,
      deployment: {
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
      },
      production: {
        PPS: projectedProductionScore,
        BPS: breakoutProbabilityScore,
        RRS: regressionRiskScore,
        goalProjNorm,
        assistProjNorm,
        shotNorm,
        ppUsageNorm,
        consistency,
      },
      prospect: {
        BPS: breakoutProbabilityScore,
        KVS: keeperValueScore,
        ageCurve,
        pedigree,
        usageTrend,
        shotGrowth,
        opportunity,
      },
      keeper: {
        KVS: keeperValueScore,
        categoryMultiplier,
        contractSecurity,
        orgCommitment,
        multiYearProjection: multiYearProj,
        scarcity: keeperScarcity,
      },
      draftIQ,
      adjustedDraftIQ,
      auctionValue: null,
      tier: null,
      ownership: player.owner || null,
      available: !player.owner
        && !player.retained
        && !player.drafted
        && !(prospect && !prospect.farm && prospect.termRemaining === 0),
      seasonStats: {
        season: parsedStats.season,
        gamesPlayed: nhl.gamesPlayed,
        statMatchStatus: stat ? 'matched' : 'no-nhl-record-assumed-zero-games',
        goals: nhl.goals,
        assists: nhl.assists,
        shots: nhl.shots,
        fantasyPoints: nhl.fantasyPoints,
        iceTimeSeconds: stat?.iceTimeSeconds ?? null,
        powerPlayIceTimeSeconds: stat?.powerPlayIceTimeSeconds ?? null,
        age: null,
        goalieGoalsAgainst: null,
      },
      valuationStatus: adjustedDraftIQ === null ? 'unpriced-missing-source-inputs' : 'awaiting-auction-inputs',
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
      category: player?.category || 'Farm',
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
    'Sportradar depth charts, injuries, and usage trends',
    'BigBallsData player/team metrics',
    'DailyFaceoff lines, power-play units, starters, and injuries',
    'Dobber Fantasy Guide deployment and sleeper/bust data',
    'Dobber Prospect Report pedigree and breakout data',
    'AHL farm development and keeper-score inputs',
    'NHL goalie/team GA and per-game consistency data',
    'NHL age data',
    'Position-specific roster slot counts for scarcity',
  ];
  const sourceCoverage = {
    liveLeagueSheet: {
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
    const auctionValue = scarcityMultiplier === null || keeperInflation === null
      ? null
      : Math.max(1, Math.min(60, player.adjustedDraftIQ * scarcityMultiplier * keeperInflation * priceCurveFactor));
    const tier = auctionValue === null ? null
      : auctionValue >= 40 ? 1
        : auctionValue >= 25 ? 2
          : auctionValue >= 10 ? 3
            : auctionValue >= 5 ? 4
              : 5;

    Object.assign(player, {
      priceCurveRank: rank,
      priceCurvePercentile: rankPercentile,
      priceCurveFactor,
      scarcityIndex,
      scarcityMultiplier,
      keeperInflation,
      auctionValue,
      tier,
      valuationStatus: auctionValue === null ? 'unpriced-missing-auction-inputs' : 'priced',
    });
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
    tier: player.tier,
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
      normalization: {
        productionRateInputs: 'Actual per-game 2025-26 NHL rates are used as normalized production proxies, divided by each maximum among matched league players and clamped to 0-1; these are not forecasts.',
        toiInputs: 'Per-game 2025-26 seconds, divided by the maximum among matched league players and clamped to 0-1.',
        scoreScale: '0-100',
        unavailableInputsRemainNull: true,
      },
      sourceCoverage,
      players,
    },
    'auction.json': {
      schemaVersion: DATA_VERSION,
      generatedAt,
      status: 'partial',
      league: LEAGUE_SETTINGS,
      formulas: {
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
      tiers: tierGroups,
      unpricedPlayerIds: unpricedIds,
      thresholds: { 1: 40, 2: 25, 3: 10, 4: 5, 5: 1 },
    },
    'keepers.json': {
      schemaVersion: DATA_VERSION,
      generatedAt,
      status: 'partial',
      keepers: [...keeperMap.values()].sort((a, b) => a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name)),
      sourceCoverage,
    },
    'prospects.json': {
      schemaVersion: DATA_VERSION,
      generatedAt,
      status: 'partial',
      prospects: prospectOutput,
      matchingRightsCount: prospectOutput.filter((player) => player.matchingRightsEligible).length,
      sourceCoverage,
    },
  };
}

export { LEAGUE_SETTINGS, normalizeName };
