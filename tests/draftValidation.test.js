import { jest } from '@jest/globals';
import {
  buildOwnerViewData,
  buildDraftValidationReport,
  createManualOverrideDraft,
  mergeDataset,
  refreshGoogleSheetState,
  resolveLeagueTeamName,
} from '../app.js';
import { parseRoster } from '../rosterParser.js';

describe('draft validation report', () => {
  test('detects ownership conflicts and builds the available-player pool', () => {
    const now = new Date().toISOString();
    const report = buildDraftValidationReport({
      version: 2,
      datasets: {
        roster: {
          players: {
            alice: { name: 'Alice Example', owner: 'TEAM A', position: 'C' },
            bob: { name: 'Bob Example', owner: '', position: 'D', available: 'true' },
            carol: { name: 'Carol Example', owner: 'TEAM B', position: 'LW', retained: 'true' },
            dana: { name: 'Dana Example', owner: 'TEAM C', position: 'RW', available: 'true' },
            erin: { name: 'Erin Example', owner: '', position: 'C', available: 'true' },
          },
        },
        prospects: {
          prospects: {
        alice: { name: 'Alice Example', owner: 'TEAM A', poolPosition: 'C', farm: false, termRemaining: 2, matchingRights: true },
        aliceDup: { name: 'Alice Example', owner: 'TEAM Z', poolPosition: 'LW', farm: false, termRemaining: 1, matchingRights: false },
        missingOwner: { name: 'Needs Owner', owner: '', poolPosition: 'D', farm: false, termRemaining: 1, matchingRights: false },
          },
        },
        veterans: {
          veterans: {
        bob: { name: 'Bob Example', owner: 'TEAM B', poolPosition: 'RW', currentCost: 10, retentionYear: 2026 },
        carol: { name: 'Carol Example', owner: 'TEAM B', poolPosition: 'D', currentCost: 20, retentionYear: null },
          },
        },
      },
      metadata: {
        prospects: { status: 'ok', importedAt: now },
        veterans: { status: 'ok', importedAt: now },
        roster: { status: 'ok', importedAt: now },
        transactions: { status: 'empty' },
      },
      manualOverrides: [
        {
          id: 'manual-one',
          name: 'Missing Prospect',
          position: 'C',
          classification: 'Rookie',
          createdAt: now,
          notes: 'late add',
        },
      ],
      workingAssignments: {
        'erin example': {
          playerKey: 'erin example',
          name: 'Erin Example',
          team: 'YEAH TEAM',
          position: 'C',
          classification: 'Rookie',
          status: 'Winning Bid',
          bid: 5.57,
          updatedAt: now,
        },
      },
    });

    expect(report.validationHealth).toBe('error');
    expect(report.validationRows.find((row) => row.key === 'duplicate-ownership').status).toBe('error');
    expect(report.validationRows.find((row) => row.key === 'available-player-integrity').status).toBe('error');
    expect(report.validationRows.find((row) => row.key === 'retention-integrity').status).toBe('warning');
    expect(report.validationRows.find((row) => row.key === 'draft-roster-rules').status).toBe('valid');
    expect(report.snapshot.status).toBe('valid');
    expect(report.availablePlayers.some((player) => player.name === 'Bob Example' && !player.manualOverride)).toBe(false);
    expect(report.availablePlayers.some((player) => player.name === 'Erin Example' && !player.manualOverride)).toBe(false);
    expect(report.assignedPlayers.some((player) => player.name === 'Erin Example' && player.team === 'YEAH TEAM')).toBe(true);
    expect(report.assignedPlayers.find((player) => player.name === 'Erin Example')?.bid).toBe(5.57);
    expect(report.counts.workingAssignedCount).toBe(1);
    expect(report.assignedByTeam['YEAH TEAM']).toHaveLength(1);
    expect(report.availablePlayers.some((player) => player.name === 'Missing Prospect' && player.manualOverride)).toBe(true);
    expect(report.manualOverrides).toHaveLength(1);
  });

  test('calculates average cost per remaining flexible roster slot', () => {
    const now = new Date().toISOString();
    const report = buildDraftValidationReport({
      version: 2,
      datasets: {
        prospects: {
          prospects: {
            highCostKeep: {
              name: 'High Cost Keep',
              owner: 'YEAH TEAM',
              poolPosition: 'C',
              cost: 249.75,
              farm: false,
              termRemaining: 1,
              matchingRights: false,
            },
          },
        },
        veterans: { veterans: {} },
        roster: { players: {} },
        transactions: null,
      },
      metadata: {
        prospects: { status: 'ok', importedAt: now },
        veterans: { status: 'empty' },
        roster: { status: 'empty' },
        transactions: { status: 'empty' },
      },
      manualOverrides: [],
    });

    const rosterRuleRow = report.validationRows.find((row) => row.key === 'draft-roster-rules');
    expect(rosterRuleRow.status).toBe('valid');
    expect(report.ownerDraftPlans).toHaveLength(1);
    expect(report.ownerDraftPlans[0].owner).toBe('YEAH TEAM');
    expect(report.ownerDraftPlans[0].remainingBudget).toBe(0.25);
    expect(report.ownerDraftPlans[0].slotsNeeded).toBe(24);
    expect(report.ownerDraftPlans[0].averageCostPerSlotRemaining).toBe(0.01);
  });

  test('creates a normalized manual override draft', () => {
    const entry = createManualOverrideDraft({
      name: 'Late Add',
      position: 'RW',
      classification: 'rookie',
      notes: 'league correction',
    });

    expect(entry).toMatchObject({
      name: 'Late Add',
      position: 'RW',
      classification: 'Rookie',
      notes: 'league correction',
      addedBy: 'Local User',
      manualOverride: true,
    });
    expect(entry.id).toContain('manual-');
    expect(entry.createdAt).toBeDefined();
  });

  test('merges inventory and retained sheets into authoritative player state', () => {
    const inventory = parseRoster([
      'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
      'Kirill Kaprizov,MIN,Connor Bedard,CHI,Dylan Guenther,UTA,Cale Makar,COL',
      'Jake Guentzel,TB,Nathan MacKinnon,COL,Jack Eichel,VEG,Quinn Hughes,VAN',
    ].join('\n'));
    const retained = parseRoster([
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,C Bedard,C,$40.00,1,J Eichel,RW,$35.00',
      '2,D Guenther,RW,$8.50,2,K Kaprizov,LW,$45.00',
      ',TOTAL SPENT,,$48.50,,TOTAL SPENT,,$80.00',
    ].join('\n'));

    let state = mergeDataset(undefined, 'roster', inventory, 'inventory.csv');
    state = mergeDataset(state, 'roster', retained, 'retained.csv');
    const report = buildDraftValidationReport(state);
    const players = Object.values(state.datasets.roster.players);

    expect(players.find((player) => player.name === 'Connor Bedard')).toMatchObject({ owner: 'TEAM A', retained: true, cost: 40 });
    expect(players.find((player) => player.name === 'Jack Eichel')).toMatchObject({ owner: 'TEAM B', retained: true, cost: 35 });
    expect(players.find((player) => player.name === 'Dylan Guenther')).toMatchObject({ owner: 'TEAM A', retained: true, cost: 8.5 });
    expect(players.find((player) => player.name === 'Kirill Kaprizov')).toMatchObject({ owner: 'TEAM B', retained: true, cost: 45 });
    expect(report.availablePlayers.map((player) => player.name)).toEqual(expect.arrayContaining(['Nathan MacKinnon', 'Jake Guentzel', 'Cale Makar', 'Quinn Hughes']));
    expect(report.availablePlayers.map((player) => player.name)).not.toEqual(expect.arrayContaining(['Connor Bedard', 'Jack Eichel', 'Dylan Guenther', 'Kirill Kaprizov']));
    expect(report.counts.ownershipCount).toBe(4);
  });

  test('refresh replaces a roster source, rebuilds availability, and reconciles assignments', () => {
    const inventory = parseRoster([
      'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
      'Kirill Kaprizov,MIN,Connor Bedard,CHI,Dylan Guenther,UTA,Cale Makar,COL',
    ].join('\n'));
    const retainedBefore = parseRoster([
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,C Bedard,C,$40.00,1,K Kaprizov,LW,$45.00',
      ',TOTAL SPENT,,$40.00,,TOTAL SPENT,,$45.00',
    ].join('\n'));
    const retainedAfter = parseRoster([
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,D Guenther,RW,$8.50,,,,',
      ',TOTAL SPENT,,$8.50,,TOTAL SPENT,,$0.00',
    ].join('\n'));

    let state = mergeDataset(undefined, 'roster', inventory, 'inventory.csv');
    state.workingAssignments = {
      'dylan guenther': {
        playerKey: 'dylan guenther',
        name: 'Dylan Guenther',
        team: 'TEAM B',
        bid: 8.5,
        classification: 'Rookie',
        status: 'Winning Bid',
      },
    };

    let report = buildDraftValidationReport(state);
    expect(report.availablePlayers.some((player) => player.name === 'Dylan Guenther')).toBe(false);
    expect(report.assignedByTeam['TEAM B']).toHaveLength(1);
    expect(buildOwnerViewData(state).owners.some((owner) => owner.name === 'TEAM B')).toBe(true);

    state = mergeDataset(state, 'roster', retainedBefore, 'retained.csv');
    report = buildDraftValidationReport(state);
    expect(report.availablePlayers.some((player) => player.name === 'Connor Bedard')).toBe(false);
    expect(report.availablePlayers.some((player) => player.name === 'Kirill Kaprizov')).toBe(false);

    state = mergeDataset(state, 'roster', retainedAfter, 'retained.csv');
    report = buildDraftValidationReport(state);
    expect(report.availablePlayers.some((player) => player.name === 'Connor Bedard')).toBe(true);
    expect(report.availablePlayers.some((player) => player.name === 'Kirill Kaprizov')).toBe(true);
    expect(report.availablePlayers.some((player) => player.name === 'Dylan Guenther')).toBe(false);
    expect(report.assignedPlayers.some((player) => player.name === 'Dylan Guenther')).toBe(false);
    expect(buildOwnerViewData(state).owners.find((owner) => owner.name === 'TEAM A')?.rosterPlayers.map((player) => player.name)).toContain('Dylan Guenther');
  });

  test('resolves retained players into veteran, rookie, and farm classifications', () => {
    const inventory = parseRoster([
      'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
      'Farm Player,MIN,Veteran Player,CHI,Rookie Player,UTA,Cale Makar,COL',
    ].join('\n'));
    const retained = parseRoster([
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,F Player,LW,$1.00,1,V Player,C,$10.00',
      '2,R Player,RW,$2.00,,,,',
      ',TOTAL SPENT,,$3.00,,TOTAL SPENT,,$10.00',
    ].join('\n'));

    let state = mergeDataset(undefined, 'roster', inventory, 'inventory.csv');
    state = mergeDataset(state, 'roster', retained, 'retained.csv');
    state = mergeDataset(state, 'prospects', {
      prospects: {
        farm: { name: 'Farm Player', owner: 'TEAM A', prospect: true, farm: true },
        rookie: { name: 'Rookie Player', owner: 'TEAM A', prospect: true, farm: false },
      },
      owners: { 'TEAM A': ['farm', 'rookie'] },
      farmPlayers: ['farm'],
    }, 'prospects.csv');
    state = mergeDataset(state, 'veterans', {
      veterans: {
        veteran: { name: 'Veteran Player', owner: 'TEAM B', veteran: true, retentionYear: 2026 },
      },
      owners: { 'TEAM B': ['veteran'] },
    }, 'veterans.csv');

    const report = buildDraftValidationReport(state);
    const ownerData = buildOwnerViewData(state);
    const teamA = ownerData.owners.find((owner) => owner.name === 'TEAM A');
    const teamB = ownerData.owners.find((owner) => owner.name === 'TEAM B');

    expect(report.counts).toMatchObject({
      retainedVeteranCount: 1,
      retainedRookieCount: 1,
      retainedFarmCount: 1,
      retainedUnclassifiedCount: 0,
    });
    expect(teamA.retainedFarm.map((player) => player.name)).toEqual(['Farm Player']);
    expect(teamA.retainedRookies.map((player) => player.name)).toEqual(['Rookie Player']);
    expect(teamB.retainedVeterans.map((player) => player.name)).toEqual(['Veteran Player']);
    expect(report.validationRows.find((row) => row.key === 'retention-integrity').status).toBe('valid');
  });

  test('reconciles unique first-name spelling variants across classification sheets', () => {
    const inventory = parseRoster([
      'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
      'Isaac Howard,EDM,Other Center,EDM,Other Wing,EDM,Eric Karlsson,PIT',
    ].join('\n'));
    const retained = parseRoster([
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,I Howard,LW,$2.50,1,E Karlsson,D,$14.00',
      ',TOTAL SPENT,,$2.50,,TOTAL SPENT,,$14.00',
    ].join('\n'));

    let state = mergeDataset(undefined, 'roster', inventory, 'inventory.csv');
    state = mergeDataset(state, 'roster', retained, 'retained.csv');
    state = mergeDataset(state, 'prospects', {
      isRightsList: true,
      prospects: {
        howard: { name: 'Issac Howard', owner: 'TEAM A', prospect: true, farm: false, matchingRights: true, year3Used: false },
      },
      owners: { 'TEAM A': ['howard'] },
      farmPlayers: [],
    }, 'rookie-rights.csv');
    state = mergeDataset(state, 'veterans', {
      veterans: {
        karlsson: { name: 'Erik Karlsson', owner: 'TEAM B', veteran: true, retentionYear: 2026 },
      },
      owners: { 'TEAM B': ['karlsson'] },
    }, 'veterans.csv');

    const owners = buildOwnerViewData(state).owners;
    expect(owners.find((owner) => owner.name === 'TEAM A').retainedRookies.map((player) => player.name)).toEqual(['Isaac Howard']);
    expect(owners.find((owner) => owner.name === 'TEAM B').retainedVeterans.map((player) => player.name)).toEqual(['Eric Karlsson']);
  });

  test('refreshes all Google Sheet sources atomically and rebuilds league state', async () => {
    const csvByGid = {
      '663280764': 'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,\nAvailable Player,MIN,Owned Player,CHI,Right Wing,UTA,Defense,COL',
      '1551984288': 'UTILITY,,\nUtility Player,EDM,C/L',
      '1727331506': 'TEAM A,,,,TEAM B,,,\n#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost\n1,O Player,C,$10.00,,,,\n,TOTAL SPENT,,$10.00,,TOTAL SPENT,,$0.00',
      '910545566': ',TEAM A,TEAM B\nC,O Player,\nF,,Farm Player\n,514-555-0100,514-555-0101',
      '1065921002': 'TEAMS,COST,Term Remaining,YR1,YR2,YR3,Matching Rights\nTEAM B,,,,,,\nAvailable Player LW - 2025,$1.50,2,X,X,,Y',
      '1905579914': 'TEAMS,2023,2024,2025,2026,2027\nTEAM A,,,,,\nOwned Player C - 2025,,,$5.00,$10.00,',
    };
    const fetchMock = jest.fn(async (url) => {
      const gid = new URL(url).searchParams.get('gid');
      return {
        ok: true,
        status: 200,
        text: async () => csvByGid[gid],
      };
    });

    const refreshed = await refreshGoogleSheetState({
      version: 2,
      datasets: { prospects: null, veterans: null, roster: null, transactions: null },
      metadata: {},
      manualOverrides: [],
      workingAssignments: {
        'available player': {
          playerKey: 'available player',
          name: 'Available Player',
          team: 'TEAM B',
          position: 'LW',
          classification: 'Rookie',
          status: 'Assigned',
          bid: 1,
        },
      },
    }, fetchMock);
    const report = buildDraftValidationReport(refreshed);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(Object.keys(refreshed.datasets.roster.sources)).toHaveLength(4);
    expect(Object.keys(refreshed.datasets.prospects.prospects)).toHaveLength(1);
    expect(Object.keys(refreshed.datasets.veterans.veterans)).toHaveLength(1);
    expect(report.availablePlayers.some((player) => player.name === 'Owned Player')).toBe(false);
    expect(report.availablePlayers.some((player) => player.name === 'Available Player')).toBe(false);
    expect(report.assignedPlayers.some((player) => player.name === 'Available Player')).toBe(true);
    expect(buildOwnerViewData(refreshed).owners.map((owner) => owner.name)).toEqual(expect.arrayContaining(['TEAM A', 'TEAM B']));
  });

  test('shows only unretained rookie rights and ranks evaluated available players', () => {
    const inventory = parseRoster([
      'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
      'Retained Rookie,MIN,High Value Rookie,CHI,Low Value Rookie,UTA,Defense,COL',
    ].join('\n'));
    const retained = parseRoster([
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,R Rookie,LW,$5.00,,,,',
      ',TOTAL SPENT,,$5.00,,TOTAL SPENT,,$0.00',
    ].join('\n'));
    const prospects = {
      isRightsList: true,
      prospects: {
        retained: { name: 'Retained Rookie', owner: 'TEAM A', prospect: true, farm: false, cost: 5, matchingRights: true, year3Used: false },
        high: { name: 'High Value Rookie', owner: 'TEAM B', prospect: true, farm: false, cost: 8, matchingRights: true, year3Used: false },
        low: { name: 'Low Value Rookie', owner: 'TEAM B', prospect: true, farm: false, cost: 1, matchingRights: false, year3Used: false },
      },
      owners: { 'TEAM A': ['retained'], 'TEAM B': ['high', 'low'] },
      farmPlayers: [],
    };

    let state = mergeDataset(undefined, 'roster', inventory, 'inventory.csv');
    state = mergeDataset(state, 'roster', retained, 'retained.csv');
    state = mergeDataset(state, 'prospects', prospects, 'rookie-rights.csv');
    const report = buildDraftValidationReport(state);
    const teamB = buildOwnerViewData(state).owners.find((owner) => owner.name === 'TEAM B');
    const availableByName = Object.fromEntries(report.availablePlayers.map((player) => [player.name, player]));

    expect(teamB.matchingRights.map((player) => `${player.name} (${player.matchingRights ? 'Y' : 'N'})`)).toEqual(['High Value Rookie (Y)']);
    expect(buildOwnerViewData(state).owners.find((owner) => owner.name === 'TEAM A').matchingRights).toHaveLength(0);
    expect(availableByName['High Value Rookie']).toMatchObject({ matchingRights: true, rightsOwner: 'TEAM B' });
    expect(availableByName['Low Value Rookie']).toMatchObject({ matchingRights: false, rightsOwner: '' });
    expect(availableByName['High Value Rookie'].evaluation.score).toBeGreaterThan(availableByName['Low Value Rookie'].evaluation.score);
    expect(availableByName['Retained Rookie']).toBeUndefined();
  });

  test('counts L and R roster slots as skaters and applies confirmed Hebrew Hammers classifications', () => {
    const inventory = parseRoster([
      'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
      'Cutter Gauthier,ANA,Other Center,ANA,Cole Caufield,MTL,Other Defense,ANA',
      'Jackson Blake,CAR,Second Center,CAR,Ville Koivunen,PIT,Second Defense,CAR',
    ].join('\n'));
    const retained = parseRoster([
      'HEBREW HAMMERS,,,,OTHER TEAM,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,C Caufield,RW,$30.50,,,,',
      '2,C Gauthier,LW,$3.00,,,,',
      '3,J Blake,LW,$1.00,,,,',
      '4,V Koivunen,LW,$0.50,,,,',
      ',TOTAL SPENT,,$35.00,,TOTAL SPENT,,$0.00',
    ].join('\n'));
    const league = parseRoster([
      ',HEBREW HAMMERS',
      'L,C Gauthier',
      ',J Blake',
      ',V Koivunen',
      'R,C Caufield',
      'F,',
      ',514-555-0100',
      ',Matt Cutler',
      ',matt@example.com',
    ].join('\n'));

    let state = mergeDataset(undefined, 'roster', inventory, 'inventory.csv');
    state = mergeDataset(state, 'roster', retained, 'retained.csv');
    state = mergeDataset(state, 'roster', league, 'league.csv');
    state = mergeDataset(state, 'prospects', {
      isRightsList: true,
      prospects: {
        gauthier: { name: 'Cutter Gauthier', owner: 'HEBREW HAMMERS', prospect: true, farm: false, matchingRights: true, year3Used: false },
        blake: { name: 'Jackson Blake', owner: 'HEBREW HAMMERS', prospect: true, farm: false, matchingRights: true, year3Used: false },
        koivunen: { name: 'Ville Koivunen', owner: 'HEBREW HAMMERS', prospect: true, farm: false, matchingRights: true, year3Used: false },
      },
      owners: { 'HEBREW HAMMERS': ['gauthier', 'blake', 'koivunen'] },
      farmPlayers: [],
    }, 'rookie-rights.csv');
    state = mergeDataset(state, 'veterans', {
      veterans: {
        caufield: { name: 'Cole Caufield', owner: 'HEBREW HAMMERS', veteran: true, retentionYear: 2026 },
      },
      owners: { 'HEBREW HAMMERS': ['caufield'] },
    }, 'veterans.csv');
    const owner = buildOwnerViewData(state).owners.find((entry) => entry.name === 'HEBREW HAMMERS');
    const plan = buildDraftValidationReport(state).ownerDraftPlans.find((entry) => entry.owner === 'HEBREW HAMMERS');

    expect(plan).toMatchObject({
      skaters: 4,
      goalieTeams: 0,
      filledSlots: 4,
      slotsNeeded: 21,
      retainedSpend: 35,
      remainingBudget: 215,
      averageCostPerSlotRemaining: 10.24,
    });
    expect(owner.retainedVeterans.map((player) => player.name)).toEqual(['Cole Caufield']);
    expect(owner.retainedRookies.map((player) => player.name).sort()).toEqual(['Cutter Gauthier', 'Jackson Blake', 'Ville Koivunen']);
    expect(owner.retainedFarm).toHaveLength(0);
    expect(owner.rosterPlayers.some((player) => player.name === 'Matt Cutler')).toBe(false);
  });

  test('resolves unique partial team names and acronyms', () => {
    const teams = ['FIGHTING IRISH', 'HEBREW HAMMERS', 'IRONMEN'];

    expect(resolveLeagueTeamName('FI', teams)).toEqual({ team: 'FIGHTING IRISH' });
    expect(resolveLeagueTeamName('Fight', teams)).toEqual({ team: 'FIGHTING IRISH' });
    expect(resolveLeagueTeamName('HH', teams)).toEqual({ team: 'HEBREW HAMMERS' });
    expect(resolveLeagueTeamName('Unknown', teams).error).toContain('No league team matches');
  });
});
