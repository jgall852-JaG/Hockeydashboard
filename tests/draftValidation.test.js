import {
  buildDraftValidationReport,
  buildOwnerDraftPlan,
  buildOwnerViewData,
  createWorkingAssignmentDraft,
  createManualOverrideDraft,
  detectDatasetType,
  parseDraftBoard,
} from '../app.js';

describe('draft validation report', () => {
  test('includes newly drafted retained-grid players in the team roster and uses refreshed sheet budget totals', () => {
    const player = {
      name: 'Crack and hookers',
      owner: 'YEASTIE BEASTIES',
      position: 'C/L',
      poolposition: 'C/L',
      cost: 200,
      retained: true,
      source: 'retained-grid',
    };
    const sheetBudget = {
      team: 'YEASTIE BEASTIES',
      totalSpent: 237,
      remainingBudget: 13,
      playersDrafted: 4,
      openSlots: 21,
    };
    const snapshot = {
      version: 2,
      datasets: {
        prospects: { prospects: {} },
        veterans: {
          veterans: {
            'static-veteran': {
              playerId: 'static-veteran',
              name: 'Static Veteran',
              owner: 'YEASTIE BEASTIES',
              currentCost: 35,
            },
          },
        },
        roster: {
          players: { 'crack-and-hookers': player },
          sources: {
            'retained-grid': {
              layout: 'retained-grid',
              players: { 'crack-and-hookers': player },
            },
          },
          teamBudgets: [sheetBudget],
        },
      },
      metadata: {},
      workingAssignments: {},
    };
    const ownerData = buildOwnerViewData(snapshot);
    const owner = ownerData.owners.find((entry) => entry.name === 'YEASTIE BEASTIES');

    expect(owner.rosterPlayers).toHaveLength(1);
    expect(owner.rosterPlayers[0]).toMatchObject({
      name: 'Crack and hookers',
      position: 'C/L',
      cost: 200,
      sourceType: 'roster',
    });
    expect(buildOwnerDraftPlan(owner, sheetBudget)).toMatchObject({
      retainedSpend: 237,
      remainingBudget: 13,
      playersDrafted: 4,
      openSlots: 21,
    });

    const refreshedSnapshot = {
      ...snapshot,
      datasets: {
        ...snapshot.datasets,
        roster: {
          ...snapshot.datasets.roster,
          players: {},
          sources: {
            'retained-grid': { layout: 'retained-grid', players: {} },
          },
          teamBudgets: [{
            team: 'YEASTIE BEASTIES',
            totalSpent: 37,
            remainingBudget: 213,
            playersDrafted: 3,
            openSlots: 22,
          }],
        },
      },
    };
    const refreshedOwner = buildOwnerViewData(refreshedSnapshot).owners
      .find((entry) => entry.name === 'YEASTIE BEASTIES');

    expect(refreshedOwner.rosterPlayers).toEqual([]);
    expect(refreshedOwner.veterans.map((entry) => entry.name)).toEqual(['Static Veteran']);
    expect(buildOwnerDraftPlan(refreshedOwner, refreshedSnapshot.datasets.roster.teamBudgets[0]))
      .toMatchObject({
        retainedSpend: 37,
        remainingBudget: 213,
        playersDrafted: 3,
        openSlots: 22,
      });
  });

  test('shows draft-grid players missing from the canonical AHL pool with a warning', () => {
    const gridPlayer = {
      name: 'Crack and hookers',
      owner: 'YEASTIE BEASTIES',
      position: 'C/L',
      cost: 200,
      source: 'retained-grid',
    };
    const state = {
      version: 2,
      datasets: {
        ahlPool: {
          'known player': { name: 'Known Player', positions: ['C'], flags: {} },
        },
        roster: {
          players: { 'crack-and-hookers': gridPlayer },
          sources: {
            'retained-grid': {
              layout: 'retained-grid',
              players: { 'crack-and-hookers': gridPlayer },
              teamBudgets: [{
                team: 'YEASTIE BEASTIES',
                totalSpent: 200,
                remainingBudget: 50,
                playersDrafted: 1,
                openSlots: 24,
              }],
            },
          },
          teamBudgets: [{
            team: 'YEASTIE BEASTIES',
            totalSpent: 200,
            remainingBudget: 50,
            playersDrafted: 1,
            openSlots: 24,
          }],
        },
        prospects: { prospects: {} },
        veterans: { veterans: {} },
      },
      metadata: {},
      workingAssignments: {},
    };

    const owner = buildOwnerViewData(state).owners.find((entry) => entry.name === 'YEASTIE BEASTIES');
    const report = buildDraftValidationReport(state);

    expect(owner.rosterPlayers).toEqual([
      expect.objectContaining({ name: 'Crack and hookers', notInAhlPool: true }),
    ]);
    expect(report.details.unmatchedDraftGridPlayers).toEqual([
      expect.objectContaining({
        name: 'Crack and hookers',
        owner: 'YEASTIE BEASTIES',
        position: 'C/L',
      }),
    ]);
    expect(report.validationRows).toContainEqual(expect.objectContaining({
      key: 'draft-grid-pool-membership',
      status: 'warning',
      message: 'Not found in AHL Position/Utility: Crack and hookers (YEASTIE BEASTIES)',
    }));
    expect(report.ownerDraftPlans[0]).toMatchObject({
      owner: 'YEASTIE BEASTIES',
      retainedSpend: 200,
      skaters: 1,
      unmatchedDraftPlayers: [{ name: 'Crack and hookers', position: 'C/L', cost: 200 }],
    });
  });

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
      finalPositionOverride: 'RW',
      classification: 'Rookie',
      experienceTier: 'Rookie',
      status: 'not-in-ahl',
      pricing: null,
      forecast: null,
      owner: null,
      availability: 'unavailable',
      notes: 'league correction',
      addedBy: 'Local User',
      manualOverride: true,
    });
    expect(entry.id).toContain('manual-');
    expect(entry.createdAt).toBeDefined();
    expect(createManualOverrideDraft({
      name: 'Unsupported Position',
      position: 'C/LW',
      classification: 'Rookie',
    })).toBeNull();
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
