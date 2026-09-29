import { renderDraftAuctionDashboard } from '../draftAuctionUI.js';

describe('draft auction dashboard rendering', () => {
  test('renders four views, explicit missing-data status, and winning-bid controls', () => {
    const player = {
      id: 'player-one',
      name: 'Player One',
      position: 'C',
      finalPosition: 'C/LW',
      ahlPosition: 'C',
      utilityPosition: 'C/LW',
      category: 'Rookie',
      tier: null,
      auctionValue: null,
      recommendedMaxBid: null,
      classification: 'UNPRICED',
      valuationStatus: 'unpriced',
      deployment: { DS: null, RSS: null, OS: null, RRS: null },
      production: { PPS: null },
      prospect: { BPS: null },
      keeper: { KVS: null },
      sourcesUsed: { AHLSheets: true, DobberExcel: false },
      missingSources: { 'AHLSheets metric inputs': true },
      strengths: [],
      risks: [],
    };
    const html = renderDraftAuctionDashboard({
      activeTab: 'draft-board',
      players: [player],
      availableKeys: new Set(['player one']),
      shortlist: new Set(),
      search: '',
      positionFilter: '',
      categoryFilter: '',
      availabilityFilter: 'all',
      bestAvailableSort: 'AuctionValue',
      teamBudgets: [{ team: 'TEAM A', remainingBudget: 250, openSlots: 25 }],
      teamNames: ['TEAM A'],
      selectedPlayer: player,
      selectedTeam: 'TEAM A',
      sourceAvailability: { AHLSheets: true, DobberExcel: false },
      toolsHtml: '',
      workspaceHtml: '',
    });
    const personalHtml = renderDraftAuctionDashboard({
      activeTab: 'personal-draft-list',
      players: [player],
      availableKeys: new Set(['player one']),
      shortlist: new Set(),
      search: '',
      positionFilter: '',
      categoryFilter: '',
      availabilityFilter: 'all',
      bestAvailableSort: 'AuctionValue',
      teamBudgets: [{ team: 'TEAM A', remainingBudget: 250, openSlots: 25 }],
      teamNames: ['TEAM A'],
      selectedPlayer: null,
      selectedTeam: '',
      sourceAvailability: { AHLSheets: true, DobberExcel: false },
      toolsHtml: '',
      workspaceHtml: '',
    });

    expect(html).toContain('Draft Board');
    expect(html).toContain('Best Available');
    expect(html).toContain('Team Budgets');
    expect(html).toContain('Tools & Validation');
    expect(html).toContain('UNPRICED');
    expect(html).toMatch(/<td>Available<\/td>/);
    expect(html).toContain('Record winning bid');
    expect(html).toContain('Recommended max bid:</strong> NULL');
    expect(html).toContain('AHLSheets: loaded');
    expect(html).toContain('Personal Draft List');
    expect(html).toContain('Add to Personal List');
    expect(html).toContain('NHL Position NULL');
    expect(html).toContain('Final Position C/LW');
    expect(html).toContain('Final Position</th>');
    expect(personalHtml).toContain('Keeper Target');
    expect(personalHtml).toContain('Breakout Target');
    expect(personalHtml).toContain('Max Bid Note');
    expect(personalHtml).toContain('data-personal-import-file');
  });
});
