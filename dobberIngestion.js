import { normalizeLookupKey } from './liveNhlApi.js';
import {
  calculateAuctionValue,
  calculateDraftIqScores,
  calculateRecommendedMaxBid,
  getClassification,
  getTier,
} from './draftIntelligence.js';

export const DOBBER_EXCEL_URL = 'https://1drv.ms/x/c/d5c20aec41fd94c9/IQAIOux0Ws0PQ7uFczW2NrY5AdqEr4m82jcnO3Oi-4Eyqhc?e=FFjnys';
export const DOBBER_PDF_URLS = Object.freeze([
  'https://1drv.ms/b/c/d5c20aec41fd94c9/IQC073E-MAYFQISHT8WKxjzLAVV-9hbimmd0Su7D-QFpxQw?e=zBICDA',
  'https://1drv.ms/b/c/d5c20aec41fd94c9/IQAoEX64NJBGR5HB4bx0eWlwASSfBLCuHPMREE2ey0_7beo?e=vp92Aj',
]);
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

function normalizeScore(value, label, { blankAsZero = false } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return blankAsZero ? 0 : null;
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

function parseRiskFlags(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value || '').split(/[;,|]/).map((entry) => entry.trim()).filter(Boolean);
}

export function normalizeDobberRows(rows) {
  const players = {};
  (rows || []).forEach((row, index) => {
    const player = String(readField(row, 'Player') || '').trim();
    if (!player) return;
    const playerKey = normalizeLookupKey(player);
    if (!playerKey) return;
    if (players[playerKey]) {
      throw new Error(`Dobber workbook contains duplicate player rows for ${player}.`);
    }
    const projections = parseProjectionPayload(readField(row, 'Projections'));
    players[playerKey] = {
      player,
      team: String(readField(row, 'Team') || '').trim().toUpperCase(),
      nhlPos: String(readField(row, 'POS') || '').trim().toUpperCase() || null,
      salary: parseOptionalNumber(readField(row, 'Salary')),
      aav: parseOptionalNumber(readField(row, 'AAV')),
      bps: normalizeScore(readField(row, 'BPS'), `${player}.BPS`, { blankAsZero: true }),
      kvs: normalizeScore(readField(row, 'KVS'), `${player}.KVS`, { blankAsZero: true }),
      pps: projectionScore(row, projections, 'PPS'),
      rss: projectionScore(row, projections, 'RSS'),
      rrs: projectionScore(row, projections, 'RRS'),
      projections,
      riskFlags: parseRiskFlags(readField(row, 'RiskFlags')),
      intelEdge: null,
      sourceRow: index + 2,
    };
  });
  if (!Object.keys(players).length) {
    throw new Error(`Dobber sheet "${DOBBER_SKATER_SHEET}" contains no player rows.`);
  }
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
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
  return normalizeDobberRows(rows);
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

export async function extractPdfText(arrayBuffer, pdfjs) {
  if (!pdfjs?.getDocument) throw new Error('The bundled PDF parser is unavailable.');
  const bytes = new Uint8Array(arrayBuffer);
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') {
    throw new Error('Dobber PDF download did not return a PDF document.');
  }
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(' '));
  }
  return pages.join('\n');
}

export async function fetchDobberPdfIntel(playerNames, fetchImpl = globalThis.fetch, pdfjs) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable for Dobber PDFs.');
  const texts = [];
  for (const url of DOBBER_PDF_URLS) {
    const response = await fetchImpl(url, { cache: 'no-store', credentials: 'omit' });
    if (!response?.ok) {
      throw new Error(`Dobber PDF fetch failed (HTTP ${response?.status || 'unknown'}).`);
    }
    texts.push(await extractPdfText(await response.arrayBuffer(), pdfjs));
  }
  return extractDobberIntelFromText(texts.join('\n'), playerNames);
}

export function attachDobberIntel(players, intelByPlayerKey) {
  return Object.fromEntries(Object.entries(players || {}).map(([playerKey, player]) => [
    playerKey,
    {
      ...player,
      intelEdge: intelByPlayerKey?.[playerKey] || null,
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
  return {
    strengths: [...new Set(strengths)],
    risks: [...new Set(risks)],
  };
}

export function applyDobberIntelligence(outputs, stateObj) {
  const dobberPlayers = stateObj?.datasets?.dobber?.players || {};
  const intelByPlayerKey = stateObj?.datasets?.dobber?.intelByPlayerKey || {};
  const hasExcel = stateObj?.metadata?.dobberExcel?.status === 'loaded-local';
  const hasPdfs = stateObj?.metadata?.dobberPdfs?.status === 'loaded-local';
  const players = (outputs.players.players || []).map((sourcePlayer) => {
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
      return player;
    }

    player.nhlPosition = dobber.nhlPos;
    player.salary = dobber.salary;
    player.aav = dobber.aav;
    player.dobberProjections = dobber.projections;
    player.dobberRiskFlags = dobber.riskFlags;
    player.intelEdge = intelEdge;
    player.production = { ...(player.production || {}), PPS: dobber.pps };
    player.deployment = { ...(player.deployment || {}), RSS: dobber.rss, RRS: dobber.rrs };
    player.prospect = { ...(player.prospect || {}), BPS: dobber.bps, KVS: dobber.kvs };
    player.keeper = { ...(player.keeper || {}), KVS: dobber.kvs };
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
    return player;
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
