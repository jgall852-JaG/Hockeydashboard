import { buildCompactLeagueContext, renderCompactLeagueContext } from '../app.js';

describe('Draft Hub compact league context', () => {
  const players = [
    {
      name: 'Macklin Celebrini',
      owner: 'HOSERS',
      cost: 12,
      termRemaining: 3,
      matchingRights: true,
      sourceType: 'Prospect',
      retentionYear: null,
      farm: false,
    },
    {
      name: 'Michael Misa',
      owner: 'ROTTIES',
      cost: 10,
      termRemaining: 2,
      matchingRights: false,
      sourceType: 'Prospect',
      retentionYear: null,
      farm: false,
    },
    {
      name: 'Lane Hutson',
      owner: 'FIGHTING IRISH',
      currentCost: 8,
      termRemaining: 1,
      matchingRights: true,
      sourceType: 'Veteran',
      retentionYear: 2027,
      farm: false,
    },
    {
      name: 'Dylan Guenther',
      owner: 'HOSERS',
      cost: 6,
      termRemaining: 4,
      matchingRights: false,
      sourceType: 'Prospect',
      retentionYear: null,
      farm: true,
    },
    {
      name: 'Beckett Sennecke',
      owner: 'ROTTIES',
      cost: 5,
      termRemaining: 2,
      matchingRights: true,
      sourceType: 'Prospect',
      retentionYear: null,
      farm: false,
    },
  ];

  test('builds compact context fields for real draft targets', () => {
    const celebrini = buildCompactLeagueContext(players[0]);
    expect(celebrini).toEqual([
      { label: 'Owner', value: 'HOSERS' },
      { label: 'Cost', value: '$12' },
      { label: 'Term', value: '3Y' },
      { label: 'Rights', value: 'Yes' },
      { label: 'Ret', value: 'Prospect' },
    ]);

    const hutson = buildCompactLeagueContext(players[2]);
    expect(hutson[0].value).toBe('FIGHTING IRISH');
    expect(hutson[1].value).toBe('$8');
    expect(hutson[2].value).toBe('1Y');
    expect(hutson[3].value).toBe('Yes');
    expect(hutson[4].value).toBe('Ret 2027');

    const guenther = buildCompactLeagueContext(players[3]);
    expect(guenther[4].value).toBe('Farm');
  });

  test('renders compact context markup for comparison and board use', () => {
    const html = renderCompactLeagueContext(players[1], 'Selected');
    expect(html).toContain('Selected');
    expect(html).toContain('Owner: ROTTIES');
    expect(html).toContain('Cost: $10');
    expect(html).toContain('Term: 2Y');
    expect(html).toContain('Rights: No');
    expect(html).toContain('Ret: Prospect');
  });
});
