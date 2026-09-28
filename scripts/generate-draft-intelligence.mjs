import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshGoogleSheetState } from '../app.js';
import { buildDraftIntelligence } from '../draftIntelligence.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(scriptDirectory, '..');
const statsPath = process.argv[2];
const metricsPath = process.argv[3];

if (!statsPath) {
  throw new Error('Usage: node scripts/generate-draft-intelligence.mjs <nhl-skater-stats.csv> [normalized-source-metrics.json]');
}

const nhlStatsCsv = await fs.readFile(path.resolve(statsPath), 'utf8');
const supplementalData = metricsPath
  ? JSON.parse(await fs.readFile(path.resolve(metricsPath), 'utf8'))
  : {};
const state = await refreshGoogleSheetState({
  version: 2,
  datasets: {},
  metadata: {},
  manualOverrides: [],
  workingAssignments: {},
});
const outputs = buildDraftIntelligence({
  rosterData: state.datasets.roster,
  prospectsData: state.datasets.prospects,
  nhlStatsCsv,
  supplementalData,
  leagueImportedAt: state.metadata.roster?.importedAt || null,
});
const outputDirectory = path.join(repositoryDirectory, 'data');
await fs.mkdir(outputDirectory, { recursive: true });

for (const [filename, data] of Object.entries(outputs)) {
  await fs.writeFile(path.join(outputDirectory, filename), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

console.log(`Generated ${Object.keys(outputs).length} partial Draft Intelligence files in ${outputDirectory}`);
console.log(`NHL stats season: ${outputs['players.json'].sourceCoverage.nhlSkaterStats.season}`);
console.log(`League players: ${outputs['players.json'].players.length}`);
console.log(`Matched NHL skaters: ${outputs['players.json'].sourceCoverage.nhlSkaterStats.matchedLeaguePlayers}`);
console.log(`Unpriced: ${outputs['auction.json'].unpricedPlayerCount}`);
