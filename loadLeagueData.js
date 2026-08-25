import { readFile, stat } from 'fs/promises';
import { parseProspects } from './prospectParser.js';
import { parseVeterans } from './veteranParser.js';
import { parseRoster } from './rosterParser.js';

// Centralized data files configuration — update this object weekly to point to new CSVs
export const DATA_FILES = {
  roster: '../Data/Rosters/AHL Draft - Roster.csv',
  prospects: '../Data/Rosters/AHL Draft - Prospects.csv',
  veterans: '../Data/Rosters/AHL Draft - Veterans.csv',
  transactions: '../Data/Rosters/AHL Draft - Transactions.csv',
};

function resolvePath(rel) {
  return new URL(rel, import.meta.url).pathname;
}

function countRecords(parsed) {
  if (!parsed) return 0;
  if (parsed.players && typeof parsed.players === 'object') return Object.keys(parsed.players).length;
  if (parsed.prospects && typeof parsed.prospects === 'object') return Object.keys(parsed.prospects).length;
  if (parsed.veterans && typeof parsed.veterans === 'object') return Object.keys(parsed.veterans).length;
  if (Array.isArray(parsed)) return parsed.length;
  if (typeof parsed === 'object') return Object.keys(parsed).length;
  return 0;
}

export async function loadLeagueData() {
  // Resolve all file paths
  const resolved = {};
  for (const [key, rel] of Object.entries(DATA_FILES)) {
    resolved[key] = resolvePath(rel);
  }

  // Load roster parser (CommonJS compatibility)
  const results = {
    roster: null,
    prospects: null,
    veterans: null,
    transactions: null,
    metadata: {},
  };

  const parsers = {
    roster: (csv) => parseRoster(csv),
    prospects: (csv) => parseProspects(csv),
    veterans: (csv) => parseVeterans(csv),
    transactions: (csv) => parseRoster(csv),
  };

  for (const [key, filePath] of Object.entries(resolved)) {
    const meta = {
      path: filePath,
      records: 0,
      loadedAt: null,
      status: 'pending',
      message: '',
    };

    try {
      // Verify file exists and is non-empty
      const st = await stat(filePath);
      if (!st || st.size === 0) {
        meta.status = 'failed';
        meta.message = 'file missing or empty';
        results.metadata[key] = meta;
        continue; // skip parsing
      }

      const csv = await readFile(filePath, 'utf8');
      if (!csv || !csv.trim()) {
        meta.status = 'failed';
        meta.message = 'file empty';
        results.metadata[key] = meta;
        continue;
      }

      // Parse
      let parsed;
      try {
        const parser = parsers[key];
        if (!parser) throw new Error('No parser configured for ' + key);
        parsed = parser(csv);
      } catch (perr) {
        meta.status = 'failed';
        meta.message = `parser error: ${perr && perr.message ? perr.message : perr}`;
        results.metadata[key] = meta;
        continue;
      }

      const recordCount = countRecords(parsed);

      // assign parsed result
      results[key] = parsed;

      meta.records = recordCount;
      meta.loadedAt = new Date().toISOString();
      meta.status = 'ok';
      meta.message = '';
      results.metadata[key] = meta;
    } catch (err) {
      meta.status = 'failed';
      meta.message = `io error: ${err && err.message ? err.message : err}`;
      results.metadata[key] = meta;
    }
  }

  return results;
}
