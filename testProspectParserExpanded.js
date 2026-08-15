import { parseProspects, getFarmPlayers, getRightsPlayers } from "./prospectParser.js";

function assert(condition, message) {
  if (!condition) {
    console.error('ASSERTION FAILED:', message);
    process.exit(1);
  }
}

function runExpandedTests() {
  const rows = [
    "TEAMS,",
    "TEAM A,",
    // normal row
    "Connor McDavid LW - 2015,$12,3,,,Y",
    // farm, different case
    "John Doe D - 2026,$0,Farm,,,N",
    // quoted name with escaped quotes and comma inside
    "\"Big \"\"Joe\"\" Jr., C - 2022\",$1,2,,,Y",
    // name with comma inside quotes
    "\"Smith, Jr., John\",$5,4,,,Y",
    // cost with commas and decimals
    "Rich Player C - 2018,$1,200.50,5,,,N",
    // missing cost should parse as 0
    "Free Agent C - 2020,,1,,,N",
    // non-numeric termRemaining -> null
    "Strange Name C - 2021,$5,N/A,,,Y",
    "",
    "TEAM B,",
    // another team row to check owners grouping
    "Álvaro Ñúñez LW - 2019,$3,2,,,Y",
    // FARM lowercase spelled differently
    "FarmLower C - 2024,$0,fArM,,,N",
    "",
  ];

  const csv = rows.join("\n");
  const data = parseProspects(csv);

  console.log(JSON.stringify(data, null, 2));

  // Basic counts
  const prospectValues = Object.values(data.prospects);
  assert(prospectValues.length === 9, `Expected 9 prospects, got ${prospectValues.length}`);

  // Check McDavid
  const mcid = prospectValues.find(p => p.name.includes('Connor McDavid'));
  assert(mcid, 'McDavid not found');
  assert(mcid.cost === 12, `McDavid cost expected 12 got ${mcid.cost}`);
  assert(mcid.termRemaining === 3, `McDavid termRemaining expected 3 got ${mcid.termRemaining}`);
  assert(mcid.matchingRights === true, 'McDavid matchingRights expected true');

  // John Doe farm
  const jdoe = prospectValues.find(p => p.name.includes('John Doe'));
  assert(jdoe, 'John Doe not found');
  assert(jdoe.farm === true && jdoe.termRemaining === null, 'John Doe farm handling wrong');

  // Big Joe quoted name
  const big = prospectValues.find(p => p.name.includes('Big') && p.name.includes('Joe'));
  assert(big, 'Big Joe not found');
  assert(big.draftYear === 2022, `Big Joe draftYear expected 2022 got ${big.draftYear}`);

  // Smith, Jr. name preserved (comma inside quotes)
  const smith = prospectValues.find(p => p.name.includes('Smith'));
  assert(smith && smith.name.startsWith('Smith, Jr.'), `Smith name parsing wrong: ${smith && smith.name}`);

  // Rich Player cost parsing with comma/decimal
  const rich = prospectValues.find(p => p.name.includes('Rich Player'));
  assert(rich && Math.abs(rich.cost - 1200.5) < 0.001, `Rich Player cost parsed wrong: ${rich && rich.cost}`);

  // Free Agent missing cost -> 0
  const freeAgent = prospectValues.find(p => p.name.includes('Free Agent'));
  assert(freeAgent && freeAgent.cost === 0, `Free Agent cost expected 0 got ${freeAgent && freeAgent.cost}`);

  // Strange Name termRemaining null
  const strange = prospectValues.find(p => p.name.includes('Strange Name'));
  assert(strange && strange.termRemaining === null, 'Strange termRemaining should be null');

  // Non-ASCII name normalized to id but name kept
  const alvaro = prospectValues.find(p => p.name.includes('Álvaro') || p.name.includes('Alvaro'));
  assert(alvaro, 'Álvaro not found');
  assert(alvaro.playerId.includes('alvaro') || alvaro.playerId.includes('alvaro-nunez'), `Álvaro playerId looks wrong: ${alvaro.playerId}`);

  // FARM variations capture farm players
  const farms = getFarmPlayers(data).map(p => p.playerId);
  assert(farms.includes('john-doe') || farms.includes('john-doe'), `Expected john-doe in farms, got ${farms}`);
  assert(farms.some(id => id.includes('farmlower') || id.includes('farm-lower')), `Expected farmlower in farms: ${farms}`);

  // Rights players
  const rights = getRightsPlayers(data).map(p => p.playerId);
  assert(rights.length >= 3, `Expected at least 3 rights players, got ${rights.length}`);

  // Owners grouping
  assert(Object.keys(data.owners).includes('TEAM A') && Object.keys(data.owners).includes('TEAM B'), 'Expected TEAM A and TEAM B owners');
  assert(data.owners['TEAM B'].length >= 2, `TEAM B should have at least 2 players, got ${data.owners['TEAM B'].length}`);

  console.log('ALL EXPANDED TESTS PASSED');
}

runExpandedTests();
