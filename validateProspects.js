import { readFile } from "fs/promises";
import { parseProspects } from "./prospectParser.js";

async function main() {
  try {
    const csvUrl = new URL('../Data/Rosters/AHL Draft - Prospects.csv', import.meta.url);
    const csvText = await readFile(csvUrl, 'utf8');

    const result = parseProspects(csvText);

    const prospectIds = Object.keys(result.prospects || {});
    const totalProspects = prospectIds.length;
    const ownerEntries = Object.entries(result.owners || {});
    const totalOwners = ownerEntries.length;
    const totalFarmPlayers = Array.isArray(result.farmPlayers) ? result.farmPlayers.length : 0;

    console.log('=== PROSPECT SUMMARY ===\n');

    console.log('Total prospects:');
    console.log(totalProspects);

    console.log('\nTotal owners:');
    console.log(totalOwners);

    console.log('\nTotal farm players:');
    console.log(totalFarmPlayers);

    console.log('\nFirst 10 prospect names:');
    prospectIds.slice(0, 10).forEach(id => {
      const p = result.prospects[id];
      console.log(`- ${p && p.name ? p.name : id}`);
    });

    console.log('\nFirst 5 owners:');
    ownerEntries.slice(0, 5).forEach(([owner, ids]) => {
      const count = Array.isArray(ids) ? ids.length : ids;
      console.log(`- ${owner}: ${count} prospects`);
    });

    if (prospectIds.length > 0) {
      const sampleId = prospectIds[0];
      const record = result.prospects[sampleId];

      console.log('\nSample prospect record:\n');
      console.dir(record, { depth: null });
    } else {
      console.log('\nNo prospect records found in the CSV.');
    }

    // Full prospect audit
    console.log('\n=== FULL PROSPECT AUDIT ===\n');

    const prospects = Object.values(result.prospects || {});

    prospects.sort((a, b) => {
      const oa = (a.owner || '').toUpperCase();
      const ob = (b.owner || '').toUpperCase();
      if (oa < ob) return -1;
      if (oa > ob) return 1;
      const na = (a.name || '').toUpperCase();
      const nb = (b.name || '').toUpperCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });

    prospects.forEach(p => {
      console.log(`Owner: ${p.owner || ''}`);
      console.log(`Name: ${p.name || ''}`);
      console.log(`Cost: ${p.cost === null || p.cost === undefined ? '' : p.cost}`);
      console.log(`Draft Year: ${p.draftYear === null || p.draftYear === undefined ? '' : p.draftYear}`);
      console.log(`Term Remaining: ${p.termRemaining === null || p.termRemaining === undefined ? '' : p.termRemaining}`);
      console.log('');
    });

    const missingDraftYear = prospects.filter(p => p.draftYear === null || p.draftYear === undefined).map(p => p.name || p.playerId);
    const missingCost = prospects.filter(p => p.cost === null || p.cost === undefined).map(p => p.name || p.playerId);
    // Exclude farm players from 'missing term' — farms intentionally have null termRemaining
    const missingTerm = prospects.filter(p => !p.farm && (p.termRemaining === null || p.termRemaining === undefined)).map(p => p.name || p.playerId);
    const farmPlayersList = prospects.filter(p => p.farm).map(p => p.name || p.playerId);

    console.log('\nPlayers missing draft year:');
    if (missingDraftYear.length === 0) {
      console.log('- None');
    } else {
      missingDraftYear.forEach(n => console.log(`- ${n}`));
    }

    console.log('\nPlayers missing cost:');
    if (missingCost.length === 0) {
      console.log('- None');
    } else {
      missingCost.forEach(n => console.log(`- ${n}`));
    }

    console.log('\nFarm players:');
    if (farmPlayersList.length === 0) {
      console.log('- None');
    } else {
      farmPlayersList.forEach(n => console.log(`- ${n}`));
    }

    console.log('\nPlayers missing term remaining (non-farm):');
    if (missingTerm.length === 0) {
      console.log('- None');
    } else {
      missingTerm.forEach(n => console.log(`- ${n}`));
    }

  } catch (err) {
    console.error('Error during prospect validation:');
    console.error(err && err.stack ? err.stack : err);
  }
}

main();
