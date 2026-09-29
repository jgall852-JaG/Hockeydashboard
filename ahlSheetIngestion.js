import { parseCSVLine } from './rosterParser.js';
import { normalizeLookupKey } from './liveNhlApi.js';

export const AHL_DRAFT_SPREADSHEET_ID = '1_RbnvnxnMzzwty7jdq8I9SN3mWfp187xKVnyPackzeA';
export const AHL_SCORES_SPREADSHEET_ID = '1FAyJwtHNWjXsnDCehNm1Li-n9pxFN5PvXRdhMokJQ3o';

export const AHL_SHEET_SOURCES = Object.freeze([
  { name: 'AHL Position', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '663280764', datasetType: 'roster', expectedLayout: 'inventory' },
  { name: 'AHL Utility', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '1551984288', datasetType: 'roster', expectedLayout: 'utility' },
  { name: 'AHL Draft', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '1727331506', datasetType: 'roster', expectedLayout: 'retained-grid' },
  { name: 'AHL Roster', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '910545566', datasetType: 'roster', expectedLayout: 'league-layout' },
  { name: 'AHL Keeper Rights', spreadsheetId: AHL_DRAFT_SPREADSHEET_ID, gid: '1065921002', datasetType: 'prospects' },
  { name: 'AHL Scores', spreadsheetId: AHL_SCORES_SPREADSHEET_ID, gid: '0', datasetType: 'scores' },
  { name: 'AHL Scorebulator', spreadsheetId: AHL_SCORES_SPREADSHEET_ID, gid: '1339694329', datasetType: 'scores' },
  { name: 'AHL Games Played', spreadsheetId: AHL_SCORES_SPREADSHEET_ID, gid: '1076930424', datasetType: 'scores' },
]);

function createUnpricedPlayer(name, id, rosterRecord, prospectRecord, currentPlayer, sourceAvailability) {
  const position = rosterRecord?.position || rosterRecord?.poolposition || null;
  const utilityPosition = rosterRecord?.utilityPosition || null;
  const ownership = rosterRecord?.owner || prospectRecord?.owner || null;
  const category = rosterRecord?.classification
    || (prospectRecord?.farm ? 'Farm' : Number(prospectRecord?.termRemaining) > 0 ? 'Rookie' : null);
  const missingSources = { 'AHLSheets metric inputs': true };
  if (!sourceAvailability.DobberExcel) missingSources.DobberExcel = true;
  if (currentPlayer?.scarcityMultiplier === null) missingSources['Position scarcity rules'] = true;
  if (currentPlayer?.recommendedMaxBid === null) missingSources['Team budget and open slots'] = true;
  const hasDobberData = sourceAvailability.DobberExcel === true;
  return {
    ...(currentPlayer || {}),
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

export function buildAhlDraftIntelligenceOutputs(outputs, stateObj, availablePlayers = []) {
  if (!outputs?.players || !outputs?.auction || !outputs?.tiers || !outputs?.keepers || !outputs?.prospects) {
    throw new Error('All five Draft Intelligence outputs must be loaded before AHL sheet ingestion.');
  }
  const roster = stateObj?.datasets?.roster;
  const positionRecords = getSourceRecords(roster, 'inventory');
  const utilityRecords = getSourceRecords(roster, 'utility');
  if (!positionRecords.length && !utilityRecords.length) {
    throw new Error('AHL Position and AHL Utility data are both empty.');
  }

  const utilityByName = new Map(utilityRecords.map((record) => [normalizeLookupKey(record.name), record]));
  const positionByName = new Map(positionRecords.map((record) => [normalizeLookupKey(record.name), record]));
  const rosterByName = new Map(Object.values(roster?.players || {}).map((record) => [normalizeLookupKey(record.name), record]));
  const prospectRecords = Object.values(stateObj?.datasets?.prospects?.prospects || {});
  const prospectByName = new Map(prospectRecords.map((record) => [normalizeLookupKey(record.name), record]));
  const availableNames = new Set(availablePlayers.map((record) => normalizeLookupKey(record.name)));
  const currentPlayers = outputs.players.players || [];
  const currentByName = new Map(currentPlayers.map((player) => [normalizeLookupKey(player.name), player]));
  const sourceAvailability = {
    AHLSheets: true,
    DobberExcel: outputs.players.sourceAvailability?.DobberExcel === true,
  };
  const candidates = new Map();

  [...positionRecords, ...utilityRecords].forEach((record) => {
    const key = normalizeLookupKey(record.name);
    if (!key) return;
    const utilityRecord = utilityByName.get(key);
    const positionRecord = positionByName.get(key);
    const rosterRecord = rosterByName.get(key) || record;
    const prospectRecord = prospectByName.get(key) || null;
    const id = currentByName.get(key)?.id || key.replace(/\s+/g, '-');
    const player = createUnpricedPlayer(
      positionRecord?.name || utilityRecord?.name || record.name,
      id,
      {
        ...rosterRecord,
        position: positionRecord?.position || positionRecord?.poolposition || null,
        utilityPosition: utilityRecord?.poolposition || null,
      },
      prospectRecord,
      currentByName.get(key),
      sourceAvailability,
    );
    player.available = availableNames.has(key);
    player.nhlPosition = null;
    player.sourcesUsed = { ...sourceAvailability };
    candidates.set(key, player);
  });

  const players = [...candidates.values()].sort((left, right) => left.name.localeCompare(right.name));
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
      position: player?.position || null,
      utilityPosition: player?.utilityPosition || null,
      nhlPosition: null,
      activeRookieEligible: !record.farm && Number.isFinite(record.termRemaining) && record.termRemaining > 0,
      matchingRightsEligible: record.termRemaining === 0 && Boolean(record.matchingRights),
      available: player?.available || false,
    };
  });

  return {
    ...outputs,
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
