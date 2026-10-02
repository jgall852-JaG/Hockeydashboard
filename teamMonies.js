import { getCanonicalAhlPoolOwnership } from './ahlSheetIngestion.js';
import { normalizeLookupKey } from './liveNhlApi.js';

export const MONIES_RULES = Object.freeze({
  rosterSlots: 25,
  targetSkaters: 23,
  minSlotCost: 0.5,
});

const GOALIE_TEAM_POSITIONS = new Set(['G', 'GT', 'GOALIE', 'GOALIE TEAM']);

function roundMoney(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function isGoalieTeamSlot(positions) {
  const list = (Array.isArray(positions) ? positions : String(positions || '').split(/[/,]/))
    .map((position) => String(position || '').trim().toUpperCase())
    .filter(Boolean);
  return list.length > 0 && list.every((position) => GOALIE_TEAM_POSITIONS.has(position));
}

function createTeamLedger(team, sheetBudget = null) {
  const sheetDrafted = Number.isInteger(sheetBudget?.playersDrafted) ? sheetBudget.playersDrafted : 0;
  return {
    team,
    sheetTotalSpent: finiteOrNull(sheetBudget?.totalSpent),
    sheetRemaining: finiteOrNull(sheetBudget?.remainingBudget),
    sheetPlayersDrafted: sheetDrafted,
    sheetOpenSlots: Number.isInteger(sheetBudget?.openSlots) ? sheetBudget.openSlots : null,
    sheetSkaters: sheetBudget?.skaters && Number.isFinite(sheetBudget.skaters.count)
      ? { count: sheetBudget.skaters.count, max: sheetBudget.skaters.max ?? MONIES_RULES.targetSkaters }
      : null,
    keeperCosts: finiteOrNull(sheetBudget?.keeperCosts),
    rookieFarmCosts: finiteOrNull(sheetBudget?.rookieFarmCosts),
    penalties: finiteOrNull(sheetBudget?.penalties),
    adjustments: finiteOrNull(sheetBudget?.adjustments),
    spendDelta: 0,
    slotDelta: 0,
    skaterDelta: 0,
    changes: [],
  };
}

function applyChange(ledger, { playerKey, name, cost, slots, positions, reason }) {
  ledger.spendDelta += cost;
  ledger.slotDelta += slots;
  if (!isGoalieTeamSlot(positions)) ledger.skaterDelta += slots;
  ledger.changes.push({ playerKey, name, cost: roundMoney(cost), slots, reason });
}

// Monies = Draft 2026 sheet baseline (TOTAL SPENT / BALANCE, which already
// include grid rows and farm deductions) plus every local ownership change
// resolved through the canonical AHL pool ownership layers.
export function buildTeamMonies(stateObj, ownership = getCanonicalAhlPoolOwnership(stateObj)) {
  const ledgers = new Map();
  const sheetBudgets = stateObj?.datasets?.roster?.teamBudgets || [];
  sheetBudgets.forEach((budget) => {
    const key = normalizeLookupKey(budget?.team);
    if (key && !ledgers.has(key)) ledgers.set(key, createTeamLedger(String(budget.team).trim(), budget));
  });
  const ledgerFor = (team) => {
    const key = normalizeLookupKey(team);
    if (!key) return null;
    if (!ledgers.has(key)) ledgers.set(key, createTeamLedger(String(team).trim()));
    return ledgers.get(key);
  };

  const protectedKeys = ownership?.protectedKeys || new Set();
  const unassignedKeys = ownership?.unassignedKeys || new Set();
  const assignments = ownership?.assignmentsByPlayerKey || new Map();
  const positionsFor = (playerKey, fallback) => {
    const poolPositions = ownership?.poolPositionsByPlayerKey?.get(playerKey);
    return poolPositions?.length ? poolPositions : fallback;
  };

  (ownership?.draftGridByPlayerKey || new Map()).forEach((row, playerKey) => {
    const assignment = assignments.get(playerKey);
    const positions = positionsFor(playerKey, row.position);
    if (unassignedKeys.has(playerKey) && !protectedKeys.has(playerKey)) {
      applyChange(ledgerFor(row.owner), {
        playerKey, name: row.name, cost: -row.cost, slots: -1, positions, reason: 'manual-unassign',
      });
      return;
    }
    // Recorded winning bids for grid rows are already in the sheet baseline;
    // only a manual reassignment moves a grid player's cost between teams.
    if (assignment?.source === 'manual' && normalizeLookupKey(assignment.team) !== normalizeLookupKey(row.owner)) {
      applyChange(ledgerFor(row.owner), {
        playerKey, name: row.name, cost: -row.cost, slots: -1, positions, reason: 'manual-reassign-out',
      });
      applyChange(ledgerFor(assignment.team), {
        playerKey, name: row.name, cost: row.cost, slots: 1, positions, reason: 'manual-reassign-in',
      });
    }
  });

  assignments.forEach((assignment, playerKey) => {
    if (ownership?.draftGridByPlayerKey?.has(playerKey)) return;
    applyChange(ledgerFor(assignment.team), {
      playerKey,
      name: assignment.name,
      cost: Number(assignment.bid) || 0,
      slots: 1,
      positions: positionsFor(playerKey, assignment.position),
      reason: assignment.source === 'manual' ? 'manual-assign' : 'working-assignment',
    });
  });

  const teams = [...ledgers.values()].map((ledger) => {
    const hasSheetBalance = ledger.sheetRemaining !== null;
    const spend = ledger.sheetTotalSpent !== null ? roundMoney(ledger.sheetTotalSpent + ledger.spendDelta) : null;
    const remainingBudget = hasSheetBalance ? roundMoney(ledger.sheetRemaining - ledger.spendDelta) : null;
    const playersDrafted = Math.max(0, ledger.sheetPlayersDrafted + ledger.slotDelta);
    const baselineOpenSlots = ledger.sheetOpenSlots ?? Math.max(0, MONIES_RULES.rosterSlots - ledger.sheetPlayersDrafted);
    const openSlots = Math.max(0, baselineOpenSlots - ledger.slotDelta);
    const maxBid = remainingBudget !== null && openSlots > 0
      ? roundMoney(remainingBudget - ((openSlots - 1) * MONIES_RULES.minSlotCost))
      : null;
    return {
      team: ledger.team,
      hasSheetBaseline: hasSheetBalance,
      spend,
      remainingBudget,
      playersDrafted,
      openSlots,
      skaters: ledger.sheetSkaters
        ? { count: Math.max(0, ledger.sheetSkaters.count + ledger.skaterDelta), max: ledger.sheetSkaters.max }
        : null,
      averageSpendRemaining: remainingBudget !== null && openSlots > 0 ? roundMoney(remainingBudget / openSlots) : null,
      maxBid: maxBid !== null && maxBid >= MONIES_RULES.minSlotCost ? maxBid : null,
      keeperCosts: ledger.keeperCosts,
      rookieFarmCosts: ledger.rookieFarmCosts,
      penalties: ledger.penalties,
      adjustments: ledger.adjustments,
      localSpendDelta: roundMoney(ledger.spendDelta),
      localSlotDelta: ledger.slotDelta,
      changes: ledger.changes,
    };
  });

  const mapBy = (field) => Object.fromEntries(teams.map((team) => [team.team, team[field]]));
  return {
    teams,
    teamSpendMap: mapBy('spend'),
    teamRemainingMap: mapBy('remainingBudget'),
    teamSlotMap: mapBy('openSlots'),
    teamPenaltyMap: mapBy('penalties'),
    teamAdjustmentMap: mapBy('adjustments'),
    teamMaxBidMap: mapBy('maxBid'),
    unresolvedAssignments: [...(ownership?.unresolvedAssignments || [])],
  };
}

export function findTeamMonies(monies, team) {
  const key = normalizeLookupKey(team);
  return (monies?.teams || []).find((entry) => normalizeLookupKey(entry.team) === key) || null;
}
