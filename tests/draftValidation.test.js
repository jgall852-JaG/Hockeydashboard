import {
  buildDraftValidationReport,
  buildOwnerDraftPlan,
  createManualOverrideDraft,
  detectDatasetType,
  parseDraftBoard,
} from '../app.js';

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
            frank: { name: 'Frank Example', owner: '', position: 'C', available: 'false' },
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
    expect(report.availablePlayers.some((player) => player.name === 'Frank Example')).toBe(false);
    expect(report.assignedPlayers.some((player) => player.name === 'Erin Example' && player.team === 'YEAH TEAM')).toBe(true);
    expect(report.counts.workingAssignedCount).toBe(1);
    expect(report.assignedByTeam['YEAH TEAM']).toHaveLength(1);
    expect(report.availablePlayers.some((player) => player.name === 'Missing Prospect')).toBe(false);
    expect(report.manualOverrides).toHaveLength(1);
  });

  test('derives availability from inventory minus ownership, retention, draft picks, and working assignments', () => {
    const now = new Date().toISOString();
    const report = buildDraftValidationReport({
      version: 2,
      datasets: {
        positions: {
          players: {
            available: { name: 'Available Player', position: 'C', source: 'inventory' },
            owned: { name: 'Owned Player', position: 'LW', source: 'inventory' },
            retained: { name: 'Retained Player', position: 'D', source: 'inventory' },
            drafted: { name: 'Drafted Player', position: 'RW', source: 'inventory' },
            assigned: { name: 'Assigned Player', position: 'C', source: 'inventory' },
            rightsOnly: { name: 'Rights Only Player', position: 'C', matchingRights: true, source: 'inventory' },
          },
        },
        utility: {
          players: {
            duplicate: { name: 'Available Player', position: 'C/L', source: 'utility' },
            utility: { name: 'Utility Player', position: 'U', source: 'utility' },
          },
        },
        roster: {
          players: {
            owned: { name: 'O Player', owner: 'TEAM A', position: 'LW' },
          },
        },
        prospects: {
          prospects: {
            retained: { name: 'Retained Player', owner: 'TEAM B', poolPosition: 'D', matchingRights: true },
          },
        },
        veterans: { veterans: {} },
        draft: {
          players: {
            pick: { name: 'D Player', owner: 'TEAM C', position: 'RW', pick: 1 },
          },
        },
      },
      metadata: {
        positions: { status: 'ok', importedAt: now },
        utility: { status: 'ok', importedAt: now },
        roster: { status: 'ok', importedAt: now },
        prospects: { status: 'ok', importedAt: now },
        veterans: { status: 'empty' },
        draft: { status: 'ok', importedAt: now },
      },
      manualOverrides: [
        { id: 'manual-player', name: 'Outside Inventory', position: 'C', classification: 'Rookie' },
      ],
      workingAssignments: {
        'assigned player': {
          playerKey: 'assigned player',
          name: 'Assigned Player',
          team: 'TEAM D',
          bid: 1,
        },
      },
    });

    expect(report.availablePlayers.map((player) => player.name).sort()).toEqual([
      'Available Player',
      'Rights Only Player',
      'Utility Player',
    ]);
    expect(report.availablePlayers.filter((player) => player.name === 'Available Player')).toHaveLength(1);
    expect(report.counts.availableCount).toBe(3);
    expect(report.counts.workingAssignedCount).toBe(1);
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

  test('does not misclassify a transaction log as veteran data', () => {
    const transactions = [
      'TOYE SOLDIERS,,,,FIGHTING IRISH,,,,',
      'Move,Player,Cost,Date,Move,Player,Cost,Date',
      'TRADE,R Dahlin,$2.00,4-Sep,,,,',
    ].join('\n');

    expect(detectDatasetType(transactions)).toBe('unknown');
  });

  test('does not misclassify a live draft board as prospect data', () => {
    const draftBoard = [
      'DRUNKEN FLYBOYS,,,,FIGHTING IRISH,,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,J Guentzel,LW,$45.50,,R Dahlin,D,$28.00',
    ].join('\n');

    expect(detectDatasetType(draftBoard)).toBe('draft');
    expect(Object.values(parseDraftBoard(draftBoard).players)).toEqual([
      expect.objectContaining({ name: 'J Guentzel', owner: 'DRUNKEN FLYBOYS', pick: 1 }),
      expect.objectContaining({ name: 'R Dahlin', owner: 'FIGHTING IRISH', pick: null }),
    ]);
  });

  test('identifies the live Positions and Utility inventory snapshots', () => {
    expect(detectDatasetType([
      'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
      'Player One,ANA,Player Two,BOS,Player Three,NYR,Player Four,MTL',
    ].join('\n'))).toBe('positions');
    expect(detectDatasetType([
      'UTILITY,,',
      'Utility Player,ANA,C/L',
    ].join('\n'))).toBe('utility');
  });
});
