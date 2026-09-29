import {
  parseAhlBudgetSheet,
  parseMoney,
  parseRoster,
  parseSkaters,
} from '../rosterParser.js';
import { detectDatasetType } from '../app.js';

describe('roster parser multi-sheet formats', () => {
  test('parses retained-owner grid with cost and position', () => {
    const csv = [
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,Player One,LW,$5.50,1,Player Two,D,$8.00',
      ',TOTAL SPENT,,$5.50,,TOTAL SPENT,,$8.00',
    ].join('\n');

    const parsed = parseRoster(csv);
    const players = Object.values(parsed.players);

    expect(players).toHaveLength(2);
    expect(parsed.layout).toBe('retained-grid');
    expect(players.some((p) => p.name === 'Player One' && p.owner === 'TEAM A' && p.position === 'LW' && p.cost === 5.5)).toBe(true);
    expect(players.some((p) => p.name === 'Player Two' && p.owner === 'TEAM B' && p.position === 'D' && p.cost === 8)).toBe(true);
    expect(players.every((p) => p.retained)).toBe(true);
  });

  test('detects the retained sheet as roster even when it contains farm deductions', () => {
    const csv = [
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,Player One,LW,$5.50,1,Player Two,D,$8.00',
      ',TOTAL SPENT,,$5.50,,TOTAL SPENT,,$8.00',
      'F,Farm deductions,,,,,,,',
    ].join('\n');

    expect(detectDatasetType(csv)).toBe('roster');
  });

  test('reads exact team balance and farm deductions from the AHL Draft tab', () => {
    const parsed = parseRoster([
      'TEAM A,,,,TEAM B,,,',
      '#,Player Name,Pos.,Cost,#,Player Name,Pos.,Cost',
      '1,Keeper One,LW,$64.00,1,Keeper Two,D,$48.00',
      ',TOTAL SPENT,,$66.00,,TOTAL SPENT,,$50.00',
      ',BALANCE,,$184.00,,BALANCE,,$200.00',
      'F,Farm deductions,,,,,,,$2.00,,,,$2.00',
    ].join('\n'));

    expect(parsed.teamBudgets).toEqual([
      {
        team: 'TEAM A',
        retained: 66,
        totalSpent: 66,
        remainingBudget: 184,
        keeperCosts: 64,
        rookieFarmCosts: 2,
        playersDrafted: 1,
        openSlots: 24,
        skaters: { count: 1, max: 23 },
        penalties: null,
        adjustments: null,
      },
      {
        team: 'TEAM B',
        retained: 50,
        totalSpent: 50,
        remainingBudget: 200,
        keeperCosts: 48,
        rookieFarmCosts: 2,
        playersDrafted: 1,
        openSlots: 24,
        skaters: { count: 1, max: 23 },
        penalties: null,
        adjustments: null,
      },
    ]);
  });

  test('normalizes AHL Budget money and skater counts', () => {
    expect(parseMoney('$71.50')).toBe(71.5);
    expect(parseMoney(' $178.50 ')).toBe(178.5);
    expect(parseMoney('')).toBeNull();
    expect(parseSkaters('6/23')).toEqual({ count: 6, max: 23 });
    expect(parseSkaters('24/23')).toBeNull();

    expect(parseAhlBudgetSheet([
      'Owner,Retained,Remaining,Skaters',
      'TEAM A,$71.50,$178.50,6/23',
    ].join('\n')).teamBudgets).toEqual([{
      team: 'TEAM A',
      retained: 71.5,
      totalSpent: 71.5,
      remainingBudget: 178.5,
      skaters: { count: 6, max: 23 },
      playersDrafted: 6,
      openSlots: 17,
      keeperCosts: null,
      rookieFarmCosts: null,
      penalties: null,
      adjustments: null,
    }]);
  });

  test('parses inventory matrix and utility baseline', () => {
    const inventoryCsv = [
      'LEFT WING,,CENTER,,RIGHT WING,,DEFENSE,',
      'LW Guy,ANA,C Guy,ANA,RW Guy,ANA,D Guy,ANA',
    ].join('\n');
    const inventoryParsed = parseRoster(inventoryCsv);
    const inventoryPlayers = Object.values(inventoryParsed.players);
    expect(inventoryPlayers).toHaveLength(4);
    expect(inventoryPlayers.some((p) => p.name === 'LW Guy' && p.position === 'LW')).toBe(true);
    expect(inventoryPlayers.some((p) => p.name === 'C Guy' && p.position === 'C')).toBe(true);

    const utilityCsv = [
      'UTILITY,,',
      'Utility One,NYR,C/L',
      'Utility Two,PIT,R/L',
    ].join('\n');
    const utilityParsed = parseRoster(utilityCsv);
    const utilityPlayers = Object.values(utilityParsed.players);
    expect(utilityPlayers).toHaveLength(2);
    expect(inventoryParsed.layout).toBe('inventory');
    expect(utilityParsed.layout).toBe('utility');
    expect(utilityPlayers.some((p) => p.name === 'Utility One' && p.position === 'U' && p.poolposition === 'C/L')).toBe(true);
  });

  test('classifies farm rows in the league owner layout', () => {
    const csv = [
      ',TEAM A,TEAM B',
      'C,Center One,Center Two',
      'F,Farm One,Farm Two',
      ',514-555-0100,514-555-0101',
      ',Owner One,Owner Two',
      ',owner1@example.com,owner2@example.com',
    ].join('\n');

    const parsed = parseRoster(csv);
    const players = Object.values(parsed.players);

    expect(parsed.layout).toBe('league-layout');
    expect(players.find((player) => player.name === 'Farm One')).toMatchObject({
      owner: 'TEAM A',
      position: 'F',
      classification: 'Farm',
    });
    expect(players.some((player) => player.name === 'Owner One')).toBe(false);
  });
});
