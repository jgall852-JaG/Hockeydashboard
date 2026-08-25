import { parseProspects, getFarmPlayers, getRightsPlayers } from "../prospectParser.js";

describe('prospectParser basic parsing', () => {
  test('parses simple CSV with quoted and escaped names', () => {
    const rows = [
      "TEAMS,",
      "TEAM A,",
      "Connor McDavid LW - 2015,$12,3,,,,Y",
      "John Doe D - 2026,$0,FARM,,,,N",
      "\"Big \"\"Joe\"\" Jr., C - 2022\",$1,2,,,,Y",
      ""
    ];

    const csv = rows.join('\n');
    const data = parseProspects(csv);

    const prospects = data.prospects;
    const keys = Object.keys(prospects);
    expect(keys.length).toBe(3);

    const mcid = Object.values(prospects).find(p => p.name.includes('Connor McDavid'));
    expect(mcid).toBeDefined();
    expect(mcid.cost).toBe(12);
    expect(mcid.termRemaining).toBe(3);
    expect(mcid.matchingRights).toBe(true);
    expect(mcid.poolPosition).toBe('LW');

    const jdoe = Object.values(prospects).find(p => p.name.includes('John Doe'));
    expect(jdoe).toBeDefined();
    expect(jdoe.farm).toBe(true);
    expect(jdoe.termRemaining).toBeNull();
    expect(jdoe.poolPosition).toBe('D');

    const big = Object.values(prospects).find(p => p.name.includes('Big') && p.name.includes('Joe'));
    expect(big).toBeDefined();
    expect(big.draftYear).toBe(2022);
  });
});

describe('prospectParser expanded cases', () => {
  test('handles commas in quoted names, currency formats, missing values, non-ascii names, and farm variations', () => {
    const rows = [
      "TEAMS,",
      "TEAM A,",
      // normal row
      "Connor McDavid LW - 2015,$12,3,,,,Y",
      // farm, different case
      "John Doe D - 2026,$0,Farm,,,,N",
      // quoted name with escaped quotes and comma inside
      "\"Big \"\"Joe\"\" Jr., C - 2022\",$1,2,,,,Y",
      // name with comma inside quotes
      "\"Smith, Jr., John\",$5,4,,,,Y",
      // cost with commas and decimals
      "Rich Player C - 2018,$1,200.50,5,,,,N",
      // missing cost should parse as 0
      "Free Agent C - 2020,,1,,,,N",
      // non-numeric termRemaining -> null
      "Strange Name C - 2021,$5,N/A,,,,Y",
      "",
      "TEAM B,",
      // another team row to check owners grouping
      "Álvaro Ñúñez LW - 2019,$3,2,,,,Y",
      // FARM lowercase spelled differently
      "FarmLower C - 2024,$0,fArM,,,,N",
      "",
    ];

    const csv = rows.join('\n');
    const data = parseProspects(csv);

    const prospectValues = Object.values(data.prospects);
    expect(prospectValues.length).toBe(9);

    const mcid = prospectValues.find(p => p.name.includes('Connor McDavid'));
    expect(mcid).toBeDefined();
    expect(mcid.cost).toBe(12);
    expect(mcid.termRemaining).toBe(3);
    expect(mcid.matchingRights).toBe(true);

    const jdoe = prospectValues.find(p => p.name.includes('John Doe'));
    expect(jdoe).toBeDefined();
    expect(jdoe.farm).toBe(true);
    expect(jdoe.termRemaining).toBeNull();

    const big = prospectValues.find(p => p.name.includes('Big') && p.name.includes('Joe'));
    expect(big).toBeDefined();
    expect(big.draftYear).toBe(2022);

    const smith = prospectValues.find(p => p.name.includes('Smith'));
    expect(smith).toBeDefined();
    expect(smith.name.startsWith('Smith, Jr.')).toBe(true);

    const rich = prospectValues.find(p => p.name.includes('Rich Player'));
    expect(rich).toBeDefined();
    // termRemaining for Rich Player should be numeric (in test input we used 5 then columns got shifted; ensure cost parsed correctly)
    expect(rich.cost).toBeCloseTo(1200.5, 3);

    const freeAgent = prospectValues.find(p => p.name.includes('Free Agent'));
    expect(freeAgent).toBeDefined();
    expect(freeAgent.cost).toBe(0);

    const strange = prospectValues.find(p => p.name.includes('Strange Name'));
    expect(strange).toBeDefined();
    expect(strange.termRemaining).toBeNull();

    const alvaro = prospectValues.find(p => p.name.includes('Álvaro') || p.name.includes('Alvaro'));
    expect(alvaro).toBeDefined();
    expect(alvaro.playerId).toMatch(/alvaro/);

    const farms = getFarmPlayers(data).map(p => p.playerId);
    expect(farms).toContain('john-doe');
    expect(farms.some(id => id.includes('farm') || id.includes('farmlower'))).toBe(true);

    const rights = getRightsPlayers(data).map(p => p.playerId);
    expect(rights.length).toBeGreaterThanOrEqual(3);

    // Owners grouping
    expect(Object.keys(data.owners)).toEqual(expect.arrayContaining(['TEAM A', 'TEAM B']));
    expect(data.owners['TEAM B'].length).toBeGreaterThanOrEqual(2);
  });

  test('matching rights column and farm handling', () => {
    const rows = [
      'TEAMS,',
      'TEAM X,',
      // matching rights Y at column 7
      'Rights Player C - 2024,$1,1,X,X,X,Y',
      // matching rights blank
      'NoRights C - 2024,$1,1,X,X,X,',
      // farm player with matching rights Y
      'FarmRights C - 2025,$0.5,FARM,,,,Y',
    ];
    const csv = rows.join('\n');
    const data = parseProspects(csv);

    const rp = Object.values(data.prospects).find(p => p.name.includes('Rights Player'));
    expect(rp).toBeDefined();
    expect(rp.matchingRights).toBe(true);

    const nr = Object.values(data.prospects).find(p => p.name.includes('NoRights'));
    expect(nr).toBeDefined();
    expect(nr.matchingRights).toBe(false);

    const fr = Object.values(data.prospects).find(p => p.name.includes('FarmRights'));
    expect(fr).toBeDefined();
    expect(fr.farm).toBe(true);
    // matching rights should be true even for farm players when column contains Y
    expect(fr.matchingRights).toBe(true);
  });
});
