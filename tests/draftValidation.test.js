import {
  buildDraftValidationReport,
  createManualOverrideDraft,
  detectDatasetType,
  mergeDataset,
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
          bid: 5.5,
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
    expect(report.counts.workingAssignedCount).toBe(1);
    expect(report.assignedByTeam['YEAH TEAM']).toHaveLength(1);
    expect(report.availablePlayers.some((player) => player.name === 'Missing Prospect' && player.manualOverride)).toBe(true);
    expect(report.manualOverrides).toHaveLength(1);
  });

  test('flags roster-rule shortfall when $0.50 minimum slots cannot be funded', () => {
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
    expect(rosterRuleRow.status).toBe('error');
    expect(report.ownerDraftPlans).toHaveLength(1);
    expect(report.ownerDraftPlans[0].owner).toBe('YEAH TEAM');
    expect(report.ownerDraftPlans[0].remainingBudget).toBe(0.25);
    expect(report.ownerDraftPlans[0].slotsNeeded).toBe(24);
    expect(report.ownerDraftPlans[0].minimumRequired).toBe(12);
    expect(report.ownerDraftPlans[0].budgetShortfall).toBe(11.75);
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

  test('merges sequential roster snapshots instead of overwriting draft availability state', () => {
    const inventoryCsv = [
      'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
      'Available Wing,ANA,Available Center,BOS,Available Right,CGY,Available Defender,DAL',
    ].join('\n');
    const utilityCsv = [
      'UTILITY,,',
      'Utility One,NYR,C/L',
      'Utility Two,PIT,R/L',
    ].join('\n');
    const retainedCsv = [
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,Available Wing,LW,$5.50,1,Retained Defender,D,$8.00',
      ',TOTAL SPENT,,$5.50,,TOTAL SPENT,,$8.00',
    ].join('\n');

    let state = {
      version: 2,
      datasets: { prospects: null, veterans: null, roster: null, transactions: null },
      metadata: {
        prospects: { status: 'empty' },
        veterans: { status: 'empty' },
        roster: { status: 'empty' },
        transactions: { status: 'empty' },
      },
      manualOverrides: [],
      workingAssignments: {},
    };

    [inventoryCsv, utilityCsv, retainedCsv].forEach((csv, index) => {
      const datasetType = detectDatasetType(csv);
      expect(datasetType).toBe('roster');
      state = mergeDataset(state, datasetType, parseRoster(csv), `snapshot-${index + 1}.csv`);
    });

    const rosterPlayers = Object.values(state.datasets.roster.players || {});
    expect(rosterPlayers.some((player) => player.name === 'Utility One')).toBe(true);
    expect(rosterPlayers.some((player) => player.name === 'Available Center')).toBe(true);
    expect(rosterPlayers.some((player) => player.name === 'Retained Defender' && player.owner === 'TEAM B')).toBe(true);
    expect(rosterPlayers.filter((player) => player.name === 'Available Wing')).toHaveLength(1);
    expect(rosterPlayers.find((player) => player.name === 'Available Wing').owner).toBe('TEAM A');

    const report = buildDraftValidationReport(state);
    expect(report.availablePlayers.some((player) => player.name === 'Utility One')).toBe(true);
    expect(report.availablePlayers.some((player) => player.name === 'Available Center')).toBe(true);
    expect(report.availablePlayers.some((player) => player.name === 'Available Wing')).toBe(false);
    expect(report.details.availableIntegrityIssues).toHaveLength(0);
  });

  test('does not collapse distinct same-name players across roster snapshots', () => {
    const ownerlessRosterCsv = [
      'name,position,nhlteam',
      'Alex Smith,C,ANA',
    ].join('\n');
    const ownedRosterCsv = [
      'name,owner,position,nhlteam,cost',
      'Alex Smith,TEAM A,D,BOS,7',
      'Other Player,TEAM B,LW,SEA,3',
    ].join('\n');

    let state = {
      version: 2,
      datasets: { prospects: null, veterans: null, roster: null, transactions: null },
      metadata: {
        prospects: { status: 'empty' },
        veterans: { status: 'empty' },
        roster: { status: 'empty' },
        transactions: { status: 'empty' },
      },
      manualOverrides: [],
      workingAssignments: {},
    };

    [ownerlessRosterCsv, ownedRosterCsv].forEach((csv, index) => {
      state = mergeDataset(state, 'roster', parseRoster(csv), `duplicate-${index + 1}.csv`);
    });

    const rosterPlayers = Object.values(state.datasets.roster.players || {});
    expect(rosterPlayers.filter((player) => player.name === 'Alex Smith')).toHaveLength(2);
    expect(rosterPlayers.some((player) => player.name === 'Alex Smith' && player.owner === '')).toBe(true);
    expect(rosterPlayers.some((player) => player.name === 'Alex Smith' && player.owner === 'TEAM A')).toBe(true);
    expect(state.datasets.roster.teams.ANA).toHaveLength(1);
    expect(state.datasets.roster.teams.BOS).toHaveLength(1);
  });

  test('does not merge name-only roster rows without a matching secondary identifier', () => {
    const nameOnlyCsv = [
      'name',
      'Jordan Green',
    ].join('\n');
    const detailedCsv = [
      'name,position,nhlteam',
      'Jordan Green,D,BOS',
    ].join('\n');

    let state = {
      version: 2,
      datasets: { prospects: null, veterans: null, roster: null, transactions: null },
      metadata: {
        prospects: { status: 'empty' },
        veterans: { status: 'empty' },
        roster: { status: 'empty' },
        transactions: { status: 'empty' },
      },
      manualOverrides: [],
      workingAssignments: {},
    };

    [nameOnlyCsv, detailedCsv].forEach((csv, index) => {
      state = mergeDataset(state, 'roster', parseRoster(csv), `name-only-${index + 1}.csv`);
    });

    const rosterPlayers = Object.values(state.datasets.roster.players || {});
    expect(rosterPlayers.filter((player) => player.name === 'Jordan Green')).toHaveLength(2);
  });
});
