/**
 * rosterParser.js
 * Parses roster-like CSV data from multiple league sheet layouts.
 */

function createEmptyRosterResult() {
  return {
    players: {},
    teams: {},
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
  const result = createEmptyRosterResult();
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
  const result = createEmptyRosterResult();
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
  const result = createEmptyRosterResult();
  const header = parseCSVLine(lines[0] || '');
  const owners = header.slice(1).map((cell) => String(cell || '').trim());
  let currentPosition = '';
  let fallback = 1;

  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    if (looksLikePhoneRow(values) || looksLikeContactRow(values)) continue;

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
      }, fallback++);
    });
  }

  return result;
}

function parseRetainedGrid(lines) {
  const result = createEmptyRosterResult();
  let blockOwners = [];
  let fallback = 1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseCSVLine(line);
    const hasPlayerHeader = values.some((cell) => String(cell || '').trim().toLowerCase() === 'player name');
    if (hasPlayerHeader) continue;

    const first = String(values[0] || '').trim().toUpperCase();
    if (first === 'F' && String(values[1] || '').trim().toLowerCase().includes('farm deductions')) {
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
      continue;
    }

    if (!blockOwners.length) continue;

    if (values.some((cell) => String(cell || '').toUpperCase().includes('TOTAL SPENT'))) continue;
    if (values.some((cell) => String(cell || '').toUpperCase().includes('BALANCE'))) continue;

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
      }, fallback++);
    }
  }

  return result;
}

function parseFlatTable(lines) {
  const result = createEmptyRosterResult();
  const headers = parseCSVLine(lines[0] || '').map((header) => String(header || '').trim().toLowerCase());
  let fallback = 1;

  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const record = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = values[index] || '';
    });

    const name = record.name || record.player || record.fullname || record.playername || '';
    const position = record.poolposition || record.position || record.primaryposition || record.positioncode || '';
    const owner = record.owner || record.team || record.currentteam || record.club || '';
    const nhlteam = record.nhlteam || record.teamabbrev || '';

    addPlayer(result, {
      name,
      owner,
      position,
      poolposition: position,
      nhlteam,
      cost: parseCost(record.cost || record.currentcost || ''),
      source: 'flat-table',
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

  if (!firstCell && firstLine.length > 3 && firstLine.slice(1).some((cell) => String(cell || '').trim())) {
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
  parseCSVLine,
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
    parseCSVLine,
    filterByPosition,
    filterByNHLTeam,
    filterByOwner,
    filterByStatus,
    sortByCost,
    groupByOwner,
  };
}
