import { jest } from '@jest/globals';
import {
  getLiveCacheStatus,
  getDataQualitySources,
  isRetentionListLoaded,
  parsePortableStateBundle,
  resolveWorkingAssignmentTeamName,
  refreshGoogleSheetState,
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

  test('rejects malformed legacy objects that only contain a truthy datasets field', () => {
    expect(() => parsePortableStateBundle({ datasets: true })).toThrow('This file does not contain a Hockey Dashboard saved state.');
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

describe('live refresh status mapping', () => {
  test('uses refreshed retained-grid data as the retention list', () => {
    expect(isRetentionListLoaded({
      datasets: {
        veterans: { veterans: {} },
        roster: { sources: { 'retained-grid': { players: { player: { name: 'Retained Player' } } } } },
      },
    })).toBe(true);
  });

  test('does not report unsourced veteran and transaction imports as failed after live refresh', () => {
    const sources = getDataQualitySources({
      metadata: {
        prospects: { status: 'ok', records: 2, sourceName: 'google-rookie-rights.csv' },
        veterans: { status: 'empty' },
        roster: { status: 'ok', records: 10, importedAt: '2026-09-27T12:00:00.000Z' },
        transactions: { status: 'empty' },
      },
      datasets: {
        roster: {
          sources: {
            inventory: { players: { one: {} } },
            utility: { players: { two: {} } },
            'retained-grid': { players: { three: {} } },
            'league-layout': { players: { four: {} } },
          },
        },
      },
    });

    expect(sources.map(({ label }) => label)).toEqual(['Prospects', 'Positions', 'Utility', 'Retention', 'Roster']);
    expect(sources.every(({ status }) => status === 'ok')).toBe(true);
  });
});

describe('working assignment team matching', () => {
  test('uses the canonical owner name when team input differs only by case', () => {
    expect(resolveWorkingAssignmentTeamName('Fighting Irish', [{ name: 'FIGHTING IRISH' }]))
      .toBe('FIGHTING IRISH');
  });

  test('preserves a team name that does not match a known owner', () => {
    expect(resolveWorkingAssignmentTeamName('Expansion Team', [{ name: 'FIGHTING IRISH' }]))
      .toBe('Expansion Team');
  });
});

describe('google sheet refresh integration', () => {
  test('merges the multi-sheet live snapshot without dropping saved state', async () => {
    const responses = [
      [
        'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
        'LW One,ANA,C One,BOS,RW One,BUF,D One,CGY',
      ].join('\n'),
      [
        'UTILITY,,',
        'Utility One,NYR,C/L',
      ].join('\n'),
      [
        'TEAM A,,,,TEAM B,,,',
        '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
        '1,Connor Bedard,C,$5.00,1,Matthew Knies,LW,$3.00',
        ',TOTAL SPENT,,$5.00,,TOTAL SPENT,,$3.00',
      ].join('\n'),
      [
        ',TEAM A,TEAM B',
        'C,Connor Bedard,',
        'LW,,Matthew Knies',
        'D,Nick Perbix,',
        'RW,,Jake Guentzel',
      ].join('\n'),
      [
        'TEAMS,',
        'TEAM A,',
        'Connor Bedard C - 2023,$5,2,,,,Y',
        'TEAM B,',
        'Matthew Knies LW - 2021,$3,1,,,,N',
      ].join('\n'),
    ];

    const fetchMock = jest.fn(async () => ({
      ok: true,
      text: async () => responses.shift(),
    }));

    const next = await refreshGoogleSheetState({
      version: 2,
      datasets: { prospects: null, veterans: null, roster: null, transactions: null },
      metadata: {
        prospects: { status: 'empty' },
        veterans: { status: 'empty' },
        roster: { status: 'empty' },
        transactions: { status: 'empty' },
      },
      manualOverrides: [{ id: 'manual-1', name: 'Manual Player' }],
      workingAssignments: {
        'nick perbix': { playerKey: 'nick perbix', name: 'Nick Perbix' },
      },
    }, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(next.datasets.roster.layout).toBe('merged');
    expect(Object.keys(next.datasets.roster.sources)).toEqual(expect.arrayContaining([
      'inventory',
      'utility',
      'retained-grid',
      'league-layout',
    ]));
    expect(next.datasets.roster.players['connor-bedard']).toMatchObject({
      name: 'Connor Bedard',
      owner: 'TEAM A',
      retained: true,
      position: 'C',
    });
    expect(next.datasets.roster.players['utility-one']).toMatchObject({
      name: 'Utility One',
      position: 'U',
    });
    expect(next.datasets.prospects.isRightsList).toBe(true);
    expect(next.metadata.roster.sourceName).toBe('google-live-roster.csv');
    expect(next.metadata.prospects.sourceName).toBe('google-rookie-rights.csv');
    expect(next.manualOverrides).toHaveLength(1);
    expect(next.workingAssignments['nick perbix'].name).toBe('Nick Perbix');
  });
});
