import { parseVeterans } from "../veteranParser.js";

describe('veteranParser parseVeterans', () => {
  test('parses normal rows with full costs and retention year column', () => {
    const rows = [
      'AHL Draft - Veterans.csv',
      'TEAM ALPHA,',
      'John Smith, $100, $200, $300, $400, $500, 2023',
      'Jane Doe, $0, $50, $75, $100, $150, 2024',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    expect(Object.keys(result.veterans).length).toBe(2);
    const js = result.veterans['john-smith'];
    expect(js).toBeDefined();
    expect(js.name).toBe('John Smith');
    expect(js.owner).toBe('TEAM ALPHA');
    expect(js.veteran).toBe(true);
    expect(js.retentionYear).toBe(2023);
    expect(js.retentionHistory.length).toBe(5);
    expect(js.retentionHistory[0].season).toBe(2022);
    expect(js.retentionHistory[0].cost).toBe(100);
    expect(js.retentionHistory[4].season).toBe(2026);
    expect(js.retentionHistory[4].cost).toBe(500);
    expect(js.currentCost).toBe(500);

    const jd = result.veterans['jane-doe'];
    expect(jd.currentCost).toBe(150);

    // Also ensure player name parsing removes position/year suffix when present
    // Add a row with position suffix
    const rows2 = ['TEAM ALPHA,', 'Gabriel Vilardi RW - 2025, $10, $20, $24, $29, , 2025'];
    const data2 = parseVeterans(rows2.join('\n'));
    const g = data2.veterans['gabriel-vilardi'];
    expect(g).toBeDefined();
    expect(g.name).toBe('Gabriel Vilardi');
    expect(g.retentionYear).toBe(2025);
    expect(g.currentCost).toBe(29);
  });

  test('handles missing costs and uses latest non-empty as currentCost', () => {
    const rows = [
      'TEAM BETA,',
      'Missing Costs Guy, , , $300, , , 2022',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    const p = result.veterans['missing-costs-guy'];
    expect(p).toBeDefined();
    // retentionHistory: [null,null,300,null,null]
    expect(p.retentionHistory[0].cost).toBeNull();
    expect(p.retentionHistory[2].cost).toBe(300);
    expect(p.currentCost).toBe(300);
  });

  test('handles missing retention year gracefully', () => {
    const rows = [
      'TEAM GAMMA,',
      'No Year Player, $10, $20, $30, , ,',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    const p = result.veterans['no-year-player'];
    expect(p).toBeDefined();
    expect(p.retentionYear).toBeNull();
    expect(p.currentCost).toBe(30);
  });

  test('malformed rows are handled (ignored or partial parsing) and do not throw', () => {
    const rows = [
      'TEAM DELTA,',
      // completely empty row after team
      ',',
      // malformed: only name
      'Weird Row OnlyName',
      // malformed: name and one cost but not all columns
      'Partial, $25',
      'Good Player, $5, $10, $15, $20, $25, 2025',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    // Should at least contain Good Player and Partial and Weird Row OnlyName parsed as names
    expect(result.veterans['good-player']).toBeDefined();
    expect(result.veterans['partial']).toBeDefined();
    expect(result.veterans['weird-row-onlyname']).toBeDefined();

    // Partial currentCost should be 25
    expect(result.veterans['partial'].currentCost).toBe(25);
  });

  test('team header detection groups owners correctly', () => {
    const rows = [
      'TEAM ONE,',
      'A Player, $1, $2, $3, $4, $5, 2022',
      'TEAM TWO,',
      'B Player, $10, $20, $30, $40, $50, 2023',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    expect(Object.keys(result.owners)).toEqual(expect.arrayContaining(['TEAM ONE', 'TEAM TWO']));
    expect(result.owners['TEAM ONE']).toContain('a-player');
    expect(result.owners['TEAM TWO']).toContain('b-player');
  });

  test('duplicate player names generate unique IDs', () => {
    const rows = [
      'TEAM DUP,',
      'Dup Player, $1, $2, $3, $4, $5, 2022',
      'Dup Player, $2, $3, $4, $5, $6, 2023',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    // Expect two distinct playerIds
    const ids = Object.keys(result.veterans);
    expect(ids.some(id => id === 'dup-player')).toBe(true);
    expect(ids.some(id => id === 'dup-player-2')).toBe(true);
    expect(result.owners['TEAM DUP']).toEqual(expect.arrayContaining(['dup-player', 'dup-player-2']));
  });


  test('repeated team headers do not clear previously assigned players', () => {
    const rows = [
      'TEAM REPEAT,',
      'Player One, $1, $2, $3, $4, $5, 2022',
      'TEAM REPEAT,',
      'Player Two, $10, $20, $30, $40, $50, 2023',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    expect(result.owners['TEAM REPEAT'].length).toBe(2);
    expect(result.owners['TEAM REPEAT']).toEqual(expect.arrayContaining(['player-one','player-two']));
  });

  test('supports additional position suffixes (G, F, LD, RD) and cleans names', () => {
    const rows = [
      'TEAM POS,',
      'Carey Price G - 2025, $1, $2, $3, $4, $5, 2025',
      'Some Forward F - 2024, $2, $3, $4, $5, $6, 2024',
      'Lefty LD - 2024, $3, $4, $5, $6, $7, 2024',
      'Righty RD - 2026, $4, $5, $6, $7, $8, 2026',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    expect(result.veterans['carey-price']).toBeDefined();
    expect(result.veterans['carey-price'].name).toBe('Carey Price');
    expect(result.veterans['carey-price'].retentionYear).toBe(2025);

    expect(result.veterans['some-forward'].name).toBe('Some Forward');
    expect(result.veterans['lefty'].name).toBe('Lefty');
    expect(result.veterans['righty'].name).toBe('Righty');
  });

  test('invalid retention years are rejected and return null', () => {
    const rows = [
      'TEAM YEARS,',
      'Old Timer - 1899, $1, $2, $3, $4, $5, 1899',
      'Future Guy - 2200, $1, $2, $3, $4, $5, 2200',
      'Good Player - 2025, $1, $2, $3, $4, $5, 2025',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    expect(result.veterans['old-timer'].retentionYear).toBeNull();
    expect(result.veterans['future-guy'].retentionYear).toBeNull();
    expect(result.veterans['good-player'].retentionYear).toBe(2025);
  });

  test('trims trailing hyphen-only suffix from names', () => {
    const rows = [
      'TEAM DASH,',
      'Dylan Strome -, $1, $2, $3, $4, $5, 2025',
      'Jesper Bratt -, $2, $3, $4, $5, $6, 2025',
      'Lucas Raymond -, $3, $4, $5, $6, $7, 2025',
      'Matt Boldy -, $4, $5, $6, $7, $8, 2025',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    expect(result.veterans['dylan-strome']).toBeDefined();
    expect(result.veterans['dylan-strome'].name).toBe('Dylan Strome');

    expect(result.veterans['jesper-bratt']).toBeDefined();
    expect(result.veterans['jesper-bratt'].name).toBe('Jesper Bratt');

    expect(result.veterans['lucas-raymond']).toBeDefined();
    expect(result.veterans['lucas-raymond'].name).toBe('Lucas Raymond');

    expect(result.veterans['matt-boldy']).toBeDefined();
    expect(result.veterans['matt-boldy'].name).toBe('Matt Boldy');
  });

  // CSV edge-case tests
  test('parses quoted names containing commas', () => {
    const rows = [
      'TEAM EDGE,',
      '"Smith, John", $1, $2, $3, $4, $5, 2025',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    const ids = Object.keys(result.veterans);
    expect(ids.length).toBe(1);
    const p = result.veterans[ids[0]];
    expect(p).toBeDefined();
    expect(p.name).toBe('Smith, John');
    expect(p.retentionYear).toBe(2025);
  });

  test('parses quoted names with escaped quotes', () => {
    const rows = [
      'TEAM EDGE,',
      '"John ""The Hammer"" Smith", $1, $2, $3, $4, $5, 2025',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    const ids = Object.keys(result.veterans);
    expect(ids.length).toBe(1);
    const p = result.veterans[ids[0]];
    expect(p).toBeDefined();
    expect(p.name).toBe('John "The Hammer" Smith');
    expect(p.retentionYear).toBe(2025);
  });

  test('tolerates varying column counts without throwing', () => {
    const rows = [
      'TEAM VAR,',
      // name only
      'NameOnly',
      // name + one cost
      'OneCost, $42',
      // name + extra columns beyond expected
      'ExtraCols, $1, $2, $3, $4, $5, 2025, EXTRA, MORE',
    ];
    const csv = rows.join('\n');
    const result = parseVeterans(csv);

    // Should not throw and should create entries for each provided name
    expect(Object.keys(result.veterans).length).toBeGreaterThanOrEqual(3);

    // NameOnly currentCost should be null
    const nameOnly = result.veterans['nameonly'];
    expect(nameOnly).toBeDefined();
    expect(nameOnly.currentCost).toBeNull();

    const oneCost = result.veterans['onecost'];
    expect(oneCost).toBeDefined();
    expect(oneCost.currentCost).toBe(42);

    const extra = result.veterans['extracols'];
    expect(extra).toBeDefined();
    expect(extra.currentCost).toBe(5);
  });

});
