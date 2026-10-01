const NHL_API_BASE = 'https://api-web.nhle.com/v1';
const LIVE_CACHE_KEY = 'hockey-dashboard-live-cache';
const LIVE_CACHE_VERSION = 1;

function createEmptyLiveCache() {
  return {
    version: LIVE_CACHE_VERSION,
    updatedAt: null,
    players: {},
    teams: {},
  };
}

function normalizeLookupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getRosterPlayerIdentityAliases(name) {
  const normalized = normalizeLookupKey(name);
  if (!normalized) return [];
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) return [normalized];
  return [...new Set([normalized, `${parts[0][0]} ${parts.slice(1).join(' ')}`])];
}

function normalizeTeamAbbrev(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'FLO') return 'FLA';
  return /^[A-Z]{3}$/.test(text) ? text : '';
}

function pickRecordValue(record, keys) {
  if (!record) return '';
  for (const key of keys) {
    const direct = record[key];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      return direct;
    }
  }
  return '';
}

function extractPlayerName(record) {
  return String(
    pickRecordValue(record, ['name', 'fullName', 'fullname', 'playerName', 'displayName', 'player'])
  ).trim();
}

function extractPlayerId(record) {
  const value = pickRecordValue(record, ['nhlPlayerId', 'playerId', 'personId', 'nhlId', 'id']);
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractTeamAbbrev(record) {
  const direct = pickRecordValue(record, [
    'nhlteam',
    'nhl team',
    'currentTeamAbbrev',
    'teamAbbrev',
    'nhlTeamAbbrev',
    'abbrev',
    'team',
  ]);
  return normalizeTeamAbbrev(direct);
}

function loadLiveCache() {
  if (typeof localStorage === 'undefined') {
    return createEmptyLiveCache();
  }

  const raw = localStorage.getItem(LIVE_CACHE_KEY);
  if (!raw) {
    return createEmptyLiveCache();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== LIVE_CACHE_VERSION) {
      return createEmptyLiveCache();
    }

    return {
      version: LIVE_CACHE_VERSION,
      updatedAt: parsed.updatedAt || null,
      players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
      teams: parsed.teams && typeof parsed.teams === 'object' ? parsed.teams : {},
    };
  } catch (err) {
    return createEmptyLiveCache();
  }
}

function persistLiveCache(cache) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const next = {
    version: LIVE_CACHE_VERSION,
    updatedAt: new Date().toISOString(),
    players: cache.players || {},
    teams: cache.teams || {},
  };

  localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(next));
  cache.version = next.version;
  cache.updatedAt = next.updatedAt;
}

function upsertCacheEntry(cache, bucket, key, value) {
  if (!cache[bucket] || typeof cache[bucket] !== 'object') {
    cache[bucket] = {};
  }

  cache[bucket][key] = value;
  persistLiveCache(cache);
}

function getSeasonId(referenceDate = new Date()) {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const seasonStart = month >= 7 ? year : year - 1;
  return Number(`${seasonStart}${seasonStart + 1}`);
}

async function fetchJson(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available');
  }

  const localLauncher = typeof location !== 'undefined' && location.protocol === 'http:'
    && location.port === '3000' && /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(location.hostname);
  const requestUrl = localLauncher && url.startsWith(`${NHL_API_BASE}/`)
    ? `/nhl-api/v1/${url.slice(`${NHL_API_BASE}/`.length)}` : url;
  const response = await fetchImpl(requestUrl);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${requestUrl}`);
  }

  return response.json();
}

function formatTeamName(teamNode) {
  if (!teamNode) return '';
  if (typeof teamNode === 'string') return teamNode;
  return teamNode.default || teamNode.name || teamNode.abbrev || '';
}

function formatNhlPosition(positionCode) {
  const code = String(positionCode || '').trim().toUpperCase();
  const map = {
    C: 'Center',
    LW: 'Left Wing',
    RW: 'Right Wing',
    D: 'Defenseman',
    G: 'Goalie',
    F: 'Forward',
    LD: 'Defenseman',
    RD: 'Defenseman',
  };

  return map[code] || code || '';
}

function summarizeStandings(teamAbbrev, standingsPayload) {
  const standings = Array.isArray(standingsPayload?.standings) ? standingsPayload.standings : [];
  const entry = standings.find((item) => {
    const abbrev = item?.teamAbbrev?.default || item?.teamAbbrev || item?.team?.abbrev || '';
    return normalizeTeamAbbrev(abbrev) === normalizeTeamAbbrev(teamAbbrev);
  });

  if (!entry) {
    return null;
  }

  return {
    conferenceName: entry.conferenceName || '',
    conferenceAbbrev: entry.conferenceAbbrev || '',
    divisionName: entry.divisionName || '',
    divisionAbbrev: entry.divisionAbbrev || '',
    points: entry.points ?? null,
    wins: entry.wins ?? null,
    losses: entry.losses ?? null,
    otLosses: entry.otLosses ?? null,
    pointPctg: entry.pointPctg ?? null,
    placeName: formatTeamName(entry.placeName),
    teamName: formatTeamName(entry.teamName),
    teamAbbrev: formatTeamName(entry.teamAbbrev),
    seasonId: entry.seasonId ?? null,
  };
}

function summarizeRoster(rosterPayload) {
  const forwards = Array.isArray(rosterPayload?.forwards) ? rosterPayload.forwards : [];
  const defensemen = Array.isArray(rosterPayload?.defensemen) ? rosterPayload.defensemen : [];
  const goalies = Array.isArray(rosterPayload?.goalies) ? rosterPayload.goalies : [];

  const mapPlayer = (player) => ({
    playerId: player.id ?? null,
    fullName: `${player.firstName?.default || ''} ${player.lastName?.default || ''}`.trim(),
    firstName: player.firstName?.default || '',
    lastName: player.lastName?.default || '',
    sweaterNumber: player.sweaterNumber ?? null,
    positionCode: player.positionCode || '',
    shootsCatches: player.shootsCatches || '',
  });

  return {
    forwards: forwards.map(mapPlayer),
    defensemen: defensemen.map(mapPlayer),
    goalies: goalies.map(mapPlayer),
    playerCount: forwards.length + defensemen.length + goalies.length,
    forwardsCount: forwards.length,
    defensemenCount: defensemen.length,
    goaliesCount: goalies.length,
  };
}

function summarizeSchedule(teamAbbrev, schedulePayload) {
  const games = Array.isArray(schedulePayload?.games) ? schedulePayload.games : [];
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const futureGames = games.filter((game) => String(game.gameDate || '') >= todayIso);

  const toSummary = (game) => {
    const homeAbbrev = game?.homeTeam?.abbrev || '';
    const awayAbbrev = game?.awayTeam?.abbrev || '';
    const isHome = normalizeTeamAbbrev(homeAbbrev) === normalizeTeamAbbrev(teamAbbrev);
    const opponent = isHome ? game?.awayTeam : game?.homeTeam;

    return {
      gameId: game?.id ?? null,
      gameDate: game?.gameDate || '',
      startTimeUTC: game?.startTimeUTC || '',
      venue: formatTeamName(game?.venue),
      homeRoad: isHome ? 'H' : 'R',
      opponentAbbrev: opponent?.abbrev || '',
      opponentName: formatTeamName(opponent?.commonName || opponent?.placeName || opponent?.abbrev),
      gameState: game?.gameState || '',
      gameCenterLink: game?.gameCenterLink || '',
    };
  };

  const nextGames = futureGames.slice(0, 3).map(toSummary);
  const inWindow = (days) => {
    const limit = new Date(today);
    limit.setDate(limit.getDate() + days);
    const limitIso = limit.toISOString().slice(0, 10);
    return futureGames.filter((game) => String(game.gameDate || '') <= limitIso).length;
  };

  return {
    seasonId: schedulePayload?.currentSeason ?? null,
    clubTimezone: schedulePayload?.clubTimezone || '',
    clubUTCOffset: schedulePayload?.clubUTCOffset || '',
    totalGames: games.length,
    gamesRemaining: futureGames.length,
    gamesNext7Days: inWindow(7),
    gamesNext14Days: inWindow(14),
    gamesNext30Days: inWindow(30),
    nextGame: nextGames[0] || null,
    nextGames,
  };
}

function summarizePlayerLanding(landingPayload) {
  if (!landingPayload) return null;

  const subSeason = landingPayload?.featuredStats?.regularSeason?.subSeason || {};
  const career = landingPayload?.careerTotals?.regularSeason || {};

  return {
    playerId: landingPayload.playerId ?? null,
    fullName: `${landingPayload.firstName?.default || ''} ${landingPayload.lastName?.default || ''}`.trim(),
    firstName: landingPayload.firstName?.default || '',
    lastName: landingPayload.lastName?.default || '',
    currentTeamId: landingPayload.currentTeamId ?? null,
    currentTeamAbbrev: landingPayload.currentTeamAbbrev || '',
    currentTeamName: formatTeamName(landingPayload.fullTeamName),
    teamCommonName: formatTeamName(landingPayload.teamCommonName),
    nhlPosition: formatNhlPosition(landingPayload.position || ''),
    rosterStatus: landingPayload.isActive ? 'Active' : 'Inactive',
    sweaterNumber: landingPayload.sweaterNumber ?? null,
    shootsCatches: landingPayload.shootsCatches || '',
    headshot: landingPayload.headshot || '',
    featuredSeason: landingPayload?.featuredStats?.season ?? null,
    currentSeason: {
      gamesPlayed: subSeason.gamesPlayed ?? null,
      goals: subSeason.goals ?? null,
      assists: subSeason.assists ?? null,
      points: subSeason.points ?? null,
      shots: subSeason.shots ?? null,
      plusMinus: subSeason.plusMinus ?? null,
      pim: subSeason.pim ?? null,
      powerPlayGoals: subSeason.powerPlayGoals ?? null,
      powerPlayPoints: subSeason.powerPlayPoints ?? null,
      shorthandedGoals: subSeason.shorthandedGoals ?? null,
      shorthandedPoints: subSeason.shorthandedPoints ?? null,
    },
    careerTotals: {
      gamesPlayed: career.gamesPlayed ?? null,
      goals: career.goals ?? null,
      assists: career.assists ?? null,
      points: career.points ?? null,
      shots: career.shots ?? null,
      avgToi: career.avgToi ?? null,
      faceoffWinningPctg: career.faceoffWinningPctg ?? null,
    },
    last5Games: Array.isArray(landingPayload.last5Games)
      ? landingPayload.last5Games.map((game) => ({
          gameDate: game.gameDate || '',
          opponentAbbrev: game.opponentAbbrev || '',
          gameTypeId: game.gameTypeId ?? null,
          goals: game.goals ?? null,
          assists: game.assists ?? null,
          points: game.points ?? null,
          shots: game.shots ?? null,
          toi: game.toi || '',
          homeRoadFlag: game.homeRoadFlag || '',
        }))
      : [],
  };
}

async function fetchTeamContext(teamAbbrev, fetchImpl = globalThis.fetch) {
  const abbrev = normalizeTeamAbbrev(teamAbbrev);
  if (!abbrev) return null;

  const [rosterPayload, schedulePayload, standingsPayload] = await Promise.all([
    fetchJson(`${NHL_API_BASE}/roster/${abbrev}/current`, fetchImpl),
    fetchJson(`${NHL_API_BASE}/club-schedule-season/${abbrev}/current`, fetchImpl),
    fetchJson(`${NHL_API_BASE}/standings/now`, fetchImpl),
  ]);

  return {
    teamAbbrev: abbrev,
    roster: summarizeRoster(rosterPayload),
    schedule: summarizeSchedule(abbrev, schedulePayload),
    standings: summarizeStandings(abbrev, standingsPayload),
  };
}

function findRosterMatch(teamRosterPayload, playerName) {
  const normalizedTarget = normalizeLookupKey(playerName);
  if (!normalizedTarget) return null;

  const groups = [
    ...(Array.isArray(teamRosterPayload?.forwards) ? teamRosterPayload.forwards : []),
    ...(Array.isArray(teamRosterPayload?.defensemen) ? teamRosterPayload.defensemen : []),
    ...(Array.isArray(teamRosterPayload?.goalies) ? teamRosterPayload.goalies : []),
  ];

  for (const player of groups) {
    const fullName = `${player.firstName?.default || ''} ${player.lastName?.default || ''}`.trim();
    if (normalizeLookupKey(fullName) === normalizedTarget) {
      return {
        playerId: player.id ?? null,
        fullName,
        sweaterNumber: player.sweaterNumber ?? null,
        positionCode: player.positionCode || '',
        shootsCatches: player.shootsCatches || '',
      };
    }
  }

  return null;
}

async function fetchPlayerLanding(playerId, fetchImpl = globalThis.fetch) {
  const id = Number(playerId);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return fetchJson(`${NHL_API_BASE}/player/${id}/landing`, fetchImpl);
}

async function resolveLivePlayerProfile({
  player, rosterRecord = null, cache, fetchImpl = globalThis.fetch,
  includeTeamContext = true, teamRosterRequests = null,
}) {
  const playerName = extractPlayerName(player) || extractPlayerName(rosterRecord);
  const playerKey = player?.playerKey || `player:${normalizeLookupKey(playerName)}`;
  const cacheStore = cache || createEmptyLiveCache();
  const cached = cacheStore.players?.[playerKey] || null;
  if (cached && cached.status === 'ok' && cached.fetchedAt
    && (includeTeamContext || Number.isInteger(cached.historical?.gamesPlayed))) {
    return cached;
  }

  const teamAbbrev = normalizeTeamAbbrev(
    extractTeamAbbrev(rosterRecord) || extractTeamAbbrev(player) || ''
  );
  const explicitPlayerId = extractPlayerId(player) || extractPlayerId(rosterRecord);

  const profile = {
    playerKey,
    playerName,
    status: 'partial',
    fetchedAt: new Date().toISOString(),
    sources: {
      local: true,
      live: false,
      rosterMatch: false,
      playerLanding: false,
    },
    errors: [],
    identity: {
      playerId: explicitPlayerId,
      teamAbbrev,
      teamName: '',
      currentTeamAbbrev: '',
      currentTeamName: '',
      poolPosition: String(player?.poolPosition || rosterRecord?.poolPosition || '').toUpperCase(),
      nhlPosition: '',
      rosterStatus: '',
      sweaterNumber: null,
      shootsCatches: '',
      headshot: '',
    },
    currentSeason: {},
    historical: {},
    team: null,
    schedule: null,
  };

  let livePlayerId = explicitPlayerId;
  let playerLanding = null;
  let teamContext = null;

  if (!livePlayerId && teamAbbrev && playerName) {
    try {
      const rosterUrl = `${NHL_API_BASE}/roster/${teamAbbrev}/current`;
      if (teamRosterRequests && !teamRosterRequests.has(teamAbbrev)) {
        teamRosterRequests.set(teamAbbrev, fetchJson(rosterUrl, fetchImpl));
      }
      const teamRosterPayload = teamRosterRequests
        ? await teamRosterRequests.get(teamAbbrev) : await fetchJson(rosterUrl, fetchImpl);
      profile.sources.live = true;
      profile.sources.rosterMatch = true;
      const rosterMatch = findRosterMatch(teamRosterPayload, playerName);
      if (rosterMatch) {
        livePlayerId = rosterMatch.playerId;
        profile.identity.sweaterNumber = rosterMatch.sweaterNumber;
        profile.identity.nhlPosition = formatNhlPosition(rosterMatch.positionCode);
        profile.identity.shootsCatches = rosterMatch.shootsCatches;
      }
    } catch (err) {
      profile.errors.push(`team roster lookup failed: ${err.message}`);
    }
  }

  if (livePlayerId) {
    try {
      const landingPayload = await fetchPlayerLanding(livePlayerId, fetchImpl);
      if (landingPayload) {
        playerLanding = summarizePlayerLanding(landingPayload);
        profile.sources.live = true;
        profile.sources.playerLanding = true;
        profile.identity = {
          playerId: playerLanding.playerId,
          teamAbbrev: profile.identity.teamAbbrev,
          teamName: profile.identity.teamName || '',
          currentTeamAbbrev: playerLanding.currentTeamAbbrev || '',
          currentTeamName: playerLanding.currentTeamName || '',
          poolPosition: profile.identity.poolPosition,
          nhlPosition: playerLanding.nhlPosition || profile.identity.nhlPosition,
          rosterStatus: playerLanding.rosterStatus || '',
          sweaterNumber: playerLanding.sweaterNumber ?? profile.identity.sweaterNumber,
          shootsCatches: playerLanding.shootsCatches || profile.identity.shootsCatches,
          headshot: playerLanding.headshot || '',
        };
        profile.featuredSeason = playerLanding.featuredSeason;
        profile.currentSeason = playerLanding.currentSeason;
        profile.historical = playerLanding.careerTotals;
        const liveTeamAbbrev = profile.identity.currentTeamAbbrev || profile.identity.teamAbbrev;
        if (includeTeamContext && liveTeamAbbrev && cacheStore.teams?.[liveTeamAbbrev]) {
          teamContext = cacheStore.teams[liveTeamAbbrev];
        } else if (includeTeamContext) {
          teamContext = liveTeamAbbrev
            ? await fetchTeamContext(liveTeamAbbrev, fetchImpl)
            : null;
          if (teamContext && liveTeamAbbrev) {
            upsertCacheEntry(cacheStore, 'teams', liveTeamAbbrev, teamContext);
          }
        }
      }
    } catch (err) {
      profile.errors.push(`player landing lookup failed: ${err.message}`);
    }
  }

  const currentTeamAbbrev = profile.identity.currentTeamAbbrev || teamAbbrev;

  if (includeTeamContext && !teamContext && currentTeamAbbrev) {
    try {
      if (cacheStore.teams?.[currentTeamAbbrev]) {
        teamContext = cacheStore.teams[currentTeamAbbrev];
      } else {
        teamContext = await fetchTeamContext(currentTeamAbbrev, fetchImpl);
        if (teamContext) {
          upsertCacheEntry(cacheStore, 'teams', currentTeamAbbrev, teamContext);
        }
      }
      if (teamContext) {
        profile.sources.live = true;
      }
    } catch (err) {
      profile.errors.push(`team context lookup failed: ${err.message}`);
    }
  }

  if (teamContext) {
    profile.team = {
      teamAbbrev: teamContext.teamAbbrev,
      roster: teamContext.roster,
      standings: teamContext.standings,
    };
    profile.schedule = teamContext.schedule;
    if (!profile.identity.currentTeamName && teamContext.standings?.teamName) {
      profile.identity.currentTeamName = teamContext.standings.teamName;
    }
    if (!profile.identity.currentTeamAbbrev && teamContext.teamAbbrev) {
      profile.identity.currentTeamAbbrev = teamContext.teamAbbrev;
    }
  }

  profile.status = profile.errors.length ? (profile.sources.live ? 'partial' : 'offline') : 'ok';
  upsertCacheEntry(cacheStore, 'players', playerKey, profile);
  return profile;
}

export {
  NHL_API_BASE,
  LIVE_CACHE_KEY,
  loadLiveCache,
  persistLiveCache,
  normalizeLookupKey,
  getRosterPlayerIdentityAliases,
  normalizeTeamAbbrev,
  pickRecordValue,
  extractPlayerName,
  extractPlayerId,
  extractTeamAbbrev,
  getSeasonId,
  fetchJson,
  summarizePlayerLanding,
  summarizeSchedule,
  summarizeRoster,
  summarizeStandings,
  fetchTeamContext,
  findRosterMatch,
  fetchPlayerLanding,
  resolveLivePlayerProfile,
};
