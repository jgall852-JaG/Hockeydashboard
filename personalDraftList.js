export function normalizePersonalDraftList(value) {
  if (!Array.isArray(value) || value.some((entry) => (
    !entry
    || typeof entry.playerId !== 'string'
    || !Number.isInteger(entry.rank)
    || typeof entry.notes !== 'string'
    || ['target', 'avoid', 'keeperTarget', 'breakoutTarget']
      .some((field) => entry[field] !== undefined && typeof entry[field] !== 'boolean')
    || (entry.maxBidNote !== undefined && typeof entry.maxBidNote !== 'string')
  ))) {
    throw new Error('Saved Personal Draft List data has an invalid format.');
  }
  return [...value]
    .sort((left, right) => left.rank - right.rank)
    .map((entry, index) => ({
      target: false,
      avoid: false,
      keeperTarget: false,
      breakoutTarget: false,
      maxBidNote: '',
      ...entry,
      rank: index + 1,
    }));
}

export function addPersonalDraftListEntry(entries, playerId) {
  if (!playerId || entries.some((entry) => entry.playerId === playerId)) return entries;
  return [...entries, {
    playerId,
    rank: entries.length + 1,
    notes: '',
    target: false,
    avoid: false,
    keeperTarget: false,
    breakoutTarget: false,
    maxBidNote: '',
  }];
}

export function removePersonalDraftListEntry(entries, playerId) {
  return entries
    .filter((entry) => entry.playerId !== playerId)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function updatePersonalDraftListEntry(entries, playerId, changes) {
  return entries.map((entry) => entry.playerId === playerId
    ? { ...entry, ...changes, playerId: entry.playerId }
    : entry);
}

export function setPersonalDraftListRank(entries, playerId, requestedRank) {
  const target = entries.find((entry) => entry.playerId === playerId);
  if (!target || !Number.isFinite(requestedRank)) return entries;
  const reordered = entries.filter((entry) => entry.playerId !== playerId);
  const index = Math.max(0, Math.min(reordered.length, Math.round(requestedRank) - 1));
  reordered.splice(index, 0, target);
  return reordered.map((entry, rank) => ({ ...entry, rank: rank + 1 }));
}
