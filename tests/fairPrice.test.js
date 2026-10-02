import {
  buildPastAuctionPrices,
  calculateFairPriceV2,
  computeFairPriceV2,
  getPoolPoints,
  getRatioFactor,
  getScarcityFactor,
  FAIR_PRICE_V2_RANGES,
  matchPastAuctionName,
  parsePastAuctionPositions,
  parsePastAuctionSheet,
} from '../fairPrice.js';
import { getDealRating } from '../poolGames.js';

const PAST_SHEET = [
  'DRUNKEN FLYBOYS,,,,FIGHTING IRISH,,,',
  '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
  '1,D Strome,C,$7.00,,JT Miller,LW,$14.50',
  '2,PL Dubois,CL,$2.50,,C Makar,D,$45.50',
  '24,NEW JERSEY,G,$1.00,,DALLAS,G,$7.00',
  ',TOTAL SPENT,,$234.00,,TOTAL SPENT,,$248.50',
  ',BALANCE,,$16.00,,BALANCE,,$1.50',
].join('\r\n');

function pool(entries) {
  return Object.fromEntries(entries.map(([key, positions, team = 'EDM']) => [key, { playerKey: key, name: key, team, positions }]));
}

describe('past auction sheets', () => {
  test('parses post-draft grids, skipping goalie teams and summary rows', () => {
    const { players } = parsePastAuctionSheet(PAST_SHEET);
    expect(players).toEqual([
      { name: 'D Strome', owner: 'DRUNKEN FLYBOYS', position: 'C', cost: 7 },
      { name: 'JT Miller', owner: 'FIGHTING IRISH', position: 'LW', cost: 14.5 },
      { name: 'PL Dubois', owner: 'DRUNKEN FLYBOYS', position: 'CL', cost: 2.5 },
      { name: 'C Makar', owner: 'FIGHTING IRISH', position: 'D', cost: 45.5 },
    ]);
  });

  test('matches abbreviated names to a unique canonical pool key', () => {
    const keys = new Set(['dylan strome', 'j t miller', 'pierre luc dubois', 'quinn hughes', 'jack hughes', 'jake sanderson', 'josh sanderson']);
    expect(matchPastAuctionName('D Strome', keys)).toBe('dylan strome');
    expect(matchPastAuctionName('JT Miller', keys)).toBe('j t miller');
    expect(matchPastAuctionName('PL Dubois', keys)).toBe('pierre luc dubois');
    expect(matchPastAuctionName('Q Hughes', keys)).toBe('quinn hughes');
    expect(matchPastAuctionName('J Sanderson', keys)).toBe('');
    expect(matchPastAuctionName('Z Nobody', keys)).toBe('');
  });

  test('breaks ambiguous initials with the sheet position', () => {
    const positionsByKey = new Map([
      ['leo carlsson', ['C']], ['lucas carlsson', ['D']],
      ['elias pettersson', ['C']], ['elias nils pettersson', ['D']],
      ['tage thompson', ['C', 'RW']], ['tyce thompson', ['C']],
    ]);
    const keys = new Set(positionsByKey.keys());
    expect(parsePastAuctionPositions('CL')).toEqual(['C', 'LW']);
    expect(parsePastAuctionPositions('RW')).toEqual(['RW']);
    expect(matchPastAuctionName('L Carlsson', keys, { position: 'C', positionsByKey })).toBe('leo carlsson');
    expect(matchPastAuctionName('E Pettersson', keys, { position: 'C', positionsByKey })).toBe('elias pettersson');
    expect(matchPastAuctionName('T Thompson', keys, { position: 'C', positionsByKey })).toBe('');
    expect(matchPastAuctionName('L Carlsson', keys)).toBe('');
  });

  test('uses the most recent season first, then the older season', () => {
    const pastAuctions = {
      seasons: {
        2025: { players: [{ name: 'D Strome', cost: 7 }] },
        2024: { players: [{ name: 'D Strome', cost: 2 }, { name: 'C Makar', cost: 40.5 }] },
      },
    };
    expect(buildPastAuctionPrices(pastAuctions, ['dylan strome', 'cale makar'])).toEqual({
      'dylan strome': { price: 7, season: '2025', sheetName: 'D Strome' },
      'cale makar': { price: 40.5, season: '2024', sheetName: 'C Makar' },
    });
  });
});

describe('fairPriceV2 factors', () => {
  test('scarcity factor bands: D 1.3-1.4, RW 1.15, LW 1.05, C 0.8-0.9 by pool depth', () => {
    expect(getScarcityFactor(['D'], { D: 0 })).toBe(1.3);
    expect(getScarcityFactor(['D'], { D: 100 })).toBeCloseTo(1.4);
    expect(getScarcityFactor(['C'], { C: 0 })).toBe(0.8);
    expect(getScarcityFactor(['C'], { C: 50 })).toBeCloseTo(0.85);
    expect(getScarcityFactor(['RW'], { RW: 90 })).toBe(1.15);
    expect(getScarcityFactor(['LW'], { LW: 0 })).toBe(1.05);
    expect(getScarcityFactor(['C', 'RW'], { C: 0, RW: 0 })).toBe(1.15);
    expect(getScarcityFactor(['G'], {})).toBe(1);
    expect(getScarcityFactor([], {})).toBe(1);
  });

  test('production uses goals + 0.5*assists against the league average, clamped 0.9-1.3', () => {
    expect(getPoolPoints(30, 40)).toBe(50);
    expect(getPoolPoints(null, 10)).toBe(5);
    expect(getPoolPoints(null, null)).toBeNull();
    expect(getRatioFactor(55, 50, FAIR_PRICE_V2_RANGES.production)).toBeCloseTo(1.1);
    expect(getRatioFactor(100, 50, FAIR_PRICE_V2_RANGES.production)).toBe(1.3);
    expect(getRatioFactor(10, 50, FAIR_PRICE_V2_RANGES.production)).toBe(0.9);
    expect(getRatioFactor(null, 50, FAIR_PRICE_V2_RANGES.production)).toBe(1);
  });

  test('pool games factor is clamped 0.85-1.15', () => {
    expect(getRatioFactor(60, 50, FAIR_PRICE_V2_RANGES.poolGames)).toBe(1.15);
    expect(getRatioFactor(40, 50, FAIR_PRICE_V2_RANGES.poolGames)).toBe(0.85);
    expect(getRatioFactor(52, 50, FAIR_PRICE_V2_RANGES.poolGames)).toBeCloseTo(1.04);
  });

  test('fairPriceV2 multiplies base price by all factors and rounds to 2 decimals', () => {
    expect(calculateFairPriceV2({ basePrice: 10, scarcityFactor: 1.15, productionFactor: 1.1, poolGamesFactor: 0.95 })).toBe(12.02);
    expect(calculateFairPriceV2({ basePrice: null })).toBeNull();
  });
});

describe('computeFairPriceV2', () => {
  const ahlPool = pool([
    ['dylan strome', ['C'], 'WSH'],
    ['cale makar', ['D'], 'COL'],
    ['tier player', ['RW'], 'EDM'],
    ['band player', ['LW'], 'EDM'],
    ['no tier', ['C'], 'EDM'],
  ]);
  const players = [
    { name: 'Dylan Strome', tier: 3, forecastedGoals: 20, forecastedAssists: 40, poolGames: { totalPoolGames: 50 }, salary: 5000000, keeper: { cost: 99 } },
    { name: 'Cale Makar', tier: 3, forecastedGoals: 25, forecastedAssists: 90, poolGames: { totalPoolGames: 50 } },
    { name: 'Tier Player', tier: 3, forecastedGoals: 20, forecastedAssists: 40 },
    { name: 'Band Player', tier: 5, forecastedGoals: null, forecastedAssists: null },
    { name: 'No Tier', tier: null },
  ];
  const pastAuctions = { seasons: { 2025: { players: [{ name: 'D Strome', cost: 7 }, { name: 'C Makar', cost: 45.5 }] } } };
  const result = computeFairPriceV2({
    ahlPool,
    availableKeys: Object.keys(ahlPool),
    players,
    pastAuctions,
    getPoolGamesForTeam: () => ({ totalPoolGames: 50 }),
  });

  test('uses the past auction price as the base price', () => {
    expect(result['dylan strome']).toMatchObject({ basePrice: 7, baseSource: 'Post Draft 2025 (D Strome)' });
    expect(result['cale makar']).toMatchObject({ basePrice: 45.5 });
  });

  test('falls back to the tier league average, then the tier price band midpoint', () => {
    expect(result['tier player']).toMatchObject({ basePrice: 26.25, baseSource: 'Tier 3 league average' });
    expect(result['band player']).toMatchObject({ basePrice: 2.5, baseSource: 'Tier 5 price band midpoint' });
    expect(result['no tier']).toMatchObject({ basePrice: null, fairPriceV2: null });
  });

  test('applies scarcity, production and pool-games factors and never uses salary or keeper cost', () => {
    const strome = result['dylan strome'];
    expect(strome.poolGamesFactor).toBe(1);
    expect(strome.fairPriceV2).toBe(Math.round(7 * strome.scarcityFactor * strome.productionFactor * strome.poolGamesFactor * 100) / 100);
    expect(result['cale makar'].scarcityFactor).toBeGreaterThanOrEqual(1.3);
    expect(result['cale makar'].productionFactor).toBe(1.3);
    expect(result['band player'].productionFactor).toBe(1);
    expect(JSON.stringify(strome)).not.toMatch(/5000000|99/);
  });

  test('deal rating thresholds apply to fairPriceV2', () => {
    const fair = result['cale makar'].fairPriceV2;
    expect(getDealRating(0.7 * fair, fair).rating).toBe('STEAL');
    expect(getDealRating(1.1 * fair, fair).rating).toBe('FAIR');
    expect(getDealRating(1.1 * fair + 0.5, fair).rating).toBe('OVERPAY');
  });
});
