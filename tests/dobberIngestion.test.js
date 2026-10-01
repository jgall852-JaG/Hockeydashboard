import {
  applyDobberIntelligence,
  attachDobberIntel,
  extractDobberIntelFromText,
  extractDobberProspectMetadata,
  extractPdfText,
  ingestDobberExcelFile,
  ingestDobberPdfFiles,
  normalizeDobberRows,
  parseDobberWorkbook,
  updateDobberImportMetadata,
} from '../dobberIngestion.js';
import { persistState, STORAGE_KEY } from '../app.js';

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
      .toMatchObject({ bps: null, kvs: null, pps: null, rss: null, rrs: null });
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

  test('returns invalid-format warnings for invalid workbooks and missing skater columns', async () => {
    const xlsx = {
      read: () => ({ Sheets: { 'EVERYTHING (Skaters)': {} } }),
      utils: { sheet_to_json: () => [{ Player: 'Player One', Notes: 'not a skater field' }] },
    };
    const invalidBytes = Uint8Array.from([0x3c, 0x68]).buffer;
    const invalidFormat = await ingestDobberExcelFile({
      name: 'not-a-workbook.xlsx',
      arrayBuffer: async () => invalidBytes,
    }, xlsx);
    expect(invalidFormat).toMatchObject({
      status: 'invalid-format',
      fileName: 'not-a-workbook.xlsx',
      lastImport: null,
      playersParsed: 0,
    });
    expect(invalidFormat.warnings[0]).toContain('did not return an Excel workbook');

    const missingColumns = await ingestDobberExcelFile({
      name: 'missing-columns.xlsx',
      arrayBuffer: async () => Uint8Array.from([0x50, 0x4b]).buffer,
    }, xlsx);
    expect(missingColumns.status).toBe('invalid-format');
    expect(missingColumns.warnings[0]).toContain('missing expected skater data columns');

    const missingTab = await ingestDobberExcelFile({
      name: 'missing-tab.xlsx',
      arrayBuffer: async () => Uint8Array.from([0x50, 0x4b]).buffer,
    }, {
      ...xlsx,
      read: () => ({ Sheets: {} }),
    });
    expect(missingTab.status).toBe('invalid-format');
    expect(missingTab.warnings[0]).toContain('missing the "EVERYTHING (Skaters)" tab');
  });

  test('returns a successful Excel status object and persisted lastImport metadata', async () => {
    const xlsx = {
      read: () => ({ Sheets: { 'EVERYTHING (Skaters)': {} } }),
      utils: { sheet_to_json: () => [{ Player: 'Player One', POS: 'C', BPS: '', KVS: '' }] },
    };
    const lastImport = '2026-09-29T19:00:00.000Z';
    const result = await ingestDobberExcelFile({
      name: 'dobber-skaters.xlsx',
      arrayBuffer: async () => Uint8Array.from([0x50, 0x4b]).buffer,
    }, xlsx, () => new Date(lastImport));
    expect(result).toMatchObject({
      status: 'loaded-local',
      fileName: 'dobber-skaters.xlsx',
      lastImport,
      warnings: [],
      playersParsed: 1,
      players: { 'player one': { bps: null, kvs: null } },
    });

    const metadata = updateDobberImportMetadata({}, result);
    expect(metadata).toMatchObject({
      status: 'loaded-local',
      sourceType: 'local',
      sourceName: 'dobber-skaters.xlsx',
      lastImport,
    });
    const storage = new Map();
    const previousStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { setItem: (key, value) => storage.set(key, value) },
    });
    try {
      persistState({ version: 2, datasets: {}, metadata: { dobberExcel: metadata } });
      expect(JSON.parse(storage.get(STORAGE_KEY)).metadata.dobberExcel.lastImport).toBe(lastImport);
    } finally {
      if (previousStorage === undefined) delete globalThis.localStorage;
      else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage });
    }
  });

  test('keeps source availability and the last successful import after a failed retry', () => {
    const failure = {
      status: 'invalid-format',
      fileName: 'wrong-tab.xlsx',
      lastImport: null,
      warnings: ['Missing skater tab.'],
      playersParsed: 0,
    };
    const metadata = updateDobberImportMetadata({
      status: 'loaded-local',
      sourceType: 'local',
      sourceName: 'valid.xlsx',
      lastImport: '2026-09-29T18:00:00.000Z',
      records: 12,
    }, failure, '2026-09-29T19:00:00.000Z');

    expect(metadata).toMatchObject({
      status: 'loaded-local',
      sourceType: 'local',
      sourceName: 'valid.xlsx',
      lastImport: '2026-09-29T18:00:00.000Z',
      lastAttempt: {
        status: 'invalid-format',
        fileName: 'wrong-tab.xlsx',
        attemptedAt: '2026-09-29T19:00:00.000Z',
      },
    });
    expect(metadata.lastAttempt.warnings).toEqual(['Missing skater tab.']);
    expect(updateDobberImportMetadata({
      status: 'unavailable',
      sourceType: 'remote',
      sourceName: 'Dobber Excel OneDrive',
    }, failure).status).toBe('unavailable');
  });

  test('extracts PDF metadata across pages and rejects invalid PDF files', async () => {
    const pdfjs = {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: async (pageNumber) => ({
            getTextContent: async () => ({
              items: pageNumber === 1
                ? [{ str: 'Player One', transform: [1, 0, 0, 1, 20, 700] }]
                : [
                  { str: 'Pedigree: First-round scorer', transform: [1, 0, 0, 1, 20, 700] },
                  { str: 'Sleeper candidate', transform: [1, 0, 0, 1, 20, 680] },
                ],
            }),
          }),
        }),
      }),
    };
    const pdfFile = {
      name: 'dobber-guide.pdf',
      arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7').buffer,
    };
    const parsedText = await extractPdfText(await pdfFile.arrayBuffer(), pdfjs);
    expect(parsedText).toContain('Player One\nPedigree: First-round scorer');
    const lastImport = '2026-09-29T19:02:00.000Z';
    const success = await ingestDobberPdfFiles(
      [pdfFile],
      ['Player One'],
      pdfjs,
      () => new Date(lastImport),
    );
    expect(success).toMatchObject({
      status: 'loaded-local',
      fileName: 'dobber-guide.pdf',
      lastImport,
      playersParsed: 1,
      intelByPlayerKey: {
        'player one': {
          pedigree: 'First-round scorer',
          sleeperTag: true,
        },
      },
    });

    const invalid = await ingestDobberPdfFiles([{
      name: 'not-a-pdf.pdf',
      arrayBuffer: async () => new TextEncoder().encode('<html>').buffer,
    }], ['Player One'], pdfjs);
    expect(invalid).toMatchObject({
      status: 'invalid-format',
      fileName: 'not-a-pdf.pdf',
      lastImport: null,
      playersParsed: 0,
    });
    expect(invalid.warnings[0]).toContain('did not return a PDF document');
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

  test('extracts prospect metadata (upside, risk, readiness, grade) from the Prospects Report text', () => {
    const text = [
      'Bradly Nadeau , C/RW',
      '(2026: 15 ) (2025: 44 )',
      'Some scouting bio paragraph about the player.',
      'Upside Comparable: Seth Jarvis (35 - 45 - 80+ , 40 PIM)',
      '3YP: 25 - 25 - 50, 30 PIM',
      'Fantasy Upside / NHL Certainty: 30%, 85%',
      'Expected Arrival: This fall.',
      'DH Draft Advice: Should be drafted in the first couple of rounds.',
    ].join('\n');
    expect(extractDobberProspectMetadata(text, ['Bradly Nadeau'])).toEqual({
      'bradly nadeau': {
        upside: 30,
        risk: 15,
        readiness: 'This fall.',
        grade: 15,
        upsideComparable: 'Seth Jarvis (35 - 45 - 80+ , 40 PIM)',
      },
    });
  });

  test('extractDobberProspectMetadata returns no entry when no recognized labels are present', () => {
    expect(extractDobberProspectMetadata('Random Player\nUnrelated line with no labels.', ['Random Player']))
      .toEqual({});
  });

  test('parseDobberWorkbook locates the header row past Dobber banner/quick-jump rows', () => {
    const matrix = [
      ['Everything (Skaters) - quick jump'],
      ['Forwards', 'Defense', 'Goalies'],
      [],
      [],
      [],
      ['Rank', 'Player', 'Age', 'Pos', '3YP', 'Upside', 'Team', 'Games', 'Goals', 'Assists', 'Points', 'SOG', 'Rookie'],
      [1, 'Player One', 24, 'C', '', '', 'EDM', 82, 30, 40, 70, 210, ''],
    ];
    const xlsx = {
      read: () => ({ Sheets: { 'EVERYTHING (Skaters)': {} } }),
      utils: { sheet_to_json: () => matrix },
    };
    const players = parseDobberWorkbook(Uint8Array.from([0x50, 0x4b]).buffer, xlsx);
    expect(players['player one']).toMatchObject({
      player: 'Player One',
      team: 'EDM',
      nhlPos: 'C',
      forecastProjections: { ProjPts: 70, ProjGP: 82, ProjSOG: 210 },
    });
  });

  test('ingestDobberPdfFiles routes Prospects Report files to prospect metadata and other PDFs to intel', async () => {
    const pdfjs = {
      getDocument: ({ data }) => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async () => ({
              items: [{ str: new TextDecoder().decode(data), transform: [1, 0, 0, 1, 20, 700] }],
            }),
          }),
        }),
      }),
    };
    const guideFile = {
      name: 'dobberhockey202627fantasyguide.pdf',
      arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7Player One\nPedigree: First-round scorer').buffer,
    };
    const prospectsFile = {
      name: 'dobberhockey202627fantasyprospectsreport.pdf',
      arrayBuffer: async () => new TextEncoder().encode([
        '%PDF-1.7Player One',
        'Fantasy Upside / NHL Certainty: 40%, 90%',
        'Expected Arrival: Next season.',
      ].join('\n')).buffer,
    };
    const result = await ingestDobberPdfFiles([guideFile, prospectsFile], ['Player One'], pdfjs);
    expect(result.status).toBe('loaded-local');
    expect(result.intelByPlayerKey['player one']).toMatchObject({ pedigree: 'First-round scorer' });
    expect(result.prospectMetadataByPlayerKey['player one']).toMatchObject({
      upside: 40,
      risk: 10,
      readiness: 'Next season.',
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

    let stagedPlayer;
    const result = applyDobberIntelligence(outputs, state, (players) => {
      stagedPlayer = players[0];
      return players.map((entry) => ({ ...entry, localAssignmentTeam: 'TEAM B' }));
    });
    const player = result.players.players[0];
    expect(stagedPlayer).toMatchObject({
      nhlPosition: 'C',
      production: { PPS: 80 },
      draftIQ: null,
    });
    expect(player).toMatchObject({
      nhlPosition: 'C',
      localAssignmentTeam: 'TEAM B',
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

  test('keeps unmatched, incomplete, and text-only projection players unpriced with truthful provenance', () => {
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
        players: [
          basePlayer('Unmatched Player'),
          basePlayer('Text Projection'),
          basePlayer('Missing Metrics'),
        ],
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
          }, {
            Player: 'Missing Metrics',
            POS: 'C',
            Projections: '{"PPS":80,"RSS":70,"RRS":20}',
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
    const missingMetrics = players.find((player) => player.name === 'Missing Metrics');

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
    expect(missingMetrics).toMatchObject({
      prospect: { BPS: null, KVS: null },
      draftIQ: null,
      auctionValue: null,
      classification: 'UNPRICED',
    });
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
