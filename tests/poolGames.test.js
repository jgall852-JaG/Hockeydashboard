import {
  POOL_FIRST_HALF_LAST_MATCHUP,
  buildPoolGamesByTeam,
  getDealRating,
  getPoolGames,
  parsePoolSchedule,
  resolveScheduleTeamName,
} from '../poolGames.js';

const NBSP = '\u00a0';
const game = (away, home) => [' ', away, `${NBSP} @ ${NBSP}${home}`, '7:00 PM', 'Toye Soldiers', '', 'vs.', 'Hosers'];
const header = (number) => [String(number), 'MATCHUP', '', 'TIME'];

// Mirrors the AHL Scores tab: date row, numbered MATCHUP header, then NHL game rows.
const scheduleRows = [
  ['#', 'NHL GAMES', '', '', 'AHL MATCHUP'],
  ['', 'Thursday, October 1, 2026'],
  header(1),
  game('Buffalo', 'Columbus'),
  game('Edmonton', 'Vancouver'),
  ['', 'Saturday, October 3, 2026'],
  header(2),
  game('Columbus', 'Edmonton'),
  ['', 'Tuesday, March 2, 2027'],
  header(POOL_FIRST_HALF_LAST_MATCHUP),
  game('Edmonton', 'Calgary'),
  header(POOL_FIRST_HALF_LAST_MATCHUP + 1),
  game('Vancouver', 'Edmonton'),
  game('Tampa Bay', 'NY Rangers'),
  header(91),
  game('Edmonton', 'Columbus'),
];

describe('pool games from the AHL Scores schedule', () => {
  test('parses matchup numbers and away/home teams, ignoring date and header rows', () => {
    const games = parsePoolSchedule(scheduleRows);
    expect(games).toHaveLength(7);
    expect(games[0]).toEqual({ matchup: 1, away: 'Buffalo', home: 'Columbus' });
    expect(games.at(-1)).toEqual({ matchup: 91, away: 'Edmonton', home: 'Columbus' });
  });

  test('counts first-half (matchups 1-46) and second-half (47+) games per NHL team', () => {
    const byTeam = buildPoolGamesByTeam(scheduleRows);
    expect(byTeam.edmonton).toEqual({ firstHalfGames: 3, secondHalfGames: 2, totalPoolGames: 5 });
    expect(byTeam.columbus).toEqual({ firstHalfGames: 2, secondHalfGames: 1, totalPoolGames: 3 });
    expect(byTeam['ny rangers']).toEqual({ firstHalfGames: 0, secondHalfGames: 1, totalPoolGames: 1 });
  });

  test('resolves standard and AHL-sheet team codes to schedule names', () => {
    expect(resolveScheduleTeamName('EDM')).toBe('Edmonton');
    expect(resolveScheduleTeamName('CBS')).toBe('Columbus');
    expect(resolveScheduleTeamName('CBJ')).toBe('Columbus');
    expect(resolveScheduleTeamName('TB')).toBe('Tampa Bay');
    expect(resolveScheduleTeamName('NYR')).toBe('NY Rangers');
    expect(resolveScheduleTeamName('VEG')).toBe('Vegas');
    expect(resolveScheduleTeamName('Edmonton')).toBe('Edmonton');
    expect(resolveScheduleTeamName('UFA')).toBeNull();
  });

  test('reads only the AHL Scores tab and returns NULLs without a schedule or team', () => {
    const state = { datasets: { ahlScores: { tabs: { 'AHL Scores': { rows: scheduleRows } } } } };
    expect(getPoolGames(state, 'CBS')).toEqual({ firstHalfGames: 2, secondHalfGames: 1, totalPoolGames: 3 });
    expect(getPoolGames(state, 'WPG')).toEqual({ firstHalfGames: 0, secondHalfGames: 0, totalPoolGames: 0 });
    const nulls = { firstHalfGames: null, secondHalfGames: null, totalPoolGames: null };
    expect(getPoolGames(state, 'UFA')).toEqual(nulls);
    expect(getPoolGames({ datasets: { ahlScores: { tabs: { 'AHL Games Played': { rows: scheduleRows } } } } }, 'EDM')).toEqual(nulls);
    expect(getPoolGames({}, 'EDM')).toEqual(nulls);
  });
});

describe('deal rating', () => {
  test('rates draft-dollar bids against fair price with inclusive 70% / 110% bounds', () => {
    expect(getDealRating(7, 10)).toEqual({ rating: 'STEAL', tone: 'green' });
    expect(getDealRating('7.5', 10)).toEqual({ rating: 'FAIR', tone: 'yellow' });
    expect(getDealRating(11, 10)).toEqual({ rating: 'FAIR', tone: 'yellow' });
    expect(getDealRating(11.5, 10)).toEqual({ rating: 'OVERPAY', tone: 'red' });
    expect(getDealRating(21, 30)).toEqual({ rating: 'STEAL', tone: 'green' });
    expect(getDealRating(33, 30)).toEqual({ rating: 'FAIR', tone: 'yellow' });
  });

  test('returns null without a bid or a fair price', () => {
    expect(getDealRating('', 10)).toBeNull();
    expect(getDealRating(0, 10)).toBeNull();
    expect(getDealRating(5, null)).toBeNull();
    expect(getDealRating(5, 0)).toBeNull();
  });
});
