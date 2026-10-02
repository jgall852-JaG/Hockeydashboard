import { buildCanonicalAhlPool, serializeCanonicalAhlPool } from '../ahlSheetIngestion.js';
import { buildTeamMonies, findTeamMonies } from '../teamMonies.js';
import { rebuildDraftState } from '../app.js';

function sheetBudget(team, totalSpent, remainingBudget, playersDrafted, extra = {}) {
  return {
    team,
    totalSpent,
    remainingBudget,
    playersDrafted,
    openSlots: 25 - playersDrafted,
    skaters: { count: playersDrafted, max: 23 },
    ...extra,
  };
}

function buildState({ workingAssignments = {}, localEdits = {}, teamBudgets } = {}) {
  const pool = buildCanonicalAhlPool([
    { name: 'Grid Pick', position: 'C', nhlteam: 'AAA' },
    { name: 'Keeper Prospect', position: 'D', nhlteam: 'BBB' },
    { name: 'Free Agent', position: 'LW', nhlteam: 'CCC' },
    { name: 'Second Agent', position: 'RW', nhlteam: 'DDD' },
  ]);
  return {
    metadata: {},
    datasets: {
      ahlPool: serializeCanonicalAhlPool(pool),
      prospects: { prospects: { keeper: { name: 'Keeper Prospect', owner: 'TEAM A' } } },
      roster: {
        teamBudgets: teamBudgets || [
          sheetBudget('TEAM A', 100, 150, 10),
          sheetBudget('TEAM B', 50, 200, 5, { penalties: 2, adjustments: -1 }),
        ],
        sources: { 'retained-grid': { players: {
          grid: { name: 'Grid Pick', owner: 'TEAM A', cost: 20, position: 'C' },
          keeper: { name: 'Keeper Prospect', owner: 'TEAM A', cost: 3, position: 'D' },
        } } },
      },
    },
    workingAssignments,
    localEdits: { removedPlayers: [], manualAssignments: {}, manualUnassign: [], ...localEdits },
  };
}

describe('team Monies', () => {
  test('passes the Draft 2026 sheet baseline through when there are no local ownership changes', () => {
    const monies = buildTeamMonies(buildState());
    const teamA = findTeamMonies(monies, 'team a');

    expect(teamA).toMatchObject({
      hasSheetBaseline: true,
      spend: 100,
      remainingBudget: 150,
      playersDrafted: 10,
      openSlots: 15,
      maxBid: 143,
      localSpendDelta: 0,
    });
    expect(monies.teamSpendMap).toEqual({ 'TEAM A': 100, 'TEAM B': 50 });
    expect(monies.teamRemainingMap).toEqual({ 'TEAM A': 150, 'TEAM B': 200 });
    expect(monies.teamSlotMap).toEqual({ 'TEAM A': 15, 'TEAM B': 20 });
    expect(monies.teamMaxBidMap).toEqual({ 'TEAM A': 143, 'TEAM B': 190.5 });
    expect(monies.teamPenaltyMap).toEqual({ 'TEAM A': null, 'TEAM B': 2 });
    expect(monies.teamAdjustmentMap).toEqual({ 'TEAM A': null, 'TEAM B': -1 });
  });

  test('reports null remaining and max bid when the sheet balance is missing', () => {
    const monies = buildTeamMonies(buildState({
      teamBudgets: [{ team: 'TEAM A', totalSpent: null, remainingBudget: null, playersDrafted: 10 }],
    }));
    expect(findTeamMonies(monies, 'TEAM A')).toMatchObject({
      hasSheetBaseline: false,
      remainingBudget: null,
      maxBid: null,
    });
  });

  test('charges a working bid on a non-grid pool player and never double-counts a grid row bid', () => {
    const monies = buildTeamMonies(buildState({
      workingAssignments: {
        free: { name: 'Free Agent', team: 'TEAM B', bid: 12, position: 'LW' },
        grid: { name: 'Grid Pick', team: 'TEAM A', bid: 20, position: 'C' },
      },
    }));

    expect(monies.teamSpendMap['TEAM B']).toBe(62);
    expect(monies.teamRemainingMap['TEAM B']).toBe(188);
    expect(monies.teamSlotMap['TEAM B']).toBe(19);
    expect(monies.teamMaxBidMap['TEAM B']).toBe(179);
    expect(monies.teamRemainingMap['TEAM A']).toBe(150);
    expect(findTeamMonies(monies, 'TEAM A').changes).toEqual([]);
  });

  test('moves grid cost and slot when a grid player is manually reassigned to another team', () => {
    const monies = buildTeamMonies(buildState({
      localEdits: { manualAssignments: { 'Grid Pick': 'TEAM B' } },
    }));

    expect(findTeamMonies(monies, 'TEAM A')).toMatchObject({ spend: 80, remainingBudget: 170, openSlots: 16 });
    expect(findTeamMonies(monies, 'TEAM B')).toMatchObject({ spend: 70, remainingBudget: 180, openSlots: 19 });
  });

  test('manual assign of a non-grid player uses a slot without charging money', () => {
    const monies = buildTeamMonies(buildState({
      localEdits: { manualAssignments: { 'Second Agent': 'TEAM A' } },
    }));
    expect(findTeamMonies(monies, 'TEAM A')).toMatchObject({ spend: 100, remainingBudget: 150, openSlots: 14 });
  });

  test('manual unassign refunds a draft-grid pick but never a protected keeper', () => {
    const monies = buildTeamMonies(buildState({
      localEdits: { manualUnassign: ['Grid Pick', 'Keeper Prospect'] },
    }));
    const teamA = findTeamMonies(monies, 'TEAM A');

    expect(teamA).toMatchObject({ spend: 80, remainingBudget: 170, playersDrafted: 9, openSlots: 16 });
    expect(teamA.changes.map((change) => change.reason)).toEqual(['manual-unassign']);
  });

  test('excludes assignments outside the canonical pool and reports them', () => {
    const monies = buildTeamMonies(buildState({
      workingAssignments: { ghost: { name: 'Not In Pool', team: 'TEAM B', bid: 30 } },
    }));
    expect(monies.teamRemainingMap['TEAM B']).toBe(200);
    expect(monies.unresolvedAssignments).toEqual([{ name: 'Not In Pool', team: 'TEAM B', source: 'working' }]);
  });

  test('the unified rebuild pipeline stores Monies and feeds the validation report', () => {
    const state = buildState({
      workingAssignments: { free: { name: 'Free Agent', team: 'TEAM B', bid: 12 } },
    });
    const { monies, report, availableKeys } = rebuildDraftState(state);

    expect(state.datasets.monies).toBe(monies);
    expect(report.monies).toBe(monies);
    expect([...availableKeys]).toEqual(['second agent']);
    expect(monies.teamRemainingMap['TEAM B']).toBe(188);

    state.workingAssignments = {};
    const after = rebuildDraftState(state);
    expect(after.monies.teamRemainingMap['TEAM B']).toBe(200);
    expect([...after.availableKeys].sort()).toEqual(['free agent', 'second agent']);
  });
});
