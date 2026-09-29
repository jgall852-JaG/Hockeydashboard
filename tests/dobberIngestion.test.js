import {
  applyDobberIntelligence,
  attachDobberIntel,
  extractDobberIntelFromText,
  normalizeDobberRows,
  parseDobberWorkbook,
} from '../dobberIngestion.js';

describe('Dobber ingestion', () => {
  test('attaches PDF intelligence to the normalized Dobber player map', () => {
    expect(attachDobberIntel({
      'player one': { player: 'Player One', intelEdge: null },
    }, {
      'player one': { sleeperTag: true, bustTag: false },
    })['player one']).toMatchObject({
      player: 'Player One',
      intelEdge: { sleeperTag: true, bustTag: false },
    });
  });

  test('normalizes EVERYTHING (Skaters) rows without inferring missing projection scores', () => {
    const players = normalizeDobberRows([{
      Player: '  Player One ',
      Team: 'edm',
      POS: 'c',
      Salary: '$7,500,000',
      AAV: '6.25',
      BPS: '0.72',
      KVS: '68',
      Projections: '{"PPS":80,"RSS":70,"RRS":20}',
      RiskFlags: 'Usage decline; Injury',
    }]);

    expect(players['player one']).toMatchObject({
      player: 'Player One',
      team: 'EDM',
      nhlPos: 'C',
      salary: 7500000,
      aav: 6.25,
      bps: 72,
      kvs: 68,
      pps: 80,
      rss: 70,
      rrs: 20,
      riskFlags: ['Usage decline', 'Injury'],
    });
    expect(normalizeDobberRows([{ Player: 'No Projection', BPS: '', KVS: '' }])['no projection'])
      .toMatchObject({ bps: 0, kvs: 0, pps: null, rss: null, rrs: null });
  });

  test('requires the named skater tab and an actual XLSX payload', () => {
    const xlsx = {
      read: () => ({ Sheets: { 'EVERYTHING (Skaters)': {} } }),
      utils: { sheet_to_json: () => [{ Player: 'Player One', POS: 'C' }] },
    };
    expect(parseDobberWorkbook(Uint8Array.from([0x50, 0x4b]).buffer, xlsx)['player one'].nhlPos).toBe('C');
    expect(() => parseDobberWorkbook(Uint8Array.from([0x3c, 0x68]).buffer, xlsx))
      .toThrow('did not return an Excel workbook');
    expect(() => parseDobberWorkbook(Uint8Array.from([0x50, 0x4b]).buffer, {
      read: () => ({ Sheets: {} }),
      utils: { sheet_to_json: () => [] },
    })).toThrow('missing the "EVERYTHING (Skaters)" tab');
  });

  test('extracts only explicit PDF intelligence labels and tags', () => {
    expect(extractDobberIntelFromText([
      'Player One',
      'Pedigree: First-round scorer',
      'Projection Confidence: High',
      'Sleeper candidate',
      'Player Two',
      'Ordinary profile',
    ].join('\n'), ['Player One', 'Player Two'])).toEqual({
      'player one': {
        pedigree: 'First-round scorer',
        projectionConfidence: 'High',
        sleeperTag: true,
        bustTag: false,
      },
    });
  });

  test('merges source-backed scores, intel, scarcity, prices, and owner bid caps', () => {
    const basePlayer = {
      id: 'player-one',
      name: 'Player One',
      category: 'Veteran',
      finalPosition: 'C',
      ahlPosition: 'C',
      position: 'C',
      available: true,
      deployment: { RSS: null, RRS: null, usageDrop: null, ageDecline: null },
      production: { PPS: null },
      prospect: { BPS: null, KVS: null },
      keeper: { KVS: null },
      strengths: [],
      risks: [],
      missingSources: { DobberExcel: true },
      sourcesUsed: { AHLSheets: true, DobberExcel: false },
    };
    const outputs = {
      players: { players: [basePlayer], sourceAvailability: { AHLSheets: true }, sourceCoverage: {} },
      auction: {},
      tiers: {},
      keepers: {},
      prospects: {},
    };
    const state = {
      datasets: {
        roster: {
          players: {
            keeper: { name: 'Owned Center', owner: 'TEAM A', position: 'C', poolposition: 'C' },
          },
        },
        budget: {
          teamBudgets: [{ team: 'TEAM A', remainingBudget: 178.5, openSlots: 17 }],
        },
        dobber: {
          players: {
            'player one': {
              player: 'Player One',
              nhlPos: 'C',
              salary: 10,
              aav: 8,
              bps: 60,
              kvs: 50,
              pps: 80,
              rss: 70,
              rrs: 20,
              projections: { PPS: 80, RSS: 70, RRS: 20 },
              riskFlags: ['Usage watch'],
            },
          },
          intelByPlayerKey: {
            'player one': {
              pedigree: 'Elite',
              projectionConfidence: 'High',
              sleeperTag: true,
              bustTag: false,
            },
          },
        },
      },
      metadata: {
        dobberExcel: { status: 'loaded-local', importedAt: '2026-09-29T00:00:00.000Z' },
        dobberPdfs: { status: 'loaded-local', importedAt: '2026-09-29T00:00:00.000Z' },
      },
    };

    const result = applyDobberIntelligence(outputs, state);
    const player = result.players.players[0];
    expect(player).toMatchObject({
      nhlPosition: 'C',
      draftIQ: 62,
      classification: 'VALUE',
      tier: 3,
      scarcityMultiplier: 1.2,
      keeperInflation: 1.04,
      valuationStatus: 'priced',
      intelEdge: {
        pedigree: 'Elite',
        projectionConfidence: 'High',
        sleeperTag: true,
        bustTag: false,
      },
    });
    expect(player.adjustedDraftIQ).toBeCloseTo(63.054);
    expect(player.auctionValue).toBeCloseTo(23.6074, 3);
    expect(player.recommendedMaxBid).toBeNull();
    expect(player.recommendedMaxBidByOwner['TEAM A']).toBe(26);
    expect(player.strengths).toContain('Dobber sleeper tag');
    expect(player.risks).toContain('Dobber risk: Usage watch');
    expect(result.players.sourceAvailability).toEqual({
      AHLSheets: true,
      DobberExcel: true,
      DobberPDFs: true,
    });
  });

  test('keeps unmatched and text-only projection players unpriced with truthful provenance', () => {
    const basePlayer = (name, finalPosition = 'C') => ({
      id: name.toLowerCase().replaceAll(' ', '-'),
      name,
      category: 'Veteran',
      finalPosition,
      ahlPosition: finalPosition.split('/')[0],
      position: finalPosition,
      available: true,
      deployment: { RSS: null, RRS: null },
      production: { PPS: null },
      prospect: { BPS: null, KVS: null },
      keeper: { KVS: null },
      strengths: [],
      risks: [],
      missingSources: { DobberExcel: true },
      sourcesUsed: { AHLSheets: true, DobberExcel: false },
    });
    const outputs = {
      players: {
        players: [basePlayer('Unmatched Player'), basePlayer('Text Projection')],
        sourceAvailability: { AHLSheets: true },
        sourceCoverage: {},
      },
      auction: {},
      tiers: {},
      keepers: {},
      prospects: {},
    };
    const state = {
      datasets: {
        roster: { players: {} },
        budget: { teamBudgets: [] },
        dobber: {
          players: normalizeDobberRows([{
            Player: 'Text Projection',
            POS: 'C',
            BPS: 70,
            KVS: 60,
            Projections: 'Projected for a strong season',
          }]),
          intelByPlayerKey: {
            'unmatched player': {
              pedigree: 'High',
              projectionConfidence: null,
              sleeperTag: false,
              bustTag: false,
            },
          },
        },
      },
      metadata: {
        dobberExcel: { status: 'loaded-local' },
        dobberPdfs: { status: 'loaded-local' },
      },
    };

    const players = applyDobberIntelligence(outputs, state).players.players;
    const unmatched = players.find((player) => player.name === 'Unmatched Player');
    const textOnly = players.find((player) => player.name === 'Text Projection');

    expect(unmatched).toMatchObject({
      draftIQ: null,
      auctionValue: null,
      classification: 'UNPRICED',
      sourcesUsed: { DobberExcel: false, DobberPDFs: true },
    });
    expect(unmatched.strengths).toContain('Dobber pedigree: High');
    expect(textOnly).toMatchObject({
      draftIQ: null,
      auctionValue: null,
      classification: 'UNPRICED',
      sourcesUsed: { DobberExcel: true, DobberPDFs: false },
    });
    expect(textOnly.missingSourceList).toEqual(expect.arrayContaining([
      'Dobber projection PPS',
      'Dobber projection RSS',
      'Dobber projection RRS',
    ]));
  });

  test('uses the highest eligible scarcity for Utility multi-position players', () => {
    const player = (name, finalPosition, score) => ({
      id: name.toLowerCase().replaceAll(' ', '-'),
      name,
      category: 'Veteran',
      finalPosition,
      ahlPosition: finalPosition.split('/')[0],
      position: finalPosition,
      available: true,
      deployment: { RSS: null, RRS: null },
      production: { PPS: null },
      prospect: { BPS: null, KVS: null },
      keeper: { KVS: null },
      strengths: [],
      risks: [],
      missingSources: {},
      sourcesUsed: { AHLSheets: true },
    });
    const players = [
      player('Utility Player', 'C/LW'),
      player('Center Only', 'C'),
      player('Wing Only', 'LW'),
    ];
    const dobberPlayers = Object.fromEntries(players.map((entry) => [
      entry.name.toLowerCase(),
      {
        player: entry.name,
        nhlPos: 'C',
        salary: null,
        aav: null,
        bps: entry.name === 'Wing Only' ? 70 : 80,
        kvs: entry.name === 'Wing Only' ? 70 : 80,
        pps: entry.name === 'Wing Only' ? 70 : 80,
        rss: entry.name === 'Wing Only' ? 70 : 80,
        rrs: 10,
        projections: {},
        riskFlags: [],
      },
    ]));
    const outputs = {
      players: { players, sourceAvailability: { AHLSheets: true }, sourceCoverage: {} },
      auction: {},
      tiers: {},
      keepers: {},
      prospects: {},
    };
    const state = {
      datasets: {
        roster: {
          players: {
            center1: { name: 'Owned Center 1', owner: 'A', position: 'C' },
            wing1: { name: 'Owned Wing 1', owner: 'A', position: 'LW' },
            wing2: { name: 'Owned Wing 2', owner: 'B', position: 'LW' },
          },
        },
        budget: { teamBudgets: [] },
        dobber: { players: dobberPlayers, intelByPlayerKey: {} },
      },
      metadata: { dobberExcel: { status: 'loaded-local' }, dobberPdfs: { status: 'unavailable' } },
    };

    const result = applyDobberIntelligence(outputs, state);
    const utility = result.players.players.find((entry) => entry.name === 'Utility Player');
    const center = result.players.players.find((entry) => entry.name === 'Center Only');

    expect(result.auction.rosterSlotsByPosition).toEqual({ C: 1, LW: 2 });
    expect(utility.scarcityMultiplier).toBe(1.2);
    expect(utility.scarcityMultiplier).toBeGreaterThan(center.scarcityMultiplier);
  });
});
