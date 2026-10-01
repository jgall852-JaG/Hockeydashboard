import {
  buildUnifiedPlayer,
  computeOwnerAggregates,
  computeOwnerStatistics,
} from '../app.js';

describe('buildUnifiedPlayer', () => {
  test('builds the unified shape for an undrafted prospect with no live context', () => {
    const prospect = {
      name: 'Rookie McProspect',
      cost: 12.5,
      termRemaining: 2,
      farm: true,
      matchingRights: false,
    };

    const unified = buildUnifiedPlayer(prospect);

    expect(unified).toMatchObject({
      name: 'Rookie McProspect',
      availability: 'Available',
      draftStatus: 'Undrafted',
      cost: 12.5,
      years: 2,
      farmStatus: true,
      nhlProfile: null,
      dobberProjection: null,
      avgCost: 'NA',
      minCost: 'NA',
      maxCost: 'NA',
      yearsDrafted: 'NA',
    });
    expect(unified.experienceTier).toBe('Veteran');
  });

  test('marks owned players as unavailable/drafted and maps veteran cost fields', () => {
    const veteran = {
      name: 'Vet Erans',
      owner: 'Team A',
      currentCost: 40,
      retentionYear: 2026,
    };

    const unified = buildUnifiedPlayer(veteran);

    expect(unified.availability).toBe('Unavailable');
    expect(unified.draftStatus).toBe('Drafted');
    expect(unified.cost).toBe(40);
    expect(unified.years).toBe(2026);
    expect(unified.farmStatus).toBe(false);
  });

  test('applies GP-based experience tiers from snapshot games played', () => {
    expect(buildUnifiedPlayer({ name: 'Farm', nhlCareerGamesPlayed: 5 }).experienceTier).toBe('Farm');
    expect(buildUnifiedPlayer({ name: 'Rookie', nhlCareerGamesPlayed: 50 }).experienceTier).toBe('Rookie');
    expect(buildUnifiedPlayer({ name: 'Vet', nhlCareerGamesPlayed: 200 }).experienceTier).toBe('Veteran');
    expect(buildUnifiedPlayer({ name: 'Unknown GP' }).experienceTier).toBe('Veteran');
  });

  test('attaches a non-null nhlProfile once GP is known from a live profile', () => {
    const unified = buildUnifiedPlayer(
      { name: 'Live Profile Player' },
      { liveProfile: { historical: { gamesPlayed: 120, goals: 30, assists: 40, points: 70, shots: 150, avgToi: '18:00' } } },
    );

    expect(unified.nhlProfile).toEqual({
      gamesPlayed: 120,
      goals: 30,
      assists: 40,
      points: 70,
      shots: 150,
      avgToi: '18:00',
      tier: 'Veteran',
    });
  });

  test('attaches a dobberProjection only when the matched draft player has a forecast', () => {
    const forecast = {
      projectedPoints: 60,
      projectedGames: 80,
      projectedShots: 200,
      FHPPG: 0.7,
      SHPPG: 0.8,
      compositeScore: 75,
    };

    expect(buildUnifiedPlayer({ name: 'No Forecast' }).dobberProjection).toBeNull();
    expect(buildUnifiedPlayer({ name: 'Has Forecast' }, { draftPlayer: { forecast } }).dobberProjection)
      .toEqual(forecast);
  });

  test('attaches historical bid stats when a bundle is supplied, falling back to NA otherwise', () => {
    const bundle = {
      players: {
        'historical player': {
          avgCost: 10, minCost: 8, maxCost: 12, yearsDrafted: [2024, 2025],
        },
      },
    };

    const matched = buildUnifiedPlayer({ name: 'Historical Player' }, { historicalBidsBundle: bundle });
    expect(matched).toMatchObject({ avgCost: 10, minCost: 8, maxCost: 12, yearsDrafted: [2024, 2025] });

    const unmatched = buildUnifiedPlayer({ name: 'Nobody Drafted Me' }, { historicalBidsBundle: bundle });
    expect(unmatched).toMatchObject({ avgCost: 'NA', minCost: 'NA', maxCost: 'NA', yearsDrafted: 'NA' });
  });

  test('returns null for a missing player', () => {
    expect(buildUnifiedPlayer(null)).toBeNull();
  });
});

describe('Tools & Validation team summary logic', () => {
  test('computeOwnerStatistics derives prospect cost totals from the unified player cost field', () => {
    const ownerEntry = {
      prospects: [
        { name: 'P1', cost: 10 },
        { name: 'P2', cost: 20 },
      ],
      veterans: [{ name: 'V1' }],
      farmPlayers: [],
      matchingRights: [],
    };

    const stats = computeOwnerStatistics(ownerEntry);

    expect(stats.prospectCount).toBe(2);
    expect(stats.veteranCount).toBe(1);
    expect(stats.totalProspectCost).toBe(30);
    expect(stats.averageProspectCost).toBe(15);
    expect(stats.highestCostProspect).toMatchObject({ name: 'P2', cost: 20 });
  });

  test('computeOwnerAggregates uses unified farmStatus when counting farm players', () => {
    const stateObj = {
      datasets: {
        prospects: {
          prospects: {
            p1: { name: 'Farm Guy', owner: 'Team A', farm: true, cost: 5 },
            p2: { name: 'Non Farm Guy', owner: 'Team A', farm: false, cost: 8 },
          },
        },
        veterans: { veterans: {} },
      },
    };

    const aggregates = computeOwnerAggregates(stateObj);

    expect(aggregates.ownerAggregates['Team A'].farmCount).toBe(1);
    expect(aggregates.ownerAggregates['Team A'].totalProspectCost).toBe(13);
  });
});
