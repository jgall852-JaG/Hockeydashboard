// Pool games come only from the AHL Scores schedule tab: each numbered MATCHUP day lists the
// NHL games that count for the pool, so a player's pool games are the schedule rows in which
// his NHL team plays. NHL games played are never used.

export const POOL_SCHEDULE_TAB = 'AHL Scores';
export const POOL_FIRST_HALF_LAST_MATCHUP = 46;

// AHL Position/Utility sheets mix standard NHL codes with league shorthand (CBS, FLO, VEG, WIN...).
const TEAM_CODE_TO_SCHEDULE_NAME = {
  ANA: 'Anaheim', BOS: 'Boston', BUF: 'Buffalo', CGY: 'Calgary', CAR: 'Carolina',
  CHI: 'Chicago', COL: 'Colorado', CBJ: 'Columbus', CBS: 'Columbus', DAL: 'Dallas',
  DET: 'Detroit', EDM: 'Edmonton', FLA: 'Florida', FLO: 'Florida', LA: 'Los Angeles',
  LAK: 'Los Angeles', MIN: 'Minnesota', MTL: 'Montreal', NSH: 'Nashville', NJ: 'New Jersey',
  NJD: 'New Jersey', NYI: 'NY Islanders', NYR: 'NY Rangers', OTT: 'Ottawa', PHI: 'Philadelphia',
  PIT: 'Pittsburgh', SJ: 'San Jose', SJS: 'San Jose', SEA: 'Seattle', STL: 'St. Louis',
  TB: 'Tampa Bay', TBL: 'Tampa Bay', TOR: 'Toronto', UTA: 'Utah', UTAH: 'Utah', VAN: 'Vancouver',
  VGK: 'Vegas', VEG: 'Vegas', WSH: 'Washington', WAS: 'Washington', WPG: 'Winnipeg', WIN: 'Winnipeg',
};

const normalizeTeam = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

export function resolveScheduleTeamName(team) {
  const code = String(team ?? '').trim().toUpperCase();
  if (TEAM_CODE_TO_SCHEDULE_NAME[code]) return TEAM_CODE_TO_SCHEDULE_NAME[code];
  const byName = Object.values(TEAM_CODE_TO_SCHEDULE_NAME).find((name) => normalizeTeam(name) === normalizeTeam(team));
  return byName || null;
}

export function parsePoolSchedule(rows = []) {
  const games = [];
  let matchup = null;
  rows.forEach((row) => {
    if (!Array.isArray(row)) return;
    const cells = row.map((cell) => String(cell ?? '').replace(/\u00a0/g, ' ').trim());
    if (/^\d+$/.test(cells[0]) && cells[1]?.toUpperCase() === 'MATCHUP') {
      matchup = Number(cells[0]);
      return;
    }
    const homeCell = cells[2] || '';
    if (matchup === null || !homeCell.startsWith('@')) return;
    const away = cells[1];
    const home = homeCell.replace(/^@\s*/, '');
    if (away && home) games.push({ matchup, away, home });
  });
  return games;
}

export function buildPoolGamesByTeam(rows, firstHalfLastMatchup = POOL_FIRST_HALF_LAST_MATCHUP) {
  const byTeam = {};
  parsePoolSchedule(rows).forEach(({ matchup, away, home }) => {
    [away, home].forEach((team) => {
      const key = normalizeTeam(team);
      byTeam[key] ||= { firstHalfGames: 0, secondHalfGames: 0, totalPoolGames: 0 };
      byTeam[key][matchup <= firstHalfLastMatchup ? 'firstHalfGames' : 'secondHalfGames'] += 1;
      byTeam[key].totalPoolGames += 1;
    });
  });
  return byTeam;
}

const poolGamesCache = new WeakMap();

export function getPoolGames(stateObj, team) {
  const empty = { firstHalfGames: null, secondHalfGames: null, totalPoolGames: null };
  const rows = stateObj?.datasets?.ahlScores?.tabs?.[POOL_SCHEDULE_TAB]?.rows;
  const scheduleName = resolveScheduleTeamName(team);
  if (!Array.isArray(rows) || !scheduleName) return empty;
  if (!poolGamesCache.has(rows)) poolGamesCache.set(rows, buildPoolGamesByTeam(rows));
  const byTeam = poolGamesCache.get(rows);
  if (!Object.keys(byTeam).length) return empty;
  return { ...(byTeam[normalizeTeam(scheduleName)] || { firstHalfGames: 0, secondHalfGames: 0, totalPoolGames: 0 }) };
}

// Deal rating compares a draft-dollar bid with the dashboard's estimated auction value only.
export function getDealRating(bid, fairPrice) {
  const amount = Number.parseFloat(bid);
  const fair = Number(fairPrice);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(fair) || fair <= 0) return null;
  if (amount <= 0.7 * fair + 1e-9) return { rating: 'STEAL', tone: 'green' };
  if (amount <= 1.1 * fair + 1e-9) return { rating: 'FAIR', tone: 'yellow' };
  return { rating: 'OVERPAY', tone: 'red' };
}
