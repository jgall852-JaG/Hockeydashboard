import { jest } from '@jest/globals';
import { buildDraftIntelligence, calculateRecommendedMaxBid } from '../draftIntelligence.js';
import { loadDraftIntelligenceFiles } from '../app.js';

const statsCsv = [
  'playerId,season,name,team,position,situation,games_played,icetime,I_F_goals,I_F_primaryAssists,I_F_secondaryAssists,I_F_shotsOnGoal',
  '1,2025,Veteran Example,AAA,C,all,82,100000,20,30,15,200',
  '1,2025,Veteran Example,AAA,C,5on4,82,12000,5,8,3,40',
  '2,2025,Rookie Example,BBB,LW,all,30,30000,10,10,5,100',
  '2,2025,Rookie Example,BBB,LW,5on4,30,5000,2,3,1,20',
].join('\n');

describe('partial Draft Intelligence generation', () => {
  test('uses NHL stats and league data while keeping unsupported scores unpriced', () => {
    const output = buildDraftIntelligence({
      generatedAt: '2026-09-28T00:00:00.000Z',
      leagueImportedAt: '2026-09-27T00:00:00.000Z',
      nhlStatsCsv: statsCsv,
      rosterData: {
        players: {
          veteran: { name: 'Veteran Example', owner: 'TEAM A', nhlteam: 'AAA', position: 'C', poolposition: 'C', classification: 'Veteran', cost: 20 },
          rookie: { name: 'Rookie Example', owner: '', nhlteam: 'BBB', position: 'L', poolposition: 'L', classification: 'Rookie' },
          farm: { name: 'Farm Example', owner: '', nhlteam: 'CCC', position: 'D', poolposition: 'D' },
          expired: { name: 'Expired Rights', owner: '', nhlteam: 'DDD', position: 'R', poolposition: 'R' },
        },
      },
      prospectsData: {
        prospects: {
          farm: { name: 'Farm Example', owner: 'TEAM B', farm: true, termRemaining: null, matchingRights: true },
          expired: { name: 'Expired Rights', owner: '', farm: false, termRemaining: 0, matchingRights: true },
        },
      },
    });

    const players = output['players.json'].players;
    const veteran = players.find((player) => player.name === 'Veteran Example');
    const rookie = players.find((player) => player.name === 'Rookie Example');
    const farm = players.find((player) => player.name === 'Farm Example');

    expect(veteran.category).toBe('Veteran');
    expect(veteran.seasonStats.fantasyPoints).toBe(42.5);
    expect(veteran.production.goalProjNorm).toBeNull();
    expect(veteran.deployment.toiNorm).toBeNull();
    expect(veteran.draftIQ).toBeNull();
    expect(veteran.auctionValue).toBeNull();
    expect(veteran.recommendedMaxBid).toBeNull();
    expect(veteran.classification).toBe('UNPRICED');
    expect(veteran.sourcesUsed.AHLSheets).toBe(true);
    expect(veteran.sourcesUsed.DobberExcel).toBe(false);
    expect(veteran.missingSources.DobberExcel).toBe(true);
    expect(rookie.category).toBe('Rookie');
    expect(farm.category).toBe('Farm');
    expect(farm.classification).toBe('UNPRICED');
    expect(farm.sourcesUsed.AHLSheets).toBe(true);
    expect(farm.missingSources['AHLSheets metric inputs']).toBe(true);
    expect(farm.missingSources['Position scarcity rules']).toBe(true);
    expect(output['players.json'].sourceAvailability.AHLSheets).toBe(true);
    expect(output['players.json'].sourceCoverage.ahlSheets.rosterRecords).toBe(4);
    expect(output['auction.json'].pricedPlayerCount).toBe(0);
    expect(output['tiers.json'].unpricedPlayerIds).toHaveLength(4);
    expect(output['keepers.json'].keepers).toHaveLength(2);
    expect(output['prospects.json'].prospects[0].activeRookieEligible).toBe(false);
    expect(players.find((player) => player.name === 'Expired Rights').available).toBe(false);
  });

  test('rejects NHL CSV files missing required fields', () => {
    expect(() => buildDraftIntelligence({
      rosterData: { players: {} },
      prospectsData: { prospects: {} },
      nhlStatsCsv: 'name,season\nExample,2025',
    })).toThrow('NHL stats CSV is missing columns');
  });

  test('loads all static engine outputs and reports missing files', async () => {
    const fetchImpl = jest.fn(async (url) => ({
      ok: true,
      json: async () => ({ name: url }),
    }));
    const files = await loadDraftIntelligenceFiles(fetchImpl);

    expect(Object.keys(files)).toEqual(['players', 'auction', 'tiers', 'keepers', 'prospects']);
    expect(fetchImpl).toHaveBeenCalledTimes(5);

    await expect(loadDraftIntelligenceFiles(async () => ({
      ok: false,
      status: 404,
    }))).rejects.toThrow('Unable to load Draft Intelligence players.json (404).');
  });

  test('applies the score, category multiplier, scarcity, price curve, and tier formulas when inputs exist', () => {
    const output = buildDraftIntelligence({
      generatedAt: '2026-09-28T00:00:00.000Z',
      nhlStatsCsv: statsCsv,
      rosterData: {
        players: {
          veteran: { name: 'Veteran Example', owner: 'TEAM A', nhlteam: 'AAA', position: 'C', poolposition: 'C', classification: 'Veteran', cost: 20 },
        },
      },
      prospectsData: { prospects: {} },
      supplementalData: {
        players: {
          'veteran-example': {
            deployment: {
              lineWeight: 1,
              ppWeight: 1,
              toiNorm: 1,
              ppToiNorm: 1,
              lineStability: 1,
              ppStability: 1,
              injuryRisk: 0,
              depthSafety: 1,
              gamesNorm: 1,
              opponentWeakness: 1,
              homeBoost: 1,
              restFactor: 1,
              SHreg: 0,
              PDOreg: 0,
              usageDrop: 0,
              ageDecline: 0,
            },
            production: {
              goalProjNorm: 1,
              assistProjNorm: 1,
              shotNorm: 1,
              ppUsageNorm: 1,
              consistency: 1,
            },
            prospect: { ageCurve: 1, pedigree: 1, usageTrend: 1, shotGrowth: 1, opportunity: 1 },
            keeper: { ageCurve: 1, contractSecurity: 1, orgCommitment: 1, multiYearProj: 1, scarcity: 1 },
          },
        },
        rosterSlotsByPosition: { C: 1 },
        viablePlayersByPosition: { C: 1 },
      },
      sourceAvailability: {
        AHLSheets: true,
        DobberExcel: true,
      },
    });
    const player = output['players.json'].players[0];

    expect(player.deployment.DS).toBe(100);
    expect(player.deployment.RSS).toBe(100);
    expect(player.deployment.OS).toBe(100);
    expect(player.production.PPS).toBe(100);
    expect(player.prospect.BPS).toBe(100);
    expect(player.keeper.KVS).toBe(100);
    expect(player.draftIQ).toBe(90);
    expect(player.adjustedDraftIQ).toBeCloseTo(92.7);
    expect(player.scarcityMultiplier).toBe(1.2);
    expect(player.keeperInflation).toBe(1.08);
    expect(player.auctionValue).toBeCloseTo(36.04176);
    expect(player.tier).toBe(2);
    expect(output['tiers.json'].tiers[2]).toEqual(['veteran-example']);
  });

  test('subtracts regression risk and keeps insights tied to ingested sources', () => {
    const output = buildDraftIntelligence({
      generatedAt: '2026-09-28T00:00:00.000Z',
      nhlStatsCsv: statsCsv,
      rosterData: { players: { veteran: { name: 'Veteran Example', nhlteam: 'AAA', position: 'C', poolposition: 'C', classification: 'Veteran' } } },
      prospectsData: { prospects: {} },
      supplementalData: {
        players: {
          'veteran-example': {
            deployment: {
              lineWeight: 1, ppWeight: 1, toiNorm: 1, ppToiNorm: 1,
              lineStability: 1, ppStability: 1, injuryRisk: 0, depthSafety: 1,
              gamesNorm: 1, opponentWeakness: 1, homeBoost: 1, restFactor: 1,
              SHreg: 1, PDOreg: 1, usageDrop: 1, ageDecline: 1,
            },
            production: { goalProjNorm: 1, assistProjNorm: 1, shotNorm: 1, ppUsageNorm: 1, consistency: 1 },
            prospect: { ageCurve: 1, pedigree: 1, usageTrend: 1, shotGrowth: 1, opportunity: 1 },
            keeper: { ageCurve: 1, contractSecurity: 1, orgCommitment: 1, multiYearProj: 1, scarcity: 1 },
          },
        },
      },
      sourceAvailability: {
        AHLSheets: true, DobberExcel: true,
      },
    });
    const player = output['players.json'].players[0];
    expect(player.deployment.RRS).toBe(100);
    expect(player.draftIQ).toBe(80);
    expect(player.adjustedDraftIQ).toBeCloseTo(80.8);
    expect(player.risks).toContain('High regression risk');
  });

  test('clamps DraftIQ and adjusted DraftIQ to the 0-100 score range', () => {
    const output = buildDraftIntelligence({
      nhlStatsCsv: statsCsv,
      rosterData: { players: { veteran: { name: 'Veteran Example', position: 'C', poolposition: 'C', classification: 'Veteran' } } },
      prospectsData: { prospects: {} },
      supplementalData: {
        players: {
          'veteran-example': {
            deployment: {
              lineWeight: 0, ppWeight: 0, toiNorm: 0, ppToiNorm: 0,
              lineStability: 0, ppStability: 0, injuryRisk: 0, depthSafety: 0,
              gamesNorm: 0, opponentWeakness: 0, homeBoost: 0, restFactor: 0,
              SHreg: 1, PDOreg: 1, usageDrop: 1, ageDecline: 1,
            },
            production: { goalProjNorm: 0, assistProjNorm: 0, shotNorm: 0, ppUsageNorm: 0, consistency: 0 },
            prospect: { ageCurve: 0, pedigree: 0, usageTrend: 0, shotGrowth: 0, opportunity: 0 },
            keeper: { ageCurve: 0, contractSecurity: 0, orgCommitment: 0, multiYearProj: 0, scarcity: 0 },
          },
        },
      },
      sourceAvailability: {
        AHLSheets: true, DobberExcel: true,
      },
    });

    expect(output['players.json'].players[0].draftIQ).toBe(0);
    expect(output['players.json'].players[0].adjustedDraftIQ).toBe(0);
  });

  test('rejects source availability flags that are not in the source registry', () => {
    expect(() => buildDraftIntelligence({
      rosterData: { players: {} },
      prospectsData: { prospects: {} },
      nhlStatsCsv: statsCsv,
      sourceAvailability: { UnregisteredSource: true },
    })).toThrow('Unknown source availability flag: UnregisteredSource.');
  });

  test('does not price players when authoritative AHL Sheets are unavailable', () => {
    const output = buildDraftIntelligence({
      nhlStatsCsv: statsCsv,
      rosterData: { players: { veteran: { name: 'Veteran Example', position: 'C', poolposition: 'C' } } },
      prospectsData: { prospects: {} },
      supplementalData: {
        players: {
          'veteran-example': {
            deployment: {
              lineWeight: 1, ppWeight: 1, toiNorm: 1, ppToiNorm: 1,
              lineStability: 1, ppStability: 1, injuryRisk: 0, depthSafety: 1,
              gamesNorm: 1, opponentWeakness: 1, homeBoost: 1, restFactor: 1,
              SHreg: 0, PDOreg: 0, usageDrop: 0, ageDecline: 0,
            },
            production: { goalProjNorm: 1, assistProjNorm: 1, shotNorm: 1, ppUsageNorm: 1, consistency: 1 },
            prospect: { ageCurve: 1, pedigree: 1, usageTrend: 1, shotGrowth: 1, opportunity: 1 },
            keeper: { ageCurve: 1, contractSecurity: 1, orgCommitment: 1, multiYearProj: 1, scarcity: 1 },
          },
        },
        rosterSlotsByPosition: { C: 1 },
        viablePlayersByPosition: { C: 1 },
      },
      sourceAvailability: {
        AHLSheets: false,
        DobberExcel: true,
      },
    });
    const player = output['players.json'].players[0];

    expect(output['players.json'].sourceAvailability.AHLSheets).toBe(false);
    expect(player.adjustedDraftIQ).toBeNull();
    expect(player.auctionValue).toBeNull();
    expect(player.missingSources.AHLSheets).toBe(true);
  });

  test('caps max bids to budget after reserving minimum bids for open slots', () => {
    expect(calculateRecommendedMaxBid(30, 2, 100, 2)).toBe(36);
    expect(calculateRecommendedMaxBid(60, 1, 1.75, 2)).toBe(1);
    expect(calculateRecommendedMaxBid(null, 1, 100, 2)).toBeNull();
    expect(calculateRecommendedMaxBid(60, 6, 100, 2)).toBeNull();
  });
});
