import {
  buildDraftValidationReport,
  buildOwnerDraftPlan,
  buildOwnerViewData,
  createWorkingAssignmentDraft,
  createManualOverrideDraft,
} from '../app.js';

describe('draft validation report', () => {
  test('accepts only valid $0.50 working assignment bid increments', () => {
    const draft = { playerKey: 'one', name: 'Player One', team: 'TEAM A', bid: '1.50' };
    expect(createWorkingAssignmentDraft(draft)?.bid).toBe(1.5);
    expect(createWorkingAssignmentDraft({ ...draft, bid: '1.25' })).toBeNull();
  });

  test('excludes an assigned player even when the stored key differs from the sheet name key', () => {
    const report = buildDraftValidationReport({
      version: 2,
      datasets: {
        roster: { players: { candidate: { name: 'Player One', position: 'C', available: true, owner: '' } } },
        prospects: { prospects: {} },
        veterans: { veterans: {} },
      },
      metadata: {},
      workingAssignments: {
        'player-one': { playerKey: 'player-one', name: 'Player One', team: 'TEAM A', bid: 1 },
      },
    });

    expect(report.availablePlayers.some((player) => player.name === 'Player One')).toBe(false);
  });

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
        roster: {
          players: {},
          teamBudgets: [{
            team: 'YEAH TEAM',
            totalSpent: 249.75,
            remainingBudget: 0.25,
            keeperCosts: 249.75,
            rookieFarmCosts: 0,
            playersDrafted: 1,
            openSlots: 24,
          }],
        },
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

  test('does not estimate team budgets when AHL Draft balances are missing', () => {
    const report = buildDraftValidationReport({
      version: 2,
      datasets: {
        prospects: { prospects: { player: { name: 'Owned Player', owner: 'YEAH TEAM', poolPosition: 'C', cost: 25 } } },
        veterans: { veterans: {} },
        roster: { players: {} },
        transactions: null,
      },
      metadata: {},
      manualOverrides: [],
    });

    const budgetRow = report.validationRows.find((row) => row.key === 'ahl-draft-budgets');
    expect(report.ownerDraftPlans[0].remainingBudget).toBeNull();
    expect(report.ownerDraftPlans[0].budgetShortfall).toBeNull();
    expect(budgetRow.status).toBe('warning');
  });

  test('does not treat inventory parser defaults as explicit availability', () => {
    const report = buildDraftValidationReport({
      version: 2,
      datasets: {
        roster: {
          players: {
            'connor-bedard': {
              name: 'Connor Bedard',
              owner: '',
              position: 'C',
              source: 'inventory',
              drafted: false,
              retained: false,
              available: '',
            },
          },
        },
        prospects: {
          prospects: {
            'connor-bedard': {
              name: 'Connor Bedard',
              owner: 'HEBREW HAMMERS',
              poolPosition: 'C',
            },
          },
        },
      },
      manualOverrides: [],
      workingAssignments: {},
    });

    expect(report.details.availableIntegrityIssues).toEqual([]);
    expect(report.counts.availableIntegrityCount).toBe(0);
    expect(report.availablePlayers.some((player) => player.name === 'Connor Bedard')).toBe(false);
  });

  test('classifies sheet L and R abbreviations as skater roster positions', () => {
    const plan = buildOwnerDraftPlan({
      name: 'SHEET ABBREVIATIONS',
      rosterPlayers: [
        { name: 'Left Wing', position: 'L' },
        { name: 'Right Wing', position: 'R' },
        { name: 'Utility Skater', position: 'C/L' },
      ],
    });

    expect(plan.skaters).toBe(3);
    expect(plan.unclassified).toBe(0);
  });

  test('working assignments immediately remove a player from the available pool', () => {
    const state = {
      version: 2,
      datasets: {
        roster: {
          players: {
            'connor-mcdavid': { name: 'Connor McDavid', position: 'C', source: 'inventory' },
          },
        },
        prospects: { prospects: {} },
        veterans: { veterans: {} },
      },
      manualOverrides: [],
      workingAssignments: {
        'connor mcdavid': {
          playerKey: 'connor mcdavid',
          name: 'Connor McDavid',
          team: 'FIGHTING IRISH',
          bid: 60.5,
          status: 'Winning Bid',
        },
      },
    };

    const availableReport = buildDraftValidationReport({ ...state, workingAssignments: {} });
    const assignedReport = buildDraftValidationReport(state);

    expect(availableReport.counts.availableCount).toBe(1);
    expect(assignedReport.counts.availableCount).toBe(0);
    expect(assignedReport.assignedByTeam['FIGHTING IRISH'][0]).toMatchObject({
      name: 'Connor McDavid',
      bid: 60.5,
      status: 'Winning Bid',
    });
  });

  test('zero-years prospects move to matching rights only when eligible', () => {
    const ownerData = buildOwnerViewData({
      version: 2,
      datasets: {
        prospects: {
          prospects: {
            expiredRights: {
              name: 'Expired Rights',
              owner: 'TEAM A',
              termRemaining: 0,
              matchingRights: true,
            },
            expiredNoRights: {
              name: 'Expired No Rights',
              owner: 'TEAM B',
              termRemaining: '0',
              matchingRights: false,
            },
            activeRights: {
              name: 'Active Rights',
              owner: 'TEAM A',
              termRemaining: 1,
              matchingRights: true,
            },
          },
        },
        veterans: { veterans: {} },
        roster: { players: {} },
      },
    });
    const teamA = ownerData.owners.find((owner) => owner.name === 'TEAM A');
    const teamB = ownerData.owners.find((owner) => owner.name === 'TEAM B');

    expect(teamA.prospects.map((player) => player.name)).toEqual(['Active Rights']);
    expect(teamA.matchingRights.map((player) => player.name)).toEqual(['Expired Rights']);
    expect(teamB.prospects).toEqual([]);
    expect(teamB.matchingRights).toEqual([]);
  });

  test('zero-years prospects are excluded from available inventory and manual overrides', () => {
    const report = buildDraftValidationReport({
      version: 2,
      datasets: {
        roster: {
          players: {
            expired: { name: 'Expired Player', position: 'C', source: 'inventory', available: 'true' },
            active: { name: 'Active Player', position: 'LW', source: 'inventory', available: 'true' },
          },
        },
        prospects: {
          prospects: {
            expired: { name: 'Expired Player', termRemaining: 0, matchingRights: true },
          },
        },
        veterans: { veterans: {} },
      },
      manualOverrides: [
        {
          id: 'expired-override',
          name: 'Expired Player',
          position: 'C',
          classification: 'Rookie',
        },
      ],
      workingAssignments: {},
    });

    expect(report.availablePlayers.map((player) => player.name)).toEqual(['Active Player']);
    expect(report.counts.availableCount).toBe(1);
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
});
