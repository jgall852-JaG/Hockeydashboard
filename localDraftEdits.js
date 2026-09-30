import { normalizeLookupKey } from './liveNhlApi.js';

export function createEmptyLocalEdits() {
  return {
    removedPlayers: [],
    manualAssignments: {},
    manualUnassign: [],
    lastUpdated: null,
  };
}

function normalizePlayerKeyList(value) {
  const keys = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key)
      : [];
  return [...new Set(keys.map(normalizeLookupKey).filter(Boolean))];
}

function normalizeTimestamp(value) {
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function normalizeLocalEdits(localEdits) {
  const removedPlayers = normalizePlayerKeyList(localEdits?.removedPlayers);
  const manualUnassign = normalizePlayerKeyList(localEdits?.manualUnassign);
  const manualAssignments = Object.fromEntries(
    Object.entries(localEdits?.manualAssignments || {})
      .map(([playerKey, team]) => [normalizeLookupKey(playerKey), String(team || '').trim()])
      .filter(([playerKey, team]) => playerKey && team),
  );
  return {
    removedPlayers,
    manualAssignments,
    manualUnassign,
    lastUpdated: normalizeTimestamp(localEdits?.lastUpdated),
  };
}

export function applyLocalDraftEdits(players, availableKeys, localEdits) {
  const edits = normalizeLocalEdits(localEdits);
  const removed = new Set(edits.removedPlayers);
  const unassigned = new Set(edits.manualUnassign);
  const nextAvailableKeys = new Set(availableKeys || []);
  const nextPlayers = (players || [])
    .map((player) => {
      if (player.status === 'not-in-ahl') return player;
      const key = normalizeLookupKey(player.name);
      const assignment = edits.manualAssignments[key];
      const isManuallyUnassigned = unassigned.has(key) && !assignment;
      const isRemoved = removed.has(key);
      if (assignment || isManuallyUnassigned || isRemoved) nextAvailableKeys.delete(key);
      if (isManuallyUnassigned && !isRemoved) nextAvailableKeys.add(key);
      return {
        ...player,
        ...(assignment ? { ownership: assignment, localAssignmentTeam: assignment } : {}),
        ...(isManuallyUnassigned ? {
          ownership: null,
          localAssignmentTeam: null,
          localUnassigned: true,
        } : {}),
        ...(isRemoved ? { localStatus: 'removed-local' } : {}),
        ...(isManuallyUnassigned && !isRemoved ? { available: true } : {}),
        ...(assignment || isRemoved ? { available: false } : {}),
      };
    });
  return { players: nextPlayers, availableKeys: nextAvailableKeys, localEdits: edits };
}
