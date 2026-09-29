/**
 * rosterParser.js
 * Parses roster-like CSV data from multiple league sheet layouts.
 */

function createEmptyRosterResult(layout = 'unknown') {
  return {
    layout,
    players: {},
    teams: {},
    teamBudgets: [],
    goalieFranchises: [],
    contacts: {},
  };
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCost(value) {
  const cleaned = String(value || '').replace(/[^0-9.\-]/g, '');
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoney(value) {
  const text = String(value ?? '').replace(/[$,\s]/g, '');
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSkaters(value) {
  const match = String(value ?? '').trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  const count = Number(match[1]);
  const max = Number(match[2]);
  return Number.isInteger(count) && Number.isInteger(max) && count >= 0 && max > 0 && count <= max
    ? { count, max }
    : null;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function addPlayer(result, player, fallbackKey) {
  const name = String(player.name || '').trim();
  if (!name || name.toLowerCase() === 'x') return;

  const baseKey = normalizeKey(name) || `player-${fallbackKey}`;
  let key = baseKey;
  let suffix = 2;
  while (result.players[key]) {
    key = `${baseKey}-${suffix}`;
    suffix += 1;
  }

  const nextPlayer = {
    name,
    owner: String(player.owner || '').trim(),
    position: String(player.position || '').trim(),
    poolposition: String(player.poolposition || player.position || '').trim(),
    nhlteam: String(player.nhlteam || '').trim(),
    cost: player.cost ?? '',
    source: String(player.source || '').trim(),
    retained: Boolean(player.retained),
    drafted: Boolean(player.drafted),
    available: player.available ?? '',
    classification: String(player.classification || '').trim(),
  };

  result.players[key] = nextPlayer;
  if (nextPlayer.nhlteam) {
    if (!result.teams[nextPlayer.nhlteam]) {
      result.teams[nextPlayer.nhlteam] = [];
    }
    result.teams[nextPlayer.nhlteam].push(key);
  }
}

function parseInventoryMatrix(lines) {
  const result = createEmptyRosterResult('inventory');
  const header = parseCSVLine(lines[0] || '');
  const groups = [];
  for (let col = 0; col < header.length; col += 2) {
    const rawPosition = String(header[col] || '').trim();
    if (!rawPosition) continue;
    const position = rawPosition
      .replace(/\s+/g, ' ')
      .replace(/LEFT WING/i, 'LW')
      .replace(/RIGHT WING/i, 'RW')
      .replace(/CENTER/i, 'C')
      .replace(/DEFENSE/i, 'D')
      .replace(/UTILITY/i, 'U')
      .toUpperCase();
    groups.push({ position, nameCol: col, teamCol: col + 1 });
  }

  let fallback = 1;
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    groups.forEach((group) => {
      const name = values[group.nameCol] || '';
      const nhlteam = values[group.teamCol] || '';
      addPlayer(result, {
        name,
        owner: '',
        position: group.position,
        poolposition: group.position,
        nhlteam,
        cost: '',
        source: 'inventory',
      }, fallback++);
    });
  }

  return result;
}

function parseUtilitySheet(lines) {
  const result = createEmptyRosterResult('utility');
  let fallback = 1;
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const name = values[0] || '';
    const nhlteam = values[1] || '';
    const eligibility = values[2] || 'U';
    addPlayer(result, {
      name,
      owner: '',
      position: 'U',
      poolposition: eligibility,
      nhlteam,
      cost: '',
      source: 'utility',
    }, fallback++);
  }
  return result;
}

function normalizeLeagueSlotPosition(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return '';
  if (['C', 'L', 'R', 'D', 'G', 'U', 'F', 'IR', 'DH'].includes(value)) return value;
  return '';
}

function looksLikeContactRow(values) {
  return values.some((cell) => /\S+@\S+\.\S+/.test(String(cell || '').replace(/\s+/g, '')));
}

function looksLikePhoneRow(values) {
  return values.some((cell) => /\d{3}[- ]?\d{3}[- ]?\d{4}/.test(String(cell || '')));
}

function parseLeagueLayout(lines) {
  const result = createEmptyRosterResult('league-layout');
  const header = parseCSVLine(lines[0] || '');
  const owners = header.slice(1).map((cell) => String(cell || '').trim());
  let currentPosition = '';
  let fallback = 1;

  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    if (looksLikePhoneRow(values) || looksLikeContactRow(values)) break;

    const firstCell = String(values[0] || '').trim();
    const slotPosition = normalizeLeagueSlotPosition(firstCell);
    if (slotPosition) {
      currentPosition = slotPosition;
    }

    owners.forEach((owner, idx) => {
      if (!owner) return;
      const cell = String(values[idx + 1] || '').trim();
      if (!cell) return;
      if (cell.toUpperCase() === owner.toUpperCase()) return;
      const name = cell.replace(/\s+[clrwdgfu]{1,2}$/i, '').trim();
      if (!name) return;

      addPlayer(result, {
        name,
        owner,
        position: currentPosition || '',
        poolposition: currentPosition || '',
        nhlteam: '',
        cost: '',
        source: 'league-layout',
        classification: currentPosition === 'F' ? 'Farm' : '',
      }, fallback++);
    });
  }

  return result;
}

function parseRetainedGrid(lines) {
  const result = createEmptyRosterResult('retained-grid');
  let blockOwners = [];
  const teamBudgets = new Map();
  let fallback = 1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseCSVLine(line);
    const hasPlayerHeader = values.some((cell) => String(cell || '').trim().toLowerCase() === 'player name');
    if (hasPlayerHeader) continue;

    const first = String(values[0] || '').trim().toUpperCase();
    if (first === 'F' && String(values[1] || '').trim().toLowerCase().includes('farm deductions')) {
      blockOwners.filter(Boolean).forEach((owner) => {
        if (teamBudgets.has(owner)) teamBudgets.get(owner).hasFarmDeductionRow = true;
      });
      continue;
    }

    const ownerCandidates = [];
    for (let col = 0; col < values.length; col += 4) {
      ownerCandidates.push(String(values[col] || '').trim());
    }

    const namedOwnerCandidates = ownerCandidates.filter((value) => /[A-Za-z]/.test(value) && !['#', 'F'].includes(value.toUpperCase()));
    const isOwnerRow = namedOwnerCandidates.length >= 2
      && !values.some((cell) => String(cell || '').toUpperCase().includes('TOTAL SPENT'))
      && !values.some((cell) => String(cell || '').toUpperCase().includes('BALANCE'))
      && !values.some((cell) => String(cell || '').includes('$'));
    if (isOwnerRow) {
      blockOwners = ownerCandidates.map((value) => String(value || '').trim());
      blockOwners.filter(Boolean).forEach((owner) => {
        if (!teamBudgets.has(owner)) {
          teamBudgets.set(owner, {
            team: owner,
            totalSpent: null,
            remainingBudget: null,
            keeperCosts: null,
            rookieFarmCosts: null,
            hasFarmDeductionRow: false,
            playersDrafted: 0,
            skaters: { count: 0, max: 23 },
            openSlots: null,
            penalties: null,
            adjustments: null,
          });
        }
      });
      continue;
    }

    if (!blockOwners.length) continue;

    const summaryLabel = values.some((cell) => String(cell || '').toUpperCase().includes('TOTAL SPENT'))
      ? 'totalSpent'
      : values.some((cell) => String(cell || '').toUpperCase().includes('BALANCE'))
        ? 'remainingBudget'
        : values.some((cell) => String(cell || '').toUpperCase().includes('PENALT'))
          ? 'penalties'
          : values.some((cell) => String(cell || '').toUpperCase().includes('ADJUST'))
            ? 'adjustments'
            : null;
    if (summaryLabel) {
      for (let col = 0; col < blockOwners.length * 4; col += 4) {
        const owner = blockOwners[col / 4];
        if (owner && teamBudgets.has(owner)) {
          teamBudgets.get(owner)[summaryLabel] = parseCost(values[col + 3]);
        }
      }
      continue;
    }

    for (let col = 0; col < blockOwners.length * 4; col += 4) {
      const owner = String(blockOwners[col / 4] || '').trim();
      if (!owner || owner === '#') continue;
      const name = String(values[col + 1] || '').trim();
      const position = String(values[col + 2] || '').trim();
      const rawCost = String(values[col + 3] || '').trim();
      if (!name || /^TOTAL SPENT$/i.test(name) || /^BALANCE$/i.test(name)) continue;

      addPlayer(result, {
        name,
        owner,
        position,
        poolposition: position,
        nhlteam: '',
        cost: parseCost(rawCost),
        source: 'retained-grid',
        retained: true,
      }, fallback++);
      const budget = teamBudgets.get(owner);
      budget.playersDrafted += 1;
      if (!['G', 'GT', 'GOALIE', 'GOALIE TEAM'].includes(position.toUpperCase())) {
        budget.skaters.count += 1;
      }
      budget.keeperCosts = (budget.keeperCosts || 0) + parseCost(rawCost);
    }
  }

  result.teamBudgets = [...teamBudgets.values()].map((budget) => ({
    ...budget,
    retained: budget.totalSpent,
    rookieFarmCosts: budget.hasFarmDeductionRow
      ? Number(Math.max(0, (budget.totalSpent ?? 0) - (budget.keeperCosts ?? 0)).toFixed(2))
      : null,
    openSlots: Math.max(0, 25 - budget.playersDrafted),
  })).map(({ hasFarmDeductionRow, ...budget }) => budget);
  return result;
}

function parseAhlBudgetSheet(csvData) {
  const lines = String(csvData || '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error('AHL Budget sheet is empty.');
  const retainedGrid = parseRoster(csvData);
  if (retainedGrid.teamBudgets.length) {
    return { layout: 'budget', teamBudgets: retainedGrid.teamBudgets };
  }

  const headers = parseCSVLine(lines[0]).map((header) => String(header || '').trim());
  const normalized = headers.map((header) => header.replace(/[^a-z0-9]+/gi, '').toLowerCase());
  const column = (names) => normalized.findIndex((header) => names.includes(header));
  const ownerColumn = column(['owner', 'team']);
  const retainedColumn = column(['retained', 'totalspent']);
  const remainingColumn = column(['remaining', 'remainingbudget', 'balance']);
  const skatersColumn = column(['skaters']);
  if ([ownerColumn, retainedColumn, remainingColumn, skatersColumn].some((index) => index < 0)) {
    throw new Error('AHL Budget sheet must include Owner, Retained, Remaining, and Skaters columns.');
  }

  const teamBudgets = lines.slice(1).map(parseCSVLine).flatMap((row) => {
    const team = String(row[ownerColumn] || '').trim();
    if (!team) return [];
    const retained = parseMoney(row[retainedColumn]);
    const remainingBudget = parseMoney(row[remainingColumn]);
    const skaters = parseSkaters(row[skatersColumn]);
    if (retained === null || remainingBudget === null || skaters === null) {
      throw new Error(`AHL Budget row for ${team} contains invalid money or skater values.`);
    }
    return [{
      team,
      retained,
      totalSpent: retained,
      remainingBudget,
      skaters,
      playersDrafted: skaters.count,
      openSlots: Math.max(0, skaters.max - skaters.count),
      keeperCosts: null,
      rookieFarmCosts: null,
      penalties: null,
      adjustments: null,
    }];
  });
  if (!teamBudgets.length) throw new Error('AHL Budget sheet contains no owner rows.');
  return { layout: 'budget', teamBudgets };
}

function parseFlatTable(lines) {
  const result = createEmptyRosterResult('flat-table');
  const headers = parseCSVLine(lines[0] || '').map((header) => String(header || '').trim().toLowerCase());
  let fallback = 1;

  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const record = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = values[index] || '';
      const normalizedHeader = header.replace(/[^a-z0-9]+/g, '');
      record[header] = value;
      if (normalizedHeader) {
        record[normalizedHeader] = value;
      }
    });

    const name = record.name || record.player || record.fullname || record.playername || record.displayname || record['full name'] || record['player name'] || '';
    const position = record.poolposition || record.position || record.primaryposition || record.positioncode || record['pool position'] || record['primary position'] || record['position code'] || '';
    const owner = record.owner || record.team || record.currentteam || record.club || record['current team'] || record['team name'] || '';
    const nhlteam = record.nhlteam || record.teamabbrev || record['nhl team'] || record['team abbrev'] || '';

    addPlayer(result, {
      name,
      owner,
      position,
      poolposition: position,
      nhlteam,
      cost: parseCost(record.cost || record.currentcost || record['current cost'] || ''),
      source: 'flat-table',
      retained: ['y', 'yes', 'true', '1'].includes(String(record.retained || record.retention || record.kept || '').trim().toLowerCase()),
      drafted: ['y', 'yes', 'true', '1'].includes(String(record.drafted || record.draftstatus || record['draft status'] || '').trim().toLowerCase()),
      available: record.available || record.isavailable || record['is available'] || record.undrafted || '',
      classification: record.classification || record.type || '',
    }, fallback++);
  }

  return result;
}

function parseRoster(csvData) {
  const raw = String(csvData || '');
  const lines = raw.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim());
  if (!nonEmptyLines.length) return createEmptyRosterResult();

  const firstLine = parseCSVLine(nonEmptyLines[0]);
  const firstCell = String(firstLine[0] || '').trim().toUpperCase();
  const headerJoined = firstLine.join('|').toUpperCase();

  if (firstCell === 'UTILITY') {
    return parseUtilitySheet(nonEmptyLines);
  }

  if (headerJoined.includes('LEFT WING') && headerJoined.includes('CENTER') && headerJoined.includes('RIGHT WING')) {
    return parseInventoryMatrix(nonEmptyLines);
  }

  if (!firstCell && firstLine.length >= 3 && firstLine.slice(1).some((cell) => String(cell || '').trim())) {
    return parseLeagueLayout(nonEmptyLines);
  }

  if (nonEmptyLines.some((line) => line.toUpperCase().includes('TOTAL SPENT')) && nonEmptyLines.some((line) => line.toUpperCase().includes('PLAYER NAME'))) {
    return parseRetainedGrid(nonEmptyLines);
  }

  return parseFlatTable(nonEmptyLines);
}

function filterByPosition(roster, position) {
  const filtered = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    if (player.position === position) {
      filtered[key] = player;
    }
  });
  return filtered;
}

function filterByNHLTeam(roster, nhlTeam) {
  const filtered = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    if (player.nhlteam === nhlTeam) {
      filtered[key] = player;
    }
  });
  return filtered;
}

function filterByOwner(roster, owner) {
  const filtered = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    if (player.owner === owner) {
      filtered[key] = player;
    }
  });
  return filtered;
}

function filterByStatus(roster, status) {
  const filtered = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    if (player[status.toLowerCase()] === 'true' || player[status.toLowerCase()] === '1') {
      filtered[key] = player;
    }
  });
  return filtered;
}

function sortByCost(roster) {
  return Object.entries(roster.players)
    .map(([key, player]) => ({ ...player, playerKey: key }))
    .sort((a, b) => parseFloat(b.cost || 0) - parseFloat(a.cost || 0));
}

function groupByOwner(roster) {
  const grouped = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    const owner = player.owner || 'Unknown';
    if (!grouped[owner]) {
      grouped[owner] = {};
    }
    grouped[owner][key] = player;
  });
  return grouped;
}

if (typeof window !== 'undefined') {
  window.parseRoster = parseRoster;
}

export {
  parseRoster,
  parseAhlBudgetSheet,
  parseCSVLine,
  parseMoney,
  parseSkaters,
  filterByPosition,
  filterByNHLTeam,
  filterByOwner,
  filterByStatus,
  sortByCost,
  groupByOwner,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseRoster,
    parseAhlBudgetSheet,
    parseCSVLine,
    parseMoney,
    parseSkaters,
    filterByPosition,
    filterByNHLTeam,
    filterByOwner,
    filterByStatus,
    sortByCost,
    groupByOwner,
  };
}
