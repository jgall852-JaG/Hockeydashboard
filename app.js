import { parseProspects } from './prospectParser.js';
import { parseVeterans } from './veteranParser.js';
import { parseAhlBudgetSheet, parseRoster } from './rosterParser.js';
import { getExperienceTierFromGames, renderDraftAuctionDashboard } from './draftAuctionUI.js';
import {
  AHL_SHEET_SOURCES,
  applyAhlEligibility,
  applyAhlEligibilityToPlayers,
  buildAhlDraftIntelligenceOutputs,
  parseAhlScoreSheet,
} from './ahlSheetIngestion.js';
import {
  addPersonalDraftListEntry,
  normalizePersonalDraftList,
  removePersonalDraftListEntry,
  setPersonalDraftListRank,
  updatePersonalDraftListEntry,
} from './personalDraftList.js';
import { loadAhlSnapshot, saveAhlSnapshot } from './offlineSnapshotStore.js';
import {
  applyLocalDraftEdits,
  createEmptyLocalEdits,
  detectLocalEditMismatches,
  normalizeLocalEdits,
} from './localDraftEdits.js';
import {
  applyDobberIntelligence,
  attachDobberIntel,
  DOBBER_EXCEL_URL,
  DOBBER_GUIDE_PDF_URL,
  DOBBER_PROSPECTS_PDF_URL,
  fetchDobberPdfIntel,
  fetchDobberWorkbook,
  ingestDobberExcelFile,
  ingestDobberPdfFiles,
  updateDobberImportMetadata,
} from './dobberIngestion.js';
import {
  loadLiveCache,
  persistLiveCache,
  resolveLivePlayerProfile,
  normalizeLookupKey,
  getRosterPlayerIdentityAliases,
  pickRecordValue,
  extractTeamAbbrev,
} from './liveNhlApi.js';
import {
  NA_HISTORICAL_BID_STATS,
  getHistoricalBidStats,
  loadAhlHistoricalBids,
} from './ahlHistoricalBids.js';

const STORAGE_KEY = 'hockey-dashboard-owner-view';
const APP_STATE_VERSION = 2;
const PORTABLE_STATE_VERSION = 1;
const MAX_PREVIEW_ROWS = 10;
const DRAFT_ROSTER_RULES = Object.freeze({
  minSlotCost: 0.5,
  targetSkaters: 23,
  targetGoalieTeams: 2,
});
const GOALIE_TEAM_CITY_KEYS = new Set([
  'anaheim',
  'boston',
  'buffalo',
  'calgary',
  'carolina',
  'chicago',
  'colorado',
  'columbus',
  'dallas',
  'detroit',
  'edmonton',
  'florida',
  'los angeles',
  'minnesota',
  'montreal',
  'nashville',
  'new jersey',
  'new york',
  'ottawa',
  'philadelphia',
  'pittsburgh',
  'san jose',
  'seattle',
  'st louis',
  'tampa bay',
  'toronto',
  'utah',
  'vancouver',
  'vegas',
  'washington',
  'winnipeg',
]);
const SKATER_POSITION_KEYS = new Set(['c', 'l', 'lw', 'r', 'rw', 'd', 'ld', 'rd', 'f']);
const GOALIE_TEAM_POSITION_KEYS = new Set(['g', 'goalie', 'goalieteam', 'goalie team', 'team goalie', 'gt']);

const state = {
  importedData: null,
  selectedOwner: null,
  previewRows: [],
  ownerSearch: '',
  playerSearch: '',
  availablePlayerSearch: '',
  showAllAvailablePlayers: false,
  activeDashboardTab: 'draft-board',
  manualOverrides: [],
  selectedPlayerKey: null,
  liveCache: loadLiveCache(),
  liveProfiles: {},
  liveRequests: {},
  draftGpAttempted: new Set(),
  draftGpLoading: false,
  liveRefreshMessage: '',
  draftIntelligence: null,
  draftIntelligenceFromOfflineSnapshot: false,
  shortlist: new Set(),
  shortlistStorageError: '',
  draftBoardSearch: '',
  draftPositionFilter: '',
  bestPositionFilter: '',
  draftCategoryFilter: '',
  bestAvailableSort: 'ADP',
  showRemovedPlayers: false,
  highlightUnavailablePlayers: false,
  selectedDraftPlayerId: null,
  selectedDraftTeam: '',
  draftIntelligenceStorageError: '',
  personalDraftListStorageError: '',
  personalDraftList: [],
  personalDraftListSort: 'rank',
  personalDraftPositionFilter: '',
  personalDraftCategoryFilter: '',
  personalDraftAvailabilityFilter: 'all',
};

export async function loadDraftIntelligenceFiles(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch is unavailable for Draft Intelligence files.');
  }

  const filenames = ['players.json', 'auction.json', 'tiers.json', 'keepers.json', 'prospects.json'];
  const entries = await Promise.all(filenames.map(async (filename) => {
    const response = await fetchImpl(`./data/${filename}`);
    if (!response.ok) {
      throw new Error(`Unable to load Draft Intelligence ${filename} (${response.status}).`);
    }
    return [filename.replace('.json', ''), await response.json()];
  }));

  return Object.fromEntries(entries);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

const DATASET_NAMES = Object.freeze([
  'prospects',
  'veterans',
  'roster',
  'transactions',
  'positions',
  'utility',
  'draft',
  'budget',
  'dobber',
  'ahlScores',
]);

function createEmptyDatasets() {
  return Object.fromEntries(DATASET_NAMES.map((name) => [name, null]));
}

function createEmptyMetadata() {
  return {
    ...Object.fromEntries(DATASET_NAMES.map((name) => [name, { status: 'empty' }])),
    ahlSheets: { status: 'empty' },
    dobberStatus: 'unavailable',
  };
}

function parseDraftBoard(csvText) {
  const rows = String(csvText || '').split(/\r?\n/).filter((row) => row.trim()).map(parseCSVLine);
  const players = {};
  let teams = [];

  rows.forEach((row, index) => {
    if (row[0] === '#') {
      const teamRow = rows[index - 1] || [];
      teams = [];
      for (let column = 0; column < row.length; column += 4) {
        teams.push(String(teamRow[column] || '').trim());
      }
      return;
    }

    if (!teams.length) return;

    for (let group = 0; group < teams.length; group += 1) {
      const column = group * 4;
      const pick = String(row[column] || '').trim();
      const name = String(row[column + 1] || '').trim();
      if (!name || ['PLAYER NAME', 'TOTAL SPENT', 'BALANCE'].includes(name.toUpperCase())) continue;

      const key = `${normalizeLookupKey(name)}-${teams[group].toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${pick || 'drafted'}`;
      players[key] = {
        name,
        owner: teams[group],
        position: String(row[column + 2] || '').trim(),
        cost: row[column + 3] || '',
        pick: /^\d+$/.test(pick) ? Number(pick) : null,
        source: 'draft',
      };
    }
  });

  return { players };
}

export function detectDatasetType(csvText) {
  const text = String(csvText || '');
  const rows = text.split(/\r?\n/).filter((row) => row.trim());
  const normalized = rows.join('\n').toUpperCase();
  const rosterCandidate = parseRoster(text);

  if (isTransactionsSnapshot(rows)) {
    return 'unknown';
  }
  if (isDraftBoardSnapshot(rows)) return 'draft';

  const firstCell = parseCSVLine(rows[0] || '')[0]?.trim().toUpperCase();
  if (firstCell === 'UTILITY') return 'utility';
  if (firstCell === 'LEFT WING') return 'positions';

  const isStructuredRosterLayout = rosterCandidate?.layout
    && !['flat-table', 'unknown', 'inventory', 'utility'].includes(rosterCandidate.layout);
  if (isStructuredRosterLayout && Object.keys(rosterCandidate.players || {}).length > 0) {
    return 'roster';
  }

  if (
    normalized.includes('TERM REMAINING') ||
    normalized.includes('MATCHING RIGHTS') ||
    /YR[1-9]/.test(normalized) ||
    normalized.includes('FARM')
  ) {
    return 'prospects';
  }

  const veteranLike = rows.some((row) => {
    const columns = parseCSVLine(row);
    if (columns.length < 7) return false;
    const last = columns[columns.length - 1].trim();
    return /^\d{4}$/.test(last) && Number(last) >= 2000 && Number(last) <= 2100;
  });

  if (veteranLike) {
    return 'veterans';
  }

  const rosterPlayers = Object.values(rosterCandidate?.players || {});
  if (rosterPlayers.some((player) => player.source === 'inventory')) {
    return 'positions';
  }
  if (rosterPlayers.some((player) => player.source === 'utility')) {
    return 'utility';
  }
  if (rosterPlayers.length > 0) {
    return 'roster';
  }

  const yearMatches = (normalized.match(/\b(20\d{2}|19\d{2})\b/g) || []).length;
  if (yearMatches >= 2) {
    return 'veterans';
  }

  const prospectsCandidate = parseProspects(text);
  if (Object.keys(prospectsCandidate?.prospects || {}).length > 0) {
    return 'prospects';
  }

  const veteransCandidate = parseVeterans(text);
  if (Object.keys(veteransCandidate?.veterans || {}).length > 0) {
    return 'veterans';
  }

  return 'unknown';
}

function isTransactionsSnapshot(rows) {
  if (rows.length < 2) return false;
  const columns = parseCSVLine(rows[1]).map((value) => value.toLowerCase());
  let matchingGroups = 0;

  for (let index = 0; index + 3 < columns.length; index += 4) {
    if (columns.slice(index, index + 4).join('|') === 'move|player|cost|date') {
      matchingGroups += 1;
    }
  }

  return matchingGroups >= 2;
}

function isDraftBoardSnapshot(rows) {
  if (rows.length < 2) return false;
  const columns = parseCSVLine(rows[1]).map((value) => value.toLowerCase().replace(/\./g, ''));
  let matchingGroups = 0;
  const upperRows = rows.map((row) => parseCSVLine(row).map((value) => String(value).trim().toUpperCase()));
  const hasBalance = upperRows.some((values) => values.includes('BALANCE'));
  const hasTotalSpent = upperRows.some((values) => values.includes('TOTAL SPENT'));
  const hasFarmDeductions = upperRows.some((values) => values.some((value) => value.includes('FARM DEDUCTIONS')));

  for (let index = 0; index + 3 < columns.length; index += 4) {
    if (columns.slice(index, index + 4).join('|') === '#|player name|pos|cost') {
      matchingGroups += 1;
    }
  }

  return matchingGroups >= 2 && !hasFarmDeductions && (hasBalance || !hasTotalSpent);
}

export function buildOwnerViewData(rawState) {
  // Accept either legacy importedData (flat) or the new unified state with datasets
  const DEFAULT = {
    version: 1,
    datasets: createEmptyDatasets(),
    metadata: createEmptyMetadata(),
  };

  let stateObj = rawState && rawState.datasets ? rawState : null;

  if (!stateObj) {
    // Migrate legacy shape into unified temporary state (do not persist here)
    stateObj = JSON.parse(JSON.stringify(DEFAULT));

    if (rawState) {
      // If legacy had top-level prospects/veterans, attach them
      if (rawState.prospects) {
        stateObj.datasets.prospects = rawState.prospects;
        stateObj.metadata.prospects = { status: 'ok', importedAt: rawState.importedAt || null, sourceName: rawState.sourceName || null, records: countParsedRecords(rawState.prospects, 'prospects') };
      }
      if (rawState.veterans) {
        stateObj.datasets.veterans = rawState.veterans;
        stateObj.metadata.veterans = { status: 'ok', importedAt: rawState.importedAt || null, sourceName: rawState.sourceName || null, records: countParsedRecords(rawState.veterans, 'veterans') };
      }
      // If rawState contains owners map without datasets, we ignore it since owners are derivable
    }
  }

  // Extract arrays of players from datasets
  const prospectsArrRaw = Object.values(stateObj.datasets.prospects?.prospects || {}).map((player) => decoratePlayer(player, 'prospect'));
  const veteransArrRaw = Object.values(stateObj.datasets.veterans?.veterans || {}).map((player) => decoratePlayer(player, 'veteran'));
  const rosterArrRaw = Object.values(stateObj.datasets.roster?.players || {}).map((player) => decoratePlayer(player, 'roster'));

  // Merge in local draft edits (manual assignments) and recorded winning bids
  // (workingAssignments) so Tools & Validation reflects drafted players
  // before the authoritative AHL Sheet/Draft 2026 tab catches up.
  const localEditMismatches = detectLocalEditMismatches(
    [...prospectsArrRaw, ...veteransArrRaw, ...rosterArrRaw],
    stateObj.localEdits,
    stateObj.workingAssignments,
  );
  const localEditView = applyLocalDraftEdits(
    [...prospectsArrRaw, ...veteransArrRaw, ...rosterArrRaw],
    new Set(),
    stateObj.localEdits,
    stateObj.workingAssignments,
  );
  const effectiveByKey = new Map(localEditView.players.map((player) => [player.playerKey, player]));
  const prospectsArr = prospectsArrRaw.map((player) => effectiveByKey.get(player.playerKey) || player);
  const veteransArr = veteransArrRaw.map((player) => effectiveByKey.get(player.playerKey) || player);
  const rosterArr = rosterArrRaw.map((player) => effectiveByKey.get(player.playerKey) || player);

  const ownerSet = new Set();
  // derive owners from dataset owners maps if present
  if (stateObj.datasets.prospects?.owners) Object.keys(stateObj.datasets.prospects.owners).forEach((o) => ownerSet.add(o));
  if (stateObj.datasets.veterans?.owners) Object.keys(stateObj.datasets.veterans.owners).forEach((o) => ownerSet.add(o));
  rosterArr.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });

  // derive from player records as well
  prospectsArr.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });
  veteransArr.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });

  const owners = [...ownerSet].sort((a, b) => a.localeCompare(b)).map((owner) => {
    const sourceOwnerProspects = prospectsArr.filter((p) => p.owner === owner);
    const ownerProspects = sourceOwnerProspects.filter((p) => !hasZeroYearsAvailable(p));
    const ownerVeterans = veteransArr.filter((p) => p.owner === owner);
    const ownerRosterPlayers = rosterArr.filter((p) => p.owner === owner);
    const farmPlayers = ownerProspects.filter((p) => p.farm);
    const matchingRights = sourceOwnerProspects.filter((p) => hasZeroYearsAvailable(p) && p.matchingRights);

    return {
      name: owner,
      prospects: ownerProspects,
      veterans: ownerVeterans,
      rosterPlayers: ownerRosterPlayers,
      farmPlayers,
      matchingRights,
    };
  });

  return {
    owners,
    totalOwners: owners.length,
    localEditMismatches,
    metadata: stateObj.metadata || DEFAULT.metadata,
    _rawState: stateObj,
  };
}

function countParsedRecords(parsed, type) {
  if (!parsed) return 0;
  if (type === 'prospects') {
    if (parsed.prospects && typeof parsed.prospects === 'object') return Object.keys(parsed.prospects).length;
    if (Array.isArray(parsed)) return parsed.length;
    return Object.keys(parsed).length;
  }

  if (type === 'veterans') {
    if (parsed.veterans && typeof parsed.veterans === 'object') return Object.keys(parsed.veterans).length;
    if (Array.isArray(parsed)) return parsed.length;
    return Object.keys(parsed).length;
  }

  if (type === 'roster' || type === 'transactions' || type === 'positions' || type === 'utility' || type === 'draft') {
    if (parsed.players && typeof parsed.players === 'object') return Object.keys(parsed.players).length;
    if (Array.isArray(parsed)) return parsed.length;
    return Object.keys(parsed).length;
  }

  if (type === 'budget') return Array.isArray(parsed.teamBudgets) ? parsed.teamBudgets.length : 0;
  if (type === 'dobber') return parsed.players && typeof parsed.players === 'object' ? Object.keys(parsed.players).length : 0;

  return 0;
}

function getVisiblePreviewRows(parsedData) {
  const records = [];

  if (parsedData?.prospects) {
    Object.values(parsedData.prospects).forEach((player) => records.push(player));
  }

  if (parsedData?.veterans) {
    Object.values(parsedData.veterans).forEach((player) => records.push(player));
  }

  if (parsedData?.players) {
    Object.values(parsedData.players).forEach((player) => records.push(player));
  }

  return records.slice(0, MAX_PREVIEW_ROWS);
}

function getPreviewHeaders(parsedData, datasetType) {
  if (datasetType === 'roster') {
    const rows = Object.values(parsedData?.players || {});
    const sample = rows[0] || {};
    const preferred = [
      'name',
      'owner',
      'team',
      'nhlteam',
      'position',
      'cost',
      'gamesplayed',
      'goals',
      'assists',
      'points',
      'shots',
      'avgtoi',
    ];
    const available = preferred.filter((header) => {
      const normalized = header.toLowerCase();
      return Object.prototype.hasOwnProperty.call(sample, normalized);
    });
    return available.length ? available : Object.keys(sample).slice(0, 8);
  }

  if (['positions', 'utility', 'draft'].includes(datasetType)) {
    const sample = Object.values(parsedData?.players || {})[0] || {};
    return ['name', 'owner', 'position', 'cost', 'pick', 'source']
      .filter((header) => Object.prototype.hasOwnProperty.call(sample, header));
  }

  return ['name', 'owner', 'cost', 'termRemaining', 'matchingRights', 'farm'];
}

function buildPlayerKey(player, sourceType) {
  const primary = player?.playerId || player?.name || player?.fullName || 'player';
  return `${sourceType}:${normalizeLookupKey(primary)}`;
}

function decoratePlayer(player, sourceType) {
  return {
    ...player,
    sourceType,
    playerKey: buildPlayerKey(player, sourceType),
  };
}

// Builds the unified player object consumed by Tools & Validation (team summary,
// player cards, intelligence panel). `context` carries optional, already-resolved
// async data (live NHL profile, the historical bids bundle, the matching Dobber
// draft-intelligence record) so this stays a pure, synchronous projection.
function buildUnifiedPlayer(player, context = {}) {
  if (!player) return null;
  const { liveProfile = null, historicalBidsBundle = null, draftPlayer = null } = context;

  const rawCost = player.cost ?? player.currentCost ?? player.keeperCost ?? null;
  const cost = Number.isFinite(Number(rawCost)) ? Number(rawCost) : null;
  const years = player.termRemaining ?? player.retentionYear ?? null;
  const owned = Boolean(player.owner);
  const draftStatus = owned ? 'Drafted' : 'Undrafted';
  const availability = owned ? 'Unavailable' : 'Available';
  const farmStatus = Boolean(player.farm);

  const snapshotGames = Number.isInteger(player.nhlCareerGamesPlayed)
    ? player.nhlCareerGamesPlayed
    : (Number.isInteger(liveProfile?.historical?.gamesPlayed) ? liveProfile.historical.gamesPlayed : null);
  const experienceTier = getExperienceTierFromGames(snapshotGames);

  const nhlProfile = (snapshotGames !== null || liveProfile)
    ? {
      gamesPlayed: snapshotGames,
      goals: liveProfile?.historical?.goals ?? null,
      assists: liveProfile?.historical?.assists ?? null,
      points: liveProfile?.historical?.points ?? null,
      shots: liveProfile?.historical?.shots ?? null,
      avgToi: liveProfile?.historical?.avgToi ?? null,
      tier: experienceTier,
    }
    : null;

  const dobberProjection = draftPlayer?.forecast
    ? { ...draftPlayer.forecast }
    : null;

  const historicalBidStats = historicalBidsBundle
    ? getHistoricalBidStats(historicalBidsBundle, player.name)
    : { ...NA_HISTORICAL_BID_STATS };

  return {
    name: player.name || null,
    availability,
    experienceTier,
    cost,
    years,
    draftStatus,
    farmStatus,
    nhlProfile,
    dobberProjection,
    ...historicalBidStats,
  };
}

function buildRosterIndex(stateObj) {
  const players = Object.values(stateObj.datasets.roster?.players || {});
  const byName = new Map();

  players.forEach((player) => {
    const name = String(pickRecordValue(player, ['name', 'fullname', 'playername', 'displayname', 'player'])).trim();
    const key = normalizeLookupKey(name);
    if (key && !byName.has(key)) {
      byName.set(key, player);
    }
  });

  return {
    players,
    byName,
  };
}

function findRosterMatchForPlayer(player, rosterIndex) {
  const name = String(player?.name || player?.fullName || '').trim();
  if (!name) return null;

  const key = normalizeLookupKey(name);
  return rosterIndex.byName.get(key) || null;
}

// Unified persistence helpers and migration
const DEFAULT_STATE = {
  version: APP_STATE_VERSION,
  datasets: createEmptyDatasets(),
  metadata: { ...createEmptyMetadata(), localDraftEdits: createEmptyLocalEdits() },
  manualOverrides: [],
  workingAssignments: {},
  localEdits: createEmptyLocalEdits(),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === APP_STATE_VERSION && parsed.datasets) {
      // Already new shape
      return normalizeState(parsed);
    }

    if (parsed && parsed.version === 1 && parsed.datasets) {
      return normalizeState({ ...parsed, version: APP_STATE_VERSION });
    }

    // Migrate old shape
    const migrated = migrateOldState(parsed);
    persistState(migrated);
    return migrated;
  } catch (err) {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function persistState(stateObj) {
  try {
    const topLevelEdits = normalizeLocalEdits(stateObj?.localEdits);
    const metadataEdits = normalizeLocalEdits(stateObj?.metadata?.localDraftEdits);
    const localEdits = (metadataEdits.lastUpdated || 0) > (topLevelEdits.lastUpdated || 0)
      ? metadataEdits
      : topLevelEdits;
    const persistedState = {
      ...stateObj,
      localEdits,
      metadata: { ...(stateObj?.metadata || {}), localDraftEdits: localEdits },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  } catch (err) {
    console.error('Failed to persist state', err);
  }
}

function markLocalEditsUpdated(localEdits, previousTimestamp = null) {
  const normalized = normalizeLocalEdits(localEdits);
  return {
    ...normalized,
    lastUpdated: Math.max(Date.now(), (normalized.lastUpdated || previousTimestamp || 0) + 1),
  };
}

function migrateOldState(oldObj) {
  const newState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  if (!oldObj) return newState;
  newState.localEdits = normalizeLocalEdits(oldObj.localEdits || oldObj.metadata?.localDraftEdits);
  newState.metadata.localDraftEdits = newState.localEdits;

  // if oldObj already contains datasets-like keys, map them
  if (oldObj.prospects) {
    newState.datasets.prospects = oldObj.prospects;
    newState.metadata.prospects = { status: 'ok', importedAt: oldObj.importedAt || new Date().toISOString(), sourceName: oldObj.sourceName || null, records: countParsedRecords(oldObj.prospects, 'prospects') };
  }
  if (oldObj.veterans) {
    newState.datasets.veterans = oldObj.veterans;
    newState.metadata.veterans = { status: 'ok', importedAt: oldObj.importedAt || new Date().toISOString(), sourceName: oldObj.sourceName || null, records: countParsedRecords(oldObj.veterans, 'veterans') };
  }

  if (Array.isArray(oldObj.manualOverrides)) {
    newState.manualOverrides = oldObj.manualOverrides;
  }

  // Some older shapes stored both datasets at top-level; detect owners-only objects? Ignore owners-only

  return newState;
}

function mergeDataset(stateObj, datasetType, parsedData, sourceName) {
  const next = JSON.parse(JSON.stringify(stateObj));
  next.datasets = { ...createEmptyDatasets(), ...(next.datasets || {}) };
  next.datasets[datasetType] = datasetType === 'roster'
    ? mergeRosterDataset(next.datasets.roster, parsedData, sourceName)
    : parsedData;
  next.metadata = next.metadata || {};
  next.metadata[datasetType] = {
    status: (parsedData ? 'ok' : 'empty'),
    sourceName: sourceName || null,
    importedAt: parsedData ? new Date().toISOString() : null,
    records: next.datasets[datasetType] ? countParsedRecords(next.datasets[datasetType], datasetType) : 0,
  };
  next.manualOverrides = Array.isArray(next.manualOverrides) ? next.manualOverrides : [];
  next.version = APP_STATE_VERSION;
  return normalizeState(next);
}

function normalizeState(stateObj) {
  const next = JSON.parse(JSON.stringify(DEFAULT_STATE));
  if (!stateObj) {
    return next;
  }

  next.version = APP_STATE_VERSION;
  next.datasets = { ...next.datasets, ...(stateObj.datasets || {}) };
  next.metadata = { ...next.metadata, ...(stateObj.metadata || {}) };
  next.manualOverrides = Array.isArray(stateObj.manualOverrides) ? stateObj.manualOverrides : [];
  next.workingAssignments = stateObj.workingAssignments && typeof stateObj.workingAssignments === 'object' && !Array.isArray(stateObj.workingAssignments)
    ? stateObj.workingAssignments
    : {};
  const topLevelEdits = normalizeLocalEdits(stateObj.localEdits);
  const metadataEdits = normalizeLocalEdits(stateObj.metadata?.localDraftEdits);
  next.localEdits = (metadataEdits.lastUpdated || 0) > (topLevelEdits.lastUpdated || 0)
    ? metadataEdits
    : topLevelEdits;
  next.metadata.localDraftEdits = next.localEdits;
  return next;
}

function applyAhlSheetIntelligence(stateObj) {
  if (!state.draftIntelligence || stateObj?.metadata?.ahlSheets?.status !== 'ok') return;
  const report = buildDraftValidationReport(stateObj);
  let ahlOutputs = buildAhlDraftIntelligenceOutputs(
    state.draftIntelligence,
    stateObj,
    report.availablePlayers,
  );
  const generatedOverrides = ahlOutputs.missingPositionOverrides || [];
  const retainedOverrides = (stateObj.manualOverrides || [])
    .filter((entry) => entry.manualOverrideSource !== 'missing-ahl-position');
  const retainedOverrideNames = new Set(retainedOverrides.map((entry) => normalizeLookupKey(entry.name)));
  stateObj.manualOverrides = [
    ...retainedOverrides,
    ...generatedOverrides.filter((entry) => !retainedOverrideNames.has(normalizeLookupKey(entry.name))),
  ];
  if (state.importedData) state.importedData.manualOverrides = stateObj.manualOverrides;
  persistState(stateObj);
  state.draftIntelligence = applyAhlEligibility(
    applyDobberIntelligence(ahlOutputs, stateObj, (players) => {
      const eligiblePlayers = applyAhlEligibilityToPlayers(players, stateObj);
      return applyLocalDraftEdits(
        eligiblePlayers,
        new Set(report.availablePlayers.map((player) => normalizeLookupKey(player.name))),
        stateObj.localEdits,
        stateObj.workingAssignments,
      ).players;
    }),
    stateObj,
  );
  state.draftIntelligenceStorageError = '';
}

function downloadDraftIntelligenceBundle() {
  if (!state.draftIntelligence) {
    state.draftIntelligenceStorageError = 'Draft Intelligence JSON is not loaded yet.';
    return;
  }
  const bundle = Object.fromEntries(
    Object.entries(state.draftIntelligence).map(([name, data]) => [`${name}.json`, data]),
  );
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ahl-draft-intelligence-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function persistOfflineAhlSnapshot(stateObj) {
  try {
    await saveAhlSnapshot(stateObj, state.draftIntelligence);
    return '';
  } catch (error) {
    console.error('Unable to save the offline AHL snapshot', error);
    return error instanceof Error
      ? `Offline snapshot was not saved: ${error.message}`
      : 'Offline snapshot was not saved.';
  }
}

let pdfJsPromise = null;

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import('./vendor/pdf.min.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

function getDobberPlayerNames(stateObj) {
  return Object.values(stateObj?.datasets?.roster?.players || {})
    .map((player) => String(player.name || '').trim())
    .filter(Boolean);
}

function hasLocalDobberImport(metadata, sourceName, records) {
  if (!sourceName) return false;
  if (metadata?.status === 'loaded-local' || metadata?.sourceType === 'local') return true;
  if (!records) return false;
  return ['ok', 'cached'].includes(metadata?.status)
    && !/onedrive|dobber excel everything|fantasy guide and prospect report/i.test(sourceName);
}

async function refreshDobberState(stateObj, fetchImpl = globalThis.fetch) {
  const next = normalizeState(stateObj);
  const existingExcelMetadata = next.metadata.dobberExcel || {};
  const existingPdfMetadata = next.metadata.dobberPdfs || {};
  const current = next.datasets.dobber && typeof next.datasets.dobber === 'object'
    ? next.datasets.dobber
    : { players: {}, intelByPlayerKey: {}, prospectMetadataByPlayerKey: {} };
  let players = current.players || {};
  let intelByPlayerKey = current.intelByPlayerKey || {};
  let prospectMetadataByPlayerKey = current.prospectMetadataByPlayerKey || {};
  let excelError = '';
  let pdfError = '';
  const hasLocalExcel = hasLocalDobberImport(
    next.metadata.dobberExcel,
    current.excelSourceName || next.metadata.dobberExcel?.sourceName,
    Object.keys(players).length,
  );
  const hasLocalPdfs = hasLocalDobberImport(
    next.metadata.dobberPdfs,
    current.pdfSourceName || next.metadata.dobberPdfs?.sourceName,
    Object.keys(intelByPlayerKey).length,
  );
  if (!hasLocalExcel) players = {};
  if (!hasLocalPdfs) { intelByPlayerKey = {}; prospectMetadataByPlayerKey = {}; }

  // Manually dropped local imports always win; the bundled /data files are only
  // adopted as a fallback source when no local import has been made, but the
  // bundled fetch is always attempted so refresh errors still surface.
  let bundledPlayers = null;
  try {
    bundledPlayers = await fetchDobberWorkbook(fetchImpl);
  } catch (error) {
    excelError = error instanceof Error ? error.message : 'Dobber Excel refresh failed.';
  }
  const hasBundledExcel = !hasLocalExcel && Boolean(bundledPlayers);
  if (hasBundledExcel) players = bundledPlayers;
  const excelLoaded = hasLocalExcel || hasBundledExcel;
  const excelImportedAt = hasLocalExcel ? current.excelImportedAt || null : (hasBundledExcel ? new Date().toISOString() : null);
  next.metadata.dobberExcel = {
    status: excelLoaded ? 'loaded-local' : 'unavailable',
    sourceType: hasLocalExcel ? 'local' : (hasBundledExcel ? 'bundled' : 'remote'),
    sourceName: hasLocalExcel
      ? current.excelSourceName
      : (hasBundledExcel ? DOBBER_EXCEL_URL : 'Dobber Excel OneDrive'),
    importedAt: excelImportedAt,
    lastImport: excelLoaded ? excelImportedAt || existingExcelMetadata.lastImport || null : existingExcelMetadata.lastImport || null,
    lastAttempt: existingExcelMetadata.lastAttempt,
    records: excelLoaded ? Object.keys(players).length : 0,
    error: excelError,
  };

  let bundledPdfResult = null;
  try {
    const pdfjs = await loadPdfJs();
    bundledPdfResult = await fetchDobberPdfIntel(getDobberPlayerNames(next), fetchImpl, pdfjs);
  } catch (error) {
    pdfError = error instanceof Error ? error.message : 'Dobber PDF refresh failed.';
  }
  const hasBundledPdfs = !hasLocalPdfs && Boolean(bundledPdfResult);
  if (hasBundledPdfs) {
    intelByPlayerKey = bundledPdfResult.intelByPlayerKey;
    prospectMetadataByPlayerKey = bundledPdfResult.prospectMetadataByPlayerKey;
  }
  const pdfsLoaded = hasLocalPdfs || hasBundledPdfs;
  const pdfImportedAt = hasLocalPdfs ? current.pdfImportedAt || null : (hasBundledPdfs ? new Date().toISOString() : null);
  next.metadata.dobberPdfs = {
    status: pdfsLoaded ? 'loaded-local' : 'unavailable',
    sourceType: hasLocalPdfs ? 'local' : (hasBundledPdfs ? 'bundled' : 'remote'),
    sourceName: hasLocalPdfs
      ? current.pdfSourceName
      : (hasBundledPdfs ? `${DOBBER_GUIDE_PDF_URL}, ${DOBBER_PROSPECTS_PDF_URL}` : 'Dobber PDFs OneDrive'),
    importedAt: pdfImportedAt,
    lastImport: pdfsLoaded ? pdfImportedAt || existingPdfMetadata.lastImport || null : existingPdfMetadata.lastImport || null,
    lastAttempt: existingPdfMetadata.lastAttempt,
    records: pdfsLoaded ? Object.keys(intelByPlayerKey).length : 0,
    error: pdfError,
  };
  next.metadata.dobberStatus = excelLoaded || pdfsLoaded ? 'loaded-local' : 'unavailable';
  // "Fully loaded" means all three bundled files (the workbook and both PDFs)
  // parsed successfully, satisfying objective #7.
  next.metadata.dobberFullyLoaded = excelLoaded && pdfsLoaded;

  next.datasets.dobber = {
    players: attachDobberIntel(players, intelByPlayerKey, prospectMetadataByPlayerKey),
    intelByPlayerKey,
    prospectMetadataByPlayerKey,
    excelSourceName: next.metadata.dobberExcel.sourceName,
    excelImportedAt: next.metadata.dobberExcel.importedAt,
    pdfSourceName: next.metadata.dobberPdfs.sourceName,
    pdfImportedAt: next.metadata.dobberPdfs.importedAt,
  };
  const statusLabel = next.metadata.dobberFullyLoaded
    ? (hasBundledExcel || hasBundledPdfs ? 'Dobber fully loaded (bundled data files)' : 'Dobber loaded-local')
    : (next.metadata.dobberStatus === 'loaded-local' ? 'Dobber partially loaded' : 'Dobber unavailable');
  return {
    state: next,
    message: [
      statusLabel,
      [excelError && `Excel: ${excelError}`, pdfError && `PDFs: ${pdfError}`].filter(Boolean).join(' | '),
    ].filter(Boolean).join(': '),
  };
}

async function refreshAhlSheetsOnPageLoad() {
  const refreshButton = document.getElementById('liveRefreshBtn');
  const status = document.getElementById('liveRefreshStatus');
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Refreshing...';
  }
  if (status) status.textContent = 'Loading AHL Sheets';
  try {
    let nextState = await refreshGoogleSheetState(state.importedData || loadState());
    const dobberRefresh = await refreshDobberState(nextState);
    nextState = dobberRefresh.state;
    persistState(nextState);
    state.importedData = nextState;
    state.manualOverrides = Array.isArray(nextState.manualOverrides) ? nextState.manualOverrides : [];
    state.draftIntelligenceFromOfflineSnapshot = false;
    applyAhlSheetIntelligence(nextState);
    renderDobberImportStatus('excel', nextState.metadata.dobberExcel);
    renderDobberImportStatus('pdfs', nextState.metadata.dobberPdfs);
    const offlineWarning = await persistOfflineAhlSnapshot(nextState);
    state.liveRefreshMessage = [
      'AHL Sheets loaded',
      dobberRefresh.message,
      offlineWarning,
    ].filter(Boolean).join('; ');
    renderOwnerView(nextState);
    if (status) status.textContent = state.liveRefreshMessage;
  } catch (error) {
    console.error('AHL Sheets startup refresh failed', error);
    let offlineRecord = null;
    let offlineCacheError = '';
    try {
      offlineRecord = await loadAhlSnapshot();
    } catch (cacheError) {
      console.error('Unable to load the offline AHL snapshot', cacheError);
      offlineCacheError = cacheError instanceof Error ? cacheError.message : 'offline cache could not be read';
    }
    if (offlineRecord) {
      const cachedState = normalizeState(offlineRecord.snapshot);
      if (offlineRecord.draftIntelligence) {
        state.draftIntelligence = offlineRecord.draftIntelligence;
        state.draftIntelligenceFromOfflineSnapshot = true;
      }
      persistState(cachedState);
      state.importedData = cachedState;
      state.manualOverrides = Array.isArray(cachedState.manualOverrides) ? cachedState.manualOverrides : [];
      renderDobberImportStatus('excel', cachedState.metadata.dobberExcel);
      renderDobberImportStatus('pdfs', cachedState.metadata.dobberPdfs);
      const importedAt = cachedState.metadata.ahlSheets.importedAt || offlineRecord.savedAt;
      state.liveRefreshMessage = `Offline AHL snapshot loaded (${formatTimestamp(importedAt)})`;
      applyAhlSheetIntelligence(cachedState);
      renderOwnerView(cachedState);
      if (status) status.textContent = `${state.liveRefreshMessage}; online refresh failed`;
    } else {
      state.liveRefreshMessage = 'AHL Sheets refresh failed';
      state.draftIntelligenceStorageError = error instanceof Error
        ? `AHL Sheets unavailable: ${error.message}${offlineCacheError ? `; offline cache unavailable: ${offlineCacheError}` : ''}`
        : 'AHL Sheets unavailable. Refresh and check sheet access.';
      if (status) status.textContent = state.draftIntelligenceStorageError;
      if (state.draftIntelligence && hasLoadedData(state.importedData || DEFAULT_STATE)) {
        state.liveRefreshMessage = 'Using browser-saved AHL snapshot; refresh failed';
        renderOwnerView(state.importedData || DEFAULT_STATE);
        if (status) status.textContent = `${state.liveRefreshMessage}: ${state.draftIntelligenceStorageError}`;
      }
    }
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = 'Refresh AHL Sheets';
    }
  }
}

function getSnapshotAgeInfo(stateObj) {
  const datasets = [...DATASET_NAMES, 'ahlSheets'];
  const importedTimes = datasets
    .map((dataset) => stateObj?.metadata?.[dataset]?.importedAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (!importedTimes.length) {
    return {
      ageMinutes: null,
      label: 'No snapshot loaded',
      status: 'warning',
      details: 'Upload the latest CSV snapshot to refresh the league state.',
    };
  }

  const latest = Math.max(...importedTimes);
  const ageMinutes = Math.max(0, Math.round((Date.now() - latest) / 60000));
  let status = 'valid';
  let label = 'Snapshot Current';

  if (ageMinutes > 180) {
    status = 'error';
    label = `Snapshot ${Math.round(ageMinutes / 60)} Hours Old`;
  } else if (ageMinutes > 60) {
    status = 'warning';
    label = `Snapshot ${Math.round(ageMinutes / 60)} Hours Old`;
  } else if (ageMinutes > 5) {
    status = 'warning';
    label = `Snapshot ${ageMinutes} Minutes Old`;
  }

  return {
    ageMinutes,
    label,
    status,
    details: `Latest refresh ${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} ago`,
  };
}

function getDataQualitySources(stateObj) {
  const metadata = stateObj?.metadata || {};
  const rosterSources = stateObj?.datasets?.roster?.sources || {};
  const liveSourceLabels = {
    inventory: 'Positions',
    utility: 'Utility',
    'retained-grid': 'Retention',
    'league-layout': 'Roster',
  };
  const liveSources = Object.entries(liveSourceLabels)
    .filter(([key]) => rosterSources[key])
    .map(([key, label]) => ({
      label,
      status: 'ok',
      records: countParsedRecords(rosterSources[key], 'roster'),
      importedAt: metadata.roster?.importedAt,
    }));

  if (liveSources.length) {
    return [
      ...(metadata.ahlSheets?.status === 'ok' ? [{
        label: 'AHL Scores',
        ...metadata.ahlSheets,
      }] : []),
      ...(metadata.prospects?.status === 'ok' ? [{
        label: 'Prospects',
        ...metadata.prospects,
      }] : []),
      ...liveSources,
      ...(['veterans', 'transactions']
        .filter((dataset) => metadata[dataset]?.status === 'ok')
        .map((dataset) => ({
          label: dataset.charAt(0).toUpperCase() + dataset.slice(1),
          ...metadata[dataset],
        }))),
    ];
  }

  return ['prospects', 'veterans', 'roster', 'transactions'].map((dataset) => ({
    label: dataset.charAt(0).toUpperCase() + dataset.slice(1),
    ...(metadata[dataset] || { status: 'empty' }),
  }));
}

function isRetentionListLoaded(stateObj) {
  const veterans = stateObj?.datasets?.veterans?.veterans || {};
  const retainedGrid = stateObj?.datasets?.roster?.sources?.['retained-grid']?.players || {};
  return Object.keys(veterans).length > 0 || Object.keys(retainedGrid).length > 0;
}

function hasLoadedData(stateObj) {
  return DATASET_NAMES
    .some((key) => stateObj?.metadata?.[key]?.status === 'ok');
}

function formatTimestamp(value) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : 'Not available';
}

function formatAgeLabel(ageMinutes) {
  if (!Number.isFinite(ageMinutes)) return 'Not available';
  if (ageMinutes < 60) return `${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function sanitizeLiveCache(cacheObj) {
  const source = cacheObj && typeof cacheObj === 'object' ? cacheObj : {};
  return {
    version: source.version || 1,
    updatedAt: source.updatedAt || null,
    players: source.players && typeof source.players === 'object' ? source.players : {},
    teams: source.teams && typeof source.teams === 'object' ? source.teams : {},
  };
}

function getLiveCacheStatus(cacheObj = state.liveCache) {
  const cache = sanitizeLiveCache(cacheObj);
  if (!cache.updatedAt) {
    return {
      status: 'warning',
      label: 'Local data only',
      details: 'No cached NHL enrichment has been saved on this device yet.',
      updatedAt: null,
    };
  }

  const updatedAtMs = new Date(cache.updatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) {
    return {
      status: 'warning',
      label: 'Cached live data unreadable',
      details: 'The saved live-data cache timestamp could not be read.',
      updatedAt: cache.updatedAt,
    };
  }

  const ageMinutes = Math.max(0, Math.round((Date.now() - updatedAtMs) / 60000));
  const status = ageMinutes > 240 ? 'warning' : 'valid';
  const label = ageMinutes > 240 ? 'Cached live data is aging' : 'Cached live data ready';

  return {
    status,
    label,
    details: `Last live cache refresh ${formatAgeLabel(ageMinutes)}`,
    updatedAt: cache.updatedAt,
  };
}

function serializePortableStateBundle(stateObj, liveCacheObj = state.liveCache) {
  return {
    format: 'hockey-dashboard-portable-state',
    version: PORTABLE_STATE_VERSION,
    exportedAt: new Date().toISOString(),
    appState: normalizeState(stateObj || state.importedData || DEFAULT_STATE),
    liveCache: sanitizeLiveCache(liveCacheObj),
  };
}

function parsePortableStateBundle(bundle) {
  const candidate = bundle && typeof bundle === 'object' ? bundle : null;
  const appStateSource = candidate?.appState || (candidate?.datasets ? candidate : null);

  if (
    !appStateSource
    || typeof appStateSource !== 'object'
    || !appStateSource.datasets
    || typeof appStateSource.datasets !== 'object'
    || Array.isArray(appStateSource.datasets)
  ) {
    throw new Error('This file does not contain a Hockey Dashboard saved state.');
  }

  return {
    appState: normalizeState(appStateSource),
    liveCache: sanitizeLiveCache(candidate?.liveCache),
    exportedAt: candidate?.exportedAt || null,
    format: candidate?.format || 'legacy',
  };
}

async function refreshGoogleSheetState(stateObj, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('AHL Sheets refresh is unavailable because this browser does not support fetch.');
  }

  const snapshots = await Promise.all(AHL_SHEET_SOURCES.map(async (source) => {
    const url = `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/export?format=csv&gid=${source.gid}&cacheBust=${Date.now()}`;
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response?.ok) {
      throw new Error(`AHL Sheet refresh failed for ${source.name} (HTTP ${response?.status || 'unknown'}).`);
    }

    const csvText = await response.text();
    const parsedData = source.datasetType === 'scores'
      ? parseAhlScoreSheet(csvText, source.name)
      : source.datasetType === 'budget'
        ? parseAhlBudgetSheet(csvText)
      : source.datasetType === 'prospects'
        ? parseProspects(csvText)
        : parseRoster(csvText);
    if (source.datasetType === 'prospects') {
      parsedData.isRightsList = true;
    }
    const recordCount = source.datasetType === 'scores'
      ? parsedData.rows.length
      : source.datasetType === 'budget'
        ? parsedData.teamBudgets.length
      : source.datasetType === 'prospects'
      ? Object.keys(parsedData.prospects || {}).length
      : Object.keys(parsedData.players || {}).length;
    if ((source.expectedLayout && parsedData.layout !== source.expectedLayout) || !recordCount) {
      throw new Error(`AHL Sheet refresh returned an unexpected ${source.name} layout.`);
    }
    return { source, parsedData };
  }));

  let next = normalizeState(stateObj);
  const scoreTabs = {};
  const loadedTabs = {};
  snapshots.forEach(({ source, parsedData }) => {
    if (source.datasetType === 'scores') {
      scoreTabs[source.name] = parsedData;
      loadedTabs[source.name] = parsedData.rows.length;
      return;
    }
    next = mergeDataset(next, source.datasetType, parsedData, source.name);
    loadedTabs[source.name] = source.datasetType === 'budget'
      ? parsedData.teamBudgets.length
      : source.datasetType === 'prospects'
      ? Object.keys(parsedData.prospects || {}).length
      : Object.keys(parsedData.players || {}).length;
  });
  if (next.datasets.budget?.teamBudgets?.length && next.datasets.roster) {
    next.datasets.roster.teamBudgets = next.datasets.budget.teamBudgets;
  }
  next.datasets.ahlScores = { tabs: scoreTabs };
  next.metadata.ahlSheets = {
    status: 'ok',
    importedAt: new Date().toISOString(),
    sourceName: 'AHL Google Sheets',
    tabs: loadedTabs,
  };
  next.localEdits = markLocalEditsUpdated(createEmptyLocalEdits(), next.localEdits.lastUpdated);
  next.metadata.localDraftEdits = next.localEdits;
  return next;
}

function getRosterSourceKey(parsedData, sourceName) {
  const layout = String(parsedData?.layout || 'flat-table').trim().toLowerCase();
  if (layout !== 'flat-table') return layout;
  const normalizedSourceName = normalizeLookupKey(sourceName || 'flat-table').replace(/\s+/g, '-');
  return `flat-table:${normalizedSourceName || 'default'}`;
}

function mergeRosterRecord(base, incoming) {
  const next = { ...(base || {}) };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
    if (hasValue || !(key in next)) {
      next[key] = value;
    }
  });
  next.retained = Boolean(base?.retained || incoming?.retained);
  next.drafted = Boolean(base?.drafted || incoming?.drafted);
  return next;
}

function findCanonicalRosterKey(name, recordsByKey) {
  const exactKey = normalizeLookupKey(name);
  if (!exactKey) return '';
  if (recordsByKey.has(exactKey)) return exactKey;

  const tokens = exactKey.split(' ').filter(Boolean);
  if (tokens.length < 2 || tokens[0].length !== 1) return '';

  const firstInitial = tokens[0];
  const surname = tokens.slice(1).join(' ');
  const matches = [...recordsByKey.keys()].filter((candidateKey) => {
    const candidateTokens = candidateKey.split(' ').filter(Boolean);
    return candidateTokens.length >= 2
      && candidateTokens[0].startsWith(firstInitial)
      && candidateTokens.slice(1).join(' ') === surname;
  });
  return matches.length === 1 ? matches[0] : '';
}

function rebuildRosterDataset(sources) {
  const recordsByKey = new Map();
  const sourceList = Object.values(sources || {});
  const baselineSources = sourceList.filter((source) => ['inventory', 'utility'].includes(source?.layout));
  const authoritativeSources = sourceList.filter((source) => !['inventory', 'utility'].includes(source?.layout));

  const mergeSource = (source, resolveAliases) => {
    Object.values(source?.players || {}).forEach((record) => {
      const name = getRecordName(record);
      if (!name) return;
      const exactKey = normalizeLookupKey(name);
      const canonicalKey = resolveAliases ? (findCanonicalRosterKey(name, recordsByKey) || exactKey) : exactKey;
      const current = recordsByKey.get(canonicalKey);
      const merged = mergeRosterRecord(current, record);
      if (current?.name && canonicalKey !== exactKey) {
        merged.name = current.name;
      }

      const owners = [...new Set([
        ...(current?.sourceOwners || []),
        getRecordOwner(current),
        getRecordOwner(record),
      ].filter(Boolean))];
      merged.sourceOwners = owners;
      merged.owner = owners.length === 1 ? owners[0] : (getRecordOwner(record) || getRecordOwner(current));
      merged.ownershipConflict = owners.length > 1 ? owners : [];
      recordsByKey.set(canonicalKey, merged);
    });
  };

  baselineSources.forEach((source) => mergeSource(source, false));
  authoritativeSources.forEach((source) => mergeSource(source, true));

  const players = {};
  const teams = {};
  recordsByKey.forEach((player, key) => {
    const playerKey = key.replace(/\s+/g, '-') || `player-${Object.keys(players).length + 1}`;
    players[playerKey] = player;
    if (player.nhlteam) {
      if (!teams[player.nhlteam]) teams[player.nhlteam] = [];
      teams[player.nhlteam].push(playerKey);
    }
  });

  return {
    layout: 'merged',
    sources,
    players,
    teams,
    teamBudgets: sourceList.find((source) => source?.layout === 'retained-grid')?.teamBudgets || [],
    goalieFranchises: [],
    contacts: {},
  };
}

function mergeRosterDataset(currentRoster, parsedData, sourceName) {
  const sources = currentRoster?.sources && typeof currentRoster.sources === 'object'
    ? { ...currentRoster.sources }
    : {};

  if (!Object.keys(sources).length && currentRoster?.players) {
    const legacyLayout = currentRoster.layout && currentRoster.layout !== 'merged' ? currentRoster.layout : 'legacy';
    sources[legacyLayout] = { ...currentRoster, layout: legacyLayout };
  }

  const sourceKey = getRosterSourceKey(parsedData, sourceName);
  sources[sourceKey] = {
    ...parsedData,
    layout: parsedData?.layout || 'flat-table',
    sourceName: sourceName || null,
  };
  return rebuildRosterDataset(sources);
}

function hasGoogleSheetSnapshot(stateObj) {
  if (stateObj?.metadata?.ahlSheets?.status === 'ok') return true;
  const sourceNames = [
    stateObj?.metadata?.roster?.sourceName,
    stateObj?.metadata?.prospects?.sourceName,
  ].filter(Boolean);
  return sourceNames.some((name) => String(name).startsWith('google-'));
}

function updateTopbarActions(currentState = state.importedData || DEFAULT_STATE) {
  const liveRefreshStatus = document.getElementById('liveRefreshStatus');
  const liveRefreshBtn = document.getElementById('liveRefreshBtn');
  const backToImportBtn = document.getElementById('backToImportBtn');
  const exportStateBtn = document.getElementById('exportStateBtn');
  const hasData = hasLoadedData(currentState);
  const googleSnapshotLoaded = hasGoogleSheetSnapshot(currentState);

  if (liveRefreshStatus) {
    if (state.liveRefreshMessage && googleSnapshotLoaded) {
      liveRefreshStatus.textContent = state.liveRefreshMessage;
    } else if (googleSnapshotLoaded) {
      liveRefreshStatus.textContent = 'Google Sheets snapshot loaded';
    } else {
      liveRefreshStatus.textContent = '';
    }
  }

  if (liveRefreshBtn) {
    liveRefreshBtn.disabled = false;
  }

  if (backToImportBtn) {
    backToImportBtn.textContent = hasData ? 'Refresh Snapshot' : 'Upload CSV';
  }

  if (exportStateBtn) {
    const hasPortableContent = hasData
      || Boolean(currentState?.manualOverrides?.length)
      || Boolean(Object.keys(currentState?.workingAssignments || {}).length)
      || Boolean(currentState?.localEdits?.removedPlayers?.length)
      || Boolean(Object.keys(currentState?.localEdits?.manualAssignments || {}).length)
      || Boolean(currentState?.localEdits?.manualUnassign?.length);
    exportStateBtn.disabled = !hasPortableContent;
  }
}

function isCompactViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 760px)').matches;
}

function renderResponsiveActionButton({ label, className = 'secondary', attributes = '' }) {
  if (isCompactViewport()) {
    return `
      <div class="mobile-readonly-action">
        <button type="button" class="${className}" disabled aria-disabled="true">${escapeHtml(label)}</button>
        <div class="compact-action-note">Laptop only in phone lookup mode</div>
      </div>
    `;
  }

  return `<button type="button" class="${className}" ${attributes}>${escapeHtml(label)}</button>`;
}

function downloadPortableState(stateObj) {
  const bundle = serializePortableStateBundle(stateObj);
  const fileName = `hockey-dashboard-state-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applyPortableStateBundle(bundle) {
  const parsed = parsePortableStateBundle(bundle);
  persistState(parsed.appState);
  persistLiveCache(parsed.liveCache);

  state.importedData = parsed.appState;
  state.manualOverrides = Array.isArray(parsed.appState.manualOverrides) ? parsed.appState.manualOverrides : [];
  state.liveCache = sanitizeLiveCache(parsed.liveCache);
  state.liveProfiles = state.liveCache.players ? { ...state.liveCache.players } : {};
  state.liveRequests = {};
  state.liveRefreshMessage = hasGoogleSheetSnapshot(parsed.appState) ? 'Google Sheets snapshot loaded' : '';
  state.selectedOwner = null;
  state.selectedPlayerKey = null;

  if (hasLoadedData(parsed.appState)) {
    renderOwnerView(parsed.appState);
  } else {
    renderImportScreen();
  }

  return parsed;
}

async function importPortableStateFile(file) {
  if (!file) return null;

  const rawText = await file.text();
  let parsedJson;

  try {
    parsedJson = JSON.parse(rawText);
  } catch (err) {
    throw new Error('The selected file is not valid JSON. Export a fresh Hockey Dashboard state and try again.');
  }

  try {
    return applyPortableStateBundle(parsedJson);
  } catch (err) {
    if (err.message === 'This file does not contain a Hockey Dashboard saved state.') {
      throw err;
    }

    throw new Error(`Unable to import the saved dashboard state. ${err.message}`);
  }
}

function normalizeClassification(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (text === 'veteran') return 'Veteran';
  if (text === 'rookie' || text === 'prospect') return 'Rookie';
  if (text === 'farm') return 'Farm';
  return String(value).trim();
}

function isTruthyRecordValue(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === 'y' || text === 'yes' || text === 'true' || text === '1' || text === 'available';
}

function isFalsyRecordValue(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === 'n' || text === 'no' || text === 'false' || text === '0';
}

function hasExplicitAvailableSignal(record) {
  const availableField = pickRecordValue(record, ['available', 'isavailable', 'undrafted']);
  if (isTruthyRecordValue(availableField)) return true;

  const source = normalizeLookupKey(pickRecordValue(record, ['source']));
  if (source === 'inventory' || source === 'utility') return false;

  return isFalsyRecordValue(pickRecordValue(record, ['drafted', 'draftstatus', 'draft_status']));
}

function getRecordName(record) {
  return String(pickRecordValue(record, ['name', 'fullname', 'playername', 'displayname', 'player'])).trim();
}

function getRecordOwner(record) {
  return String(pickRecordValue(record, ['owner', 'team', 'currentteam', 'club'])).trim();
}

function hasZeroYearsAvailable(record) {
  const years = pickRecordValue(record, ['termRemaining', 'yearsAvailable', 'years_available']);
  return years !== null && years !== undefined && String(years).trim() === '0';
}

function getRecordPosition(record) {
  return String(pickRecordValue(record, ['position', 'primaryposition', 'positioncode'])).trim();
}

function normalizeDraftPositionText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDraftSlotPosition(record) {
  return String(pickRecordValue(record, ['poolPosition', 'poolposition', 'position', 'primaryposition', 'positioncode'])).trim();
}

function isGoalieTeamPosition(position) {
  const normalized = normalizeDraftPositionText(position);
  if (!normalized) return false;
  if (GOALIE_TEAM_CITY_KEYS.has(normalized)) return true;
  if (GOALIE_TEAM_POSITION_KEYS.has(normalized)) return true;
  return normalized.split(/[\/,&]/).map((part) => part.trim()).some((token) => GOALIE_TEAM_POSITION_KEYS.has(token));
}

function isSkaterPosition(position) {
  const normalized = normalizeDraftPositionText(position);
  if (!normalized) return false;
  const tokens = normalized.split(/[\/,&\s]+/).filter(Boolean);
  return tokens.some((token) => SKATER_POSITION_KEYS.has(token));
}

function getPlayerRetainedCost(player) {
  const numeric = Number(player?.currentCost ?? player?.currentcost ?? player?.cost ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildOwnerDraftPlan(ownerEntry, sheetBudget = null) {
  const rawPlayers = [...(ownerEntry?.prospects || []), ...(ownerEntry?.veterans || []), ...(ownerEntry?.rosterPlayers || [])];
  const dedupedPlayers = [];
  const seen = new Set();
  rawPlayers.forEach((player) => {
    const key = `${normalizeLookupKey(player?.name || '')}|${normalizeLookupKey(player?.owner || ownerEntry?.name || '')}`;
    if (!key || key === '|') return;
    if (seen.has(key)) return;
    seen.add(key);
    dedupedPlayers.push(player);
  });
  const players = dedupedPlayers;
  const slotCounts = players.reduce((acc, player) => {
    const position = getDraftSlotPosition(player);
    if (isGoalieTeamPosition(position)) {
      acc.goalieTeams += 1;
      return acc;
    }
    if (isSkaterPosition(position)) {
      acc.skaters += 1;
      return acc;
    }
    acc.unclassified += 1;
    return acc;
  }, { skaters: 0, goalieTeams: 0, unclassified: 0 });

  const retainedSpend = Number.isFinite(sheetBudget?.totalSpent)
    ? sheetBudget.totalSpent
    : players.reduce((sum, player) => sum + getPlayerRetainedCost(player), 0);
  const skatersNeeded = Math.max(0, DRAFT_ROSTER_RULES.targetSkaters - slotCounts.skaters);
  const goalieTeamsNeeded = Math.max(0, DRAFT_ROSTER_RULES.targetGoalieTeams - slotCounts.goalieTeams);
  const slotsNeeded = Number.isInteger(sheetBudget?.openSlots)
    ? sheetBudget.openSlots
    : skatersNeeded + goalieTeamsNeeded;
  const remainingBudget = Number.isFinite(sheetBudget?.remainingBudget) ? sheetBudget.remainingBudget : null;
  const minimumRequired = Number((slotsNeeded * DRAFT_ROSTER_RULES.minSlotCost).toFixed(2));
  const budgetShortfall = remainingBudget === null
    ? null
    : Number(Math.max(0, minimumRequired - remainingBudget).toFixed(2));

  return {
    owner: ownerEntry?.name || 'Unknown',
    retainedSpend: Number(retainedSpend.toFixed(2)),
    remainingBudget,
    playersDrafted: sheetBudget?.playersDrafted ?? slotCounts.skaters + slotCounts.goalieTeams,
    openSlots: slotsNeeded,
    keeperCosts: sheetBudget?.keeperCosts ?? null,
    rookieFarmCosts: sheetBudget?.rookieFarmCosts ?? null,
    penalties: sheetBudget?.penalties ?? null,
    adjustments: sheetBudget?.adjustments ?? null,
    skaters: slotCounts.skaters,
    goalieTeams: slotCounts.goalieTeams,
    unclassified: slotCounts.unclassified,
    skatersNeeded,
    goalieTeamsNeeded,
    slotsNeeded,
    minimumRequired,
    budgetShortfall,
    hasOverfilledSkaters: slotCounts.skaters > DRAFT_ROSTER_RULES.targetSkaters,
    hasOverfilledGoalieTeams: slotCounts.goalieTeams > DRAFT_ROSTER_RULES.targetGoalieTeams,
  };
}

function getRecordType(record) {
  const explicit = normalizeClassification(pickRecordValue(record, ['classification', 'type']));
  if (explicit) return explicit;
  if (isTruthyRecordValue(pickRecordValue(record, ['farm']))) return 'Farm';
  if (isTruthyRecordValue(pickRecordValue(record, ['veteran']))) return 'Veteran';
  if (isTruthyRecordValue(pickRecordValue(record, ['rookie', 'prospect']))) return 'Rookie';
  return '';
}

function getPlayerAvailability(player, availableKeys) {
  const isAvailable = player.status !== 'not-in-ahl'
    && player.localStatus !== 'removed-local'
    && availableKeys.has(normalizeLookupKey(player.name));
  return isAvailable ? 'Available' : 'Unavailable';
}

// Token-efficient routing: unavailable players (drafted in AHL) are always routed to Draft Board.
function routePlayerPanel(player) {
  if (player.availability === 'Unavailable') return 'DraftBoard';
  return 'BestAvailable';
}

function getAvailableStatus(record) {
  const owner = getRecordOwner(record);
  const availableField = pickRecordValue(record, ['available', 'isavailable', 'undrafted']);
  const draftedField = pickRecordValue(record, ['drafted', 'draftstatus', 'draft_status']);
  const retainedField = pickRecordValue(record, ['retained', 'retention', 'kept']);
  const drafted = isTruthyRecordValue(draftedField);
  const retained = isTruthyRecordValue(retainedField);
  const explicitlyAvailable = hasExplicitAvailableSignal(record);

  if (owner && explicitlyAvailable) {
    return { status: 'conflict', label: 'Assigned but marked available' };
  }

  if (!owner && (retained || drafted)) {
    return { status: 'conflict', label: retained ? 'Retained but unowned' : 'Drafted but unowned' };
  }

  if (owner || retained || drafted) {
    return {
      status: retained ? 'retained' : drafted ? 'drafted' : 'owned',
      label: retained ? 'Retained' : drafted ? 'Drafted' : 'Owned',
    };
  }

  if (isFalsyRecordValue(availableField)) {
    return { status: 'unavailable', label: 'Not available' };
  }

  if (explicitlyAvailable || !owner) {
    return { status: 'available', label: 'Available' };
  }

  return { status: 'unknown', label: 'Unknown' };
}

function createManualOverrideDraft(data) {
  const name = String(data?.name || '').trim();
  const position = String(data?.position || '').trim().toUpperCase();
  const finalPositionOverride = ['C', 'LW', 'RW', 'D', 'G'].includes(position) ? position : '';
  const classification = normalizeClassification(data?.classification);
  const notes = String(data?.notes || '').trim();
  if (!name || !finalPositionOverride || !classification) {
    return null;
  }

  const createdAt = new Date().toISOString();
  const idSeed = `${name}-${classification}-${createdAt}`;
  const overrideId = `manual-${normalizeLookupKey(idSeed).replace(/\s+/g, '-')}`;

  return {
    id: overrideId,
    name,
    position: finalPositionOverride,
    finalPositionOverride,
    classification,
    experienceTier: classification,
    status: 'not-in-ahl',
    pricing: null,
    forecast: null,
    owner: null,
    availability: 'unavailable',
    notes,
    createdAt,
    addedBy: 'Local User',
    manualOverride: true,
  };
}

function updateManualOverrides(stateObj, nextOverrides) {
  const next = normalizeState(stateObj);
  next.manualOverrides = Array.isArray(nextOverrides) ? nextOverrides : [];
  persistState(next);
  return next;
}

function removeManualOverrideById(stateObj, overrideId) {
  const nextOverrides = (stateObj.manualOverrides || []).filter((entry) => entry.id !== overrideId);
  return updateManualOverrides(stateObj, nextOverrides);
}

function addManualOverrideEntry(stateObj, draft) {
  const entry = createManualOverrideDraft(draft);
  if (!entry) {
    return { state: normalizeState(stateObj), error: 'Name, position, and classification are required.' };
  }

  const next = normalizeState(stateObj);
  next.manualOverrides = [...(next.manualOverrides || []), entry];
  persistState(next);
  return { state: next, entry };
}

function normalizeWorkingStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'Assigned';
  if (text === 'assigned') return 'Assigned';
  if (text === 'winning team') return 'Winning Team';
  if (text === 'winning bid') return 'Winning Bid';
  if (text === 'tbd') return 'TBD';
  return 'Assigned';
}

function normalizeWorkingClassification(value, fallback = 'Rookie') {
  const normalized = normalizeClassification(value);
  if (normalized) return normalized;
  const fallbackNormalized = normalizeClassification(fallback);
  return fallbackNormalized || 'Rookie';
}

function createWorkingAssignmentDraft(data) {
  const playerKey = String(data?.playerKey || '').trim();
  const name = String(data?.name || '').trim();
  const team = String(data?.team || '').trim();
  const position = String(data?.position || '').trim();
  const classification = normalizeWorkingClassification(data?.classification, data?.fallbackClassification);
  const status = normalizeWorkingStatus(data?.status);
  const bidRaw = String(data?.bid ?? '').trim();
  const bidNumeric = Number(bidRaw);
  if (!playerKey || !name || !team) {
    return null;
  }
  const halfDollarIncrement = Number.isFinite(bidNumeric) && Math.abs((bidNumeric * 2) - Math.round(bidNumeric * 2)) < 1e-8;
  if (!halfDollarIncrement || bidNumeric < DRAFT_ROSTER_RULES.minSlotCost) {
    return null;
  }

  return {
    playerKey,
    name,
    team,
    position: position || '—',
    classification,
    status,
    bid: Number(bidNumeric.toFixed(2)),
    updatedAt: new Date().toISOString(),
  };
}

function upsertWorkingAssignment(stateObj, draft) {
  const entry = createWorkingAssignmentDraft(draft);
  if (!entry) {
    return {
      state: normalizeState(stateObj),
      error: `Team, bid, and a $0.50 bid increment are required. Minimum bid is $${DRAFT_ROSTER_RULES.minSlotCost.toFixed(2)}.`,
    };
  }

  const next = normalizeState(stateObj);
  const current = next.workingAssignments && typeof next.workingAssignments === 'object' ? next.workingAssignments : {};
  next.workingAssignments = {
    ...current,
    [entry.playerKey]: entry,
  };
  persistState(next);
  return { state: next, entry };
}

function removeWorkingAssignment(stateObj, playerKey) {
  const key = String(playerKey || '').trim();
  if (!key) return normalizeState(stateObj);
  const next = normalizeState(stateObj);
  const current = { ...(next.workingAssignments || {}) };
  delete current[key];
  next.workingAssignments = current;
  persistState(next);
  return next;
}

function buildDraftValidationReport(stateObj) {
  const nextState = normalizeState(stateObj);
  const ownerData = buildOwnerViewData(nextState);
  const rosterPlayers = Object.values(nextState.datasets.roster?.players || {});
  const prospects = Object.values(nextState.datasets.prospects?.prospects || {});
  const veterans = Object.values(nextState.datasets.veterans?.veterans || {});
  const manualOverrides = Array.isArray(nextState.manualOverrides) ? nextState.manualOverrides : [];
  const workingAssignments = nextState.workingAssignments && typeof nextState.workingAssignments === 'object' ? nextState.workingAssignments : {};
  const zeroYearsProspectKeys = new Set(
    prospects
      .filter(hasZeroYearsAvailable)
      .map((player) => normalizeLookupKey(getRecordName(player)))
      .filter(Boolean),
  );
  const snapshot = getSnapshotAgeInfo(nextState);
  const sheetBudgets = nextState.datasets.roster?.teamBudgets || [];
  const ownerDraftPlans = ownerData.owners.map((owner) => {
    const sheetBudget = sheetBudgets.find(
      (entry) => normalizeLookupKey(entry.team) === normalizeLookupKey(owner.name),
    );
    if (!sheetBudget) return buildOwnerDraftPlan(owner);
    const teamAssignments = Object.values(workingAssignments)
      .filter((entry) => normalizeLookupKey(entry?.team) === normalizeLookupKey(owner.name));
    return buildOwnerDraftPlan(owner, {
      ...sheetBudget,
      remainingBudget: Number.isFinite(sheetBudget.remainingBudget)
        ? Number((sheetBudget.remainingBudget - teamAssignments.reduce((sum, entry) => sum + Number(entry.bid || 0), 0)).toFixed(2))
        : null,
      playersDrafted: Number.isInteger(sheetBudget.playersDrafted)
        ? sheetBudget.playersDrafted + teamAssignments.length
        : null,
      openSlots: Number.isInteger(sheetBudget.openSlots)
        ? Math.max(0, sheetBudget.openSlots - teamAssignments.length)
        : null,
    });
  });
  const inventoryByKey = new Map();
  [
    ...Object.values(nextState.datasets.positions?.players || {}),
    ...Object.values(nextState.datasets.utility?.players || {}),
    ...rosterPlayers.filter((player) => ['inventory', 'utility'].includes(String(player?.source || '').toLowerCase())),
  ]
    .forEach((player) => {
      const key = normalizeLookupKey(getRecordName(player));
      if (key && !inventoryByKey.has(key)) {
        inventoryByKey.set(key, player);
      }
    });
  const inventoryKeyByAlias = new Map();
  inventoryByKey.forEach((player, key) => {
    getRosterPlayerIdentityAliases(getRecordName(player)).forEach((alias) => {
      const current = inventoryKeyByAlias.get(alias);
      inventoryKeyByAlias.set(alias, current === undefined || current === key ? key : null);
    });
  });
  const resolveInventoryKey = (name) => {
    const aliases = getRosterPlayerIdentityAliases(name);
    for (const alias of aliases) {
      if (inventoryByKey.has(alias)) return alias;
    }
    for (const alias of aliases) {
      const match = inventoryKeyByAlias.get(alias);
      if (match) return match;
    }
    return null;
  };
  const ownedInventoryKeys = new Set();
  const retainedInventoryKeys = new Set();
  const draftedInventoryKeys = new Set();
  const workingInventoryKeys = new Set();
  [...rosterPlayers, ...prospects, ...veterans].forEach((player) => {
    if (!getRecordOwner(player)) return;
    const key = resolveInventoryKey(getRecordName(player));
    if (key) ownedInventoryKeys.add(key);
  });
  [...prospects, ...veterans].forEach((player) => {
    const key = resolveInventoryKey(getRecordName(player));
    if (key) retainedInventoryKeys.add(key);
  });
  Object.values(nextState.datasets.draft?.players || {}).forEach((player) => {
    const key = resolveInventoryKey(getRecordName(player));
    if (key) draftedInventoryKeys.add(key);
  });
  Object.entries(workingAssignments).forEach(([assignmentKey, assignment]) => {
    const key = resolveInventoryKey(assignment?.name) || resolveInventoryKey(assignmentKey);
    if (key) workingInventoryKeys.add(key);
  });

  const rosterByKey = new Map();
  rosterPlayers.forEach((player) => {
    const key = normalizeLookupKey(getRecordName(player));
    if (key) {
      rosterByKey.set(key, player);
    }
  });

  const occurrencesByKey = new Map();
  const addOccurrence = (record, sourceType) => {
    const name = getRecordName(record);
    const key = normalizeLookupKey(name);
    if (!key) return;
    if (!occurrencesByKey.has(key)) {
      occurrencesByKey.set(key, []);
    }
    occurrencesByKey.get(key).push({
      sourceType,
      name,
      owner: getRecordOwner(record),
      record,
    });
  };

  prospects.forEach((record) => addOccurrence(record, 'prospect'));
  veterans.forEach((record) => addOccurrence(record, 'veteran'));
  rosterPlayers.forEach((record) => addOccurrence(record, 'roster'));

  const duplicateOwnershipIssues = [];
  const missingOwnershipIssues = [];
  const ownershipMismatches = [];
  const missingClassificationIssues = [];
  const retentionIssues = [];
  const availableIntegrityIssues = [];
  const availablePlayers = [];

  occurrencesByKey.forEach((entries, key) => {
    const owners = [...new Set(entries.map((entry) => entry.owner).filter(Boolean))];
    if (owners.length > 1) {
      duplicateOwnershipIssues.push(`${entries[0].name}: ${owners.join(' / ')}`);
    }

    const rosterEntry = entries.find((entry) => entry.sourceType === 'roster')?.record || rosterByKey.get(key) || null;
    const rosterOwner = getRecordOwner(rosterEntry);
    const rosterAvailableState = rosterEntry ? getAvailableStatus(rosterEntry) : null;

    if (entries.some((entry) => entry.sourceType !== 'roster' && !entry.owner)) {
      missingOwnershipIssues.push(entries[0].name);
    } else if (rosterEntry && !rosterOwner && rosterAvailableState?.status !== 'available') {
      missingOwnershipIssues.push(entries[0].name);
    }

    entries.forEach((entry) => {
      const classification = getRecordType(entry.record) || (entry.sourceType === 'veteran' ? 'Veteran' : entry.sourceType === 'prospect' ? 'Rookie' : '');
      if (entry.sourceType !== 'roster' && !classification) {
        missingClassificationIssues.push(entry.name);
      }

      if (entry.sourceType === 'veteran') {
        const retentionYear = pickRecordValue(entry.record, ['retentionyear', 'retention_year']);
        if (!String(retentionYear || '').trim()) {
          retentionIssues.push(`${entry.name} is missing retention year`);
        }
      }

    });

    if (rosterEntry) {
      const availableState = rosterAvailableState || getAvailableStatus(rosterEntry);
      if (availableState.status === 'conflict') {
        availableIntegrityIssues.push(`${getRecordName(rosterEntry) || key}: ${availableState.label}`);
      }
      if (availableState.status === 'available' && owners.length && hasExplicitAvailableSignal(rosterEntry)) {
        availableIntegrityIssues.push(`${getRecordName(rosterEntry) || key}: owned in sheet but flagged available in roster`);
      }
      if (owners.length && rosterOwner && !owners.includes(rosterOwner)) {
        ownershipMismatches.push(`${getRecordName(rosterEntry) || key}: roster=${rosterOwner}, sheet=${owners.join(' / ')}`);
      }
    }
  });

  inventoryByKey.forEach((record, key) => {
    if (
      ownedInventoryKeys.has(key)
      || retainedInventoryKeys.has(key)
      || draftedInventoryKeys.has(key)
      || workingInventoryKeys.has(key)
      || zeroYearsProspectKeys.has(key)
   ) {
     return;
   }
   availablePlayers.push({
     key,
     name: getRecordName(record) || key,
      position: getDraftSlotPosition(record) || getRecordPosition(record) || '—',
      type: getRecordType(record) || 'Unknown',
      owner: '—',
      status: 'Available',
      manualOverride: false,
    });
  });

  const assignedPlayers = Object.values(workingAssignments)
    .filter((entry) => entry && entry.playerKey && entry.name && entry.team)
    .map((entry) => ({
      playerKey: entry.playerKey,
      name: entry.name,
      team: entry.team,
      bid: Number(entry.bid || 0),
      classification: normalizeWorkingClassification(entry.classification, 'Rookie'),
      status: normalizeWorkingStatus(entry.status),
      position: entry.position || '—',
      updatedAt: entry.updatedAt || null,
    }))
    .sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

  const assignedByTeam = assignedPlayers.reduce((acc, player) => {
    if (!acc[player.team]) acc[player.team] = [];
    acc[player.team].push(player);
    return acc;
  }, {});

  const validationRows = [
    {
      key: 'ownership-integrity',
      label: 'Ownership Integrity',
      status: ownershipMismatches.length ? 'error' : missingOwnershipIssues.length ? 'warning' : 'valid',
      message: ownershipMismatches.length
        ? `${ownershipMismatches.length} roster ownership mismatch${ownershipMismatches.length === 1 ? '' : 'es'}`
        : missingOwnershipIssues.length
          ? `${missingOwnershipIssues.length} player${missingOwnershipIssues.length === 1 ? '' : 's'} missing ownership`
          : 'Ownership matches across sources',
      count: ownershipMismatches.length || missingOwnershipIssues.length,
    },
    {
      key: 'duplicate-ownership',
      label: 'Duplicate Ownership',
      status: duplicateOwnershipIssues.length ? 'error' : 'valid',
      message: duplicateOwnershipIssues.length
        ? `${duplicateOwnershipIssues.length} duplicate ownership issue${duplicateOwnershipIssues.length === 1 ? '' : 's'}`
        : 'No duplicate ownership detected',
      count: duplicateOwnershipIssues.length,
    },
    {
      key: 'missing-classification',
      label: 'Missing Classification',
      status: missingClassificationIssues.length ? 'warning' : 'valid',
      message: missingClassificationIssues.length
        ? `${missingClassificationIssues.length} record${missingClassificationIssues.length === 1 ? '' : 's'} need classification`
        : 'All records classified',
      count: missingClassificationIssues.length,
    },
    {
      key: 'retention-integrity',
      label: 'Retention Integrity',
      status: retentionIssues.length ? 'warning' : 'valid',
      message: retentionIssues.length
        ? `${retentionIssues.length} veteran record${retentionIssues.length === 1 ? '' : 's'} need retention data`
        : 'Retention data is present',
      count: retentionIssues.length,
    },
    {
      key: 'available-player-integrity',
      label: 'Available Player Integrity',
      status: availableIntegrityIssues.length ? 'error' : 'valid',
      message: availableIntegrityIssues.length
        ? `${availableIntegrityIssues.length} available-player conflict${availableIntegrityIssues.length === 1 ? '' : 's'}`
        : 'Available pool is internally consistent',
      count: availableIntegrityIssues.length,
    },
    {
      key: 'ahl-draft-budgets',
      label: 'AHL Draft Budgets',
      status: ownerDraftPlans.some((plan) => plan.remainingBudget === null) ? 'warning' : 'valid',
      message: ownerDraftPlans.some((plan) => plan.remainingBudget === null)
        ? `${ownerDraftPlans.filter((plan) => plan.remainingBudget === null).length} team${ownerDraftPlans.filter((plan) => plan.remainingBudget === null).length === 1 ? '' : 's'} missing a usable AHL Draft balance`
        : 'Team balances match the AHL Draft sheet, less local working assignments',
      count: ownerDraftPlans.filter((plan) => plan.remainingBudget === null).length,
    },
    {
      key: 'draft-roster-rules',
      label: 'Draft Roster Rules (23 skaters + 2 goalie teams)',
      status: ownerDraftPlans.some((plan) => plan.budgetShortfall > 0 || plan.hasOverfilledSkaters || plan.hasOverfilledGoalieTeams || plan.remainingBudget < 0)
        ? 'error'
        : ownerDraftPlans.some((plan) => plan.unclassified > 0)
          ? 'warning'
          : 'valid',
      message: ownerDraftPlans.some((plan) => plan.budgetShortfall > 0 || plan.hasOverfilledSkaters || plan.hasOverfilledGoalieTeams || plan.remainingBudget < 0)
        ? `${ownerDraftPlans.filter((plan) => plan.budgetShortfall > 0 || plan.hasOverfilledSkaters || plan.hasOverfilledGoalieTeams || plan.remainingBudget < 0).length} team${ownerDraftPlans.filter((plan) => plan.budgetShortfall > 0 || plan.hasOverfilledSkaters || plan.hasOverfilledGoalieTeams || plan.remainingBudget < 0).length === 1 ? '' : 's'} cannot satisfy roster or budget floor at $${DRAFT_ROSTER_RULES.minSlotCost.toFixed(2)} per open slot`
        : ownerDraftPlans.some((plan) => plan.unclassified > 0)
          ? `${ownerDraftPlans.filter((plan) => plan.unclassified > 0).length} team${ownerDraftPlans.filter((plan) => plan.unclassified > 0).length === 1 ? '' : 's'} contain unclassified roster positions`
          : 'All teams can still complete 23 skaters + 2 goalie teams with the $0.50 minimum slot cost',
      count: ownerDraftPlans.filter((plan) => plan.budgetShortfall > 0 || plan.hasOverfilledSkaters || plan.hasOverfilledGoalieTeams || plan.remainingBudget < 0).length,
    },
  ];

  const hasErrors = validationRows.some((check) => check.status === 'error');
  const hasWarnings = validationRows.some((check) => check.status === 'warning');

  return {
    snapshot,
    validationRows,
    validationHealth: hasErrors ? 'error' : hasWarnings ? 'warning' : 'valid',
    retentionListLoaded: isRetentionListLoaded(nextState),
    counts: {
      ownershipCount: prospects.filter((player) => getRecordOwner(player)).length + veterans.filter((player) => getRecordOwner(player)).length,
      rosterCount: rosterPlayers.length,
      availableCount: availablePlayers.filter((player) => !player.manualOverride).length,
      manualOverrideCount: manualOverrides.length,
      duplicateOwnershipCount: duplicateOwnershipIssues.length,
      missingOwnershipCount: missingOwnershipIssues.length,
      missingClassificationCount: missingClassificationIssues.length,
      retentionIssuesCount: retentionIssues.length,
      availableIntegrityCount: availableIntegrityIssues.length,
      ownerDraftPlanCount: ownerDraftPlans.length,
      workingAssignedCount: assignedPlayers.length,
    },
    details: {
      duplicateOwnershipIssues,
      missingOwnershipIssues,
      ownershipMismatches,
      missingClassificationIssues,
      retentionIssues,
      availableIntegrityIssues,
    },
    availablePlayers,
    assignedPlayers,
    assignedByTeam,
    workingAssignments,
    manualOverrides,
    ownerDraftPlans,
    draftRosterRules: DRAFT_ROSTER_RULES,
  };
}

// ----------------------------
// Dashboard / Owner Statistics helpers
// ----------------------------

function computeDashboardSummary(stateObj) {
  const prospects = Object.values(stateObj.datasets.prospects?.prospects || {});
  const veterans = Object.values(stateObj.datasets.veterans?.veterans || {});
  const rosterPlayers = Object.values(stateObj.datasets.roster?.players || {});
  const ownerSet = new Set();
  if (stateObj.datasets.prospects?.owners) Object.keys(stateObj.datasets.prospects.owners).forEach((o) => ownerSet.add(o));
  if (stateObj.datasets.veterans?.owners) Object.keys(stateObj.datasets.veterans.owners).forEach((o) => ownerSet.add(o));
  rosterPlayers.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });
  prospects.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });
  veterans.forEach((v) => { if (v && v.owner) ownerSet.add(v.owner); });

  const totalOwners = ownerSet.size;
  const totalProspects = prospects.length;
  const totalVeterans = veterans.length;
  const totalFarmPlayers = prospects.filter((p) => p.farm).length;
  const totalMatchingRights = prospects.filter((p) => hasZeroYearsAvailable(p) && p.matchingRights).length;

  return { totalOwners, totalProspects, totalVeterans, totalFarmPlayers, totalMatchingRights };
}

function computeOwnerStatistics(ownerEntry) {
  const prospectCount = (ownerEntry.prospects || []).length;
  const veteranCount = (ownerEntry.veterans || []).length;
  const farmCount = (ownerEntry.farmPlayers || []).length;
  const matchingRightsCount = (ownerEntry.matchingRights || []).length;

  const unifiedProspects = (ownerEntry.prospects || []).map((p) => ({ player: p, unified: buildUnifiedPlayer(p) }));
  const totalProspectCost = unifiedProspects.reduce((sum, { unified }) => sum + (unified.cost || 0), 0);
  const averageProspectCost = prospectCount ? totalProspectCost / prospectCount : 0;

  let highest = null;
  unifiedProspects.forEach(({ player: p, unified }) => {
    const c = unified.cost || 0;
    if (highest === null || c > highest.cost) {
      highest = { playerId: p.playerId, name: p.name, cost: c };
    }
  });

  return {
    prospectCount,
    veteranCount,
    farmCount,
    matchingRightsCount,
    totalProspectCost,
    averageProspectCost,
    highestCostProspect: highest,
  };
}

// ----------------------------
// League Intelligence & Data Quality
// ----------------------------

function computeOwnerAggregates(stateObj) {
  const prospects = Object.values(stateObj.datasets.prospects?.prospects || {});
  const veterans = Object.values(stateObj.datasets.veterans?.veterans || {});

  const ownerAggregates = {}; // owner -> aggregates

  function ensureOwner(o) {
    if (!o) return;
    if (!ownerAggregates[o]) {
      ownerAggregates[o] = {
        prospectCount: 0,
        veteranCount: 0,
        farmCount: 0,
        matchingRightsCount: 0,
        totalProspectCost: 0,
        highestProspect: null,
      };
    }
  }

  // Prospects
  prospects.forEach((p) => {
    const o = p.owner || 'Unknown';
    ensureOwner(o);
    const agg = ownerAggregates[o];
    const unified = buildUnifiedPlayer(p);
    agg.prospectCount += 1;
    if (unified.farmStatus) agg.farmCount += 1;
    if (p.matchingRights) agg.matchingRightsCount += 1;
    const c = unified.cost || 0;
    agg.totalProspectCost += c;
    if (!agg.highestProspect || c > agg.highestProspect.cost) {
      agg.highestProspect = { playerId: p.playerId, name: p.name, cost: c };
    }
  });

  // Veterans
  veterans.forEach((v) => {
    const o = v.owner || 'Unknown';
    ensureOwner(o);
    const agg = ownerAggregates[o];
    agg.veteranCount += 1;
  });

  // Compute derived fields and global metrics
  let mostProspects = { owner: null, count: -1 };
  let mostVeterans = { owner: null, count: -1 };
  let mostFarm = { owner: null, count: -1 };
  let mostMatching = { owner: null, count: -1 };
  let mostExpensiveProspect = null;
  let mostExpensiveVeteran = null;

  Object.entries(ownerAggregates).forEach(([owner, agg]) => {
    if (agg.prospectCount > mostProspects.count || (agg.prospectCount === mostProspects.count && owner < (mostProspects.owner || ''))) {
      mostProspects = { owner, count: agg.prospectCount };
    }
    if (agg.veteranCount > mostVeterans.count || (agg.veteranCount === mostVeterans.count && owner < (mostVeterans.owner || ''))) {
      mostVeterans = { owner, count: agg.veteranCount };
    }
    if (agg.farmCount > mostFarm.count || (agg.farmCount === mostFarm.count && owner < (mostFarm.owner || ''))) {
      mostFarm = { owner, count: agg.farmCount };
    }
    if (agg.matchingRightsCount > mostMatching.count || (agg.matchingRightsCount === mostMatching.count && owner < (mostMatching.owner || ''))) {
      mostMatching = { owner, count: agg.matchingRightsCount };
    }

    // candidate for most expensive prospect
    if (agg.highestProspect) {
      if (!mostExpensiveProspect || agg.highestProspect.cost > mostExpensiveProspect.cost) {
        mostExpensiveProspect = { owner, ...agg.highestProspect };
      }
    }
  });

  // most expensive veteran from veterans list
  veterans.forEach((v) => {
    const cost = Number(v.currentCost ?? v.currentcost ?? v.current) || 0;
    if (!mostExpensiveVeteran || cost > mostExpensiveVeteran.cost) {
      mostExpensiveVeteran = { owner: v.owner || 'Unknown', playerId: v.playerId, name: v.name, cost };
    }
  });

  return {
    ownerAggregates,
    global: {
      mostProspects,
      mostVeterans,
      mostFarm,
      mostMatching,
      mostExpensiveProspect,
      mostExpensiveVeteran,
    },
  };
}

function renderLeagueIntelligence(aggregates) {
  const g = aggregates.global;
  const mep = g.mostExpensiveProspect ? `${escapeHtml(g.mostExpensiveProspect.name)} (${g.mostExpensiveProspect.owner}) $${formatValue(g.mostExpensiveProspect.cost)}` : '—';
  const mev = g.mostExpensiveVeteran ? `${escapeHtml(g.mostExpensiveVeteran.name)} (${g.mostExpensiveVeteran.owner}) $${formatValue(g.mostExpensiveVeteran.cost)}` : '—';

  return `
    <section class="panel league-intel">
      <h3>League Intelligence</h3>
      <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px;">
        <div class="meta-pill">Most Prospects: ${g.mostProspects.owner ? escapeHtml(g.mostProspects.owner) + ` (${g.mostProspects.count})` : '—'}</div>
        <div class="meta-pill">Most Veterans: ${g.mostVeterans.owner ? escapeHtml(g.mostVeterans.owner) + ` (${g.mostVeterans.count})` : '—'}</div>
        <div class="meta-pill">Most Farm Players: ${g.mostFarm.owner ? escapeHtml(g.mostFarm.owner) + ` (${g.mostFarm.count})` : '—'}</div>
        <div class="meta-pill">Most Matching Rights: ${g.mostMatching.owner ? escapeHtml(g.mostMatching.owner) + ` (${g.mostMatching.count})` : '—'}</div>
        <div class="meta-pill">Most Expensive Prospect: ${mep}</div>
        <div class="meta-pill">Most Expensive Veteran: ${mev}</div>
      </div>
    </section>
  `;
}

function renderLocalEditMismatchesPanel(mismatches) {
  const issues = mismatches || [];
  if (!issues.length) {
    return `
      <section class="panel local-edit-mismatches">
        <h3>Local Edit Mismatches</h3>
        <div class="empty-state">No conflicts between local draft edits and the AHL Sheets.</div>
      </section>
    `;
  }

  const rows = issues.map((issue) => `
    <tr>
      <td>${escapeHtml(issue.name)}</td>
      <td>${escapeHtml(issue.sheetOwner)}</td>
      <td>${escapeHtml(issue.localOwner)}</td>
      <td>${escapeHtml(issue.source === 'manual-assignment' ? 'Manual Assignment' : 'Winning Bid')}</td>
    </tr>
  `).join('');

  return `
    <section class="panel local-edit-mismatches">
      <h3>Local Edit Mismatches</h3>
      <p class="panel-subtitle">These players have a local draft edit that disagrees with the AHL Sheets owner. Refresh AHL Sheets or clear the local edit to resolve.</p>
      <div class="table-wrap">
        <table class="validation-table">
          <thead><tr><th>Player</th><th>Sheet Owner</th><th>Local Owner</th><th>Source</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDataQualityPanel(stateObj) {
  const sources = getDataQualitySources(stateObj);
  const rows = sources.map((source) => {
    const status = source.status === 'ok' ? '✅' : '❌';
    const records = source.records != null ? `(${source.records})` : '';
    const when = source.importedAt ? `Imported: ${new Date(source.importedAt).toLocaleString()}` : '';
    return `<div class="dq-row">${status} <strong>${escapeHtml(source.label)}</strong> ${records} <div class="dq-meta">${when}</div></div>`;
  }).join('');

  const lastUpdated = (() => {
    const times = sources.map((source) => source.importedAt).filter(Boolean).map((time) => new Date(time).getTime());
    if (!times.length) return 'Never';
    return new Date(Math.max(...times)).toLocaleString();
  })();

  return `
    <section class="panel data-quality">
      <h3>Data Quality</h3>
      <div style="margin-top:10px;">${rows}</div>
      <div style="margin-top:8px;color:var(--muted);font-size:0.9rem;">Last updated: ${escapeHtml(lastUpdated)}</div>
    </section>
  `;
}

function renderDraftStatusPanel(stateObj, report) {
  const snapshot = getSnapshotAgeInfo(stateObj);
  const liveCache = getLiveCacheStatus(state.liveCache);
  const compactMode = isCompactViewport();
  const latestImportAt = ['prospects', 'veterans', 'roster', 'transactions']
    .map((dataset) => stateObj?.metadata?.[dataset]?.importedAt)
    .filter(Boolean)
    .sort()
    .pop() || null;
  const trustStatus = report.validationHealth === 'error'
    ? { label: 'Review before draft use', detail: 'Validation errors are present. Refresh or fix the snapshot first.', tone: 'danger' }
    : report.validationHealth === 'warning'
      ? { label: 'Usable with caution', detail: 'Warnings exist. Double-check the flagged rows before making live decisions.', tone: 'warning' }
      : { label: 'Ready for draft decisions', detail: 'Snapshot, ownership, and roster rules are aligned with the current checks.', tone: 'success' };

  const datasetRows = ['prospects', 'veterans', 'roster', 'transactions'].map((dataset) => {
    const metadata = stateObj?.metadata?.[dataset] || { status: 'empty' };
    const label = dataset.charAt(0).toUpperCase() + dataset.slice(1);
    const statusText = metadata.status === 'ok' ? 'Loaded' : 'Missing';
    const sourceText = metadata.sourceName ? ` · ${escapeHtml(metadata.sourceName)}` : '';
    return `
      <div class="status-row">
        <span>${escapeHtml(label)}</span>
        <strong>${statusText}</strong>
        <span class="status-row-meta">${metadata.records ?? 0} record${metadata.records === 1 ? '' : 's'}${sourceText}</span>
      </div>
    `;
  }).join('');

  return `
    <section class="panel draft-status-panel">
      <div class="preview-header">
        <div>
          <h2>Draft-Day Control Center</h2>
          <div class="panel-subtitle">Use a laptop for editing. Use a phone for lookup, freshness checks, and emergency access.</div>
        </div>
        <div class="preview-meta">
          <span class="meta-pill">${compactMode ? 'Phone Lookup Mode' : 'Laptop Draft Mode'}</span>
          <span class="meta-pill">${snapshot.label}</span>
          <span class="meta-pill">${liveCache.label}</span>
        </div>
      </div>
      <div class="status-grid">
        <article class="status-card">
          <h3>Trust this snapshot?</h3>
          <div class="status-callout tone-${trustStatus.tone}">
            <strong>${trustStatus.label}</strong>
            <div>${trustStatus.detail}</div>
          </div>
          <div class="status-detail-list">
            <div><strong>Snapshot:</strong> ${escapeHtml(snapshot.details)}</div>
            <div><strong>Latest import:</strong> ${escapeHtml(formatTimestamp(latestImportAt))}</div>
            <div><strong>Live cache:</strong> ${escapeHtml(liveCache.details)}</div>
          </div>
        </article>
        <article class="status-card">
          <h3>What is loaded?</h3>
          <div class="status-list">${datasetRows}</div>
        </article>
        <article class="status-card">
          <h3>Portable backup</h3>
          <div class="status-detail-list">
            <div><strong>Export State:</strong> save this dashboard before leaving your main machine.</div>
            <div><strong>Import Saved State:</strong> reopen the same working state on another laptop or browser.</div>
            <div><strong>Fallback:</strong> if live data is missing, the local CSV snapshot still drives the app.</div>
          </div>
          <div class="mobile-only-note">Phone mode is read-only on purpose. Use your laptop for assignments and manual overrides.</div>
        </article>
      </div>
    </section>
  `;
}

function renderValidationStatusText(status) {
  if (status === 'error') return '❌ Error';
  if (status === 'warning') return '⚠ Warning';
  return '✅ Valid';
}

function renderDraftValidationCenter(report) {
  const ownerPlanRows = (report.ownerDraftPlans || []).map((plan) => {
    let status = 'Ready';
    if (plan.remainingBudget === null) {
      status = 'Budget unavailable';
    } else if (plan.budgetShortfall > 0 || plan.remainingBudget < 0 || plan.hasOverfilledSkaters || plan.hasOverfilledGoalieTeams) {
      status = 'Shortfall';
    } else if (plan.unclassified > 0) {
      status = 'Needs Position Cleanup';
    }

    return `
      <tr>
        <td>${escapeHtml(plan.owner)}</td>
        <td>$${formatValue(plan.retainedSpend)}</td>
        <td>$${formatValue(plan.remainingBudget)}</td>
        <td>${plan.skaters}/${report.draftRosterRules?.targetSkaters ?? DRAFT_ROSTER_RULES.targetSkaters}</td>
        <td>${plan.goalieTeams}/${report.draftRosterRules?.targetGoalieTeams ?? DRAFT_ROSTER_RULES.targetGoalieTeams}</td>
        <td>${plan.slotsNeeded}</td>
        <td>$${formatValue(plan.minimumRequired)}</td>
        <td>${plan.budgetShortfall > 0 ? `$${formatValue(plan.budgetShortfall)}` : '—'}</td>
        <td>${escapeHtml(status)}</td>
      </tr>
    `;
  }).join('');

  const rows = report.validationRows.map((row) => `
    <div class="validation-row validation-${row.status}">
      <div>
        <div class="validation-label">${escapeHtml(row.label)}</div>
        <div class="validation-message">${escapeHtml(row.message)}</div>
      </div>
      <div class="validation-pill">${renderValidationStatusText(row.status)}</div>
    </div>
  `).join('');

  return `
    <section class="panel validation-panel">
      <div class="preview-header">
        <div>
          <h3>League Validation Center</h3>
          <div class="panel-subtitle">Refresh, validate, and trust the sheet-backed retention list before draft decisions.</div>
        </div>
        <div class="preview-meta">
          <span class="meta-pill">${renderValidationStatusText(report.validationHealth)}</span>
          <span class="meta-pill">${escapeHtml(report.snapshot.label)}</span>
          <span class="meta-pill">${report.retentionListLoaded ? 'Retention list loaded' : 'Retention list missing'}</span>
          <span class="meta-pill">Overrides ${report.counts.manualOverrideCount}</span>
          <span class="meta-pill">Roster rule: ${report.draftRosterRules?.targetSkaters ?? DRAFT_ROSTER_RULES.targetSkaters}+${report.draftRosterRules?.targetGoalieTeams ?? DRAFT_ROSTER_RULES.targetGoalieTeams}</span>
        </div>
      </div>
      <div class="validation-summary">
        <div class="meta-pill">${escapeHtml(report.snapshot.details)}</div>
        <div class="meta-pill">Roster records ${report.counts.rosterCount}</div>
        <div class="meta-pill">Available ${report.counts.availableCount}</div>
        <div class="meta-pill">Working State ${report.counts.workingAssignedCount}</div>
        <div class="meta-pill">Owned ${report.counts.ownershipCount}</div>
        <div class="meta-pill">Min slot cost $${(report.draftRosterRules?.minSlotCost ?? DRAFT_ROSTER_RULES.minSlotCost).toFixed(2)}</div>
        <div class="meta-pill">${report.retentionListLoaded ? 'Retention list ready' : 'Retention list not loaded'}</div>
      </div>
      <div class="validation-list">${rows}</div>
      <div class="table-wrap" style="margin-top:12px;">
        <table class="validation-table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Retained</th>
              <th>Remaining</th>
              <th>Skaters</th>
              <th>Goalie Teams</th>
              <th>Open Slots</th>
              <th>Min Needed</th>
              <th>Shortfall</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${ownerPlanRows || '<tr><td colspan="9" class="empty-state">No owner roster data available.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBestAvailablePanel(report) {
  const compactMode = isCompactViewport();
  const players = (report.availablePlayers || [])
    .filter((player) => !player.manualOverride)
    .slice(0, 12);

  const cards = players.length
    ? players.map((player) => `
        <div class="summary-card" style="text-align:left;">
          <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(player.name)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <span class="meta-pill">${escapeHtml(player.position || '—')}</span>
            <span class="meta-pill">${escapeHtml(player.type || 'Unknown')}</span>
          </div>
          <div class="workspace-inline-actions">
            ${renderResponsiveActionButton({
              label: compactMode ? 'Assign on laptop' : 'Assign',
              className: 'secondary draft-assign-open-btn',
              attributes: `data-assign-player-key="${escapeHtml(player.key)}" data-assign-name="${escapeHtml(player.name)}" data-assign-position="${escapeHtml(player.position || '—')}" data-assign-type="${escapeHtml(player.type || 'Rookie')}"`
            })}
          </div>
        </div>
      `).join('')
    : '<div class="empty-state">No unassigned players remain in Best Available.</div>';

  return `
    <section class="panel validation-panel">
      <div class="preview-header">
        <div>
          <h3>Best Available</h3>
          <div class="panel-subtitle">Players still unassigned in Working State.</div>
        </div>
        <div class="preview-meta">
          <span class="meta-pill">Unassigned ${players.length}</span>
        </div>
      </div>
      <div class="summary-grid">${cards}</div>
    </section>
  `;
}

function renderDraftWorkspacePanel(report) {
  const assignedPlayers = report.assignedPlayers || [];
  const rows = assignedPlayers.length
    ? assignedPlayers.map((entry) => `
        <tr>
          <td>${escapeHtml(entry.team)}</td>
          <td>${escapeHtml(entry.name)}</td>
          <td>$${formatValue(entry.bid)}</td>
          <td>${escapeHtml(entry.status)}</td>
          <td>${escapeHtml(entry.classification)}</td>
          <td>
            ${renderResponsiveActionButton({
              label: 'Clear',
              className: 'secondary clear-assignment-btn',
              attributes: `data-clear-player-key="${escapeHtml(entry.playerKey)}"`
            })}
          </td>
        </tr>
      `).join('')
    : '<tr><td colspan="6" class="empty-state">No Working State assignments yet.</td></tr>';

  return `
    <section class="panel validation-panel draft-workspace-panel">
      <div class="preview-header">
        <div>
          <h3>Draft Workspace</h3>
          <div class="panel-subtitle">Projected ownership: each saved assignment updates the available pool immediately.</div>
        </div>
        <div class="preview-meta">
          <span class="meta-pill">Assigned Players ${assignedPlayers.length}</span>
          <span class="meta-pill">Available ${report.counts.availableCount}</span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="validation-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Player</th>
              <th>Bid</th>
              <th>Status</th>
              <th>Class</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function saveWorkingAssignmentFromButton(unifiedState, button) {
  const playerKey = String(button.dataset.savePlayerKey || button.dataset.assignPlayerKey || '').trim();
  const playerName = String(button.dataset.playerName || button.dataset.assignName || '').trim();
  const playerPosition = String(button.dataset.playerPosition || button.dataset.assignPosition || '—').trim();
  const playerType = String(button.dataset.playerType || button.dataset.assignType || 'Rookie').trim();
  if (!playerKey || !playerName) {
    alert('Unable to save assignment. Missing player context.');
    return;
  }

  const getByDataValue = (attributeName, value) => Array.from(document.querySelectorAll(`[${attributeName}]`))
    .find((element) => element.getAttribute(attributeName) === value) || null;

  const teamSelect = getByDataValue('data-workspace-team-key', playerKey);
  const bidInput = getByDataValue('data-workspace-bid-key', playerKey);
  const classificationInput = getByDataValue('data-workspace-classification-key', playerKey);
  const statusInput = getByDataValue('data-workspace-status-key', playerKey);
  const owners = buildOwnerViewData(unifiedState).owners;
  const team = resolveWorkingAssignmentTeamName(teamSelect?.value || '', owners);
  if (!owners.some((owner) => owner.name === team)) {
    alert('Select a league team before saving the assignment.');
    return;
  }

  const result = upsertWorkingAssignment(unifiedState, {
    playerKey,
    name: playerName,
    position: playerPosition,
    team,
    bid: bidInput?.value || '',
    classification: classificationInput?.value || playerType,
    fallbackClassification: playerType,
    status: statusInput?.value || 'Assigned',
  });

  if (result.error) {
    alert(result.error);
    return;
  }

  state.importedData = result.state;
  state.selectedOwner = team;
  state.selectedPlayerKey = null;
  renderOwnerView(result.state);
}

function resolveWorkingAssignmentTeamName(teamName, owners) {
  const normalizedTeamName = normalizeLookupKey(teamName);
  return owners.find((owner) => normalizeLookupKey(owner.name) === normalizedTeamName)?.name || String(teamName || '').trim();
}

function renderAvailablePlayerCenter(report, owners) {
  const compactMode = isCompactViewport();
  const search = String(state.availablePlayerSearch || '').trim().toLowerCase();
  const assignmentMap = report.workingAssignments || {};
  const players = report.availablePlayers
    .filter((player) => !search || player.name.toLowerCase().includes(search) || player.position.toLowerCase().includes(search) || player.type.toLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));
  const displayedPlayers = search || state.showAllAvailablePlayers ? players : players.slice(0, 10);

  const officialPlayers = displayedPlayers.filter((player) => !player.manualOverride);
  const manualPlayers = displayedPlayers.filter((player) => player.manualOverride);

  const renderRows = (rows) => rows.length
    ? rows.map((player) => `
        <tr class="${player.manualOverride ? 'manual-override-row' : ''}">
          <td>
            <div class="table-player-name">${escapeHtml(player.name)}</div>
            ${player.manualOverride ? '<div class="manual-override-tag">MANUAL OVERRIDE</div>' : ''}
          </td>
          <td>${escapeHtml(player.position)}</td>
          <td>${escapeHtml(player.type)}</td>
          <td>${escapeHtml(player.status)}</td>
          <td>${escapeHtml(player.owner || '—')}</td>
          <td>
            <select class="workspace-team-input" data-workspace-team-key="${escapeHtml(player.key)}" aria-label="Team for ${escapeHtml(player.name)}" ${compactMode ? 'disabled aria-disabled="true"' : ''}>
              <option value="">Select team</option>
              ${owners.map((owner) => `<option value="${escapeHtml(owner.name)}" ${assignmentMap[player.key]?.team === owner.name ? 'selected' : ''}>${escapeHtml(owner.name)}</option>`).join('')}
            </select>
          </td>
          <td><input type="number" class="workspace-bid-input" data-workspace-bid-key="${escapeHtml(player.key)}" min="${DRAFT_ROSTER_RULES.minSlotCost}" step="0.5" placeholder="0.50" value="${escapeHtml(String(assignmentMap[player.key]?.bid ?? ''))}" ${compactMode ? 'disabled aria-disabled="true"' : ''} /></td>
          <td>
            <select class="workspace-classification-select" data-workspace-classification-key="${escapeHtml(player.key)}" ${compactMode ? 'disabled aria-disabled="true"' : ''}>
              ${['Rookie', 'Veteran', 'Farm'].map((option) => `<option value="${option}" ${normalizeWorkingClassification(assignmentMap[player.key]?.classification || player.type, player.type) === option ? 'selected' : ''}>${option}</option>`).join('')}
            </select>
          </td>
          <td>
            <select class="workspace-status-select" data-workspace-status-key="${escapeHtml(player.key)}" ${compactMode ? 'disabled aria-disabled="true"' : ''}>
              ${['Assigned', 'Winning Team', 'Winning Bid', 'TBD'].map((option) => `<option value="${option}" ${normalizeWorkingStatus(assignmentMap[player.key]?.status || 'Assigned') === option ? 'selected' : ''}>${option}</option>`).join('')}
            </select>
          </td>
          <td>
            <div class="workspace-inline-actions">
              ${renderResponsiveActionButton({
                label: compactMode ? 'Save on laptop' : 'Save',
                className: 'secondary save-assignment-btn',
                attributes: `data-save-player-key="${escapeHtml(player.key)}" data-player-name="${escapeHtml(player.name)}" data-player-position="${escapeHtml(player.position || '—')}" data-player-type="${escapeHtml(player.type || 'Rookie')}"`
              })}
            </div>
          </td>
        </tr>
      `).join('')
    : '<tr><td colspan="10" class="empty-state">No players match this filter.</td></tr>';

  return `
    <section class="panel validation-panel">
      <div class="preview-header">
        <div>
          <h3>Available Player Center</h3>
          <div class="panel-subtitle">Trust the pool, spot mismatches, and keep missing players visible.</div>
        </div>
        <div class="preview-meta">
          <span class="meta-pill">Official ${officialPlayers.length}</span>
          <span class="meta-pill">Manual ${manualPlayers.length}</span>
          <span class="meta-pill">Conflicts ${report.counts.availableIntegrityCount}</span>
          <span class="meta-pill">Showing ${displayedPlayers.length} of ${players.length}</span>
        </div>
      </div>
      <div style="margin:12px 0;">
        <input id="availablePlayerSearchInput" placeholder="Search available players..." value="${escapeHtml(state.availablePlayerSearch || '')}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--text);" />
      </div>
      <div class="available-player-actions">
        <button type="button" class="secondary" id="toggleAvailablePlayersBtn">${state.showAllAvailablePlayers ? 'Show Top 10' : 'View All Players'}</button>
        ${search ? '<span class="panel-subtitle">Search displays every matching player.</span>' : '<span class="panel-subtitle">Showing the first 10 available players.</span>'}
      </div>
      <div class="table-wrap">
        <table class="validation-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Position</th>
              <th>Type</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Team</th>
              <th>Bid</th>
              <th>Class</th>
              <th>Work Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows(players)}
          </tbody>
        </table>
      </div>
      <div class="manual-override-section">
        <h4>Manual Override Players</h4>
        <div class="table-wrap">
          <table class="validation-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Position</th>
                <th>Classification</th>
                <th>Created</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${manualPlayers.length ? manualPlayers.map((player) => `
                <tr class="manual-override-row">
                  <td><div class="table-player-name">${escapeHtml(player.name)}</div><div class="manual-override-tag">MANUAL OVERRIDE</div></td>
                  <td>${escapeHtml(player.position)}</td>
                  <td>${escapeHtml(player.type)}</td>
                  <td>${escapeHtml(player.createdAt ? new Date(player.createdAt).toLocaleString() : '—')}</td>
                  <td>${escapeHtml(player.notes || '—')}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="empty-state">No manual override players yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderManualOverridePanel(report, stateObj) {
  const compactMode = isCompactViewport();
  const overrides = report.manualOverrides || [];
  const rows = overrides.length ? overrides.map((override) => `
    <div class="override-card">
      <div class="override-card-header">
        <div>
          <div class="override-player-name">${escapeHtml(override.name)}</div>
          <div class="manual-override-tag">MANUAL OVERRIDE</div>
        </div>
        ${override.manualOverrideSource === 'missing-ahl-position' ? '' : renderResponsiveActionButton({
          label: compactMode ? 'Remove on laptop' : 'Remove',
          className: 'secondary remove-override-btn',
          attributes: `data-override-id="${escapeHtml(override.id)}"`
        })}
      </div>
      <div class="override-meta">
        <span class="meta-pill">Final Position Override: ${escapeHtml(override.finalPositionOverride || override.position || 'Pending')}</span>
        <span class="meta-pill">Experience Tier: ${escapeHtml(override.experienceTier || override.classification || 'Pending')}</span>
        <span class="meta-pill">Status: ${escapeHtml(override.status || 'not-in-ahl')}</span>
        <span class="meta-pill">${escapeHtml(override.createdAt ? new Date(override.createdAt).toLocaleString() : '—')}</span>
      </div>
      <div class="override-notes">${escapeHtml(override.notes || 'No notes provided.')}</div>
      ${override.manualOverrideSource === 'missing-ahl-position' && !compactMode ? `
        <form class="manual-override-form" data-missing-position-override="${escapeHtml(override.id)}">
          <label>Final Position Override
            <select name="position" required>
              <option value="">Select position</option>
              ${['C', 'LW', 'RW', 'D', 'G'].map((position) => `<option value="${position}" ${override.finalPositionOverride === position ? 'selected' : ''}>${position}</option>`).join('')}
            </select>
          </label>
          <label>Experience Tier
            <select name="experienceTier" required>
              <option value="">Select tier</option>
              ${['Farm', 'Rookie', 'Veteran'].map((tier) => `<option value="${tier}" ${override.experienceTier === tier ? 'selected' : ''}>${tier}</option>`).join('')}
            </select>
          </label>
          <button type="submit" class="secondary">Save manual details</button>
        </form>
      ` : ''}
    </div>
  `).join('') : '<div class="empty-state">No manual overrides have been added.</div>';

  return `
    <section class="panel validation-panel">
      <div class="preview-header">
        <div>
          <h3>Manual Override Audit</h3>
          <div class="panel-subtitle">Temporary players only. Keep the sheet authoritative.</div>
        </div>
        <div class="preview-meta">
          <span class="meta-pill">Overrides ${overrides.length}</span>
        </div>
      </div>
      ${compactMode ? `
        <div class="mobile-readonly-note">
          Manual overrides are available on laptop mode only so phone access stays read-only and trustworthy.
        </div>
      ` : `
        <form id="manualOverrideForm" class="manual-override-form">
          <div class="manual-grid">
            <label>
              <span>Name</span>
              <input name="name" type="text" required />
            </label>
            <label>
              <span>Final Position Override</span>
              <select name="position" required>
                <option value="">Select position</option>
                <option value="C">C</option>
                <option value="LW">LW</option>
                <option value="RW">RW</option>
                <option value="D">D</option>
                <option value="G">G</option>
              </select>
            </label>
            <label>
              <span>Experience Tier</span>
              <select name="classification" required>
                <option value="">Select</option>
                <option value="Veteran">Veteran</option>
                <option value="Rookie">Rookie</option>
                <option value="Farm">Farm</option>
              </select>
            </label>
            <label class="manual-notes">
              <span>Notes</span>
              <textarea name="notes" rows="3" placeholder="Why this override is needed"></textarea>
            </label>
          </div>
          <button type="submit" class="primary">Add Manual Override</button>
        </form>
      `}
      <div class="override-list">
        ${rows}
      </div>
    </section>
  `;
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return String(value);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderKeyValueList(rows) {
  if (!rows.length) {
    return '<div class="empty-state">No data available.</div>';
  }

  return `
    <dl class="kv-list">
      ${rows.map(([label, value]) => `
        <div class="kv-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}

function renderPlayerBadges(player, historicalBidsBundle) {
  const badges = [];

  if (player.sourceType === 'prospect') {
    badges.push('Prospect');
    if (player.poolPosition) badges.push(`Pool ${player.poolPosition}`);
    if (player.cost !== undefined && player.cost !== null) badges.push(`$${formatValue(player.cost)}`);
    if (player.termRemaining !== undefined && player.termRemaining !== null) badges.push(`${player.termRemaining}Y`);
    if (player.farm) badges.push('Farm');
    if (player.matchingRights) badges.push('Rights');
  } else if (player.sourceType === 'veteran') {
    badges.push('Veteran');
    if (player.poolPosition) badges.push(`Pool ${player.poolPosition}`);
    if (player.currentCost !== undefined && player.currentCost !== null) badges.push(`$${formatValue(player.currentCost)}`);
    if (player.retentionYear) badges.push(`Ret ${player.retentionYear}`);
  } else if (player.sourceType) {
    badges.push(player.sourceType);
  }

  const unified = buildUnifiedPlayer(player, { historicalBidsBundle });
  badges.push(unified.availability);
  badges.push(unified.experienceTier);
  if (unified.avgCost !== 'NA') badges.push(`Avg $${formatValue(unified.avgCost)}`);

  return badges.map((badge) => `<span class="player-chip">${escapeHtml(badge)}</span>`).join('');
}

function renderPlayerList(players, filter, historicalBidsBundle) {
  const search = (filter || '').trim().toLowerCase();
  const filtered = search
    ? (players || []).filter((p) => (p.name || '').toLowerCase().includes(search))
    : (players || []);

  if (!filtered || !filtered.length) {
    return '<div class="empty-state">No players.</div>';
  }

  return `
    <ul class="player-list">
      ${filtered.map((player) => {
        const isActive = state.selectedPlayerKey === player.playerKey;
        return `
          <li>
            <button class="player-item ${isActive ? 'active' : ''}" data-player-key="${player.playerKey}">
              <div>
                <div class="player-name">${escapeHtml(player.name || 'Unnamed Player')}</div>
                <div class="player-meta">${renderPlayerBadges(player, historicalBidsBundle)}</div>
              </div>
              <div class="player-chevron">›</div>
            </button>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function renderPlayerIntelligenceSection(player, rosterRecord, liveProfile, historicalBidsBundle) {
  if (!player) return '';

  const draftPlayerForUnified = state.draftIntelligence?.players?.players?.find(
    (entry) => normalizeLookupKey(entry.name) === normalizeLookupKey(player.name),
  );
  const unified = buildUnifiedPlayer(player, { liveProfile, historicalBidsBundle, draftPlayer: draftPlayerForUnified });

  const rosterTeam = String(pickRecordValue(rosterRecord, ['nhlteam', 'team', 'currentteam', 'club'])).trim();
  const rosterPosition = String(pickRecordValue(rosterRecord, ['position', 'primaryposition', 'positioncode'])).trim();
  const rosterStatus = String(pickRecordValue(rosterRecord, ['rosterstatus', 'status'])).trim();
  const rosterGames = pickRecordValue(rosterRecord, ['gamesplayed', 'gp']);
  const rosterGoals = pickRecordValue(rosterRecord, ['goals', 'g']);
  const rosterAssists = pickRecordValue(rosterRecord, ['assists', 'a']);
  const rosterPoints = pickRecordValue(rosterRecord, ['points', 'pts']);
  const rosterShots = pickRecordValue(rosterRecord, ['shots']);
  const rosterAvgToi = pickRecordValue(rosterRecord, ['avgtoi', 'avgtoi/60', 'avgtoi']);
  const liveStatus = liveProfile?.status || (state.liveRequests[player.playerKey] ? 'loading' : 'offline');
  const liveLine = liveStatus === 'loading'
    ? 'Loading live NHL data...'
    : liveStatus === 'ok'
      ? 'Live NHL data ready'
      : liveStatus === 'partial'
        ? 'Live NHL data partial'
        : 'Live NHL data unavailable';
  const errorHtml = liveProfile?.errors?.length
    ? `<div class="error-banner">${escapeHtml(liveProfile.errors.join(' | '))}</div>`
    : '';

  const identityRows = [
    ['Name', liveProfile?.identity?.fullName || player.name || '—'],
    ['Owner', player.owner || '—'],
    ['NHL Team', rosterTeam || '—'],
    ['Pool Position', player.poolPosition || rosterPosition || '—'],
    ['NHL Position', liveProfile?.identity?.nhlPosition || '—'],
    ['Roster Status', liveProfile?.identity?.rosterStatus || rosterStatus || '—'],
    ['Shoots/Catches', liveProfile?.identity?.shootsCatches || '—'],
    ['Sweater #', liveProfile?.identity?.sweaterNumber ?? '—'],
    ['NHL Player ID', liveProfile?.identity?.playerId ?? '—'],
  ];

  const historicalRows = [];
  if (player.sourceType === 'prospect') {
    historicalRows.push(['Cost', `$${formatValue(player.cost)}`]);
    historicalRows.push(['Term Remaining', player.termRemaining ?? '—']);
    historicalRows.push(['Farm', player.farm ? 'Yes' : 'No']);
    historicalRows.push(['Matching Rights', player.matchingRights ? 'Yes' : 'No']);
    historicalRows.push(['Draft Year', player.draftYear ?? '—']);
  } else if (player.sourceType === 'veteran') {
    historicalRows.push(['Current Cost', `$${formatValue(player.currentCost)}`]);
    historicalRows.push(['Retention Year', player.retentionYear ?? '—']);
    historicalRows.push(['Latest Retention', player.retentionHistory?.length ? `$${formatValue(player.retentionHistory[player.retentionHistory.length - 1]?.cost)}` : '—']);
  }
  historicalRows.push(['Career GP', liveProfile?.historical?.gamesPlayed ?? '—']);
  historicalRows.push(['Career G', liveProfile?.historical?.goals ?? '—']);
  historicalRows.push(['Career A', liveProfile?.historical?.assists ?? '—']);
  historicalRows.push(['Career PTS', liveProfile?.historical?.points ?? '—']);
  historicalRows.push(['Career Shots', liveProfile?.historical?.shots ?? '—']);
  historicalRows.push(['Career Avg TOI', liveProfile?.historical?.avgToi ?? '—']);

  const currentSeasonRows = [
    ['Season', liveProfile?.featuredSeason ?? '—'],
    ['GP', liveProfile?.currentSeason?.gamesPlayed ?? rosterGames ?? '—'],
    ['G', liveProfile?.currentSeason?.goals ?? rosterGoals ?? '—'],
    ['A', liveProfile?.currentSeason?.assists ?? rosterAssists ?? '—'],
    ['PTS', liveProfile?.currentSeason?.points ?? rosterPoints ?? '—'],
    ['Shots', liveProfile?.currentSeason?.shots ?? rosterShots ?? '—'],
    ['Roster Status', liveProfile?.identity?.rosterStatus || rosterStatus || '—'],
  ];

  const teamRows = [];
  if (liveProfile?.team) {
    teamRows.push(['Current Team', liveProfile?.identity?.currentTeamName || liveProfile?.identity?.currentTeamAbbrev || '—']);
    teamRows.push(['Conference', liveProfile.team.standings?.conferenceName || '—']);
    teamRows.push(['Division', liveProfile.team.standings?.divisionName || '—']);
    teamRows.push(['Points', liveProfile.team.standings?.points ?? '—']);
    teamRows.push(['Wins', liveProfile.team.standings?.wins ?? '—']);
    teamRows.push(['Games Remaining', liveProfile.schedule?.gamesRemaining ?? '—']);
    teamRows.push(['Next Game', liveProfile.schedule?.nextGame ? `${liveProfile.schedule.nextGame.gameDate} vs ${liveProfile.schedule.nextGame.opponentAbbrev} (${liveProfile.schedule.nextGame.homeRoad})` : '—']);
    teamRows.push(['Roster Count', liveProfile.team.roster?.playerCount ?? '—']);
  } else {
    teamRows.push(['Live team context', liveStatus === 'loading' ? 'Loading...' : 'Unavailable']);
  }

  const scheduleRows = [
    ['Next 7 Days', liveProfile?.schedule?.gamesNext7Days ?? '—'],
    ['Next 14 Days', liveProfile?.schedule?.gamesNext14Days ?? '—'],
    ['Next 30 Days', liveProfile?.schedule?.gamesNext30Days ?? '—'],
    ['Total Remaining Games', liveProfile?.schedule?.gamesRemaining ?? '—'],
  ];

  const nextGames = liveProfile?.schedule?.nextGames || [];
  const nextGamesHtml = nextGames.length
    ? `
      <ul class="schedule-list">
        ${nextGames.map((game) => `<li>${escapeHtml(game.gameDate)} ${escapeHtml(game.homeRoad)} vs ${escapeHtml(game.opponentAbbrev)}${game.gameState ? ` (${escapeHtml(game.gameState)})` : ''}</li>`).join('')}
      </ul>
    `
    : '<div class="empty-state">No live schedule data.</div>';
  const draftPlayer = draftPlayerForUnified;
  const draftIntelligenceHtml = draftPlayer
    ? `
      <article class="detail-card">
        <h3>Draft Intelligence</h3>
        ${renderKeyValueList([
          ['Status', draftPlayer.valuationStatus === 'unpriced-missing-source-inputs' ? 'Partial data; scoring inputs pending' : draftPlayer.valuationStatus],
          ['Category', draftPlayer.category],
          ['2025-26 GP', draftPlayer.seasonStats?.gamesPlayed],
          ['Goals', draftPlayer.seasonStats?.goals],
          ['Assists', draftPlayer.seasonStats?.assists],
          ['Fantasy Points (G + 0.5A)', draftPlayer.seasonStats?.fantasyPoints],
          ['DraftIQ', draftPlayer.draftIQ],
          ['Auction Value', draftPlayer.auctionValue === null ? 'Unpriced' : `$${formatValue(draftPlayer.auctionValue)}`],
          ['Tier', draftPlayer.tier],
        ])}
      </article>
    `
    : '';

  const unifiedSummaryHtml = `
    <article class="detail-card">
      <h3>Unified Summary</h3>
      ${renderKeyValueList([
        ['Availability', unified.availability],
        ['Experience Tier', unified.experienceTier],
        ['Draft Status', unified.draftStatus],
        ['Cost', unified.cost === null ? '—' : `$${formatValue(unified.cost)}`],
        ['Years', unified.years ?? '—'],
        ['Farm Status', unified.farmStatus ? 'Yes' : 'No'],
      ])}
    </article>
  `;

  const historicalBidHtml = `
    <article class="detail-card">
      <h3>Historical Bid Stats</h3>
      ${renderKeyValueList([
        ['Avg Cost', unified.avgCost === 'NA' ? 'NA' : `$${formatValue(unified.avgCost)}`],
        ['Min Cost', unified.minCost === 'NA' ? 'NA' : `$${formatValue(unified.minCost)}`],
        ['Max Cost', unified.maxCost === 'NA' ? 'NA' : `$${formatValue(unified.maxCost)}`],
        ['Years Drafted', Array.isArray(unified.yearsDrafted) ? unified.yearsDrafted.join(', ') || 'NA' : 'NA'],
      ])}
    </article>
  `;

  const forecastHtml = unified.dobberProjection
    ? `
      <article class="detail-card">
        <h3>Forecasted Stats</h3>
        ${renderKeyValueList([
          ['Projected Points', unified.dobberProjection.projectedPoints ?? '—'],
          ['Projected Games', unified.dobberProjection.projectedGames ?? '—'],
          ['Projected Shots', unified.dobberProjection.projectedShots ?? '—'],
          ['FHPPG', unified.dobberProjection.FHPPG ?? '—'],
          ['SHPPG', unified.dobberProjection.SHPPG ?? '—'],
          ['Composite Score', unified.dobberProjection.compositeScore ?? '—'],
        ])}
      </article>
    `
    : '';

  return `
    <section class="panel player-intel">
      <div class="preview-header">
        <h3>Player Intelligence</h3>
        <div class="preview-meta">
          <span class="meta-pill">${escapeHtml(liveLine)}</span>
          <span class="meta-pill">${escapeHtml(player.sourceType || 'player')}</span>
        </div>
      </div>
      ${errorHtml}

      <div class="detail-grid">
        <article class="detail-card">
          <h3>Identity</h3>
          ${renderKeyValueList(identityRows)}
        </article>
        <article class="detail-card">
          <h3>Historical</h3>
          ${renderKeyValueList(historicalRows)}
        </article>
        <article class="detail-card">
          <h3>Current Season</h3>
          ${renderKeyValueList(currentSeasonRows)}
        </article>
        <article class="detail-card">
          <h3>Schedule Opportunity</h3>
          ${renderKeyValueList(scheduleRows)}
          ${nextGamesHtml}
        </article>
        <article class="detail-card">
          <h3>Team Intelligence</h3>
          ${renderKeyValueList(teamRows)}
        </article>
        ${unifiedSummaryHtml}
        ${historicalBidHtml}
        ${forecastHtml}
        ${draftIntelligenceHtml}
      </div>
    </section>
  `;
}

function renderTable(headers, rows) {
  if (!rows.length) {
    return '<div class="empty-state">No records available.</div>';
  }

  const headerMarkup = headers.map((header) => `<th>${header}</th>`).join('');
  const rowMarkup = rows.slice(0, MAX_PREVIEW_ROWS).map((row) => {
    const cells = headers.map((header) => `<td>${formatValue(row[header] ?? row[header.toLowerCase()] ?? row[header.replace(/\s+/g, '').toLowerCase()] ?? '')}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <table class="preview-table">
      <thead><tr>${headerMarkup}</tr></thead>
      <tbody>${rowMarkup}</tbody>
    </table>
  `;
}

function renderPreviewSection(parsedData, datasetType) {
  const rows = getVisiblePreviewRows(parsedData);
  const headers = getPreviewHeaders(parsedData, datasetType);
  const tableHtml = renderTable(headers, rows);

  return `
    <section class="panel preview-wrap">
      <div class="preview-header">
        <h2>Preview Import</h2>
        <div class="preview-meta">
          <span class="meta-pill">Dataset: ${datasetType}</span>
          <span class="meta-pill">Records: ${rows.length}</span>
        </div>
      </div>
      ${tableHtml}
      <div class="preview-actions">
        <button class="primary" id="confirmImportBtn">Confirm Import</button>
        <button class="secondary" id="cancelImportBtn">Upload Another</button>
      </div>
    </section>
  `;
}

function renderOwnerList(ownerData, report) {
  const statusHtml = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      ${getDataQualitySources(ownerData._rawState).map((source) => `<div class="meta-pill">${escapeHtml(source.label)} ${source.status === 'ok' ? '✅' : '❌'}</div>`).join('')}
    </div>
  `;

  // Apply owner search filter (case-insensitive)
  const search = (state.ownerSearch || '').trim().toLowerCase();
  const ownersFiltered = search
    ? ownerData.owners.filter((o) => o.name.toLowerCase().includes(search))
    : ownerData.owners.slice();

  // Preserve selected owner when possible: if current selectedOwner not in filtered list, pick first
  if (state.selectedOwner && !ownersFiltered.some((o) => o.name === state.selectedOwner)) {
    state.selectedOwner = ownersFiltered.length ? ownersFiltered[0].name : null;
  }

  const ownerListMarkup = ownersFiltered.map((owner) => {
    const isActive = state.selectedOwner === owner.name;
    const localAssignedCount = report?.assignedByTeam?.[owner.name]?.length || 0;

    return `
      <button class="owner-item ${isActive ? 'active' : ''}" data-owner="${owner.name}">
        <div>
          <div class="owner-name">${owner.name}</div>
        </div>
        <div class="owner-badges">
          <span class="owner-badge">Pros ${owner.prospects.length}</span>
          <span class="owner-badge">Vet ${owner.veterans.length}</span>
          <span class="owner-badge">Farm ${owner.farmPlayers.length}</span>
          <span class="owner-badge">MR ${owner.matchingRights.length}</span>
          <span class="owner-badge">WS ${localAssignedCount}</span>
        </div>
      </button>
    `;
  }).join('');

  // Owner search input HTML
  const searchHtml = `
    <div style="margin:10px 0 12px;">
      <input id="ownerSearchInput" placeholder="Search owners..." value="${escapeHtml(state.ownerSearch || '')}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--text);" />
    </div>
  `;

  return `
    <aside class="panel owner-list">
      <div class="preview-header">
        <h2>Owners</h2>
        <span class="meta-pill">${ownerData.totalOwners}</span>
      </div>
      ${statusHtml}
      ${searchHtml}
      <div class="owner-list">${ownerListMarkup}</div>
    </aside>
  `;
}

function renderOwnerDetails(ownerData, report) {
  const selectedOwner = ownerData.owners.find((owner) => owner.name === state.selectedOwner) || ownerData.owners[0];

  if (!selectedOwner) {
    return `
      <section class="panel details-panel">
        <div class="empty-state">No owners available.</div>
      </section>
    `;
  }

  const stats = computeOwnerStatistics(selectedOwner);
  const totalCostFmt = formatValue(stats.totalProspectCost);
  const avgCostFmt = stats.prospectCount ? formatValue(stats.averageProspectCost) : '—';
  const highest = stats.highestCostProspect ? `${stats.highestCostProspect.name} ($${stats.highestCostProspect.cost})` : '—';
  const rosterIndex = buildRosterIndex(state.importedData || ownerData._rawState || {});
  const ownerPlayers = [...(selectedOwner.prospects || []), ...(selectedOwner.veterans || []), ...(selectedOwner.rosterPlayers || [])];

  if (!state.selectedPlayerKey || !ownerPlayers.some((player) => player.playerKey === state.selectedPlayerKey)) {
    state.selectedPlayerKey = ownerPlayers.length ? ownerPlayers[0].playerKey : null;
  }

  const selectedPlayer = ownerPlayers.find((player) => player.playerKey === state.selectedPlayerKey) || ownerPlayers[0] || null;
  const rosterMatch = selectedPlayer ? findRosterMatchForPlayer(selectedPlayer, rosterIndex) : null;
  const liveProfile = selectedPlayer ? state.liveProfiles[selectedPlayer.playerKey] : null;
  const historicalBidsBundle = state.liveCache.historicalBids || null;
  const unifiedState = ownerData._rawState || state.importedData;

  if (selectedPlayer) {
    void queuePlayerProfileHydration(unifiedState, selectedPlayer, rosterMatch);
  }
  void queueHistoricalBidsHydration(unifiedState);

  const ownerSummary = `
    <div class="owner-summary panel">
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
        <div class="meta-pill">Prospects: ${stats.prospectCount}</div>
        <div class="meta-pill">Veterans: ${stats.veteranCount}</div>
        <div class="meta-pill">Farm: ${stats.farmCount}</div>
        <div class="meta-pill">Matching Rights: ${stats.matchingRightsCount}</div>
        <div class="meta-pill">Total Prospect Cost: $${totalCostFmt}</div>
        <div class="meta-pill">Avg Prospect Cost: $${avgCostFmt}</div>
        <div class="meta-pill">Highest Prospect: ${highest}</div>
      </div>
    </div>
  `;

  const localAssignments = (report?.assignedByTeam?.[selectedOwner.name] || []);
  const localAssignmentHtml = localAssignments.length
    ? `
      <article class="detail-card">
        <h3>Draft Workspace Assignments</h3>
        <ul class="player-list">
          ${localAssignments.map((entry) => `
            <li>
              <div class="player-item" style="cursor:default;">
                <div>
                  <div class="player-name">${escapeHtml(entry.name)}</div>
                  <div class="player-meta">
                    <span class="player-chip">$${formatValue(entry.bid)}</span>
                    <span class="player-chip">${escapeHtml(entry.classification)}</span>
                    <span class="player-chip">${escapeHtml(entry.status)}</span>
                  </div>
                </div>
              </div>
            </li>
          `).join('')}
        </ul>
      </article>
    `
    : '';

  const cards = `
    <div style="margin-bottom:10px;">
      <input id="playerSearchInput" placeholder="Search players..." value="${escapeHtml(state.playerSearch || '')}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--text);" />
    </div>
    <div class="detail-grid">
      <article class="detail-card">
        <h3>Prospects</h3>
        ${renderPlayerList(selectedOwner.prospects, state.playerSearch, historicalBidsBundle)}
      </article>
      <article class="detail-card">
        <h3>Veterans</h3>
        ${renderPlayerList(selectedOwner.veterans, state.playerSearch, historicalBidsBundle)}
      </article>
      <article class="detail-card">
        <h3>Farm Players</h3>
        ${renderPlayerList(selectedOwner.farmPlayers, state.playerSearch, historicalBidsBundle)}
      </article>
      <article class="detail-card">
        <h3>Matching Rights</h3>
        ${renderPlayerList(selectedOwner.matchingRights, state.playerSearch, historicalBidsBundle)}
      </article>
      ${localAssignmentHtml}
    </div>
  `;

  const playerIntel = selectedPlayer ? renderPlayerIntelligenceSection(selectedPlayer, rosterMatch, liveProfile, historicalBidsBundle) : '';

  return `
  <section class="panel details-panel">
    <div class="details-header">
      <h2>${selectedOwner.name}</h2>
    </div>
    ${ownerSummary}
    ${cards}
    ${playerIntel}
  </section>
  `;
}

function renderOwnerView(unifiedState) {
  const ownerData = buildOwnerViewData(unifiedState);

  if (!ownerData.owners.length && !state.draftIntelligence) {
    renderImportScreen();
    return;
  }

  if (ownerData.owners.length && (!state.selectedOwner || !ownerData.owners.some((owner) => owner.name === state.selectedOwner))) {
    state.selectedOwner = ownerData.owners[0].name;
  }

  const summary = computeDashboardSummary(unifiedState);
  const summaryHtml = `
    <section class="panel summary-grid">
      <div class="summary-card"><div class="summary-value">${summary.totalOwners}</div><div class="summary-label">Total Owners</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalProspects}</div><div class="summary-label">Total Prospects</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalVeterans}</div><div class="summary-label">Total Veterans</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalFarmPlayers}</div><div class="summary-label">Total Farm Players</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalMatchingRights}</div><div class="summary-label">Total Matching Rights</div></div>
    </section>
  `;

  const draftValidationReport = buildDraftValidationReport(unifiedState);
  if (state.draftIntelligence) {
    renderAuctionDashboard(unifiedState, ownerData, draftValidationReport);
    return;
  }

  const ownerListMarkup = renderOwnerList(ownerData, draftValidationReport);
  const ownerDetailMarkup = renderOwnerDetails(ownerData, draftValidationReport);
  const rosterIndex = buildRosterIndex(unifiedState);

  // compute aggregates once
  const aggregates = computeOwnerAggregates(unifiedState);
  const leagueHtml = renderLeagueIntelligence(aggregates);
  const dataQualityHtml = renderDataQualityPanel(unifiedState);
  const localEditMismatchesHtml = renderLocalEditMismatchesPanel(ownerData.localEditMismatches);
  const validationCenterHtml = renderDraftValidationCenter(draftValidationReport);
  const bestAvailableHtml = renderBestAvailablePanel(draftValidationReport);
  const workspaceHtml = renderDraftWorkspacePanel(draftValidationReport);
  const availablePlayerHtml = renderAvailablePlayerCenter(draftValidationReport, ownerData.owners);
  const overrideAuditHtml = renderManualOverridePanel(draftValidationReport, unifiedState);

  const app = document.getElementById('app');
  const activeSearchInput = document.activeElement;
  const searchFocus = ['ownerSearchInput', 'playerSearchInput', 'availablePlayerSearchInput']
    .includes(activeSearchInput?.id)
    ? {
      id: activeSearchInput.id,
      selectionStart: activeSearchInput.selectionStart,
      selectionEnd: activeSearchInput.selectionEnd,
    }
    : null;
  app.innerHTML = `
    <div class="dashboard-tabs" role="tablist" aria-label="Dashboard views">
      <button type="button" id="draftNightTab" role="tab" aria-controls="draftNightPanel" aria-selected="${state.activeDashboardTab === 'draft-night'}" data-dashboard-tab="draft-night">Draft Night</button>
      <button type="button" id="qualityCheckTab" role="tab" aria-controls="qualityCheckPanel" aria-selected="${state.activeDashboardTab === 'quality-check'}" data-dashboard-tab="quality-check">Quality Check</button>
    </div>
    <section id="draftNightPanel" role="tabpanel" aria-labelledby="draftNightTab" ${state.activeDashboardTab === 'draft-night' ? '' : 'hidden'}>
      ${workspaceHtml}
      ${summaryHtml}
      ${availablePlayerHtml}
      ${bestAvailableHtml}
      <div class="owner-layout">
        ${ownerListMarkup}
        <div>
          ${leagueHtml}
          ${overrideAuditHtml}
          ${ownerDetailMarkup}
        </div>
      </div>
    </section>
    <section id="qualityCheckPanel" role="tabpanel" aria-labelledby="qualityCheckTab" ${state.activeDashboardTab === 'quality-check' ? '' : 'hidden'}>
      ${dataQualityHtml}
      ${localEditMismatchesHtml}
      ${validationCenterHtml}
    </section>
  `;

  updateTopbarActions(unifiedState);

  document.querySelectorAll('[data-dashboard-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeDashboardTab = button.dataset.dashboardTab || 'draft-night';
      renderOwnerView(unifiedState);
    });
  });

  if (searchFocus) {
    const replacement = document.getElementById(searchFocus.id);
    replacement?.focus();
    if (replacement && searchFocus.selectionStart !== null && searchFocus.selectionEnd !== null) {
      replacement.setSelectionRange(searchFocus.selectionStart, searchFocus.selectionEnd);
    }
  }
  // owner click handlers
  document.querySelectorAll('.owner-item').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedOwner = button.dataset.owner;
      state.selectedPlayerKey = null;
      renderOwnerView(unifiedState);
    });
  });

  document.querySelectorAll('.player-item').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedPlayerKey = button.dataset.playerKey;
      renderOwnerView(unifiedState);
    });
  });

  // owner search handler
  const ownerSearchInput = document.getElementById('ownerSearchInput');
  if (ownerSearchInput) {
    ownerSearchInput.addEventListener('input', (e) => {
      state.ownerSearch = e.target.value || '';
      // re-render with same unified state
      renderOwnerView(unifiedState);
    });
  }

  // player search handler
  const playerSearchInput = document.getElementById('playerSearchInput');
  if (playerSearchInput) {
    playerSearchInput.addEventListener('input', (e) => {
      state.playerSearch = e.target.value || '';
      // re-render to apply player filters but keep owner selection
      renderOwnerView(unifiedState);
    });
  }

  const availablePlayerSearchInput = document.getElementById('availablePlayerSearchInput');
  if (availablePlayerSearchInput) {
    availablePlayerSearchInput.addEventListener('input', (e) => {
      state.availablePlayerSearch = e.target.value || '';
      renderOwnerView(unifiedState);
    });
  }
  const toggleAvailablePlayersBtn = document.getElementById('toggleAvailablePlayersBtn');
  if (toggleAvailablePlayersBtn) {
    toggleAvailablePlayersBtn.addEventListener('click', () => {
      state.showAllAvailablePlayers = !state.showAllAvailablePlayers;
      renderOwnerView(unifiedState);
    });
  }

  const manualOverrideForm = document.getElementById('manualOverrideForm');
  if (manualOverrideForm) {
    manualOverrideForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!manualOverrideForm.checkValidity()) {
        manualOverrideForm.reportValidity();
        return;
      }

      const formData = new FormData(manualOverrideForm);
      const nextDraft = {
        name: formData.get('name'),
        position: formData.get('position'),
        classification: formData.get('classification'),
        notes: formData.get('notes'),
      };

      const result = addManualOverrideEntry(unifiedState, nextDraft);
      if (result.error) {
        alert(result.error);
        return;
      }

      state.importedData = result.state;
      state.manualOverrides = Array.isArray(result.state.manualOverrides) ? result.state.manualOverrides : [];
      renderOwnerView(result.state);
    });
  }

  document.querySelectorAll('.remove-override-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const nextState = removeManualOverrideById(unifiedState, button.dataset.overrideId);
      state.importedData = nextState;
      state.manualOverrides = Array.isArray(nextState.manualOverrides) ? nextState.manualOverrides : [];
      state.draftIntelligenceFromOfflineSnapshot = false;
      renderOwnerView(nextState);
    });
  });
  document.querySelectorAll('[data-missing-position-override]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const overrideId = form.dataset.missingPositionOverride;
      const formData = new FormData(form);
      const finalPositionOverride = String(formData.get('position') || '');
      const experienceTier = normalizeClassification(formData.get('experienceTier'));
      if (!['C', 'LW', 'RW', 'D', 'G'].includes(finalPositionOverride) || !experienceTier) {
        alert('Select a valid final-position override and experience tier.');
        return;
      }
      const nextState = normalizeState(state.importedData || unifiedState);
      nextState.manualOverrides = nextState.manualOverrides.map((override) => (
        override.id === overrideId
          ? {
            ...override,
            position: finalPositionOverride,
            finalPositionOverride,
            classification: experienceTier,
            experienceTier,
            status: 'not-in-ahl',
            pricing: null,
            forecast: null,
            owner: null,
            availability: 'unavailable',
            updatedAt: new Date().toISOString(),
          }
          : override
      ));
      persistState(nextState);
      state.importedData = nextState;
      state.manualOverrides = nextState.manualOverrides;
      applyAhlSheetIntelligence(nextState);
      renderOwnerView(nextState);
    });
  });

  document.querySelectorAll('.save-assignment-btn').forEach((button) => {
    button.addEventListener('click', () => {
      saveWorkingAssignmentFromButton(unifiedState, button);
    });
  });

  document.querySelectorAll('.clear-assignment-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const nextState = removeWorkingAssignment(unifiedState, button.dataset.clearPlayerKey);
      state.importedData = nextState;
      renderOwnerView(nextState);
    });
  });

  document.querySelectorAll('.draft-assign-open-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.availablePlayerSearch = button.dataset.assignName || '';
      renderOwnerView(unifiedState);
    });
  });

  const selectedOwner = ownerData.owners.find((owner) => owner.name === state.selectedOwner) || ownerData.owners[0];
  const selectedPlayer = selectedOwner
    ? [...(selectedOwner.prospects || []), ...(selectedOwner.veterans || []), ...(selectedOwner.rosterPlayers || [])].find((player) => player.playerKey === state.selectedPlayerKey) || null
    : null;

  if (selectedPlayer) {
    const rosterMatch = findRosterMatchForPlayer(selectedPlayer, rosterIndex);
    queuePlayerProfileHydration(unifiedState, selectedPlayer, rosterMatch);
  }
}

async function persistLocalDraftEdits(localEdits) {
  const next = normalizeState(state.importedData || loadState());
  next.localEdits = markLocalEditsUpdated(localEdits, next.localEdits.lastUpdated);
  next.metadata.localDraftEdits = next.localEdits;
  persistState(next);
  state.importedData = next;
  if (state.draftIntelligence && next.metadata.ahlSheets?.status === 'ok') {
    state.localDraftEditsStorageError = await persistOfflineAhlSnapshot(next);
  }
  renderOwnerView(next);
}

export function buildDraftBoardPlayers(players, stateObj, liveProfiles = {}, cachedProfiles = {}) {
  const fromDraftSheet = new Map();
  Object.values(stateObj?.datasets?.roster?.sources?.['retained-grid']?.players || {})
    .filter((record) => record.owner).forEach((record) => {
      getRosterPlayerIdentityAliases(record.name).forEach((alias) => {
        if (fromDraftSheet.has(alias)) {
          fromDraftSheet.set(alias, null);
        } else {
          fromDraftSheet.set(alias, {
            owner: record.owner,
            price: Number.isFinite(record.cost) ? record.cost : null,
          });
        }
      });
    });
  const fromWinningBids = new Map(Object.values(stateObj?.workingAssignments || {})
    .filter((entry) => entry?.team).map((entry) => [normalizeLookupKey(entry.name), {
      owner: entry.team,
      price: Number.isFinite(entry.bid) ? entry.bid : null,
    }]));
  const profilesByName = new Map();
  [...Object.values(cachedProfiles), ...Object.values(liveProfiles)].forEach((profile) => {
    if (!profile?.playerName) return;
    const key = normalizeLookupKey(profile.playerName);
    const previous = profilesByName.get(key);
    const games = profile.historical?.gamesPlayed;
    const previousGames = previous?.historical?.gamesPlayed;
    if (!previous || (Number.isInteger(games) && games >= 0)
      || !Number.isInteger(previousGames) || previousGames < 0) {
      profilesByName.set(key, profile);
    }
  });
  return (players || []).flatMap((player) => {
    if (player.status !== 'in-ahl') return [];
    const key = normalizeLookupKey(player.name);
    const aliases = getRosterPlayerIdentityAliases(player.name);
    const draft = fromDraftSheet.get(key)
      || aliases.map((alias) => fromDraftSheet.get(alias)).find(Boolean)
      || fromWinningBids.get(key);
    if (!draft) return [];
    const playerGames = player.nhlCareerGamesPlayed;
    const profileGames = profilesByName.get(key)?.historical?.gamesPlayed;
    const games = playerGames !== null && playerGames !== undefined && playerGames !== ''
      && Number.isInteger(Number(playerGames)) && Number(playerGames) >= 0
      ? Number(playerGames) : profileGames ?? playerGames;
    return [{
      ...player,
      draftOwner: draft.owner,
      draftPrice: draft.price,
      nhlCareerGamesPlayed: games ?? null,
    }];
  });
}

async function hydrateDraftBoardProfiles(draftedPlayers) {
  if (state.draftGpLoading) return;
  const pending = draftedPlayers.filter((player) => {
    const key = normalizeLookupKey(player.name);
    return player.nhlCareerGamesPlayed === null && player.team
      && !state.draftGpAttempted.has(key);
  });
  if (!pending.length) return;
  pending.forEach((player) => state.draftGpAttempted.add(normalizeLookupKey(player.name)));
  state.draftGpLoading = true;
  try {
    const results = await Promise.all(pending.map(async (player) => {
      try {
        const profile = await resolveLivePlayerProfile({
          player: { name: player.name, nhlteam: player.team, playerKey: `draft:${normalizeLookupKey(player.name)}` },
          cache: state.liveCache,
          includeTeamContext: false,
        });
        state.liveProfiles[profile.playerKey] = profile;
        return { fetched: Number.isInteger(profile.historical?.gamesPlayed), errors: profile.errors || [] };
      } catch (error) {
        console.error(`NHL GP lookup failed for ${player.name}`, error);
        return { fetched: false, errors: [error instanceof Error ? error.message : String(error)] };
      }
    }));
    if (results.every((result) => !result.fetched)
      && results.some((result) => result.errors.some((error) => /snapshot load failed/i.test(error)))) {
      console.warn('NHL snapshot is unavailable; drafted players default to Veteran.');
    }
  } finally {
    state.draftGpLoading = false;
    if (state.activeDashboardTab === 'draft-board') renderOwnerView(state.importedData || loadState());
  }
}

function renderAuctionDashboard(unifiedState, ownerData, draftValidationReport) {
  const app = document.getElementById('app');
  const activeSearch = document.activeElement;
  const focusState = ['draftBoardSearch'].includes(activeSearch?.id)
    ? { id: activeSearch.id, selectionStart: activeSearch.selectionStart, selectionEnd: activeSearch.selectionEnd }
    : null;
  const assignments = Object.values(draftValidationReport.workingAssignments || {});
  const teamBudgets = (unifiedState.datasets.roster?.teamBudgets || []).map((budget) => {
    const ownerName = ownerData.owners.find((owner) => normalizeLookupKey(owner.name) === normalizeLookupKey(budget.team))?.name
      || budget.team;
    const teamAssignments = assignments.filter((entry) => normalizeLookupKey(entry?.team) === normalizeLookupKey(ownerName));
    const remainingBudget = Number.isFinite(budget.remainingBudget)
      ? Number((budget.remainingBudget - teamAssignments.reduce((sum, entry) => sum + Number(entry.bid || 0), 0)).toFixed(2))
      : null;
    const playersDrafted = (budget.playersDrafted || 0) + teamAssignments.length;
    const openSlots = Math.max(0, DRAFT_ROSTER_RULES.targetSkaters + DRAFT_ROSTER_RULES.targetGoalieTeams - playersDrafted);
    const maxPossibleBid = remainingBudget !== null && openSlots > 0
      ? Number((remainingBudget - ((openSlots - 1) * DRAFT_ROSTER_RULES.minSlotCost)).toFixed(2))
      : null;
    return {
      team: ownerName,
      retained: budget.retained ?? budget.totalSpent ?? null,
      remainingBudget,
      playersDrafted,
      skaters: budget.skaters || null,
      openSlots,
      averageSpendRemaining: remainingBudget !== null && openSlots > 0 ? remainingBudget / openSlots : null,
      maxPossibleBid: maxPossibleBid !== null && maxPossibleBid >= DRAFT_ROSTER_RULES.minSlotCost
        ? maxPossibleBid
        : null,
      keeperCosts: budget.keeperCosts,
      rookieFarmCosts: budget.rookieFarmCosts,
      penalties: budget.penalties,
      adjustments: budget.adjustments,
    };
  });
  const sourceAvailableKeys = new Set(
    (draftValidationReport.availablePlayers || []).map((player) => normalizeLookupKey(player.name)),
  );
  const localDraftView = applyLocalDraftEdits(
    state.draftIntelligence.players?.players || [],
    sourceAvailableKeys,
    unifiedState.localEdits,
    unifiedState.workingAssignments,
  );
  const availableKeys = localDraftView.availableKeys;
  const players = localDraftView.players.map((player) => ({
    ...player,
    availability: getPlayerAvailability(player, availableKeys),
  }));
  const draftedPlayers = buildDraftBoardPlayers(players, unifiedState, state.liveProfiles, state.liveCache.players);
  const teamNames = ownerData.owners.map((owner) => owner.name);
  const selectedPlayer = players.find((player) => player.id === state.selectedDraftPlayerId) || null;
  const selectedAvailablePlayer = selectedPlayer && draftValidationReport.availablePlayers.find(
    (entry) => normalizeLookupKey(entry.name) === normalizeLookupKey(selectedPlayer.name),
  );
  const selectedDraftEntry = draftedPlayers.find((player) => player.id === selectedPlayer?.id);
  const selectedDraftPlayer = selectedPlayer
    ? {
      ...selectedPlayer,
      ...selectedDraftEntry,
      ...(selectedDraftEntry ? { ownership: selectedDraftEntry.draftOwner } : {}),
      category: selectedPlayer.category || selectedAvailablePlayer?.type || null,
      assignmentKey: selectedAvailablePlayer?.key || normalizeLookupKey(selectedPlayer.name),
      available: selectedPlayer.status === 'in-ahl'
        && selectedPlayer.localStatus !== 'removed-local'
        && availableKeys.has(normalizeLookupKey(selectedPlayer.name)),
    }
    : null;
  const summary = computeDashboardSummary(unifiedState);
  const summaryHtml = `
    <section class="panel summary-grid">
      <div class="summary-card"><div class="summary-value">${summary.totalOwners}</div><div class="summary-label">Total Owners</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalProspects}</div><div class="summary-label">Total Prospects</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalVeterans}</div><div class="summary-label">Total Veterans</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalFarmPlayers}</div><div class="summary-label">Total Farm Players</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalMatchingRights}</div><div class="summary-label">Total Matching Rights</div></div>
    </section>`;
  const ownerListMarkup = ownerData.owners.length ? renderOwnerList(ownerData, draftValidationReport) : '';
  const ownerDetailMarkup = ownerData.owners.length ? renderOwnerDetails(ownerData, draftValidationReport) : '';
  const jsonOutputs = [
    ['players.json', Array.isArray(state.draftIntelligence.players?.players)],
    ['auction.json', Array.isArray(state.draftIntelligence.auction?.players)],
    ['tiers.json', Boolean(state.draftIntelligence.tiers?.tiers)],
    ['keepers.json', Array.isArray(state.draftIntelligence.keepers?.keepers)],
    ['prospects.json', Array.isArray(state.draftIntelligence.prospects?.prospects)],
  ];
  const jsonHealthHtml = `
    <section class="panel">
      <h3>JSON Health</h3>
      <div class="status-grid">${jsonOutputs.map(([filename, valid]) => `
        <div class="status-row"><strong>${escapeHtml(filename)}</strong><span>${valid ? 'Loaded' : 'Invalid or missing'}</span></div>
      `).join('')}</div>
    </section>`;
  const toolsHtml = `${summaryHtml}
    ${jsonHealthHtml}
    ${renderDataQualityPanel(unifiedState)}
    ${renderLocalEditMismatchesPanel(ownerData.localEditMismatches)}
    ${renderDraftValidationCenter(draftValidationReport)}
    ${renderManualOverridePanel(draftValidationReport, unifiedState)}
    ${ownerData.owners.length ? `<div class="owner-layout">${ownerListMarkup}<div>${renderLeagueIntelligence(computeOwnerAggregates(unifiedState))}${ownerDetailMarkup}</div></div>` : ''}`;
  const workspaceHtml = renderDraftWorkspacePanel(draftValidationReport);

  app.innerHTML = renderDraftAuctionDashboard({
    activeTab: state.activeDashboardTab,
    players,
    draftedPlayers,
    availableKeys,
    shortlist: state.shortlist,
    personalDraftList: state.personalDraftList,
    personalDraftListSort: state.personalDraftListSort,
    personalDraftPositionFilter: state.personalDraftPositionFilter,
    personalDraftCategoryFilter: state.personalDraftCategoryFilter,
    personalDraftAvailabilityFilter: state.personalDraftAvailabilityFilter,
    search: state.draftBoardSearch,
    positionFilter: state.draftPositionFilter,
    bestPositionFilter: state.bestPositionFilter,
    categoryFilter: state.draftCategoryFilter,
    bestAvailableSort: state.bestAvailableSort,
    showRemovedPlayers: state.showRemovedPlayers,
    highlightUnavailablePlayers: state.highlightUnavailablePlayers,
    teamBudgets,
    teamNames,
    selectedPlayer: selectedDraftPlayer,
    selectedTeam: state.selectedDraftTeam,
    sourceAvailability: state.draftIntelligence.players?.sourceAvailability || {},
    toolsHtml: `${state.shortlistStorageError ? `<p class="warning-banner">${escapeHtml(state.shortlistStorageError)}</p>` : ''}${state.personalDraftListStorageError ? `<p class="warning-banner">${escapeHtml(state.personalDraftListStorageError)}</p>` : ''}${state.draftIntelligenceStorageError ? `<p class="warning-banner">${escapeHtml(state.draftIntelligenceStorageError)}</p>` : ''}${state.localDraftEditsStorageError ? `<p class="warning-banner">${escapeHtml(state.localDraftEditsStorageError)}</p>` : ''}${toolsHtml}`,
    workspaceHtml,
    gpWarning: [
      draftedPlayers.some((player) => player.nhlCareerGamesPlayed === null)
        ? 'NHL career GP is pending or unavailable for some drafted players; their Experience Tier defaults to Veteran.' : '',
      draftedPlayers.some((player) => getExperienceTierFromGames(player.nhlCareerGamesPlayed) === 'Unknown')
        ? 'Some drafted players have invalid NHL career GP; their Experience Tier is Unknown.' : '',
    ].filter(Boolean).join(' '),
  });
  if (state.activeDashboardTab === 'draft-board') void hydrateDraftBoardProfiles(draftedPlayers);
  updateTopbarActions(unifiedState);

  document.querySelectorAll('[data-dashboard-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeDashboardTab = button.dataset.dashboardTab || 'draft-board';
      renderOwnerView(unifiedState);
    });
  });
  const rerender = () => renderOwnerView(unifiedState);
  document.querySelectorAll('.owner-item').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedOwner = button.dataset.owner;
      state.selectedPlayerKey = null;
      rerender();
    });
  });
  document.querySelectorAll('.player-item[data-player-key]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedPlayerKey = button.dataset.playerKey;
      rerender();
    });
  });
  document.getElementById('ownerSearchInput')?.addEventListener('input', (event) => {
    state.ownerSearch = event.target.value || '';
    rerender();
  });
  document.getElementById('playerSearchInput')?.addEventListener('input', (event) => {
    state.playerSearch = event.target.value || '';
    rerender();
  });
  document.getElementById('draftBoardSearch')?.addEventListener('input', (event) => {
    state.draftBoardSearch = event.target.value || '';
    rerender();
  });
  document.getElementById('draftPositionFilter')?.addEventListener('change', (event) => {
    state.draftPositionFilter = event.target.value || '';
    rerender();
  });
  document.getElementById('bestPositionFilter')?.addEventListener('change', (event) => {
    state.bestPositionFilter = event.target.value || '';
    rerender();
  });
  document.getElementById('draftCategoryFilter')?.addEventListener('change', (event) => {
    state.draftCategoryFilter = event.target.value || '';
    rerender();
  });
  document.querySelectorAll('[data-show-removed-players]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      state.showRemovedPlayers = checkbox.checked;
      rerender();
    });
  });
  document.querySelectorAll('[data-highlight-ahl-unavailable]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      state.highlightUnavailablePlayers = checkbox.checked;
      rerender();
    });
  });
  document.getElementById('bestAvailableSort')?.addEventListener('change', (event) => {
    state.bestAvailableSort = event.target.value || 'ADP';
    rerender();
  });
  const localPlayerKey = (playerId) => normalizeLookupKey(
    (state.draftIntelligence.players?.players || []).find((player) => player.id === playerId)?.name,
  );
  const saveLocalEdits = (edits) => {
    void persistLocalDraftEdits(edits);
  };
  const currentLocalEdits = () => normalizeLocalEdits(state.importedData?.localEdits || unifiedState.localEdits);
  const setPlayerRemovedLocally = (playerId, removed) => {
    const playerKey = localPlayerKey(playerId);
    if (!playerKey) return;
    const edits = currentLocalEdits();
    edits.removedPlayers = removed
      ? [...new Set([...edits.removedPlayers, playerKey])]
      : edits.removedPlayers.filter((key) => key !== playerKey);
    saveLocalEdits(edits);
  };
  document.querySelectorAll('[data-remove-player]').forEach((button) => {
    button.addEventListener('click', () => setPlayerRemovedLocally(button.dataset.removePlayer, true));
  });
  document.querySelectorAll('[data-undo-player]').forEach((button) => {
    button.addEventListener('click', () => setPlayerRemovedLocally(button.dataset.undoPlayer, false));
  });
  document.querySelectorAll('[data-local-assignment-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const playerKey = localPlayerKey(form.dataset.localAssignmentForm);
      const team = new FormData(form).get('team');
      if (!playerKey || typeof team !== 'string' || !teamNames.includes(team)) {
        alert('Select a team from the AHL roster before assigning locally.');
        return;
      }
      const edits = currentLocalEdits();
      edits.manualAssignments[playerKey] = team;
      edits.manualUnassign = edits.manualUnassign.filter((key) => key !== playerKey);
      saveLocalEdits(edits);
    });
  });
  document.querySelectorAll('[data-manual-unassign]').forEach((button) => {
    button.addEventListener('click', () => {
      const playerKey = localPlayerKey(button.dataset.manualUnassign);
      if (!playerKey) return;
      const edits = currentLocalEdits();
      delete edits.manualAssignments[playerKey];
      edits.manualUnassign = [...new Set([...edits.manualUnassign, playerKey])];
      saveLocalEdits(edits);
    });
  });
  document.querySelectorAll('[data-clear-local-assignment]').forEach((button) => {
    button.addEventListener('click', () => {
      const playerKey = localPlayerKey(button.dataset.clearLocalAssignment);
      if (!playerKey) return;
      const edits = currentLocalEdits();
      delete edits.manualAssignments[playerKey];
      edits.manualUnassign = edits.manualUnassign.filter((key) => key !== playerKey);
      saveLocalEdits(edits);
    });
  });
  document.getElementById('personalDraftSort')?.addEventListener('change', (event) => {
    state.personalDraftListSort = event.target.value || 'rank';
    rerender();
  });
  document.getElementById('personalDraftPositionFilter')?.addEventListener('change', (event) => {
    state.personalDraftPositionFilter = event.target.value || '';
    rerender();
  });
  document.getElementById('personalDraftCategoryFilter')?.addEventListener('change', (event) => {
    state.personalDraftCategoryFilter = event.target.value || '';
    rerender();
  });
  document.getElementById('personalDraftAvailabilityFilter')?.addEventListener('change', (event) => {
    state.personalDraftAvailabilityFilter = event.target.value || 'all';
    rerender();
  });
  document.querySelectorAll('[data-player-details]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDraftPlayerId = button.dataset.playerDetails || null;
      state.selectedDraftTeam = '';
      rerender();
    });
  });
  document.querySelector('[data-winning-bid-form] select[name="team"]')?.addEventListener('change', (event) => {
    state.selectedDraftTeam = event.target.value || '';
    rerender();
  });
  document.querySelectorAll('[data-close-player-details]').forEach((element) => {
    element.addEventListener('click', (event) => {
      if (event.target === element || element.classList.contains('modal-close')) {
        state.selectedDraftPlayerId = null;
        rerender();
      }
    });
  });
  document.querySelectorAll('.shortlist-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const playerId = button.dataset.shortlistPlayer;
      if (!playerId) return;
      if (state.shortlist.has(playerId)) state.shortlist.delete(playerId);
      else state.shortlist.add(playerId);
      try {
        localStorage.setItem('hockey-dashboard-draft-shortlist', JSON.stringify([...state.shortlist]));
        state.shortlistStorageError = '';
      } catch (error) {
        console.error('Unable to save draft shortlist', error);
        state.shortlistStorageError = 'Shortlist could not be saved in this browser.';
      }
      rerender();
    });
  });
  const persistPersonalDraftList = () => {
    try {
      localStorage.setItem('hockey-dashboard-personal-draft-list', JSON.stringify(state.personalDraftList));
      state.personalDraftListStorageError = '';
    } catch (error) {
      console.error('Unable to save Personal Draft List', error);
      state.personalDraftListStorageError = 'Personal Draft List could not be saved in this browser.';
    }
    rerender();
  };
  document.querySelectorAll('[data-personal-add]').forEach((button) => {
    button.addEventListener('click', () => {
      state.personalDraftList = addPersonalDraftListEntry(state.personalDraftList, button.dataset.personalAdd);
      persistPersonalDraftList();
    });
  });
  document.querySelectorAll('[data-personal-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      state.personalDraftList = removePersonalDraftListEntry(state.personalDraftList, button.dataset.personalRemove);
      persistPersonalDraftList();
    });
  });
  document.querySelectorAll('[data-personal-rank]').forEach((input) => {
    input.addEventListener('change', () => {
      state.personalDraftList = setPersonalDraftListRank(
        state.personalDraftList,
        input.dataset.personalRank,
        Number(input.value),
      );
      persistPersonalDraftList();
    });
  });
  document.querySelectorAll('[data-personal-notes]').forEach((input) => {
    input.addEventListener('change', () => {
      state.personalDraftList = updatePersonalDraftListEntry(
        state.personalDraftList,
        input.dataset.personalNotes,
        { notes: input.value },
      );
      persistPersonalDraftList();
    });
  });
  document.querySelectorAll('[data-personal-flag]').forEach((input) => {
    input.addEventListener('change', () => {
      const field = input.dataset.personalFlag;
      if (!['target', 'avoid', 'keeperTarget', 'breakoutTarget'].includes(field)) {
        throw new Error(`Unsupported Personal Draft List flag: ${field || 'missing'}.`);
      }
      state.personalDraftList = updatePersonalDraftListEntry(
        state.personalDraftList,
        input.dataset.personalPlayer,
        { [field]: input.checked },
      );
      persistPersonalDraftList();
    });
  });
  document.querySelectorAll('[data-personal-max-bid]').forEach((input) => {
    input.addEventListener('change', () => {
      state.personalDraftList = updatePersonalDraftListEntry(
        state.personalDraftList,
        input.dataset.personalMaxBid,
        { maxBidNote: input.value },
      );
      persistPersonalDraftList();
    });
  });
  document.querySelector('[data-personal-export]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      players: state.personalDraftList,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `personal-draft-list-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
  document.querySelector('[data-personal-import-trigger]')?.addEventListener('click', () => {
    document.querySelector('[data-personal-import-file]')?.click();
  });
  document.querySelector('[data-personal-import-file]')?.addEventListener('change', async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const entries = imported && !Array.isArray(imported) && Array.isArray(imported.players)
        ? imported.players
        : imported;
      state.personalDraftList = normalizePersonalDraftList(entries);
      persistPersonalDraftList();
    } catch (error) {
      console.error('Unable to import Personal Draft List', error);
      alert(error instanceof Error ? `Unable to import Personal Draft List: ${error.message}` : 'Unable to import Personal Draft List.');
    } finally {
      input.value = '';
    }
  });
  document.querySelector('[data-export-draft-json]')?.addEventListener('click', downloadDraftIntelligenceBundle);
  document.getElementById('reset-local-edits')?.addEventListener('click', () => {
    if (!window.confirm('Reset local draft edits by refreshing authoritative AHL Sheets? Locally imported Dobber data will be retained.')) {
      return;
    }
    const refreshButton = document.getElementById('liveRefreshBtn');
    if (!refreshButton || refreshButton.disabled) {
      alert('AHL refresh is not available right now. Local edits were not cleared.');
      return;
    }
    refreshButton.click();
  });
  document.querySelector('[data-winning-bid-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const player = players.find((entry) => entry.id === form.dataset.winningBidForm);
    const formData = new FormData(form);
    if (!player) {
      alert('Unable to save winning bid. Player record is unavailable.');
      return;
    }
    if (player.status !== 'in-ahl' || player.localStatus === 'removed-local'
      || !availableKeys.has(normalizeLookupKey(player.name))
      || draftedPlayers.some((drafted) => drafted.id === player.id)) {
      alert('Unable to save winning bid. This player is not available to draft.');
      return;
    }
    const team = String(formData.get('team') || '').trim();
    const result = upsertWorkingAssignment(unifiedState, {
      playerKey: form.dataset.assignmentKey || player.id,
      name: player.name,
      position: player.position || '—',
      team,
      bid: formData.get('bid'),
      classification: formData.get('classification'),
      fallbackClassification: '',
      status: 'Winning Bid',
    });
    if (result.error) {
      alert(result.error);
      return;
    }
    state.importedData = result.state;
    state.selectedOwner = team;
    state.selectedDraftPlayerId = null;
    state.activeDashboardTab = 'team-budgets';
    renderOwnerView(result.state);
  });
  document.querySelectorAll('.clear-assignment-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const nextState = removeWorkingAssignment(unifiedState, button.dataset.clearPlayerKey);
      state.importedData = nextState;
      renderOwnerView(nextState);
    });
  });

  if (focusState) {
    const replacement = document.getElementById(focusState.id);
    replacement?.focus();
    if (replacement && focusState.selectionStart !== null && focusState.selectionEnd !== null) {
      replacement.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    }
  }
}

async function queueHistoricalBidsHydration(unifiedState) {
  if (!unifiedState || state.liveCache.historicalBids || state.liveCache.historicalBidsRequest) {
    return;
  }

  try {
    await loadAhlHistoricalBids(state.liveCache, typeof fetch === 'function' ? fetch : undefined);
  } catch (err) {
    console.error('Unable to load AHL historical bid stats', err);
  } finally {
    if (state.activeDashboardTab) {
      renderOwnerView(unifiedState);
    }
  }
}

async function queuePlayerProfileHydration(unifiedState, selectedPlayer, rosterRecord) {
  if (!selectedPlayer || !selectedPlayer.playerKey || state.liveRequests[selectedPlayer.playerKey]) {
    return;
  }

  if (state.liveProfiles[selectedPlayer.playerKey]?.fetchedAt && state.liveProfiles[selectedPlayer.playerKey]?.status !== 'loading') {
    return;
  }

  state.liveRequests[selectedPlayer.playerKey] = true;
  state.liveProfiles[selectedPlayer.playerKey] = state.liveProfiles[selectedPlayer.playerKey] || {
    status: 'loading',
    playerKey: selectedPlayer.playerKey,
  };

  try {
    const profile = await resolveLivePlayerProfile({
      player: selectedPlayer,
      rosterRecord,
      cache: state.liveCache,
    });
    state.liveProfiles[selectedPlayer.playerKey] = profile;
  } catch (err) {
    state.liveProfiles[selectedPlayer.playerKey] = {
      playerKey: selectedPlayer.playerKey,
      status: 'offline',
      fetchedAt: new Date().toISOString(),
      errors: [err.message],
      identity: {},
      currentSeason: {},
      historical: {},
      team: null,
      schedule: null,
    };
  } finally {
    delete state.liveRequests[selectedPlayer.playerKey];
    if (state.selectedPlayerKey === selectedPlayer.playerKey) {
      renderOwnerView(unifiedState);
    }
  }
}

function renderImportScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="panel import-card">
      <div class="dropzone">
        <strong>Upload a CSV Snapshot</strong>
        <p>Import the latest prospects, veterans, or roster CSV snapshot to refresh the league state. Use the header buttons to import or export a saved dashboard state between devices.</p>
        <div class="file-input-wrap">
          <input id="csvFileInput" type="file" accept=".csv,text/csv" />
          <span class="file-placeholder">Choose CSV File</span>
        </div>
      </div>
    </section>
  `;
  updateTopbarActions(state.importedData || loadState());

  const fileInput = document.getElementById('csvFileInput');
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const csvText = await file.text();
    handleImport(csvText, file.name);
  });
}

function handleImport(csvText, fileName) {
  const datasetType = detectDatasetType(csvText);

  if (datasetType === 'unknown') {
    const app = document.getElementById('app');
    const rows = String(csvText || '').split(/\r?\n/).filter((row) => row.trim());
    const message = isTransactionsSnapshot(rows)
      ? 'This is a transaction log, not a player snapshot. Keep it in Google Sheets and import Prospects, Veterans, or Roster data here.'
      : isDraftBoardSnapshot(rows)
        ? 'This is a draft board, not a player snapshot. Keep the draft board in Google Sheets and import Prospects, Veterans, or Roster data here.'
        : 'The uploaded CSV does not match the expected prospect, veteran, or roster structure.';
    app.innerHTML = `
      <section class="panel import-card">
        <h2>Unable to detect dataset type</h2>
        <p>${message}</p>
        <button class="primary" id="retryImportBtn">Try Another File</button>
      </section>
    `;

    document.getElementById('retryImportBtn').addEventListener('click', renderImportScreen);
    return;
  }

  let parsedData;

  if (datasetType === 'prospects') {
    parsedData = parseProspects(csvText);
  } else if (datasetType === 'veterans') {
    parsedData = parseVeterans(csvText);
  } else if (datasetType === 'roster' || datasetType === 'positions' || datasetType === 'utility') {
    parsedData = parseRoster(csvText);
  } else if (datasetType === 'draft') {
    parsedData = parseDraftBoard(csvText);
  } else {
    parsedData = null;
  }

  if (!parsedData || (!parsedData.prospects && !parsedData.veterans && !parsedData.players)) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="panel import-card">
        <h2>Import Failed</h2>
        <p>The file was uploaded but could not be parsed.</p>
        <button class="primary" id="retryImportBtn">Try Another File</button>
      </section>
    `;

    document.getElementById('retryImportBtn').addEventListener('click', renderImportScreen);
    return;
  }

  state.previewRows = getVisiblePreviewRows(parsedData);
  const app = document.getElementById('app');
  app.innerHTML = renderPreviewSection(parsedData, datasetType);

  document.getElementById('cancelImportBtn').addEventListener('click', renderImportScreen);
  document.getElementById('confirmImportBtn').addEventListener('click', () => {
    // Merge parsed dataset into the unified persisted state
    const current = loadState();
    const next = mergeDataset(current, datasetType, parsedData, fileName);
    persistState(next);

    state.importedData = next;
    state.liveRefreshMessage = hasGoogleSheetSnapshot(next) ? state.liveRefreshMessage : '';
    // render owner view with unified state
    renderOwnerView(next);
  });
}

function loadDraftShortlist() {
  try {
    const raw = localStorage.getItem('hockey-dashboard-draft-shortlist');
    if (raw === null) return new Set();
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.some((entry) => typeof entry !== 'string')) {
      throw new Error('Saved shortlist data has an invalid format.');
    }
    return new Set(entries);
  } catch (error) {
    console.error('Unable to load draft shortlist', error);
    state.shortlistStorageError = 'Saved shortlist could not be loaded; shortlist changes may not persist.';
    return new Set();
  }
}

function loadPersonalDraftList() {
  try {
    const raw = localStorage.getItem('hockey-dashboard-personal-draft-list');
    return raw === null ? [] : normalizePersonalDraftList(JSON.parse(raw));
  } catch (error) {
    console.error('Unable to load Personal Draft List', error);
    state.personalDraftListStorageError = 'Saved Personal Draft List could not be loaded; changes may not persist.';
    return [];
  }
}

async function commitDobberImport(nextState, message) {
  persistState(nextState);
  state.importedData = nextState;
  state.draftIntelligenceFromOfflineSnapshot = false;
  applyAhlSheetIntelligence(nextState);
  const offlineWarning = state.draftIntelligence
    ? await persistOfflineAhlSnapshot(nextState)
    : 'Draft Intelligence files have not loaded yet; offline snapshot will be saved when they finish.';
  state.liveRefreshMessage = [message, offlineWarning].filter(Boolean).join('; ');
  renderOwnerView(nextState);
  const status = document.getElementById('liveRefreshStatus');
  if (status) status.textContent = state.liveRefreshMessage;
}

function renderDobberImportStatus(kind, metadata, result = null) {
  const statusElement = document.getElementById(
    kind === 'excel' ? 'dobberExcelImportStatus' : 'dobberPdfImportStatus',
  );
  if (!statusElement) return;
  const source = metadata || {};
  const latestAttempt = result || source.lastAttempt;
  const label = kind === 'excel' ? 'Dobber Excel' : 'Dobber PDFs';
  if (latestAttempt?.status === 'invalid-format') {
    const detail = (latestAttempt.warnings || []).join(' ');
    statusElement.textContent = `${label}: Invalid ${kind === 'excel' ? 'workbook' : 'PDF'} format. ${detail}`;
    statusElement.dataset.status = 'invalid-format';
    return;
  }
  if (latestAttempt?.status === 'loaded-local' || source.status === 'loaded-local') {
    const count = latestAttempt?.playersParsed ?? source.records ?? 0;
    const timestamp = latestAttempt?.lastImport || source.lastImport || source.importedAt;
    const importedAt = timestamp ? ` Last imported ${new Date(timestamp).toLocaleString()}.` : '';
    const parsedMessage = kind === 'excel'
      ? `loaded locally (${count} players).`
      : `parsed successfully (${count} player intel records).`;
    statusElement.textContent = `${label} ${parsedMessage}${importedAt}`;
    const warnings = latestAttempt?.warnings || source.warnings || [];
    if (warnings.length) statusElement.textContent += ` ${warnings.join(' ')}`;
    statusElement.dataset.status = 'loaded-local';
    return;
  }
  statusElement.textContent = `${label} unavailable. Select a local ${kind === 'excel' ? '.xlsx workbook' : 'PDF file'}.`;
  statusElement.dataset.status = source.status || 'unavailable';
}

function failedDobberImport(fileName, warning) {
  return {
    status: 'invalid-format',
    fileName,
    lastImport: null,
    warnings: [warning],
    playersParsed: 0,
    players: {},
    intelByPlayerKey: {},
  };
}

function persistDobberImportFailure(kind, result) {
  const next = normalizeState(state.importedData || loadState());
  const metadataKey = kind === 'excel' ? 'dobberExcel' : 'dobberPdfs';
  next.metadata[metadataKey] = updateDobberImportMetadata(
    next.metadata[metadataKey],
    result,
  );
  persistState(next);
  state.importedData = next;
  renderDobberImportStatus(kind, next.metadata[metadataKey], result);
}

async function importDobberExcelFile(file) {
  const result = await ingestDobberExcelFile(file);
  console.info('Dobber Excel import', {
    status: result.status,
    fileName: result.fileName,
    lastImport: result.lastImport,
    warnings: result.warnings,
    playersParsed: result.playersParsed,
  });
  if (result.status !== 'loaded-local') {
    persistDobberImportFailure('excel', result);
    return result;
  }
  const next = normalizeState(state.importedData || loadState());
  next.metadata.dobberExcel = updateDobberImportMetadata(next.metadata.dobberExcel, result);
  const current = next.datasets.dobber || {};
  next.datasets.dobber = {
    ...current,
    players: attachDobberIntel(result.players, current.intelByPlayerKey, current.prospectMetadataByPlayerKey),
    excelSourceName: result.fileName,
    excelImportedAt: result.lastImport,
  };
  next.metadata.dobberStatus = 'loaded-local';
  renderDobberImportStatus('excel', next.metadata.dobberExcel, result);
  await commitDobberImport(next, `Dobber Excel loaded locally (${result.playersParsed} players)`);
  return result;
}

async function importDobberPdfFiles(files) {
  const selectedFiles = [...files];
  if (!selectedFiles.length) return null;
  const next = normalizeState(state.importedData || loadState());
  const result = await ingestDobberPdfFiles(
    selectedFiles,
    getDobberPlayerNames(next),
    loadPdfJs(),
  );
  console.info('Dobber PDFs import', {
    status: result.status,
    fileName: result.fileName,
    lastImport: result.lastImport,
    warnings: result.warnings,
    playersParsed: result.playersParsed,
    intelEdgeAttached: result.playersParsed,
  });
  if (result.status !== 'loaded-local') {
    persistDobberImportFailure('pdfs', result);
    return result;
  }
  next.metadata.dobberPdfs = updateDobberImportMetadata(next.metadata.dobberPdfs, result);
  const current = next.datasets.dobber || {};
  next.datasets.dobber = {
    ...current,
    players: attachDobberIntel(current.players, result.intelByPlayerKey, result.prospectMetadataByPlayerKey),
    intelByPlayerKey: result.intelByPlayerKey,
    prospectMetadataByPlayerKey: result.prospectMetadataByPlayerKey,
    pdfSourceName: result.fileName,
    pdfImportedAt: result.lastImport,
  };
  next.metadata.dobberStatus = 'loaded-local';
  renderDobberImportStatus('pdfs', next.metadata.dobberPdfs, result);
  await commitDobberImport(next, `Dobber PDFs parsed successfully (${result.playersParsed} player intel records)`);
  return result;
}

function initialize() {
  const backToImportBtn = document.getElementById('backToImportBtn');
  const liveRefreshBtn = document.getElementById('liveRefreshBtn');
  const topbarCsvFileInput = document.getElementById('topbarCsvFileInput');
  const liveRefreshStatus = document.getElementById('liveRefreshStatus');
  const draftIntelligenceStatus = document.getElementById('draftIntelligenceStatus');
  const importDobberExcelBtn = document.getElementById('importDobberExcelBtn');
  const importDobberPdfsBtn = document.getElementById('importDobberPdfsBtn');
  const dobberExcelFileInput = document.getElementById('dobberExcelFileInput');
  const dobberPdfFileInput = document.getElementById('dobberPdfFileInput');
  const dobberExcelDropZone = document.getElementById('dobberExcelDropZone');
  const dobberPdfDropZone = document.getElementById('dobberPdfDropZone');

  const handleExcelFiles = async (files) => {
    const selectedFiles = [...(files || [])];
    if (!selectedFiles.length) return;
    if (selectedFiles.length !== 1) {
      const result = failedDobberImport(
        selectedFiles.map((file) => file.name).join(', '),
        'Drop one Excel workbook at a time.',
      );
      console.error('Dobber Excel import status', result);
      persistDobberImportFailure('excel', result);
      return;
    }
    const statusElement = document.getElementById('dobberExcelImportStatus');
    if (statusElement) statusElement.textContent = 'Reading Dobber workbook...';
    try {
      await importDobberExcelFile(selectedFiles[0]);
    } catch (error) {
      const warning = error instanceof Error ? error.message : 'Dobber Excel import failed.';
      if (statusElement) statusElement.textContent = `Dobber Excel import failed. ${warning}`;
      console.error('Dobber Excel import failed', error);
      alert(warning);
    }
  };

  const handlePdfFiles = async (files) => {
    const selectedFiles = [...(files || [])];
    if (!selectedFiles.length) return;
    const statusElement = document.getElementById('dobberPdfImportStatus');
    if (statusElement) statusElement.textContent = `Reading ${selectedFiles.length} Dobber PDF file(s)...`;
    try {
      await importDobberPdfFiles(selectedFiles);
    } catch (error) {
      const warning = error instanceof Error ? error.message : 'Dobber PDF import failed.';
      if (statusElement) statusElement.textContent = `Dobber PDF import failed. ${warning}`;
      console.error('Dobber PDF import failed', error);
      alert(warning);
    }
  };

  const bindDobberDropZone = (zone, handleFiles, acceptFiles) => {
    if (!zone) return;
    zone.addEventListener('click', () => acceptFiles());
    zone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        acceptFiles();
      }
    });
    zone.addEventListener('dragenter', (event) => {
      event.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragover', (event) => event.preventDefault());
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('dragover');
      void handleFiles(event.dataTransfer?.files || []);
    });
  };

  if (liveRefreshBtn && liveRefreshStatus) {
    liveRefreshBtn.addEventListener('click', async () => {
      liveRefreshBtn.disabled = true;
      liveRefreshBtn.textContent = 'Refreshing...';
      liveRefreshStatus.textContent = 'Downloading current AHL Sheets data';

      try {
        let nextState = await refreshGoogleSheetState(state.importedData || loadState());
        const dobberRefresh = await refreshDobberState(nextState);
        nextState = dobberRefresh.state;
        persistState(nextState);
        state.importedData = nextState;
        state.manualOverrides = Array.isArray(nextState.manualOverrides) ? nextState.manualOverrides : [];
        state.draftIntelligenceFromOfflineSnapshot = false;
        applyAhlSheetIntelligence(nextState);
        renderDobberImportStatus('excel', nextState.metadata.dobberExcel);
        renderDobberImportStatus('pdfs', nextState.metadata.dobberPdfs);
        const offlineWarning = await persistOfflineAhlSnapshot(nextState);
        state.liveRefreshMessage = [
          `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          dobberRefresh.message,
          offlineWarning,
        ].filter(Boolean).join('; ');
        liveRefreshStatus.textContent = state.liveRefreshMessage;
        state.selectedPlayerKey = null;
        renderOwnerView(nextState);
      } catch (error) {
        console.error('AHL Sheets refresh failed', error);
        state.liveRefreshMessage = 'Refresh failed';
        liveRefreshStatus.textContent = state.liveRefreshMessage;
        alert(error instanceof Error ? error.message : 'AHL Sheets refresh failed.');
      } finally {
        liveRefreshBtn.disabled = false;
        liveRefreshBtn.textContent = 'Refresh AHL Sheets';
      }
    });
  }

  backToImportBtn.addEventListener('click', () => {
    if (topbarCsvFileInput) {
      topbarCsvFileInput.value = '';
      topbarCsvFileInput.click();
    } else {
      state.selectedOwner = null;
      state.selectedPlayerKey = null;
      renderImportScreen();
    }
  });

  importDobberExcelBtn?.addEventListener('click', () => {
    if (dobberExcelFileInput) {
      dobberExcelFileInput.value = '';
      dobberExcelFileInput.click();
    }
  });
  dobberExcelFileInput?.addEventListener('change', async () => {
    await handleExcelFiles(dobberExcelFileInput.files || []);
    dobberExcelFileInput.value = '';
  });
  importDobberPdfsBtn?.addEventListener('click', () => {
    if (dobberPdfFileInput) {
      dobberPdfFileInput.value = '';
      dobberPdfFileInput.click();
    }
  });
  dobberPdfFileInput?.addEventListener('change', async () => {
    await handlePdfFiles(dobberPdfFileInput.files || []);
    dobberPdfFileInput.value = '';
  });
  bindDobberDropZone(dobberExcelDropZone, handleExcelFiles, () => dobberExcelFileInput?.click());
  bindDobberDropZone(dobberPdfDropZone, handlePdfFiles, () => dobberPdfFileInput?.click());

  if (topbarCsvFileInput) {
    topbarCsvFileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const csvText = await file.text();
      handleImport(csvText, file.name);
      topbarCsvFileInput.value = '';
    });
  }

  const exportStateBtn = document.getElementById('exportStateBtn');
  if (exportStateBtn) {
    exportStateBtn.addEventListener('click', () => {
      downloadPortableState(state.importedData || loadState());
    });
  }

  const importStateBtn = document.getElementById('importStateBtn');
  const stateFileInput = document.getElementById('stateFileInput');
  if (importStateBtn && stateFileInput) {
    importStateBtn.addEventListener('click', () => {
      stateFileInput.value = '';
      stateFileInput.click();
    });

    stateFileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        await importPortableStateFile(file);
      } catch (err) {
        alert(`Unable to import saved state: ${err.message}`);
      } finally {
        stateFileInput.value = '';
      }
    });
  }

  if (typeof window !== 'undefined') {
    let compactViewport = isCompactViewport();
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      let incomingState;
      try {
        incomingState = normalizeState(JSON.parse(event.newValue));
      } catch (error) {
        console.error('Unable to reconcile local draft edits from another tab', error);
        return;
      }
      const currentTimestamp = normalizeLocalEdits(state.importedData?.localEdits).lastUpdated || 0;
      const incomingTimestamp = incomingState.localEdits.lastUpdated || 0;
      if (incomingTimestamp <= currentTimestamp) return;
      state.importedData = incomingState;
      state.manualOverrides = Array.isArray(incomingState.manualOverrides) ? incomingState.manualOverrides : [];
      applyAhlSheetIntelligence(incomingState);
      void persistOfflineAhlSnapshot(incomingState).then((warning) => {
        state.localDraftEditsStorageError = warning;
        renderOwnerView(incomingState);
      });
    });
    window.addEventListener('resize', () => {
      const nextCompactViewport = isCompactViewport();
      if (nextCompactViewport === compactViewport) {
        return;
      }

      compactViewport = nextCompactViewport;
      if (hasLoadedData(state.importedData || DEFAULT_STATE)) {
        renderOwnerView(state.importedData || loadState());
      } else {
        renderImportScreen();
      }
    });
  }

  const stored = loadState();
  state.importedData = stored;
  renderDobberImportStatus('excel', stored.metadata.dobberExcel);
  renderDobberImportStatus('pdfs', stored.metadata.dobberPdfs);
  state.shortlist = loadDraftShortlist();
  state.personalDraftList = loadPersonalDraftList();
  state.manualOverrides = Array.isArray(stored.manualOverrides) ? stored.manualOverrides : [];
  state.liveProfiles = state.liveCache?.players ? { ...state.liveCache.players } : {};
  state.liveRefreshMessage = hasGoogleSheetSnapshot(stored) ? 'Google Sheets snapshot loaded' : '';
  state.selectedOwner = null;
  state.selectedPlayerKey = null;

  // if any dataset is present (status ok), show owner view
  if (hasLoadedData(stored)) {
    renderOwnerView(stored);
  } else {
    renderImportScreen();
  }

  if (draftIntelligenceStatus) draftIntelligenceStatus.textContent = 'Loading Draft Intelligence';
  void loadDraftIntelligenceFiles()
    .then(async (draftIntelligence) => {
      if (!state.draftIntelligenceFromOfflineSnapshot) state.draftIntelligence = draftIntelligence;
      applyAhlSheetIntelligence(state.importedData || DEFAULT_STATE);
      if (draftIntelligenceStatus) {
        draftIntelligenceStatus.textContent = state.draftIntelligenceFromOfflineSnapshot
          ? 'Draft Intelligence offline snapshot loaded'
          : draftIntelligence.players.status === 'partial'
          ? 'Draft Intelligence partial'
          : 'Draft Intelligence loaded';
      }
      if (state.importedData?.metadata?.ahlSheets?.status === 'ok') {
        const offlineWarning = await persistOfflineAhlSnapshot(state.importedData);
        if (offlineWarning) {
          state.liveRefreshMessage = `AHL Sheets loaded; ${offlineWarning}`;
        } else if (state.liveRefreshMessage.startsWith('AHL Sheets loaded; Offline snapshot was not saved:')) {
          state.liveRefreshMessage = 'AHL Sheets loaded';
        }
        const liveStatus = document.getElementById('liveRefreshStatus');
        if (liveStatus) liveStatus.textContent = state.liveRefreshMessage;
      }
      if (hasLoadedData(state.importedData || DEFAULT_STATE)) {
        renderOwnerView(state.importedData || loadState());
      }
    })
    .catch((error) => {
      console.error('Draft Intelligence files failed to load', error);
      if (draftIntelligenceStatus) draftIntelligenceStatus.textContent = 'Draft Intelligence unavailable';
    });

  void refreshAhlSheetsOnPageLoad();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initialize);
}

export {
  STORAGE_KEY,
  DRAFT_ROSTER_RULES,
  persistState,
  state,
  buildUnifiedPlayer,
  computeOwnerStatistics,
  computeOwnerAggregates,
  addManualOverrideEntry,
  removeManualOverrideById,
  buildDraftValidationReport,
  buildOwnerDraftPlan,
  createManualOverrideDraft,
  getDataQualitySources,
  isRetentionListLoaded,
  getSnapshotAgeInfo,
  parseDraftBoard,
  getLiveCacheStatus,
  resolveWorkingAssignmentTeamName,
  createWorkingAssignmentDraft,
  refreshDobberState,
  refreshGoogleSheetState,
  serializePortableStateBundle,
  parsePortableStateBundle,
};