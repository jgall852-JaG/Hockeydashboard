import {
  applyLocalDraftEdits,
  createEmptyLocalEdits,
  detectLocalEditMismatches,
  normalizeLocalEdits,
} from '../localDraftEdits.js';

describe('local draft edits', () => {
  test('normalizes removed, assigned, and unassigned player keys', () => {
    expect(normalizeLocalEdits({
      removedPlayers: [' Player One ', 'player one'],
      manualAssignments: { 'PLAYER TWO': ' Team A ' },
      manualUnassign: ['Player Three'],
    })).toEqual({
      removedPlayers: ['player one'],
      manualAssignments: { 'player two': 'Team A' },
      manualUnassign: ['player three'],
      lastUpdated: null,
    });
    expect(createEmptyLocalEdits()).toEqual({
      removedPlayers: [],
      manualAssignments: {},
      manualUnassign: [],
      lastUpdated: null,
    });
  });

  test('normalizes object-backed edits and preserves their update timestamp', () => {
    expect(normalizeLocalEdits({
      removedPlayers: { 'Player One': true, 'Player Two': false },
      manualAssignments: { 'PLAYER THREE': 'TEAM A' },
      manualUnassign: { 'Player Four': true },
      lastUpdated: 1780000000000,
    })).toEqual({
      removedPlayers: ['player one'],
      manualAssignments: { 'player three': 'TEAM A' },
      manualUnassign: ['player four'],
      lastUpdated: 1780000000000,
    });
  });

  test('local assignments override authoritative ownership without mutating AHL records', () => {
    const sourcePlayer = { id: 'owned', name: 'Owned Player', status: 'in-ahl', ownership: 'TEAM A', available: false };
    const result = applyLocalDraftEdits([sourcePlayer], new Set(), {
      manualAssignments: { 'owned player': 'TEAM B' },
      manualUnassign: ['owned player'],
    });

    expect(result.players[0]).toMatchObject({
      ownership: 'TEAM B',
      localAssignmentTeam: 'TEAM B',
      available: false,
    });
    expect(sourcePlayer.ownership).toBe('TEAM A');
  });

  test('applies local overlays while leaving AHL eligibility filtering to the merge pipeline', () => {
    const players = [
      { id: 'available', name: 'Available Player', status: 'in-ahl', ownership: null, available: true },
      { id: 'owned', name: 'Owned Player', status: 'in-ahl', ownership: 'TEAM A', available: false },
      { id: 'former', name: 'Former Player', status: 'not-in-ahl', available: false },
    ];
    const result = applyLocalDraftEdits(players, new Set(['available player']), {
      removedPlayers: ['available player'],
      manualAssignments: { 'available player': 'TEAM B' },
      manualUnassign: ['owned player'],
    });

    expect(result.players.map((player) => player.id)).toEqual(['available', 'owned', 'former']);
    expect(result.players[0]).toMatchObject({
      localStatus: 'removed-local',
      ownership: 'TEAM B',
      available: false,
    });
    expect(result.players[1]).toMatchObject({ ownership: null, available: true });
    expect(result.availableKeys.has('available player')).toBe(false);
    expect(result.availableKeys.has('owned player')).toBe(true);
  });

  test('working assignments (winning bids) fill in cost and owner only when the sheet has no owner yet', () => {
    const players = [
      { id: 'undrafted', name: 'Undrafted Player', status: 'in-ahl', ownership: null, cost: null, available: true },
      { id: 'owned', name: 'Owned Player', status: 'in-ahl', ownership: 'TEAM A', cost: 5, available: false },
    ];
    const workingAssignments = {
      w1: { name: 'Undrafted Player', team: 'TEAM C', bid: 12 },
      w2: { name: 'Owned Player', team: 'TEAM D', bid: 7 },
    };
    const result = applyLocalDraftEdits(players, new Set(['undrafted player']), createEmptyLocalEdits(), workingAssignments);

    expect(result.players[0]).toMatchObject({
      owner: 'TEAM C',
      ownership: 'TEAM C',
      cost: 12,
      localWorkingAssignment: true,
      available: false,
    });
    expect(result.availableKeys.has('undrafted player')).toBe(false);
    // Already-owned player keeps the authoritative sheet owner/cost; the working
    // assignment is not silently applied over it.
    expect(result.players[1]).toMatchObject({ ownership: 'TEAM A', cost: 5 });
    expect(result.players[1].localWorkingAssignment).toBeUndefined();
  });

  test('manual assignments still take precedence over a conflicting working assignment', () => {
    const players = [
      { id: 'undrafted', name: 'Undrafted Player', status: 'in-ahl', ownership: null, cost: null, available: true },
    ];
    const workingAssignments = { w1: { name: 'Undrafted Player', team: 'TEAM C', bid: 12 } };
    const result = applyLocalDraftEdits(players, new Set(['undrafted player']), {
      manualAssignments: { 'undrafted player': 'TEAM B' },
    }, workingAssignments);

    expect(result.players[0]).toMatchObject({ owner: 'TEAM B', ownership: 'TEAM B' });
    expect(result.players[0].localWorkingAssignment).toBeUndefined();
  });

  test('detectLocalEditMismatches flags conflicts between local edits and the sheet owner', () => {
    const players = [
      { name: 'Conflicted Player', owner: 'TEAM A' },
      { name: 'Agreeing Player', owner: 'TEAM B' },
      { name: 'Undrafted Player', owner: null },
    ];
    const mismatches = detectLocalEditMismatches(players, {
      manualAssignments: { 'conflicted player': 'TEAM Z', 'agreeing player': 'TEAM B' },
    }, {
      w1: { name: 'Undrafted Player', team: 'TEAM C' },
    });

    expect(mismatches).toEqual([
      { name: 'Conflicted Player', sheetOwner: 'TEAM A', localOwner: 'TEAM Z', source: 'manual-assignment' },
    ]);
  });

  test('detectLocalEditMismatches flags conflicting working assignments too', () => {
    const players = [{ name: 'Flipped Player', ownership: 'TEAM A' }];
    const mismatches = detectLocalEditMismatches(players, createEmptyLocalEdits(), {
      w1: { name: 'Flipped Player', team: 'TEAM Z', bid: 20 },
    });

    expect(mismatches).toEqual([
      { name: 'Flipped Player', sheetOwner: 'TEAM A', localOwner: 'TEAM Z', source: 'working-assignment' },
    ]);
  });
});
