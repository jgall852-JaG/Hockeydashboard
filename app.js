import { parseProspects } from './prospectParser.js';
import { parseVeterans } from './veteranParser.js';
import { parseRoster } from './rosterParser.js';
import {
  loadLiveCache,
  resolveLivePlayerProfile,
  normalizeLookupKey,
  pickRecordValue,
  extractTeamAbbrev,
} from './liveNhlApi.js';

const STORAGE_KEY = 'hockey-dashboard-owner-view';
const MAX_PREVIEW_ROWS = 10;

const state = {
  importedData: null,
  selectedOwner: null,
  previewRows: [],
  activeTab: 'league',
  ownerSearch: '',
  playerSearch: '',
  selectedPlayerKey: null,
  draftSelectedPlayerKey: null,
  draftSearch: '',
  draftPositionFilter: 'ALL',
  draftValueFilter: 'ALL',
  draftComparisonKey: null,
  draftQueue: loadDraftQueue(),
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

const DRAFT_QUEUE_STORAGE_KEY = 'hockey-dashboard-draft-queue';

function loadDraftQueue() {
  try {
    const raw = localStorage.getItem(DRAFT_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function persistDraftQueue(queue) {
  try {
    localStorage.setItem(DRAFT_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to persist draft queue', error);
  }
}

function getValueBand(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Low';
  if (numeric >= 220000) return 'Elite';
  if (numeric >= 110000) return 'High';
  if (numeric >= 50000) return 'Medium';
  return 'Low';
}

function getRiskBand(player) {
  const hasRights = Boolean(player.matchingRights);
  const term = Number(player.termRemaining || 0);
  const age = Number(player.age || 0);
  if (hasRights || term >= 3 || age <= 22) return 'Low Risk';
  if (term >= 1 || age <= 26) return 'Medium Risk';
  return 'High Risk';
}

function getDraftHubPlayers(unifiedState) {
  const rosterIndex = buildRosterIndex(unifiedState || {});
  const players = [];

  const addPlayersFromDataset = (dataset, sourceType) => {
    const items = Array.isArray(dataset) ? dataset : Object.values(dataset || {});
    items.forEach((player) => {
      if (!player || (!player.name && !player.fullName)) return;
      const record = { ...player };
      const rosterMatch = findRosterMatchForPlayer(record, rosterIndex);
      const value = Number(record.currentCost ?? record.cost ?? record.contractValue ?? record.value ?? 0) || 0;
      const poolPosition = String(record.poolPosition || record.position || rosterMatch?.position || '—').trim();
      const name = String(record.name || record.fullName || 'Unnamed Player').trim();
      players.push({
        ...record,
        name,
        sourceType,
        key: buildPlayerKey(record, sourceType),
        poolPosition: poolPosition || '—',
        nhlTeam: String(pickRecordValue(rosterMatch, ['nhlteam', 'team', 'currentteam', 'club']) || record.team || record.nhlTeam || '—').trim() || '—',
        value,
        valueBand: getValueBand(value),
        riskBand: getRiskBand(record),
        owner: record.owner || 'Available',
      });
    });
  };

  addPlayersFromDataset(unifiedState?.datasets?.prospects?.prospects, 'Prospect');
  addPlayersFromDataset(unifiedState?.datasets?.veterans?.veterans, 'Veteran');

  return players.sort((a, b) => {
    const valueDiff = (Number(b.value) || 0) - (Number(a.value) || 0);
    if (valueDiff !== 0) return valueDiff;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function draftHubPositionCounts(players) {
  const counts = { C: 0, LW: 0, RW: 0, D: 0, G: 0 };
  players.forEach((player) => {
    const pos = String(player.poolPosition || '').toUpperCase();
    if (pos.includes('C')) counts.C += 1;
    if (pos.includes('LW')) counts.LW += 1;
    if (pos.includes('RW')) counts.RW += 1;
    if (pos.includes('D')) counts.D += 1;
    if (pos.includes('G')) counts.G += 1;
  });
  return counts;
}

function buildDraftHubData(unifiedState) {
  const players = getDraftHubPlayers(unifiedState || {});
  const counts = draftHubPositionCounts(players);
  const queuePlayers = state.draftQueue
    .map((queueKey) => players.find((player) => player.key === queueKey))
    .filter(Boolean);

  const selectedPlayer = players.find((player) => player.key === state.draftSelectedPlayerKey)
    || players[0]
    || null;

  return {
    players,
    counts,
    queuePlayers,
    selectedPlayer,
  };
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

  const ownerSet = new Set();
  // derive owners from dataset owners maps if present
  if (stateObj.datasets.prospects?.owners) Object.keys(stateObj.datasets.prospects.owners).forEach((o) => ownerSet.add(o));
  if (stateObj.datasets.veterans?.owners) Object.keys(stateObj.datasets.veterans.owners).forEach((o) => ownerSet.add(o));

  // derive from player records as well
  prospectsArr.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });
  veteransArr.forEach((p) => { if (p && p.owner) ownerSet.add(p.owner); });

  const owners = [...ownerSet].sort((a, b) => a.localeCompare(b)).map((owner) => {
    const ownerProspects = prospectsArr.filter((p) => p.owner === owner);
    const ownerVeterans = veteransArr.filter((p) => p.owner === owner);
    const farmPlayers = ownerProspects.filter((p) => p.farm);
    const matchingRights = ownerProspects.filter((p) => p.matchingRights);

    return {
      name: owner,
      prospects: ownerProspects,
      veterans: ownerVeterans,
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
  version: 1,
  datasets: { prospects: null, veterans: null, roster: null, transactions: null },
  metadata: {
    prospects: { status: 'empty' },
    veterans: { status: 'empty' },
    roster: { status: 'empty' },
    transactions: { status: 'empty' },
  },
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && parsed.datasets) {
      // Already new shape
      return parsed;
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
    records: parsedData ? (datasetType === 'prospects' ? countParsedRecords(parsedData, 'prospects') : datasetType === 'veterans' ? countParsedRecords(parsedData, 'veterans') : 0) : 0,
  };
  next.version = 1;
  return next;
}

// ----------------------------
// Dashboard / Owner Statistics helpers
// ----------------------------

function computeDashboardSummary(stateObj) {
  const prospects = Object.values(stateObj.datasets.prospects?.prospects || {});
  const veterans = Object.values(stateObj.datasets.veterans?.veterans || {});
  const ownerSet = new Set();
  if (stateObj.datasets.prospects?.owners) Object.keys(stateObj.datasets.prospects.owners).forEach((o) => ownerSet.add(o));
  if (stateObj.datasets.veterans?.owners) Object.keys(stateObj.datasets.veterans.owners).forEach((o) => ownerSet.add(o));
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

  const snapshot = getSnapshotRefreshStatus(stateObj);

  return `
    <section class="panel data-quality">
      <h3>Data Quality</h3>
      <div style="margin-top:10px;">${rows}</div>
      <div style="margin-top:8px;color:var(--muted);font-size:0.9rem;">Snapshot: ${escapeHtml(snapshot.completenessLabel)} · Last updated: ${escapeHtml(snapshot.lastUpdatedLabel)}</div>
      <div style="margin-top:4px;color:var(--muted);font-size:0.9rem;">Latest source: ${escapeHtml(snapshot.latestSourceLabel)}</div>
    </section>
  `;
}

function getSnapshotRefreshStatus(stateObj) {
  const md = stateObj?.metadata || {};
  const datasets = ['prospects', 'veterans', 'roster', 'transactions'];
  const snapshots = datasets.map((dataset) => {
    const meta = md[dataset] || {};
    const importedAt = meta.importedAt || null;
    return {
      dataset,
      status: meta.status || 'empty',
      importedAt,
      sourceName: meta.sourceName || null,
      importedAtMs: importedAt ? new Date(importedAt).getTime() : null,
    };
  });

  const loaded = snapshots.filter((entry) => entry.status === 'ok' && entry.importedAtMs !== null && !Number.isNaN(entry.importedAtMs));
  const latest = loaded.reduce((best, entry) => {
    if (!best || entry.importedAtMs > best.importedAtMs) return entry;
    return best;
  }, null);

  return {
    datasetsLoaded: loaded.length,
    totalDatasets: datasets.length,
    completenessLabel: `${loaded.length}/${datasets.length} tabs loaded`,
    lastUpdatedIso: latest ? latest.importedAt : null,
    lastUpdatedLabel: latest ? new Date(latest.importedAtMs).toLocaleString() : 'Never',
    latestSourceLabel: latest?.sourceName || '—',
  };
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return String(value);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const DASHBOARD_TABS = [
  { key: 'league', label: 'League' },
  { key: 'teams', label: 'Teams' },
  { key: 'players', label: 'Players' },
  { key: 'draft', label: 'Draft Hub' },
];

function captureActiveInputState(inputId) {
  const activeElement = document.activeElement;
  if (!activeElement || activeElement.id !== inputId) return null;

  return {
    value: activeElement.value || '',
    selectionStart: activeElement.selectionStart ?? activeElement.value.length,
    selectionEnd: activeElement.selectionEnd ?? activeElement.value.length,
  };
}

function restoreActiveInputState(inputId, inputState) {
  if (!inputState) return;

  const input = document.getElementById(inputId);
  if (!input) return;

  input.focus();
  const selectionStart = Math.min(inputState.selectionStart, input.value.length);
  const selectionEnd = Math.min(inputState.selectionEnd, input.value.length);
  input.setSelectionRange(selectionStart, selectionEnd);
}

function renderDashboardFrame(activeTab, unifiedState, bodyHtml) {
  state.activeTab = activeTab;

  const dashboardHtml = `
    <div class="dashboard-shell">
      <nav class="dashboard-tabs panel" aria-label="Dashboard tabs">
        ${DASHBOARD_TABS.map((tab) => `
          <button
            class="dashboard-tab ${tab.key === activeTab ? 'active' : ''}"
            data-dashboard-tab="${tab.key}"
            type="button"
          >
            ${tab.label}
          </button>
        `).join('')}
      </nav>
      <div class="dashboard-content">
        ${bodyHtml}
      </div>
    </div>
  `;

  const app = document.getElementById('app');
  app.innerHTML = dashboardHtml;

  const backButton = document.getElementById('backToImportBtn');
  if (backButton) {
    backButton.classList.remove('hidden');
  }

  document.querySelectorAll('[data-dashboard-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextTab = button.dataset.dashboardTab;
      if (!nextTab || nextTab === state.activeTab) return;
      state.activeTab = nextTab;
      renderActiveDashboardView(unifiedState);
    });
  });
}

function renderPlaceholderTab(unifiedState, title, description) {
  const bodyHtml = `
    <section class="panel import-card">
      <div class="preview-header">
        <h2>${escapeHtml(title)}</h2>
        <span class="meta-pill">Phase 1 placeholder</span>
      </div>
      <p class="muted-copy">${escapeHtml(description)}</p>
    </section>
  `;

  renderDashboardFrame(title.toLowerCase(), unifiedState, bodyHtml);
}

function getLeaguePlayerDirectory(unifiedState) {
  const ownerData = buildOwnerViewData(unifiedState);
  const rosterIndex = buildRosterIndex(unifiedState || ownerData._rawState || {});
  const players = [];
  const seen = new Set();

  ownerData.owners.forEach((owner) => {
    [...(owner.prospects || []), ...(owner.veterans || [])].forEach((player) => {
      if (!player || !player.playerKey || seen.has(player.playerKey)) return;
      seen.add(player.playerKey);
      players.push(player);
    });
  });

  players.sort((a, b) => {
    const ownerDiff = String(a.owner || '').localeCompare(String(b.owner || ''));
    if (ownerDiff !== 0) return ownerDiff;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return { ownerData, rosterIndex, players };
}

function buildPlayerContextRows(player) {
  if (!player) return [];

  const rows = [
    ['Owner', player.owner || '—'],
    ['Source', player.sourceType || '—'],
    ['Contract Value', Number(player.currentCost ?? player.cost ?? 0) ? `$${formatValue(player.currentCost ?? player.cost ?? 0)}` : '—'],
    ['Term Remaining', player.termRemaining ?? '—'],
    ['Matching Rights', player.matchingRights ? 'Yes' : 'No'],
    ['Retention Status', player.sourceType === 'Veteran' ? `Retention year ${player.retentionYear ?? '—'}` : player.farm ? 'Farm' : 'Prospect'],
  ];

  return rows;
}

function renderLeagueView(unifiedState) {
  const summary = computeDashboardSummary(unifiedState);
  const ownerData = buildOwnerViewData(unifiedState);
  const aggregates = computeOwnerAggregates(unifiedState);
  const summaryCards = `
    <section class="panel summary-grid">
      <div class="summary-card"><div class="summary-value">${summary.totalOwners}</div><div class="summary-label">Total Owners</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalProspects}</div><div class="summary-label">Total Prospects</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalVeterans}</div><div class="summary-label">Total Veterans</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalFarmPlayers}</div><div class="summary-label">Total Farm Players</div></div>
      <div class="summary-card"><div class="summary-value">${summary.totalMatchingRights}</div><div class="summary-label">Total Matching Rights</div></div>
    </section>
  `;

  const coverageRows = [
    ['Prospects Loaded', ownerData.metadata?.prospects?.status === 'ok' ? 'Yes' : 'No'],
    ['Veterans Loaded', ownerData.metadata?.veterans?.status === 'ok' ? 'Yes' : 'No'],
    ['Roster Loaded', ownerData.metadata?.roster?.status === 'ok' ? 'Yes' : 'No'],
    ['Transactions Loaded', ownerData.metadata?.transactions?.status === 'ok' ? 'Yes' : 'No'],
  ];

  const bodyHtml = `
    ${summaryCards}
    <div class="league-layout">
      <section class="panel league-overview">
        <div class="preview-header">
          <h2>League Overview</h2>
          <span class="meta-pill">League-wide context</span>
        </div>
        <p class="muted-copy">Use this tab to orient yourself before moving into Teams, Players, or Draft Hub.</p>
        ${renderKeyValueList(coverageRows)}
      </section>
      ${renderLeagueIntelligence(aggregates)}
      ${renderDataQualityPanel(unifiedState)}
    </div>
  `;

  renderDashboardFrame('league', unifiedState, bodyHtml);
}

function computeTeamContext(ownerEntry) {
  const prospects = ownerEntry?.prospects || [];
  const veterans = ownerEntry?.veterans || [];
  const farmPlayers = ownerEntry?.farmPlayers || [];
  const matchingRights = ownerEntry?.matchingRights || [];

  const teamSpend = [
    ...prospects.map((player) => Number(player.cost) || 0),
    ...veterans.map((player) => Number(player.currentCost) || 0),
  ].reduce((sum, value) => sum + value, 0);

  const rosterCounts = { C: 0, LW: 0, RW: 0, D: 0, G: 0 };
  const allPlayers = [...prospects, ...veterans];

  allPlayers.forEach((player) => {
    const pos = String(player.poolPosition || '').toUpperCase();
    if (pos.includes('C')) rosterCounts.C += 1;
    if (pos.includes('LW')) rosterCounts.LW += 1;
    if (pos.includes('RW')) rosterCounts.RW += 1;
    if (pos.includes('D')) rosterCounts.D += 1;
    if (pos.includes('G')) rosterCounts.G += 1;
  });

  const termBuckets = { short: 0, medium: 0, long: 0 };
  prospects.forEach((player) => {
    if (player.farm) return;
    const term = Number(player.termRemaining);
    if (term <= 1) termBuckets.short += 1;
    else if (term === 2) termBuckets.medium += 1;
    else if (term >= 3) termBuckets.long += 1;
  });

  const retentionYears = veterans
    .map((player) => player.retentionYear)
    .filter((value) => value !== null && value !== undefined && value !== '');

  const keyContracts = [...allPlayers]
    .map((player) => ({
      name: player.name,
      owner: player.owner,
      amount: Number(player.currentCost ?? player.cost ?? 0) || 0,
      sourceType: player.sourceType,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const needs = [
    { label: 'Need RW', metric: rosterCounts.RW || 0, status: (rosterCounts.RW || 0) <= 2 ? 'High' : 'Medium' },
    { label: 'Need D', metric: rosterCounts.D || 0, status: (rosterCounts.D || 0) <= 2 ? 'High' : 'Medium' },
    { label: 'Need Prospect Depth', metric: prospects.length, status: prospects.length <= 4 ? 'High' : 'Monitor' },
    { label: 'Need Veteran Depth', metric: veterans.length, status: veterans.length === 0 ? 'High' : 'Available' },
  ];

  return {
    prospects,
    veterans,
    farmPlayers,
    matchingRights,
    teamSpend,
    moneyRemaining: null,
    rosterCounts,
    termBuckets,
    retentionYears,
    keyContracts,
    needs,
  };
}

function renderTeamsContextPanel(ownerEntry) {
  const stats = computeOwnerStatistics(ownerEntry);
  const context = computeTeamContext(ownerEntry);
  const moneyRemainingValue = 'Not tracked in source data';
  const retentionSummaryValue = `Prospect terms: ${context.termBuckets.short} short / ${context.termBuckets.medium} medium / ${context.termBuckets.long} long · Veteran retention years: ${context.retentionYears.length || 0}`;

  const summaryCards = `
    <section class="summary-grid">
      <div class="summary-card"><div class="summary-value">${stats.prospectCount}</div><div class="summary-label">Prospects</div></div>
      <div class="summary-card"><div class="summary-value">${stats.veteranCount}</div><div class="summary-label">Veterans</div></div>
      <div class="summary-card"><div class="summary-value">${stats.farmCount}</div><div class="summary-label">Farm</div></div>
      <div class="summary-card"><div class="summary-value">${stats.matchingRightsCount}</div><div class="summary-label">Matching Rights</div></div>
      <div class="summary-card"><div class="summary-value">$${formatValue(context.teamSpend)}</div><div class="summary-label">Team Spend</div></div>
      <div class="summary-card"><div class="summary-value">${moneyRemainingValue}</div><div class="summary-label">Money Remaining</div></div>
    </section>
  `;

  const budgetRows = [
    ['Team Spend', `$${formatValue(context.teamSpend)}`],
    ['Money Remaining', moneyRemainingValue],
    ['Retention Summary', retentionSummaryValue],
  ];

  const rosterRows = [
    ['Prospects', String(stats.prospectCount)],
    ['Veterans', String(stats.veteranCount)],
    ['Farm Players', String(stats.farmCount)],
    ['Matching Rights', String(stats.matchingRightsCount)],
  ];

  const keyContractRows = context.keyContracts.map((contract, index) => [
    `Key Contract ${index + 1}`,
    `${contract.name || '—'} (${contract.sourceType || 'player'}) $${formatValue(contract.amount)}`,
  ]);

  return `
    <section class="panel">
      <div class="preview-header">
        <h2>Team Context Center</h2>
        <span class="meta-pill">${escapeHtml(ownerEntry.name || 'Selected Team')}</span>
      </div>
      ${summaryCards}
      <div class="detail-grid" style="margin-top:18px;">
        <article class="detail-card">
          <h3>Budget Context</h3>
          ${renderKeyValueList(budgetRows)}
        </article>
        <article class="detail-card">
          <h3>Roster Counts</h3>
          ${renderKeyValueList(rosterRows)}
        </article>
        <article class="detail-card">
          <h3>Needs Summary</h3>
          ${renderDraftHubNeeds([...context.prospects, ...context.veterans])}
        </article>
        <article class="detail-card">
          <h3>Key Contracts</h3>
          ${renderKeyValueList(keyContractRows)}
        </article>
      </div>
    </section>
  `;
}

function renderPlayersView(unifiedState) {
  const directory = getLeaguePlayerDirectory(unifiedState);
  const players = directory.players || [];
  const searchState = captureActiveInputState('playerSearchInput');

  if (!state.selectedPlayerKey || !players.some((player) => player.playerKey === state.selectedPlayerKey)) {
    state.selectedPlayerKey = players.length ? players[0].playerKey : null;
  }

  const search = (state.playerSearch || '').trim().toLowerCase();
  const filteredPlayers = search
    ? players.filter((player) => (player.name || '').toLowerCase().includes(search))
    : players;

  const selectedPlayer = players.find((player) => player.playerKey === state.selectedPlayerKey) || filteredPlayers[0] || players[0] || null;
  const rosterMatch = selectedPlayer ? findRosterMatchForPlayer(selectedPlayer, directory.rosterIndex) : null;
  const liveProfile = selectedPlayer ? state.liveProfiles[selectedPlayer.playerKey] : null;

  if (selectedPlayer) {
    queuePlayerProfileHydration(unifiedState, selectedPlayer, rosterMatch);
  }

  const summaryCards = `
    <section class="panel draft-summary-grid">
      <div class="summary-card"><div class="summary-value">${players.length}</div><div class="summary-label">Players</div></div>
      <div class="summary-card"><div class="summary-value">${directory.ownerData.totalOwners}</div><div class="summary-label">Owners</div></div>
      <div class="summary-card"><div class="summary-value">${directory.ownerData.metadata?.prospects?.records || 0}</div><div class="summary-label">Prospects</div></div>
      <div class="summary-card"><div class="summary-value">${directory.ownerData.metadata?.veterans?.records || 0}</div><div class="summary-label">Veterans</div></div>
    </section>
  `;

  const bodyHtml = `
    ${summaryCards}
    <div class="player-layout owner-layout">
      <aside class="panel owner-list">
        <div class="preview-header">
          <h2>Players</h2>
          <span class="meta-pill">${players.length}</span>
        </div>
        <div style="margin:10px 0 12px;">
          <input id="playerSearchInput" placeholder="Search players..." value="${escapeHtml(state.playerSearch || '')}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--text);" />
        </div>
        <div class="muted-copy" style="margin-bottom:12px;">Search across prospects and veterans, then open one player for full league context.</div>
        ${renderPlayerList(filteredPlayers, state.playerSearch)}
      </aside>

      <section class="panel details-panel">
        <div class="details-header">
          <h2>${selectedPlayer ? escapeHtml(selectedPlayer.name || 'Selected Player') : 'No Player Selected'}</h2>
          <span class="meta-pill">${selectedPlayer ? escapeHtml(selectedPlayer.sourceType || 'player') : '—'}</span>
        </div>
        ${selectedPlayer ? `
          <div class="owner-summary panel">
            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
              ${renderPlayerBadges(selectedPlayer)}
            </div>
          </div>
          <div class="detail-grid" style="margin-bottom:18px;">
            <article class="detail-card">
              <h3>League Context</h3>
              ${renderKeyValueList(buildPlayerContextRows(selectedPlayer))}
            </article>
          </div>
          ${renderPlayerIntelligenceSection(selectedPlayer, rosterMatch, liveProfile)}
        ` : '<div class="empty-state">Select a player to view details.</div>'}
      </section>
    </div>
  `;

  renderDashboardFrame('players', unifiedState, bodyHtml);

  document.querySelectorAll('.player-item').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedPlayerKey = button.dataset.playerKey;
      renderPlayersView(unifiedState);
    });
  });

  const playerSearchInput = document.getElementById('playerSearchInput');
  if (playerSearchInput) {
    playerSearchInput.addEventListener('input', (event) => {
      state.playerSearch = event.target.value || '';
      renderPlayersView(unifiedState);
    });
  }

  restoreActiveInputState('playerSearchInput', searchState);
}

function renderTeamsView(unifiedState) {
  const ownerData = buildOwnerViewData(unifiedState);

  if (!ownerData.owners.length) {
    renderImportScreen();
    return;
  }

  if (!state.selectedOwner || !ownerData.owners.some((owner) => owner.name === state.selectedOwner)) {
    state.selectedOwner = ownerData.owners[0].name;
  }

  const ownerSearchState = captureActiveInputState('ownerSearchInput');
  const playerSearchState = captureActiveInputState('playerSearchInput');
  const selectedOwner = ownerData.owners.find((owner) => owner.name === state.selectedOwner) || ownerData.owners[0];
  const ownerListMarkup = renderOwnerList(ownerData);
  const ownerDetailMarkup = renderOwnerDetails(ownerData);
  const teamContextMarkup = selectedOwner ? renderTeamsContextPanel(selectedOwner) : '';

  const bodyHtml = `
    <div class="owner-layout">
      ${ownerListMarkup}
      <div class="teams-stack">
        ${teamContextMarkup}
        ${ownerDetailMarkup}
      </div>
    </div>
  `;

  renderDashboardFrame('teams', unifiedState, bodyHtml);

  const ownerItems = document.querySelectorAll('.owner-item');
  ownerItems.forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedOwner = button.dataset.owner;
      state.selectedPlayerKey = null;
      renderTeamsView(unifiedState);
    });
  });

  const playerItems = document.querySelectorAll('.player-item');
  playerItems.forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedPlayerKey = button.dataset.playerKey;
      renderTeamsView(unifiedState);
    });
  });

  const ownerSearchInput = document.getElementById('ownerSearchInput');
  if (ownerSearchInput) {
    ownerSearchInput.addEventListener('input', (event) => {
      state.ownerSearch = event.target.value || '';
      renderTeamsView(unifiedState);
    });
  }

  const playerSearchInput = document.getElementById('playerSearchInput');
  if (playerSearchInput) {
    playerSearchInput.addEventListener('input', (event) => {
      state.playerSearch = event.target.value || '';
      renderTeamsView(unifiedState);
    });
  }

  restoreActiveInputState('ownerSearchInput', ownerSearchState);
  restoreActiveInputState('playerSearchInput', playerSearchState);
}

function renderActiveDashboardView(unifiedState) {
  if (state.activeTab === 'teams') {
    renderTeamsView(unifiedState);
    return;
  }

  if (state.activeTab === 'players') {
    renderPlayersView(unifiedState);
    return;
  }

  if (state.activeTab === 'draft') {
    renderDraftHubView(unifiedState);
    return;
  }

  renderOwnerView(unifiedState);
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

function renderOwnerList(ownerData) {
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

function renderOwnerDetails(ownerData) {
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
  const ownerPlayers = [...(selectedOwner.prospects || []), ...(selectedOwner.veterans || [])];

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

function getNormalizedPosition(position) {
  const value = String(position || '').trim().toUpperCase();
  if (!value) return 'UNKNOWN';
  if (value.includes('LW')) return 'LW';
  if (value.includes('RW')) return 'RW';
  if (value.includes('C')) return 'C';
  if (value.includes('D')) return 'D';
  if (value.includes('G')) return 'G';
  return value;
}

function buildDecisionConfidence(player, comparisonPlayer, players) {
  if (!player) return { label: 'No pick', tone: 'neutral', summary: 'Select a player for decision support.' };

  const comparisonValue = Number(comparisonPlayer?.value || 0);
  const currentValue = Number(player.value || 0);
  const scarcityScore = (() => {
    const counts = draftHubPositionCounts(players || []);
    const pos = getNormalizedPosition(player.poolPosition);
    const remaining = counts[pos] || 0;
    if (remaining <= 2) return 2;
    if (remaining <= 4) return 1;
    return 0;
  })();

  let score = 0;
  if (player.valueBand === 'Elite') score += 3;
  if (player.valueBand === 'High') score += 2;
  if (player.valueBand === 'Medium') score += 1;
  if (player.riskBand === 'Low Risk') score += 2;
  if (player.riskBand === 'High Risk') score -= 2;
  if (player.matchingRights) score += 1;
  if (comparisonPlayer && currentValue >= comparisonValue) score += 1;
  if (scarcityScore >= 2) score += 2;

  if (score >= 7) {
    return { label: 'Strong Pick', tone: 'strong', summary: 'The value, fit, and scarcity support this selection.' };
  }
  if (score >= 4) {
    return { label: 'Good Pick', tone: 'good', summary: 'This is a reasonable decision with minor trade-offs.' };
  }
  if (score >= 1) {
    return { label: 'Reach', tone: 'reach', summary: 'The player is acceptable, but the timing or fit is less compelling.' };
  }
  return { label: 'High Risk Pick', tone: 'risk', summary: 'The value or roster fit is weak enough to warrant caution.' };
}

function buildFitSummary(player) {
  if (!player) return 'No fit analysis yet.';

  const pos = getNormalizedPosition(player.poolPosition);
  const value = Number(player.value || 0);
  const risk = player.riskBand || 'Medium Risk';
  let summary = `This ${pos} profile is`;

  if (value >= 110000) summary += ' high-value';
  else if (value >= 50000) summary += ' mid-tier';
  else summary += ' lower-priority';

  if (player.matchingRights) summary += ' and carries matching rights';
  if (risk.includes('Low')) summary += ', with a low-risk profile';
  else if (risk.includes('High')) summary += ', but the risk profile is elevated';

  summary += '.';
  return summary;
}

function buildScarcityShiftSummary(player, players) {
  if (!player) return 'No scarcity analysis yet.';

  const counts = draftHubPositionCounts(players || []);
  const pos = getNormalizedPosition(player.poolPosition);
  const remaining = counts[pos] || 0;

  if (remaining <= 2) {
    return `Waiting is risky: ${pos} is thinning quickly and the drop-off is likely steep.`;
  }
  if (remaining <= 4) {
    return `The ${pos} pool is tightening. Waiting may still be viable, but the next tier is getting thin.`;
  }
  return `The ${pos} position is still deep enough to justify waiting if roster needs are flexible.`;
}

function buildValueRationale(player) {
  if (!player) return 'Select a player to see the rationale behind the rating.';

  const reasons = [];
  const value = Number(player.value || 0);
  const pos = getNormalizedPosition(player.poolPosition);

  if (value >= 220000) reasons.push('elite valuation and clear top-end upside');
  else if (value >= 110000) reasons.push('strong current value and a premium draft profile');
  else if (value >= 50000) reasons.push('solid value relative to the current board');
  else reasons.push('value is still reasonable but less differentiated');

  if (player.matchingRights) reasons.push('matching rights improve the long-term case');
  if (pos === 'D' || pos === 'G' || pos === 'C') reasons.push(`${pos} scarcity supports the current rating`);
  if (player.age && Number(player.age) <= 23) reasons.push('younger age profile increases upside');
  if (player.riskBand === 'Low Risk') reasons.push('low-risk profile supports a more confident selection');

  return reasons.slice(0, 3).map((sentence) => sentence.charAt(0).toUpperCase() + sentence.slice(1)).join(' • ');
}

function buildComparisonSummary(player, comparisonPlayer) {
  if (!player || !comparisonPlayer || player.key === comparisonPlayer.key) {
    return 'Select a comparison target to assess the trade-off.';
  }

  const playerValue = Number(player.value || 0);
  const comparisonValue = Number(comparisonPlayer.value || 0);
  const playerPos = getNormalizedPosition(player.poolPosition);
  const comparisonPos = getNormalizedPosition(comparisonPlayer.poolPosition);

  if (playerValue > comparisonValue) {
    return `${player.name} has the stronger value edge, while ${comparisonPlayer.name} is more of a fit-based alternative.`;
  }
  if (playerValue < comparisonValue) {
    return `${comparisonPlayer.name} has the stronger value edge, but ${player.name} may fit the roster better at ${playerPos}.`;
  }
  if (playerPos === comparisonPos) {
    return `Both players are similar in value, so the selection should prioritize roster fit and timing.`;
  }
  return `${player.name} and ${comparisonPlayer.name} are close enough that fit and scarcity should decide the pick.`;
}

function formatCompactCost(player) {
  const cost = Number(player?.currentCost ?? player?.cost ?? player?.value ?? 0) || 0;
  return cost ? `$${formatValue(cost)}` : '—';
}

function formatCompactTerm(player) {
  const term = player?.termRemaining;
  if (term === null || term === undefined || term === '') return '—';
  return `${term}Y`;
}

function formatCompactRetention(player) {
  const sourceType = String(player?.sourceType || '').toLowerCase();
  if (sourceType === 'veteran') {
    return player?.retentionYear ? `Ret ${player.retentionYear}` : 'Retained';
  }
  if (player?.farm) return 'Farm';
  return 'Prospect';
}

function buildCompactLeagueContext(player) {
  if (!player) return [];

  return [
    { label: 'Owner', value: player.owner || 'Available' },
    { label: 'Cost', value: formatCompactCost(player) },
    { label: 'Term', value: formatCompactTerm(player) },
    { label: 'Rights', value: player.matchingRights ? 'Yes' : 'No' },
    { label: 'Ret', value: formatCompactRetention(player) },
  ];
}

function renderCompactLeagueContext(player, title) {
  const fields = buildCompactLeagueContext(player);
  if (!fields.length) return '<div class="empty-state">No context available.</div>';

  return `
    <div class="compact-context">
      ${title ? `<div class="compact-context-title">${escapeHtml(title)}</div>` : ''}
      <div class="compact-context-row">
        ${fields.map((field) => `
          <span class="context-pill" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}: ${escapeHtml(field.value)}</span>
        `).join('')}
      </div>
    </div>
  `;
}

function renderComparisonContext(player, comparisonPlayer) {
  if (!player || !comparisonPlayer) return '';

  return `
    <div class="comparison-context-grid">
      <div class="comparison-context-card">
        <div class="comparison-context-name">${escapeHtml(player.name || 'Selected Player')}</div>
        ${renderCompactLeagueContext(player)}
      </div>
      <div class="comparison-context-card">
        <div class="comparison-context-name">${escapeHtml(comparisonPlayer.name || 'Comparison Player')}</div>
        ${renderCompactLeagueContext(comparisonPlayer)}
      </div>
    </div>
  `;
}

function renderDraftHubDecisionStrip(player, comparisonPlayer, players) {
  if (!player) {
    return '<div class="empty-state">Select a player to view the decision summary.</div>';
  }

  const comparisonTarget = comparisonPlayer && comparisonPlayer.key !== player.key ? comparisonPlayer : null;
  const confidence = buildDecisionConfidence(player, comparisonTarget, players || []);
  const fitSummary = buildFitSummary(player);
  const comparisonSummary = buildComparisonSummary(player, comparisonTarget);

  return `
    <div class="detail-grid">
      <article class="detail-card">
        <h3>Comparison</h3>
        <p class="muted-copy">${escapeHtml(comparisonSummary)}</p>
        ${renderComparisonContext(player, comparisonTarget)}
      </article>
      <article class="detail-card">
        <h3>Team Fit</h3>
        <p class="muted-copy">${escapeHtml(fitSummary)}</p>
      </article>
      <article class="detail-card confidence-card">
        <h3>Confidence</h3>
        <div class="decision-badge ${confidence.tone}">${escapeHtml(confidence.label)}</div>
        <p class="muted-copy">${escapeHtml(confidence.summary)}</p>
      </article>
    </div>
  `;
}

function renderDraftHubQueue(queuePlayers, selectedKey) {
  if (!queuePlayers.length) {
    return '<div class="empty-state">Draft queue is empty.</div>';
  }

  return `
    <div class="queue-list">
      ${queuePlayers.map((player, index) => `
        <div class="queue-item ${selectedKey === player.key ? 'selected' : ''}">
          <div class="queue-main">
            <button class="queue-select" data-draft-player-key="${player.key}">${escapeHtml(player.name)}</button>
            <div class="queue-meta">${escapeHtml(player.poolPosition)} · ${escapeHtml(player.valueBand)} · ${escapeHtml(player.owner)}</div>
          </div>
          <div class="queue-actions">
            <button data-queue-action="up" data-queue-index="${index}" aria-label="Move up">↑</button>
            <button data-queue-action="down" data-queue-index="${index}" aria-label="Move down">↓</button>
            <button data-queue-action="remove" data-queue-index="${index}" aria-label="Remove">×</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDraftHubBoard(players, selectedKey) {
  const search = (state.draftSearch || '').trim().toLowerCase();
  const posFilter = state.draftPositionFilter || 'ALL';
  const valueFilter = state.draftValueFilter || 'ALL';

  const filtered = players.filter((player) => {
    const matchesSearch = !search || (player.name || '').toLowerCase().includes(search);
    const matchesPosition = posFilter === 'ALL' || String(player.poolPosition || '').toUpperCase() === posFilter;
    const matchesValue = valueFilter === 'ALL' || player.valueBand === valueFilter;
    return matchesSearch && matchesPosition && matchesValue;
  });

  if (!filtered.length) {
    return '<div class="empty-state">No players match the current filters.</div>';
  }

  return `
    <div class="board-table-wrap">
      <table class="draft-board-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th>Team</th>
            <th>Value</th>
            <th>Risk</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.slice(0, 25).map((player) => `
            <tr class="${selectedKey === player.key ? 'selected-row' : ''}">
              <td>
                <div class="board-player-cell">
                  <button class="board-player-name" data-draft-player-key="${player.key}">${escapeHtml(player.name)}</button>
                  ${renderCompactLeagueContext(player)}
                </div>
              </td>
              <td>${escapeHtml(player.poolPosition || '—')}</td>
              <td>${escapeHtml(player.nhlTeam || '—')}</td>
              <td>${escapeHtml(player.valueBand || 'Low')}</td>
              <td>${escapeHtml(player.riskBand || 'Medium Risk')}</td>
              <td>
                <div class="board-action-stack">
                  <button class="secondary add-queue-btn" data-add-to-queue="${player.key}">${state.draftQueue.includes(player.key) ? 'Queued' : 'Add to Queue'}</button>
                  <button class="secondary compare-btn" data-compare-player-key="${player.key}">Compare</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDraftHubScarcity(counts) {
  const labels = ['C', 'LW', 'RW', 'D', 'G'];
  const max = Math.max(...Object.values(counts), 1);

  return `
    <div class="scarcity-list">
      ${labels.map((label) => {
        const count = counts[label] || 0;
        const width = Math.max(12, (count / max) * 100);
        const tone = count <= 2 ? 'scarcity-high' : count <= 4 ? 'scarcity-medium' : 'scarcity-low';
        return `
          <div class="scarcity-row">
            <div class="scarcity-label-row">
              <strong>${label}</strong>
              <span>${count} left</span>
            </div>
            <div class="scarcity-bar ${tone}">
              <span style="width:${width}%"></span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderDraftHubNeeds(players) {
  const counts = draftHubPositionCounts(players);
  const needs = [
    { label: 'Need Center', metric: counts.C || 0, status: (counts.C || 0) <= 2 ? 'High' : 'Medium' },
    { label: 'Need RW', metric: counts.RW || 0, status: (counts.RW || 0) <= 2 ? 'High' : 'Medium' },
    { label: 'Need Defense', metric: counts.D || 0, status: (counts.D || 0) <= 2 ? 'High' : 'Medium' },
    { label: 'Need Prospect Depth', metric: players.filter((p) => p.sourceType === 'Prospect').length, status: 'Monitor' },
    { label: 'Need Cheap Assets', metric: players.filter((p) => Number(p.value || 0) <= 50000).length, status: 'Available' },
    { label: 'Need Immediate Production', metric: players.filter((p) => p.sourceType === 'Veteran').length, status: 'Available' },
  ];

  return `
    <div class="need-grid">
      ${needs.map((need) => `
        <div class="need-pill ${need.status === 'High' ? 'need-high' : need.status === 'Medium' ? 'need-medium' : 'need-low'}">
          <div class="need-label">${escapeHtml(need.label)}</div>
          <div class="need-strength">${escapeHtml(String(need.status))}</div>
          <div class="need-metric">${escapeHtml(String(need.metric))}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDraftHubView(unifiedState) {
  const activeSearchState = (() => {
    const activeElement = document.activeElement;
    if (!activeElement || activeElement.id !== 'draftSearchInput') return null;
    return {
      value: activeElement.value || '',
      selectionStart: activeElement.selectionStart ?? activeElement.value.length,
      selectionEnd: activeElement.selectionEnd ?? activeElement.value.length,
    };
  })();

  const draftHubData = buildDraftHubData(unifiedState);
  const players = draftHubData.players || [];
  const selectedPlayer = draftHubData.selectedPlayer;

  if (!state.draftSelectedPlayerKey && selectedPlayer) {
    state.draftSelectedPlayerKey = selectedPlayer.key;
  }

  if (!state.draftComparisonKey || !players.some((player) => player.key === state.draftComparisonKey) || state.draftComparisonKey === state.draftSelectedPlayerKey) {
    const alternative = players.find((player) => player.key !== state.draftSelectedPlayerKey) || selectedPlayer;
    state.draftComparisonKey = alternative ? alternative.key : null;
  }

  const comparisonPlayer = players.find((player) => player.key === state.draftComparisonKey) || null;

  const filteredPlayers = players.filter((player) => {
    const search = (state.draftSearch || '').trim().toLowerCase();
    const matchesSearch = !search || (player.name || '').toLowerCase().includes(search);
    const matchesPosition = state.draftPositionFilter === 'ALL' || String(player.poolPosition || '').toUpperCase() === state.draftPositionFilter;
    const matchesValue = state.draftValueFilter === 'ALL' || player.valueBand === state.draftValueFilter;
    return matchesSearch && matchesPosition && matchesValue;
  });

  const bestAvailable = filteredPlayers.slice(0, 6);
  const boardHtml = renderDraftHubBoard(players, state.draftSelectedPlayerKey);
  const queueHtml = renderDraftHubQueue(draftHubData.queuePlayers, state.draftSelectedPlayerKey);
  const scarcityHtml = renderDraftHubScarcity(draftHubData.counts);
  const decisionStripHtml = renderDraftHubDecisionStrip(selectedPlayer, comparisonPlayer, players);

  const bodyHtml = `
    <div class="draft-grid">
      <div class="draft-column-main">
        <section class="panel draft-module">
          <div class="preview-header">
            <h2>Best Available</h2>
            <span class="meta-pill">Top signals</span>
          </div>
          <div class="best-available-list">
            ${bestAvailable.map((player) => `
              <div class="best-player-card ${state.draftSelectedPlayerKey === player.key ? 'selected' : ''}">
                <button class="best-player-button" data-draft-player-key="${player.key}">
                  <div class="best-player-meta">
                    <strong>${escapeHtml(player.name)}</strong>
                    <span>${escapeHtml(player.poolPosition || '—')} · ${escapeHtml(player.nhlTeam || '—')}</span>
                  </div>
                  <div class="best-player-stack">
                    <div class="best-player-stats">
                      <span>${escapeHtml(player.valueBand || 'Low')}</span>
                      <span>${escapeHtml(player.riskBand || 'Medium Risk')}</span>
                    </div>
                    ${renderCompactLeagueContext(player)}
                  </div>
                </button>
                <button class="secondary compare-mini" data-compare-player-key="${player.key}">Compare</button>
              </div>
            `).join('')}
          </div>
        </section>

        <section class="panel draft-module">
          <div class="preview-header">
            <h2>Draft Board</h2>
            <div class="board-controls">
              <input id="draftSearchInput" placeholder="Search player..." value="${escapeHtml(state.draftSearch || '')}" />
              <select id="draftPositionFilter">
                <option value="ALL" ${state.draftPositionFilter === 'ALL' ? 'selected' : ''}>All positions</option>
                <option value="C" ${state.draftPositionFilter === 'C' ? 'selected' : ''}>C</option>
                <option value="LW" ${state.draftPositionFilter === 'LW' ? 'selected' : ''}>LW</option>
                <option value="RW" ${state.draftPositionFilter === 'RW' ? 'selected' : ''}>RW</option>
                <option value="D" ${state.draftPositionFilter === 'D' ? 'selected' : ''}>D</option>
                <option value="G" ${state.draftPositionFilter === 'G' ? 'selected' : ''}>G</option>
              </select>
              <select id="draftValueFilter">
                <option value="ALL" ${state.draftValueFilter === 'ALL' ? 'selected' : ''}>All values</option>
                <option value="Elite" ${state.draftValueFilter === 'Elite' ? 'selected' : ''}>Elite</option>
                <option value="High" ${state.draftValueFilter === 'High' ? 'selected' : ''}>High</option>
                <option value="Medium" ${state.draftValueFilter === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Low" ${state.draftValueFilter === 'Low' ? 'selected' : ''}>Low</option>
              </select>
            </div>
          </div>
          ${boardHtml}
        </section>
      </div>

      <aside class="draft-column-side">
        <section class="panel draft-module">
          <div class="preview-header">
            <h2>Draft Queue</h2>
            <span class="meta-pill">${draftHubData.queuePlayers.length} tracked</span>
          </div>
          ${queueHtml}
        </section>

        <section class="panel draft-module">
          <div class="preview-header">
            <h2>Position Scarcity</h2>
          </div>
          ${scarcityHtml}
        </section>
      </aside>
    </div>

    <section class="panel draft-module">
      <div class="preview-header">
        <h2>Decision Summary</h2>
        <span class="meta-pill">${selectedPlayer ? escapeHtml(selectedPlayer.name) : 'No player selected'}${comparisonPlayer && comparisonPlayer.key !== selectedPlayer?.key ? ` vs ${escapeHtml(comparisonPlayer.name)}` : ''}</span>
      </div>
      ${decisionStripHtml}
    </section>
  `;

  renderDashboardFrame('draft', unifiedState, bodyHtml);

  document.getElementById('backToImportBtn').classList.remove('hidden');

  const searchInputAfterRender = document.getElementById('draftSearchInput');
  if (searchInputAfterRender && activeSearchState) {
    searchInputAfterRender.focus();
    const selectionStart = Math.min(activeSearchState.selectionStart, searchInputAfterRender.value.length);
    const selectionEnd = Math.min(activeSearchState.selectionEnd, searchInputAfterRender.value.length);
    searchInputAfterRender.setSelectionRange(selectionStart, selectionEnd);
  }

  document.querySelectorAll('[data-draft-player-key]').forEach((button) => {
    button.addEventListener('click', () => {
      state.draftSelectedPlayerKey = button.dataset.draftPlayerKey;
      renderDraftHubView(unifiedState);
    });
  });

  document.querySelectorAll('[data-compare-player-key]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const nextKey = button.dataset.comparePlayerKey;
      if (!nextKey) return;
      state.draftComparisonKey = nextKey;
      renderDraftHubView(unifiedState);
    });
  });

  document.querySelectorAll('[data-add-to-queue]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const key = button.dataset.addToQueue;
      if (!state.draftQueue.includes(key)) {
        state.draftQueue.push(key);
        persistDraftQueue(state.draftQueue);
      }
      renderDraftHubView(unifiedState);
    });
  });

  document.querySelectorAll('[data-queue-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const action = button.dataset.queueAction;
      const index = Number(button.dataset.queueIndex);
      if (Number.isNaN(index)) return;

      if (action === 'remove') {
        state.draftQueue.splice(index, 1);
      }

      if (action === 'up' && index > 0) {
        const [item] = state.draftQueue.splice(index, 1);
        state.draftQueue.splice(index - 1, 0, item);
      }

      if (action === 'down' && index < state.draftQueue.length - 1) {
        const [item] = state.draftQueue.splice(index, 1);
        state.draftQueue.splice(index + 1, 0, item);
      }

      persistDraftQueue(state.draftQueue);
      renderDraftHubView(unifiedState);
    });
  });

  const searchInput = document.getElementById('draftSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.draftSearch = event.target.value || '';
      renderDraftHubView(unifiedState);
    });
  }

  const positionFilter = document.getElementById('draftPositionFilter');
  if (positionFilter) {
    positionFilter.addEventListener('change', (event) => {
      state.draftPositionFilter = event.target.value || 'ALL';
      renderDraftHubView(unifiedState);
    });
  }

  const valueFilter = document.getElementById('draftValueFilter');
  if (valueFilter) {
    valueFilter.addEventListener('change', (event) => {
      state.draftValueFilter = event.target.value || 'ALL';
      renderDraftHubView(unifiedState);
    });
  }
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

  const ownerSearchState = captureActiveInputState('ownerSearchInput');
  const playerSearchState = captureActiveInputState('playerSearchInput');
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

  const ownerListMarkup = renderOwnerList(ownerData);
  const ownerDetailMarkup = renderOwnerDetails(ownerData);
  const rosterIndex = buildRosterIndex(unifiedState);

  // compute aggregates once
  const aggregates = computeOwnerAggregates(unifiedState);
  const leagueHtml = renderLeagueIntelligence(aggregates);
  const dataQualityHtml = renderDataQualityPanel(unifiedState);

  const bodyHtml = `
    ${summaryHtml}
    <div class="owner-layout">
      ${ownerListMarkup}
      <div>
        ${leagueHtml}
        ${dataQualityHtml}
        ${ownerDetailMarkup}
      </div>
    </div>
  `;

  renderDashboardFrame('league', unifiedState, bodyHtml);

  document.getElementById('backToImportBtn').classList.remove('hidden');

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

  const selectedOwner = ownerData.owners.find((owner) => owner.name === state.selectedOwner) || ownerData.owners[0];
  const selectedPlayer = selectedOwner
    ? [...(selectedOwner.prospects || []), ...(selectedOwner.veterans || [])].find((player) => player.playerKey === state.selectedPlayerKey) || null
    : null;

  if (selectedPlayer) {
    const rosterMatch = findRosterMatchForPlayer(selectedPlayer, rosterIndex);
    queuePlayerProfileHydration(unifiedState, selectedPlayer, rosterMatch);
  }

  restoreActiveInputState('ownerSearchInput', ownerSearchState);
  restoreActiveInputState('playerSearchInput', playerSearchState);

  restoreActiveInputState('ownerSearchInput', ownerSearchState);
  restoreActiveInputState('playerSearchInput', playerSearchState);
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
      renderActiveDashboardView(unifiedState);
    }
  }
}

function renderImportScreen() {
  const bodyHtml = `
    <section class="panel import-card">
      <div class="preview-header">
        <h2>Refresh Snapshot</h2>
        <span class="meta-pill">Sheet export</span>
      </div>
      <div class="dropzone">
        <strong>Upload the latest Google Sheet CSV snapshot</strong>
        <p>Use the current league export to refresh the dashboard before the next decision window.</p>
        <div class="file-input-wrap">
          <input id="csvFileInput" type="file" accept=".csv,text/csv" />
          <span class="file-placeholder">Choose Snapshot CSV</span>
        </div>
      </div>
    </section>
  `;

  renderDashboardFrame('league', loadState(), bodyHtml);

  const backButton = document.getElementById('backToImportBtn');
  if (backButton) {
    backButton.classList.add('hidden');
  }

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
    const bodyHtml = `
      <section class="panel import-card">
        <h2>Unable to detect dataset type</h2>
        <p>The uploaded CSV does not match the expected prospect or veteran structure.</p>
        <button class="primary" id="retryImportBtn">Try Another File</button>
      </section>
    `;
    renderDashboardFrame('league', loadState(), bodyHtml);
    const backButton = document.getElementById('backToImportBtn');
    if (backButton) {
      backButton.classList.add('hidden');
    }

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
    const bodyHtml = `
      <section class="panel import-card">
        <h2>Import Failed</h2>
        <p>The file was uploaded but could not be parsed.</p>
        <button class="primary" id="retryImportBtn">Try Another File</button>
      </section>
    `;
    renderDashboardFrame('league', loadState(), bodyHtml);
    const backButton = document.getElementById('backToImportBtn');
    if (backButton) {
      backButton.classList.add('hidden');
    }

    document.getElementById('retryImportBtn').addEventListener('click', renderImportScreen);
    return;
  }

  state.previewRows = getVisiblePreviewRows(parsedData);
  renderDashboardFrame('league', loadState(), renderPreviewSection(parsedData, datasetType));
  const backButton = document.getElementById('backToImportBtn');
  if (backButton) {
    backButton.classList.add('hidden');
  }

  document.getElementById('cancelImportBtn').addEventListener('click', renderImportScreen);
  document.getElementById('confirmImportBtn').addEventListener('click', () => {
    // Merge parsed dataset into the unified persisted state
    const current = loadState();
    const next = mergeDataset(current, datasetType, parsedData, fileName);
    persistState(next);

    state.importedData = next;
    state.activeTab = 'league';
    renderActiveDashboardView(next);
  });
}

function initialize() {
  const backToImportBtn = document.getElementById('backToImportBtn');
  backToImportBtn.addEventListener('click', () => {
    state.selectedOwner = null;
    state.selectedPlayerKey = null;
    state.draftSelectedPlayerKey = null;
    state.draftSearch = '';
    state.draftPositionFilter = 'ALL';
    state.draftValueFilter = 'ALL';
    state.activeTab = 'league';
    renderImportScreen();
  });

  const stored = loadState();
  state.importedData = stored;
  state.liveProfiles = state.liveCache?.players ? { ...state.liveCache.players } : {};
  state.selectedOwner = null;
  state.selectedPlayerKey = null;
  state.draftSelectedPlayerKey = null;
  state.draftSearch = '';
  state.draftPositionFilter = 'ALL';
  state.draftValueFilter = 'ALL';
  state.activeTab = 'league';

  const anyLoaded = ['prospects','veterans','roster','transactions'].some(k => stored?.metadata?.[k]?.status === 'ok');
  if (anyLoaded) {
    renderActiveDashboardView(stored);
  } else {
    renderImportScreen();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initialize);
}

export { STORAGE_KEY, state, buildDraftHubData, getDraftHubPlayers, buildCompactLeagueContext, renderCompactLeagueContext };
export { getSnapshotRefreshStatus };