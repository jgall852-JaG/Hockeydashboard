import { buildValueLayer } from '../app.js';

function buildProspectFixture(name, overrides = {}) {
  return {
    player: {
      name,
      sourceType: 'prospect',
      cost: 4,
      termRemaining: 3,
      matchingRights: true,
      draftYear: new Date().getFullYear() - 2,
      poolPosition: 'C',
      ...overrides.player,
    },
    roster: {
      points: '28',
      gp: '50',
      ...overrides.roster,
    },
    live: {
      identity: {
        fullName: name,
        rosterStatus: 'Active',
        nhlPosition: 'Center',
        shootsCatches: 'L',
        sweaterNumber: 9,
      },
      currentSeason: {
        points: 28,
        gamesPlayed: 50,
      },
      historical: {
        points: 84,
      },
      schedule: {
        gamesRemaining: 32,
      },
      ...overrides.live,
    },
  };
}

describe('phase 3 validation players', () => {
  const validationPlayers = [
    buildProspectFixture('Macklin Celebrini'),
    buildProspectFixture('Michael Misa', { player: { draftYear: new Date().getFullYear() - 1, poolPosition: 'LW' } }),
    buildProspectFixture('Lane Hutson', { player: { poolPosition: 'D' } }),
    buildProspectFixture('Dylan Guenther', { player: { poolPosition: 'RW', cost: 8 }, live: { currentSeason: { points: 34, gamesPlayed: 62 } } }),
    buildProspectFixture('Beckett Sennecke', { live: { currentSeason: { points: 14, gamesPlayed: 38 }, historical: { points: 28 } } }),
  ];

  test.each(validationPlayers)('produces explainable intrinsic value output for %p', ({ player, roster, live }) => {
    const layer = buildValueLayer(player, roster, live);

    expect(layer.prospectValue.status).toBe('Applicable');
    expect(layer.prospectValue.valueBand).toMatch(/Elite Prospect|Strong Prospect|Developing Prospect|Speculative Prospect/);
    expect(layer.prospectValue.riskBand).toMatch(/Low|Medium|High/);
    expect(layer.prospectValue.explanation.length).toBeGreaterThan(20);
    expect(layer.prospectValue.primary.length).toBeGreaterThanOrEqual(3);
    expect(layer.prospectValue.secondary.length).toBeGreaterThanOrEqual(2);

    expect(layer.contractValue.valueBand).toMatch(/Excellent Contract|Good Contract|Fair Contract|Poor Contract/);
    expect(layer.rightsValue.valueBand).toMatch(/Strong Rights Asset|Moderate Rights Asset|Limited Rights Asset/);
  });
});
