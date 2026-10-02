import { applyForecastedStats, buildForecastedStats } from '../forecastedStats.js';
import { normalizeDobberRows, applyDobberIntelligence } from '../dobberIngestion.js';

describe('forecasted stats', () => {
  test('combines explicit Dobber projections with AHL first- and second-half splits', () => {
    const projections = { ProjPts: '60', ProjGP: '80', 'Proj SOG': '200' };
    const splits = { FHPPG: 0.6, SHPPG: 0.9, sourceTab: 'Scores' };
    expect(buildForecastedStats(projections, splits)).toEqual({
      projectedPoints: 60,
      projectedGoals: null,
      projectedAssists: null,
      projectedGames: 80,
      projectedShots: 200,
      FHPPG: 0.6,
      SHPPG: 0.9,
      splitsMethod: 'actual',
      compositeScore: 86,
    });
    expect(applyForecastedStats({ name: 'Player One', historicalSplits: splits }, projections))
      .toMatchObject({ forecastedPoints: 60, compositeForecastScore: 86, forecast: { projectedShots: 200 } });
  });

  test('does not infer a composite from missing or textual data, including zero-valued inputs', () => {
    expect(buildForecastedStats('60 points in 80 games', { FHPPG: 1, SHPPG: 2 }))
      .toMatchObject({ projectedPoints: null, compositeScore: null });
    expect(buildForecastedStats({ ProjPts: 60, ProjGP: 80 }, { FHPPG: 1, SHPPG: 2 }))
      .toMatchObject({ projectedPoints: 60, projectedShots: null, compositeScore: null });
    expect(buildForecastedStats({ ProjPts: 0, ProjGP: 0, ProjSOG: 0 }, { FHPPG: 0, SHPPG: 0 }).compositeScore)
      .toBe(0);
    expect(buildForecastedStats({ ProjPts: 60, ProjGP: 80, ProjSOG: 200 }, { FHPPG: null, SHPPG: 1 }).compositeScore)
      .toBeNull();
  });

  test('derives a trend-based FHPPG/SHPPG split from Rank/Upside/3YP when AHL splits are unavailable', () => {
    const projections = { ProjPts: '131', ProjGP: '77', ProjSOG: '277' };
    const rising = buildForecastedStats(projections, null, { threeYearPoints: 100, upside: 160 });
    expect(rising.splitsMethod).toBe('derived');
    expect(rising.SHPPG).toBeGreaterThan(rising.FHPPG);
    expect(rising.compositeScore).not.toBeNull();

    const declining = buildForecastedStats(projections, null, { threeYearPoints: 160, upside: 131 });
    expect(declining.splitsMethod).toBe('derived');
    expect(declining.FHPPG).toBeGreaterThan(declining.SHPPG);

    expect(buildForecastedStats(projections, null, {}).splitsMethod).toBe('unavailable');
    expect(buildForecastedStats(projections, null, {}).compositeScore).toBeNull();
    expect(buildForecastedStats(null, null, { threeYearPoints: 100, upside: 160 }).splitsMethod).toBe('unavailable');

    const actual = buildForecastedStats(projections, { FHPPG: 0.6, SHPPG: 0.9 }, { threeYearPoints: 100, upside: 160 });
    expect(actual.splitsMethod).toBe('actual');
    expect(actual.FHPPG).toBe(0.6);

    const applied = applyForecastedStats({ name: 'Trend Player' }, projections, { threeYearPoints: 100, upside: 160 });
    expect(applied.forecast.splitsMethod).toBe('derived');
    expect(applied.strengths).toEqual(
      expect.arrayContaining(['Forecasted FH/SH splits estimated from Rank/Upside/3YP trend (actual AHL splits unavailable)']),
    );
  });

  test('rejects malformed games/shots fields but leaves invalid Goals/Assists/Points cells NULL', () => {
    expect(buildForecastedStats({ ProjPts: 'maybe' }, {}).projectedPoints).toBeNull();
    expect(buildForecastedStats({ ProjPts: '#N/A', ProjG: '#N/A', ProjA: -1 }, {}))
      .toMatchObject({ projectedPoints: null, projectedGoals: null, projectedAssists: null });
    expect(() => buildForecastedStats({ ProjGP: -1 }, {})).toThrow('Dobber projection ProjGP');
    expect(() => buildForecastedStats({ ProjSOG: 'many' }, {})).toThrow('Dobber projection ProjSOG');
    expect(normalizeDobberRows([{ Player: 'Player One', ProjPts: 'maybe' }])['player one']).toBeTruthy();
  });

  test('reads Dobber Goals/Assists/Points columns into forecastedGoals/Assists/Points', () => {
    const rows = normalizeDobberRows([
      { Player: 'Bad Points', Games: '20', Goals: '#N/A', Assists: '4', Points: '-1', SOG: '30' },
    ]);
    expect(applyForecastedStats({ name: 'Bad Points' }, rows['bad points'].forecastProjections))
      .toMatchObject({ forecastedGoals: null, forecastedAssists: 4, forecastedPoints: null });
  });

  test('reads Dobber Goals/Assists columns as forecasted goals and assists, leaving bad cells NULL', () => {
    const rows = normalizeDobberRows([
      { Player: 'Scorer', Games: '80', Goals: '36', Assists: '95', Points: '131', SOG: '300' },
      { Player: 'Bad Assists', Games: '20', Goals: '3', Assists: '-1', Points: '2', SOG: '30' },
    ]);
    expect(buildForecastedStats(rows.scorer.forecastProjections, null))
      .toMatchObject({ projectedGoals: 36, projectedAssists: 95, projectedPoints: 131 });
    expect(buildForecastedStats(rows['bad assists'].forecastProjections, null))
      .toMatchObject({ projectedGoals: 3, projectedAssists: null, projectedPoints: 2 });
    expect(applyForecastedStats({ name: 'Scorer' }, rows.scorer.forecastProjections))
      .toMatchObject({ forecastedGoals: 36, forecastedAssists: 95, forecastedPoints: 131 });
  });

  test('reads explicit forecast columns even when the Projections cell is narrative text', () => {
    const row = normalizeDobberRows([{
      Player: 'Player One',
      Projections: 'top line expected',
      'Projected Points': '55',
      'Projected Games': '75',
      'Proj Shots': '180',
    }])['player one'];
    expect(row.projections).toBe('top line expected');
    expect(buildForecastedStats(row.forecastProjections, { FHPPG: 0.5, SHPPG: 0.7 }))
      .toMatchObject({ projectedPoints: 55, projectedGames: 75, projectedShots: 180, compositeScore: 76.75 });
    const overriding = normalizeDobberRows([{
      Player: 'Player Two',
      Projections: '{"Projected Points":40,"ProjGP":75,"ProjSOG":180}',
      ProjPts: 55,
    }])['player two'];
    expect(buildForecastedStats(overriding.forecastProjections, { FHPPG: 0.5, SHPPG: 0.7 }).projectedPoints)
      .toBe(55);
  });

  test('attaches forecasts to players before DraftIQ, without pricing on forecast alone', () => {
    const dobber = normalizeDobberRows([{
      Player: 'Player One',
      Projections: '{"ProjPts":60,"ProjGP":80,"ProjSOG":200}',
    }]);
    const outputs = {
      players: {
        players: [{
          id: 'one', name: 'Player One', category: 'Veteran', finalPosition: 'C',
          historicalSplits: { FHPPG: 0.6, SHPPG: 0.9 }, available: true,
          production: {}, deployment: {}, prospect: {}, keeper: {}, missingSources: {},
        }],
        sourceCoverage: {},
      },
      auction: {}, tiers: {}, keepers: {}, prospects: {},
    };
    let beforePricingPlayer;
    const result = applyDobberIntelligence(outputs, {
      datasets: { dobber: { players: dobber }, roster: { players: {} } },
      metadata: { dobberExcel: { status: 'loaded-local' } },
    }, (players) => {
      beforePricingPlayer = players[0];
      return players;
    });
    expect(beforePricingPlayer).toMatchObject({ compositeForecastScore: 86, draftIQ: null });
    expect(result.players.players[0]).toMatchObject({
      forecastedPoints: 60, compositeForecastScore: 86, draftIQ: null, auctionValue: null,
    });
  });

  test('derives composite score for real Dobber players lacking AHL FH/SH splits, using Rank/Upside/3YP trend', () => {
    const dobber = normalizeDobberRows([{
      Player: 'Rising Prospect', Rank: 1, Upside: 160, '3YP': 100, Games: 77, Points: 131, SOG: 277, 'PP Unit': 1,
    }]);
    const outputs = {
      players: {
        players: [{
          id: 'one', name: 'Rising Prospect', category: 'Veteran', finalPosition: 'C',
          historicalSplits: { FHPPG: null, SHPPG: null }, available: true,
          production: {}, deployment: {}, prospect: {}, keeper: {}, missingSources: {},
        }],
        sourceCoverage: {},
      },
      auction: {}, tiers: {}, keepers: {}, prospects: {},
    };
    const result = applyDobberIntelligence(outputs, {
      datasets: { dobber: { players: dobber }, roster: { players: {} } },
      metadata: { dobberExcel: { status: 'loaded-local' } },
    });
    const player = result.players.players[0];
    expect(player.forecast.splitsMethod).toBe('derived');
    expect(player.forecast.compositeScore).not.toBeNull();
    expect(player.compositeForecastScore).not.toBeNull();
  });
});
