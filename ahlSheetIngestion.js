import { parseCSVLine } from './rosterParser.js';
import { getRosterPlayerIdentityAliases, normalizeLookupKey } from './liveNhlApi.js';

export const AHL_DRAFT_SPREADSHEET_ID = '1_RbnvnxnMzzwty7jdq8I9SN3mWfp187xKVnyPackzeA';
export const AHL_SCORES_SPREADSHEET_ID = '1FAyJwtHNWjXsnDCehNm1Li-n9pxFN5PvXRdhMokJQ3o';

export const AHL_SHEET_SOURCES = Object.freeze([
  { name: 'AHL Position', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '663280764', datasetType: 'roster', expectedLayout: 'inventory' },
  { name: 'AHL Utility', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '1551984288', datasetType: 'roster', expectedLayout: 'utility' },
  { name: 'AHL Draft', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '1727331506', datasetType: 'roster', expectedLayout: 'retained-grid' },
  { name: 'AHL Budget', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '1727331506', datasetType: 'budget', expectedLayout: 'budget' },
  { name: 'AHL Roster', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '910545566', datasetType: 'roster', expectedLayout: 'league-layout' },
  { name: 'AHL Keeper Rights', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '1065921002', datasetType: 'prospects' },
  { name: 'AHL Scores', spreadsheetId: AHL_SCORES_SPREADSHEET_ID, gid: '0', datasetType: 'scores' },
  { name: 'AHL Scorebulator', spreadsheetId: AHL_SCORES_SPREADSHEET_ID, gid: '1339694329', datasetType: 'scores' },
  { name: 'AHL Games Played', spreadsheetId: AHL_SCORES_SPREADSHEET_ID, gid: '1076930424', datasetType: 'scores' },
]);

export const UTILITY_POSITION_BY_PLAYER = Object.freeze({
  'ryan nugent-hopkins': 'C/L',
  'thomas hertl': 'C/L',
  'rickard rakell': 'C/L',
  'vincent trocheck': 'C/L',
  'pavel zacha': 'C/L',
  'jt miller': 'C/L',
  'roope hintz': 'C/L',
  'mikael granlund': 'C/R',
  'nazem kadri': 'C/R',
  "ryan o'reilly": 'C/R',
  'joel eriksson-ek': 'C/R',
  'pavel buchnevich': 'C/R',
  'matt barzal': 'C/R',
  'john tavares': 'C/R',
  'timo meier': 'R/L',
  'travis konecny': 'R/L',
  'andrei svechnikov': 'R/L',
  'brad marchand': 'R/L',
  'jordan kyrou': 'R/L',
  'jared mccann': 'R/L',
  'mason marchment': 'R/L',
});

function createUnpricedPlayer(name, id, rosterRecord, prospectRecord, currentPlayer, sourceAvailability) {
  const sourcePlayer = { ...(currentPlayer || {}) };
  delete sourcePlayer.localStatus;
  delete sourcePlayer.localAssignmentTeam;
  delete sourcePlayer.localUnassigned;
  const position = rosterRecord?.position || rosterRecord?.poolposition || null;
  const utilityPosition = rosterRecord?.utilityPosition || null;
  const ownership = rosterRecord?.owner || prospectRecord?.owner || null;
  const category = rosterRecord?.classification
    || (prospectRecord?.farm ? 'Farm' : Number(prospectRecord?.termRemaining) > 0 ? 'Rookie' : null)
    || currentPlayer?.category
    || null;
  const missingSources = { 'AHLSheets metric inputs': true };
  if (!sourceAvailability.DobberExcel) missingSources.DobberExcel = true;
  if (currentPlayer?.scarcityMultiplier === null) missingSources['Position scarcity rules'] = true;
  if (currentPlayer?.recommendedMaxBid === null) missingSources['Team budget and open slots'] = true;
  const hasDobberData = sourceAvailability.DobberExcel === true;
  return {
    ...sourcePlayer,
    id,
    name,
    team: rosterRecord?.nhlteam || currentPlayer?.team || '',
    position,
    ahlPosition: position,
    utilityPosition,
    nhlPosition: null,
    category,
    ownership,
    currentCost: rosterRecord?.cost ?? prospectRecord?.cost ?? currentPlayer?.currentCost ?? null,
    keeperCost: rosterRecord?.cost ?? prospectRecord?.cost ?? currentPlayer?.keeperCost ?? null,
    termRemaining: prospectRecord?.termRemaining ?? currentPlayer?.termRemaining ?? null,
    matchingRights: Boolean(prospectRecord?.matchingRights ?? currentPlayer?.matchingRights),
    deployment: hasDobberData
      ? currentPlayer?.deployment || { DS: null, RSS: null, OS: null, RRS: null }
      : { DS: null, RSS: null, OS: null, RRS: null },
    production: hasDobberData ? currentPlayer?.production || { PPS: null } : { PPS: null },
    prospect: hasDobberData ? currentPlayer?.prospect || { BPS: null, KVS: null } : { BPS: null, KVS: null },
    keeper: currentPlayer?.keeper ? { ...currentPlayer.keeper, KVS: currentPlayer.keeper.KVS ?? null } : { KVS: null },
    draftIQ: hasDobberData ? currentPlayer?.draftIQ ?? null : null,
    adjustedDraftIQ: hasDobberData ? currentPlayer?.adjustedDraftIQ ?? null : null,
    scarcityMultiplier: hasDobberData ? currentPlayer?.scarcityMultiplier ?? null : null,
    keeperInflation: hasDobberData ? currentPlayer?.keeperInflation ?? null : null,
    priceCurveFactor: hasDobberData ? currentPlayer?.priceCurveFactor ?? null : null,
    auctionValue: hasDobberData ? currentPlayer?.auctionValue ?? null : null,
    recommendedMaxBid: hasDobberData ? currentPlayer?.recommendedMaxBid ?? null : null,
    tier: hasDobberData ? currentPlayer?.tier ?? null : null,
    classification: hasDobberData ? currentPlayer?.classification || 'UNPRICED' : 'UNPRICED',
    strengths: hasDobberData ? currentPlayer?.strengths || [] : [],
    risks: hasDobberData ? currentPlayer?.risks || [] : [],
    available: currentPlayer?.available ?? !ownership,
    sourcesUsed: sourceAvailability,
    missingSources,
    valuationStatus: currentPlayer?.valuationStatus || 'unpriced',
  };
}

function getSourceRecords(roster, sourceKey) {
  return Object.values(roster?.sources?.[sourceKey]?.players || {});
}

function normalizePoolPosition(value) {
  const position = String(value || '').trim().toUpperCase();
  if (position === 'L') return 'LW';
  if (position === 'R') return 'RW';
  if (position === 'LD' || position === 'RD') return 'D';
  return ['C', 'LW', 'RW', 'D', 'G'].includes(position) ? position : null;
}

function parsePoolPositions(value) {
  return String(value || '')
    .split(/[\/,&\s]+/)
    .map(normalizePoolPosition)
    .filter(Boolean);
}

function hasRightsFlag(record) {
  return [record?.rights, record?.matchingRights, record?.matchingrights, record?.flags?.rights]
    .some((value) => value === true || String(value || '').trim().toUpperCase() === 'Y');
}

export function buildCanonicalAhlPool(positionRows, utilityRows = []) {
  const pool = new Map();
  (positionRows || []).forEach((record) => {
    const name = String(record?.name || '').trim();
    const playerKey = normalizeLookupKey(name);
    if (!playerKey) return;
    const existing = pool.get(playerKey) || {
      playerKey,
      name,
      team: String(record?.nhlteam || record?.team || '').trim(),
      positions: new Set(),
      rights: false,
      flags: {
        fromPositionSheet: false,
        fromUtilitySheet: false,
        primaryPosition: null,
        utilityPositions: [],
        utilityPosition: null,
      },
    };
    const primaryPosition = normalizePoolPosition(record?.position || record?.poolposition);
    if (primaryPosition) {
      existing.positions.add(primaryPosition);
      existing.flags.primaryPosition = existing.flags.primaryPosition || primaryPosition;
    }
    existing.team = existing.team || String(record?.nhlteam || record?.team || '').trim();
    existing.rights ||= hasRightsFlag(record);
    existing.flags.fromPositionSheet = true;
    pool.set(playerKey, existing);
  });

  (utilityRows || []).forEach((record) => {
    const playerKey = normalizeLookupKey(record?.name);
    const existing = pool.get(playerKey);
    if (!existing) return;
    const utilityPositions = parsePoolPositions(record?.poolposition || record?.eligibility || record?.utilityPosition);
    utilityPositions.forEach((position) => existing.positions.add(position));
    existing.flags.utilityPositions = [...new Set([...existing.flags.utilityPositions, ...utilityPositions])];
    existing.flags.utilityPosition = existing.flags.utilityPosition
      || String(record?.poolposition || record?.eligibility || record?.utilityPosition || '').trim()
      || null;
    existing.flags.fromUtilitySheet = true;
    existing.rights ||= hasRightsFlag(record);
  });

  return pool;
}

export function serializeCanonicalAhlPool(pool) {
  const entries = pool instanceof Map ? [...pool] : Object.entries(pool || {});
  return Object.fromEntries(entries.map(([playerKey, player]) => [
    playerKey,
    {
      ...player,
      positions: [...(player.positions instanceof Set ? player.positions : player.positions || [])],
      flags: { ...(player.flags || {}) },
    },
  ]));
}

function getCanonicalPoolEntries(ahlPool) {
  const entries = ahlPool instanceof Map ? [...ahlPool] : Object.entries(ahlPool || {});
  return entries.map(([playerKey, player]) => [
    playerKey,
    {
      ...player,
      positions: player.positions instanceof Set ? player.positions : new Set(player.positions || []),
    },
  ]);
}

function buildAliasRecordMap(records) {
  const aliases = new Map();
  (records || []).forEach((record) => {
    const nameKey = normalizeLookupKey(record.name);
    getRosterPlayerIdentityAliases(record.name).forEach((alias) => {
      if (!aliases.has(alias)) {
        aliases.set(alias, record);
        return;
      }
      const existing = aliases.get(alias);
      if (existing && normalizeLookupKey(existing.name) !== nameKey) aliases.set(alias, null);
    });
  });
  return aliases;
}

function resolveAliasRecord(name, recordsByAlias) {
  const exactName = normalizeLookupKey(name);
  if (recordsByAlias.has(exactName)) return recordsByAlias.get(exactName);
  return getRosterPlayerIdentityAliases(name)
    .map((alias) => recordsByAlias.get(alias))
    .find(Boolean) || null;
}

export function getCanonicalAhlPoolOwnership(stateObj) {
  const poolEntries = getCanonicalPoolEntries(stateObj?.datasets?.ahlPool);
  const aliasesToPoolKeys = new Map();
  poolEntries.forEach(([playerKey, player]) => {
    getRosterPlayerIdentityAliases(player.name).forEach((alias) => {
      const current = aliasesToPoolKeys.get(alias);
      aliasesToPoolKeys.set(alias, current === undefined || current === playerKey ? playerKey : null);
    });
  });

  const ownersByPlayerKey = new Map(poolEntries.map(([playerKey]) => [playerKey, new Set()]));
  const draftedKeys = new Set();
  const assignedKeys = new Set();
  const rightsKeys = new Set();
  const removedKeys = new Set();
  const resolvePoolKey = (name) => getRosterPlayerIdentityAliases(name)
    .map((alias) => aliasesToPoolKeys.get(alias))
    .find(Boolean) || null;
  const markOwner = (record, keySet = null) => {
    const playerKey = resolvePoolKey(record?.name || record?.playerName);
    if (!playerKey) return;
    if (keySet) keySet.add(playerKey);
    const owner = String(record?.owner || record?.team || '').trim();
    if (!owner) return;
    ownersByPlayerKey.get(playerKey).add(owner);
  };

  const prospects = Object.values(stateObj?.datasets?.prospects?.prospects || {});
  const veterans = Object.values(stateObj?.datasets?.veterans?.veterans || {});
  prospects.forEach((record) => {
    markOwner(record);
    if (hasRightsFlag(record) || (record.matchingRights && Number(record.termRemaining) === 0)) {
      const key = resolvePoolKey(record.name);
      if (key) rightsKeys.add(key);
    }
  });
  veterans.forEach((record) => markOwner(record));

  const draftGrid = stateObj?.datasets?.roster?.sources?.['retained-grid']?.players || {};
  Object.values(draftGrid).forEach((record) => markOwner(record, draftedKeys));
  Object.values(stateObj?.datasets?.draft?.players || {}).forEach((record) => markOwner(record, draftedKeys));
  Object.values(stateObj?.datasets?.roster?.sources?.['league-layout']?.players || {})
    .forEach((record) => markOwner(record));

  const assignments = [
    ...Object.values(stateObj?.workingAssignments || {}),
    ...Object.entries(stateObj?.localEdits?.manualAssignments || {}).map(([name, team]) => ({ name, team })),
  ];
  assignments.forEach((record) => markOwner(record, assignedKeys));

  (stateObj?.localEdits?.manualUnassign || []).forEach((name) => {
    const key = resolvePoolKey(name);
    if (!key) return;
    ownersByPlayerKey.get(key).clear();
    draftedKeys.delete(key);
    assignedKeys.delete(key);
  });

  (stateObj?.localEdits?.removedPlayers || []).forEach((name) => {
    const key = resolvePoolKey(name);
    if (key) removedKeys.add(key);
  });

  poolEntries.forEach(([playerKey, player]) => {
    if (player.rights || player.flags?.rights) rightsKeys.add(playerKey);
    const rightsOwner = player.flags?.rightsOwner || player.rightsOwner;
    if (rightsOwner) ownersByPlayerKey.get(playerKey).add(String(rightsOwner).trim());
  });

  return { ownersByPlayerKey, draftedKeys, assignedKeys, rightsKeys, removedKeys };
}

export function buildAvailableAhlPoolKeys(stateObj) {
  const poolEntries = getCanonicalPoolEntries(stateObj?.datasets?.ahlPool);
  const ownership = getCanonicalAhlPoolOwnership(stateObj);
  return new Set(poolEntries
    .filter(([playerKey]) => (
      !ownership.ownersByPlayerKey.get(playerKey)?.size
      && !ownership.draftedKeys.has(playerKey)
      && !ownership.assignedKeys.has(playerKey)
      && !ownership.rightsKeys.has(playerKey)
      && !ownership.removedKeys.has(playerKey)
    ))
    .map(([playerKey]) => playerKey));
}

function clearIneligiblePricing(player) {
  return {
    ...player,
    available: false,
    draftIQ: null,
    adjustedDraftIQ: null,
    scarcityIndex: null,
    scarcityMultiplier: null,
    keeperInflation: null,
    priceCurveRank: null,
    priceCurvePercentile: null,
    priceCurveFactor: null,
    auctionValue: null,
    recommendedMaxBid: null,
    recommendedMaxBidByOwner: {},
    tier: null,
    classification: 'UNPRICED',
    valuationStatus: 'unpriced',
  };
}

export function applyAhlEligibilityToPlayers(players, stateObj) {
  const officialPoolNames = new Set(getCanonicalPoolEntries(stateObj?.datasets?.ahlPool).map(([, player]) => normalizeLookupKey(player.name)));
  return (players || []).map((player) => {
    const status = player.manualOverrideSource
      ? 'not-in-ahl'
      : officialPoolNames.has(normalizeLookupKey(player.name)) ? 'in-ahl' : 'not-in-ahl';
    return status === 'not-in-ahl'
      ? { ...clearIneligiblePricing(player), status }
      : { ...player, status };
  });
}

export function applyAhlEligibility(outputs, stateObj) {
  const players = applyAhlEligibilityToPlayers(outputs?.players?.players, stateObj);
  const unpricedPlayerIds = players.filter((player) => player.auctionValue === null).map((player) => player.id);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const auctionPlayers = (outputs?.auction?.players || []).map((auctionPlayer) => {
    const player = playerById.get(auctionPlayer.id);
    if (!player) return auctionPlayer;
    return {
      ...auctionPlayer,
      draftIQ: player.draftIQ,
      adjustedDraftIQ: player.adjustedDraftIQ,
      scarcityMultiplier: player.scarcityMultiplier,
      priceCurveFactor: player.priceCurveFactor,
      auctionValue: player.auctionValue,
      recommendedMaxBid: player.recommendedMaxBid,
      recommendedMaxBidByOwner: player.recommendedMaxBidByOwner,
      tier: player.tier,
      classification: player.classification,
      status: player.status === 'not-in-ahl' ? 'not-in-ahl' : player.valuationStatus,
    };
  });
  const tiers = Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [
    tier,
    players.filter((player) => player.tier === tier).map((player) => player.id),
  ]));
  return {
    ...outputs,
    players: { ...outputs.players, players },
    auction: {
      ...outputs.auction,
      players: auctionPlayers,
      pricedPlayerCount: auctionPlayers.filter((player) => player.auctionValue !== null).length,
      rankedPlayerCount: auctionPlayers.filter((player) => player.adjustedDraftIQ !== null).length,
      unpricedPlayerCount: unpricedPlayerIds.length,
      unpricedPlayerIds,
    },
    tiers: { ...outputs.tiers, tiers, unpricedPlayerIds },
  };
}

function normalizeBasePosition(value) {
  const position = String(value || '').trim().toUpperCase();
  if (position === 'L') return 'LW';
  if (position === 'R') return 'RW';
  if (position === 'LD' || position === 'RD') return 'D';
  return ['C', 'LW', 'RW', 'D', 'G'].includes(position) ? position : null;
}

function combineFinalPosition(ahlPosition, utilityPosition) {
  return [...new Set([
    ...String(ahlPosition || '').split('/').filter(Boolean),
    ...String(utilityPosition || '').split('/').filter(Boolean),
  ])].join('/') || null;
}

function createMissingPositionOverride(record, currentPlayer, existingOverride) {
  const name = currentPlayer?.name || record.name;
  const nameKey = normalizeLookupKey(name);
  const id = `manual-position-${nameKey.replace(/\s+/g, '-')}`;
  const finalPositionOverride = normalizeBasePosition(existingOverride?.finalPositionOverride || existingOverride?.position);
  const experienceTier = ['Farm', 'Rookie', 'Veteran'].find((tier) => (
    normalizeLookupKey(existingOverride?.experienceTier || existingOverride?.classification || currentPlayer?.category || record.classification) === normalizeLookupKey(tier)
  )) || null;
  return {
    id,
    name,
    position: finalPositionOverride,
    finalPositionOverride,
    classification: experienceTier,
    experienceTier,
    status: 'not-in-ahl',
    pricing: null,
    forecast: null,
    owner: null,
    availability: 'unavailable',
    notes: existingOverride?.notes || 'Missing from the AHL Position sheet; manual review required.',
    createdAt: existingOverride?.createdAt || new Date().toISOString(),
    addedBy: existingOverride?.addedBy || 'AHL Position validation',
    manualOverride: true,
    manualOverrideSource: 'missing-ahl-position',
  };
}

function createManualOverridePlayer(override, currentPlayer, sourceAvailability) {
  return {
    id: override.id,
    name: override.name,
    position: override.finalPositionOverride,
    finalPosition: override.finalPositionOverride,
    finalPositionOverride: override.finalPositionOverride,
    ahlPosition: null,
    utilityPosition: null,
    nhlPosition: null,
    category: override.experienceTier,
    experienceTier: override.experienceTier,
    ownership: null,
    owner: null,
    available: false,
    availability: 'unavailable',
    status: 'not-in-ahl',
    manualOverride: true,
    manualOverrideSource: 'missing-ahl-position',
    localStatus: currentPlayer?.localStatus,
    pricing: null,
    forecast: null,
    draftIQ: null,
    adjustedDraftIQ: null,
    auctionValue: null,
    recommendedMaxBid: null,
    tier: null,
    classification: 'UNPRICED',
    valuationStatus: 'unpriced',
    deployment: { DS: null, RSS: null, OS: null, RRS: null },
    production: { PPS: null },
    prospect: { BPS: null, KVS: null },
    keeper: { KVS: null },
    sourcesUsed: { ...sourceAvailability },
    missingSources: { 'AHL Position manual override': true },
    strengths: [],
    risks: [],
  };
}

function readScoreMetric(row, header, aliases) {
  const columnIndex = header.findIndex((value) => aliases.has(String(value).replace(/[^a-z0-9]/gi, '').toLowerCase()));
  if (columnIndex < 0) return null;
  const value = Number.parseFloat(String(row[columnIndex] || '').replace(/,/g, '').trim());
  return Number.isFinite(value) ? value : null;
}

export function getAhlHistoricalSplits(stateObj, playerName) {
  const nameKey = normalizeLookupKey(playerName);
  const fhAliases = new Set(['fhppg', 'firsthalfppg', '1sthalfppg', 'firsthalfpointspergame']);
  const shAliases = new Set(['shppg', 'secondhalfppg', '2ndhalfppg', 'secondhalfpointspergame']);
  const nameHeaders = new Set(['player', 'playername', 'name', 'skater']);
  for (const tab of Object.values(stateObj?.datasets?.ahlScores?.tabs || {})) {
    const header = tab.rows?.[0] || [];
    const nameIndex = header.findIndex((value) => nameHeaders.has(String(value).replace(/[^a-z0-9]/gi, '').toLowerCase()));
    if (nameIndex < 0) continue;
    const row = tab.rows.slice(1).find((candidate) => (
      normalizeLookupKey(candidate[nameIndex]) === nameKey
    ));
    if (!row) continue;
    return {
      FHPPG: readScoreMetric(row, header, fhAliases),
      SHPPG: readScoreMetric(row, header, shAliases),
      sourceTab: tab.tabName || null,
    };
  }
  return { FHPPG: null, SHPPG: null, sourceTab: null };
}

export function buildAhlDraftIntelligenceOutputs(outputs, stateObj, poolOwnership = null) {
  if (!outputs?.players || !outputs?.auction || !outputs?.tiers || !outputs?.keepers || !outputs?.prospects) {
    throw new Error('All five Draft Intelligence outputs must be loaded before AHL sheet ingestion.');
  }
  const roster = stateObj?.datasets?.roster;
  const positionRecords = getSourceRecords(roster, 'inventory');
  const utilityRecords = getSourceRecords(roster, 'utility');
  if (!positionRecords.length) {
    throw new Error('AHL Position data is empty.');
  }

  const canonicalPool = buildCanonicalAhlPool(positionRecords, utilityRecords);
  if (!canonicalPool.size) {
    throw new Error('AHL Position data did not contain any canonical player records.');
  }
  stateObj.datasets.ahlPool = serializeCanonicalAhlPool(canonicalPool);
  const ownership = poolOwnership?.ownersByPlayerKey instanceof Map
    ? poolOwnership
    : getCanonicalAhlPoolOwnership(stateObj);
  const availableKeys = buildAvailableAhlPoolKeys(stateObj);
  canonicalPool.forEach((player, playerKey) => {
    player.flags.owners = [...(ownership.ownersByPlayerKey.get(playerKey) || [])];
    player.flags.drafted = ownership.draftedKeys.has(playerKey);
    player.flags.assigned = ownership.assignedKeys.has(playerKey);
    player.flags.rights = ownership.rightsKeys.has(playerKey);
    player.flags.removed = ownership.removedKeys.has(playerKey);
    player.flags.available = availableKeys.has(playerKey);
  });
  stateObj.datasets.ahlPool = serializeCanonicalAhlPool(canonicalPool);
  stateObj.datasets.availableKeys = [...availableKeys];

  const positionByAlias = buildAliasRecordMap(positionRecords);
  const positionByKey = new Map(positionRecords.map((record) => [normalizeLookupKey(record.name), record]));
  const rosterByName = new Map(Object.values(roster?.players || {}).map((record) => [normalizeLookupKey(record.name), record]));
  const officialPoolRecords = [
    ...getSourceRecords(roster, 'retained-grid'),
    ...getSourceRecords(roster, 'league-layout'),
  ];
  const prospectRecords = Object.values(stateObj?.datasets?.prospects?.prospects || {});
  const prospectByName = new Map(prospectRecords.map((record) => [normalizeLookupKey(record.name), record]));
  const currentPlayers = outputs.players.players || [];
  const currentByName = new Map(currentPlayers.map((player) => [normalizeLookupKey(player.name), player]));
  const existingOverrides = stateObj?.manualOverrides || [];
  const overrideByName = new Map(existingOverrides.map((override) => [normalizeLookupKey(override.name), override]));
  const sourceAvailability = {
    AHLSheets: true,
    DobberExcel: outputs.players.sourceAvailability?.DobberExcel === true,
  };
  const candidates = new Map();

  canonicalPool.forEach((poolPlayer, key) => {
    const record = positionByKey.get(key);
    if (!record) return;
    const rosterRecord = rosterByName.get(key) || record;
    const prospectRecord = prospectByName.get(key) || null;
    const id = currentByName.get(key)?.id || key.replace(/\s+/g, '-');
    const ahlPosition = poolPlayer.flags.primaryPosition;
    const utilityPosition = poolPlayer.flags.utilityPosition;
    const finalPosition = [...poolPlayer.positions].join('/') || null;
    const owners = [...(ownership.ownersByPlayerKey.get(key) || [])];
    const player = createUnpricedPlayer(
      poolPlayer.name,
      id,
      {
        ...rosterRecord,
        position: finalPosition,
        ahlPosition,
        utilityPosition: utilityPosition || null,
      },
      prospectRecord,
      currentByName.get(key),
      sourceAvailability,
    );
    player.team = poolPlayer.team || player.team;
    player.owner = owners[0] || player.owner || null;
    player.ownership = owners[0] || player.ownership || null;
    player.position = finalPosition;
    player.finalPosition = finalPosition;
    player.ahlPosition = ahlPosition;
    player.utilityPosition = utilityPosition || null;
    player.experienceTier = player.category;
    player.available = availableKeys.has(key);
    player.availability = player.available ? 'available' : 'unavailable';
    player.historicalSplits = getAhlHistoricalSplits(stateObj, player.name);
    player.nhlPosition = null;
    player.sourcesUsed = { ...sourceAvailability };
    player.status = 'in-ahl';
    candidates.set(key, player);
  });

  const manualOverrideRecords = [];
  const manualOverridePlayers = [];
  const processedOverrides = new Set();
  officialPoolRecords.forEach((record) => {
    if (resolveAliasRecord(record.name, positionByAlias)) return;
    const player = resolveAliasRecord(record.name, buildAliasRecordMap(currentPlayers));
    const name = player?.name || record.name;
    const key = normalizeLookupKey(name);
    if (!key || processedOverrides.has(key)) return;
    processedOverrides.add(key);
    const override = createMissingPositionOverride(record, player, overrideByName.get(key));
    manualOverrideRecords.push(override);
    manualOverridePlayers.push(createManualOverridePlayer(override, player, sourceAvailability));
  });

  const players = [...candidates.values()].sort((left, right) => left.name.localeCompare(right.name));
  players.push(...manualOverridePlayers);
  players.sort((left, right) => left.name.localeCompare(right.name));
  const playerIds = new Set(players.map((player) => player.id));
  const unpricedPlayerIds = players.filter((player) => player.auctionValue === null).map((player) => player.id);
  const sourceCoverage = {
    ...(outputs.players.sourceCoverage?.nhlSkaterStats
      ? { nhlSkaterStats: outputs.players.sourceCoverage.nhlSkaterStats }
      : {}),
    missingSources: [
      'Dobber Excel NHL-position inputs',
      'AHL Scores player-level metric inputs',
      'Position-specific roster slot counts for scarcity',
    ],
    ahlSheets: {
      status: 'loaded',
      positionRecords: positionRecords.length,
      utilityRecords: utilityRecords.length,
      rosterRecords: Object.keys(roster?.players || {}).length,
      keeperRecords: prospectRecords.length,
      scoreTabs: Object.keys(stateObj?.datasets?.ahlScores?.tabs || {}),
      importedAt: stateObj?.metadata?.ahlSheets?.importedAt || null,
    },
  };
  const playerOutput = {
    ...outputs.players,
    sourceAvailability,
    sourceCoverage,
    players,
  };
  const auctionPlayers = players.map((player) => ({
    id: player.id,
    name: player.name,
    category: player.category,
    position: player.position,
    finalPosition: player.finalPosition,
    ahlPosition: player.ahlPosition,
    utilityPosition: player.utilityPosition,
    draftIQ: player.draftIQ,
    adjustedDraftIQ: player.adjustedDraftIQ,
    scarcityMultiplier: player.scarcityMultiplier,
    keeperInflation: player.keeperInflation,
    priceCurveFactor: player.priceCurveFactor,
    auctionValue: player.auctionValue,
    recommendedMaxBid: player.recommendedMaxBid,
    tier: player.tier,
    classification: player.classification,
    status: player.status === 'not-in-ahl' ? 'not-in-ahl' : player.valuationStatus,
  }));
  const tierGroups = Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [
    tier,
    players.filter((player) => player.tier === tier).map((player) => player.id),
  ]));
  const keepers = players
    .filter((player) => player.ownership)
    .map((player) => ({
      id: player.id,
      name: player.name,
      owner: player.ownership,
      team: player.team,
      position: player.position,
      finalPosition: player.finalPosition,
      ahlPosition: player.ahlPosition,
      utilityPosition: player.utilityPosition,
      category: player.category,
      currentCost: player.keeperCost,
      termRemaining: player.termRemaining,
      gamesPlayed: null,
      matchingRights: player.matchingRights,
    }));
  const prospects = prospectRecords.map((record) => {
    const player = candidates.get(normalizeLookupKey(record.name));
    return {
      ...record,
      id: player?.id || normalizeLookupKey(record.name).replace(/\s+/g, '-'),
      owner: record.owner || player?.ownership || null,
      category: player?.category || null,
      position: player?.finalPosition || null,
      finalPosition: player?.finalPosition || null,
      ahlPosition: player?.ahlPosition || null,
      utilityPosition: player?.utilityPosition || null,
      nhlPosition: null,
      activeRookieEligible: !record.farm && Number.isFinite(record.termRemaining) && record.termRemaining > 0,
      matchingRightsEligible: record.termRemaining === 0 && Boolean(record.matchingRights),
      available: player?.available || false,
    };
  });

  return {
    ...outputs,
    missingPositionOverrides: manualOverrideRecords,
    players: playerOutput,
    auction: {
      ...outputs.auction,
      sourceAvailability,
      sourceCoverage,
      players: auctionPlayers,
      pricedPlayerCount: auctionPlayers.filter((player) => player.auctionValue !== null).length,
      rankedPlayerCount: auctionPlayers.filter((player) => player.adjustedDraftIQ !== null).length,
      unpricedPlayerCount: unpricedPlayerIds.length,
      unpricedPlayerIds,
    },
    tiers: {
      ...outputs.tiers,
      sourceAvailability,
      tiers: tierGroups,
      unpricedPlayerIds,
    },
    keepers: {
      ...outputs.keepers,
      sourceAvailability,
      sourceCoverage,
      keepers,
    },
    prospects: {
      ...outputs.prospects,
      sourceAvailability,
      sourceCoverage,
      prospects,
      matchingRightsCount: prospects.filter((player) => player.matchingRightsEligible).length,
    },
  };
}

export function parseAhlScoreSheet(csvText, tabName) {
  const rows = String(csvText || '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map(parseCSVLine);
  if (!rows.length) {
    throw new Error(`${tabName} sheet is empty.`);
  }
  return {
    tabName,
    rows,
    importedAt: new Date().toISOString(),
  };
}
