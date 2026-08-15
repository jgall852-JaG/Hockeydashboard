import { loadLeagueData, DATA_FILES } from './loadLeagueData.js';

function padRight(s, width) {
  s = String(s);
  if (s.length >= width) return s;
  return s + ' '.repeat(width - s.length);
}

async function main() {
  try {
    const data = await loadLeagueData();
    const metadata = data.metadata || {};

    console.log('=== LEAGUE DATA SUMMARY ===\n');
    console.log(padRight('Dataset', 20) + ' | ' + padRight('Records', 8) + ' | Status');
    console.log('-'.repeat(20) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(10));

    for (const key of Object.keys(DATA_FILES)) {
      const meta = metadata[key] || { path: DATA_FILES[key], records: 0, status: 'missing' };
      console.log(padRight(key, 20) + ' | ' + padRight(meta.records || 0, 8) + ' | ' + (meta.status || 'unknown'));
    }

    console.log('\nDetailed metadata:');
    for (const key of Object.keys(DATA_FILES)) {
      const meta = metadata[key] || { path: DATA_FILES[key], records: 0, status: 'missing' };
      console.log('\n--- ' + key + ' ---');
      console.log('path: ' + meta.path);
      console.log('status: ' + meta.status + (meta.message ? ' - ' + meta.message : ''));
      console.log('records: ' + (meta.records || 0));
      console.log('loadedAt: ' + (meta.loadedAt || '-'));
    }

    // Optionally show a small sample for each dataset
    console.log('\nSample records (up to 3 each):');
    if (data.roster && data.roster.players) {
      const keys = Object.keys(data.roster.players).slice(0, 3);
      console.log('\nroster players:');
      keys.forEach(k => console.log('- ' + k));
    }

    if (data.prospects && data.prospects.prospects) {
      const keys = Object.keys(data.prospects.prospects).slice(0, 3);
      console.log('\nprospects:');
      keys.forEach(k => console.log('- ' + k + ' => ' + data.prospects.prospects[k].name));
    }

    if (data.veterans && data.veterans.veterans) {
      const keys = Object.keys(data.veterans.veterans).slice(0, 3);
      console.log('\nveterans:');
      keys.forEach(k => console.log('- ' + k + ' => ' + data.veterans.veterans[k].name));
    }

    if (data.transactions && data.transactions.players) {
      const keys = Object.keys(data.transactions.players).slice(0, 3);
      console.log('\ntransactions rows (keys):');
      keys.forEach(k => console.log('- ' + k));
    }

  } catch (err) {
    console.error('Error validating league data:');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

main();
