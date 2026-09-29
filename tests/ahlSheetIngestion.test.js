import {
  AHL_SHEET_SOURCES,
  buildAhlDraftIntelligenceOutputs,
  parseAhlScoreSheet,
} from '../ahlSheetIngestion.js';

describe('AHL sheet ingestion', () => {
  test('uses the authoritative Google workbooks and includes score tabs', () => {
    expect(AHL_SHEET_SOURCES.map(({ name }) => name)).toEqual([
      'AHL Position',
      'AHL Utility',
      'AHL Draft',
      'AHL Roster',
      'AHL Keeper Rights',
      'AHL Scores',
      'AHL Scorebulator',
      'AHL Games Played',
    ]);
    expect(AHL_SHEET_SOURCES.find(({ name }) => name === 'AHL Roster').spreadsheetId)
      .toBe(AHL_SHEET_SOURCES[0].spreadsheetId);
    expect(AHL_SHEET_SOURCES.at(-1).spreadsheetId).not.toBe(AHL_SHEET_SOURCES[0].spreadsheetId);
  });

  test('parses AHL score sheets without treating team totals as player scores', () => {
    const parsed = parseAhlScoreSheet(
      ',Rank,Team,GP,PTS\n,1,Ironmen,0,0\n',
      'AHL Scorebulator',
    );

    expect(parsed.tabName).toBe('AHL Scorebulator');
    expect(parsed.rows).toEqual([
      ['', 'Rank', 'Team', 'GP', 'PTS'],
      ['', '1', 'Ironmen', '0', '0'],
    ]);
  });

  test('rebuilds the five JSON views from AHL pool, positions, utility, and keeper records', () => {
    const stalePricedPlayer = {
      id: 'player-one',
      name: 'Player One',
      position: 'LW',
      auctionValue: 22,
      draftIQ: 80,
      classification: 'VALUE',
      deployment: { DS: 50, RSS: 50, OS: 50, RRS: 20 },
      production: { PPS: 80 },
      prospect: { BPS: 60 },
      keeper: { KVS: 40 },
      sourcesUsed: {},
      missingSources: {},
    };
    const outputs = Object.fromEntries(['players', 'auction', 'tiers', 'keepers', 'prospects'].map((name) => [
      name,
      {
        sourceAvailability: {},
        sourceCoverage: {},
        players: name === 'players' || name === 'auction' ? [stalePricedPlayer] : [],
        keepers: [],
        prospects: [],
        tiers: {},
      },
    ]));
    const state = {
      datasets: {
        roster: {
          players: {
            'player-one': {
              name: 'Player One',
              owner: '',
              position: 'LW',
              poolposition: 'LW',
              nhlteam: 'AAA',
              cost: '',
              classification: 'Rookie',
            },
            'player-two': {
              name: 'Player Two',
              owner: 'TEAM A',
              position: 'U',
              poolposition: 'C/L',
              nhlteam: 'BBB',
              cost: 3.5,
            },
          },
          sources: {
            inventory: {
              players: {
                'player-one': { name: 'Player One', position: 'LW', poolposition: 'LW', nhlteam: 'AAA' },
              },
            },
            utility: {
              players: {
                'player-two': { name: 'Player Two', position: 'U', poolposition: 'C/L', nhlteam: 'BBB' },
              },
            },
          },
        },
        prospects: {
          prospects: {
            'player-two': { name: 'Player Two', owner: 'TEAM A', cost: 3.5, termRemaining: 1, matchingRights: true },
          },
        },
        ahlScores: { tabs: { 'AHL Scores': { rows: [['Rank', 'Team']] } } },
      },
      metadata: { ahlSheets: { importedAt: '2026-09-28T00:00:00.000Z' } },
    };
    const next = buildAhlDraftIntelligenceOutputs(outputs, state, [{ name: 'Player One' }]);
    const available = next.players.players.find((player) => player.name === 'Player One');
    const keeper = next.players.players.find((player) => player.name === 'Player Two');

    expect(next.players.sourceAvailability).toEqual({ AHLSheets: true, DobberExcel: false });
    expect(next.players.sourceCoverage.ahlSheets.scoreTabs).toEqual(['AHL Scores']);
    expect(available).toMatchObject({
      ahlPosition: 'LW',
      utilityPosition: null,
      available: true,
      auctionValue: null,
      draftIQ: null,
      classification: 'UNPRICED',
    });
    expect(keeper).toMatchObject({
      ownership: 'TEAM A',
      currentCost: 3.5,
      termRemaining: 1,
      matchingRights: true,
      available: false,
    });
    expect(next.auction.unpricedPlayerCount).toBe(2);
    expect(next.keepers.keepers).toHaveLength(1);
    expect(next.prospects.prospects[0].activeRookieEligible).toBe(true);
    expect(Object.keys(next.tiers.tiers)).toEqual(['1', '2', '3', '4', '5']);
  });

  test('refuses to generate output if either AHL position inventory is empty', () => {
    const outputs = Object.fromEntries(['players', 'auction', 'tiers', 'keepers', 'prospects'].map((name) => [name, {}]));
    expect(() => buildAhlDraftIntelligenceOutputs(outputs, { datasets: { roster: { players: {} } } }))
      .toThrow('AHL Position and AHL Utility data are both empty.');
  });
});
