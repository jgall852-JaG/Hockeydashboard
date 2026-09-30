import {
  applyLocalDraftEdits,
  createEmptyLocalEdits,
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
});
