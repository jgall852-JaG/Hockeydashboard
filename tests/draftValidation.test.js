import {
  buildDraftValidationReport,
  createManualOverrideDraft,
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
          },
        },
        prospects: {
          prospects: {
            alice: { name: 'Alice Example', owner: 'TEAM A', farm: false, termRemaining: 2, matchingRights: true },
            aliceDup: { name: 'Alice Example', owner: 'TEAM Z', farm: false, termRemaining: 1, matchingRights: false },
            missingOwner: { name: 'Needs Owner', owner: '', farm: false, termRemaining: 1, matchingRights: false },
          },
        },
        veterans: {
          veterans: {
            bob: { name: 'Bob Example', owner: 'TEAM B', currentCost: 10, retentionYear: 2026 },
            carol: { name: 'Carol Example', owner: 'TEAM B', currentCost: 20, retentionYear: null },
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
    });

    expect(report.validationHealth).toBe('error');
    expect(report.validationRows.find((row) => row.key === 'duplicate-ownership').status).toBe('error');
    expect(report.validationRows.find((row) => row.key === 'available-player-integrity').status).toBe('error');
    expect(report.validationRows.find((row) => row.key === 'retention-integrity').status).toBe('warning');
    expect(report.snapshot.status).toBe('valid');
    expect(report.availablePlayers.some((player) => player.name === 'Bob Example' && !player.manualOverride)).toBe(true);
    expect(report.availablePlayers.some((player) => player.name === 'Missing Prospect' && player.manualOverride)).toBe(true);
    expect(report.manualOverrides).toHaveLength(1);
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
});
