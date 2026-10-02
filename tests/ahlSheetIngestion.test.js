import {
  AHL_SHEET_SOURCES,
  applyAhlEligibility,
  buildAvailableAhlPoolKeys,
  buildAhlDraftIntelligenceOutputs,
  buildCanonicalAhlPool,
  deserializeCanonicalAhlPool,
  getAhlHistoricalSplits,
  getCanonicalAhlPoolOwnership,
  hasCanonicalAhlPool,
  parseAhlScoreSheet,
  serializeCanonicalAhlPool,
  UTILITY_POSITION_BY_PLAYER,
} from '../ahlSheetIngestion.js';

describe('AHL sheet ingestion', () => {
  test('builds a canonical AHL pool from Position and Utility rows and excludes owned, rights-held, drafted, and assigned players', () => {
    const pool = buildCanonicalAhlPool([
      { name: 'Available Player', position: 'C', nhlteam: 'AAA' },
      { name: 'Rights Player', position: 'D', nhlteam: 'BBB' },
      { name: 'Keeper Player', position: 'LW', nhlteam: 'CCC' },
      { name: 'Veteran Player', position: 'RW', nhlteam: 'DDD' },
      { name: 'Drafted Player', position: 'G', nhlteam: 'EEE' },
      { name: 'Assigned Player', position: 'C', nhlteam: 'FFF' },
      { name: 'Local Assigned Player', position: 'D', nhlteam: 'GGG' },
      { name: 'League Roster Player', position: 'LW', nhlteam: 'HHH' },
      { name: 'Unowned Draft Board Player', position: 'RW', nhlteam: 'III' },
    ], [
      { name: 'Available Player', position: 'U', poolposition: 'C/L' },
      { name: 'Rights Player', position: 'U', poolposition: 'D', rights: 'Y' },
    ]);
    const state = {
      datasets: {
        ahlPool: serializeCanonicalAhlPool(pool),
        prospects: { prospects: {
          keeper: { name: 'Keeper Player', owner: 'TEAM A' },
          rights: { name: 'Rights Player', owner: 'TEAM B', matchingRights: true, termRemaining: 0 },
        } },
        veterans: { veterans: {
          veteran: { name: 'Veteran Player', owner: 'TEAM C' },
        } },
        roster: { sources: {
          'retained-grid': { players: {
            drafted: { name: 'Drafted Player', owner: 'TEAM D' },
          } },
          'league-layout': { players: {
            rostered: { name: 'League Roster Player', owner: 'TEAM G' },
          } },
        } },
        draft: { players: {
          unowned: { name: 'Unowned Draft Board Player' },
        } },
      },
      workingAssignments: {
        assigned: { name: 'Assigned Player', team: 'TEAM E' },
      },
      localEdits: {
        removedPlayers: [],
        manualAssignments: { 'local assigned player': 'TEAM F' },
        manualUnassign: [],
      },
    };
    const ownership = getCanonicalAhlPoolOwnership(state);
    const availableKeys = buildAvailableAhlPoolKeys(state);

    expect(pool.get('available player').positions).toEqual(new Set(['C', 'LW']));
    expect(pool.get('available player').team).toBe('AAA');
    expect(pool.get('available player').flags).toMatchObject({
      fromPositionSheet: true,
      fromUtilitySheet: true,
      utilityPosition: 'C/L',
    });
    expect([...availableKeys]).toEqual(['available player']);
    expect(ownership.ownersByPlayerKey.get('drafted player')).toEqual(new Set(['TEAM D']));
    expect(ownership.draftedKeys.has('unowned draft board player')).toBe(true);
    const afterAssignmentRemoved = buildAvailableAhlPoolKeys({
      ...state,
      workingAssignments: {},
      localEdits: { ...state.localEdits, manualAssignments: {} },
    });
    expect([...afterAssignmentRemoved].sort()).toEqual(['assigned player', 'available player', 'local assigned player']);
  });

  test('excludes locally removed players from canonical availability', () => {
    const pool = buildCanonicalAhlPool([
      { name: 'Kept Player', position: 'C', nhlteam: 'AAA' },
      { name: 'Removed Player', position: 'D', nhlteam: 'BBB' },
    ]);
    const state = {
      datasets: { ahlPool: serializeCanonicalAhlPool(pool) },
      localEdits: { removedPlayers: ['Removed Player'], manualAssignments: {}, manualUnassign: [] },
    };

    const ownership = getCanonicalAhlPoolOwnership(state);
    expect(ownership.removedKeys).toEqual(new Set(['removed player']));
    expect([...buildAvailableAhlPoolKeys(state)]).toEqual(['kept player']);
  });

  test('manual unassign frees draft/workspace ownership but never prospect, veteran, or rights ownership', () => {
    const pool = buildCanonicalAhlPool([
      { name: 'Grid Pick', position: 'C', nhlteam: 'AAA' },
      { name: 'Board Pick', position: 'LW', nhlteam: 'BBB' },
      { name: 'Workspace Pick', position: 'RW', nhlteam: 'CCC' },
      { name: 'Keeper Prospect', position: 'D', nhlteam: 'DDD' },
      { name: 'Keeper Veteran', position: 'C', nhlteam: 'EEE' },
      { name: 'Rights Holder', position: 'G', nhlteam: 'FFF' },
    ]);
    const unassignAll = ['grid pick', 'board pick', 'workspace pick', 'keeper prospect', 'keeper veteran', 'rights holder'];
    const state = {
      datasets: {
        ahlPool: serializeCanonicalAhlPool(pool),
        prospects: { prospects: {
          keeper: { name: 'Keeper Prospect', owner: 'TEAM A' },
          rights: { name: 'Rights Holder', owner: 'TEAM B', matchingRights: true, termRemaining: 0 },
        } },
        veterans: { veterans: { vet: { name: 'Keeper Veteran', owner: 'TEAM C' } } },
        roster: { sources: { 'retained-grid': { players: {
          grid: { name: 'Grid Pick', owner: 'TEAM D' },
          keeper: { name: 'Keeper Prospect', owner: 'TEAM A' },
        } } } },
        draft: { players: { board: { name: 'Board Pick', owner: 'TEAM E' } } },
      },
      workingAssignments: { w1: { name: 'Workspace Pick', team: 'TEAM F' } },
      localEdits: { removedPlayers: [], manualAssignments: {}, manualUnassign: [] },
    };

    expect([...buildAvailableAhlPoolKeys(state)]).toEqual([]);

    const unassigned = { ...state, localEdits: { ...state.localEdits, manualUnassign: unassignAll } };
    const ownership = getCanonicalAhlPoolOwnership(unassigned);
    expect([...buildAvailableAhlPoolKeys(unassigned)].sort()).toEqual(['board pick', 'grid pick', 'workspace pick']);
    expect(ownership.ownersByPlayerKey.get('keeper prospect')).toEqual(new Set(['TEAM A']));
    expect(ownership.ownersByPlayerKey.get('keeper veteran')).toEqual(new Set(['TEAM C']));
    expect(ownership.rightsKeys.has('rights holder')).toBe(true);
    expect(ownership.draftedKeys.has('keeper prospect')).toBe(false);
    expect([...ownership.protectedKeys].sort()).toEqual(['keeper prospect', 'keeper veteran', 'rights holder']);
  });

  test('round-trips the canonical pool through JSON and restores position Sets', () => {
    const pool = buildCanonicalAhlPool(
      [{ name: 'Utility Skater', position: 'C', nhlteam: 'NYR', rights: 'Y' }],
      [{ name: 'Utility Skater', poolposition: 'C/L' }],
    );
    const restored = deserializeCanonicalAhlPool(JSON.parse(JSON.stringify(serializeCanonicalAhlPool(pool))));
    const original = pool.get('utility skater');
    const roundTripped = restored.get('utility skater');

    expect(roundTripped.positions).toBeInstanceOf(Set);
    expect(roundTripped.positions).toEqual(original.positions);
    expect({ ...roundTripped, positions: null }).toEqual({ ...original, positions: null });
    expect(hasCanonicalAhlPool({})).toBe(false);
    expect(hasCanonicalAhlPool(null)).toBe(false);
    expect(hasCanonicalAhlPool(serializeCanonicalAhlPool(pool))).toBe(true);
  });

  test('uses the authoritative Google workbooks and includes score tabs', () => {
    expect(AHL_SHEET_SOURCES.map(({ name }) => name)).toEqual([
      'AHL Position',
      'AHL Utility',
      'AHL Draft',
      'AHL Budget',
      'AHL Roster',
      'AHL Keeper Rights',
      'AHL Veterans',
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
      category: 'Veteran',
      auctionValue: 22,
      draftIQ: 80,
      classification: 'VALUE',
      deployment: { DS: 50, RSS: 50, OS: 50, RRS: 20 },
      production: { PPS: 80 },
      prospect: { BPS: 60 },
      keeper: { KVS: 40 },
      localStatus: 'removed-local',
      localAssignmentTeam: 'TEAM B',
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
                'player-two': { name: 'Player Two', position: 'C', poolposition: 'C', nhlteam: 'BBB' },
              },
            },
            utility: {
              players: {
                'player-one': { name: 'Player One', position: 'U', poolposition: 'C/LW', nhlteam: 'AAA' },
                'player-two': { name: 'Player Two', position: 'U', poolposition: 'C/L', nhlteam: 'BBB' },
              },
            },
            'league-layout': {
              players: {
                'player-one': { name: 'P One', owner: '' },
                'player-two': { name: 'P Two', owner: 'TEAM A' },
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
      utilityPosition: 'C/LW',
      finalPosition: 'LW/C',
      position: 'LW/C',
      category: 'Veteran',
      available: true,
      status: 'in-ahl',
      auctionValue: null,
      draftIQ: null,
      classification: 'UNPRICED',
      nhlPosition: null,
    });
    expect(available).not.toHaveProperty('localStatus');
    expect(available).not.toHaveProperty('localAssignmentTeam');
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

  test('does not add players absent from the canonical AHL Position pool', () => {
    const formerProspect = {
      id: 'former-prospect',
      name: 'Former Prospect',
      position: 'C',
      category: 'Veteran',
      auctionValue: 42,
      draftIQ: 90,
      adjustedDraftIQ: 91,
      recommendedMaxBid: 45,
      tier: 1,
      classification: 'VALUE',
      valuationStatus: 'priced',
    };
    const outputs = Object.fromEntries(['players', 'auction', 'tiers', 'keepers', 'prospects'].map((name) => [
      name,
      {
        sourceAvailability: {},
        sourceCoverage: {},
        players: name === 'players' || name === 'auction' ? [formerProspect] : [],
        keepers: [],
        prospects: [],
        tiers: {},
      },
    ]));
    const state = {
      datasets: {
        roster: {
          players: {},
          sources: {
            inventory: { players: {
              other: { name: 'Other Player', position: 'LW' },
            } },
            utility: { players: {} },
            'retained-grid': { players: { former: { name: 'Former Prospect', owner: 'TEAM A' } } },
            'league-layout': { players: {} },
          },
        },
        prospects: { prospects: {} },
      },
    };
    const result = buildAhlDraftIntelligenceOutputs(outputs, state, [{ name: 'Former Prospect' }]);
    expect(result.players.players.find((player) => player.name === 'Former Prospect')).toMatchObject({
      name: 'Former Prospect',
      status: 'not-in-ahl',
      available: false,
    });
    expect(state.datasets.ahlPool).not.toHaveProperty('former prospect');
    expect(state.datasets.availableKeys).toEqual(['other player']);
  });

  test('uses AHL Position as base and only applies the explicit Utility sheet list', () => {
    const utilityNames = Object.keys(UTILITY_POSITION_BY_PLAYER);
    const positionRecords = utilityNames.map((name, index) => ({
      name,
      position: index < 7 ? 'C' : index < 14 ? 'RW' : 'LW',
      poolposition: index < 7 ? 'C' : index < 14 ? 'R' : 'L',
    }));
    positionRecords.push({ name: 'Utility Missing Player', position: 'D', poolposition: 'D' });
    const utilityRecords = utilityNames.map((name) => ({
      name,
      position: 'U',
      poolposition: UTILITY_POSITION_BY_PLAYER[name],
    }));
    const players = [...positionRecords, { name: 'Former Utility Player', position: 'C' }].map((player, index) => ({
      ...player,
      id: `player-${index}`,
      category: 'Veteran',
      auctionValue: null,
      draftIQ: null,
      classification: 'UNPRICED',
    }));
    const outputs = Object.fromEntries(['players', 'auction', 'tiers', 'keepers', 'prospects'].map((name) => [
      name,
      { players: name === 'players' || name === 'auction' ? players : [], keepers: [], prospects: [], tiers: {} },
    ]));
    const state = {
      manualOverrides: [],
      datasets: {
        roster: {
          players: {},
          sources: {
            inventory: { players: Object.fromEntries(positionRecords.map((record, index) => [`p${index}`, record])) },
            utility: { players: Object.fromEntries(utilityRecords.map((record, index) => [`u${index}`, record])) },
            'retained-grid': { players: {} },
            'league-layout': { players: {} },
          },
        },
        prospects: { prospects: {} },
      },
    };
    const result = buildAhlDraftIntelligenceOutputs(outputs, state);
    const byName = new Map(result.players.players.map((player) => [player.name, player]));

    expect(Object.keys(UTILITY_POSITION_BY_PLAYER)).toHaveLength(21);
    utilityNames.forEach((name) => {
      const expectedUtility = UTILITY_POSITION_BY_PLAYER[name];
      const player = byName.get(name);
      expect(player.utilityPosition).toBe(expectedUtility);
      expect(player.finalPosition.split('/')).toEqual(expect.arrayContaining([
        ...new Set([player.ahlPosition, ...expectedUtility.split('/').map((position) => (
          position === 'L' ? 'LW' : position === 'R' ? 'RW' : position
        ))]),
      ]));
    });
    expect(byName.get('Utility Missing Player')).toMatchObject({
      ahlPosition: 'D',
      utilityPosition: null,
      finalPosition: 'D',
    });
    expect(byName.get('Former Utility Player')).toBeUndefined();
  });

  test('creates unpriced manual overrides for official players missing AHL Position', () => {
    const player = {
      id: 'missing-position',
      name: 'Missing Position Player',
      category: 'Rookie',
      nhlPosition: 'C',
      auctionValue: 44,
      draftIQ: 87,
    };
    const outputs = Object.fromEntries(['players', 'auction', 'tiers', 'keepers', 'prospects'].map((name) => [
      name,
      { players: name === 'players' || name === 'auction' ? [player] : [], keepers: [], prospects: [], tiers: {} },
    ]));
    const state = {
      manualOverrides: [],
      datasets: {
        roster: {
          players: {},
          sources: {
            inventory: { players: { positionOnly: { name: 'Zed Position Player', position: 'D' } } },
            utility: { players: {} },
            'retained-grid': { players: { one: { name: 'Missing Position Player', owner: 'TEAM A' } } },
            'league-layout': { players: {} },
          },
        },
        prospects: { prospects: {} },
      },
    };
    const result = buildAhlDraftIntelligenceOutputs(outputs, state);
    expect(result.missingPositionOverrides).toHaveLength(1);
    expect(result.missingPositionOverrides[0]).toMatchObject({
      name: 'Missing Position Player',
      finalPositionOverride: null,
      experienceTier: 'Rookie',
      status: 'not-in-ahl',
      pricing: null,
      forecast: null,
      owner: null,
      availability: 'unavailable',
    });
    expect(result.players.players[0]).toMatchObject({
      status: 'not-in-ahl',
      finalPosition: null,
      owner: null,
      available: false,
      draftIQ: null,
      auctionValue: null,
      recommendedMaxBid: null,
      pricing: null,
      forecast: null,
    });
  });

  test('reads historical FH/SH PPG only from named AHL Scores columns', () => {
    const state = {
      datasets: {
        ahlScores: {
          tabs: {
            'AHL Scores': {
              tabName: 'AHL Scores',
              rows: [
                ['Player', 'FH PPG', 'Second-Half PPG', 'Total PTS'],
                ['Player One', '1.25', '0.8', '100'],
              ],
            },
          },
        },
      },
    };
    expect(getAhlHistoricalSplits(state, 'Player One')).toEqual({
      FHPPG: 1.25,
      SHPPG: 0.8,
      sourceTab: 'AHL Scores',
    });
    expect(getAhlHistoricalSplits(state, 'Unknown Player')).toEqual({
      FHPPG: null,
      SHPPG: null,
      sourceTab: null,
    });
  });

  test('reapplies AHL eligibility after Dobber valuation outputs are merged', () => {
    const pricedFormerProspect = {
      id: 'former-prospect',
      name: 'Former Prospect',
      status: 'not-in-ahl',
      draftIQ: 90,
      adjustedDraftIQ: 91,
      auctionValue: 42,
      recommendedMaxBid: 45,
      recommendedMaxBidByOwner: { 'TEAM A': 45 },
      tier: 1,
      classification: 'VALUE',
      valuationStatus: 'priced',
    };
    const output = applyAhlEligibility({
      players: { players: [pricedFormerProspect] },
      auction: { players: [{ ...pricedFormerProspect }] },
      tiers: { tiers: { 1: ['former-prospect'] } },
    }, {
      datasets: {
        roster: {
          sources: {
            'retained-grid': { players: {} },
            'league-layout': { players: {} },
          },
        },
      },
    });

    expect(output.players.players[0]).toMatchObject({
      status: 'not-in-ahl',
      draftIQ: null,
      auctionValue: null,
      recommendedMaxBid: null,
      tier: null,
      classification: 'UNPRICED',
    });
    expect(output.auction.players[0]).toMatchObject({
      status: 'not-in-ahl',
      draftIQ: null,
      auctionValue: null,
      recommendedMaxBid: null,
    });
    expect(output.tiers.tiers[1]).toEqual([]);
    expect(output.auction.unpricedPlayerIds).toEqual(['former-prospect']);
  });

  test('refuses to generate output if either AHL position inventory is empty', () => {
    const outputs = Object.fromEntries(['players', 'auction', 'tiers', 'keepers', 'prospects'].map((name) => [name, {}]));
    expect(() => buildAhlDraftIntelligenceOutputs(outputs, { datasets: { roster: { players: {} } } }))
      .toThrow('AHL Position data is empty.');
  });
});
