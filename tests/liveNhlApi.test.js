import {
  jest,
} from '@jest/globals';

import {
  normalizeLookupKey,
  summarizePlayerLanding,
  resolveLivePlayerProfile,
} from '../liveNhlApi.js';

describe('liveNhlApi helpers', () => {
  test('normalizes names for roster matching', () => {
    expect(normalizeLookupKey('Macklin Celebrini')).toBe('macklin celebrini');
    expect(normalizeLookupKey('José Núñez')).toBe('jose nunez');
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
