import { normalizeLookupKey } from './liveNhlApi.js';
import { applyForecastedStats, buildForecastedStats } from './forecastedStats.js';
import {
  calculateAuctionValue,
  calculateDraftIqScores,
  calculateRecommendedMaxBid,
  getClassification,
  getTier,
} from './draftIntelligence.js';

// Dobber source files are bundled directly in the repo under /data so they load
// via a same-origin relative fetch (no OneDrive CORS/auth issues) both locally
// and when hosted on GitHub Pages.
export const DOBBER_EXCEL_URL = './data/dobberhockeydraftlist202627.xlsx';
export const DOBBER_GUIDE_PDF_URL = './data/dobberhockey202627fantasyguide.pdf';
export const DOBBER_PROSPECTS_PDF_URL = './data/dobberhockey202627fantasyprospectsreport.pdf';
export const DOBBER_PDF_URLS = Object.freeze([DOBBER_GUIDE_PDF_URL, DOBBER_PROSPECTS_PDF_URL]);
export const DOBBER_SKATER_SHEET = 'EVERYTHING (Skaters)';

function readField(row, field) {
  const target = field.replace(/[^a-z0-9]+/gi, '').toLowerCase();
  const key = Object.keys(row || {}).find((candidate) => (
    candidate.replace(/[^a-z0-9]+/gi, '').toLowerCase() === target
  ));
  return key ? row[key] : undefined;
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number.parseFloat(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeScore(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const parsed = Number.parseFloat(String(value).replace('%', '').trim());
  if (!Number.isFinite(parsed)) return null;
  const score = parsed >= 0 && parsed <= 1 ? parsed * 100 : parsed;
  if (score < 0 || score > 100) {
    throw new Error(`${label} must be on a 0-1 or 0-100 scale.`);
  }
  return score;
}

function parseProjectionPayload(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  if (typeof value === 'object') return value;
  const text = String(value).trim();
  if (!text.startsWith('{')) return text;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Dobber Projections JSON is invalid: ${error.message}`);
  }
}

function projectionScore(row, projections, field) {
  const direct = readField(row, field);
  if (direct !== undefined && direct !== '') return normalizeScore(direct, `Dobber ${field}`);
  if (!projections || typeof projections !== 'object') return null;
  return normalizeScore(readField(projections, field), `Dobber Projections.${field}`);
}

function forecastProjections(row, projections) {
  const directFields = {
    // 'Games'/'Points'/'SOG' are the bare column names used by the real
    // "EVERYTHING (Skaters)" tab in the bundled Dobber draft list workbook.
    ProjPts: ['ProjPts', 'Proj Pts', 'Projected Points', 'Forecasted Points', 'Points'],
    ProjGP: ['ProjGP', 'Proj Games', 'Projected Games', 'Games', 'GP'],
    ProjSOG: ['ProjSOG', 'ProjShots', 'Proj Shots', 'Projected Shots', 'SOG', 'Shots'],
  };
  const direct = Object.fromEntries(Object.entries(directFields).flatMap(([field, aliases]) => {
    const value = aliases.map((alias) => readField(row, alias))
      .find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim() !== '');
    return value === undefined ? [] : [[field, value]];
  }));
  return { ...(projections && typeof projections === 'object' ? projections : {}), ...direct };
}

function parseRiskFlags(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value || '').split(/[;,|]/).map((entry) => entry.trim()).filter(Boolean);
}

// Builds a 0-100 percentile score for every finite value in `entries`
// (`{ key, value }`), where a higher raw value always produces a higher
// percentile score. Pass `invert: true` for metrics where a *lower* raw value
// is better (e.g. draft rank, where 1 is best). Entries with a non-finite
// value are left out of the returned map entirely.
function buildPercentileScores(entries, { invert = false } = {}) {
  const finite = entries.filter((entry) => Number.isFinite(entry.value));
  const sorted = [...finite].sort((a, b) => (invert ? b.value - a.value : a.value - b.value));
  const scores = new Map();
  sorted.forEach((entry, index) => {
    scores.set(entry.key, sorted.length > 1 ? (index / (sorted.length - 1)) * 100 : 100);
  });
  return scores;
}

function weightedAverage(parts) {
  const available = parts.filter((part) => Number.isFinite(part.value));
  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0);
  if (!available.length || totalWeight <= 0) return null;
  const weighted = available.reduce((sum, part) => sum + (part.value * part.weight), 0);
  return Math.max(0, Math.min(100, weighted / totalWeight));
}

// Re-derives the DraftIQ pricing inputs (PPS/RSS/BPS/RRS/KVS) from columns
// that actually exist in the real Dobber Excel - Rank, Upside, 3YP, Games,
// Points, and PP Unit - instead of the literal BPS/KVS/PPS/RSS/RRS columns
// some older Dobber editions shipped with (and which the real workbook does
// not contain). This is a *fallback*: normalizeDobberRows only uses these
// derived scores for a metric when the sheet has no explicit value for it.
// Every input is optional; a player missing some signals still gets a score
// computed from whatever is present, and a metric only comes back null when
// none of its relevant inputs are available for that player at all.
function derivePricingInputs(pricingRows) {
  const rankScores = buildPercentileScores(
    pricingRows.map((row) => ({ key: row.key, value: row.rank })),
    { invert: true },
  );
  const upsideScores = buildPercentileScores(pricingRows.map((row) => ({ key: row.key, value: row.upside })));
  const threeYearScores = buildPercentileScores(pricingRows.map((row) => ({ key: row.key, value: row.threeYearPoints })));
  const pointsScores = buildPercentileScores(pricingRows.map((row) => ({ key: row.key, value: row.projectedPoints })));
  const gamesScores = buildPercentileScores(pricingRows.map((row) => ({ key: row.key, value: row.projectedGames })));
  // Breakout headroom: how much higher a player's ceiling (Upside) is than
  // their median projection (Points) - a wide gap signals more upside to grow into.
  const upsideGapScores = buildPercentileScores(pricingRows.map((row) => ({
    key: row.key,
    value: Number.isFinite(row.upside) && Number.isFinite(row.projectedPoints) ? row.upside - row.projectedPoints : null,
  })));
  // Regression risk: how far the current-season projection (Points) runs
  // ahead of the 3-year trend (3YP) - a big positive gap looks like a career year.
  const regressionGapScores = buildPercentileScores(pricingRows.map((row) => ({
    key: row.key,
    value: Number.isFinite(row.projectedPoints) && Number.isFinite(row.threeYearPoints)
      ? Math.max(0, row.projectedPoints - row.threeYearPoints)
      : null,
  })));
  const ppUnitScores = new Map(pricingRows
    .filter((row) => Number.isFinite(row.ppUnit))
    .map((row) => [row.key, row.ppUnit <= 1 ? 100 : row.ppUnit === 2 ? 60 : 30]));

  const derivedByKey = new Map();
  pricingRows.forEach((row) => {
    const rank = rankScores.get(row.key) ?? null;
    const upside = upsideScores.get(row.key) ?? null;
    const threeYear = threeYearScores.get(row.key) ?? null;
    const points = pointsScores.get(row.key) ?? null;
    const games = gamesScores.get(row.key) ?? null;
    const upsideGap = upsideGapScores.get(row.key) ?? null;
    const regressionGap = regressionGapScores.get(row.key) ?? null;
    const ppUnit = ppUnitScores.get(row.key) ?? null;

    derivedByKey.set(row.key, {
      pps: weightedAverage([
        { value: points, weight: 0.5 },
        { value: threeYear, weight: 0.3 },
        { value: games, weight: 0.2 },
      ]),
      rss: weightedAverage([
        { value: ppUnit, weight: 0.5 },
        { value: games, weight: 0.3 },
        { value: rank, weight: 0.2 },
      ]),
      bps: weightedAverage([
        { value: upside, weight: 0.6 },
        { value: upsideGap, weight: 0.4 },
      ]),
      rrs: regressionGap,
      kvs: weightedAverage([
        { value: rank, weight: 0.5 },
        { value: threeYear, weight: 0.5 },
      ]),
    });
  });
  return derivedByKey;
}


export function normalizeDobberRows(rows) {
  const seenKeys = new Set();
  const rowEntries = [];
  (rows || []).forEach((row, index) => {
    const player = String(readField(row, 'Player') || '').trim();
    if (!player) return;
    const playerKey = normalizeLookupKey(player);
    if (!playerKey) return;
    if (seenKeys.has(playerKey)) {
      throw new Error(`Dobber workbook contains duplicate player rows for ${player}.`);
    }
    seenKeys.add(playerKey);
    const projections = parseProjectionPayload(readField(row, 'Projections'));
    const normalizedForecastProjections = forecastProjections(row, projections);
    buildForecastedStats(normalizedForecastProjections, null);
    rowEntries.push({
      key: playerKey,
      index,
      player,
      row,
      projections,
      normalizedForecastProjections,
      rank: parseOptionalNumber(readField(row, 'Rank')),
      upside: parseOptionalNumber(readField(row, 'Upside')),
      threeYearPoints: parseOptionalNumber(readField(row, '3YP')),
      projectedPoints: parseOptionalNumber(normalizedForecastProjections.ProjPts),
      projectedGames: parseOptionalNumber(normalizedForecastProjections.ProjGP),
      ppUnit: parseOptionalNumber(readField(row, 'PP Unit')),
    });
  });
  if (!rowEntries.length) {
    throw new Error(`Dobber sheet "${DOBBER_SKATER_SHEET}" contains no player rows.`);
  }

  const derivedByKey = derivePricingInputs(rowEntries);
  const players = {};
  rowEntries.forEach(({ key, index, player, row, projections, normalizedForecastProjections, rank, upside, threeYearPoints }) => {
    const derived = derivedByKey.get(key) || { pps: null, rss: null, bps: null, rrs: null, kvs: null };
    const explicitBps = normalizeScore(readField(row, 'BPS'), `${player}.BPS`);
    const explicitKvs = normalizeScore(readField(row, 'KVS'), `${player}.KVS`);
    const explicitPps = projectionScore(row, projections, 'PPS');
    const explicitRss = projectionScore(row, projections, 'RSS');
    const explicitRrs = projectionScore(row, projections, 'RRS');
    const bps = explicitBps ?? derived.bps;
    const kvs = explicitKvs ?? derived.kvs;
    const pps = explicitPps ?? derived.pps;
    const rss = explicitRss ?? derived.rss;
    const rrs = explicitRrs ?? derived.rrs;
    const usedExplicitInput = [explicitBps, explicitKvs, explicitPps, explicitRss, explicitRrs].some((value) => value !== null);
    const usedDerivedInput = !usedExplicitInput && [bps, kvs, pps, rss, rrs].some((value) => value !== null);
    players[key] = {
      player,
      team: String(readField(row, 'Team') || '').trim().toUpperCase(),
      nhlPos: String(readField(row, 'POS') || '').trim().toUpperCase() || null,
      salary: parseOptionalNumber(readField(row, 'Salary')),
      aav: parseOptionalNumber(readField(row, 'AAV')),
      bps,
      kvs,
      pps,
      rss,
      rrs,
      // 'excel' when the sheet has literal BPS/KVS/PPS/RSS/RRS columns,
      // 'derived' when they were re-derived from Rank/Upside/3YP/Games/Points/
      // PP Unit instead, 'unavailable' when neither signal exists.
      pricingMethod: usedExplicitInput ? 'excel' : usedDerivedInput ? 'derived' : 'unavailable',
      rank,
      upside,
      threeYearPoints,
      projections,
      forecastProjections: normalizedForecastProjections,
      riskFlags: parseRiskFlags(readField(row, 'RiskFlags')),
      // Role/Tier are read generically since Dobber's own column names vary by
      // edition (e.g. "PP Unit" for role); left null when the sheet omits them
      // rather than inferring a value.
      role: String(readField(row, 'Role') || readField(row, 'PP Unit') || '').trim() || null,
      tier: String(readField(row, 'Tier') || '').trim() || null,
      rookie: Boolean(String(readField(row, 'Rookie') || '').trim()),
      intelEdge: null,
      sourceRow: index + 2,
    };
  });
  return players;
}

export function parseDobberWorkbook(arrayBuffer, xlsx = globalThis.XLSX) {
  if (!xlsx?.read || !xlsx?.utils?.sheet_to_json) {
    throw new Error('The bundled Excel parser is unavailable.');
  }
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('Dobber download did not return an Excel workbook.');
  }
  const workbook = xlsx.read(arrayBuffer, { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[DOBBER_SKATER_SHEET];
  if (!sheet) {
    throw new Error(`Dobber workbook is missing the "${DOBBER_SKATER_SHEET}" tab.`);
  }
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  let headers;
  let rows;
  if (Array.isArray(matrix?.[0])) {
    // Dobber's "EVERYTHING (Skaters)" tab leads with several banner/quick-jump
    // rows before the real header row, so scan for the row containing the
    // Player column instead of assuming it's row 0.
    const headerRowIndex = matrix.findIndex((candidateRow) => (
      Array.isArray(candidateRow)
      && candidateRow.some((cell) => String(cell || '').replace(/[^a-z0-9]+/gi, '').toLowerCase() === 'player')
    ));
    const headerRow = headerRowIndex >= 0 ? matrix[headerRowIndex] : matrix[0];
    headers = headerRow.map((header) => String(header || '').trim());
    rows = matrix.slice((headerRowIndex >= 0 ? headerRowIndex : 0) + 1).map((values) => Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']),
    ));
  } else {
    rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
    headers = Object.keys(rows[0] || {});
  }
  const normalizedHeaders = new Set(headers.map((header) => header.replace(/[^a-z0-9]+/gi, '').toLowerCase()));
  if (!normalizedHeaders.has('player')) {
    throw new Error('Dobber workbook is missing the required Player column.');
  }
  const dataColumns = ['team', 'pos', 'salary', 'aav', 'bps', 'kvs', 'pps', 'rss', 'rrs', 'projections', 'riskflags', 'projpts', 'projgp', 'projsog', 'projshots', 'projectedpoints', 'projectedgames', 'projectedshots', 'games', 'points', 'sog', 'rank', 'upside', '3yp'];
  if (!dataColumns.some((column) => normalizedHeaders.has(column))) {
    throw new Error('Dobber workbook is missing expected skater data columns.');
  }
  return normalizeDobberRows(rows);
}

function importWarning(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export async function ingestDobberExcelFile(file, xlsx = globalThis.XLSX, now = () => new Date()) {
  const fileName = String(file?.name || '');
  try {
    const players = parseDobberWorkbook(await file.arrayBuffer(), xlsx);
    return {
      status: 'loaded-local',
      fileName,
      lastImport: now().toISOString(),
      warnings: [],
      playersParsed: Object.keys(players).length,
      players,
    };
  } catch (error) {
    return {
      status: 'invalid-format',
      fileName,
      lastImport: null,
      warnings: [importWarning(error, 'Dobber Excel import failed.')],
      playersParsed: 0,
      players: {},
    };
  }
}

export async function fetchDobberWorkbook(fetchImpl = globalThis.fetch, xlsx = globalThis.XLSX) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable for Dobber Excel.');
  const response = await fetchImpl(DOBBER_EXCEL_URL, { cache: 'no-store', credentials: 'omit' });
  if (!response?.ok) {
    throw new Error(`Dobber Excel fetch failed (HTTP ${response?.status || 'unknown'}).`);
  }
  return parseDobberWorkbook(await response.arrayBuffer(), xlsx);
}

function explicitIntelValue(context, label) {
  const pattern = new RegExp(`${label}\\s*[:\\-]\\s*([^|;\\n]{1,80})`, 'i');
  return context.match(pattern)?.[1]?.trim() || null;
}

export function extractDobberIntelFromText(text, playerNames) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const intelByPlayerKey = {};
  const locations = (playerNames || []).flatMap((player) => {
    const key = normalizeLookupKey(player);
    if (!key) return [];
    const index = lines.findIndex((line) => normalizeLookupKey(line).includes(key));
    return index < 0 ? [] : [{ player, key, index }];
  }).sort((left, right) => left.index - right.index);
  locations.forEach(({ key, index }, locationIndex) => {
    const nextPlayerIndex = locations[locationIndex + 1]?.index ?? lines.length;
    const context = lines.slice(index, Math.min(index + 6, nextPlayerIndex)).join('\n');
    const pedigree = explicitIntelValue(context, 'pedigree');
    const projectionConfidence = explicitIntelValue(context, 'projection\\s+confidence');
    const sleeperTag = /\bsleeper\b/i.test(context);
    const bustTag = /\bbust\b/i.test(context);
    if (!pedigree && !projectionConfidence && !sleeperTag && !bustTag) return;
    intelByPlayerKey[key] = { pedigree, projectionConfidence, sleeperTag, bustTag };
  });
  return intelByPlayerKey;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The real Prospects Report's PDF text extraction introduces random internal
// whitespace artifacts from pdf.js kerning/ligature reconstruction (e.g.
// "E xpected Arrival", "DH Draf t Advice", "At a Gl ance"), so labels have to
// be matched tolerating optional whitespace between every character rather
// than as literal strings.
function fuzzyLabelSource(label) {
  return String(label).split('').map((char) => (
    /\s/.test(char) ? '\\s+' : `${escapeRegExp(char)}\\s*`
  )).join('');
}

function fuzzyLabelValue(text, label) {
  const pattern = new RegExp(`${fuzzyLabelSource(label)}\\s*[:\\-]\\s*([^\\n]+)`, 'i');
  return text.match(pattern)?.[1]?.trim().replace(/\s+/g, ' ') || null;
}

// Anchors a player profile: every profile in the team-by-team section is
// immediately followed by a "(2026: rank|N/A) (2025: rank|N/A)" marker line,
// which is far more reliable than searching the ~230 page document for the
// first substring match of a player's name (that could land on a Top-50
// chart, a "2026 Draftees" list, or another team's roster instead).
const PROSPECT_RANK_PATTERN = /\(\s*20\s*\d\s*\d\s*:\s*(N\s*\/\s*A|\d+)\s*\)\s*\(\s*20\s*\d\s*\d\s*:\s*(N\s*\/\s*A|\d+)\s*\)/i;
// The line directly preceding the rank marker is the player's header, e.g.
// "Bradly Nadeau , C/RW" (goalies and multi-position prospects use the same
// "Name , POS[/POS]" shape).
const PROSPECT_HEADER_PATTERN = /^(.+?)\s*,\s*([A-Za-z]{1,2}(?:\s*\/\s*[A-Za-z]{1,2})*)\s*$/;

const PROSPECT_FIELD_LABELS = ['Upside Comparable', 'Upside', '3YP', 'Fantasy Upside', 'Expected Arrival', 'DH Draft Advice'];

const PROSPECT_ROLE_TAGS = [
  'Top prospect',
  'Boom / Bust potential',
  'Long - term project',
  'Top sniper',
  'Best setup man',
  'Forward',
  'Defense',
  'Goal',
  'Points only',
  'Multicategory',
];

// Each team's "At a Glance" mini-section lists role-tag: player-name pairs
// (two per line); used to populate "Organizational Depth" per prospect.
function extractOrganizationalDepthTags(teamBlockText) {
  const tagsByPlayerKey = {};
  const alternation = PROSPECT_ROLE_TAGS.map(fuzzyLabelSource).join('|');
  const pattern = new RegExp(`(${alternation})\\s*:\\s*([^\\n]+?)(?=\\s*(?:${alternation})\\s*:|\\n|$)`, 'gi');
  let match = pattern.exec(teamBlockText);
  while (match) {
    const label = PROSPECT_ROLE_TAGS.find((tag) => new RegExp(`^${fuzzyLabelSource(tag)}$`, 'i').test(match[1].trim()));
    const key = normalizeLookupKey(match[2]);
    if (label && key) {
      tagsByPlayerKey[key] = [...new Set([...(tagsByPlayerKey[key] || []), label])];
    }
    match = pattern.exec(teamBlockText);
  }
  return tagsByPlayerKey;
}

function bucketProspectTier(grade) {
  if (!Number.isFinite(grade)) return null;
  if (grade <= 25) return 'Elite Prospect';
  if (grade <= 75) return 'Top Prospect';
  if (grade <= 200) return 'Depth Prospect';
  return 'Long Shot';
}

function deriveFantasyTrajectory(grade, priorGrade) {
  if (!Number.isFinite(grade)) return null;
  if (!Number.isFinite(priorGrade)) return 'New to rankings';
  const delta = priorGrade - grade;
  if (delta >= 15) return 'Rising';
  if (delta <= -15) return 'Falling';
  return 'Steady';
}

function parseComparable(rawValue) {
  if (!rawValue) return null;
  const match = rawValue.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
  return match ? { name: match[1].trim(), statLine: match[2].trim() } : { name: rawValue.trim(), statLine: null };
}

// Parses the Dobber Fantasy Prospects Report (a different document from the
// Fantasy Guide): hundreds of team-by-team prospect write-ups, each with a
// write-up paragraph plus labeled Upside/Risk, Readiness, 3YP, Comparable,
// Draft Pedigree, and a "(YYYY: rank)" grade, from which Tier and Fantasy
// Trajectory are derived. The out-of-scope "2026 NHL Draft" prospect class
// section later in the document uses a different write-up format entirely
// (no dual-year rank marker), so it is naturally excluded without needing an
// explicit section boundary.
export function extractDobberProspectMetadata(text) {
  const lines = String(text || '').split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    // Strip the recurring page header/footer banner ("------- Rule Your
    // Pool! -------" and "www.dobberhockey.com Page N of N") so it doesn't
    // bleed into multi-page write-ups.
    .filter((line) => !/rule your pool|dobberhockey\.com\s*page\s*\d+\s*of\s*\d+/i.test(line));
  const metadataByPlayerKey = {};

  const teamBlockStarts = [];
  lines.forEach((line, index) => {
    if (new RegExp(fuzzyLabelSource('At a Glance'), 'i').test(line)) teamBlockStarts.push(index);
  });
  const organizationalDepthByPlayerKey = {};
  teamBlockStarts.forEach((startIndex, teamIndex) => {
    const draftingIndex = lines.findIndex((line, index) => (
      index > startIndex && new RegExp(fuzzyLabelSource('Draftees'), 'i').test(line)
    ));
    const windowEnd = Math.min(
      draftingIndex >= 0 ? draftingIndex + 1 : startIndex + 10,
      teamBlockStarts[teamIndex + 1] ?? lines.length,
    );
    const teamBlockText = lines.slice(startIndex, windowEnd).join('\n');
    Object.entries(extractOrganizationalDepthTags(teamBlockText)).forEach(([key, tags]) => {
      organizationalDepthByPlayerKey[key] = [...new Set([...(organizationalDepthByPlayerKey[key] || []), ...tags])];
    });
  });

  const anchors = [];
  lines.forEach((line, index) => {
    const rankMatch = line.match(PROSPECT_RANK_PATTERN);
    if (!rankMatch) return;
    const headerMatch = (lines[index - 1] || '').match(PROSPECT_HEADER_PATTERN);
    if (!headerMatch) return;
    anchors.push({
      index,
      name: headerMatch[1].trim(),
      position: headerMatch[2].replace(/\s+/g, '') || null,
      grade: /n/i.test(rankMatch[1]) ? null : Number.parseInt(rankMatch[1], 10),
      priorGrade: /n/i.test(rankMatch[2]) ? null : Number.parseInt(rankMatch[2], 10),
    });
  });

  const writeUpEndPattern = new RegExp(PROSPECT_FIELD_LABELS.map(fuzzyLabelSource).join('|'), 'i');
  anchors.forEach((anchor, anchorIndex) => {
    const key = normalizeLookupKey(anchor.name);
    if (!key) return;
    const contextEnd = anchors[anchorIndex + 1]
      ? anchors[anchorIndex + 1].index - 1
      : Math.min(anchor.index + 40, lines.length);
    const context = lines.slice(anchor.index, contextEnd).join('\n');

    const upsideCertaintyMatch = context.match(new RegExp(
      `${fuzzyLabelSource('Fantasy Upside')}\\s*/\\s*${fuzzyLabelSource('NHL Certainty')}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*%\\s*,\\s*(\\d+(?:\\.\\d+)?)\\s*%`,
      'i',
    ));
    const upside = upsideCertaintyMatch ? Number.parseFloat(upsideCertaintyMatch[1]) : null;
    const certainty = upsideCertaintyMatch ? Number.parseFloat(upsideCertaintyMatch[2]) : null;
    const risk = certainty !== null ? Math.round((100 - certainty) * 100) / 100 : null;

    const readiness = fuzzyLabelValue(context, 'Expected Arrival');
    const upsideComparable = fuzzyLabelValue(context, 'Upside Comparable') || fuzzyLabelValue(context, 'Upside');
    const threeYearProjection = fuzzyLabelValue(context, '3YP');
    const draftPedigree = fuzzyLabelValue(context, 'DH Draft Advice');

    const contextLines = lines.slice(anchor.index + 1, contextEnd);
    const writeUpEndOffset = contextLines.findIndex((line) => writeUpEndPattern.test(line));
    const writeUp = (writeUpEndOffset >= 0 ? contextLines.slice(0, writeUpEndOffset) : contextLines)
      .join(' ').trim() || null;

    const organizationalDepth = organizationalDepthByPlayerKey[key]?.length
      ? organizationalDepthByPlayerKey[key]
      : null;

    metadataByPlayerKey[key] = {
      // Legacy fields kept for backward compatibility with existing
      // DraftIQ/forecastedStats consumers.
      upside,
      risk,
      readiness,
      grade: anchor.grade,
      upsideComparable,
      // Expanded Fantasy Prospects Report metadata.
      position: anchor.position,
      priorGrade: anchor.priorGrade,
      tier: bucketProspectTier(anchor.grade),
      fantasyTrajectory: deriveFantasyTrajectory(anchor.grade, anchor.priorGrade),
      threeYearProjection,
      comparable: parseComparable(upsideComparable),
      draftPedigree,
      organizationalDepth,
      writeUp,
    };
  });

  return metadataByPlayerKey;
}

export async function extractPdfText(arrayBuffer, pdfjs) {
  if (!pdfjs?.getDocument) throw new Error('The bundled PDF parser is unavailable.');
  const bytes = new Uint8Array(arrayBuffer);
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
    throw new Error('Dobber PDF download did not return a PDF document.');
  }
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  if (!Number.isInteger(document.numPages) || document.numPages < 1) {
    throw new Error('Dobber PDF does not contain any readable pages.');
  }
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];
    content.items.forEach((item, index) => {
      const text = String(item.str || '').trim();
      if (!text) return;
      const y = Number(item.transform?.[5]);
      const x = Number(item.transform?.[4]);
      const existingLine = Number.isFinite(y)
        ? lines.find((line) => Number.isFinite(line.y) && Math.abs(line.y - y) < 2)
        : null;
      if (existingLine) {
        existingLine.items.push({ x: Number.isFinite(x) ? x : index, text });
      } else {
        lines.push({
          y,
          order: index,
          items: [{ x: Number.isFinite(x) ? x : index, text }],
        });
      }
    });
    pages.push(lines
      .sort((left, right) => (
        Number.isFinite(left.y) && Number.isFinite(right.y)
          ? right.y - left.y || left.order - right.order
          : left.order - right.order
      ))
      .map((line) => line.items.sort((left, right) => left.x - right.x).map((item) => item.text).join(' '))
      .join('\n'));
  }
  return pages.join('\n');
}

export async function ingestDobberPdfFiles(files, playerNames, pdfjs, now = () => new Date()) {
  const selectedFiles = [...(files || [])];
  const fileName = selectedFiles.map((file) => String(file?.name || '')).filter(Boolean).join(', ');
  if (!selectedFiles.length) {
    return {
      status: 'invalid-format',
      fileName,
      lastImport: null,
      warnings: ['Select at least one Dobber PDF file.'],
      playersParsed: 0,
      intelByPlayerKey: {},
      prospectMetadataByPlayerKey: {},
    };
  }

  try {
    const loadedPdfjs = await pdfjs;
    const intelByPlayerKey = {};
    const prospectMetadataByPlayerKey = {};
    for (const file of selectedFiles) {
      const text = await extractPdfText(await file.arrayBuffer(), loadedPdfjs);
      // Route the Fantasy Prospects Report through its own parser (upside,
      // risk, readiness, grade); everything else uses the Fantasy Guide's
      // pedigree/projection-confidence/sleeper/bust extraction.
      if (/prospect/i.test(String(file?.name || ''))) {
        Object.assign(prospectMetadataByPlayerKey, extractDobberProspectMetadata(text));
      } else {
        Object.assign(intelByPlayerKey, extractDobberIntelFromText(text, playerNames));
      }
    }
    const playersParsed = Object.keys(intelByPlayerKey).length + Object.keys(prospectMetadataByPlayerKey).length;
    return {
      status: 'loaded-local',
      fileName,
      lastImport: now().toISOString(),
      warnings: playersParsed ? [] : ['PDFs parsed, but no explicit player intelligence matched the current roster.'],
      playersParsed,
      intelByPlayerKey,
      prospectMetadataByPlayerKey,
    };
  } catch (error) {
    return {
      status: 'invalid-format',
      fileName,
      lastImport: null,
      warnings: [importWarning(error, 'Dobber PDF import failed.')],
      playersParsed: 0,
      intelByPlayerKey: {},
      prospectMetadataByPlayerKey: {},
    };
  }
}

export function updateDobberImportMetadata(metadata, result, attemptedAt = new Date().toISOString()) {
  const current = metadata || {};
  return {
    ...current,
    lastAttempt: {
      status: result.status,
      fileName: result.fileName,
      attemptedAt,
      warnings: result.warnings,
    },
    ...(result.status === 'loaded-local' ? {
      status: 'loaded-local',
      sourceType: 'local',
      sourceName: result.fileName,
      importedAt: result.lastImport,
      lastImport: result.lastImport,
      records: result.playersParsed,
      warnings: result.warnings,
    } : {}),
  };
}

export async function fetchDobberPdfIntel(playerNames, fetchImpl = globalThis.fetch, pdfjs) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable for Dobber PDFs.');
  const guideResponse = await fetchImpl(DOBBER_GUIDE_PDF_URL, { cache: 'no-store', credentials: 'omit' });
  if (!guideResponse?.ok) {
    throw new Error(`Dobber Fantasy Guide PDF fetch failed (HTTP ${guideResponse?.status || 'unknown'}).`);
  }
  const guideText = await extractPdfText(await guideResponse.arrayBuffer(), pdfjs);
  const intelByPlayerKey = extractDobberIntelFromText(guideText, playerNames);

  const prospectsResponse = await fetchImpl(DOBBER_PROSPECTS_PDF_URL, { cache: 'no-store', credentials: 'omit' });
  if (!prospectsResponse?.ok) {
    throw new Error(`Dobber Fantasy Prospects Report PDF fetch failed (HTTP ${prospectsResponse?.status || 'unknown'}).`);
  }
  const prospectsText = await extractPdfText(await prospectsResponse.arrayBuffer(), pdfjs);
  const prospectMetadataByPlayerKey = extractDobberProspectMetadata(prospectsText);

  return { intelByPlayerKey, prospectMetadataByPlayerKey };
}

export function attachDobberIntel(players, intelByPlayerKey, prospectMetadataByPlayerKey = {}) {
  return Object.fromEntries(Object.entries(players || {}).map(([playerKey, player]) => [
    playerKey,
    {
      ...player,
      intelEdge: intelByPlayerKey?.[playerKey] || null,
      prospectMetadata: prospectMetadataByPlayerKey?.[playerKey] || null,
    },
  ]));
}

function eligiblePositions(player) {
  return String(player.finalPosition || player.ahlPosition || player.position || '')
    .split(/[\/,\s]+/)
    .map((position) => position.trim().toUpperCase())
    .filter(Boolean);
}

function priceCurveFactor(percentile) {
  if (percentile <= 0.05) return 5;
  if (percentile <= 0.15) return 3;
  if (percentile <= 0.65) return 1.2;
  return 0.3;
}

function buildScarcity(players, rosterRecords) {
  const rosterSlotsByPosition = {};
  const playersByKey = new Map(players.map((player) => [normalizeLookupKey(player.name), player]));
  Object.values(rosterRecords || {}).forEach((record) => {
    if (!record?.owner) return;
    const player = playersByKey.get(normalizeLookupKey(record.name));
    const position = String(player?.ahlPosition || record.position || record.poolposition || '').toUpperCase();
    if (!position || position === 'G') return;
    rosterSlotsByPosition[position] = (rosterSlotsByPosition[position] || 0) + 1;
  });

  const replacementLevelByPosition = {};
  const viablePlayersByPosition = {};
  Object.entries(rosterSlotsByPosition).forEach(([position, slots]) => {
    const candidates = players
      .filter((player) => player.available && Number.isFinite(player.adjustedDraftIQ) && eligiblePositions(player).includes(position))
      .sort((left, right) => right.adjustedDraftIQ - left.adjustedDraftIQ);
    if (!candidates.length) return;
    const replacementIndex = Math.min(candidates.length, Math.max(1, slots)) - 1;
    const replacementLevel = candidates[replacementIndex].adjustedDraftIQ;
    replacementLevelByPosition[position] = replacementLevel;
    viablePlayersByPosition[position] = candidates.filter((player) => player.adjustedDraftIQ >= replacementLevel).length;
  });

  const indexes = Object.entries(rosterSlotsByPosition).flatMap(([position, slots]) => {
    const viable = viablePlayersByPosition[position];
    return slots > 0 && viable > 0 ? [slots / viable] : [];
  });
  const maxIndex = indexes.length ? Math.max(...indexes) : null;
  return {
    rosterSlotsByPosition,
    replacementLevelByPosition,
    viablePlayersByPosition,
    maxIndex,
  };
}

function mergeIntelStrengths(player, dobber) {
  const strengths = (player.strengths || []).filter((entry) => !String(entry).startsWith('Dobber '));
  const risks = (player.risks || []).filter((entry) => !String(entry).startsWith('Dobber '));
  if (dobber.intelEdge?.pedigree) strengths.push(`Dobber pedigree: ${dobber.intelEdge.pedigree}`);
  if (dobber.intelEdge?.sleeperTag) strengths.push('Dobber sleeper tag');
  if (dobber.intelEdge?.bustTag) risks.push('Dobber bust tag');
  dobber.riskFlags.forEach((risk) => risks.push(`Dobber risk: ${risk}`));
  if (dobber.pricingMethod === 'derived') {
    strengths.push('Dobber pricing estimated from Rank/Upside/3YP (explicit BPS/KVS/PPS/RSS/RRS columns unavailable)');
  }
  const prospect = dobber.prospectMetadata;
  if (prospect?.draftPedigree) strengths.push(`Dobber prospect pedigree: ${prospect.draftPedigree}`);
  if (prospect?.tier) strengths.push(`Dobber prospect tier: ${prospect.tier}`);
  if (prospect?.fantasyTrajectory === 'Rising') strengths.push('Dobber prospect trending up');
  if (prospect?.fantasyTrajectory === 'Falling') risks.push('Dobber prospect trending down');
  if (Number.isFinite(prospect?.risk) && prospect.risk >= 70) risks.push(`Dobber prospect risk: ${prospect.risk}%`);
  return {
    strengths: [...new Set(strengths)],
    risks: [...new Set(risks)],
  };
}

export function applyDobberIntelligence(outputs, stateObj, beforePricing = (players) => players) {
  const dobberPlayers = stateObj?.datasets?.dobber?.players || {};
  const intelByPlayerKey = stateObj?.datasets?.dobber?.intelByPlayerKey || {};
  const hasExcel = stateObj?.metadata?.dobberExcel?.status === 'loaded-local';
  const hasPdfs = stateObj?.metadata?.dobberPdfs?.status === 'loaded-local';
  const ingestedPlayers = (outputs.players.players || []).map((sourcePlayer) => {
    const player = JSON.parse(JSON.stringify(sourcePlayer));
    const key = normalizeLookupKey(player.name);
    const dobber = dobberPlayers[key];
    const intelEdge = intelByPlayerKey[key] || dobber?.intelEdge || null;
    player.sourcesUsed = {
      ...(player.sourcesUsed || {}),
      DobberExcel: Boolean(dobber),
      DobberPDFs: Boolean(intelEdge),
    };
    player.missingSources = { ...(player.missingSources || {}) };

    if (!dobber) {
      player.nhlPosition = null;
      player.salary = null;
      player.aav = null;
      player.intelEdge = intelEdge;
      player.production = { ...(player.production || {}), PPS: null };
      player.deployment = { ...(player.deployment || {}), RSS: null, RRS: null };
      player.prospect = { ...(player.prospect || {}), BPS: null, KVS: null };
      player.keeper = { ...(player.keeper || {}), KVS: null, categoryMultiplier: null };
      const pdfInsight = mergeIntelStrengths(player, { intelEdge, riskFlags: [] });
      player.strengths = pdfInsight.strengths;
      player.risks = pdfInsight.risks;
      player.draftIQ = null;
      player.adjustedDraftIQ = null;
      player.scarcityMultiplier = null;
      player.keeperInflation = null;
      player.priceCurveFactor = null;
      player.auctionValue = null;
      player.recommendedMaxBid = null;
      player.recommendedMaxBidByOwner = {};
      player.tier = null;
      player.classification = 'UNPRICED';
      player.valuationStatus = 'unpriced';
      player.missingSources[hasExcel ? 'DobberExcel player match' : 'DobberExcel'] = true;
      player.dobberRole = null;
      player.dobberTier = null;
      player.dobberRookie = null;
      player.pricingMethod = 'unavailable';
      player.prospectMetadata = null;
      return applyForecastedStats(player, null);
    }

    player.nhlPosition = dobber.nhlPos;
    player.salary = dobber.salary;
    player.aav = dobber.aav;
    player.dobberProjections = dobber.projections;
    player.dobberRiskFlags = dobber.riskFlags;
    player.dobberRole = dobber.role ?? null;
    player.dobberTier = dobber.tier ?? null;
    player.dobberRookie = typeof dobber.rookie === 'boolean' ? dobber.rookie : null;
    player.pricingMethod = dobber.pricingMethod ?? 'unavailable';
    player.prospectMetadata = dobber.prospectMetadata ?? null;
    player.intelEdge = intelEdge;
    player.production = { ...(player.production || {}), PPS: dobber.pps };
    player.deployment = { ...(player.deployment || {}), RSS: dobber.rss, RRS: dobber.rrs };
    player.prospect = { ...(player.prospect || {}), BPS: dobber.bps, KVS: dobber.kvs };
    player.keeper = { ...(player.keeper || {}), KVS: dobber.kvs };
    player.draftIQ = null;
    player.adjustedDraftIQ = null;
    player.scarcityIndex = null;
    player.scarcityMultiplier = null;
    player.keeperInflation = null;
    player.priceCurveRank = null;
    player.priceCurvePercentile = null;
    player.priceCurveFactor = null;
    player.auctionValue = null;
    player.recommendedMaxBid = null;
    player.recommendedMaxBidByOwner = {};
    player.tier = null;
    player.classification = 'UNPRICED';
    player.valuationStatus = 'unpriced';
    const insight = mergeIntelStrengths(player, { ...dobber, intelEdge });
    player.strengths = insight.strengths;
    player.risks = insight.risks;
    delete player.missingSources.DobberExcel;
    delete player.missingSources['AHLSheets metric inputs'];
    ['PPS', 'RSS', 'RRS'].forEach((metric) => {
      if (!Number.isFinite(dobber[metric.toLowerCase()])) {
        player.missingSources[`Dobber projection ${metric}`] = true;
      }
    });
    return applyForecastedStats(player, dobber.forecastProjections || dobber.projections, {
      threeYearPoints: dobber.threeYearPoints,
      upside: dobber.upside,
    });
  });

  const stagedPlayers = beforePricing(ingestedPlayers);
  if (!Array.isArray(stagedPlayers)) {
    throw new Error('The pre-pricing Dobber overlay must return a player array.');
  }
  const players = stagedPlayers;
  players.forEach((player) => {
    if (player.status === 'not-in-ahl') return;
    const dobber = dobberPlayers[normalizeLookupKey(player.name)];
    if (!dobber) return;
    const scores = calculateDraftIqScores({
      category: player.category,
      PPS: dobber.pps,
      RSS: dobber.rss,
      BPS: dobber.bps,
      RRS: dobber.rrs,
      KVS: dobber.kvs,
    });
    player.draftIQ = scores.draftIQ;
    player.adjustedDraftIQ = scores.adjustedDraftIQ;
    player.keeper.categoryMultiplier = scores.categoryMultiplier;
    if (scores.adjustedDraftIQ === null) {
      player.scarcityMultiplier = null;
      player.keeperInflation = null;
      player.priceCurveFactor = null;
      player.auctionValue = null;
      player.recommendedMaxBid = null;
      player.tier = null;
      player.classification = 'UNPRICED';
      player.valuationStatus = 'unpriced';
    }
  });

  const scarcity = buildScarcity(players, stateObj?.datasets?.roster?.players);
  const rankedPlayers = players
    .filter((player) => Number.isFinite(player.adjustedDraftIQ))
    .sort((left, right) => right.adjustedDraftIQ - left.adjustedDraftIQ || left.name.localeCompare(right.name));
  rankedPlayers.forEach((player, index) => {
    const positions = eligiblePositions(player);
    const positionIndexes = positions.flatMap((position) => {
      const slots = scarcity.rosterSlotsByPosition[position];
      const viable = scarcity.viablePlayersByPosition[position];
      return slots > 0 && viable > 0 ? [slots / viable] : [];
    });
    const scarcityIndex = positionIndexes.length ? Math.max(...positionIndexes) : null;
    const scarcityMultiplier = scarcityIndex !== null && scarcity.maxIndex > 0
      ? 1 + ((scarcityIndex / scarcity.maxIndex) * 0.2)
      : null;
    const keeperInflation = Number.isFinite(player.keeper?.KVS)
      ? 1 + ((player.keeper.KVS / 100) * 0.08)
      : null;
    const rank = index + 1;
    const percentile = rank / rankedPlayers.length;
    const curve = priceCurveFactor(percentile);
    const auctionValue = calculateAuctionValue(player.adjustedDraftIQ, scarcityMultiplier, keeperInflation, curve);
    Object.assign(player, {
      scarcityIndex,
      scarcityMultiplier,
      keeperInflation,
      priceCurveRank: rank,
      priceCurvePercentile: percentile,
      priceCurveFactor: curve,
      auctionValue,
      tier: getTier(auctionValue),
    });
    player.classification = getClassification({
      auctionValue,
      tier: player.tier,
      regressionRisk: player.deployment?.RRS ?? null,
      usageDrop: player.deployment?.usageDrop ?? null,
      ageDecline: player.deployment?.ageDecline ?? null,
    });
    player.valuationStatus = auctionValue === null ? 'unpriced' : 'priced';
    if (scarcityMultiplier === null) player.missingSources['AHL position scarcity inputs'] = true;
    else delete player.missingSources['Position scarcity rules'];
  });

  const budgets = stateObj?.datasets?.budget?.teamBudgets
    || stateObj?.datasets?.roster?.teamBudgets
    || [];
  players.forEach((player) => {
    player.recommendedMaxBidByOwner = Object.fromEntries(budgets.map((budget) => [
      budget.team,
      calculateRecommendedMaxBid(player.auctionValue, player.tier, budget.remainingBudget, budget.openSlots),
    ]));
    player.recommendedMaxBid = null;
    if (!budgets.length) player.missingSources['Team budget and open slots'] = true;
    else delete player.missingSources['Team budget and open slots'];
    player.missingSourceList = Object.keys(player.missingSources);
  });

  const sourceAvailability = {
    ...(outputs.players.sourceAvailability || {}),
    DobberExcel: hasExcel,
    DobberPDFs: hasPdfs,
  };
  const missingSources = (outputs.players.sourceCoverage?.missingSources || [])
    .filter((source) => !(hasExcel && String(source).startsWith('Dobber Excel')))
    .filter((source) => !(rankedPlayers.length && String(source).startsWith('Position-specific')));
  if (!hasExcel && !missingSources.includes('Dobber Excel NHL-position and scoring inputs')) {
    missingSources.push('Dobber Excel NHL-position and scoring inputs');
  }
  if (!hasPdfs) missingSources.push('Dobber PDF intelligence inputs');
  const sourceCoverage = {
    ...(outputs.players.sourceCoverage || {}),
    missingSources: [...new Set(missingSources)],
    dobberExcel: {
      status: hasExcel ? 'loaded-local' : 'unavailable',
      playerRecords: Object.keys(dobberPlayers).length,
      matchedPlayers: players.filter((player) => dobberPlayers[normalizeLookupKey(player.name)]).length,
      importedAt: stateObj?.metadata?.dobberExcel?.importedAt || null,
      error: stateObj?.metadata?.dobberExcel?.error || null,
    },
    dobberPdfs: {
      status: hasPdfs ? 'loaded-local' : 'unavailable',
      matchedPlayers: Object.keys(intelByPlayerKey).length,
      importedAt: stateObj?.metadata?.dobberPdfs?.importedAt || null,
      error: stateObj?.metadata?.dobberPdfs?.error || null,
    },
    scarcity: {
      model: 'Observed AHL-position roster distribution; Utility eligibility uses the highest eligible scarcity; viable pool is at or above replacement-level DraftIQ.',
      ...scarcity,
    },
  };
  const auctionPlayers = players.map((player) => ({
    id: player.id,
    name: player.name,
    finalPosition: player.finalPosition,
    nhlPosition: player.nhlPosition,
    draftIQ: player.draftIQ,
    adjustedDraftIQ: player.adjustedDraftIQ,
    scarcityMultiplier: player.scarcityMultiplier,
    keeperInflation: player.keeperInflation,
    priceCurveFactor: player.priceCurveFactor,
    auctionValue: player.auctionValue,
    recommendedMaxBid: player.recommendedMaxBid,
    recommendedMaxBidByOwner: player.recommendedMaxBidByOwner,
    tier: player.tier,
    classification: player.classification,
    status: player.valuationStatus,
  }));
  const unpricedPlayerIds = players.filter((player) => player.auctionValue === null).map((player) => player.id);
  const tiers = Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [
    tier,
    players.filter((player) => player.tier === tier).map((player) => player.id),
  ]));
  return {
    ...outputs,
    players: { ...outputs.players, sourceAvailability, sourceCoverage, players },
    auction: {
      ...outputs.auction,
      sourceAvailability,
      sourceCoverage,
      rosterSlotsByPosition: scarcity.rosterSlotsByPosition,
      viablePlayersByPosition: scarcity.viablePlayersByPosition,
      replacementLevelByPosition: scarcity.replacementLevelByPosition,
      pricedPlayerCount: players.length - unpricedPlayerIds.length,
      rankedPlayerCount: rankedPlayers.length,
      unpricedPlayerCount: unpricedPlayerIds.length,
      unpricedPlayerIds,
      players: auctionPlayers,
    },
    tiers: { ...outputs.tiers, sourceAvailability, tiers, unpricedPlayerIds },
    keepers: { ...outputs.keepers, sourceAvailability, sourceCoverage },
    prospects: { ...outputs.prospects, sourceAvailability, sourceCoverage },
  };
}
