import { parseRoster } from '../rosterParser.js';

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
    expect(players.some((p) => p.name === 'Player One' && p.owner === 'TEAM A' && p.position === 'LW' && p.cost === 5.5)).toBe(true);
    expect(players.some((p) => p.name === 'Player Two' && p.owner === 'TEAM B' && p.position === 'D' && p.cost === 8)).toBe(true);
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
    expect(utilityPlayers.some((p) => p.name === 'Utility One' && p.position === 'U' && p.poolposition === 'C/L')).toBe(true);
  });
});
