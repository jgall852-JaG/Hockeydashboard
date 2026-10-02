import {
  DRAFT_IQ_V3_WEIGHTS,
  buildAgeCurve,
  buildConsistencyScore,
  buildContractValues,
  buildUpsideScore,
  calculateDraftIqV3,
  computeDraftIQv3,
  getDraftIqV3Inputs,
} from '../draftIqV3.js';

const pool = {
  'center one': { playerKey: 'center one', name: 'Center One', positions: ['C'] },
  'center two': { playerKey: 'center two', name: 'Center Two', positions: ['C'] },
  'dman one': { playerKey: 'dman one', name: 'Dman One', positions: ['D'] },
  'dman two': { playerKey: 'dman two', name: 'Dman Two', positions: ['D'] },
};

describe('DraftIQ v3', () => {
  test('applies the additive v3 formula with the documented weights', () => {
    const inputs = {
      forecastedPoints: 60,
      upsideScore: 20,
      positionalScarcity: 40,
      pedigreeScore: 70,
      riskScore: 30,
      teamNeedsBoost: 50,
      consistencyScore: 25,
      projectionConfidence: 80,
      shots: 200,
      games: 80,
      contractValue: 90,
      ageCurve: 30,
    };
    const expected = 1 * 60 + 0.3 * 20 + 0.25 * 40 + 0.2 * (70 - 30) + 0.15 * 50
      + 0.1 * 25 + 0.1 * 80 + 0.1 * (200 / 80) + 0.1 * 90 - 0.1 * 30;
    const { draftIQ, projected } = calculateDraftIqV3(inputs);
    expect(projected).toBe(true);
    expect(draftIQ).toBeCloseTo(expected, 1);
    expect(DRAFT_IQ_V3_WEIGHTS).toMatchObject({ forecastedPoints: 1, upsideScore: 0.3, ageCurve: 0.1, noProjection: 0.2 });
  });

  test('falls back to 0.2*(upside + pedigree - risk + scarcity) without a points projection', () => {
    expect(calculateDraftIqV3({
      forecastedPoints: null, upsideScore: 30, pedigreeScore: 70, riskScore: 20, positionalScarcity: 40,
      // Projection-only inputs are ignored in the fallback.
      teamNeedsBoost: 100, contractValue: 100, ageCurve: 100,
    })).toEqual({ draftIQ: 24, projected: false });
    expect(calculateDraftIqV3({})).toEqual({ draftIQ: 0, projected: false });
    // NULL inputs count as zero rather than poisoning the score.
    expect(calculateDraftIqV3({ forecastedPoints: 10, ageCurve: null, games: 0, shots: 50 }).draftIQ).toBe(10);
  });

  test('upside uses Dobber Upside headroom, else the 3YP delta', () => {
    expect(buildUpsideScore({ forecastedPoints: 131, upside: 160, threeYearPoints: 135 })).toBe(29);
    expect(buildUpsideScore({ forecastedPoints: 70, threeYearPoints: 55 })).toBe(15);
    expect(buildUpsideScore({ forecastedPoints: 50, threeYearPoints: 60 })).toBe(0);
    expect(buildUpsideScore({ forecastedPoints: null, upside: 45 })).toBe(45);
    expect(buildUpsideScore({ forecastedPoints: 40 })).toBeNull();
  });

  test('age curve is zero through 27 and penalises 10 per year after, capped at 100', () => {
    expect(buildAgeCurve(22)).toBe(0);
    expect(buildAgeCurve(27)).toBe(0);
    expect(buildAgeCurve(29.4)).toBe(24);
    expect(buildAgeCurve(45)).toBe(100);
    expect(buildAgeCurve(null)).toBeNull();
  });

  test('consistency uses only actual AHL splits trend', () => {
    expect(buildConsistencyScore({ FHPPG: 0.5, SHPPG: 0.6, splitsMethod: 'actual' })).toBe(20);
    expect(buildConsistencyScore({ FHPPG: 0.8, SHPPG: 0.4, splitsMethod: 'actual' })).toBe(-50);
    expect(buildConsistencyScore({ FHPPG: 0.5, SHPPG: 0.6, splitsMethod: 'derived' })).toBeNull();
    expect(buildConsistencyScore({ FHPPG: 0, SHPPG: 0.6, splitsMethod: 'actual' })).toBeNull();
  });

  test('contract value is the pool percentile of projected points per auction dollar', () => {
    const values = buildContractValues([
      { key: 'cheap', forecastedPoints: 60, auctionValue: 10 },
      { key: 'fair', forecastedPoints: 60, auctionValue: 30 },
      { key: 'pricey', forecastedPoints: 60, auctionValue: 60 },
      { key: 'unpriced', forecastedPoints: 60, auctionValue: null },
      { key: 'no projection', forecastedPoints: null, auctionValue: 5 },
    ]);
    expect(Object.fromEntries(values)).toEqual({ cheap: 100, fair: 50, pricey: 0 });
    expect(Object.fromEntries(buildContractValues([{ key: 'solo', forecastedPoints: 10, auctionValue: 2 }]))).toEqual({ solo: 50 });
  });

  test('reads v3 inputs from draft-intelligence players, leaving missing values NULL', () => {
    const inputs = getDraftIqV3Inputs({
      forecastedPoints: 131, forecastedGoals: 36, forecastedAssists: 95,
      dobberUpside: 160, threeYearPoints: 135, age: 29.4, auctionValue: 50,
      forecast: { projectedShots: 277, projectedGames: 77, FHPPG: 1.6, SHPPG: 1.8, splitsMethod: 'actual' },
    });
    expect(inputs).toMatchObject({
      forecastedPoints: 131, forecastedGoals: 36, forecastedAssists: 95,
      upsideScore: 29, age: 29.4, ageCurve: 24, consistencyScore: 12.5, auctionValue: 50,
    });
    expect(getDraftIqV3Inputs({})).toMatchObject({ upsideScore: null, ageCurve: null, consistencyScore: null, auctionValue: null });
  });

  test('computes a JSON-safe DraftIQ v3 per canonical pool player', () => {
    const result = computeDraftIQv3({
      ahlPool: pool,
      availableKeys: new Set(['center one', 'center two', 'dman one']),
      players: [
        { name: 'Center One', forecastedPoints: 40, age: 24, auctionValue: 10 },
        { name: 'Center Two', forecastedPoints: 40, age: 33, auctionValue: 40 },
        { name: 'Dman One', forecastedPoints: 40, dobberUpside: 60 },
      ],
      ownersByPlayerKey: new Map(),
    });
    expect(Object.keys(result).sort()).toEqual(['center one', 'center two', 'dman one', 'dman two']);
    expect(result['center one'].inputs).toMatchObject({ contractValue: 100, ageCurve: 0, positionalScarcity: 0 });
    expect(result['center two'].inputs).toMatchObject({ contractValue: 0, ageCurve: 60 });
    // Cheaper, younger Center One outranks the otherwise-identical Center Two.
    expect(result['center one'].draftIQ).toBe(50);
    expect(result['center two'].draftIQ).toBe(34);
    // D is scarcer (1 available vs 2 C) and Dman One has 20 points of upside headroom.
    expect(result['dman one'].draftIQ).toBe(40 + 0.3 * 20 + 0.25 * 50);
    expect(result['dman two']).toMatchObject({ draftIQ: 10, projected: false });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
