import { parseProspects, getFarmPlayers, getRightsPlayers } from "./prospectParser.js";

function runTests() {
  const rows = [
    "TEAMS,",
    "TEAM A,",
    "Connor McDavid LW - 2015,$12,3,,,Y",
    "John Doe D - 2026,$0,FARM,,,N",
    "\"Big \"\"Joe\"\" Jr., C - 2022\",$1,2,,,Y",
    ""
  ];
  const csv = rows.join("\n");

  const data = parseProspects(csv);

  console.log(JSON.stringify(data, null, 2));

  const prospects = data.prospects;
  const keys = Object.keys(prospects);
  if (keys.length !== 3) {
    console.error(`Expected 3 prospects, got ${keys.length}`);
    process.exit(1);
  }

  // Check McDavid
  const mcid = Object.values(prospects).find(p => p.name.includes('Connor McDavid'));
  if (!mcid) { console.error('McDavid not found'); process.exit(1); }
  if (mcid.cost !== 12) { console.error('McDavid cost wrong', mcid.cost); process.exit(1); }
  if (mcid.termRemaining !== 3) { console.error('McDavid termRemaining wrong', mcid.termRemaining); process.exit(1); }
  if (!mcid.matchingRights) { console.error('McDavid matchingRights wrong'); process.exit(1); }

  // John Doe farm
  const jdoe = Object.values(prospects).find(p => p.name.includes('John Doe'));
  if (!jdoe) { console.error('John Doe not found'); process.exit(1); }
  if (!jdoe.farm || jdoe.termRemaining !== null) { console.error('John Doe farm handling wrong', jdoe); process.exit(1); }

  // Big Joe quoted name
  const big = Object.values(prospects).find(p => p.name.includes('Big') && p.name.includes('Joe'));
  if (!big) { console.error('Big Joe not found', JSON.stringify(Object.values(prospects).map(p=>p.name))); process.exit(1); }
  if (big.draftYear !== 2022) { console.error('Big Joe draftYear wrong', big.draftYear); process.exit(1); }

  console.log('ALL TESTS PASSED');
}

runTests();
