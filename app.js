import { parseProspects } from './prospectParser.js';
import { parseVeterans } from './veteranParser.js';
import { parseRoster } from './rosterParser.js';
import {
  loadLiveCache,
  persistLiveCache,
  resolveLivePlayerProfile,
  normalizeLookupKey,
  pickRecordValue,
  extractTeamAbbrev,
} from './liveNhlApi.js';

const STORAGE_KEY = 'hockey-dashboard-owner-view';
const APP_STATE_VERSION = 2;
const PORTABLE_STATE_VERSION = 1;
const MAX_PREVIEW_ROWS = 10;
const DRAFT_ROSTER_RULES = Object.freeze({
  budgetCap: 250,
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
const SKATER_POSITION_KEYS = new Set(['c', 'lw', 'rw', 'd', 'ld', 'rd', 'f']);
const GOALIE_TEAM_POSITION_KEYS = new Set(['g', 'goalie', 'goalieteam', 'goalie team', 'team goalie', 'gt']);

const state = {
  importedData: null,
  selectedOwner: null,
  previewRows: [],
  ownerSearch: '',
  playerSearch: '',
  availablePlayerSearch: '',
  manualOverrides: [],
  selectedPlayerKey: null,
  liveCache: loadLiveCache(),
  liveProfiles: {},
  liveRequests: {},
};

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

export function detectDatasetType(csvText) {
  const text = String(csvText || '');
  const rows = text.split(/\r?\n/).filter((row) => row.trim());
  const normalized = rows.join('\n').toUpperCase();

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

  const rosterCandidate = parseRoster(text);
  if (Object.keys(rosterCandidate?.players || {}).length > 0) {
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

export function buildOwnerViewData(rawState) {
  // Accept either legacy importedData (flat) or the new unified state with datasets
  const DEFAULT = {
    version: 1,
    datasets: { prospects: null, veterans: null, roster: null, transactions: null },
    metadata: {
      prospects: { status: 'empty' },
      veterans: { status: 'empty' },
      roster: { status: 'empty' },
      transactions: { status: 'empty' },
    },
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
  const prospectsArr = Object.values(stateObj.datasets.prospects?.prospects || {}).map((player) => decoratePlayer(player, 'prospect'));
  const veteransArr = Object.values(stateObj.datasets.veterans?.veterans || {}).map((player) => decoratePlayer(player, 'veteran'));
  const rosterArr = Object.values(stateObj.datasets.roster?.players || {}).map((player) => decoratePlayer(player, 'roster'));

  const ownerSet = new Set();
  // derive owners from dataset owners maps if present
  if (stateObj.datasets.prospects?.owners) Object.keys(stateObj.datasets.prospects.owners).forEach((o) => ownerSet.add(o));
  if (stateObj.datasets.veterans?.owners) Object.keys(stateObj.datasets.veterans.owners).forEach((o) => ownerSet.add(o));
  rosterArr.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });

  // derive from player records as well
  prospectsArr.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });
  veteransArr.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });

  const owners = [...ownerSet].sort((a, b) => a.localeCompare(b)).map((owner) => {
    const ownerProspects = prospectsArr.filter((p) => p.owner === owner);
    const ownerVeterans = veteransArr.filter((p) => p.owner === owner);
    const ownerRosterPlayers = rosterArr.filter((p) => p.owner === owner);
    const farmPlayers = ownerProspects.filter((p) => p.farm);
    const matchingRights = ownerProspects.filter((p) => p.matchingRights);

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

  if (type === 'roster' || type === 'transactions') {
    if (parsed.players && typeof parsed.players === 'object') return Object.keys(parsed.players).length;
    if (Array.isArray(parsed)) return parsed.length;
    return Object.keys(parsed).length;
  }

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
  datasets: { prospects: null, veterans: null, roster: null, transactions: null },
  metadata: {
    prospects: { status: 'empty' },
    veterans: { status: 'empty' },
    roster: { status: 'empty' },
    transactions: { status: 'empty' },
  },
  manualOverrides: [],
  workingAssignments: {},
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateObj));
  } catch (err) {
    console.error('Failed to persist state', err);
  }
}

function migrateOldState(oldObj) {
  const newState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  if (!oldObj) return newState;

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
  next.datasets = next.datasets || { prospects: null, veterans: null, roster: null, transactions: null };
  next.datasets[datasetType] = parsedData;
  next.metadata = next.metadata || {};
  next.metadata[datasetType] = {
    status: (parsedData ? 'ok' : 'empty'),
    sourceName: sourceName || null,
    importedAt: parsedData ? new Date().toISOString() : null,
    records: parsedData ? countParsedRecords(parsedData, datasetType) : 0,
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
  next.datasets = stateObj.datasets || next.datasets;
  next.metadata = stateObj.metadata || next.metadata;
  next.manualOverrides = Array.isArray(stateObj.manualOverrides) ? stateObj.manualOverrides : [];
  next.workingAssignments = stateObj.workingAssignments && typeof stateObj.workingAssignments === 'object' && !Array.isArray(stateObj.workingAssignments)
    ? stateObj.workingAssignments
    : {};
  return next;
}

function getSnapshotAgeInfo(stateObj) {
  const datasets = ['prospects', 'veterans', 'roster', 'transactions'];
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

function hasLoadedData(stateObj) {
  return ['prospects', 'veterans', 'roster', 'transactions']
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

  const hours = Math.round(ageMinutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
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

  if (!appStateSource) {
    throw new Error('This file does not contain a Hockey Dashboard saved state.');
  }

  return {
    appState: normalizeState(appStateSource),
    liveCache: sanitizeLiveCache(candidate?.liveCache),
    exportedAt: candidate?.exportedAt || null,
    format: candidate?.format || 'legacy',
  };
}

function updateTopbarActions(currentState = state.importedData || DEFAULT_STATE) {
  const exportStateBtn = document.getElementById('exportStateBtn');
  if (exportStateBtn) {
    const hasPortableContent = hasLoadedData(currentState)
      || Boolean(currentState?.manualOverrides?.length)
      || Boolean(Object.keys(currentState?.workingAssignments || {}).length);
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
  const parsedJson = JSON.parse(rawText);
  return applyPortableStateBundle(parsedJson);
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

function getRecordName(record) {
  return String(pickRecordValue(record, ['name', 'fullname', 'playername', 'displayname', 'player'])).trim();
}

function getRecordOwner(record) {
  return String(pickRecordValue(record, ['owner', 'team', 'currentteam', 'club'])).trim();
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

function buildOwnerDraftPlan(ownerEntry) {
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

  const retainedSpend = players.reduce((sum, player) => sum + getPlayerRetainedCost(player), 0);
  const remainingBudget = Number((DRAFT_ROSTER_RULES.budgetCap - retainedSpend).toFixed(2));
  const skatersNeeded = Math.max(0, DRAFT_ROSTER_RULES.targetSkaters - slotCounts.skaters);
  const goalieTeamsNeeded = Math.max(0, DRAFT_ROSTER_RULES.targetGoalieTeams - slotCounts.goalieTeams);
  const slotsNeeded = skatersNeeded + goalieTeamsNeeded;
  const minimumRequired = Number((slotsNeeded * DRAFT_ROSTER_RULES.minSlotCost).toFixed(2));
  const budgetShortfall = Number(Math.max(0, minimumRequired - remainingBudget).toFixed(2));

  return {
    owner: ownerEntry?.name || 'Unknown',
    retainedSpend: Number(retainedSpend.toFixed(2)),
    remainingBudget,
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

function getAvailableStatus(record) {
  const owner = getRecordOwner(record);
  const draftedField = pickRecordValue(record, ['drafted', 'draftstatus', 'draft_status']);
  const retainedField = pickRecordValue(record, ['retained', 'retention', 'kept']);
  const availableField = pickRecordValue(record, ['available', 'isavailable', 'undrafted']);
  const drafted = isTruthyRecordValue(draftedField);
  const retained = isTruthyRecordValue(retainedField);
  const explicitlyAvailable = isTruthyRecordValue(availableField) || isFalsyRecordValue(draftedField);

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

  if (explicitlyAvailable || !owner) {
    return { status: 'available', label: 'Available' };
  }

  return { status: 'unknown', label: 'Unknown' };
}

function createManualOverrideDraft(data) {
  const name = String(data?.name || '').trim();
  const position = String(data?.position || '').trim();
  const classification = normalizeClassification(data?.classification);
  const notes = String(data?.notes || '').trim();
  if (!name || !position || !classification) {
    return null;
  }

  const createdAt = new Date().toISOString();
  const idSeed = `${name}-${classification}-${createdAt}`;
  const overrideId = `manual-${normalizeLookupKey(idSeed).replace(/\s+/g, '-')}`;

  return {
    id: overrideId,
    name,
    position,
    classification,
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
  if (!Number.isFinite(bidNumeric) || bidNumeric < DRAFT_ROSTER_RULES.minSlotCost) {
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
      error: `Team and bid are required. Bid must be at least $${DRAFT_ROSTER_RULES.minSlotCost.toFixed(2)}.`,
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
  const assignedByPlayerKey = new Set(Object.keys(workingAssignments).map((key) => String(key || '').trim()).filter(Boolean));
  const snapshot = getSnapshotAgeInfo(nextState);
  const ownerDraftPlans = ownerData.owners.map((owner) => buildOwnerDraftPlan(owner));

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
      if (availableState.status === 'available' && owners.length) {
        availableIntegrityIssues.push(`${getRecordName(rosterEntry) || key}: owned in sheet but flagged available in roster`);
      }
      if (owners.length && rosterOwner && !owners.includes(rosterOwner)) {
        ownershipMismatches.push(`${getRecordName(rosterEntry) || key}: roster=${rosterOwner}, sheet=${owners.join(' / ')}`);
      }
      if (availableState.status === 'available' && owners.length === 0 && !assignedByPlayerKey.has(key)) {
        const recordType = getRecordType(rosterEntry) || 'Unknown';
        availablePlayers.push({
          key,
          name: getRecordName(rosterEntry) || key,
          position: getRecordPosition(rosterEntry) || '—',
          type: recordType,
          owner: rosterOwner || '—',
          status: 'Available',
          manualOverride: false,
        });
      }
    }
  });

  manualOverrides.forEach((override) => {
    const key = normalizeLookupKey(override.name);
    if (!key) return;
    if (assignedByPlayerKey.has(override.id || `manual-${key}`)) return;
    availablePlayers.push({
      key: override.id || `manual-${key}`,
      name: override.name,
      position: override.position || '—',
      type: normalizeClassification(override.classification) || 'Manual',
      owner: '—',
      status: 'MANUAL OVERRIDE',
      manualOverride: true,
      notes: override.notes || '',
      createdAt: override.createdAt || null,
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
    retentionListLoaded: veterans.length > 0,
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
  const totalMatchingRights = prospects.filter((p) => p.matchingRights).length;

  return { totalOwners, totalProspects, totalVeterans, totalFarmPlayers, totalMatchingRights };
}

function computeOwnerStatistics(ownerEntry) {
  const prospectCount = (ownerEntry.prospects || []).length;
  const veteranCount = (ownerEntry.veterans || []).length;
  const farmCount = (ownerEntry.farmPlayers || []).length;
  const matchingRightsCount = (ownerEntry.matchingRights || []).length;

  const totalProspectCost = (ownerEntry.prospects || []).reduce((sum, p) => sum + (Number(p.cost) || 0), 0);
  const averageProspectCost = prospectCount ? totalProspectCost / prospectCount : 0;

  let highest = null;
  (ownerEntry.prospects || []).forEach((p) => {
    const c = Number(p.cost) || 0;
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
    agg.prospectCount += 1;
    if (p.farm) agg.farmCount += 1;
    if (p.matchingRights) agg.matchingRightsCount += 1;
    const c = Number(p.cost) || 0;
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

function renderDataQualityPanel(stateObj) {
  const md = stateObj.metadata || {};
  const datasets = ['prospects','veterans','roster','transactions'];
  const rows = datasets.map((d) => {
    const m = md[d] || { status: 'empty' };
    const status = m.status === 'ok' ? '✅' : '❌';
    const records = m.records != null ? `(${m.records})` : '';
    const when = m.importedAt ? `Imported: ${new Date(m.importedAt).toLocaleString()}` : '';
    return `<div class="dq-row">${status} <strong>${d.charAt(0).toUpperCase()+d.slice(1)}</strong> ${records} <div class="dq-meta">${when}</div></div>`;
  }).join('');

  const lastUpdated = (() => {
    const times = datasets.map(d => md[d]?.importedAt).filter(Boolean).map(t => new Date(t).getTime());
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
    if (plan.budgetShortfall > 0 || plan.remainingBudget < 0 || plan.hasOverfilledSkaters || plan.hasOverfilledGoalieTeams) {
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
  const compactMode = isCompactViewport();
  const assignedPlayers = report.assignedPlayers || [];
  const grouped = Object.entries(report.assignedByTeam || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const groupsHtml = grouped.length
    ? grouped.map(([team, entries]) => `
        <div class="detail-card">
          <h4>${escapeHtml(team)} (${entries.length})</h4>
          <ul class="player-list">
            ${entries.map((entry) => `
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
                    ${renderResponsiveActionButton({
                      label: compactMode ? 'Clear on laptop' : 'Clear',
                      className: 'secondary clear-assignment-btn',
                      attributes: `data-clear-player-key="${escapeHtml(entry.playerKey)}"`
                    })}
                  </div>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')
    : '<div class="empty-state">No Working State assignments yet.</div>';

  return `
    <section class="panel validation-panel">
      <div class="preview-header">
        <div>
          <h3>Draft Workspace</h3>
          <div class="panel-subtitle">Working State assignments grouped by team.</div>
        </div>
        <div class="preview-meta">
          <span class="meta-pill">Assigned Players ${assignedPlayers.length}</span>
          <span class="meta-pill">Available ${report.counts.availableCount}</span>
        </div>
      </div>
      <div class="detail-grid">
        ${groupsHtml}
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

  const teamInput = getByDataValue('data-workspace-team-key', playerKey);
  const bidInput = getByDataValue('data-workspace-bid-key', playerKey);
  const classificationInput = getByDataValue('data-workspace-classification-key', playerKey);
  const statusInput = getByDataValue('data-workspace-status-key', playerKey);

  const result = upsertWorkingAssignment(unifiedState, {
    playerKey,
    name: playerName,
    position: playerPosition,
    team: teamInput?.value || '',
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
  renderOwnerView(result.state);
}

function renderAvailablePlayerCenter(report) {
  const compactMode = isCompactViewport();
  const search = String(state.availablePlayerSearch || '').trim().toLowerCase();
  const assignmentMap = report.workingAssignments || {};
  const players = report.availablePlayers
    .filter((player) => !search || player.name.toLowerCase().includes(search) || player.position.toLowerCase().includes(search) || player.type.toLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));

  const officialPlayers = players.filter((player) => !player.manualOverride);
  const manualPlayers = players.filter((player) => player.manualOverride);

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
          <td><input type="text" class="workspace-team-input" data-workspace-team-key="${escapeHtml(player.key)}" placeholder="Team" value="${escapeHtml(assignmentMap[player.key]?.team || '')}" ${compactMode ? 'disabled aria-disabled="true"' : ''} /></td>
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
        </div>
      </div>
      <div style="margin:12px 0;">
        <input id="availablePlayerSearchInput" placeholder="Search available players..." value="${escapeHtml(state.availablePlayerSearch || '')}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--text);" />
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
            ${renderRows(officialPlayers)}
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
        ${renderResponsiveActionButton({
          label: compactMode ? 'Remove on laptop' : 'Remove',
          className: 'secondary remove-override-btn',
          attributes: `data-override-id="${escapeHtml(override.id)}"`
        })}
      </div>
      <div class="override-meta">
        <span class="meta-pill">${escapeHtml(override.position || '—')}</span>
        <span class="meta-pill">${escapeHtml(override.classification || '—')}</span>
        <span class="meta-pill">${escapeHtml(override.createdAt ? new Date(override.createdAt).toLocaleString() : '—')}</span>
      </div>
      <div class="override-notes">${escapeHtml(override.notes || 'No notes provided.')}</div>
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
              <span>Position</span>
              <input name="position" type="text" required />
            </label>
            <label>
              <span>Classification</span>
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

function renderPlayerBadges(player) {
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

  return badges.map((badge) => `<span class="player-chip">${escapeHtml(badge)}</span>`).join('');
}

function renderPlayerList(players, filter) {
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
                <div class="player-meta">${renderPlayerBadges(player)}</div>
              </div>
              <div class="player-chevron">›</div>
            </button>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function renderPlayerIntelligenceSection(player, rosterRecord, liveProfile) {
  if (!player) return '';

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
  const meta = ownerData.metadata || {};
  const statusHtml = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      <div class="meta-pill">Prospects ${meta.prospects?.status === 'ok' ? '✅' : '❌'}</div>
      <div class="meta-pill">Veterans ${meta.veterans?.status === 'ok' ? '✅' : '❌'}</div>
      <div class="meta-pill">Roster ${meta.roster?.status === 'ok' ? '✅' : '❌'}</div>
      <div class="meta-pill">Transactions ${meta.transactions?.status === 'ok' ? '✅' : '❌'}</div>
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
        ${renderPlayerList(selectedOwner.prospects, state.playerSearch)}
      </article>
      <article class="detail-card">
        <h3>Veterans</h3>
        ${renderPlayerList(selectedOwner.veterans, state.playerSearch)}
      </article>
      <article class="detail-card">
        <h3>Farm Players</h3>
        ${renderPlayerList(selectedOwner.farmPlayers, state.playerSearch)}
      </article>
      <article class="detail-card">
        <h3>Matching Rights</h3>
        ${renderPlayerList(selectedOwner.matchingRights, state.playerSearch)}
      </article>
      ${localAssignmentHtml}
    </div>
  `;

  const playerIntel = selectedPlayer ? renderPlayerIntelligenceSection(selectedPlayer, rosterMatch, liveProfile) : '';

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

  if (!ownerData.owners.length) {
    renderImportScreen();
    return;
  }

  if (!state.selectedOwner || !ownerData.owners.some((owner) => owner.name === state.selectedOwner)) {
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
  const draftStatusHtml = renderDraftStatusPanel(unifiedState, draftValidationReport);
  const ownerListMarkup = renderOwnerList(ownerData, draftValidationReport);
  const ownerDetailMarkup = renderOwnerDetails(ownerData, draftValidationReport);
  const rosterIndex = buildRosterIndex(unifiedState);
  const compactMode = isCompactViewport();

  // compute aggregates once
  const aggregates = computeOwnerAggregates(unifiedState);
  const leagueHtml = renderLeagueIntelligence(aggregates);
  const dataQualityHtml = renderDataQualityPanel(unifiedState);
  const validationCenterHtml = renderDraftValidationCenter(draftValidationReport);
  const bestAvailableHtml = renderBestAvailablePanel(draftValidationReport);
  const workspaceHtml = renderDraftWorkspacePanel(draftValidationReport);
  const availablePlayerHtml = renderAvailablePlayerCenter(draftValidationReport);
  const overrideAuditHtml = renderManualOverridePanel(draftValidationReport, unifiedState);
  const secondaryPanelsHtml = `
    <details class="panel secondary-sections"${compactMode ? '' : ' open'}>
      <summary>${compactMode ? 'More league/admin panels' : 'Additional league and admin panels'}</summary>
      <div class="secondary-sections-body">
        ${leagueHtml}
        ${dataQualityHtml}
        ${workspaceHtml}
        ${availablePlayerHtml}
        ${overrideAuditHtml}
      </div>
    </details>
  `;

  const app = document.getElementById('app');
  app.innerHTML = `
    ${summaryHtml}
    <div class="owner-layout">
      ${ownerListMarkup}
      <div>
        ${draftStatusHtml}
        ${validationCenterHtml}
        ${bestAvailableHtml}
        ${ownerDetailMarkup}
        ${secondaryPanelsHtml}
      </div>
    </div>
  `;

  updateTopbarActions(unifiedState);

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
        <p>Import prospects, veterans, roster, or transactions data to refresh the league state. Use the header buttons to import or export a saved dashboard state between devices.</p>
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
    app.innerHTML = `
      <section class="panel import-card">
        <h2>Unable to detect dataset type</h2>
        <p>The uploaded CSV does not match the expected prospect or veteran structure.</p>
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
  } else if (datasetType === 'roster') {
    parsedData = parseRoster(csvText);
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
    // render owner view with unified state
    renderOwnerView(next);
  });
}

function initialize() {
  const backToImportBtn = document.getElementById('backToImportBtn');
  backToImportBtn.addEventListener('click', () => {
    state.selectedOwner = null;
    state.selectedPlayerKey = null;
    renderImportScreen();
  });

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
  state.manualOverrides = Array.isArray(stored.manualOverrides) ? stored.manualOverrides : [];
  state.liveProfiles = state.liveCache?.players ? { ...state.liveCache.players } : {};
  state.selectedOwner = null;
  state.selectedPlayerKey = null;

  // if any dataset is present (status ok), show owner view
  if (hasLoadedData(stored)) {
    renderOwnerView(stored);
  } else {
    renderImportScreen();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initialize);
}

export {
  STORAGE_KEY,
  DRAFT_ROSTER_RULES,
  state,
  addManualOverrideEntry,
  removeManualOverrideById,
  buildDraftValidationReport,
  buildOwnerDraftPlan,
  createManualOverrideDraft,
  getSnapshotAgeInfo,
  getLiveCacheStatus,
  serializePortableStateBundle,
  parsePortableStateBundle,
};