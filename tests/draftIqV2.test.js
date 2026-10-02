import {
  DRAFT_IQ_V2_WEIGHTS,
  buildPositionalScarcity,
  buildTeamNeeds,
  calculateDraftIqV2,
  computeDraftIQ,
  getDraftIqV2Inputs,
} from '../draftIqV2.js';

const pool = {
  'center one': { playerKey: 'center one', name: 'Center One', positions: ['C'] },
  'center two': { playerKey: 'center two', name: 'Center Two', positions: ['C'] },
  'center three': { playerKey: 'center three', name: 'Center Three', positions: ['C'] },
  'center four': { playerKey: 'center four', name: 'Center Four', positions: ['C'] },
  'dman one': { playerKey: 'dman one', name: 'Dman One', positions: ['D'] },
  'dman two': { playerKey: 'dman two', name: 'Dman Two', positions: ['D'] },
};

describe('DraftIQ v2', () => {
  test('applies the additive formula with the documented weights', () => {
    const { draftIQ, projected } = calculateDraftIqV2({
      forecastedPoints: 60,
      positionalScarcity: 40,
      pedigreeScore: 70,
      riskScore: 30,
      teamNeedsBoost: 50,
      shots: 200,
      games: 80,
    });
    const expected = 1 * 60 + 0.25 * 40 + 0.15 * (70 - 30) + 0.2 * 50 + 5 * (200 / 80);
    expect(projected).toBe(true);
    expect(draftIQ).toBeCloseTo(expected, 1);
    expect(DRAFT_IQ_V2_WEIGHTS).toMatchObject({ forecastedPoints: 1, positionalScarcity: 0.25 });
  });

  test('falls back to a low-weight scarcity + pedigree - risk score without a points projection', () => {
    expect(calculateDraftIqV2({ forecastedPoints: null, positionalScarcity: 40, pedigreeScore: 70, riskScore: 30 }))
      .toEqual({ draftIQ: 8, projected: false });
    expect(calculateDraftIqV2({}).draftIQ).toBe(0);
    // Missing shots/games never inflate the score.
    expect(calculateDraftIqV2({ forecastedPoints: 10, games: 0, shots: 50 }).draftIQ).toBe(10);
  });

  test('scarcity comes from available canonical pool depth per position', () => {
    const available = new Set(['center one', 'center two', 'center three', 'center four', 'dman one']);
    expect(buildPositionalScarcity(pool, available)).toEqual({
      depth: { C: 4, D: 1 },
      scarcity: { C: 0, D: 75 },
    });
  });

  test('team needs reflect positional shortfall for the selected team and vanish with no open slots', () => {
    const owners = new Map([['dman one', new Set(['Team A'])], ['dman two', new Set(['Team A'])]]);
    const needs = buildTeamNeeds(pool, owners, 'team a', { rosterSlots: 6 });
    expect(needs.C).toBe(100);
    expect(needs.D).toBe(0);
    expect(buildTeamNeeds(pool, owners, 'Team A', { rosterSlots: 6, openSlots: 0 })).toEqual({});
    expect(buildTeamNeeds(pool, owners, '', { rosterSlots: 6 })).toEqual({});
  });

  test('reads inputs from draft-intelligence players, leaving missing values NULL', () => {
    expect(getDraftIqV2Inputs({
      forecastedGoals: 20, forecastedAssists: 30, forecastedPoints: 50,
      forecast: { projectedShots: 160, projectedGames: 80, FHPPG: 0.5, SHPPG: 0.7 },
      deployment: { RRS: 25 }, prospect: { BPS: 60 }, intelEdge: { projectionConfidence: 'High' },
      adp: 12, category: 'Rookie',
    })).toEqual({
      forecastedGoals: 20, forecastedAssists: 30, forecastedPoints: 50,
      shots: 160, games: 80, FHPPG: 0.5, SHPPG: 0.7,
      riskScore: 25, pedigreeScore: 60, projectionConfidence: 80, adp: 12, classification: 'Rookie',
    });
    expect(getDraftIqV2Inputs({}).forecastedPoints).toBeNull();
  });

  test('computes a JSON-safe DraftIQ per canonical pool player, including pool-only players', () => {
    const available = new Set(['center one', 'dman one']);
    const result = computeDraftIQ({
      ahlPool: pool,
      availableKeys: available,
      players: [{ name: 'Center One', forecastedPoints: 40 }, { name: 'Dman One', forecastedPoints: 40 }],
      ownersByPlayerKey: new Map(),
    });
    expect(Object.keys(result)).toHaveLength(6);
    // C and D each have one available player, so both have zero scarcity here.
    expect(result['center one'].draftIQ).toBe(40);
    expect(result['dman two']).toMatchObject({ draftIQ: 0, projected: false });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);

    const scarceD = computeDraftIQ({
      ahlPool: pool,
      availableKeys: new Set(['center one', 'center two', 'dman one']),
      players: [{ name: 'Center One', forecastedPoints: 40 }, { name: 'Dman One', forecastedPoints: 40 }],
    });
    expect(scarceD['dman one'].draftIQ).toBeGreaterThan(scarceD['center one'].draftIQ);
  });
});
