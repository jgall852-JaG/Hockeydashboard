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

// Working assignments are "winning bid" dropdown entries recorded before the
// authoritative Draft 2026 / AHL Sheet owner catches up. They are keyed by
// normalized player name here so they can be matched against any player shape
// (raw AHL sheet records, decorated roster records, or Draft Intelligence
// player records).
function buildWorkingAssignmentOverrideMap(workingAssignments) {
  const overrides = new Map();
  Object.values(workingAssignments || {}).forEach((entry) => {
    const key = normalizeLookupKey(entry?.name);
    const team = String(entry?.team || '').trim();
    if (!key || !team) return;
    const cost = Number.isFinite(Number(entry?.bid)) ? Number(entry.bid) : null;
    overrides.set(key, { team, cost });
  });
  return overrides;
}

// Writes an overridden cost onto whichever cost-shaped field(s) already exist
// on the player record (prospect `cost`, veteran `currentCost`/`keeperCost`),
// so the override is visible regardless of the caller's player shape.
function buildCostPatch(player, cost) {
  if (cost === null || cost === undefined) return {};
  const hasCurrentCost = Object.prototype.hasOwnProperty.call(player, 'currentCost');
  const hasKeeperCost = Object.prototype.hasOwnProperty.call(player, 'keeperCost');
  if (hasCurrentCost || hasKeeperCost) {
    return {
      ...(hasCurrentCost ? { currentCost: cost } : {}),
      ...(hasKeeperCost ? { keeperCost: cost } : {}),
    };
  }
  return { cost };
}

export function applyLocalDraftEdits(players, availableKeys, localEdits, workingAssignments = {}) {
  const edits = normalizeLocalEdits(localEdits);
  const removed = new Set(edits.removedPlayers);
  const unassigned = new Set(edits.manualUnassign);
  const workingOverrides = buildWorkingAssignmentOverrideMap(workingAssignments);
  const nextAvailableKeys = new Set(availableKeys || []);
  const nextPlayers = (players || [])
    .map((player) => {
      if (player.status === 'not-in-ahl') return player;
      const key = normalizeLookupKey(player.name);
      const assignment = edits.manualAssignments[key];
      const hasAuthoritativeOwner = Boolean(player.owner || player.ownership);
      // Working assignments (winning bids) only fill in undrafted players;
      // once the sheet reports a real owner, that stays authoritative and any
      // disagreement is surfaced via detectLocalEditMismatches instead.
      const workingOverride = !assignment && !hasAuthoritativeOwner ? workingOverrides.get(key) : null;
      const isManuallyUnassigned = unassigned.has(key) && !assignment;
      const isRemoved = removed.has(key);
      if (assignment || workingOverride || isManuallyUnassigned || isRemoved) nextAvailableKeys.delete(key);
      if (isManuallyUnassigned && !isRemoved) nextAvailableKeys.add(key);
      return {
        ...player,
        ...(assignment ? { owner: assignment, ownership: assignment, localAssignmentTeam: assignment } : {}),
        ...(workingOverride ? {
          owner: workingOverride.team,
          ownership: workingOverride.team,
          localAssignmentTeam: workingOverride.team,
          localWorkingAssignment: true,
          ...buildCostPatch(player, workingOverride.cost),
        } : {}),
        ...(isManuallyUnassigned ? {
          owner: null,
          ownership: null,
          localAssignmentTeam: null,
          localUnassigned: true,
        } : {}),
        ...(isRemoved ? { localStatus: 'removed-local' } : {}),
        ...(isManuallyUnassigned && !isRemoved ? { available: true } : {}),
        ...(assignment || workingOverride || isRemoved ? { available: false } : {}),
      };
    });
  return { players: nextPlayers, availableKeys: nextAvailableKeys, localEdits: edits };
}

// Flags players where a local edit (manual assignment or a recorded winning
// bid) disagrees with the authoritative AHL Sheet owner for that player. Used
// after an AHL Sheet refresh to surface conflicts instead of silently
// overriding or silently discarding the local edit.
export function detectLocalEditMismatches(players, localEdits, workingAssignments = {}) {
  const edits = normalizeLocalEdits(localEdits);
  const workingOverrides = buildWorkingAssignmentOverrideMap(workingAssignments);
  const mismatches = [];
  (players || []).forEach((player) => {
    const key = normalizeLookupKey(player?.name);
    if (!key) return;
    const sheetOwner = String(player?.owner || player?.ownership || '').trim();
    if (!sheetOwner) return;
    const manualTeam = edits.manualAssignments[key];
    const workingTeam = workingOverrides.get(key)?.team;
    const localTeam = manualTeam || workingTeam;
    if (localTeam && normalizeLookupKey(sheetOwner) !== normalizeLookupKey(localTeam)) {
      mismatches.push({
        name: player.name,
        sheetOwner,
        localOwner: localTeam,
        source: manualTeam ? 'manual-assignment' : 'working-assignment',
      });
    }
  });
  return mismatches;
}
