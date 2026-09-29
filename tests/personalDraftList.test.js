import {
  addPersonalDraftListEntry,
  normalizePersonalDraftList,
  removePersonalDraftListEntry,
  setPersonalDraftListRank,
  updatePersonalDraftListEntry,
} from '../personalDraftList.js';

describe('Personal Draft List', () => {
  test('loads valid saved entries in rank order and normalizes ranks', () => {
    expect(normalizePersonalDraftList([
      { playerId: 'second', rank: 8, notes: 'watch' },
      { playerId: 'first', rank: 2, notes: '' },
    ])).toEqual([
      { playerId: 'first', rank: 1, notes: '' },
      { playerId: 'second', rank: 2, notes: 'watch' },
    ]);
  });

  test('adds once, supports manual reorder and notes, and removes with compact ranks', () => {
    let entries = addPersonalDraftListEntry([], 'one');
    entries = addPersonalDraftListEntry(entries, 'two');
    entries = addPersonalDraftListEntry(entries, 'one');
    entries = updatePersonalDraftListEntry(entries, 'two', { notes: 'track role' });
    entries = setPersonalDraftListRank(entries, 'two', 1);

    expect(entries).toEqual([
      { playerId: 'two', rank: 1, notes: 'track role' },
      { playerId: 'one', rank: 2, notes: '' },
    ]);
    expect(removePersonalDraftListEntry(entries, 'two')).toEqual([
      { playerId: 'one', rank: 1, notes: '' },
    ]);
  });

  test('rejects malformed saved data instead of silently changing it', () => {
    expect(() => normalizePersonalDraftList([{ playerId: 'one', rank: '1', notes: '' }]))
      .toThrow('Saved Personal Draft List data has an invalid format.');
  });
});
