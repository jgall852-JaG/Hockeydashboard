// veteranParser.js

const START_SEASON = 2022;
const COST_COLUMNS = 5;

function createPlayerId(name) {
  if (!name) return "";
  const normalized = String(name)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createUniquePlayerId(baseId, veterans) {
  const prefix = (baseId && baseId.length) ? baseId : 'player';
  if (!veterans[prefix]) return prefix;
  let i = 2;
  while (veterans[`${prefix}-${i}`]) {
    i++;
  }
  return `${prefix}-${i}`;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCostValue(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  // strip non numeric except dot and minus
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractPlayerName(rawName) {
  if (!rawName) return "";
  let name = String(rawName).trim();
  // Remove known hockey position codes before a trailing year (explicit list)
  // e.g. " RW - 2025", "LD - 2024", "G - 2023"
  name = name.replace(/\s+(?:LW|RW|C|D|G|F|LD|RD)\s*-\s*\d{4}$/i, "");
  // Remove trailing ' - 2024' if present without position
  name = name.replace(/\s*-\s*\d{4}$/i, "");
  // Remove dangling trailing hyphen(s) and surrounding whitespace (e.g. "Dylan Strome -")
  // This is intentionally conservative: only strips hyphen(s) at the end of the name
  name = name.replace(/\s*-+\s*$/i, "");
  return name.trim();
}

function extractRetentionYear(columns, rawName) {
  // Prefer explicit column at index 6 if present
  if (columns[6]) {
    const m = String(columns[6]).trim().match(/(\d{4})/);
    if (m) {
      const y = Number(m[1]);
      if (y >= 2000 && y <= 2100) return y;
    }
  }
  // Fallback: look for 4-digit at end of rawName
  if (rawName) {
    const m = String(rawName).trim().match(/(\d{4})$/);
    if (m) {
      const y = Number(m[1]);
      if (y >= 2000 && y <= 2100) return y;
    }
  }
  return null;
}

export function parseVeterans(csvData) {
  const veterans = {};
  const owners = {};
  let currentOwner = null;

  if (!csvData) return { veterans, owners };

  const rows = csvData.split(/\r?\n/);

  rows.forEach(row => {
    if (!row.trim()) return;

    const cols = parseCSVLine(row);
    const first = (cols[0] || "").trim();
    if (!first) return;

    // Skip headers like AHL Draft - Veterans.csv title lines if present
    if (first.toUpperCase().includes('AHL DRAFT') || first.toUpperCase() === 'VETERANS') return;

    // Team row detection: uppercase first column, no $ and second col empty
    const isTeamRow = first === first.toUpperCase() && !first.includes('$') && (cols[1] === "" || cols[1] === undefined);
    if (isTeamRow) {
      currentOwner = first;
      owners[currentOwner] = owners[currentOwner] || [];
      return;
    }

    if (!currentOwner) return; // ignore rows before first team

    // Expect costs in columns 1..5 for seasons 2022..2026
    const rawName = first;
    const name = extractPlayerName(rawName);
    const retentionYear = extractRetentionYear(cols, rawName);

    const seasons = Array.from({ length: COST_COLUMNS }, (_, i) => START_SEASON + i);
    const retentionHistory = [];

    for (let i = 0; i < seasons.length; i++) {
      const colIndex = 1 + i;
      const cost = parseCostValue(cols[colIndex]);
      retentionHistory.push({ season: seasons[i], cost });
    }

    // currentCost is latest non-empty value from 2026 back to 2022
    let currentCost = null;
    for (let i = retentionHistory.length - 1; i >= 0; i--) {
      if (retentionHistory[i].cost !== null) {
        currentCost = retentionHistory[i].cost;
        break;
      }
    }

    const baseId = createPlayerId(name);
    const playerId = createUniquePlayerId(baseId, veterans);

    const record = {
      playerId,
      name,
      owner: currentOwner,
      veteran: true,
      retentionHistory,
      retentionYear,
      currentCost,
    };

    veterans[playerId] = record;
    owners[currentOwner].push(playerId);
  });

  return { veterans, owners };
}
