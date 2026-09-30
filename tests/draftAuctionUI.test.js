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
      bestAvailableSort: 'ADP',
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
      bestAvailableSort: 'ADP',
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
    expect(html).toContain('Personal Draft List');
    expect(html).toContain('Add to Personal List');
    expect(html).toContain('NHL POS');
    expect(html).toContain('Final Position C/LW');
    expect(html).toContain('Final Position</th>');
    expect(html).toContain('NHL Profile');
    expect(html).toContain('Forecasted Stats (Dobber Projections)');
    expect(html).toContain('Historical Splits (AHL Scores)');
    expect(html).toContain('Risk &amp; Pedigree');
    expect(personalHtml).toContain('Keeper Target');
    expect(personalHtml).toContain('Breakout Target');
    expect(personalHtml).toContain('Max Bid Note');
    expect(personalHtml).toContain('data-personal-import-file');
  });

  test('filters non-AHL players, provides local remove/undo, and exposes local assignment controls', () => {
    const player = {
      id: 'official-player',
      name: 'Official Player',
      status: 'in-ahl',
      ownership: null,
      available: true,
      tier: null,
      auctionValue: null,
      recommendedMaxBid: null,
      classification: 'UNPRICED',
      valuationStatus: 'unpriced',
      deployment: {},
      production: {},
      prospect: {},
      keeper: {},
      strengths: [],
      risks: [],
    };
    const removedPlayer = { ...player, id: 'removed-player', name: 'Removed Player', localStatus: 'removed-local' };
    const formerProspect = { ...player, id: 'former-prospect', name: 'Brandt Clarke', status: 'not-in-ahl' };
    const props = {
      players: [player, removedPlayer, formerProspect],
      availableKeys: new Set(['official player', 'removed player']),
      shortlist: new Set(),
      search: '',
      positionFilter: '',
      categoryFilter: '',
      availabilityFilter: 'all',
      bestAvailableSort: 'ADP',
      teamBudgets: [{ team: 'TEAM A', remainingBudget: 250, openSlots: 25 }],
      teamNames: ['TEAM A'],
      selectedPlayer: player,
      selectedTeam: '',
      sourceAvailability: { AHLSheets: true },
      toolsHtml: '',
      workspaceHtml: '',
    };
    const html = renderDraftAuctionDashboard({
      ...props,
      activeTab: 'draft-board',
      showAllAhlPlayers: true,
      showRemovedPlayers: true,
    });
    const bestHtml = renderDraftAuctionDashboard({
      ...props,
      activeTab: 'best-available',
      showAllAhlPlayers: true,
      showRemovedPlayers: false,
    });

    expect(html).not.toContain('Brandt Clarke');
    expect(html).toContain('data-remove-player="official-player"');
    expect(html).toContain('data-undo-player="removed-player"');
    expect(html).toContain('class="removed-local"');
    expect(html).toContain('data-local-assignment-form="official-player"');
    expect(html).toContain('data-manual-unassign="official-player"');
    expect(bestHtml).not.toContain('data-player-status="not-in-ahl"');
    expect(bestHtml).not.toContain('data-player-details="removed-player"');
  });

  test('shows the unavailable empty state and optional commissioner player toggles', () => {
    const player = {
      id: 'unavailable-player',
      name: 'Unavailable Player',
      status: 'in-ahl',
      ownership: null,
      available: false,
      auctionValue: null,
      recommendedMaxBid: null,
      classification: 'UNPRICED',
    };
    const removedPlayer = {
      ...player,
      id: 'removed-player',
      name: 'Removed Player',
      localStatus: 'removed-local',
    };
    const props = {
      activeTab: 'best-available',
      players: [player, removedPlayer, { ...player, id: 'former', name: 'Brandt Clarke', status: 'not-in-ahl' }],
      availableKeys: new Set(),
      shortlist: new Set(),
      search: '',
      positionFilter: '',
      categoryFilter: '',
      availabilityFilter: 'all',
      bestAvailableSort: 'ADP',
      teamBudgets: [],
      teamNames: [],
      selectedPlayer: null,
      selectedTeam: '',
      sourceAvailability: {},
      toolsHtml: '',
      workspaceHtml: '',
    };
    const emptyHtml = renderDraftAuctionDashboard(props);
    expect(emptyHtml).toContain('All AHL-eligible players are currently unavailable.');
    expect(emptyHtml).toContain('data-show-all-ahl-players');
    expect(emptyHtml).toContain('data-show-removed-players ');
    expect(emptyHtml).not.toContain('Brandt Clarke');
    expect(emptyHtml).toContain('data-highlight-ahl-unavailable');
    const toolsHtml = renderDraftAuctionDashboard({ ...props, activeTab: 'tools-validation' });
    expect(toolsHtml).toContain('id="reset-local-edits"');

    const allPlayersHtml = renderDraftAuctionDashboard({
      ...props,
      showAllAhlPlayers: true,
      showRemovedPlayers: false,
    });
    const bestPanel = allPlayersHtml.slice(allPlayersHtml.indexOf('id="best-available-panel"'));
    expect(bestPanel).toContain('Unavailable Player');
    expect(bestPanel).not.toContain('data-player-details="removed-player"');
    expect(bestPanel).not.toContain('All AHL-eligible players are currently unavailable.');
    expect(bestPanel).toContain('data-show-all-ahl-players checked');
    expect(bestPanel).toContain('data-show-removed-players');
    const commissionerHtml = renderDraftAuctionDashboard({
      ...props,
      showAllAhlPlayers: true,
      showRemovedPlayers: true,
    });
    expect(commissionerHtml).toContain('data-player-details="removed-player"');
  });

  test('Draft Board toggles control availability, removals, highlighting, and empty state', () => {
    const availablePlayer = {
      id: 'available',
      name: 'Available Player',
      status: 'in-ahl',
      ownership: null,
      auctionValue: null,
      recommendedMaxBid: null,
      classification: 'UNPRICED',
    };
    const unavailablePlayer = {
      ...availablePlayer,
      id: 'unavailable',
      name: 'Unavailable Player',
      ownership: null,
    };
    const removedPlayer = {
      ...availablePlayer,
      id: 'removed',
      name: 'Removed Player',
      localStatus: 'removed-local',
    };
    const props = {
      activeTab: 'draft-board',
      players: [availablePlayer, unavailablePlayer, removedPlayer],
      availableKeys: new Set(['available player']),
      shortlist: new Set(),
      search: '',
      positionFilter: '',
      categoryFilter: '',
      availabilityFilter: 'all',
      bestAvailableSort: 'ADP',
      teamBudgets: [],
      teamNames: [],
      selectedPlayer: null,
      selectedTeam: '',
      sourceAvailability: {},
      toolsHtml: '',
      workspaceHtml: '',
    };
    const defaultBoard = renderDraftAuctionDashboard(props);
    expect(defaultBoard).toContain('data-player-details="available"');
    expect(defaultBoard).not.toContain('data-player-details="unavailable"');
    expect(defaultBoard).not.toContain('data-player-details="removed"');

    const unavailableFilterBoard = renderDraftAuctionDashboard({
      ...props,
      availabilityFilter: 'unavailable',
    });
    expect(unavailableFilterBoard).toContain('data-player-details="unavailable"');

    const allPlayersBoard = renderDraftAuctionDashboard({
      ...props,
      showAllAhlPlayers: true,
      highlightUnavailablePlayers: true,
    });
    expect(allPlayersBoard).toContain('data-player-details="unavailable"');
    expect(allPlayersBoard).toContain('class="ahl-unavailable"');
    expect(allPlayersBoard).not.toContain('data-player-details="removed"');

    const removedBoard = renderDraftAuctionDashboard({
      ...props,
      showRemovedPlayers: true,
    });
    expect(removedBoard).toContain('data-player-details="removed"');
    expect(removedBoard).toContain('class="removed-local"');

    const emptyBoard = renderDraftAuctionDashboard({
      ...props,
      availableKeys: new Set(),
    });
    expect(emptyBoard).toContain('No draftable players available under current filters.');
  });

  test('Best Available uses the forecast-ready columns, requested sort options, and acronym legend', () => {
    const player = {
      id: 'available',
      name: 'Available Player',
      status: 'in-ahl',
      available: true,
      finalPosition: 'C/L',
      experienceTier: 'Veteran',
      forecastedPoints: null,
      compositeForecastScore: null,
      adp: null,
    };
    const html = renderDraftAuctionDashboard({
      activeTab: 'best-available',
      players: [player],
      availableKeys: new Set(['available player']),
      shortlist: new Set(),
      search: '',
      positionFilter: '',
      categoryFilter: '',
      availabilityFilter: 'all',
      bestAvailableSort: 'ADP',
      teamBudgets: [],
      teamNames: [],
      selectedPlayer: null,
      selectedTeam: '',
      sourceAvailability: {},
      toolsHtml: '',
      workspaceHtml: '',
    });
    const panel = html.slice(html.indexOf('id="best-available-panel"'));
    const header = panel.slice(panel.indexOf('<thead>'), panel.indexOf('</thead>'));
    expect(header).toContain('<th>Player</th>');
    expect(header).toContain('<th>Final Position</th>');
    expect(header).toContain('<th>Experience Tier</th>');
    expect(header).toContain('<th>Forecasted Points</th>');
    expect(header).toContain('<th>Composite Score</th>');
    expect(header).toContain('<th>ADP</th>');
    expect(header).not.toContain('Shortlist');
    expect(header).not.toContain('Insights');
    expect(header).not.toContain('Category');
    expect(header).not.toContain('Auction Value');
    expect(header).not.toContain('Max Bid');
    expect(panel).toContain('data-player-details="available"');
    expect(panel).toContain('Sort by');
    [
      'ADP',
      'Forecasted Points',
      'Composite Forecast Score',
      'First-Half PPG (FHPPG)',
      'Second-Half PPG (SHPPG)',
      'Risk Score',
      'Pedigree Score',
    ].forEach((sort) => expect(panel).toContain(`<option ${sort === 'ADP' ? 'selected' : ''}>${sort}</option>`));
    [
      'Power Play Time on Ice',
      'Points per Game',
      'First-Half Points per Game',
      'Second-Half Points per Game',
      'Projected Points',
      'Composite Forecast Score',
      'Keeper Value Score',
      'Breakout Probability Score',
      'Risk Stability Score',
    ].forEach((description) => expect(panel).toContain(description));
  });
});
