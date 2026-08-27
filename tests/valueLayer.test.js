import { buildValueLayer } from '../app.js';

describe('value layer foundation', () => {
  test('builds independent value categories for a prospect asset', () => {
    const layer = buildValueLayer(
      {
        sourceType: 'prospect',
        cost: 2,
        termRemaining: 3,
        matchingRights: true,
        draftYear: new Date().getFullYear() - 2,
        poolPosition: 'C',
      },
      {
        points: '22',
        gp: '45',
      },
      {
        identity: {
          rosterStatus: 'Active',
          nhlPosition: 'Center',
          sweaterNumber: 97,
          shootsCatches: 'L',
        },
        currentSeason: { points: 22, gamesPlayed: 45 },
        schedule: { gamesRemaining: 30 },
      }
    );

    expect(layer.prospectValue.status).toBe('Applicable');
    expect(layer.veteranValue.status).toBe('Not Applicable');
    expect(layer.draftPickValue.status).toBe('Context Required');
    expect(layer.contractValue.status).toBe('Applicable');
    expect(layer.rightsValue.status).toBe('Applicable');
    expect(layer.prospectValue.valueBand).toBe('Strong Prospect');
    expect(layer.prospectValue.riskBand).toMatch(/Low|Medium|High/);
    expect(layer.prospectValue.explanation).toContain('Prospect value emphasizes upside');
  });

  test('marks rights value as limited when no matching rights are present', () => {
    const layer = buildValueLayer(
      {
        sourceType: 'veteran',
        currentCost: 14,
        poolPosition: 'RW',
      },
      null,
      {
        identity: {
          rosterStatus: 'Inactive',
        },
        currentSeason: {},
        historical: {},
      }
    );

    expect(layer.veteranValue.status).toBe('Applicable');
    expect(layer.prospectValue.status).toBe('Not Applicable');
    expect(layer.rightsValue.status).toBe('Limited');
    expect(layer.contractValue.valueBand).toBe('Poor Contract');
    expect(layer.veteranValue.valueBand).toBe('Roster Asset');
  });
});
