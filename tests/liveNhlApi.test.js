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
    expect(normalizeTeamAbbrev('CBS')).toBe('CBJ');
    expect(normalizeTeamAbbrev('VEG')).toBe('VGK');
    expect(normalizeTeamAbbrev('WIN')).toBe('WPG');
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

  function buildSnapshotFetchImpl(snapshot) {
    return jest.fn(async (url) => {
      if (url === './data/nhl-snapshot.json') {
        return { ok: true, status: 200, json: async () => snapshot };
      }
      throw new Error(`Unexpected fetch in snapshot-based test: ${url}`);
    });
  }

  test('loads the preloaded NHL snapshot once per cache and resolves GP by team roster match', async () => {
    const snapshot = {
      version: 1,
      teams: {
        FLA: {
          teamAbbrev: 'FLA',
          roster: {
            forwards: [
              { playerId: 1, fullName: 'Farm Player', sweaterNumber: 10, positionCode: 'C' },
              { playerId: 2, fullName: 'Rookie Player', sweaterNumber: 11, positionCode: 'LW' },
            ],
            defensemen: [],
            goalies: [],
          },
          standings: null,
        },
      },
      players: {
        1: { playerId: 1, fullName: 'Farm Player', careerTotals: { gamesPlayed: 9 } },
        2: { playerId: 2, fullName: 'Rookie Player', careerTotals: { gamesPlayed: 10 } },
      },
    };
    const fetchImpl = buildSnapshotFetchImpl(snapshot);
    const cache = { version: 1, players: {}, teams: {} };
    const [farm, rookie] = await Promise.all(['Farm Player', 'Rookie Player'].map((name) => (
      resolveLivePlayerProfile({
        player: { name, nhlteam: 'FLO', playerKey: `draft:${name}` },
        cache, fetchImpl, includeTeamContext: false,
      })
    )));
    expect([farm.historical.gamesPlayed, rookie.historical.gamesPlayed]).toEqual([9, 10]);
    // Snapshot is fetched once and cached on the shared cache object.
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const stale = {
      status: 'ok', fetchedAt: '2026-09-29T12:00:00.000Z',
      playerKey: 'draft:Farm Player', playerName: 'Farm Player',
      historical: { gamesPlayed: null },
    };
    cache.players['draft:Farm Player'] = stale;
    const refreshed = await resolveLivePlayerProfile({
      player: { name: 'Farm Player', nhlteam: 'FLA', playerKey: 'draft:Farm Player' },
      cache, fetchImpl, includeTeamContext: false,
    });
    expect(refreshed.historical.gamesPlayed).toBe(9);
    expect(refreshed).not.toBe(stale);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('hydrates player and team context from the NHL snapshot', async () => {
    const snapshot = {
      version: 1,
      teams: {
        EDM: {
          teamAbbrev: 'EDM',
          roster: {
            forwards: [
              { playerId: 8478402, fullName: 'Connor McDavid', sweaterNumber: 97, positionCode: 'C', shootsCatches: 'L' },
            ],
            defensemen: [],
            goalies: [],
          },
          schedule: {
            gamesRemaining: 40,
            nextGame: { gameDate: '2099-01-01', opponentAbbrev: 'CGY', homeRoad: 'H' },
          },
          standings: { divisionName: 'Pacific' },
        },
      },
      players: {
        8478402: {
          playerId: 8478402,
          fullName: 'Connor McDavid',
          currentTeamAbbrev: 'EDM',
          currentTeamName: 'Edmonton Oilers',
          nhlPosition: 'Center',
          rosterStatus: 'Active',
          sweaterNumber: 97,
          shootsCatches: 'L',
          featuredSeason: 20252026,
          currentSeason: { points: 138 },
          careerTotals: { points: 1220, gamesPlayed: 794 },
        },
      },
    };
    global.fetch = buildSnapshotFetchImpl(snapshot);

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

  test('marks the profile offline when the snapshot fails to load', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));

    const profile = await resolveLivePlayerProfile({
      player: { playerKey: 'prospect:no-snapshot', name: 'No Snapshot', poolPosition: 'C' },
      cache: { version: 1, updatedAt: null, players: {}, teams: {} },
    });

    expect(profile.status).toBe('offline');
    expect(profile.historical.gamesPlayed).toBeUndefined();
  });

  test('does not mutate the local authoritative player object', async () => {
    global.fetch = buildSnapshotFetchImpl({
      version: 1,
      teams: {
        EDM: {
          teamAbbrev: 'EDM',
          roster: {
            forwards: [{ playerId: 8478402, fullName: 'Connor McDavid', sweaterNumber: 97, positionCode: 'C', shootsCatches: 'L' }],
            defensemen: [],
            goalies: [],
          },
          standings: null,
        },
      },
      players: {
        8478402: {
          playerId: 8478402,
          fullName: 'Connor McDavid',
          currentTeamAbbrev: 'EDM',
          currentTeamName: 'Edmonton Oilers',
          careerTotals: { gamesPlayed: 794 },
          currentSeason: {},
        },
      },
    });

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
