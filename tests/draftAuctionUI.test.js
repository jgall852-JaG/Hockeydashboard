import { getExperienceTierFromGames, renderDealRatingContent, renderDraftAuctionDashboard } from '../draftAuctionUI.js';
import { buildDraftBoardPlayers } from '../app.js';

function createAhlPool(players) {
  return Object.fromEntries(players.map((player) => {
    const positions = [...new Set(String(player.finalPosition || player.position || '')
      .split(/[\/,\s]+/)
      .filter(Boolean)
      .map((position) => position === 'L' ? 'LW' : position === 'R' ? 'RW' : position))];
    return [player.name.toLowerCase(), {
      playerKey: player.name.toLowerCase(),
      name: player.name,
      team: player.team || '',
      positions,
      rights: false,
      flags: { primaryPosition: positions[0] || null },
    }];
  }));
}

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
      prospectMetadata: {
        position: 'C',
        grade: 15,
        priorGrade: 44,
        tier: 'Elite Prospect',
        fantasyTrajectory: 'Rising',
        upside: 30,
        risk: 15,
        readiness: 'This fall.',
        comparable: { name: 'Seth Jarvis', statLine: '35 - 45 - 80+ , 40 PIM' },
        threeYearProjection: '25 - 25 - 50, 30 PIM',
        draftPedigree: 'Should be drafted in the first couple of rounds.',
        organizationalDepth: ['Top prospect'],
        writeUp: 'Some scouting bio paragraph about the player.',
      },
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
    expect(html).toContain('id="draft-board-tab" role="tab" aria-controls="draft-board-panel" aria-selected="true"');
    expect(html).toContain('id="draft-board-panel" class="dashboard-panel" role="tabpanel" aria-labelledby="draft-board-tab"');
    expect(html).toContain('<th scope="col">Player</th>');
    expect(html).toContain('role="dialog" aria-modal="true" aria-labelledby="draftModalTitle" tabindex="-1"');
    expect(html).toContain('UNPRICED');
    expect(html).toContain('<th scope="col">Availability</th>');
    expect(html).toMatch(/id="personal-draft-list-panel"[^>]* hidden>/);
    expect(html).toContain('Record winning bid');
    expect(html).toContain('<strong>Recommended max bid:</strong> UNPRICED');
    expect(html).toContain('Personal Draft List');
    const boardPanel = html.slice(html.indexOf('id="draft-board-panel"'), html.indexOf('id="best-available-panel"'));
    expect(boardPanel).not.toContain('Add to Personal List');
    expect(html).not.toContain('<dt>NHL POS</dt>');
    expect(html).toContain('Final Position C/LW');
    expect(html).toContain('Final Position</th>');
    expect(html).toContain('NHL Profile');
    expect(html).toContain('Forecasted Stats (Dobber Projections)');
    expect(html).toContain('Historical Splits (AHL Scores)');
    expect(html).toContain('Risk &amp; Pedigree');
    expect(html).toContain('Prospect Intelligence (Dobber Report)');
    expect(html).toContain('Elite Prospect');
    expect(html).toContain('Seth Jarvis (35 - 45 - 80+ , 40 PIM)');
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
      ahlPool: createAhlPool([player, removedPlayer]),
      draftedPlayers: [
        { ...player, draftOwner: 'TEAM A', draftPrice: 4.5, nhlCareerGamesPlayed: 82 },
        { ...removedPlayer, draftOwner: 'TEAM B', draftPrice: 2, nhlCareerGamesPlayed: null },
      ],
      availableKeys: new Set(['official player']),
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
    const bestPanel = bestHtml.slice(bestHtml.indexOf('id="best-available-panel"'));
    expect(bestPanel).not.toContain('data-player-status="not-in-ahl"');
    expect(bestPanel).not.toContain('data-player-details="removed-player"');
    expect(bestPanel).toContain('data-player-details="official-player"');
  });

  test('excludes unavailable and removed players from Best Available regardless of removed-player display setting', () => {
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
      ahlPool: createAhlPool([player, removedPlayer]),
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
    const defaultHtml = renderDraftAuctionDashboard(props);
    expect(defaultHtml).toContain('data-show-removed-players ');
    expect(defaultHtml).not.toContain('Brandt Clarke');
    expect(defaultHtml).toContain('data-highlight-ahl-unavailable');
    const toolsHtml = renderDraftAuctionDashboard({ ...props, activeTab: 'tools-validation' });
    expect(toolsHtml).toContain('id="reset-local-edits"');

    const bestPanel = defaultHtml.slice(defaultHtml.indexOf('id="best-available-panel"'));
    expect(bestPanel).not.toContain('Unavailable Player');
    expect(bestPanel).not.toContain('data-player-details="removed-player"');
    expect(bestPanel).toContain('data-show-removed-players');
    expect(renderDraftAuctionDashboard({ ...props, players: [] }))
      .toContain('No available, undrafted AHL-eligible players match the current filters.');
    const commissionerHtml = renderDraftAuctionDashboard({
      ...props,
      showRemovedPlayers: true,
    });
    const commissionerPanel = commissionerHtml.slice(commissionerHtml.indexOf('id="best-available-panel"'));
    expect(commissionerPanel).not.toContain('data-player-details="removed-player"');
  });

  test('Draft Board shows only drafted players, keeps local removal, and uses actual paid prices', () => {
    const availablePlayer = {
      id: 'available',
      name: 'Available Player',
      status: 'in-ahl',
      ownership: null,
      auctionValue: null,
      recommendedMaxBid: null,
      classification: 'UNPRICED',
    };
    const draftedPlayer = {
      ...availablePlayer,
      id: 'drafted',
      name: 'Drafted Player',
      draftOwner: 'TEAM A',
      draftPrice: 7.5,
      auctionValue: 48,
      finalPosition: 'C/LW',
      nhlCareerGamesPlayed: 9,
    };
    const removedPlayer = {
      ...draftedPlayer,
      id: 'removed',
      name: 'Removed Player',
      localStatus: 'removed-local',
    };
    const props = {
      activeTab: 'draft-board',
      players: [availablePlayer, draftedPlayer, removedPlayer],
      ahlPool: createAhlPool([availablePlayer, draftedPlayer, removedPlayer]),
      draftedPlayers: [draftedPlayer, removedPlayer],
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
    const boardPanel = defaultBoard.slice(defaultBoard.indexOf('id="draft-board-panel"'), defaultBoard.indexOf('id="best-available-panel"'));
    expect(boardPanel.match(/<th\b[^>]*>[^<]+<\/th>/g)).toEqual([
      '<th scope="col">Player</th>', '<th scope="col">Final Position</th>', '<th scope="col">Experience Tier</th>',
      '<th scope="col">Owner</th>', '<th scope="col">Auction Value</th>', '<th scope="col">Remove Locally</th>',
    ]);
    expect(boardPanel).not.toContain('data-player-details="available"');
    expect(boardPanel).toContain('data-player-details="drafted"');
    expect(boardPanel).toMatch(/<td>C\/LW<\/td>\s*<td>Farm<\/td>\s*<td>TEAM A<\/td>\s*<td>\$7\.50<\/td>/);
    expect(boardPanel).not.toContain('$48.00');
    expect(boardPanel).not.toContain('data-player-details="removed"');
    expect(boardPanel).not.toContain('data-personal-add');
    expect(boardPanel).not.toContain('data-shortlist-player');

    const removedBoard = renderDraftAuctionDashboard({
      ...props,
      showRemovedPlayers: true,
    });
    expect(removedBoard).toContain('data-player-details="removed"');
    expect(removedBoard).toContain('class="removed-local"');

    const emptyBoard = renderDraftAuctionDashboard({ ...props, draftedPlayers: [] });
    expect(emptyBoard).toContain('No drafted players match the current filters.');
    const bestPanel = renderDraftAuctionDashboard({ ...props, activeTab: 'best-available' });
    const bestAvailablePanel = bestPanel.slice(bestPanel.indexOf('id="best-available-panel"'), bestPanel.indexOf('id="team-budgets-panel"'));
    expect(bestAvailablePanel).toContain('data-player-details="available"');
    expect(bestAvailablePanel).not.toContain('data-player-details="drafted"');
    expect(bestAvailablePanel).toContain('data-personal-add="available"');
    const draftedModal = renderDraftAuctionDashboard({ ...props, selectedPlayer: draftedPlayer });
    expect(draftedModal).toMatch(/Record winning bid<\/button>/);
    expect(draftedModal).toMatch(/<button class="primary" type="submit" disabled>Record winning bid<\/button>/);
    const availableModal = renderDraftAuctionDashboard({
      ...props,
      activeTab: 'best-available',
      selectedPlayer: { ...availablePlayer, available: true },
      teamNames: ['TEAM A'],
    });
    expect(availableModal).toMatch(/<button class="primary" type="submit" >Record winning bid<\/button>/);
  });

  test('classifies career GP at boundaries and keeps missing GP Veteran', () => {
    expect([null, undefined, 0, 9, 10, 82, 83, '', -1].map(getExperienceTierFromGames))
      .toEqual(['Veteran', 'Veteran', 'Farm', 'Farm', 'Rookie', 'Rookie', 'Veteran', 'Unknown', 'Unknown']);
  });

  test('Draft Board keeps player GP and reads cached NHL GP when live profiles lack it', () => {
    const players = [
      { id: 'farm', name: 'Farm Player', status: 'in-ahl', nhlCareerGamesPlayed: 0 },
      { id: 'rookie', name: 'Rookie Player', status: 'in-ahl' },
      { id: 'veteran', name: 'Veteran Player', status: 'in-ahl' },
      { id: 'missing', name: 'Missing Player', status: 'in-ahl' },
    ];
    const state = {
      datasets: { roster: { sources: { 'retained-grid': { players: Object.fromEntries(
        players.map((player) => [player.id, { name: player.name, owner: 'TEAM A', cost: 1 }]),
      ) } } } },
    };
    const cachedProfiles = {
      'roster:rookie': { playerName: 'Rookie Player', historical: { gamesPlayed: 10 } },
      'roster:veteran': { playerName: 'Veteran Player', historical: { gamesPlayed: 83 } },
    };
    const liveProfiles = {
      'draft:rookie': { playerName: 'Rookie Player', historical: { gamesPlayed: null } },
      'draft:farm': { playerName: 'Farm Player', historical: { gamesPlayed: 82 } },
    };
    const draftedPlayers = buildDraftBoardPlayers(players, state, liveProfiles, cachedProfiles);
    expect(draftedPlayers.map((player) => player.nhlCareerGamesPlayed)).toEqual([0, 10, 83, null]);
    const rendered = renderDraftAuctionDashboard({
      activeTab: 'draft-board', players, draftedPlayers,
      availableKeys: new Set(), search: '', positionFilter: '',
      categoryFilter: '', bestAvailableSort: 'ADP',
      teamBudgets: [], teamNames: [], selectedPlayer: null, selectedTeam: '',
      sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    });
    expect(rendered).toMatch(/Farm Player[\s\S]*?<td>Farm<\/td>/);
    expect(rendered).toMatch(/Rookie Player[\s\S]*?<td>Rookie<\/td>/);
    expect(rendered).toMatch(/Veteran Player[\s\S]*?<td>Veteran<\/td>/);
    expect(rendered).toMatch(/Missing Player[\s\S]*?<td>Veteran<\/td>/);
    const explicitGpPlayers = buildDraftBoardPlayers(
      [{ ...players[0], nhlCareerGamesPlayed: '9' }, { ...players[1], nhlCareerGamesPlayed: 'bad' }],
      state, {}, {},
    );
    expect(explicitGpPlayers.map((player) => getExperienceTierFromGames(player.nhlCareerGamesPlayed)))
      .toEqual(['Farm', 'Unknown']);
  });

  test('Draft 2026 owners and prices take precedence over local winning bids and model estimates', () => {
    const players = [
      { id: 'one', name: 'Player One', status: 'in-ahl', auctionValue: 40 },
      { id: 'two', name: 'Player Two', status: 'in-ahl', auctionValue: 50 },
      { id: 'override', name: 'Override', status: 'not-in-ahl', auctionValue: null },
    ];
    const state = {
      datasets: { roster: { sources: { 'retained-grid': { players: {
        one: { name: 'P One', owner: 'SHEET TEAM', cost: 3.5 },
      } } } } },
      workingAssignments: {
        one: { name: 'Player One', team: 'LOCAL TEAM', bid: 8 },
        two: { name: 'Player Two', team: 'WINNING TEAM', bid: 6.5 },
        override: { name: 'Override', team: 'LOCAL TEAM', bid: 2 },
      },
    };
    const profiles = {
      one: { playerName: 'Player One', historical: { gamesPlayed: 9 } },
      two: { playerName: 'Player Two', historical: { gamesPlayed: 45 } },
    };
    expect(buildDraftBoardPlayers(players, state, profiles)).toMatchObject([
      { name: 'Player One', draftOwner: 'SHEET TEAM', draftPrice: 3.5, nhlCareerGamesPlayed: 9 },
      { name: 'Player Two', draftOwner: 'WINNING TEAM', draftPrice: 6.5, nhlCareerGamesPlayed: 45 },
    ]);
    expect(buildDraftBoardPlayers(players, { ...state, workingAssignments: {} }, profiles)).toHaveLength(1);
    const afterBid = buildDraftBoardPlayers(players, state, profiles);
    const rendered = renderDraftAuctionDashboard({
      activeTab: 'draft-board', players, draftedPlayers: afterBid,
      availableKeys: new Set(['player two']), search: '', positionFilter: '',
      categoryFilter: '', bestAvailableSort: 'ADP', personalDraftList: [],
      teamBudgets: [], teamNames: [], selectedPlayer: null, selectedTeam: '',
      sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    });
    expect(rendered).toMatch(/Player Two[\s\S]*?<td>Rookie<\/td>\s*<td>WINNING TEAM<\/td>\s*<td>\$6\.50<\/td>/);
  });

  test('Best Available shows forecast goals/assists/points columns, ADP and Forecasted Points sorts, search, and legend', () => {
    const player = {
      id: 'available',
      name: 'Available Player',
      status: 'in-ahl',
      available: true,
      finalPosition: 'C/L',
      experienceTier: 'Veteran',
      nhlPosition: 'RW',
      forecast: {
        projectedPoints: 60,
        projectedGoals: 25,
        projectedAssists: 35,
        projectedGames: 80,
        projectedShots: 200,
        FHPPG: 0.6,
        SHPPG: 0.9,
        compositeScore: 86,
      },
      poolGames: { firstHalfGames: 31, secondHalfGames: 27, totalPoolGames: 58 },
      historicalSplits: { FHPPG: 0.6, SHPPG: 0.9, sourceTab: 'Scores' },
      adp: null,
    };
    const props = {
      activeTab: 'best-available',
      players: [player],
      ahlPool: createAhlPool([player]),
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
    const html = renderDraftAuctionDashboard(props);
    const panel = html.slice(html.indexOf('id="best-available-panel"'), html.indexOf('id="team-budgets-panel"'));
    const header = panel.slice(panel.indexOf('<thead>'), panel.indexOf('</thead>'));
    expect(header.match(/<th\b[^>]*>[^<]+<\/th>/g)).toEqual([
      '<th scope="col">Player</th>', '<th scope="col">Final Position</th>',
      '<th scope="col">Total Pool Games</th>',
      '<th scope="col">Forecasted Goals</th>', '<th scope="col">Forecasted Assists</th>', '<th scope="col">Forecasted Points</th>', '<th scope="col">DraftIQ</th>', '<th scope="col">DraftIQ v3</th>',
    ]);
    expect(header).not.toContain('Shortlist');
    expect(header).not.toContain('Insights');
    expect(header).not.toContain('Category');
    expect(header).not.toContain('Auction Value');
    expect(header).not.toContain('Max Bid');
    expect(header).not.toContain('Experience Tier');
    expect(header).not.toContain('Composite Score');
    expect(header).not.toContain('Availability');
    expect(panel).toContain('data-player-details="available"');
    expect(panel).toMatch(/<td>C\/LW<\/td>\s*<td>58<\/td>\s*<td>25<\/td>\s*<td>35<\/td>\s*<td>60<\/td>\s*<td>NULL<\/td>\s*<td>NULL<\/td>\s*<\/tr>/);
    expect(renderDraftAuctionDashboard({
      ...props,
      draftIQ: { 'available player': { draftIQ: 81.5 } },
      draftIQv3: { 'available player': { draftIQ: 92.3 } },
    })).toMatch(/<td>60<\/td>\s*<td>81.5<\/td>\s*<td>92.3<\/td>\s*<\/tr>/);
    expect(panel.slice(panel.indexOf('<tbody>'))).not.toContain('RW');
    expect(panel.slice(panel.indexOf('<tbody>'))).not.toContain('Veteran');
    expect(panel).not.toContain('<td>Available</td>');
    const sortOptions = panel.match(/<select id="bestAvailableSort">([\s\S]*?)<\/select>/)[1];
    expect(sortOptions.match(/<option [^>]*>[^<]+<\/option>/g)).toEqual([
      '<option value="ADP" disabled>ADP (no data)</option>',
      '<option selected>Forecasted Points</option>',
      '<option >DraftIQ</option>',
      '<option >DraftIQ v3</option>',
    ]);
    expect(panel).toContain('<input id="bestAvailableSearch" type="search" value=""');
    expect(panel).not.toContain('Experience Tier');
    expect(panel).toMatch(/<select id="bestPositionFilter"><option value="">All<\/option><option value="C" >C<\/option><option value="LW" >LW<\/option><option value="RW" >RW<\/option><option value="D" >D<\/option><\/select>/);
    [
      'Power Play Time on Ice',
      'Points per Game',
      'First-Half Points per Game',
      'Second-Half Points per Game',
      'Projected Points',
      'Keeper Value Score',
      'Breakout Probability Score',
      'Risk Stability Score',
    ].forEach((description) => expect(panel).toContain(description));
    expect(panel).not.toContain('Composite Forecast Score');
    const modal = renderDraftAuctionDashboard({ ...props, selectedPlayer: player });
    expect(modal).toContain('NHL POS</dt><dd>RW</dd>');
    expect(modal).toContain('Projected Games</dt><dd>80</dd>');
    expect(modal).toContain('Projected Shots</dt><dd>200</dd>');
    expect(modal).toContain('FHPPG</dt><dd>0.6</dd>');
    expect(modal).toContain('SHPPG</dt><dd>0.9</dd>');
    expect(modal).toContain('Composite Score</dt><dd>86</dd>');
  });

  test('player profile shows AHL Scores pool games under forecast goals/assists/points and a fairPriceV2 deal rating', () => {
    const player = {
      id: 'pool-player', name: 'Pool Player', status: 'in-ahl', available: true, finalPosition: 'C',
      ppUnit: 1,
      forecastedGoals: 30, forecastedAssists: 40, forecastedPoints: 70,
      poolGames: { firstHalfGames: 31, secondHalfGames: 27, totalPoolGames: 58 },
      auctionValue: 20, valuationStatus: 'priced', nhlCareerGamesPlayed: 500,
    };
    const baseProps = {
      activeTab: 'best-available', players: [player], ahlPool: createAhlPool([player]),
      availableKeys: new Set(['pool player']), search: '', teamBudgets: [], teamNames: ['Team A'],
      selectedTeam: '', sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
      fairPriceV2: {
        'pool player': {
          fairPriceV2: 23.76, marketPrice: 24, basePrice: 18, baseSource: 'Post Draft 2025 (P Player)',
          scarcityFactor: 1.1, productionFactor: 1.2, poolGamesFactor: 1, powerPlayFactor: 1.15,
          budgetFactor: 0.95, lastPlayerPremium: 1.1,
        },
      },
    };
    const modal = renderDraftAuctionDashboard({ ...baseProps, selectedPlayer: player });
    const labels = [...modal.matchAll(/<dt>([^<]+)<\/dt>/g)].map((match) => match[1]);
    const start = labels.indexOf('Forecasted Goals');
    expect(labels.slice(start, start + 6)).toEqual([
      'Forecasted Goals', 'Forecasted Assists', 'Forecasted Points',
      'Pool Games (FH)', 'Pool Games (SH)', 'Total Pool Games',
    ]);
    expect(modal).toContain('Pool Games (FH)</dt><dd>31</dd>');
    expect(modal).toContain('Pool Games (SH)</dt><dd>27</dd>');
    expect(modal).toContain('Total Pool Games</dt><dd>58</dd>');
    // Market price, not raw fairPriceV2 or estimated auction value, drives the deal rating.
    expect(modal).toContain('data-deal-rating data-market-price="24"');
    expect(modal).toContain('Market Price: <strong>$24.00</strong>');
    expect(modal).toContain('Your Bid: <strong>—</strong>');
    expect(modal).toContain('Deal Rating: enter a bid');
    expect(modal).toContain('Base Source</dt><dd>Post Draft 2025 (P Player)</dd>');
    expect(modal).toContain('Scarcity Factor</dt><dd>1.1</dd>');
    expect(modal).toContain('PP Unit</dt><dd>1</dd>');
    expect(modal).toContain('Power Play Factor</dt><dd>1.15</dd>');
    expect(modal).toContain('Fair Price v2 (raw)</dt><dd>$23.76</dd>');
    expect(modal).toContain('Market Price (final)</dt><dd>$24.00</dd>');
    expect(modal).toContain('Budget Factor</dt><dd>0.95</dd>');
    expect(modal).toContain('Last Decent Player Premium</dt><dd>1.1</dd>');

    const missing = { ...player, poolGames: undefined, auctionValue: null, valuationStatus: 'unpriced' };
    const unpricedModal = renderDraftAuctionDashboard({ ...baseProps, fairPriceV2: {}, players: [missing], selectedPlayer: missing });
    expect(unpricedModal).not.toContain('<dt>Total Pool Games</dt>');
    expect(unpricedModal).toContain('data-market-price=""');
    expect(unpricedModal).toContain('Deal Rating: UNPRICED');
    const unpricedProfile = unpricedModal.slice(
      unpricedModal.indexOf('<section class="draft-modal'),
      unpricedModal.indexOf('</section>', unpricedModal.indexOf('<section class="draft-modal')) + '</section>'.length,
    );
    expect(unpricedProfile).not.toContain('NULL');
  });

  test('player profile hides missing details and formats derived Dobber scores without mutating data', () => {
    const player = {
      id: 'profile-cleanup', name: 'Profile Cleanup', status: 'in-ahl', finalPosition: 'C',
      available: true, forecast: { compositeScore: null, projectedPoints: 0 },
      dobberProjections: { PP: 'NULL', TOI: '  null ', PPTOI: null, 'Other missing': null },
      production: { PPS: 0.126 },
      deployment: { DS: null, RSS: 1, RRS: 0.996 },
      prospect: { BPS: 0.1 },
      riskScore: 20, pedigreeScore: 30,
      intelEdge: { pedigree: 'High', projectionConfidence: 90, sleeperTag: true, bustTag: false },
      pricingMethod: 'derived', adp: 12, strengths: [], risks: [null, undefined, ''],
      keeper: { KVS: null }, salary: null, aav: 12,
    };
    const props = {
      activeTab: 'best-available', players: [player], ahlPool: createAhlPool([player]),
      availableKeys: new Set(['profile cleanup']), teamBudgets: [], teamNames: [],
      selectedPlayer: player, sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
      fairPriceV2: {},
    };
    const modal = renderDraftAuctionDashboard(props);
    const section = (heading) => modal.match(
      new RegExp(`<article class="detail-card"><h3>${heading}<\\/h3>([\\s\\S]*?)<\\/article>`),
    )?.[1] || '';
    const nhlProfile = section('NHL Profile');
    const composite = section('Composite Forecast Score');
    const riskPedigree = section('Risk &amp; Pedigree \\(Dobber PDF Intel\\)');
    const keeperContract = section('Keeper / Contract');
    const dobberScores = modal.slice(modal.indexOf('<dt>PPS</dt>'), modal.indexOf('</dl>', modal.indexOf('<dt>PPS</dt>')));
    const profile = modal.slice(
      modal.indexOf('<section class="draft-modal'),
      modal.indexOf('</section>', modal.indexOf('<section class="draft-modal')) + '</section>'.length,
    );

    expect(profile).not.toContain('NULL');
    ['PP Unit', 'TOI', 'PPTOI', 'NHL POS', 'Team', 'Deployment'].forEach((label) => {
      expect(nhlProfile).not.toContain(`<dt>${label}</dt>`);
    });
    expect(dobberScores).toContain('<dt>PPS</dt><dd>0.13</dd>');
    expect(dobberScores).toContain('<dt>RSS</dt><dd>1.00</dd>');
    expect(dobberScores).toContain('<dt>RRS</dt><dd>1.00</dd>');
    expect(dobberScores).toContain('<dt>BPS</dt><dd>0.10</dd>');
    expect(composite).toContain('<dt>Composite Score</dt><dd></dd>');
    expect(composite).toContain('<dt>Forecasted Points</dt><dd>0</dd>');
    expect(composite).not.toContain('ADP');
    ['Risk Score', 'Pedigree Score', 'Pedigree', 'Projection Confidence', 'Sleeper Tag', 'Bust Tag', 'Pricing Method'].forEach((label) => {
      expect(riskPedigree).not.toContain(`<dt>${label}</dt>`);
    });
    expect(riskPedigree).toContain('<p><strong>Strengths:</strong></p>');
    expect(riskPedigree).not.toContain('<strong>Risks:</strong>');
    expect(keeperContract).toContain('<dt>KVS</dt><dd></dd>');
    expect(keeperContract).toContain('<dt>Salary</dt><dd></dd>');
    expect(keeperContract).not.toContain('<dt>AAV</dt>');
    expect(player.production.PPS).toBe(0.126);
    expect(player.deployment.RSS).toBe(1);
    expect(player.deployment.RRS).toBe(0.996);
    expect(player.prospect.BPS).toBe(0.1);
  });

  test('deal rating content shows fair price, bid and a STEAL / FAIR / OVERPAY badge', () => {
    expect(renderDealRatingContent('14', 20)).toContain('<span class="deal-badge deal-green">STEAL</span>');
    expect(renderDealRatingContent('22', 20)).toContain('<span class="deal-badge deal-yellow">FAIR</span>');
    expect(renderDealRatingContent('22.5', 20)).toContain('<span class="deal-badge deal-red">OVERPAY</span>');
    expect(renderDealRatingContent('22.5', 20)).toContain('Your Bid: <strong>$22.50</strong>');
    expect(renderDealRatingContent('', 20.456)).toContain('Market Price: <strong>$20.46</strong>');
    expect(renderDealRatingContent('', 20)).toContain('Deal Rating: enter a bid');
    expect(renderDealRatingContent('10', null)).toContain('Market Price: <strong>UNPRICED</strong>');
  });

  test('Best Available sorts ADP ascending, otherwise Forecasted Points descending, with missing values last', () => {
    const players = [
      { id: 'low', name: 'Low', status: 'in-ahl', finalPosition: 'C', adp: 12, forecast: { projectedPoints: 65, compositeScore: 50 } },
      { id: 'missing', name: 'Missing', status: 'in-ahl', finalPosition: 'D', forecast: { projectedPoints: null, compositeScore: null } },
      { id: 'high', name: 'High', status: 'in-ahl', finalPosition: 'LW', adp: 3, forecast: { projectedPoints: 60, compositeScore: 86 } },
      { id: 'no-adp', name: 'No ADP', status: 'in-ahl', finalPosition: 'RW', forecast: { projectedPoints: 90 } },
    ];
    const props = {
      activeTab: 'best-available', players, ahlPool: createAhlPool(players), availableKeys: new Set(['low', 'missing', 'high', 'no adp']),
      shortlist: new Set(), search: '', positionFilter: '', categoryFilter: '',
      availabilityFilter: 'all', bestAvailableSort: 'ADP',
      teamBudgets: [], teamNames: [], selectedPlayer: null, selectedTeam: '',
      sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    };
    const rowIds = (sort) => {
      const html = renderDraftAuctionDashboard({ ...props, bestAvailableSort: sort });
      const panel = html.slice(html.indexOf('id="best-available-panel"'));
      return [...panel.matchAll(/data-player-details="([^"]+)"/g)].map((match) => match[1]);
    };
    expect(rowIds('ADP')).toEqual(['high', 'low', 'no-adp', 'missing']);
    expect(rowIds('Forecasted Points')).toEqual(['no-adp', 'low', 'high', 'missing']);
    // Legacy persisted sorts (Composite Score, FHPPG, ...) fall back to Forecasted Points.
    expect(rowIds('Composite Score')).toEqual(['no-adp', 'low', 'high', 'missing']);
  });

  test('Best Available disables ADP and falls back to Forecasted Points when no player has ADP data', () => {
    const players = [
      { id: 'kucherov', name: 'Kucherov', status: 'in-ahl', finalPosition: 'RW', forecast: { projectedPoints: 128 } },
      { id: 'mackinnon', name: 'MacKinnon', status: 'in-ahl', finalPosition: 'C', forecast: { projectedPoints: 126 } },
      { id: 'mcdavid', name: 'McDavid', status: 'in-ahl', finalPosition: 'C', forecast: { projectedPoints: 131 } },
    ];
    const html = renderDraftAuctionDashboard({
      activeTab: 'best-available', players, ahlPool: createAhlPool(players),
      availableKeys: new Set(['kucherov', 'mackinnon', 'mcdavid']), bestAvailableSort: 'ADP',
      search: '', teamBudgets: [], teamNames: [], selectedPlayer: null, selectedTeam: '',
      sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    });

    const panel = html.slice(html.indexOf('id="best-available-panel"'), html.indexOf('id="team-budgets-panel"'));
    const sortOptions = panel.match(/<select id="bestAvailableSort">([\s\S]*?)<\/select>/)[1];
    expect(sortOptions).toContain('<option value="ADP" disabled>ADP (no data)</option>');
    expect(sortOptions).toContain('<option selected>Forecasted Points</option>');
    expect(panel).toContain('Sorted by Forecasted Points (highest first)');
    expect(panel).not.toContain('Sorted by ADP');
    expect([...panel.matchAll(/data-player-details="([^"]+)"/g)].map((match) => match[1]))
      .toEqual(['mcdavid', 'kucherov', 'mackinnon']);
  });

  test('Best Available filters exact available pool-game totals, including unavailable counts', () => {
    const players = [
      { id: 'fifty-eight', name: 'Fifty Eight', status: 'in-ahl', finalPosition: 'C', poolGames: { totalPoolGames: 58 } },
      { id: 'sixty', name: 'Sixty', status: 'in-ahl', finalPosition: 'LW', poolGames: { totalPoolGames: 60 } },
      { id: 'unknown', name: 'Unknown', status: 'in-ahl', finalPosition: 'D' },
    ];
    const props = {
      activeTab: 'best-available', players, ahlPool: createAhlPool(players),
      availableKeys: new Set(['fifty eight', 'sixty', 'unknown']),
      bestAvailableSort: 'Forecasted Points', search: '', teamBudgets: [], teamNames: [],
      selectedPlayer: null, selectedTeam: '', sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    };
    const renderIds = (filter, search = '') => {
      const html = renderDraftAuctionDashboard({
        ...props, bestAvailablePoolGamesFilter: filter, bestAvailableSearch: search,
      });
      const panel = html.slice(html.indexOf('id="best-available-panel"'));
      return [...panel.matchAll(/data-player-details="([^"]+)"/g)].map((match) => match[1]);
    };

    const html = renderDraftAuctionDashboard(props);
    const gamesSelect = html.match(/<select id="bestAvailablePoolGamesFilter">([\s\S]*?)<\/select>/)[1];
    expect(gamesSelect).toContain('<option value="" selected>All</option>');
    expect(gamesSelect).toContain('<option value="58" >58</option>');
    expect(gamesSelect).toContain('<option value="60" >60</option>');
    expect(gamesSelect).toContain('<option value="unknown" >Unavailable</option>');
    expect(renderIds('58')).toEqual(['fifty-eight']);
    expect(renderIds('unknown')).toEqual(['unknown']);
    expect(renderIds('60', 'sixty')).toEqual(['sixty']);
    const staleFilter = renderDraftAuctionDashboard({
      ...props, bestAvailablePoolGamesFilter: '64',
    }).match(/<select id="bestAvailablePoolGamesFilter">([\s\S]*?)<\/select>/)[1];
    expect(staleFilter).toContain('<option value="" selected>All</option>');
    expect(renderIds('64')).toEqual(['fifty-eight', 'sixty', 'unknown']);
  });

  test('Best Available sorts by DraftIQ descending with NULLs last and points/goals/assists/ADP tie-breakers', () => {
    const players = [
      { id: 'a', name: 'A', status: 'in-ahl', finalPosition: 'C', adp: 9, forecastedPoints: 50, forecastedGoals: 20, forecastedAssists: 30 },
      { id: 'b', name: 'B', status: 'in-ahl', finalPosition: 'C', adp: 4, forecastedPoints: 50, forecastedGoals: 25, forecastedAssists: 25 },
      { id: 'c', name: 'C', status: 'in-ahl', finalPosition: 'C', adp: 2, forecastedPoints: 50, forecastedGoals: 25, forecastedAssists: 25 },
      { id: 'd', name: 'D', status: 'in-ahl', finalPosition: 'C', adp: 1, forecastedPoints: 50, forecastedGoals: 25, forecastedAssists: 26 },
      { id: 'e', name: 'E', status: 'in-ahl', finalPosition: 'C', adp: 3, forecastedPoints: 80 },
    ];
    const props = {
      activeTab: 'best-available', players, ahlPool: createAhlPool(players),
      availableKeys: new Set(['a', 'b', 'c', 'd', 'e']),
      draftIQ: { a: { draftIQ: 90 }, b: { draftIQ: 70 }, c: { draftIQ: 70 }, d: { draftIQ: null }, e: { draftIQ: 10 } },
      search: '', teamBudgets: [], teamNames: [], selectedPlayer: null, selectedTeam: '',
      sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    };
    const rowIds = (sort) => {
      const html = renderDraftAuctionDashboard({ ...props, bestAvailableSort: sort });
      const panel = html.slice(html.indexOf('id="best-available-panel"'), html.indexOf('id="team-budgets-panel"'));
      return [...panel.matchAll(/data-player-details="([^"]+)"/g)].map((match) => match[1]);
    };
    // b and c tie on DraftIQ/points/goals/assists, so ADP ascending breaks the tie.
    expect(rowIds('DraftIQ')).toEqual(['a', 'c', 'b', 'e', 'd']);
    // Points tie (50) -> goals (25 beats 20) -> assists (26 beats 25) -> ADP.
    expect(rowIds('Forecasted Points')).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(rowIds('ADP')).toEqual(['d', 'c', 'e', 'b', 'a']);
    expect(renderDraftAuctionDashboard({ ...props, bestAvailableSort: 'DraftIQ' })).toContain('Sorted by DraftIQ (highest first)');
    const needsSelect = renderDraftAuctionDashboard({ ...props, teamNames: ['Team A', 'Team B'], bestAvailableNeedsTeam: 'Team B' })
      .match(/<select id="bestAvailableNeedsTeam">([\s\S]*?)<\/select>/)[1];
    expect(needsSelect).toContain('<option value="Team B" selected>Team B</option>');
    expect(needsSelect).toContain('<option value="">None</option>');
  });

  test('Best Available sorts by DraftIQ v3 independently of v2, NULLs last, with the same tie-breakers', () => {
    const players = [
      { id: 'a', name: 'A', status: 'in-ahl', finalPosition: 'C', adp: 9, forecastedPoints: 50, forecastedGoals: 20, forecastedAssists: 30 },
      { id: 'b', name: 'B', status: 'in-ahl', finalPosition: 'C', adp: 4, forecastedPoints: 50, forecastedGoals: 25, forecastedAssists: 25 },
      { id: 'c', name: 'C', status: 'in-ahl', finalPosition: 'C', adp: 2, forecastedPoints: 50, forecastedGoals: 25, forecastedAssists: 25 },
      { id: 'd', name: 'D', status: 'in-ahl', finalPosition: 'C', adp: 1, forecastedPoints: 60 },
      { id: 'e', name: 'E', status: 'in-ahl', finalPosition: 'D', adp: 3, forecastedPoints: 80 },
    ];
    const props = {
      activeTab: 'best-available', players, ahlPool: createAhlPool(players),
      availableKeys: new Set(['a', 'b', 'c', 'd', 'e']),
      draftIQ: { a: { draftIQ: 1 }, b: { draftIQ: 2 }, c: { draftIQ: 3 }, d: { draftIQ: 4 }, e: { draftIQ: 5 } },
      draftIQv3: { a: { draftIQ: 40 }, b: { draftIQ: 40 }, c: { draftIQ: 40 }, d: { draftIQ: null }, e: { draftIQ: 95 } },
      search: '', teamBudgets: [], teamNames: [], selectedPlayer: null, selectedTeam: '',
      sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    };
    const panelFor = (extra) => {
      const html = renderDraftAuctionDashboard({ ...props, ...extra });
      return html.slice(html.indexOf('id="best-available-panel"'), html.indexOf('id="team-budgets-panel"'));
    };
    const rowIds = (extra) => [...panelFor(extra).matchAll(/data-player-details="([^"]+)"/g)].map((match) => match[1]);
    // a/b/c tie on v3 and points -> goals (b, c beat a) -> assists tie -> ADP (c before b).
    expect(rowIds({ bestAvailableSort: 'DraftIQ v3' })).toEqual(['e', 'c', 'b', 'a', 'd']);
    expect(rowIds({ bestAvailableSort: 'DraftIQ' })).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(panelFor({ bestAvailableSort: 'DraftIQ v3' })).toContain('Sorted by DraftIQ v3 (highest first)');
    expect(panelFor({ bestAvailableSort: 'DraftIQ v3' })).toContain('<option selected>DraftIQ v3</option>');
    // Search still overrides position filter and cap under the v3 sort.
    expect(rowIds({ bestAvailableSort: 'DraftIQ v3', positionFilter: 'D', bestAvailableSearch: 'c' })).toEqual(['c']);
  });

  test('Best Available limits to the top 25 after position and sort, never including drafted players', () => {
    const players = Array.from({ length: 62 }, (_, index) => ({
      id: `player-${index}`,
      name: `Player ${String(index).padStart(2, '0')}`,
      status: 'in-ahl',
      finalPosition: index % 2 ? 'LW/D' : 'C',
      forecast: { projectedPoints: index },
    }));
    const draftedPlayers = [{ ...players[61], draftOwner: 'TEAM A', draftPrice: 3 }];
    const props = {
      activeTab: 'best-available', players, draftedPlayers,
      ahlPool: createAhlPool(players),
      availableKeys: new Set(players.filter((player) => player.id !== 'player-61').map((player) => player.name.toLowerCase())),
      bestAvailableSort: 'Forecasted Points', search: '', positionFilter: '',
      categoryFilter: '', teamBudgets: [], teamNames: [], selectedPlayer: null,
      selectedTeam: '', sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    };
    const rowIds = (options) => {
      const html = renderDraftAuctionDashboard({ ...props, ...options });
      const panel = html.slice(html.indexOf('id="best-available-panel"'), html.indexOf('id="team-budgets-panel"'));
      return [...panel.matchAll(/data-player-details="([^"]+)"/g)].map((match) => match[1]);
    };
    const all = rowIds({});
    expect(all).toHaveLength(25);
    expect(all[0]).toBe('player-60');
    expect(all).not.toContain('player-61');
    const wings = rowIds({ bestPositionFilter: 'LW' });
    expect(wings).toHaveLength(25);
    expect(wings[0]).toBe('player-59');
    expect(wings).not.toContain('player-61');
    expect(rowIds({ bestPositionFilter: 'D' })).toEqual(wings);
    expect(rowIds({ bestPositionFilter: 'RW' })).toEqual([]);
  });

  test('Best Available strictly uses refreshed availability keys and excludes removed or non-AHL players', () => {
    const players = [
      { id: 'listed', name: 'Listed', status: 'in-ahl', availability: 'Unavailable', finalPosition: 'C' },
      { id: 'stale', name: 'Stale', status: 'in-ahl', availability: 'Available', finalPosition: 'C' },
      { id: 'removed', name: 'Removed', status: 'in-ahl', localStatus: 'removed-local', finalPosition: 'C' },
      { id: 'outside-pool', name: 'Outside Pool', status: 'not-in-ahl', finalPosition: 'C' },
    ];
    const props = {
      activeTab: 'best-available',
      players,
      ahlPool: createAhlPool(players),
      draftedPlayers: [],
      availableKeys: new Set(['listed']),
      bestAvailableSort: 'ADP',
      search: '',
      teamBudgets: [],
      teamNames: [],
      selectedPlayer: null,
      selectedTeam: '',
      sourceAvailability: {},
      toolsHtml: '',
      workspaceHtml: '',
    };
    const panel = renderDraftAuctionDashboard(props).split('id="best-available-panel"')[1];
    expect(panel).toContain('data-player-details="listed"');
    expect(panel).not.toContain('data-player-details="stale"');
    expect(panel).not.toContain('data-player-details="removed"');
    expect(panel).not.toContain('data-player-details="outside-pool"');
  });

  test('Best Available search matches every available canonical pool player by name, overriding position and top 25', () => {
    const players = Array.from({ length: 30 }, (_, index) => ({
      id: `smith-${index}`,
      name: `Smith ${String(index).padStart(2, '0')}`,
      status: 'in-ahl',
      finalPosition: index % 2 ? 'D' : 'C',
      forecast: { projectedPoints: index },
    }));
    const drafted = { id: 'smith-drafted', name: 'Smith Drafted', status: 'in-ahl', finalPosition: 'C' };
    const other = { id: 'jones', name: 'Jones', status: 'in-ahl', finalPosition: 'C', forecast: { projectedPoints: 99 } };
    const all = [...players, drafted, other];
    const ahlPool = {
      ...createAhlPool(all),
      'smith pool only': { playerKey: 'smith pool only', name: 'Smith Pool Only', team: 'MTL', positions: ['RW'], flags: {} },
    };
    const props = {
      activeTab: 'best-available', players: all, draftedPlayers: [], ahlPool,
      availableKeys: new Set([...players.map((player) => player.name.toLowerCase()), 'jones', 'smith pool only']),
      bestAvailableSort: 'Forecasted Points', bestPositionFilter: 'D', search: '',
      teamBudgets: [], teamNames: [], selectedPlayer: null, selectedTeam: '',
      sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    };
    const panelFor = (options) => {
      const html = renderDraftAuctionDashboard({ ...props, ...options });
      return html.slice(html.indexOf('id="best-available-panel"'), html.indexOf('id="team-budgets-panel"'));
    };
    const ids = (panel) => [...panel.matchAll(/data-player-details="([^"]+)"/g)].map((match) => match[1]);
    expect(ids(panelFor({}))).toHaveLength(15);
    const searched = panelFor({ bestAvailableSearch: 'smith' });
    expect(ids(searched)).toHaveLength(30);
    expect(ids(searched)[0]).toBe('smith-29');
    expect(ids(searched)).not.toContain('smith-drafted');
    expect(ids(searched)).not.toContain('jones');
    expect(searched).toContain('data-pool-player="pool:smith pool only">Smith Pool Only</span>');
    expect(searched).toMatch(/Smith Pool Only<\/span><\/td>\s*<td>RW<\/td>\s*<td>NULL<\/td>\s*<td>NULL<\/td>\s*<td>NULL<\/td>/);
    expect(searched).toContain('<input id="bestAvailableSearch" type="search" value="smith"');
    expect(searched).toContain('position filter ignored while searching');
    expect(ids(panelFor({ bestAvailableSearch: 'zzz' }))).toEqual([]);
  });

  test('Best Available positions come only from the canonical pool (Engstrom resolves to D)', () => {
    const engstrom = {
      id: 'adam-engstrom',
      name: 'Adam Engstrom',
      status: 'in-ahl',
      finalPosition: 'LW/D',
      finalPositionOverride: 'C',
      position: 'RW',
      utilityPosition: 'L/R',
      nhlPosition: 'LW',
      forecast: { projectedGoals: 3, projectedAssists: 5, projectedPoints: 8 },
    };
    const props = {
      activeTab: 'best-available', players: [engstrom], draftedPlayers: [],
      ahlPool: {
        'adam engstrom': {
          playerKey: 'adam engstrom', name: 'Adam Engstrom', team: 'MTL', positions: ['D'],
          flags: { primaryPosition: 'D', utilityPosition: null },
        },
      },
      availableKeys: new Set(['adam engstrom']),
      bestAvailableSort: 'ADP', search: '', teamBudgets: [], teamNames: [], selectedPlayer: null,
      selectedTeam: '', sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    };
    const panelFor = (options) => {
      const html = renderDraftAuctionDashboard({ ...props, ...options });
      return html.slice(html.indexOf('id="best-available-panel"'), html.indexOf('id="team-budgets-panel"'));
    };
    const tbody = panelFor({}).split('<tbody>')[1];
    expect(tbody).toMatch(/Adam Engstrom<\/button>[\s\S]*?<\/td>\s*<td>D<\/td>\s*<td>NULL<\/td>\s*<td>3<\/td>\s*<td>5<\/td>\s*<td>8<\/td>/);
    expect(tbody).not.toMatch(/<td>[^<]*(LW|RW|C)[^<]*<\/td>/);
    ['LW', 'RW', 'C'].forEach((position) => {
      expect(panelFor({ bestPositionFilter: position })).not.toContain('data-player-details="adam-engstrom"');
    });
    expect(panelFor({ bestPositionFilter: 'D' })).toContain('data-player-details="adam-engstrom"');
  });

  test('routes players with availability "Unavailable" to Draft Board instead of Best Available', () => {
    const undraftedUnavailable = {
      id: 'owned-in-ahl',
      name: 'Owned In AHL',
      status: 'in-ahl',
      availability: 'Unavailable',
    };
    const undraftedAvailable = {
      id: 'open-prospect',
      name: 'Open Prospect',
      status: 'in-ahl',
      availability: 'Available',
    };
    const props = {
      activeTab: 'best-available',
      players: [undraftedUnavailable, undraftedAvailable],
      ahlPool: createAhlPool([undraftedUnavailable, undraftedAvailable]),
      draftedPlayers: [],
      availableKeys: new Set(['open prospect']),
      search: '',
      positionFilter: '',
      categoryFilter: '',
      bestAvailableSort: 'ADP',
      teamBudgets: [],
      teamNames: [],
      selectedPlayer: null,
      selectedTeam: '',
      sourceAvailability: {},
      toolsHtml: '',
      workspaceHtml: '',
    };
    const html = renderDraftAuctionDashboard(props);
    const panel = html.slice(html.indexOf('id="best-available-panel"'));
    expect(panel).toContain('data-player-details="open-prospect"');
    expect(panel).not.toContain('data-player-details="owned-in-ahl"');
  });
});
