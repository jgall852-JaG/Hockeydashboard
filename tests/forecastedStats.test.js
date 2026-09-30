import { applyForecastedStats, buildForecastedStats } from '../forecastedStats.js';
import { normalizeDobberRows, applyDobberIntelligence } from '../dobberIngestion.js';

describe('forecasted stats', () => {
  test('combines explicit Dobber projections with AHL first- and second-half splits', () => {
    const projections = { ProjPts: '60', ProjGP: '80', 'Proj SOG': '200' };
    const splits = { FHPPG: 0.6, SHPPG: 0.9, sourceTab: 'Scores' };
    expect(buildForecastedStats(projections, splits)).toEqual({
      projectedPoints: 60,
      projectedGames: 80,
      projectedShots: 200,
      FHPPG: 0.6,
      SHPPG: 0.9,
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

  test('rejects malformed numeric projection fields rather than treating them as missing', () => {
    expect(() => buildForecastedStats({ ProjPts: 'maybe' }, {})).toThrow('Dobber projection ProjPts');
    expect(() => buildForecastedStats({ ProjGP: -1 }, {})).toThrow('Dobber projection ProjGP');
    expect(() => normalizeDobberRows([{ Player: 'Player One', ProjPts: 'maybe' }]))
      .toThrow('Dobber projection ProjPts');
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
});
