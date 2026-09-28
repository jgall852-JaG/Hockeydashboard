import { jest } from '@jest/globals';
import { buildDraftIntelligence } from '../draftIntelligence.js';
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
          veteran: { name: 'Veteran Example', owner: 'TEAM A', nhlteam: 'AAA', position: 'C', poolposition: 'C', cost: 20 },
          rookie: { name: 'Rookie Example', owner: '', nhlteam: 'BBB', position: 'L', poolposition: 'L' },
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
    expect(veteran.production.goalProjNorm).toBeCloseTo(20 / 82 / (10 / 30));
    expect(veteran.deployment.toiNorm).toBe(1);
    expect(veteran.draftIQ).toBeNull();
    expect(veteran.auctionValue).toBeNull();
    expect(rookie.category).toBe('Rookie');
    expect(farm.category).toBe('Farm');
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
          veteran: { name: 'Veteran Example', owner: 'TEAM A', nhlteam: 'AAA', position: 'C', poolposition: 'C', cost: 20 },
        },
      },
      prospectsData: { prospects: {} },
      supplementalData: {
        players: {
          'veteran-example': {
            deployment: {
              lineWeight: 1,
              ppWeight: 1,
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
            production: { consistency: 1 },
            prospect: { ageCurve: 1, pedigree: 1, usageTrend: 1, shotGrowth: 1, opportunity: 1 },
            keeper: { ageCurve: 1, contractSecurity: 1, orgCommitment: 1, multiYearProj: 1, scarcity: 1 },
          },
        },
        rosterSlotsByPosition: { C: 1 },
        viablePlayersByPosition: { C: 1 },
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
});
