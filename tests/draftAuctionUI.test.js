import { getExperienceTierFromGames, renderDraftAuctionDashboard } from '../draftAuctionUI.js';
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
    expect(html).toContain('UNPRICED');
    expect(html).not.toContain('<th>Availability</th>');
    expect(html).toContain('Record winning bid');
    expect(html).toContain('Recommended max bid:</strong> NULL');
    expect(html).toContain('Personal Draft List');
    expect(html).not.toContain('Add to Personal List');
    expect(html).toContain('NHL POS');
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
    expect(boardPanel.match(/<th>[^<]+<\/th>/g)).toEqual([
      '<th>Player</th>', '<th>Final Position</th>', '<th>Experience Tier</th>',
      '<th>Owner</th>', '<th>Auction Value</th>', '<th>Remove Locally</th>',
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
    expect(bestPanel).toContain('data-player-details="available"');
    expect(bestPanel).not.toContain('data-player-details="drafted"');
    expect(bestPanel).toContain('data-personal-add="available"');
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

  test('Best Available uses the forecast-ready columns, requested sort options, and acronym legend', () => {
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
        projectedGames: 80,
        projectedShots: 200,
        FHPPG: 0.6,
        SHPPG: 0.9,
        compositeScore: 86,
      },
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
    const panel = html.slice(html.indexOf('id="best-available-panel"'));
    const header = panel.slice(panel.indexOf('<thead>'), panel.indexOf('</thead>'));
    expect(header.match(/<th>[^<]+<\/th>/g)).toEqual([
      '<th>Player</th>', '<th>Final Position</th>', '<th>Experience Tier</th>',
      '<th>Forecasted Points</th>', '<th>Composite Score</th>', '<th>Availability</th>',
    ]);
    expect(header).not.toContain('Shortlist');
    expect(header).not.toContain('Insights');
    expect(header).not.toContain('Category');
    expect(header).not.toContain('Auction Value');
    expect(header).not.toContain('Max Bid');
    expect(panel).toContain('data-player-details="available"');
    expect(panel).toMatch(/<td>C\/LW<\/td>\s*<td>Veteran<\/td>\s*<td>60<\/td>\s*<td>86<\/td>\s*<td>Available<\/td>/);
    expect(panel.slice(panel.indexOf('<tbody>'))).not.toContain('RW');
    const sortOptions = panel.match(/<select id="bestAvailableSort">([\s\S]*?)<\/select>/)[1];
    expect(sortOptions.match(/<option [^>]*>[^<]+<\/option>/g)).toEqual([
      '<option selected>ADP</option>',
      '<option >FHPPG</option>',
      '<option >SHPPG</option>',
      '<option >Forecasted Points</option>',
      '<option >Composite Score</option>',
      '<option >Games Played</option>',
    ]);
    expect(panel).toMatch(/<select id="bestPositionFilter"><option value="">All<\/option><option value="C" >C<\/option><option value="LW" >LW<\/option><option value="RW" >RW<\/option><option value="D" >D<\/option><\/select>/);
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
    const modal = renderDraftAuctionDashboard({ ...props, selectedPlayer: player });
    expect(modal).toContain('NHL POS</dt><dd>RW</dd>');
    expect(modal).toContain('Projected Games</dt><dd>80</dd>');
    expect(modal).toContain('Projected Shots</dt><dd>200</dd>');
    expect(modal).toContain('FHPPG</dt><dd>0.6</dd>');
    expect(modal).toContain('SHPPG</dt><dd>0.9</dd>');
    expect(modal).toContain('Composite Score</dt><dd>86</dd>');
  });

  test('Best Available sorts actual composite and split metrics, with missing values last', () => {
    const players = [
      { id: 'low', name: 'Low', status: 'in-ahl', finalPosition: 'C', seasonStats: { gamesPlayed: 40 }, forecast: { projectedPoints: 65, compositeScore: 50, FHPPG: 0.8, SHPPG: 0.7 } },
      { id: 'missing', name: 'Missing', status: 'in-ahl', finalPosition: 'D', forecast: { projectedPoints: null, compositeScore: null, FHPPG: null, SHPPG: null } },
      { id: 'high', name: 'High', status: 'in-ahl', finalPosition: 'LW', seasonStats: { gamesPlayed: 82 }, forecast: { projectedPoints: 60, compositeScore: 86, FHPPG: 0.6, SHPPG: 0.9 } },
    ];
    const props = {
      activeTab: 'best-available', players, ahlPool: createAhlPool(players), availableKeys: new Set(['low', 'missing', 'high']),
      shortlist: new Set(), search: '', positionFilter: '', categoryFilter: '',
      availabilityFilter: 'all', bestAvailableSort: 'Composite Score',
      teamBudgets: [], teamNames: [], selectedPlayer: null, selectedTeam: '',
      sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    };
    const rowIds = (sort) => {
      const html = renderDraftAuctionDashboard({ ...props, bestAvailableSort: sort });
      const panel = html.slice(html.indexOf('id="best-available-panel"'));
      return [...panel.matchAll(/data-player-details="([^"]+)"/g)].map((match) => match[1]);
    };
    expect(rowIds('Composite Score')).toEqual(['high', 'low', 'missing']);
    expect(rowIds('Forecasted Points')).toEqual(['low', 'high', 'missing']);
    expect(rowIds('FHPPG')).toEqual(['low', 'high', 'missing']);
    expect(rowIds('SHPPG')).toEqual(['high', 'low', 'missing']);
    expect(rowIds('Games Played')).toEqual(['high', 'low', 'missing']);
  });

  test('Best Available limits to the top 10 after position and sort, never including drafted players', () => {
    const players = Array.from({ length: 32 }, (_, index) => ({
      id: `player-${index}`,
      name: `Player ${String(index).padStart(2, '0')}`,
      status: 'in-ahl',
      finalPosition: index % 2 ? 'LW/D' : 'C',
      seasonStats: { gamesPlayed: index },
    }));
    const draftedPlayers = [{ ...players[31], draftOwner: 'TEAM A', draftPrice: 3 }];
    const props = {
      activeTab: 'best-available', players, draftedPlayers,
      ahlPool: createAhlPool(players),
      availableKeys: new Set(players.filter((player) => player.id !== 'player-31').map((player) => player.name.toLowerCase())),
      bestAvailableSort: 'Games Played', search: '', positionFilter: '',
      categoryFilter: '', teamBudgets: [], teamNames: [], selectedPlayer: null,
      selectedTeam: '', sourceAvailability: {}, toolsHtml: '', workspaceHtml: '',
    };
    const rowIds = (options) => {
      const html = renderDraftAuctionDashboard({ ...props, ...options });
      const panel = html.slice(html.indexOf('id="best-available-panel"'), html.indexOf('id="team-budgets-panel"'));
      return [...panel.matchAll(/data-player-details="([^"]+)"/g)].map((match) => match[1]);
    };
    const all = rowIds({});
    expect(all).toHaveLength(10);
    expect(all[0]).toBe('player-30');
    expect(all).not.toContain('player-31');
    const wings = rowIds({ bestPositionFilter: 'LW' });
    expect(wings).toHaveLength(10);
    expect(wings[0]).toBe('player-29');
    expect(wings).not.toContain('player-31');
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
    expect(panel).toContain('<td>Available</td>');
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
