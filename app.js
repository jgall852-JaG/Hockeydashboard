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
  ownerSearch: '',
  playerSearch: '',
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

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/[^0-9.\-]/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeSignal({ name, impact, note }) {
  return `${name}: ${impact}${note ? ` (${note})` : ''}`;
}

function summarizeSignals(signals) {
  if (!signals.length) return 'None';
  return signals.map((signal) => summarizeSignal(signal)).join(' | ');
}

function pickSignalWeight(impact) {
  if (impact === 'High' || impact === 'Positive') return 3;
  if (impact === 'Medium') return 2;
  if (impact === 'Neutral') return 1;
  if (impact === 'Limited') return -1;
  if (impact === 'Negative') return -2;
  return 0;
}

function classifyProductionSignal(player, rosterRecord, liveProfile) {
  const currentPoints = toNumberOrNull(liveProfile?.currentSeason?.points ?? pickRecordValue(rosterRecord, ['points', 'pts']));
  const currentGames = toNumberOrNull(liveProfile?.currentSeason?.gamesPlayed ?? pickRecordValue(rosterRecord, ['gamesplayed', 'gp']));
  const careerPoints = toNumberOrNull(liveProfile?.historical?.points);

  const isProspect = player?.sourceType === 'prospect';
  const highBar = isProspect ? 40 : 70;
  const mediumBar = isProspect ? 18 : 35;

  if (currentPoints !== null && currentPoints >= highBar) {
    return { impact: 'High', note: `${currentPoints} current-season points` };
  }
  if (currentPoints !== null && currentPoints >= mediumBar) {
    return { impact: 'Medium', note: `${currentPoints} current-season points` };
  }
  if (careerPoints !== null && careerPoints >= highBar * 3) {
    return { impact: 'Medium', note: `${careerPoints} career points` };
  }
  if (currentPoints !== null || careerPoints !== null || currentGames !== null) {
    return { impact: 'Limited', note: 'Measurable production present, below impact threshold' };
  }
  return { impact: 'Unknown', note: 'Insufficient production data' };
}

function classifyOpportunitySignal(player, rosterRecord, liveProfile) {
  const rosterStatus = String(
    liveProfile?.identity?.rosterStatus || pickRecordValue(rosterRecord, ['rosterstatus', 'status']) || ''
  ).toLowerCase();
  const gamesRemaining = toNumberOrNull(liveProfile?.schedule?.gamesRemaining);
  const active = rosterStatus.includes('active');

  if (active && gamesRemaining !== null && gamesRemaining >= 25) {
    return { impact: 'High', note: `Active roster status with ${gamesRemaining} games remaining` };
  }
  if (active) {
    return { impact: 'Medium', note: 'Active roster status' };
  }
  if (rosterStatus) {
    return { impact: 'Limited', note: `Roster status: ${rosterStatus}` };
  }
  if (gamesRemaining !== null && gamesRemaining >= 25) {
    return { impact: 'Medium', note: `${gamesRemaining} games remaining` };
  }
  return { impact: 'Unknown', note: 'Opportunity context incomplete' };
}

function classifyAgeSignal(player) {
  const draftYear = toNumberOrNull(player?.draftYear);
  if (draftYear === null) {
    return { impact: 'Unknown', note: 'Draft-year age proxy unavailable' };
  }
  const currentYear = new Date().getFullYear();
  const yearsSinceDraft = currentYear - draftYear;

  if (yearsSinceDraft <= 3) {
    return { impact: 'High', note: `${yearsSinceDraft} years since draft` };
  }
  if (yearsSinceDraft <= 6) {
    return { impact: 'Medium', note: `${yearsSinceDraft} years since draft` };
  }
  return { impact: 'Limited', note: `${yearsSinceDraft} years since draft` };
}

function classifyDraftPedigreeSignal(player) {
  const draftYear = toNumberOrNull(player?.draftYear);
  if (draftYear === null) {
    return { impact: 'Unknown', note: 'No draft-year pedigree signal available' };
  }
  const currentYear = new Date().getFullYear();
  const yearsSinceDraft = currentYear - draftYear;
  if (yearsSinceDraft <= 2) {
    return { impact: 'High', note: `Recent draft class (${draftYear})` };
  }
  if (yearsSinceDraft <= 5) {
    return { impact: 'Medium', note: `Established pedigree window (${draftYear})` };
  }
  return { impact: 'Limited', note: `Older draft class (${draftYear})` };
}

function classifyHistoricalTrendSignal(liveProfile) {
  const careerPoints = toNumberOrNull(liveProfile?.historical?.points);
  const currentPoints = toNumberOrNull(liveProfile?.currentSeason?.points);
  if (careerPoints !== null && currentPoints !== null) {
    if (careerPoints >= 250 && currentPoints >= 35) {
      return { impact: 'High', note: `Career ${careerPoints} pts and current ${currentPoints} pts` };
    }
    if (careerPoints >= 80 || currentPoints >= 18) {
      return { impact: 'Medium', note: `Career ${careerPoints ?? '—'} pts, current ${currentPoints ?? '—'} pts` };
    }
    return { impact: 'Limited', note: 'Historical totals present but modest' };
  }
  if (careerPoints !== null || currentPoints !== null) {
    return { impact: 'Limited', note: 'Partial production history available' };
  }
  return { impact: 'Unknown', note: 'Historical production trend unavailable' };
}

function classifyScarcitySignal(player, rosterRecord) {
  const poolPosition = String(player?.poolPosition || pickRecordValue(rosterRecord, ['position', 'poolposition']) || '').toUpperCase();
  const scarcityMap = {
    G: { impact: 'High', note: 'Goalie scarcity premium' },
    C: { impact: 'Medium', note: 'Center scarcity support' },
    D: { impact: 'Medium', note: 'Defense scarcity support' },
    LW: { impact: 'Limited', note: 'Wing depth usually deeper' },
    RW: { impact: 'Limited', note: 'Wing depth usually deeper' },
    F: { impact: 'Limited', note: 'Flexible forward slot' },
    LD: { impact: 'Medium', note: 'Defense scarcity support' },
    RD: { impact: 'Medium', note: 'Defense scarcity support' },
  };

  if (scarcityMap[poolPosition]) {
    return scarcityMap[poolPosition];
  }
  return { impact: 'Unknown', note: 'Pool position unavailable' };
}

function classifyCostModifier(player) {
  const cost = toNumberOrNull(player?.sourceType === 'veteran' ? player?.currentCost : player?.cost);
  if (cost === null) {
    return { impact: 'Neutral', note: 'Cost data unavailable' };
  }
  if (cost <= 3) {
    return { impact: 'Positive', note: `Low cost (${cost})` };
  }
  if (cost <= 10) {
    return { impact: 'Neutral', note: `Moderate cost (${cost})` };
  }
  return { impact: 'Negative', note: `High cost (${cost})` };
}

function classifyTermModifier(player) {
  const term = toNumberOrNull(player?.termRemaining);
  if (term === null) {
    return { impact: 'Neutral', note: 'No term signal for this asset' };
  }
  if (term >= 3) {
    return { impact: 'Positive', note: `${term} years of control` };
  }
  if (term >= 1) {
    return { impact: 'Neutral', note: `${term} years of control` };
  }
  return { impact: 'Negative', note: 'No remaining term' };
}

function classifyRetentionModifier(player) {
  const retentionCost = toNumberOrNull(player?.retentionHistory?.length
    ? player.retentionHistory[player.retentionHistory.length - 1]?.cost
    : null);
  if (retentionCost === null) {
    return { impact: 'Neutral', note: 'Retention data unavailable' };
  }
  if (retentionCost <= 3) {
    return { impact: 'Positive', note: `Latest retained cost ${retentionCost}` };
  }
  if (retentionCost <= 10) {
    return { impact: 'Neutral', note: `Latest retained cost ${retentionCost}` };
  }
  return { impact: 'Negative', note: `Latest retained cost ${retentionCost}` };
}

function classifyRightsModifier(player) {
  if (player?.matchingRights) {
    return { impact: 'Positive', note: 'Matching rights available' };
  }
  return { impact: 'Neutral', note: 'No matching rights' };
}

function classifyProspectValueBand(primary, secondary, modifiers) {
  const upsideHigh = primary.upside.impact === 'High';
  const ageStrong = primary.age.impact === 'High' || primary.age.impact === 'Medium';
  const pedigreeStrong = primary.draftPedigree.impact === 'High' || primary.draftPedigree.impact === 'Medium';
  const opportunityStrong = secondary.opportunity.impact === 'High' || secondary.opportunity.impact === 'Medium';
  const productionStrong = secondary.historicalTrend.impact === 'High' || secondary.historicalTrend.impact === 'Medium';

  if (upsideHigh && ageStrong && pedigreeStrong && opportunityStrong) return 'Elite Prospect';
  if ((upsideHigh && (ageStrong || productionStrong)) || (opportunityStrong && pedigreeStrong)) return 'Strong Prospect';
  if (upsideHigh || ageStrong || productionStrong || opportunityStrong) return 'Developing Prospect';
  if (modifiers.rights.impact === 'Positive') return 'Developing Prospect';
  return 'Speculative Prospect';
}

function classifyVeteranValueBand(primary, secondary) {
  const production = primary.production.impact;
  const opportunity = primary.opportunity.impact;
  if (production === 'High' && (opportunity === 'High' || opportunity === 'Medium')) return 'Elite Veteran';
  if (production === 'High' || (production === 'Medium' && opportunity === 'High')) return 'Core Asset';
  if (production === 'Medium') return 'Quality Asset';
  if (opportunity === 'Medium' || secondary.scarcity.impact === 'High') return 'Roster Asset';
  return 'Depth Asset';
}

function classifyContractValueBand(primary, secondary, modifiers) {
  const cost = primary.costEfficiency.impact;
  const term = secondary.termControl.impact;
  const retention = secondary.retention.impact;
  const rights = modifiers.matchingRights.impact;

  if (cost === 'Positive' && (term === 'Positive' || retention === 'Positive' || rights === 'Positive')) return 'Excellent Contract';
  if (cost === 'Positive' || (cost === 'Neutral' && (term === 'Positive' || retention === 'Positive' || rights === 'Positive'))) return 'Good Contract';
  if (cost === 'Negative' && term !== 'Positive' && retention !== 'Positive') return 'Poor Contract';
  return 'Fair Contract';
}

function classifyRightsValueBand(primary, secondary) {
  if (primary.rightsPresence.impact === 'Positive' && secondary.assetLinkage.impact === 'High') {
    return 'Strong Rights Asset';
  }
  if (primary.rightsPresence.impact === 'Positive') return 'Moderate Rights Asset';
  return 'Limited Rights Asset';
}

function classifyRiskBand(signalGroups) {
  let positives = 0;
  let negatives = 0;
  signalGroups.forEach((signals) => {
    (signals || []).forEach((signal) => {
      const weight = pickSignalWeight(signal.impact);
      if (weight >= 2) positives += 1;
      if (weight <= -1 || signal.impact === 'Unknown') negatives += 1;
    });
  });

  if (negatives >= positives + 2) return 'High';
  if (negatives >= positives) return 'Medium';
  return 'Low';
}

function buildDriversAndConcerns(signalGroups) {
  const allSignals = signalGroups.flatMap((signals) => signals || []);
  const drivers = allSignals
    .filter((signal) => ['High', 'Positive', 'Medium'].includes(signal.impact))
    .map((signal) => `${signal.name} (${signal.impact})`);
  const concerns = allSignals
    .filter((signal) => ['Limited', 'Negative', 'Unknown'].includes(signal.impact))
    .map((signal) => `${signal.name} (${signal.impact})`);
  return {
    drivers: drivers.length ? drivers : ['No strong drivers identified yet'],
    concerns: concerns.length ? concerns : ['No major concerns identified'],
  };
}

function buildValueCategory({
  title,
  status,
  valueBand,
  primary,
  secondary,
  modifiers,
  informational,
  explanation,
}) {
  const { drivers, concerns } = buildDriversAndConcerns([primary, secondary, modifiers]);
  const riskBand = classifyRiskBand([primary, secondary, modifiers]);
  return {
    title,
    status,
    valueBand,
    riskBand,
    primary,
    secondary,
    modifiers,
    informational,
    drivers,
    concerns,
    explanation,
  };
}

function buildValueLayer(player, rosterRecord, liveProfile) {
  const production = classifyProductionSignal(player, rosterRecord, liveProfile);
  const opportunity = classifyOpportunitySignal(player, rosterRecord, liveProfile);
  const age = classifyAgeSignal(player);
  const draftPedigree = classifyDraftPedigreeSignal(player);
  const historicalTrend = classifyHistoricalTrendSignal(liveProfile);
  const scarcity = classifyScarcitySignal(player, rosterRecord);
  const cost = classifyCostModifier(player);
  const term = classifyTermModifier(player);
  const retention = classifyRetentionModifier(player);
  const rights = classifyRightsModifier(player);

  const informational = [
    { name: 'NHL Position', impact: 'Informational', note: liveProfile?.identity?.nhlPosition || 'Unavailable' },
    { name: 'Sweater Number', impact: 'Informational', note: String(liveProfile?.identity?.sweaterNumber ?? 'Unavailable') },
    { name: 'Shoots/Catches', impact: 'Informational', note: liveProfile?.identity?.shootsCatches || 'Unavailable' },
  ];

  const prospectApplicable = player?.sourceType === 'prospect';
  const veteranApplicable = player?.sourceType === 'veteran';
  const rightsApplicable = player?.sourceType === 'prospect' || player?.matchingRights;

  const prospectPrimary = [
    { name: 'Upside Trajectory', ...production },
    { name: 'Age Window', ...age },
    { name: 'Draft Pedigree', ...draftPedigree },
  ];
  const prospectSecondary = [
    { name: 'Historical Production', ...historicalTrend },
    { name: 'Opportunity Path', ...opportunity },
    { name: 'Pool Position Scarcity', ...scarcity },
  ];
  const prospectModifiers = [
    { name: 'Cost', ...cost },
    { name: 'Term', ...term },
    { name: 'Matching Rights', ...rights },
    { name: 'Farm Status', impact: player?.farm ? 'Positive' : 'Neutral', note: player?.farm ? 'Farm control retained' : 'No farm flag' },
  ];

  const veteranPrimary = [
    { name: 'Production', ...production },
    { name: 'Opportunity', ...opportunity },
  ];
  const veteranSecondary = [
    { name: 'Age Curve', ...age },
    { name: 'Pool Position Scarcity', ...scarcity },
    { name: 'Historical Consistency', ...historicalTrend },
  ];
  const veteranModifiers = [
    { name: 'Cost', ...cost },
    { name: 'Term', ...term },
    { name: 'Retention', ...retention },
  ];

  const contractPrimary = [
    { name: 'Cost Efficiency', ...cost },
    { name: 'Contract Control', ...term },
  ];
  const contractSecondary = [
    { name: 'Retention Quality', ...retention },
    { name: 'Rights Control', ...rights },
  ];
  const contractModifiers = [
    { name: 'Matching Rights', ...rights },
  ];

  const rightsPrimary = [
    { name: 'Rights Presence', ...rights },
    { name: 'Rights Enforceability', impact: rights.impact === 'Positive' ? 'Medium' : 'Limited', note: rights.impact === 'Positive' ? 'Rights flag present in source data' : 'No enforceable rights flag' },
  ];
  const rightsSecondary = [
    { name: 'Asset Linkage', impact: player?.sourceType === 'prospect' ? 'High' : 'Limited', note: player?.sourceType === 'prospect' ? 'Prospect-linked rights context' : 'Non-prospect rights linkage is weaker' },
    { name: 'Time Horizon', ...term },
  ];
  const rightsModifiers = [
    { name: 'Cost Context', ...cost },
    { name: 'Retention Context', ...retention },
  ];

  return {
    prospectValue: buildValueCategory({
      title: 'Prospect Value',
      status: prospectApplicable ? 'Applicable' : 'Not Applicable',
      valueBand: prospectApplicable
        ? classifyProspectValueBand(
          {
            upside: prospectPrimary[0],
            age: prospectPrimary[1],
            draftPedigree: prospectPrimary[2],
          },
          {
            historicalTrend: prospectSecondary[0],
            opportunity: prospectSecondary[1],
            scarcity: prospectSecondary[2],
          },
          {
            cost: prospectModifiers[0],
            term: prospectModifiers[1],
            rights: prospectModifiers[2],
          }
        )
        : 'Not Applicable',
      primary: prospectPrimary,
      secondary: prospectSecondary,
      modifiers: prospectModifiers,
      informational,
      explanation: 'Prospect value emphasizes upside, age window, and draft pedigree first; production/opportunity refine confidence, and contract factors adjust the band.',
    }),
    veteranValue: buildValueCategory({
      title: 'Veteran Value',
      status: veteranApplicable ? 'Applicable' : 'Not Applicable',
      valueBand: veteranApplicable
        ? classifyVeteranValueBand(
          { production: veteranPrimary[0], opportunity: veteranPrimary[1] },
          { age: veteranSecondary[0], scarcity: veteranSecondary[1], historical: veteranSecondary[2] }
        )
        : 'Not Applicable',
      primary: veteranPrimary,
      secondary: veteranSecondary,
      modifiers: veteranModifiers,
      informational,
      explanation: 'Veteran value is anchored to present production and role opportunity, with age/scarcity/history as context and contract factors as modifiers.',
    }),
    draftPickValue: {
      title: 'Draft Pick Value',
      status: 'Context Required',
      valueBand: 'Pending Draft Pick Inputs',
      riskBand: 'High',
      explanation: 'Draft pick valuation is intentionally deferred until explicit pick-round, year, and condition metadata are provided.',
      primary: [
        { name: 'Round Tier', impact: 'Pending', note: 'Requires pick-round input' },
        { name: 'Year Proximity', impact: 'Pending', note: 'Requires pick-year input' },
      ],
      secondary: [
        { name: 'Conditionality', impact: 'Pending', note: 'Requires condition metadata' },
      ],
      modifiers: [
        { name: 'Protection Rules', impact: 'Pending', note: 'Requires pick-protection metadata' },
      ],
      informational: [
        { name: 'Player Profile Context', impact: 'Informational', note: 'No direct pick valuation from player-only context' },
      ],
      drivers: ['Draft pick-specific metadata not yet attached'],
      concerns: ['Player profile context cannot infer pick value'],
    },
    contractValue: buildValueCategory({
      title: 'Contract Value',
      status: 'Applicable',
      valueBand: classifyContractValueBand(
        { costEfficiency: contractPrimary[0], contractControl: contractPrimary[1] },
        { termControl: contractPrimary[1], retention: contractSecondary[0], rightsControl: contractSecondary[1] },
        { matchingRights: contractModifiers[0] }
      ),
      primary: contractPrimary,
      secondary: contractSecondary,
      modifiers: contractModifiers,
      informational,
      explanation: 'Contract value evaluates intrinsic control efficiency: cost and term lead, while retention and rights adjust final contract quality.',
    }),
    rightsValue: buildValueCategory({
      title: 'Matching Rights Value',
      status: rightsApplicable ? 'Applicable' : 'Limited',
      valueBand: classifyRightsValueBand(
        { rightsPresence: rightsPrimary[0], enforceability: rightsPrimary[1] },
        { assetLinkage: rightsSecondary[0], timeHorizon: rightsSecondary[1] }
      ),
      primary: rightsPrimary,
      secondary: rightsSecondary,
      modifiers: rightsModifiers,
      informational,
      explanation: 'Rights value reflects whether matching rights are present, enforceable, and linked to a meaningful underlying prospect-control path.',
    }),
  };
}

function renderValueCategoryCard(category) {
  const rows = [
    ['Status', category.status],
    ['Value Band', category.valueBand || 'Pending'],
    ['Risk Band', category.riskBand || 'Medium'],
    ['Primary Factors', summarizeSignals(category.primary || [])],
    ['Secondary Factors', summarizeSignals(category.secondary || [])],
    ['Modifiers', summarizeSignals(category.modifiers || [])],
    ['Informational Only', summarizeSignals(category.informational || [])],
    ['Drivers', (category.drivers || []).join(' | ')],
    ['Concerns', (category.concerns || []).join(' | ')],
    ['Explanation', category.explanation || 'No explanation available'],
  ];

  return `
    <article class="detail-card">
      <h3>${escapeHtml(category.title)}</h3>
      ${renderKeyValueList(rows)}
    </article>
  `;
}

function renderValueSection(valueLayer) {
  return `
    <section class="panel value-panel">
      <div class="preview-header">
        <h3>Value</h3>
        <div class="preview-meta">
          <span class="meta-pill">Intrinsic Asset Valuation</span>
        </div>
      </div>
      <div class="detail-grid">
        ${renderValueCategoryCard(valueLayer.prospectValue)}
        ${renderValueCategoryCard(valueLayer.veteranValue)}
        ${renderValueCategoryCard(valueLayer.contractValue)}
        ${renderValueCategoryCard(valueLayer.rightsValue)}
      </div>
    </section>
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

  const valueLayer = buildValueLayer(player, rosterRecord, liveProfile);

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
      ${renderValueSection(valueLayer)}
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

  const ownerListMarkup = renderOwnerList(ownerData);
  const ownerDetailMarkup = renderOwnerDetails(ownerData);
  const rosterIndex = buildRosterIndex(unifiedState);

  // compute aggregates once
  const aggregates = computeOwnerAggregates(unifiedState);
  const leagueHtml = renderLeagueIntelligence(aggregates);
  const dataQualityHtml = renderDataQualityPanel(unifiedState);

  const app = document.getElementById('app');
  app.innerHTML = `
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
        <strong>Upload a CSV</strong>
        <p>Import prospects, veterans, or roster data to build the dashboard.</p>
        <div class="file-input-wrap">
          <input id="csvFileInput" type="file" accept=".csv,text/csv" />
          <span class="file-placeholder">Choose CSV File</span>
        </div>
      </div>
    </section>
  `;

  document.getElementById('backToImportBtn').classList.add('hidden');

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

  const stored = loadState();
  state.importedData = stored;
  state.liveProfiles = state.liveCache?.players ? { ...state.liveCache.players } : {};
  state.selectedOwner = null;
  state.selectedPlayerKey = null;

  // if any dataset is present (status ok), show owner view
  const anyLoaded = ['prospects','veterans','roster','transactions'].some(k => stored?.metadata?.[k]?.status === 'ok');
  if (anyLoaded) {
    renderOwnerView(stored);
  } else {
    renderImportScreen();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initialize);
}

export { STORAGE_KEY, state, buildValueLayer };