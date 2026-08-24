import { parseProspects } from './prospectParser.js';
import { parseVeterans } from './veteranParser.js';

const STORAGE_KEY = 'hockey-dashboard-owner-view';
const MAX_PREVIEW_ROWS = 10;

const GAMES_PLAYED_BULATOR_DATA = {
  'Anaheim Ducks': { teamName: 'Anaheim Ducks', firstHalfEligibleGames: 28, secondHalfEligibleGames: 24, totalEligibleGames: 52 },
  'Boston Bruins': { teamName: 'Boston Bruins', firstHalfEligibleGames: 28, secondHalfEligibleGames: 39, totalEligibleGames: 67 },
  'Buffalo Sabres': { teamName: 'Buffalo Sabres', firstHalfEligibleGames: 33, secondHalfEligibleGames: 28, totalEligibleGames: 61 },
  'Calgary Flames': { teamName: 'Calgary Flames', firstHalfEligibleGames: 29, secondHalfEligibleGames: 28, totalEligibleGames: 57 },
  'Carolina Hurricanes': { teamName: 'Carolina Hurricanes', firstHalfEligibleGames: 29, secondHalfEligibleGames: 34, totalEligibleGames: 63 },
  'Chicago Blackhawks': { teamName: 'Chicago Blackhawks', firstHalfEligibleGames: 30, secondHalfEligibleGames: 25, totalEligibleGames: 55 },
  'Colorado Avalanche': { teamName: 'Colorado Avalanche', firstHalfEligibleGames: 33, secondHalfEligibleGames: 32, totalEligibleGames: 65 },
  'Columbus Blue Jackets': { teamName: 'Columbus Blue Jackets', firstHalfEligibleGames: 33, secondHalfEligibleGames: 32, totalEligibleGames: 65 },
  'Dallas Stars': { teamName: 'Dallas Stars', firstHalfEligibleGames: 33, secondHalfEligibleGames: 35, totalEligibleGames: 68 },
  'Detroit Red Wings': { teamName: 'Detroit Red Wings', firstHalfEligibleGames: 30, secondHalfEligibleGames: 31, totalEligibleGames: 61 },
  'Edmonton Oilers': { teamName: 'Edmonton Oilers', firstHalfEligibleGames: 33, secondHalfEligibleGames: 34, totalEligibleGames: 67 },
  'Florida Panthers': { teamName: 'Florida Panthers', firstHalfEligibleGames: 31, secondHalfEligibleGames: 32, totalEligibleGames: 63 },
  'Los Angeles Kings': { teamName: 'Los Angeles Kings', firstHalfEligibleGames: 29, secondHalfEligibleGames: 31, totalEligibleGames: 60 },
  'Minnesota Wild': { teamName: 'Minnesota Wild', firstHalfEligibleGames: 31, secondHalfEligibleGames: 36, totalEligibleGames: 67 },
  'Montreal Canadiens': { teamName: 'Montreal Canadiens', firstHalfEligibleGames: 32, secondHalfEligibleGames: 36, totalEligibleGames: 68 },
  'Nashville Predators': { teamName: 'Nashville Predators', firstHalfEligibleGames: 34, secondHalfEligibleGames: 35, totalEligibleGames: 69 },
  'New Jersey Devils': { teamName: 'New Jersey Devils', firstHalfEligibleGames: 32, secondHalfEligibleGames: 28, totalEligibleGames: 60 },
  'New York Islanders': { teamName: 'New York Islanders', firstHalfEligibleGames: 32, secondHalfEligibleGames: 30, totalEligibleGames: 62 },
  'New York Rangers': { teamName: 'New York Rangers', firstHalfEligibleGames: 31, secondHalfEligibleGames: 30, totalEligibleGames: 61 },
  'Ottawa Senators': { teamName: 'Ottawa Senators', firstHalfEligibleGames: 31, secondHalfEligibleGames: 31, totalEligibleGames: 62 },
  'Philadelphia Flyers': { teamName: 'Philadelphia Flyers', firstHalfEligibleGames: 30, secondHalfEligibleGames: 31, totalEligibleGames: 61 },
  'Pittsburgh Penguins': { teamName: 'Pittsburgh Penguins', firstHalfEligibleGames: 29, secondHalfEligibleGames: 29, totalEligibleGames: 58 },
  'San Jose Sharks': { teamName: 'San Jose Sharks', firstHalfEligibleGames: 29, secondHalfEligibleGames: 31, totalEligibleGames: 60 },
  'Seattle Kraken': { teamName: 'Seattle Kraken', firstHalfEligibleGames: 27, secondHalfEligibleGames: 32, totalEligibleGames: 59 },
  'St. Louis Blues': { teamName: 'St. Louis Blues', firstHalfEligibleGames: 31, secondHalfEligibleGames: 31, totalEligibleGames: 62 },
  'Tampa Bay Lightning': { teamName: 'Tampa Bay Lightning', firstHalfEligibleGames: 32, secondHalfEligibleGames: 35, totalEligibleGames: 67 },
  'Toronto Maple Leafs': { teamName: 'Toronto Maple Leafs', firstHalfEligibleGames: 33, secondHalfEligibleGames: 28, totalEligibleGames: 61 },
  'Utah Hockey Club': { teamName: 'Utah Hockey Club', firstHalfEligibleGames: 26, secondHalfEligibleGames: 29, totalEligibleGames: 55 },
  'Vancouver Canucks': { teamName: 'Vancouver Canucks', firstHalfEligibleGames: 29, secondHalfEligibleGames: 28, totalEligibleGames: 57 },
  'Vegas Golden Knights': { teamName: 'Vegas Golden Knights', firstHalfEligibleGames: 31, secondHalfEligibleGames: 31, totalEligibleGames: 62 },
  'Washington Capitals': { teamName: 'Washington Capitals', firstHalfEligibleGames: 29, secondHalfEligibleGames: 34, totalEligibleGames: 63 },
  'Winnipeg Jets': { teamName: 'Winnipeg Jets', firstHalfEligibleGames: 31, secondHalfEligibleGames: 30, totalEligibleGames: 61 },
};

const TEAM_ABBREVIATION_TO_NAME = {
  ANA: 'Anaheim Ducks',
  BOS: 'Boston Bruins',
  BUF: 'Buffalo Sabres',
  CGY: 'Calgary Flames',
  CAR: 'Carolina Hurricanes',
  CHI: 'Chicago Blackhawks',
  COL: 'Colorado Avalanche',
  CBJ: 'Columbus Blue Jackets',
  DAL: 'Dallas Stars',
  DET: 'Detroit Red Wings',
  EDM: 'Edmonton Oilers',
  FLO: 'Florida Panthers',
  FLA: 'Florida Panthers',
  CBS: 'Columbus Blue Jackets',
  LA: 'Los Angeles Kings',
  LAK: 'Los Angeles Kings',
  MIN: 'Minnesota Wild',
  MTL: 'Montreal Canadiens',
  NSH: 'Nashville Predators',
  NJ: 'New Jersey Devils',
  NJD: 'New Jersey Devils',
  NYI: 'New York Islanders',
  NYR: 'New York Rangers',
  OTT: 'Ottawa Senators',
  PHI: 'Philadelphia Flyers',
  PIT: 'Pittsburgh Penguins',
  SJ: 'San Jose Sharks',
  SJS: 'San Jose Sharks',
  SEA: 'Seattle Kraken',
  STL: 'St. Louis Blues',
  TBL: 'Tampa Bay Lightning',
  TOR: 'Toronto Maple Leafs',
  UTA: 'Utah Hockey Club',
  VAN: 'Vancouver Canucks',
  VGK: 'Vegas Golden Knights',
  WSH: 'Washington Capitals',
  WIN: 'Winnipeg Jets',
  WPG: 'Winnipeg Jets',
};

const TEAM_SCHEDULE_ALIASES = {
  anaheim: 'Anaheim Ducks',
  'anaheim ducks': 'Anaheim Ducks',
  boston: 'Boston Bruins',
  'boston bruins': 'Boston Bruins',
  buffalo: 'Buffalo Sabres',
  'buffalo sabres': 'Buffalo Sabres',
  calgary: 'Calgary Flames',
  'calgary flames': 'Calgary Flames',
  carolina: 'Carolina Hurricanes',
  'carolina hurricanes': 'Carolina Hurricanes',
  chicago: 'Chicago Blackhawks',
  'chicago blackhawks': 'Chicago Blackhawks',
  colorado: 'Colorado Avalanche',
  'colorado avalanche': 'Colorado Avalanche',
  columbus: 'Columbus Blue Jackets',
  'columbus blue jackets': 'Columbus Blue Jackets',
  dallas: 'Dallas Stars',
  'dallas stars': 'Dallas Stars',
  detroit: 'Detroit Red Wings',
  'detroit red wings': 'Detroit Red Wings',
  edmonton: 'Edmonton Oilers',
  'edmonton oilers': 'Edmonton Oilers',
  florida: 'Florida Panthers',
  'florida panthers': 'Florida Panthers',
  'los angeles': 'Los Angeles Kings',
  'los angeles kings': 'Los Angeles Kings',
  minnesota: 'Minnesota Wild',
  'minnesota wild': 'Minnesota Wild',
  montreal: 'Montreal Canadiens',
  'montreal canadiens': 'Montreal Canadiens',
  nashville: 'Nashville Predators',
  'nashville predators': 'Nashville Predators',
  'new jersey': 'New Jersey Devils',
  'new jersey devils': 'New Jersey Devils',
  'ny islanders': 'New York Islanders',
  'new york islanders': 'New York Islanders',
  'ny rangers': 'New York Rangers',
  'new york rangers': 'New York Rangers',
  ottawa: 'Ottawa Senators',
  'ottawa senators': 'Ottawa Senators',
  phila: 'Philadelphia Flyers',
  philad: 'Philadelphia Flyers',
  'philadelphia flyers': 'Philadelphia Flyers',
  pittsburgh: 'Pittsburgh Penguins',
  'pittsburgh penguins': 'Pittsburgh Penguins',
  'san jose': 'San Jose Sharks',
  'san jose sharks': 'San Jose Sharks',
  seattle: 'Seattle Kraken',
  'seattle kraken': 'Seattle Kraken',
  'st louis': 'St. Louis Blues',
  'st. louis': 'St. Louis Blues',
  'st. louis blues': 'St. Louis Blues',
  'tampa bay': 'Tampa Bay Lightning',
  'tampa bay lightning': 'Tampa Bay Lightning',
  toronto: 'Toronto Maple Leafs',
  'toronto maple leafs': 'Toronto Maple Leafs',
  utah: 'Utah Hockey Club',
  'utah hockey club': 'Utah Hockey Club',
  vancouver: 'Vancouver Canucks',
  'vancouver canucks': 'Vancouver Canucks',
  vegas: 'Vegas Golden Knights',
  'vegas golden knights': 'Vegas Golden Knights',
  washington: 'Washington Capitals',
  'washington capitals': 'Washington Capitals',
  winnipeg: 'Winnipeg Jets',
  'winnipeg jets': 'Winnipeg Jets',
};

const PLAYER_REFERENCE_FALLBACK = {
  'brayden tracy': 'ANA',
  'john beecher': 'BOS',
  'jacob perreault': 'ANA',
  'ryan nugent-hopkins': 'EDM',
  'pavel buchnevich': 'STL',
  'pierre-luc dubois': 'WSH',
  'steven stamkos': 'NSH',
  'mikael granlund': 'ANA',
  'mika zibanejad': 'NYR',
  'sam bennett': 'FLA',
  'tyler seguin': 'DAL',
  'matt barzal': 'NYI',
  'david pastrnak': 'BOS',
  'connor mcdavid': 'EDM',
  'nikita kucherov': 'TBL',
  'nathan mackinnon': 'COL',
  'kyle connor': 'WPG',
};

const PLAYER_ALIAS_REGISTRY = {
  'zane parekh': ['zayne parekh'],
  'zayne parekh': ['zane parekh'],
  'berkly catton': ['berkley catton'],
  'berkley catton': ['berkly catton'],
  'axel sandin pellikka': ['axel sandin pellikka', 'axel sandin pelikka', 'a sandin pel'],
  'axel sandin pelikka': ['axel sandin pellikka', 'axel sandin pellikka', 'a sandin pel'],
  'a sandin pel': ['axel sandin pellikka', 'axel sandin pelikka'],
  'andrew cristall': ['a cristall', 'cristall'],
  'a cristall': ['andrew cristall', 'cristall'],
  'cristall': ['andrew cristall', 'a cristall'],
};

const PLAYER_MANUAL_OVERRIDES_KEY = 'hockey-dashboard-player-overrides';
const HISTORICAL_SOURCE_FILES = [
  'Data/Historical/skaters_2008_to_2024.csv',
  'Data/Historical/skaters 2025 to 2026.csv',
];

const state = {
  importedData: null,
  selectedOwner: null,
  selectedHistoricalPlayer: null,
  previewRows: [],
  ownerSearch: '',
  playerSearch: '',
  currentView: 'owner',
  prospectFilters: {
    owner: 'all',
    farm: 'all',
    matchingRights: 'all',
    draftYear: 'all',
    costMin: '',
    costMax: '',
    search: '',
  },
  playerReferenceLookup: null,
  playerPositionLookup: null,
  historicalLookup: null,
  historicalRecords: null,
  playerManualOverrides: {},
  manualOverrideDraft: {
    source: '',
    target: '',
  },
  playerAliasRegistry: PLAYER_ALIAS_REGISTRY,
};

function createDefaultProspectFilters() {
  return {
   owner: 'all',
   farm: 'all',
   matchingRights: 'all',
   draftYear: 'all',
   costMin: '',
   costMax: '',
   search: '',
  };
}

function hasAnyDatasetLoaded(unifiedState) {
  return ['prospects', 'veterans', 'roster', 'transactions'].some((key) => unifiedState?.metadata?.[key]?.status === 'ok');
}

function getProspectRecordsFromState(unifiedState) {
  return getEnrichedProspects(unifiedState);
}

function normalizeProspectCost(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getProspectOwnerOptions(prospects) {
  return [...new Set(prospects.map((player) => player.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function getProspectDraftYearOptions(prospects) {
  return [...new Set(prospects
   .map((player) => Number(player.draftYear))
   .filter((year) => Number.isFinite(year)))].sort((a, b) => b - a);
}

function normalizeLeagueKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[&/._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizePlayerName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.&/\\-]+/g, ' ')
    .replace(/\bjr\b/g, '')
    .replace(/\bii\b|\biii\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePositionToken(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized || normalized === 'X') return null;
  if (['L', 'LW', 'LEFT', 'LEFTWING', 'LEFT WING'].includes(normalized)) return 'LW';
  if (['R', 'RW', 'RIGHT', 'RIGHTWING', 'RIGHT WING'].includes(normalized)) return 'RW';
  if (['C', 'CENTRE', 'CENTER'].includes(normalized)) return 'C';
  if (['D', 'DEF', 'DEFENCE', 'DEFENSE', 'DEFENCEMAN', 'DEFENSEMAN'].includes(normalized)) return 'D';
  if (['UTIL', 'UTILITY', 'U'].includes(normalized)) return 'UTIL';
  return normalized.replace(/\s+/g, '');
}

function normalizePositionDisplay(value) {
  const parts = String(value ?? '')
    .split(/[\/,|]/)
    .map((part) => normalizePositionToken(part))
    .filter(Boolean);

  const unique = [...new Set(parts)];
  const order = ['C', 'LW', 'RW', 'D', 'UTIL'];
  return unique.sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  }).join('/');
}

function loadPlayerManualOverrides() {
  if (typeof localStorage === 'undefined') return {};

  try {
    const raw = localStorage.getItem(PLAYER_MANUAL_OVERRIDES_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce((acc, [source, target]) => {
      const normalizedSource = normalizePlayerName(source);
      const normalizedTarget = String(target || '').trim();
      if (normalizedSource && normalizedTarget) {
        acc[normalizedSource] = normalizedTarget;
      }
      return acc;
    }, {});
  } catch (error) {
    return {};
  }
}

function persistPlayerManualOverrides(overrides) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PLAYER_MANUAL_OVERRIDES_KEY, JSON.stringify(overrides || {}));
}

function getPlayerAliasCandidates(playerName) {
  const normalizedSeed = normalizePlayerName(playerName);
  const variantSet = new Set([normalizedSeed]);
  const tokens = normalizedSeed.split(' ').filter(Boolean);

  if (tokens.length >= 2) {
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    variantSet.add(`${first[0]} ${last}`.trim());
    variantSet.add(`${first} ${last}`.trim());
  }

  if (tokens.length >= 3) {
    const first = tokens[0];
    const middle = tokens[1];
    const last = tokens[tokens.length - 1];
    variantSet.add(`${first[0]} ${middle[0]} ${last}`.trim());
  }

  Object.entries(state.playerAliasRegistry || {}).forEach(([canonicalKey, aliases]) => {
    if (canonicalKey === normalizedSeed || aliases.includes(normalizedSeed)) {
      variantSet.add(canonicalKey);
      aliases.forEach((alias) => variantSet.add(normalizePlayerName(alias)));
    }
  });

  const aliasKey = state.playerAliasRegistry?.[normalizedSeed];
  if (aliasKey) {
    aliasKey.forEach((alias) => variantSet.add(normalizePlayerName(alias)));
  }

  const directAliases = state.playerAliasRegistry ? Object.keys(state.playerAliasRegistry).filter((key) => normalizePlayerName(key) === normalizedSeed) : [];
  directAliases.forEach((key) => {
    const aliases = state.playerAliasRegistry[key] || [];
    aliases.forEach((alias) => variantSet.add(normalizePlayerName(alias)));
  });

  return [...variantSet].filter(Boolean);
}

function parseReferenceTeamCsvRows(csvText) {
  if (!csvText) return [];

  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const cells = line.split(',').map((cell) => cell.trim());
      const matches = [];

      for (let index = 0; index < cells.length - 1; index += 1) {
        const rawName = cells[index];
        const rawCode = cells[index + 1];

        if (!rawName || !rawCode) continue;
        if (rawName === 'x' || rawCode === 'x') continue;
        if (/^(?:left wing|center|right wing|defense|defenceman|forward|util)$/i.test(rawName)) continue;
        if (/^[A-Z]{2,4}$/.test(rawCode) || /^[A-Z]{2,4}\s*$/.test(rawCode)) {
          matches.push({ name: rawName, teamCode: rawCode.toUpperCase() });
        }
      }

      return matches;
    });
}

function parsePositionList(positionValue) {
  return String(positionValue || '')
    .split(/[\/,|]/)
    .map((part) => normalizePositionToken(part))
    .filter(Boolean);
}

function parsePositionReferenceRows(csvText) {
  if (!csvText) return [];

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const header = lines[0].toUpperCase();
  const isUtilityFile = header.startsWith('UTILITY') || (header.includes('POSITION') && !header.includes('LEFT WING'));

  if (isUtilityFile) {
    return lines.slice(1).flatMap((line) => {
      const cells = line.split(',').map((cell) => cell.trim());
      const name = cells[0];
      const teamCode = cells[1];
      const position = cells[2];
      if (!name || !teamCode || !position) return [];
      if (name.toLowerCase() === 'x') return [];

      const normalizedName = normalizePlayerName(name);
      if (!normalizedName) return [];

      return [{
        name: normalizedName,
        teamCode: teamCode.toUpperCase(),
        positions: parsePositionList(position),
        source: 'utility',
      }];
    });
  }

  const slotDefinitions = [
    { index: 0, position: 'LW' },
    { index: 2, position: 'C' },
    { index: 4, position: 'RW' },
    { index: 6, position: 'D' },
  ];

  return lines.slice(1).flatMap((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    return slotDefinitions.flatMap(({ index, position }) => {
      const name = cells[index];
      const teamCode = cells[index + 1];
      if (!name || !teamCode) return [];
      if (name.toLowerCase() === 'x') return [];

      const normalizedName = normalizePlayerName(name);
      if (!normalizedName) return [];

      return [{
        name: normalizedName,
        teamCode: teamCode.toUpperCase(),
        positions: [position],
        source: 'positions',
      }];
    });
  });
}

function buildReferenceLookup(csvText) {
  const results = new Map();

  parseReferenceTeamCsvRows(csvText).forEach(({ name, teamCode }) => {
    const normalizedName = normalizePlayerName(name);
    if (!normalizedName) return;
    if (!results.has(normalizedName) || !results.get(normalizedName)) {
      results.set(normalizedName, teamCode);
    }
  });

  return results;
}

function resolveTeamNameFromAbbreviation(teamCode) {
  const code = String(teamCode || '').trim().toUpperCase();
  return TEAM_ABBREVIATION_TO_NAME[code] || null;
}

function buildPositionLookup(csvText) {
  const results = new Map();

  parsePositionReferenceRows(csvText).forEach(({ name, teamCode, positions, source }) => {
    if (!name) return;

    const entry = results.get(name) || {
      teamCode: null,
      positions: new Set(),
      source: null,
    };

    positions.forEach((position) => {
      if (position) {
        entry.positions.add(position);
      }
    });

    if (!entry.teamCode && teamCode) {
      entry.teamCode = teamCode;
    }

    if (!entry.source || source === 'positions') {
      entry.source = source;
    }

    results.set(name, entry);
  });

  return results;
}

function normalizePositionEntry(entry) {
  if (!entry) return null;

  const position = normalizePositionDisplay([...(entry.positions || [])].join('/'));
  return {
    teamCode: entry.teamCode || null,
    position: position || null,
    source: entry.source || null,
  };
}

function resolveLookupEntryForName(lookup, playerName) {
  if (!lookup) return null;

  const candidates = [normalizePlayerName(playerName), ...getPlayerAliasCandidates(playerName)]
    .map((candidate) => normalizePlayerName(candidate))
    .filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    const entry = lookup.get(candidate);
    if (entry) {
      return { key: candidate, entry };
    }
  }

  return null;
}

function resolveProspectIdentity(playerName) {
  const normalizedName = normalizePlayerName(playerName);
  if (!normalizedName) {
    return {
      normalizedName: '',
      matchedName: null,
      viaOverride: false,
      overrideSource: null,
      teamCode: null,
      nhlTeam: null,
      position: null,
      positionSource: null,
    };
  }

  const visited = new Set();
  let searchName = playerName;
  let viaOverride = false;
  let overrideSource = null;

  while (true) {
    const normalizedSearch = normalizePlayerName(searchName);
    if (!normalizedSearch || visited.has(normalizedSearch)) {
      break;
    }
    visited.add(normalizedSearch);

    const overrideTarget = state.playerManualOverrides?.[normalizedSearch];
    if (!overrideTarget) {
      break;
    }

    searchName = overrideTarget;
    viaOverride = true;
    overrideSource = normalizedSearch;
  }

  const referenceMatch = resolveLookupEntryForName(state.playerReferenceLookup, searchName);
  const positionMatch = resolveLookupEntryForName(state.playerPositionLookup, searchName);
  const positionEntry = normalizePositionEntry(positionMatch?.entry);
  const fallbackTeamCode = PLAYER_REFERENCE_FALLBACK[normalizedName] || PLAYER_REFERENCE_FALLBACK[normalizePlayerName(searchName)] || null;
  const teamCode = referenceMatch?.entry || positionEntry?.teamCode || fallbackTeamCode || null;

  return {
    normalizedName,
    matchedName: referenceMatch?.key || positionMatch?.key || normalizedName,
    viaOverride,
    overrideSource,
    teamCode,
    nhlTeam: teamCode ? resolveTeamNameFromAbbreviation(teamCode) : null,
    position: positionEntry?.position || null,
    positionSource: positionEntry?.source || null,
  };
}

function resolveProspectTeam(playerName) {
  return resolveProspectIdentity(playerName).nhlTeam;
}

function resolveProspectPosition(player) {
  const identity = resolveProspectIdentity(player?.name);
  if (identity.position) {
    return identity.position;
  }

  return normalizePositionDisplay(player?.position) || null;
}

function resolveTeamSchedule(teamName) {
  const normalized = normalizeLeagueKey(teamName);

  const directMatch = Object.keys(GAMES_PLAYED_BULATOR_DATA).find((teamLabel) => normalizeLeagueKey(teamLabel) === normalized);
  if (directMatch) return GAMES_PLAYED_BULATOR_DATA[directMatch];

  if (TEAM_SCHEDULE_ALIASES[normalized] && GAMES_PLAYED_BULATOR_DATA[TEAM_SCHEDULE_ALIASES[normalized]]) {
    return GAMES_PLAYED_BULATOR_DATA[TEAM_SCHEDULE_ALIASES[normalized]];
  }

  const teamCode = Object.keys(TEAM_ABBREVIATION_TO_NAME).find((code) => normalizeLeagueKey(TEAM_ABBREVIATION_TO_NAME[code]) === normalized);
  if (teamCode) {
    const canonicalTeam = TEAM_ABBREVIATION_TO_NAME[teamCode];
    return GAMES_PLAYED_BULATOR_DATA[canonicalTeam] || null;
  }

  return null;
}

function formatIceTimePerGame(totalSeconds, gamesPlayed) {
  const seconds = Number(totalSeconds);
  const games = Number(gamesPlayed);
  if (!Number.isFinite(seconds) || !Number.isFinite(games) || games <= 0) return '—';

  const perGameSeconds = seconds / games;
  const minutes = Math.floor(perGameSeconds / 60);
  const remainingSeconds = Math.round(perGameSeconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function parseHistoricalCsvRows(csvText) {
  if (!csvText) return [];

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).flatMap((line) => {
    const cells = parseCSVLine(line);
    if (!cells.length) return [];

    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });

    const playerId = String(row.playerId || '').trim();
    const season = Number(row.season);
    const normalizedName = normalizePlayerName(row.name);
    const situation = String(row.situation || '').trim().toLowerCase();

    if (!normalizedName || !Number.isFinite(season)) return [];

    return [{
      ...row,
      playerId,
      season,
      name: String(row.name || '').trim(),
      normalizedName,
      team: String(row.team || '').trim(),
      position: String(row.position || '').trim(),
      situation,
      games_played: Number(row.games_played) || 0,
      icetime: Number(row.icetime) || 0,
      shifts: Number(row.shifts) || 0,
      gameScore: Number(row.gameScore) || 0,
      I_F_points: Number(row.I_F_points) || 0,
      I_F_goals: Number(row.I_F_goals) || 0,
      I_F_primaryAssists: Number(row.I_F_primaryAssists) || 0,
      I_F_secondaryAssists: Number(row.I_F_secondaryAssists) || 0,
      I_F_shotsOnGoal: Number(row.I_F_shotsOnGoal) || 0,
      sourceRecordId: `${playerId || normalizedName}:${season}:${situation || 'all'}`,
    }];
  });
}

function buildHistoricalLookup(csvTexts) {
  const byName = new Map();
  const byPlayerId = new Map();

  csvTexts.forEach((csvText) => {
    parseHistoricalCsvRows(csvText).forEach((row) => {
      const nameBucket = byName.get(row.normalizedName) || [];
      nameBucket.push(row);
      byName.set(row.normalizedName, nameBucket);

      if (row.playerId) {
        const playerBucket = byPlayerId.get(String(row.playerId)) || [];
        playerBucket.push(row);
        byPlayerId.set(String(row.playerId), playerBucket);
      }
    });
  });

  const sortRows = (rows) => rows.slice().sort((left, right) => {
    if (right.season !== left.season) return right.season - left.season;
    if (left.situation === 'all' && right.situation !== 'all') return -1;
    if (left.situation !== 'all' && right.situation === 'all') return 1;
    return String(left.situation || '').localeCompare(String(right.situation || ''));
  });

  byName.forEach((rows, key) => {
    byName.set(key, sortRows(rows));
  });

  byPlayerId.forEach((rows, key) => {
    byPlayerId.set(key, sortRows(rows));
  });

  return { byName, byPlayerId };
}

function getHistoricalLookupCandidates(playerName) {
  return [...new Set([normalizePlayerName(playerName), ...getPlayerAliasCandidates(playerName)].map((candidate) => normalizePlayerName(candidate)).filter(Boolean))];
}

function resolveHistoricalRecordsForPlayer(player) {
  const lookup = state.historicalLookup;
  if (!lookup) {
    return {
      sourceRecords: [],
      seasonSummary: null,
      latestAllRecord: null,
      seasonHistory: [],
      sourceRecordCount: 0,
      sourceName: 'Historical CSVs',
    };
  }

  const candidateKeys = getHistoricalLookupCandidates(player?.name);
  const sourceRecords = [];
  const seen = new Set();

  candidateKeys.forEach((candidateKey) => {
    (lookup.byName.get(candidateKey) || []).forEach((row) => {
      if (!seen.has(row.sourceRecordId)) {
        seen.add(row.sourceRecordId);
        sourceRecords.push(row);
      }
    });
  });

  if (!sourceRecords.length && player?.playerId) {
    (lookup.byPlayerId.get(String(player.playerId)) || []).forEach((row) => {
      if (!seen.has(row.sourceRecordId)) {
        seen.add(row.sourceRecordId);
        sourceRecords.push(row);
      }
    });
  }

  const seasonHistory = sourceRecords
    .filter((row) => row.situation === 'all')
    .sort((left, right) => right.season - left.season);
  const latestAllRecord = seasonHistory[0] || null;

  return {
    sourceRecords,
    seasonSummary: latestAllRecord,
    latestAllRecord,
    seasonHistory,
    sourceRecordCount: sourceRecords.length,
    sourceName: 'Historical CSVs',
  };
}

function enrichProspectWithHistoricalData(player) {
  const historical = resolveHistoricalRecordsForPlayer(player);
  const latest = historical.latestAllRecord;

  return {
    ...player,
    historicalSourceCount: historical.sourceRecordCount,
    historicalSeason: latest ? latest.season : null,
    historicalGamesPlayed: latest ? latest.games_played : null,
    historicalGoals: latest ? latest.I_F_goals : null,
    historicalAssists: latest ? latest.I_F_primaryAssists + latest.I_F_secondaryAssists : null,
    historicalPoints: latest ? latest.I_F_points : null,
    historicalShots: latest ? latest.I_F_shotsOnGoal : null,
    historicalGameScore: latest ? latest.gameScore : null,
    historicalAverageIceTime: latest ? formatIceTimePerGame(latest.icetime, latest.games_played) : '—',
    historicalSeasonHistory: historical.seasonHistory,
    historicalSourceRecords: historical.sourceRecords,
    historicalSourceName: historical.sourceName,
  };
}

function getHistoricalPlayerSummary(prospect) {
  const historical = prospect?.historicalSeasonHistory || [];
  if (!historical.length) {
    return {
      latestSeason: null,
      sourceCount: 0,
      sourceRecords: [],
    };
  }

  return {
    latestSeason: historical[0] || null,
    sourceCount: prospect?.historicalSourceCount || historical.length,
    sourceRecords: prospect?.historicalSourceRecords || historical,
  };
}

function getRuntimeDataCandidates(relativePath) {
  if (typeof window === 'undefined') {
    return [];
  }

  const candidates = new Set();
  const baseUrls = [
    new URL('.', window.location.href),
    new URL('..', window.location.href),
    new URL('../..', window.location.href),
    new URL('../../..', window.location.href),
    new URL('/', window.location.href),
  ];

  baseUrls.forEach((baseUrl) => {
    candidates.add(new URL(relativePath, baseUrl).href);
  });

  if (window.location.origin) {
    candidates.add(new URL(relativePath, window.location.origin).href);
  }

  return [...candidates];
}

async function hydratePlayerReferenceData() {
  const referenceUrls = [
    ...new Set([
      ...getRuntimeDataCandidates('Data/Reference/AHL Draft - Positions.csv'),
      ...getRuntimeDataCandidates('Data/Reference/AHL Draft - Utility.csv'),
    ]),
  ];

  const combined = new Map();
  const combinedPositions = new Map();
  const fetchPromises = referenceUrls.map(async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.text();
    } catch (error) {
      return null;
    }
  });

  const csvTexts = (await Promise.all(fetchPromises)).filter(Boolean);
  csvTexts.forEach((csvText) => {
    const teamLookup = buildReferenceLookup(csvText);
    teamLookup.forEach((teamCode, normalizedName) => {
      if (!combined.has(normalizedName)) {
        combined.set(normalizedName, teamCode);
      }
    });

    const positionLookup = buildPositionLookup(csvText);
    positionLookup.forEach((entry, normalizedName) => {
      const existing = combinedPositions.get(normalizedName) || {
        teamCode: null,
        positions: new Set(),
        source: null,
      };

      if (entry.teamCode && !existing.teamCode) {
        existing.teamCode = entry.teamCode;
      }

      (entry.positions || new Set()).forEach((position) => existing.positions.add(position));

      if (!existing.source || entry.source === 'positions') {
        existing.source = entry.source;
      }

      combinedPositions.set(normalizedName, existing);
    });
  });

  if (combined.size === 0) {
    Object.entries(PLAYER_REFERENCE_FALLBACK).forEach(([playerName, teamCode]) => combined.set(normalizePlayerName(playerName), teamCode));
  }

  state.playerReferenceLookup = combined;
  state.playerPositionLookup = combinedPositions;
}

async function hydrateHistoricalData() {
  const historicalUrls = [
    ...new Set(HISTORICAL_SOURCE_FILES.flatMap((fileName) => getRuntimeDataCandidates(fileName))),
  ];

  const fetchPromises = historicalUrls.map(async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.text();
    } catch (error) {
      return null;
    }
  });

  const csvTexts = (await Promise.all(fetchPromises)).filter(Boolean);
  if (!csvTexts.length) {
    state.historicalLookup = buildHistoricalLookup([]);
    state.historicalRecords = [];
    return;
  }

  state.historicalLookup = buildHistoricalLookup(csvTexts);
  state.historicalRecords = csvTexts;
}

function computeNameSimilarity(left, right) {
  const a = String(left || '').toLowerCase();
  const b = String(right || '').toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aWords = new Set(a.split(/\s+/));
  const bWords = new Set(b.split(/\s+/));
  const overlap = [...aWords].filter((word) => bWords.has(word)).length;
  const total = Math.max(aWords.size, bWords.size);
  return total ? overlap / total : 0;
}

function classifyUnmappedPlayer(playerName, referenceLookup = new Map(), duplicateCounts = new Map()) {
  const normalizedName = normalizePlayerName(playerName);
  const candidates = getPlayerAliasCandidates(playerName);
  const candidateMap = Array.from(referenceLookup.keys());
  let bestCandidate = null;
  let bestScore = 0;

  if ((duplicateCounts.get(normalizedName) || 0) > 1) {
    return {
      playerName,
      closestCandidate: normalizedName || 'None',
      confidence: 'Low',
      status: 'unresolved',
      reason: 'Duplicate Player',
    };
  }

  candidateMap.forEach((entry) => {
    const score = computeNameSimilarity(normalizedName, entry);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = entry;
    }
  });

  const aliasMatch = candidates.find((candidate) => referenceLookup.has(candidate));
  if (aliasMatch) {
    return {
      playerName,
      closestCandidate: aliasMatch,
      confidence: 'High',
      status: 'resolved',
      reason: 'Alias Variation',
    };
  }

  if (referenceLookup.has(normalizedName)) {
    return {
      playerName,
      closestCandidate: normalizedName,
      confidence: 'High',
      status: 'resolved',
      reason: 'Exact Match',
    };
  }

  if (bestCandidate) {
    const reason = normalizedName.includes('-') || normalizedName.includes('.') || playerName.includes('-') || playerName.includes('.')
      ? 'Punctuation Variation'
      : bestScore >= 0.6
        ? 'Spelling Variation'
        : 'No Candidate Found';

    return {
      playerName,
      closestCandidate: bestCandidate,
      confidence: bestScore >= 0.75 ? 'Medium' : 'Low',
      status: 'unresolved',
      reason,
    };
  }

  const punctuationOnlyMatch = candidateMap.find((candidate) => candidate.replace(/[^a-z0-9]/g, '') === normalizedName.replace(/[^a-z0-9]/g, ''));
  if (punctuationOnlyMatch) {
    return {
      playerName,
      closestCandidate: punctuationOnlyMatch,
      confidence: 'Low',
      status: 'unresolved',
      reason: 'Punctuation Variation',
    };
  }

  return {
    playerName,
    closestCandidate: 'None',
    confidence: 'Low',
    status: 'unresolved',
    reason: 'Missing Reference Coverage',
  };
}

function getUnmappedPlayerDiagnostics(unifiedState, prospectRecords = null) {
  const prospects = prospectRecords || Object.values(unifiedState?.datasets?.prospects?.prospects || {}).filter(Boolean);
  const lookup = state.playerReferenceLookup || new Map();
  const duplicateCounts = prospects.reduce((counts, player) => {
    const key = normalizePlayerName(player?.name);
    if (!key) return counts;
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());

  return prospects
    .filter((player) => !resolveProspectTeam(player?.name))
    .map((player) => classifyUnmappedPlayer(player.name, lookup, duplicateCounts));
}

function setManualOverride(source, target) {
  const normalizedSource = normalizePlayerName(source);
  const normalizedTarget = String(target || '').trim();

  if (!normalizedSource || !normalizedTarget) {
    return false;
  }

  state.playerManualOverrides = {
    ...(state.playerManualOverrides || {}),
    [normalizedSource]: normalizedTarget,
  };
  persistPlayerManualOverrides(state.playerManualOverrides);
  return true;
}

function clearManualOverride(source) {
  const normalizedSource = normalizePlayerName(source);
  if (!normalizedSource || !state.playerManualOverrides?.[normalizedSource]) {
    return false;
  }

  const next = { ...(state.playerManualOverrides || {}) };
  delete next[normalizedSource];
  state.playerManualOverrides = next;
  persistPlayerManualOverrides(state.playerManualOverrides);
  return true;
}

function enrichProspectWithSchedule(player) {
  const identity = resolveProspectIdentity(player?.name);
  const candidateTeam = identity.nhlTeam;
  const schedule = candidateTeam ? resolveTeamSchedule(candidateTeam) : null;
  const resolvedPosition = resolveProspectPosition(player);

  return {
    ...player,
    position: resolvedPosition || normalizePositionDisplay(player?.position) || '—',
    nhlTeam: candidateTeam || 'Unmapped',
    resolutionStatus: candidateTeam ? 'resolved' : 'unresolved',
    firstHalfEligibleGames: schedule ? Number(schedule.firstHalfEligibleGames) : null,
    secondHalfEligibleGames: schedule ? Number(schedule.secondHalfEligibleGames) : null,
    totalEligibleGames: schedule ? Number(schedule.totalEligibleGames) : null,
    scheduleSource: schedule ? 'GamesPlayedBulator' : 'Unmapped',
    positionSource: identity.positionSource || (player?.position ? 'import' : null),
  };
}

function getEnrichedProspects(unifiedState) {
  return Object.values(unifiedState?.datasets?.prospects?.prospects || {})
    .filter(Boolean)
    .map((player) => enrichProspectWithHistoricalData(enrichProspectWithSchedule(player)));
}

function filterProspects(prospects, filters = {}) {
  const activeFilters = { ...createDefaultProspectFilters(), ...(filters || {}) };
  const ownerFilter = String(activeFilters.owner || 'all');
  const farmFilter = String(activeFilters.farm || 'all');
  const mrFilter = String(activeFilters.matchingRights || 'all');
  const draftYearFilter = String(activeFilters.draftYear || 'all');
  const rawCostMin = String(activeFilters.costMin ?? '').trim();
  const rawCostMax = String(activeFilters.costMax ?? '').trim();
  const costMin = rawCostMin !== '' && Number.isFinite(Number(rawCostMin)) ? Number(rawCostMin) : null;
  const costMax = rawCostMax !== '' && Number.isFinite(Number(rawCostMax)) ? Number(rawCostMax) : null;
  const search = String(activeFilters.search || '').trim().toLowerCase();

  return prospects.filter((player) => {
   if (ownerFilter !== 'all' && player.owner !== ownerFilter) return false;

   const playerFarm = Boolean(player.farm);
   if (farmFilter !== 'all') {
     if (farmFilter === 'farm' && !playerFarm) return false;
     if (farmFilter === 'non-farm' && playerFarm) return false;
   }

   const playerMR = Boolean(player.matchingRights);
   if (mrFilter !== 'all') {
     if (mrFilter === 'yes' && !playerMR) return false;
     if (mrFilter === 'no' && playerMR) return false;
   }

   if (draftYearFilter !== 'all' && String(player.draftYear) !== String(draftYearFilter)) return false;

   const price = normalizeProspectCost(player.cost);
   if (costMin !== null && price < costMin) return false;
   if (costMax !== null && price > costMax) return false;

   if (search) {
     const haystack = [player.name, player.owner, player.position, player.nhlTeam, String(player.draftYear || '')].join(' ').toLowerCase();
     if (!haystack.includes(search)) return false;
   }

   return true;
  });
}

function computeProspectSummary(prospects) {
  const total = prospects.length;
  const mappedCount = prospects.filter((player) => player.resolutionStatus === 'resolved').length;
  const unmappedCount = total - mappedCount;
  const coveragePercent = total ? (mappedCount / total) * 100 : 0;
  const scheduleReadyCount = prospects.filter((player) => player.scheduleSource === 'GamesPlayedBulator').length;
  const historicalReadyCount = prospects.filter((player) => player.historicalSeason !== null && player.historicalSeason !== undefined).length;
  const scheduleReadyGames = prospects
   .filter((player) => player.totalEligibleGames !== null && player.totalEligibleGames !== undefined)
   .map((player) => Number(player.totalEligibleGames))
   .filter((value) => Number.isFinite(value));
  const averageEligibleGames = scheduleReadyGames.length
   ? scheduleReadyGames.reduce((sum, value) => sum + value, 0) / scheduleReadyGames.length
   : 0;
  const historicalGames = prospects
   .filter((player) => Number.isFinite(Number(player.historicalGamesPlayed)))
   .map((player) => Number(player.historicalGamesPlayed));
  const averageHistoricalGames = historicalGames.length
   ? historicalGames.reduce((sum, value) => sum + value, 0) / historicalGames.length
   : 0;
  const farmCount = prospects.filter((player) => player.farm).length;
  const matchingRightsCount = prospects.filter((player) => player.matchingRights).length;

  return {
   total,
   mappedCount,
   unmappedCount,
   coveragePercent,
   scheduleReadyCount,
   averageEligibleGames,
   historicalReadyCount,
   averageHistoricalGames,
   farmCount,
   matchingRightsCount,
   ownerCount: new Set(prospects.map((player) => player.owner).filter(Boolean)).size,
  };
}

function resolveSelectedHistoricalProspect(prospects) {
  const selectedKey = normalizePlayerName(state.selectedHistoricalPlayer);
  if (selectedKey) {
   const matched = prospects.find((player) => {
     const playerKey = normalizePlayerName(player?.name);
     if (playerKey === selectedKey) return true;
     return getHistoricalLookupCandidates(player?.name).includes(selectedKey);
   });
   if (matched) return matched;
  }

  return prospects[0] || null;
}

function renderHistoricalSourceRows(player) {
  const history = getHistoricalPlayerSummary(player);
  const sourceRows = (history.sourceRecords || [])
   .filter((row) => row.situation === 'all')
   .sort((left, right) => right.season - left.season)
   .slice(0, 3);

  if (!sourceRows.length) {
   return '<div class="empty-state">No historical source rows found.</div>';
  }

  return `
   <table class="historical-table">
     <thead>
       <tr>
         <th>Season</th>
         <th>Team</th>
         <th>GP</th>
         <th>G</th>
         <th>A</th>
         <th>PTS</th>
         <th>Shots</th>
         <th>Game Score</th>
         <th>Avg TOI</th>
       </tr>
     </thead>
     <tbody>
       ${sourceRows.map((row) => `
         <tr>
           <td>${escapeHtml(String(row.season || '—'))}</td>
           <td>${escapeHtml(row.team || '—')}</td>
           <td>${escapeHtml(String(row.games_played ?? '—'))}</td>
           <td>${escapeHtml(String(row.I_F_goals ?? '—'))}</td>
           <td>${escapeHtml(String((Number(row.I_F_primaryAssists) || 0) + (Number(row.I_F_secondaryAssists) || 0)))}</td>
           <td>${escapeHtml(String(row.I_F_points ?? '—'))}</td>
           <td>${escapeHtml(String(row.I_F_shotsOnGoal ?? '—'))}</td>
           <td>${escapeHtml(String(row.gameScore ?? '—'))}</td>
           <td>${escapeHtml(formatIceTimePerGame(row.icetime, row.games_played))}</td>
         </tr>
       `).join('')}
     </tbody>
   </table>
  `;
}

function renderHistoricalPlayerProfile(player) {
  if (!player) {
   return `
     <section class="panel historical-profile">
       <div class="preview-header">
         <h3>Historical Player Profile</h3>
       </div>
       <div class="empty-state">Click a player to view their historical profile.</div>
     </section>
   `;
  }

  const history = getHistoricalPlayerSummary(player);
  const latest = history.latestSeason;
  const sourceCount = history.sourceCount || 0;

  return `
   <section class="panel historical-profile">
     <div class="preview-header">
       <h3>Historical Player Profile</h3>
       <span class="meta-pill">${sourceCount} source rows</span>
     </div>

     <div class="historical-profile-grid">
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${escapeHtml(player.name || '—')}</div>
         <div class="prospect-summary-label">Player</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${escapeHtml(player.position || '—')}</div>
         <div class="prospect-summary-label">Position</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${escapeHtml(player.nhlTeam || '—')}</div>
         <div class="prospect-summary-label">NHL Team</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${escapeHtml(latest ? String(latest.season) : '—')}</div>
         <div class="prospect-summary-label">Latest Season</div>
       </div>
     </div>

     <div class="historical-metric-grid">
       <div class="meta-pill">GP: ${escapeHtml(latest ? String(latest.games_played) : '—')}</div>
       <div class="meta-pill">G: ${escapeHtml(latest ? String(latest.I_F_goals) : '—')}</div>
       <div class="meta-pill">A: ${escapeHtml(latest ? String((Number(latest.I_F_primaryAssists) || 0) + (Number(latest.I_F_secondaryAssists) || 0)) : '—')}</div>
       <div class="meta-pill">PTS: ${escapeHtml(latest ? String(latest.I_F_points) : '—')}</div>
       <div class="meta-pill">Shots: ${escapeHtml(latest ? String(latest.I_F_shotsOnGoal) : '—')}</div>
       <div class="meta-pill">Game Score: ${escapeHtml(latest ? String(latest.gameScore) : '—')}</div>
       <div class="meta-pill">Avg TOI: ${escapeHtml(latest ? formatIceTimePerGame(latest.icetime, latest.games_played) : '—')}</div>
     </div>

     <div class="historical-source-panel">
       <h4>Source Records</h4>
       ${renderHistoricalSourceRows(player)}
     </div>
   </section>
  `;
}

function renderProspectTableRows(prospects) {
  if (!prospects.length) {
   return '<tr><td colspan="20" class="prospect-empty">No prospects match the current filters.</td></tr>';
  }

  const selectedPlayerKey = normalizePlayerName(state.selectedHistoricalPlayer);

  return prospects.map((player) => `
   <tr data-player-name="${escapeHtml(player.name || '')}" class="historical-row ${selectedPlayerKey === normalizePlayerName(player.name) ? 'is-selected' : ''}">
     <td>${escapeHtml(player.name || 'Unnamed Prospect')}</td>
     <td>${escapeHtml(player.owner || 'Unknown')}</td>
     <td>${escapeHtml(player.position || '—')}</td>
     <td>${escapeHtml(player.nhlTeam || 'Unmapped')}</td>
     <td class="historical-cell">${escapeHtml(player.historicalSeason ?? '—')}</td>
     <td class="historical-cell">${escapeHtml(player.historicalGamesPlayed ?? '—')}</td>
     <td class="historical-cell">${escapeHtml(player.historicalGoals ?? '—')}</td>
     <td class="historical-cell">${escapeHtml(player.historicalAssists ?? '—')}</td>
     <td class="historical-cell">${escapeHtml(player.historicalPoints ?? '—')}</td>
     <td class="historical-cell">${escapeHtml(player.historicalShots ?? '—')}</td>
     <td class="historical-cell">${escapeHtml(player.historicalGameScore ?? '—')}</td>
     <td class="historical-cell">${escapeHtml(player.historicalAverageIceTime || '—')}</td>
     <td class="schedule-cell">${escapeHtml(player.firstHalfEligibleGames ?? '—')}</td>
     <td class="schedule-cell">${escapeHtml(player.secondHalfEligibleGames ?? '—')}</td>
     <td class="schedule-cell">${escapeHtml(player.totalEligibleGames ?? '—')}</td>
     <td>${escapeHtml(player.draftYear ?? '—')}</td>
     <td>$${formatValue(normalizeProspectCost(player.cost))}</td>
     <td><span class="prospect-tag ${player.farm ? 'is-true' : 'is-false'}">${player.farm ? 'Farm' : 'No'}</span></td>
     <td><span class="prospect-tag ${player.matchingRights ? 'is-true' : 'is-false'}">${player.matchingRights ? 'Yes' : 'No'}</span></td>
     <td>${escapeHtml(player.termRemaining ?? '—')}</td>
   </tr>
  `).join('');
}

function getProspectExplorerMarkup(unifiedState) {
  const prospects = getProspectRecordsFromState(unifiedState);
  const ownerOptions = getProspectOwnerOptions(prospects);
  const yearOptions = getProspectDraftYearOptions(prospects);
  const filtered = filterProspects(prospects, state.prospectFilters);
  const visibleSummary = computeProspectSummary(filtered);
  const overallSummary = computeProspectSummary(prospects);
  const unmappedDiagnostics = getUnmappedPlayerDiagnostics(unifiedState, prospects);
  const selectedPlayer = resolveSelectedHistoricalProspect(filtered.length ? filtered : prospects);
  const overrideEntries = Object.entries(state.playerManualOverrides || {}).sort(([left], [right]) => left.localeCompare(right));
  const sourceValue = escapeHtml(state.manualOverrideDraft?.source || '');
  const targetValue = escapeHtml(state.manualOverrideDraft?.target || '');

  if (selectedPlayer && state.selectedHistoricalPlayer !== selectedPlayer.name) {
   state.selectedHistoricalPlayer = selectedPlayer.name;
  }

  return `
   <section class="panel prospect-explorer">
     <div class="preview-header">
       <h2>Prospect Explorer</h2>
       <div class="preview-meta health-strip">
         <span class="meta-pill">Prospects: ${overallSummary.total}</span>
         <span class="meta-pill">Mapped: ${overallSummary.mappedCount}</span>
         <span class="meta-pill">Unmapped: ${overallSummary.unmappedCount}</span>
         <span class="meta-pill">Coverage: ${formatValue(overallSummary.coveragePercent)}%</span>
         <span class="meta-pill">Owners: ${overallSummary.ownerCount}</span>
       </div>
     </div>

     <div class="prospect-summary-grid">
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${visibleSummary.total}</div>
         <div class="prospect-summary-label">Visible Prospects</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${overallSummary.scheduleReadyCount}</div>
         <div class="prospect-summary-label">Schedule Ready</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${formatValue(overallSummary.averageEligibleGames)}</div>
         <div class="prospect-summary-label">Avg Eligible Games</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${overallSummary.historicalReadyCount}</div>
         <div class="prospect-summary-label">Historical Ready</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${formatValue(overallSummary.averageHistoricalGames)}</div>
         <div class="prospect-summary-label">Avg Historical GP</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${overallSummary.farmCount}</div>
         <div class="prospect-summary-label">Farm Players</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${overallSummary.matchingRightsCount}</div>
         <div class="prospect-summary-label">Matching Rights</div>
       </div>
       <div class="prospect-summary-card">
         <div class="prospect-summary-value">${overallSummary.ownerCount}</div>
         <div class="prospect-summary-label">Owners</div>
       </div>
     </div>

     ${renderHistoricalPlayerProfile(selectedPlayer)}

     <section class="panel filter-panel">
       <div class="filter-grid">
         <div class="field-group">
           <label for="prospectOwnerFilter">Owner</label>
           <select id="prospectOwnerFilter">
             <option value="all">All owners</option>
             ${ownerOptions.map((owner) => `<option value="${escapeHtml(owner)}" ${state.prospectFilters.owner === owner ? 'selected' : ''}>${escapeHtml(owner)}</option>`).join('')}
           </select>
         </div>

         <div class="field-group">
           <label for="prospectFarmFilter">Farm Status</label>
           <select id="prospectFarmFilter">
             <option value="all" ${state.prospectFilters.farm === 'all' ? 'selected' : ''}>All</option>
             <option value="farm" ${state.prospectFilters.farm === 'farm' ? 'selected' : ''}>Farm only</option>
             <option value="non-farm" ${state.prospectFilters.farm === 'non-farm' ? 'selected' : ''}>Non-farm only</option>
           </select>
         </div>

         <div class="field-group">
           <label for="prospectMatchingRightsFilter">Matching Rights</label>
           <select id="prospectMatchingRightsFilter">
             <option value="all" ${state.prospectFilters.matchingRights === 'all' ? 'selected' : ''}>All</option>
             <option value="yes" ${state.prospectFilters.matchingRights === 'yes' ? 'selected' : ''}>Yes</option>
             <option value="no" ${state.prospectFilters.matchingRights === 'no' ? 'selected' : ''}>No</option>
           </select>
         </div>

         <div class="field-group">
           <label for="prospectDraftYearFilter">Draft Year</label>
           <select id="prospectDraftYearFilter">
             <option value="all">All years</option>
             ${yearOptions.map((year) => `<option value="${year}" ${state.prospectFilters.draftYear === String(year) ? 'selected' : ''}>${year}</option>`).join('')}
           </select>
         </div>

         <div class="field-group">
           <label for="prospectCostMin">Min Cost</label>
           <input id="prospectCostMin" type="number" min="0" step="1" value="${escapeHtml(state.prospectFilters.costMin || '')}" placeholder="0" />
         </div>

         <div class="field-group">
           <label for="prospectCostMax">Max Cost</label>
           <input id="prospectCostMax" type="number" min="0" step="1" value="${escapeHtml(state.prospectFilters.costMax || '')}" placeholder="250" />
         </div>

         <div class="field-group" style="grid-column: 1 / -1;">
           <label for="prospectSearchInput">Search prospects</label>
           <input id="prospectSearchInput" type="search" value="${escapeHtml(state.prospectFilters.search || '')}" placeholder="Search by player, owner, or position" />
         </div>
       </div>
     </section>

     <section class="panel">
       <div class="preview-header">
         <h3>Prospect List</h3>
         <span class="meta-pill">Showing ${visibleSummary.total} of ${prospects.length}</span>
       </div>
       <div class="prospect-table-wrap">
         <table class="prospect-table">
           <thead>
             <tr>
               <th>Player</th>
               <th>Owner</th>
               <th>Position</th>
               <th>NHL Team</th>
               <th class="historical-head" colspan="8">Historical Performance</th>
               <th class="schedule-head" colspan="3">Schedule Opportunity</th>
               <th>Draft Year</th>
               <th>Cost</th>
               <th>Farm</th>
               <th>Matching Rights</th>
               <th>Term</th>
             </tr>
             <tr class="subhead">
               <th></th>
               <th></th>
               <th></th>
               <th></th>
               <th class="historical-subhead">Season</th>
               <th class="historical-subhead">GP</th>
               <th class="historical-subhead">G</th>
               <th class="historical-subhead">A</th>
               <th class="historical-subhead">PTS</th>
               <th class="historical-subhead">Shots</th>
               <th class="historical-subhead">Game Score</th>
               <th class="historical-subhead">Avg TOI</th>
               <th class="schedule-subhead">1H</th>
               <th class="schedule-subhead">2H</th>
               <th class="schedule-subhead">Total</th>
               <th></th>
               <th></th>
               <th></th>
               <th></th>
               <th></th>
             </tr>
           </thead>
           <tbody>
             ${renderProspectTableRows(filtered)}
           </tbody>
         </table>
       </div>
     </section>

     <section class="panel">
       <div class="preview-header">
         <h3>Manual Match Overrides</h3>
         <span class="meta-pill">${overrideEntries.length} saved</span>
       </div>
       <div class="override-form">
         <div class="field-group">
           <label for="overrideSourceInput">Unmapped Player</label>
           <input id="overrideSourceInput" type="text" value="${sourceValue}" placeholder="Zane Parekh" />
         </div>
         <div class="field-group">
           <label for="overrideTargetInput">Manual Match</label>
           <input id="overrideTargetInput" type="text" value="${targetValue}" placeholder="Zayne Parekh" />
         </div>
         <div class="override-actions">
           <button class="primary" id="saveOverrideBtn" type="button">Save Override</button>
           <button class="secondary" id="clearOverrideBtn" type="button">Clear Form</button>
         </div>
       </div>
     </section>

     <section class="panel">
       <div class="preview-header">
         <h3>Unmapped Players</h3>
         <span class="meta-pill">${unmappedDiagnostics.length} unresolved</span>
       </div>
       <div class="prospect-table-wrap">
         <table class="prospect-table">
           <thead>
             <tr>
               <th>Player Name</th>
               <th>Reason</th>
               <th>Closest Match</th>
               <th>Confidence</th>
               <th>Action</th>
             </tr>
           </thead>
           <tbody>
             ${unmappedDiagnostics.length ? unmappedDiagnostics.map((report) => `
               <tr>
                 <td>${escapeHtml(report.playerName || 'Unknown')}</td>
                 <td>${escapeHtml(report.reason || 'Missing Reference Coverage')}</td>
                 <td>${escapeHtml(report.closestCandidate || 'None')}</td>
                 <td>${escapeHtml(report.confidence || 'Low')}</td>
                 <td>
                   <button
                     class="secondary override-row-btn"
                     type="button"
                     data-source="${escapeHtml(report.playerName || '')}"
                     data-target="${escapeHtml(report.closestCandidate && report.closestCandidate !== 'None' ? report.closestCandidate : '')}"
                   >Use Match</button>
                 </td>
               </tr>
             `).join('') : '<tr><td colspan="5" class="prospect-empty">No unmapped players detected.</td></tr>'}
           </tbody>
         </table>
       </div>
       <div class="override-list">
         ${overrideEntries.length ? overrideEntries.map(([source, target]) => `
           <div class="override-chip">
             <span><strong>${escapeHtml(source)}</strong> → ${escapeHtml(target)}</span>
             <button class="secondary override-remove-btn" type="button" data-source="${escapeHtml(source)}">Remove</button>
           </div>
         `).join('') : '<div class="empty-state">No manual overrides saved.</div>'}
       </div>
     </section>
   </section>
  `;
}

function renderProspectExplorer(unifiedState) {
  const app = document.getElementById('app');
  if (!app) return;

  const title = document.getElementById('pageTitle');
  if (title) title.textContent = 'Prospect Explorer';

  app.innerHTML = getProspectExplorerMarkup(unifiedState);
  renderViewToggle();

  const ownerFilter = document.getElementById('prospectOwnerFilter');
  const farmFilter = document.getElementById('prospectFarmFilter');
  const matchingRightsFilter = document.getElementById('prospectMatchingRightsFilter');
  const draftYearFilter = document.getElementById('prospectDraftYearFilter');
  const costMinInput = document.getElementById('prospectCostMin');
  const costMaxInput = document.getElementById('prospectCostMax');
  const searchInput = document.getElementById('prospectSearchInput');
  const overrideSourceInput = document.getElementById('overrideSourceInput');
  const overrideTargetInput = document.getElementById('overrideTargetInput');
  const saveOverrideBtn = document.getElementById('saveOverrideBtn');
  const clearOverrideBtn = document.getElementById('clearOverrideBtn');

  const updateFilterState = () => {
   state.prospectFilters = {
     ...state.prospectFilters,
     owner: ownerFilter ? ownerFilter.value : 'all',
     farm: farmFilter ? farmFilter.value : 'all',
     matchingRights: matchingRightsFilter ? matchingRightsFilter.value : 'all',
     draftYear: draftYearFilter ? draftYearFilter.value : 'all',
     costMin: costMinInput ? costMinInput.value : '',
     costMax: costMaxInput ? costMaxInput.value : '',
     search: searchInput ? searchInput.value : '',
   };
   renderProspectExplorer(unifiedState);
  };

  ownerFilter?.addEventListener('change', updateFilterState);
  farmFilter?.addEventListener('change', updateFilterState);
  matchingRightsFilter?.addEventListener('change', updateFilterState);
  draftYearFilter?.addEventListener('change', updateFilterState);
  costMinInput?.addEventListener('input', updateFilterState);
  costMaxInput?.addEventListener('input', updateFilterState);
  searchInput?.addEventListener('input', updateFilterState);

  saveOverrideBtn?.addEventListener('click', () => {
    const source = overrideSourceInput ? overrideSourceInput.value : '';
    const target = overrideTargetInput ? overrideTargetInput.value : '';
    if (!setManualOverride(source, target)) {
      return;
    }

    state.manualOverrideDraft = { source: '', target: '' };
    renderProspectExplorer(unifiedState);
  });

  clearOverrideBtn?.addEventListener('click', () => {
    state.manualOverrideDraft = { source: '', target: '' };
    renderProspectExplorer(unifiedState);
  });

  document.querySelectorAll('.override-row-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.manualOverrideDraft = {
        source: button.dataset.source || '',
        target: button.dataset.target || '',
      };
      renderProspectExplorer(unifiedState);
    });
  });

  document.querySelectorAll('.override-remove-btn').forEach((button) => {
    button.addEventListener('click', () => {
      clearManualOverride(button.dataset.source || '');
      renderProspectExplorer(unifiedState);
    });
  });

  document.querySelectorAll('.historical-row').forEach((row) => {
    row.addEventListener('click', () => {
      state.selectedHistoricalPlayer = row.dataset.playerName || null;
      renderProspectExplorer(unifiedState);
    });
  });
}

function renderViewToggle() {
  const toggle = document.getElementById('viewToggle');
  const ownerBtn = document.getElementById('ownerViewBtn');
  const prospectBtn = document.getElementById('prospectViewBtn');

  if (!toggle || !ownerBtn || !prospectBtn) return;

  const hasData = hasAnyDatasetLoaded(loadState());
  toggle.classList.toggle('hidden', !hasData);
  ownerBtn.classList.toggle('active', state.currentView === 'owner');
  prospectBtn.classList.toggle('active', state.currentView === 'prospect');
  ownerBtn.setAttribute('aria-pressed', String(state.currentView === 'owner'));
  prospectBtn.setAttribute('aria-pressed', String(state.currentView === 'prospect'));
}

function renderCurrentView() {
  const stored = loadState();
  state.importedData = stored;

  if (!hasAnyDatasetLoaded(stored)) {
   renderImportScreen();
   return;
  }

  if (state.currentView === 'prospect') {
   renderProspectExplorer(stored);
   return;
  }

  renderOwnerView(stored);
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
  const prospectsArr = Object.values(stateObj.datasets.prospects?.prospects || {});
  const veteransArr = Object.values(stateObj.datasets.veterans?.veterans || {});

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

  return records.slice(0, MAX_PREVIEW_ROWS);
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
  const headers = ['name', 'owner', 'cost', 'termRemaining', 'matchingRights', 'farm'];
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
      ${filtered.map((player) => `<li>${player.name || 'Unnamed Player'}</li>`).join('')}
    </ul>
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

  return `
    <section class="panel details-panel">
      <div class="details-header">
        <h2>${selectedOwner.name}</h2>
      </div>
      ${ownerSummary}
      ${cards}
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

  const aggregates = computeOwnerAggregates(unifiedState);
  const leagueHtml = renderLeagueIntelligence(aggregates);
  const dataQualityHtml = renderDataQualityPanel(unifiedState);

  const app = document.getElementById('app');
  const title = document.getElementById('pageTitle');
  if (title) title.textContent = 'Owner View';

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

  renderViewToggle();
  document.getElementById('backToImportBtn').classList.remove('hidden');

  document.querySelectorAll('.owner-item').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedOwner = button.dataset.owner;
      renderOwnerView(unifiedState);
    });
  });

  const ownerSearchInput = document.getElementById('ownerSearchInput');
  if (ownerSearchInput) {
    ownerSearchInput.addEventListener('input', (e) => {
      state.ownerSearch = e.target.value || '';
      renderOwnerView(unifiedState);
    });
  }

  const playerSearchInput = document.getElementById('playerSearchInput');
  if (playerSearchInput) {
    playerSearchInput.addEventListener('input', (e) => {
      state.playerSearch = e.target.value || '';
      renderOwnerView(unifiedState);
    });
  }
}

function renderImportScreen() {
  const app = document.getElementById('app');
  const title = document.getElementById('pageTitle');
  if (title) title.textContent = 'Owner View';
  app.innerHTML = `
    <section class="panel import-card">
      <div class="dropzone">
        <strong>Upload a CSV</strong>
        <p>Import prospects or veterans data to build the owner dashboard.</p>
        <div class="file-input-wrap">
          <input id="csvFileInput" type="file" accept=".csv,text/csv" />
          <span class="file-placeholder">Choose CSV File</span>
        </div>
      </div>
    </section>
  `;

  document.getElementById('backToImportBtn').classList.add('hidden');
  renderViewToggle();

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
  } else {
    parsedData = parseVeterans(csvText);
  }

  if (!parsedData || (!parsedData.prospects && !parsedData.veterans)) {
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
    const current = loadState();
    const next = mergeDataset(current, datasetType, parsedData, fileName);
    persistState(next);

    state.importedData = next;
    renderCurrentView();
  });
}

async function bootstrapDefaultData() {
  const bootstrapFiles = [
    { datasetType: 'prospects', fileName: 'Data/Rosters/AHL Draft - Prospects.csv' },
    { datasetType: 'veterans', fileName: 'Data/Rosters/AHL Draft - Veterans.csv' },
  ];

  let nextState = loadState();
  let bootstrapped = false;

  for (const entry of bootstrapFiles) {
    const urls = getRuntimeDataCandidates(entry.fileName);
    let csvText = null;

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          csvText = await response.text();
          break;
        }
      } catch (error) {
        csvText = null;
      }
    }

    if (!csvText) {
      continue;
    }

    const parsedData = entry.datasetType === 'prospects' ? parseProspects(csvText) : parseVeterans(csvText);
    if (!parsedData || (!parsedData.prospects && !parsedData.veterans)) {
      continue;
    }

    nextState = mergeDataset(nextState, entry.datasetType, parsedData, entry.fileName);
    bootstrapped = true;
  }

  if (!bootstrapped) {
    return null;
  }

  persistState(nextState);
  state.importedData = nextState;
  return nextState;
}

async function initialize() {
  const backToImportBtn = document.getElementById('backToImportBtn');
  backToImportBtn.addEventListener('click', () => {
    state.selectedOwner = null;
    state.currentView = 'owner';
    renderImportScreen();
  });

  const ownerViewBtn = document.getElementById('ownerViewBtn');
  ownerViewBtn?.addEventListener('click', () => {
    state.currentView = 'owner';
    renderCurrentView();
  });

  const prospectViewBtn = document.getElementById('prospectViewBtn');
  prospectViewBtn?.addEventListener('click', async () => {
    state.currentView = 'prospect';
    if (!state.playerReferenceLookup) {
      await hydratePlayerReferenceData();
    }
    if (!state.historicalLookup) {
      await hydrateHistoricalData();
    }
    renderCurrentView();
  });

  const stored = loadState();
  state.importedData = stored;
  state.selectedOwner = null;
  state.currentView = 'owner';
  state.prospectFilters = createDefaultProspectFilters();
  state.playerManualOverrides = loadPlayerManualOverrides();
  state.manualOverrideDraft = { source: '', target: '' };

  const anyLoaded = ['prospects','veterans','roster','transactions'].some(k => stored?.metadata?.[k]?.status === 'ok');
  if (anyLoaded) {
    await hydratePlayerReferenceData();
    await hydrateHistoricalData();
    renderCurrentView();
    return;
  }

  const bootstrapped = await bootstrapDefaultData();
  if (bootstrapped) {
    await hydratePlayerReferenceData();
    await hydrateHistoricalData();
    renderCurrentView();
    return;
  }

  renderImportScreen();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initialize);
}

export { STORAGE_KEY, state };