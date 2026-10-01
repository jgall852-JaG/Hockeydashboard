import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
  getLiveCacheStatus,
  getDataQualitySources,
  isRetentionListLoaded,
  persistState,
  parsePortableStateBundle,
  resolveWorkingAssignmentTeamName,
  refreshDobberState,
  refreshGoogleSheetState,
  serializePortableStateBundle,
  STORAGE_KEY,
} from '../app.js';
import { DOBBER_EXCEL_URL } from '../dobberIngestion.js';

describe('local draft edit persistence', () => {
  test('mirrors local edits and their timestamp into stored metadata', () => {
    const storage = new Map();
    const previousStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { setItem: (key, value) => storage.set(key, value) },
    });
    try {
      persistState({
        version: 2,
        datasets: {},
        metadata: {},
        localEdits: {
          removedPlayers: ['Player One'],
          manualAssignments: { 'Player Two': 'TEAM A' },
          manualUnassign: [],
          lastUpdated: 1780000000000,
        },
      });
      const saved = JSON.parse(storage.get(STORAGE_KEY));
      expect(saved.localEdits).toEqual(saved.metadata.localDraftEdits);
      expect(saved.metadata.localDraftEdits).toMatchObject({
        removedPlayers: ['player one'],
        manualAssignments: { 'player two': 'TEAM A' },
        lastUpdated: 1780000000000,
      });
      persistState({
        version: 2,
        datasets: {},
        localEdits: { removedPlayers: ['Stale Edit'], lastUpdated: 100 },
        metadata: {
          localDraftEdits: { removedPlayers: ['Newer Edit'], lastUpdated: 200 },
        },
      });
      const reconciled = JSON.parse(storage.get(STORAGE_KEY));
      expect(reconciled.localEdits.removedPlayers).toEqual(['newer edit']);
      expect(reconciled.localEdits.lastUpdated).toBe(200);
    } finally {
      if (previousStorage === undefined) delete globalThis.localStorage;
      else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage });
    }
  });
});

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
        prospects: { status: 'ok', records: 2, sourceName: 'AHL Keeper Rights' },
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
      ',Thursday,October 1,2026\n1,MATCHUP,,TIME\n,Buffalo,@ Columbus,7:00 PM',
      ',Rank,Team,GP,W,L,T,PTS,GF,GA,GD\n,1,Ironmen,0,0,0,0,0,0,0,0',
      ',Player,GP\n,Example,0',
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
      localEdits: {
        removedPlayers: ['former player'],
        manualAssignments: { 'nick perbix': 'TEAM A' },
        manualUnassign: ['another player'],
      },
    }, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(9);
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
    expect(next.metadata.roster.sourceName).toBe('AHL Roster');
    expect(next.metadata.prospects.sourceName).toBe('AHL Keeper Rights');
    expect(next.metadata.ahlSheets.status).toBe('ok');
    expect(Object.keys(next.datasets.ahlScores.tabs)).toEqual([
      'AHL Scores',
      'AHL Scorebulator',
      'AHL Games Played',
    ]);
    expect(next.manualOverrides).toHaveLength(1);
    expect(next.workingAssignments['nick perbix'].name).toBe('Nick Perbix');
    expect(next.localEdits).toMatchObject({
      removedPlayers: [],
      manualAssignments: {},
      manualUnassign: [],
    });
    expect(next.localEdits.lastUpdated).toEqual(expect.any(Number));
    expect(next.metadata.localDraftEdits).toEqual(next.localEdits);
  });
});

describe('Dobber source status', () => {
  test('marks blocked remote sources unavailable without treating them as loaded', async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, status: 403 }));
    const next = await refreshDobberState(null, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(next.state.metadata).toMatchObject({
      dobberStatus: 'unavailable',
      dobberExcel: { status: 'unavailable', sourceType: 'remote', records: 0 },
      dobberPdfs: { status: 'unavailable', sourceType: 'remote', records: 0 },
    });
    expect(next.state.datasets.dobber).toMatchObject({
      players: {},
      intelByPlayerKey: {},
    });
  });

  test('preserves local imports while reporting failed remote attempts', async () => {
    const fetchMock = jest.fn(async () => ({ ok: false, status: 401 }));
    const next = await refreshDobberState({
      datasets: {
        dobber: {
          players: { player: { player: 'Player' } },
          intelByPlayerKey: { player: { sleeperTag: true } },
          excelSourceName: 'dobber.xlsx',
          excelImportedAt: '2026-09-29T12:00:00.000Z',
          pdfSourceName: 'guide.pdf',
          pdfImportedAt: '2026-09-29T12:01:00.000Z',
        },
      },
      metadata: {
        dobberExcel: {
          status: 'loaded-local',
          sourceType: 'local',
          lastImport: '2026-09-29T12:00:00.000Z',
          lastAttempt: { status: 'loaded-local', fileName: 'dobber.xlsx' },
        },
        dobberPdfs: {
          status: 'loaded-local',
          sourceType: 'local',
          lastImport: '2026-09-29T12:01:00.000Z',
        },
      },
    }, fetchMock);

    expect(next.state.metadata).toMatchObject({
      dobberStatus: 'loaded-local',
      dobberExcel: {
        status: 'loaded-local',
        sourceType: 'local',
        records: 1,
        lastImport: '2026-09-29T12:00:00.000Z',
        lastAttempt: { status: 'loaded-local', fileName: 'dobber.xlsx' },
      },
      dobberPdfs: {
        status: 'loaded-local',
        sourceType: 'local',
        records: 1,
        lastImport: '2026-09-29T12:01:00.000Z',
      },
    });
    expect(next.state.datasets.dobber.players.player.player).toBe('Player');
    expect(next.message).toContain('HTTP 401');
  });

  test('adopts the bundled /data Excel workbook when no local import exists and the fetch succeeds', async () => {
    const previousXlsx = globalThis.XLSX;
    globalThis.XLSX = {
      read: () => ({ Sheets: { 'EVERYTHING (Skaters)': {} } }),
      utils: { sheet_to_json: () => [{ Player: 'Bundled Player', Team: 'EDM', POS: 'C' }] },
    };
    try {
      const fetchMock = jest.fn(async (url) => {
        if (url === DOBBER_EXCEL_URL) {
          return { ok: true, arrayBuffer: async () => Uint8Array.from([0x50, 0x4b]).buffer };
        }
        return { ok: false, status: 404 };
      });
      const next = await refreshDobberState(null, fetchMock);

      expect(next.state.metadata.dobberExcel).toMatchObject({
        status: 'loaded-local',
        sourceType: 'bundled',
        records: 1,
      });
      expect(next.state.metadata.dobberPdfs).toMatchObject({ status: 'unavailable', sourceType: 'remote' });
      expect(next.state.metadata.dobberFullyLoaded).toBe(false);
      expect(next.state.datasets.dobber.players['bundled player']).toMatchObject({ player: 'Bundled Player' });
    } finally {
      globalThis.XLSX = previousXlsx;
    }
  });
});

describe('import control wiring', () => {
  test('registers Dobber file listeners outside the CSV upload click handler', () => {
    const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
    const csvUploadHandler = source.indexOf("backToImportBtn.addEventListener('click'");
    const csvUploadHandlerEnd = source.indexOf('\n  });', csvUploadHandler);
    const dobberExcelListener = source.indexOf("dobberExcelFileInput?.addEventListener('change'");
    const dobberPdfListener = source.indexOf("dobberPdfFileInput?.addEventListener('change'");

    expect(csvUploadHandler).toBeGreaterThan(-1);
    expect(csvUploadHandlerEnd).toBeGreaterThan(csvUploadHandler);
    expect(dobberExcelListener).toBeGreaterThan(csvUploadHandlerEnd);
    expect(dobberPdfListener).toBeGreaterThan(csvUploadHandlerEnd);
  });
});
