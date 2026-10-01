import {
  jest,
} from '@jest/globals';

import {
  normalizeLookupKey,
  normalizeTeamAbbrev,
  summarizePlayerLanding,
  resolveLivePlayerProfile,
} from '../liveNhlApi.js';

describe('liveNhlApi helpers', () => {
  test('normalizes names for roster matching', () => {
    expect(normalizeLookupKey('Macklin Celebrini')).toBe('macklin celebrini');
    expect(normalizeLookupKey('José Núñez')).toBe('jose nunez');
    expect(normalizeTeamAbbrev('FLO')).toBe('FLA');
  });

  test('summarizes player landing payloads', () => {
    const summary = summarizePlayerLanding({
      playerId: 8478402,
      isActive: true,
      currentTeamId: 22,
      currentTeamAbbrev: 'EDM',
      fullTeamName: { default: 'Edmonton Oilers' },
      firstName: { default: 'Connor' },
      lastName: { default: 'McDavid' },
      position: 'C',
      sweaterNumber: 97,
      shootsCatches: 'L',
      featuredStats: {
        season: 20252026,
        regularSeason: {
          subSeason: {
            gamesPlayed: 82,
            goals: 48,
            assists: 90,
            points: 138,
            shots: 306,
          },
        },
      },
      careerTotals: {
        regularSeason: {
          gamesPlayed: 794,
          goals: 409,
          assists: 811,
          points: 1220,
          shots: 2713,
          avgToi: '21:52',
        },
      },
    });

    expect(summary.fullName).toBe('Connor McDavid');
    expect(summary.currentSeason.points).toBe(138);
    expect(summary.careerTotals.gamesPlayed).toBe(794);
    expect(summary.rosterStatus).toBe('Active');
    expect(summary.nhlPosition).toBe('Center');
  });
});

describe('resolveLivePlayerProfile', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('draft GP lookup shares team roster requests and skips unrelated team context', async () => {
    const urls = [];
    const fetchImpl = jest.fn(async (url) => {
      urls.push(url);
      if (url.endsWith('/roster/FLA/current')) return {
        ok: true,
        json: async () => ({ forwards: [
          { id: 1, firstName: { default: 'Farm' }, lastName: { default: 'Player' } },
          { id: 2, firstName: { default: 'Rookie' }, lastName: { default: 'Player' } },
        ] }),
      };
      if (/\/player\/[12]\/landing$/.test(url)) return {
        ok: true,
        json: async () => ({
          playerId: Number(url.match(/\/player\/(\d+)\//)[1]),
          careerTotals: { regularSeason: { gamesPlayed: url.includes('/1/') ? 9 : 10 } },
        }),
      };
      throw new Error(`Unexpected NHL endpoint: ${url}`);
    });
    const cache = { version: 1, players: {}, teams: {} };
    const teamRosterRequests = new Map();
    const [farm, rookie] = await Promise.all(['Farm Player', 'Rookie Player'].map((name) => (
      resolveLivePlayerProfile({
        player: { name, nhlteam: 'FLO', playerKey: `draft:${name}` },
        cache, fetchImpl, includeTeamContext: false, teamRosterRequests,
      })
    )));
    expect([farm.historical.gamesPlayed, rookie.historical.gamesPlayed]).toEqual([9, 10]);
    expect(urls.filter((url) => url.endsWith('/roster/FLA/current'))).toHaveLength(1);
    expect(urls).toHaveLength(3);
    const stale = {
      status: 'ok', fetchedAt: '2026-09-29T12:00:00.000Z',
      playerKey: 'draft:Farm Player', playerName: 'Farm Player',
      historical: { gamesPlayed: null },
    };
    cache.players['draft:Farm Player'] = stale;
    const refreshed = await resolveLivePlayerProfile({
      player: { name: 'Farm Player', nhlteam: 'FLA', playerKey: 'draft:Farm Player' },
      cache, fetchImpl, includeTeamContext: false, teamRosterRequests,
    });
    expect(refreshed.historical.gamesPlayed).toBe(9);
    expect(refreshed).not.toBe(stale);
  });

  test('hydrates player and team context from NHL API responses', async () => {
    const responses = {
      'https://api-web.nhle.com/v1/player/8478402/landing': {
        playerId: 8478402,
        isActive: true,
        currentTeamId: 22,
        currentTeamAbbrev: 'EDM',
        fullTeamName: { default: 'Edmonton Oilers' },
        teamCommonName: { default: 'Oilers' },
        firstName: { default: 'Connor' },
        lastName: { default: 'McDavid' },
        position: 'C',
        sweaterNumber: 97,
        shootsCatches: 'L',
        featuredStats: {
          season: 20252026,
          regularSeason: {
            subSeason: {
              gamesPlayed: 82,
              goals: 48,
              assists: 90,
              points: 138,
              shots: 306,
            },
          },
        },
        careerTotals: {
          regularSeason: {
            gamesPlayed: 794,
            goals: 409,
            assists: 811,
            points: 1220,
            shots: 2713,
            avgToi: '21:52',
          },
        },
      },
      'https://api-web.nhle.com/v1/roster/EDM/current': {
        forwards: [
          {
            id: 8478402,
            firstName: { default: 'Connor' },
            lastName: { default: 'McDavid' },
            sweaterNumber: 97,
            positionCode: 'C',
            shootsCatches: 'L',
          },
        ],
        defensemen: [],
        goalies: [],
      },
      'https://api-web.nhle.com/v1/club-schedule-season/EDM/current': {
        currentSeason: 20262027,
        clubTimezone: 'America/Edmonton',
        clubUTCOffset: '-06:00',
        games: [
          {
            id: 1,
            gameDate: '2099-01-01',
            homeTeam: { abbrev: 'EDM', commonName: { default: 'Oilers' } },
            awayTeam: { abbrev: 'CGY', commonName: { default: 'Flames' } },
            gameState: 'FUT',
            gameCenterLink: '/gamecenter',
          },
        ],
      },
      'https://api-web.nhle.com/v1/standings/now': {
        standings: [
          {
            teamAbbrev: { default: 'EDM' },
            teamName: { default: 'Edmonton Oilers' },
            conferenceName: 'Western',
            divisionName: 'Pacific',
            points: 100,
            wins: 45,
            losses: 25,
            otLosses: 7,
          },
        ],
      },
    };

    global.fetch = jest.fn(async (url) => {
      const payload = responses[url];
      if (!payload) {
        return { ok: false, status: 404, json: async () => ({}) };
      }

      return { ok: true, status: 200, json: async () => payload };
    });

    const profile = await resolveLivePlayerProfile({
      player: {
        playerKey: 'prospect:connor-mcdavid',
        playerId: 8478402,
        name: 'Connor McDavid',
        sourceType: 'prospect',
        poolPosition: 'C',
      },
      rosterRecord: { nhlteam: 'WPG' },
      cache: { version: 1, updatedAt: null, players: {}, teams: {} },
    });

    expect(profile.status).toBe('ok');
    expect(profile.identity.teamAbbrev).toBe('WPG');
    expect(profile.identity.currentTeamAbbrev).toBe('EDM');
    expect(profile.identity.currentTeamName).toBe('Edmonton Oilers');
    expect(profile.identity.poolPosition).toBe('C');
    expect(profile.identity.nhlPosition).toBe('Center');
    expect(profile.currentSeason.points).toBe(138);
    expect(profile.historical.points).toBe(1220);
    expect(profile.schedule.nextGame.opponentAbbrev).toBe('CGY');
    expect(profile.team.standings.divisionName).toBe('Pacific');
    expect(global.fetch).toHaveBeenCalled();
  });

  test('does not mutate the local authoritative player object', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        playerId: 8478402,
        isActive: true,
        currentTeamId: 22,
        currentTeamAbbrev: 'EDM',
        fullTeamName: { default: 'Edmonton Oilers' },
        firstName: { default: 'Connor' },
        lastName: { default: 'McDavid' },
        position: 'C',
        sweaterNumber: 97,
        shootsCatches: 'L',
        featuredStats: { season: 20252026, regularSeason: { subSeason: { gamesPlayed: 82, goals: 48, assists: 90, points: 138, shots: 306 } } },
        careerTotals: { regularSeason: { gamesPlayed: 794, goals: 409, assists: 811, points: 1220, shots: 2713, avgToi: '21:52' } },
      }),
    }));

    const player = {
      playerKey: 'prospect:connor-mcdavid',
      playerId: 8478402,
      name: 'Connor McDavid',
      sourceType: 'prospect',
      poolPosition: 'C',
      team: 'WPG',
    };
    const snapshot = JSON.parse(JSON.stringify(player));

    await resolveLivePlayerProfile({
      player,
      rosterRecord: { nhlteam: 'WPG' },
      cache: { version: 1, updatedAt: null, players: {}, teams: {} },
    });

    expect(player).toEqual(snapshot);
  });
});
