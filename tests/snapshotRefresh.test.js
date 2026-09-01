import { getSnapshotRefreshStatus } from '../app.js';

describe('getSnapshotRefreshStatus', () => {
  test('summarizes the latest imported snapshot across league datasets', () => {
    const summary = getSnapshotRefreshStatus({
      metadata: {
        prospects: {
          status: 'ok',
          importedAt: '2026-09-01T14:00:00.000Z',
          sourceName: 'League Prospects Snapshot.csv',
        },
        veterans: {
          status: 'ok',
          importedAt: '2026-09-01T15:30:00.000Z',
          sourceName: 'League Veterans Snapshot.csv',
        },
        roster: {
          status: 'ok',
          importedAt: '2026-09-01T13:00:00.000Z',
          sourceName: 'League Roster Snapshot.csv',
        },
        transactions: {
          status: 'empty',
        },
      },
    });

    expect(summary.datasetsLoaded).toBe(3);
    expect(summary.totalDatasets).toBe(4);
    expect(summary.completenessLabel).toBe('3/4 tabs loaded');
    expect(summary.lastUpdatedIso).toBe('2026-09-01T15:30:00.000Z');
    expect(summary.latestSourceLabel).toBe('League Veterans Snapshot.csv');
  });

  test('reports an empty snapshot cleanly', () => {
    const summary = getSnapshotRefreshStatus({ metadata: {} });

    expect(summary.datasetsLoaded).toBe(0);
    expect(summary.completenessLabel).toBe('0/4 tabs loaded');
    expect(summary.lastUpdatedIso).toBeNull();
    expect(summary.lastUpdatedLabel).toBe('Never');
    expect(summary.latestSourceLabel).toBe('—');
  });
});
