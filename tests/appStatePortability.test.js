import {
  getLiveCacheStatus,
  parsePortableStateBundle,
  serializePortableStateBundle,
} from '../app.js';

describe('portable state helpers', () => {
  test('serializes normalized app state with live cache for export', () => {
    const bundle = serializePortableStateBundle({
      version: 2,
      datasets: {
        prospects: { prospects: { one: { name: 'Player One', owner: 'TEAM A' } } },
        veterans: null,
        roster: null,
        transactions: null,
      },
      metadata: {
        prospects: { status: 'ok', importedAt: '2026-09-27T13:00:00.000Z', records: 1, sourceName: 'prospects.csv' },
        veterans: { status: 'empty' },
        roster: { status: 'empty' },
        transactions: { status: 'empty' },
      },
      manualOverrides: [{ id: 'manual-1', name: 'Manual Player' }],
      workingAssignments: { alpha: { playerKey: 'alpha' } },
    }, {
      updatedAt: '2026-09-27T13:05:00.000Z',
      players: { 'prospect:player-one': { playerKey: 'prospect:player-one', status: 'ok' } },
      teams: { EDM: { teamAbbrev: 'EDM' } },
    });

    expect(bundle.format).toBe('hockey-dashboard-portable-state');
    expect(bundle.appState.metadata.prospects.sourceName).toBe('prospects.csv');
    expect(bundle.liveCache.players['prospect:player-one'].status).toBe('ok');
    expect(bundle.liveCache.teams.EDM.teamAbbrev).toBe('EDM');
  });

  test('parses exported bundles and preserves app state + cache shape', () => {
    const parsed = parsePortableStateBundle({
      format: 'hockey-dashboard-portable-state',
      version: 1,
      exportedAt: '2026-09-27T14:00:00.000Z',
      appState: {
        version: 2,
        datasets: {
          prospects: null,
          veterans: null,
          roster: { players: { one: { name: 'Roster One', owner: 'TEAM A' } } },
          transactions: null,
        },
        metadata: {
          prospects: { status: 'empty' },
          veterans: { status: 'empty' },
          roster: { status: 'ok', importedAt: '2026-09-27T12:00:00.000Z', records: 1, sourceName: 'roster.csv' },
          transactions: { status: 'empty' },
        },
        manualOverrides: [],
        workingAssignments: {},
      },
      liveCache: {
        updatedAt: '2026-09-27T12:05:00.000Z',
        players: { roster: { playerKey: 'roster', status: 'ok' } },
        teams: {},
      },
    });

    expect(parsed.appState.metadata.roster.status).toBe('ok');
    expect(parsed.liveCache.updatedAt).toBe('2026-09-27T12:05:00.000Z');
    expect(parsed.liveCache.players.roster.status).toBe('ok');
  });

  test('accepts a legacy raw app-state object without wrapper metadata', () => {
    const parsed = parsePortableStateBundle({
      version: 2,
      datasets: {
        prospects: null,
        veterans: {
          veterans: {
            one: { name: 'Veteran One', owner: 'TEAM A', currentCost: 10 },
          },
        },
        roster: null,
        transactions: null,
      },
      metadata: {
        prospects: { status: 'empty' },
        veterans: { status: 'ok', importedAt: '2026-09-27T11:00:00.000Z', records: 1, sourceName: 'veterans.csv' },
        roster: { status: 'empty' },
        transactions: { status: 'empty' },
      },
      manualOverrides: [],
      workingAssignments: {},
    });

    expect(parsed.format).toBe('legacy');
    expect(parsed.appState.metadata.veterans.status).toBe('ok');
    expect(parsed.appState.datasets.veterans.veterans.one.name).toBe('Veteran One');
  });

  test('rejects files that do not contain a saved dashboard state', () => {
    expect(() => parsePortableStateBundle({ nope: true })).toThrow('This file does not contain a Hockey Dashboard saved state.');
  });
});

describe('live cache status', () => {
  test('reports local-only mode when no cache timestamp exists', () => {
    const status = getLiveCacheStatus({ players: {}, teams: {} });
    expect(status.label).toBe('Local data only');
    expect(status.status).toBe('warning');
  });
});
