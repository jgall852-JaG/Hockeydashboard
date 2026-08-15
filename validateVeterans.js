import { readFile } from "fs/promises";
import { parseVeterans } from "./veteranParser.js";

async function main() {
  try {
    // Resolve CSV path relative to this script
    const csvUrl = new URL('../Data/Rosters/AHL Draft - Veterans.csv', import.meta.url);

    const csvText = await readFile(csvUrl, 'utf8');

    const result = parseVeterans(csvText);

    const veteranIds = Object.keys(result.veterans || {});
    const totalVeterans = veteranIds.length;
    const ownerEntries = Object.entries(result.owners || {});
    const totalOwners = ownerEntries.length;

    console.log('=== VETERAN SUMMARY ===\n');

    console.log('Total veterans:');
    console.log(totalVeterans);

    console.log('\nTotal owners:');
    console.log(totalOwners);

    console.log('\nFirst 10 veteran names:');
    veteranIds.slice(0, 10).forEach(id => {
      const v = result.veterans[id];
      console.log(`- ${v && v.name ? v.name : id}`);
    });

    console.log('\nFirst 5 owners:');
    ownerEntries.slice(0, 5).forEach(([owner, ids]) => {
      const count = Array.isArray(ids) ? ids.length : ids;
      console.log(`- ${owner}: ${count} veterans`);
    });

    if (veteranIds.length > 0) {
      const sampleId = veteranIds[0];
      const veteranRecord = result.veterans[sampleId];

      console.log('\nSample veteran record:\n');
      console.dir(veteranRecord, { depth: null });
    } else {
      console.log('\nNo veteran records found in the CSV.');
    }

    // Full veteran audit
    console.log('\n=== FULL VETERAN AUDIT ===\n');

    const vets = Object.values(result.veterans || {});

    vets.sort((a, b) => {
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

    vets.forEach(v => {
      console.log(`Owner: ${v.owner || ''}`);
      console.log(`Name: ${v.name || ''}`);
      console.log(`Retention Year: ${v.retentionYear === null || v.retentionYear === undefined ? '' : v.retentionYear}`);
      console.log(`Current Cost: ${v.currentCost === null || v.currentCost === undefined ? '' : v.currentCost}`);
      console.log('');
    });

    const missingYear = vets.filter(v => v.retentionYear === null || v.retentionYear === undefined).map(v => v.name || v.playerId);
    const missingCost = vets.filter(v => v.currentCost === null || v.currentCost === undefined).map(v => v.name || v.playerId);

    console.log('\nPlayers missing retention year:');
    if (missingYear.length === 0) {
      console.log('- None');
    } else {
      missingYear.forEach(n => console.log(`- ${n}`));
    }

    console.log('\nPlayers missing current cost:');
    if (missingCost.length === 0) {
      console.log('- None');
    } else {
      missingCost.forEach(n => console.log(`- ${n}`));
    }
  } catch (err) {
    console.error('Error during veteran validation:');
    console.error(err && err.stack ? err.stack : err);
  }
}

main();
