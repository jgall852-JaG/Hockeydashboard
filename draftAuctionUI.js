import { calculateRecommendedMaxBid } from './draftIntelligence.js';
import { normalizeLookupKey } from './liveNhlApi.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const money = (value) => Number.isFinite(value) ? `$${value.toFixed(2)}` : 'NULL';

export function getExperienceTierFromGames(gamesPlayed) {
  if (gamesPlayed === null || gamesPlayed === undefined) return 'Veteran';
  const games = gamesPlayed === '' ? NaN : Number(gamesPlayed);
  if (!Number.isInteger(games) || games < 0) return 'Unknown';
  if (games < 10) return 'Farm';
  return games <= 82 ? 'Rookie' : 'Veteran';
}

function getAhlPlayerPositions(player) {
  const finalPosition = String(player.finalPosition || '')
    .split(/[\/,\s]+/)
    .filter(Boolean)
    .map((position) => {
      if (position === 'L') return 'LW';
      if (position === 'R') return 'RW';
      if (position === 'LD' || position === 'RD') return 'D';
      return position;
    });
  return [...new Set(finalPosition)];
}

function renderPlayerRows(players, availableKeys, personalDraftList, {
  kind = 'board',
  emptyMessage = 'No matching players.',
  highlightUnavailable = false,
} = {}) {
  if (!players.length) {
    const colspan = 6;
    return `<tr><td colspan="${colspan}" class="empty-state">${escapeHtml(emptyMessage)}</td></tr>`;
  }
  return players.map((player) => {
    const isAvailable = player.status !== 'not-in-ahl'
      && player.localStatus !== 'removed-local'
      && availableKeys.has(normalizeLookupKey(player.name));
    const isPersonal = personalDraftList.some((entry) => entry.playerId === player.id);
    const removed = player.localStatus === 'removed-local';
    const unavailable = highlightUnavailable
      && !removed
      && player.status === 'in-ahl'
      && !isAvailable
      && !player.ownership;
    const rowClasses = [removed ? 'removed-local' : '', unavailable ? 'ahl-unavailable' : ''].filter(Boolean).join(' ');
    const finalPosition = player.finalPosition || player.finalPositionOverride || 'NULL';
    if (kind === 'best-available') {
      const forecastValue = (value) => Number.isFinite(value) ? value : 'NULL';
      const detailsId = player.poolOnly ? '' : player.id;
      return `<tr class="${rowClasses}" data-player-status="${escapeHtml(player.status || '')}">
        <td>${detailsId
    ? `<button type="button" class="link-button" data-player-details="${escapeHtml(detailsId)}">${escapeHtml(player.name)}</button>
          <button type="button" class="secondary personal-list-toggle" data-personal-add="${escapeHtml(detailsId)}" ${isPersonal ? 'disabled aria-disabled="true"' : ''}>${isPersonal ? 'In List' : 'Add to Personal List'}</button>`
    : `<span data-pool-player="${escapeHtml(player.id)}">${escapeHtml(player.name)}</span>`}</td>
        <td>${escapeHtml(finalPosition)}</td>
        <td>${forecastValue(player.forecastedGoals)}</td>
        <td>${forecastValue(player.forecastedAssists)}</td>
        <td>${forecastValue(player.forecastedPoints)}</td>
        <td>${forecastValue(player.draftIQv2)}</td>
        <td>${forecastValue(player.draftIQv3)}</td>
      </tr>`;
    }
    return `<tr class="${rowClasses}" data-player-status="${escapeHtml(player.status || '')}">
      <td><button type="button" class="link-button" data-player-details="${escapeHtml(player.id)}">${escapeHtml(player.name)}</button></td>
      <td>${escapeHtml(finalPosition)}</td>
      <td>${getExperienceTierFromGames(player.nhlCareerGamesPlayed)}</td>
      <td>${escapeHtml(player.draftOwner)}</td>
      <td>${Number.isFinite(player.draftPrice) ? money(player.draftPrice) : 'UNPRICED'}</td>
      <td><button type="button" class="secondary" ${removed
    ? `data-undo-player="${escapeHtml(player.id)}">Undo remove`
    : `data-remove-player="${escapeHtml(player.id)}">Remove locally`}</button></td>
    </tr>`;
  }).join('');
}

function renderPlayerTable(players, availableKeys, personalDraftList, options = {}) {
  const normalizedOptions = { kind: 'board', ...options };
  const headers = normalizedOptions.kind === 'best-available'
    ? ['Player', 'Final Position', 'Forecasted Goals', 'Forecasted Assists', 'Forecasted Points', 'DraftIQ', 'DraftIQ v3']
    : ['Player', 'Final Position', 'Experience Tier', 'Owner', 'Auction Value', 'Remove Locally'];
  return `<div class="table-wrap"><table class="validation-table">
    <thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead>
    <tbody>${renderPlayerRows(players, availableKeys, personalDraftList, normalizedOptions)}</tbody>
  </table></div>`;
}

function renderTeamBudgets(teamBudgets) {
  const rows = teamBudgets.map((team) => `<tr>
    <td>${escapeHtml(team.team)}</td>
    <td>${money(team.totalSpent)}</td>
    <td>${money(team.remainingBudget)}</td>
    <td>${team.skaters ? `${team.skaters.count}/${team.skaters.max}` : 'NULL'}</td>
    <td>${team.playersDrafted}</td>
    <td>${team.openSlots}</td>
    <td>${money(team.averageSpendRemaining)}</td>
    <td>${money(team.maxPossibleBid)}</td>
    <td>${money(team.keeperCosts)}</td>
    <td>${money(team.rookieCosts)}</td>
    <td>${money(team.farmCosts)}</td>
    <td>${money(team.draftCosts)}</td>
    <td>${money(team.penalties)}</td>
    <td>${money(team.adjustments)}</td>
  </tr>`).join('');
  return `<div class="table-wrap"><table class="validation-table">
    <thead><tr><th>Team</th><th>Total Spent</th><th>Budget Remaining</th><th>Skaters</th><th>Players Drafted</th><th>Open Slots</th><th>Avg Spend Remaining</th><th>Max Possible Bid</th><th>Keeper Costs</th><th>Rookie Costs</th><th>Farm Costs</th><th>Auction Costs</th><th>Penalties</th><th>Adjustments</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="14" class="empty-state">No AHL Draft budget data is available.</td></tr>'}</tbody>
  </table></div>`;
}

function renderPersonalDraftList(players, entries, availableKeys, { sort, positionFilter, categoryFilter, availabilityFilter }) {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const allPositions = [...new Set(players.flatMap(getAhlPlayerPositions))].sort();
  const selected = (value, current) => value === current ? 'selected' : '';
  const rows = entries
    .map((entry) => ({ entry, player: playersById.get(entry.playerId) || null }))
    .filter(({ player }) => {
      const isAvailable = Boolean(player && availableKeys.has(normalizeLookupKey(player.name)));
      return (!positionFilter || (player && getAhlPlayerPositions(player).includes(positionFilter)))
        && (!categoryFilter || player?.category === categoryFilter)
        && (availabilityFilter === 'all'
          || (availabilityFilter === 'available' ? isAvailable : !isAvailable));
    })
    .sort((left, right) => {
      if (sort === 'name') return (left.player?.name || left.entry.playerId).localeCompare(right.player?.name || right.entry.playerId);
      if (sort === 'position') return (left.player?.finalPosition || left.player?.utilityPosition || left.player?.ahlPosition || left.player?.position || '').localeCompare(right.player?.finalPosition || right.player?.utilityPosition || right.player?.ahlPosition || right.player?.position || '');
      if (sort === 'team') return (left.player?.team || '').localeCompare(right.player?.team || '');
      return left.entry.rank - right.entry.rank;
    });
  const rowMarkup = rows.map(({ entry, player }) => {
    const name = player?.name || `${entry.playerId} (not in current AHL inventory)`;
    const isAvailable = Boolean(player && availableKeys.has(normalizeLookupKey(player.name)));
    return `<tr>
      <td><input aria-label="Rank for ${escapeHtml(name)}" type="number" min="1" max="${entries.length}" step="1" value="${entry.rank}" data-personal-rank="${escapeHtml(entry.playerId)}" /></td>
      <td>${player ? `<button type="button" class="link-button" data-player-details="${escapeHtml(player.id)}">${escapeHtml(name)}</button>` : escapeHtml(name)}</td>
      <td>${escapeHtml(player?.finalPosition || player?.utilityPosition || player?.ahlPosition || player?.position || 'NULL')}</td>
      <td>${escapeHtml(player?.category || 'NULL')}</td>
      <td>${escapeHtml(player?.team || 'NULL')}</td>
      <td>${isAvailable ? 'Available' : 'Unavailable'}</td>
      ${[['Target', 'target'], ['Avoid', 'avoid'], ['Keeper target', 'keeperTarget'], ['Breakout target', 'breakoutTarget']].map(([label, field]) => `
        <td><input aria-label="${label} for ${escapeHtml(name)}" type="checkbox" data-personal-flag="${field}" data-personal-player="${escapeHtml(entry.playerId)}" ${entry[field] ? 'checked' : ''} /></td>
      `).join('')}
      <td><input aria-label="Max bid note for ${escapeHtml(name)}" type="text" value="${escapeHtml(entry.maxBidNote || '')}" data-personal-max-bid="${escapeHtml(entry.playerId)}" /></td>
      <td><input aria-label="Notes for ${escapeHtml(name)}" type="text" value="${escapeHtml(entry.notes)}" data-personal-notes="${escapeHtml(entry.playerId)}" /></td>
      <td><button type="button" class="secondary" data-personal-remove="${escapeHtml(entry.playerId)}">Remove</button></td>
    </tr>`;
  }).join('');

  return `<section class="dashboard-panel" role="tabpanel" id="personal-draft-list-panel">
    <div class="panel">
      <div class="preview-header"><div><h2>Personal Draft List</h2><p class="panel-subtitle">Private to this browser; rankings and notes do not update AHL Sheets.</p></div>
        <div class="personal-list-file-actions">
          <button type="button" class="secondary" data-personal-export>Export JSON</button>
          <button type="button" class="secondary" data-personal-import-trigger>Import JSON</button>
          <input class="hidden" type="file" accept=".json,application/json" data-personal-import-file />
        </div></div>
      <div class="draft-board-filters">
        <label>Sort by <select id="personalDraftSort">
          <option value="rank" ${selected('rank', sort)}>Rank</option><option value="name" ${selected('name', sort)}>Name</option>
          <option value="position" ${selected('position', sort)}>Position</option><option value="team" ${selected('team', sort)}>Team</option>
        </select></label>
        <label>Final Position <select id="personalDraftPositionFilter"><option value="">All positions</option>
          ${allPositions.map((position) => `<option value="${escapeHtml(position)}" ${selected(position, positionFilter)}>${escapeHtml(position)}</option>`).join('')}
        </select></label>
        <label>Experience Tier <select id="personalDraftCategoryFilter"><option value="">All tiers</option>
          ${['Farm', 'Rookie', 'Veteran'].map((category) => `<option value="${category}" ${selected(category, categoryFilter)}>${category}</option>`).join('')}
        </select></label>
        <label>Availability <select id="personalDraftAvailabilityFilter">
          <option value="all" ${selected('all', availabilityFilter)}>All</option>
          <option value="available" ${selected('available', availabilityFilter)}>Available</option>
          <option value="unavailable" ${selected('unavailable', availabilityFilter)}>Unavailable</option>
        </select></label>
      </div>
      <div class="table-wrap"><table class="validation-table">
        <thead><tr><th>Rank</th><th>Name</th><th>Final Position</th><th>Experience Tier</th><th>Team</th><th>Availability</th><th>Target</th><th>Avoid</th><th>Keeper Target</th><th>Breakout Target</th><th>Max Bid Note</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>${rowMarkup || `<tr><td colspan="13" class="empty-state">${entries.length ? 'No list entries match these filters.' : 'Add players from Draft Board or Best Available.'}</td></tr>`}</tbody>
      </table></div>
    </div>
  </section>`;
}

function renderModal(player, teams, teamBudgets, selectedTeam) {
  if (!player) return '';
  const budget = teamBudgets.find((entry) => entry.team === selectedTeam);
  const recommendation = budget
    ? calculateRecommendedMaxBid(player.auctionValue, player.tier, budget.remainingBudget, budget.openSlots)
    : null;
  const projections = player.dobberProjections && typeof player.dobberProjections === 'object'
    ? player.dobberProjections
    : {};
  const projectionValue = (...keys) => {
    const targetKeys = new Set(keys.map((key) => normalizeLookupKey(key).replace(/\s+/g, '')));
    const found = Object.entries(projections).find(([key]) => targetKeys.has(normalizeLookupKey(key).replace(/\s+/g, '')));
    return found?.[1] ?? null;
  };
  const metricMarkup = (rows) => rows
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? 'NULL')}</dd></div>`)
    .join('');
  const projectionRows = Object.entries(projections).map(([label, value]) => [label, value]);
  const forecastRows = [
    ['Projected Points', player.forecast?.projectedPoints ?? player.forecastedPoints],
    ['Projected Games', player.forecast?.projectedGames],
    ['Projected Shots', player.forecast?.projectedShots],
    ['FHPPG', player.forecast?.FHPPG],
    ['SHPPG', player.forecast?.SHPPG],
    ['Splits Method', player.forecast?.splitsMethod],
    ['PPS', player.production?.PPS],
    ['RSS', player.deployment?.RSS],
    ['RRS', player.deployment?.RRS],
    ['BPS', player.prospect?.BPS],
    ...projectionRows,
  ];
  const scoreRows = [
    ['Composite Score', player.forecast?.compositeScore ?? player.compositeForecastScore],
    ['Forecasted Points', player.forecastedPoints ?? player.forecast?.projectedPoints],
    ['ADP', player.adp ?? player.forecast?.adp],
  ];
  const riskRows = [
    ['Risk Score', player.riskScore],
    ['Pedigree Score', player.pedigreeScore],
    ['Pedigree', player.intelEdge?.pedigree],
    ['Projection Confidence', player.intelEdge?.projectionConfidence],
    ['Sleeper Tag', player.intelEdge?.sleeperTag],
    ['Bust Tag', player.intelEdge?.bustTag],
    ['Pricing Method', player.pricingMethod],
  ];
  const prospect = player.prospectMetadata || null;
  const prospectRows = prospect ? [
    ['Position (Dobber)', prospect.position],
    ['Current Rank', prospect.grade],
    ['Prior Rank', prospect.priorGrade],
    ['Tier', prospect.tier],
    ['Fantasy Trajectory', prospect.fantasyTrajectory],
    ['Upside %', prospect.upside],
    ['Risk %', prospect.risk],
    ['Readiness', prospect.readiness],
    ['Comparable', prospect.comparable ? `${prospect.comparable.name}${prospect.comparable.statLine ? ` (${prospect.comparable.statLine})` : ''}` : null],
    ['3-Year Projection', prospect.threeYearProjection],
    ['Draft Pedigree', prospect.draftPedigree],
    ['Organizational Depth', Array.isArray(prospect.organizationalDepth) ? prospect.organizationalDepth.join(', ') : null],
  ] : [];
  const availability = player.localStatus === 'removed-local'
    ? 'removed-local'
    : player.status === 'not-in-ahl' ? 'not-in-ahl' : player.available ? 'available' : 'unavailable';
  return `<div class="draft-modal-backdrop" data-close-player-details>
    <section class="draft-modal panel" role="dialog" aria-modal="true" aria-labelledby="draftModalTitle">
      <button type="button" class="modal-close secondary" aria-label="Close player profile" data-close-player-details>Close</button>
      <h2 id="draftModalTitle">${escapeHtml(player.name)}</h2>
      <p>Final Position ${escapeHtml(player.finalPosition || player.finalPositionOverride || 'NULL')} | AHL Position ${escapeHtml(player.ahlPosition || 'NULL')} | Utility ${escapeHtml(player.utilityPosition || 'NULL')} | Experience Tier ${escapeHtml(player.draftOwner ? getExperienceTierFromGames(player.nhlCareerGamesPlayed) : player.experienceTier || player.category || 'NULL')}</p>
      ${player.valuationStatus !== 'priced' ? '<p class="warning-banner">Estimated value UNPRICED - required source-backed inputs are missing. A paid Draft 2026 price or local winning bid, when present, is shown separately.</p>' : ''}
      <form class="local-player-assignment-form" data-local-assignment-form="${escapeHtml(player.id)}">
        <label>Local owner
          <select name="team" required>
            <option value="">Select owner</option>
            ${teams.map((team) => `<option value="${escapeHtml(team)}" ${player.localAssignmentTeam === team ? 'selected' : ''}>${escapeHtml(team)}</option>`).join('')}
          </select>
        </label>
        <button type="submit" class="secondary" ${teams.length ? '' : 'disabled'}>Assign locally</button>
        <button type="button" class="secondary" data-manual-unassign="${escapeHtml(player.id)}" ${player.ownership ? '' : 'disabled'}>Unassign locally</button>
        ${player.localAssignmentTeam || player.localUnassigned ? `<button type="button" class="secondary" data-clear-local-assignment="${escapeHtml(player.id)}">${player.localUnassigned ? 'Restore AHL assignment' : 'Clear local assignment'}</button>` : ''}
      </form>
      <p class="panel-subtitle">Local ownership edits do not change AHL Sheets or infer a bid.</p>
      <div class="detail-grid">
        <article class="detail-card"><h3>NHL Profile</h3><dl class="kv-list">${metricMarkup([
          ['NHL POS', player.nhlPosition],
          ['Team', player.team || player.dobberProjections?.team],
          ['Deployment', player.deployment?.DS],
          ['PP Unit', projectionValue('PP Unit', 'PPUnit')],
          ['TOI', projectionValue('TOI', 'Time on Ice')],
          ['PPTOI', projectionValue('PPTOI', 'PP TOI', 'Power Play Time on Ice')],
        ])}</dl></article>
        <article class="detail-card"><h3>Forecasted Stats (Dobber Projections)</h3><dl class="kv-list">${metricMarkup(forecastRows)}</dl></article>
        <article class="detail-card"><h3>Historical Splits (AHL Scores)</h3><dl class="kv-list">${metricMarkup([
          ['FHPPG', player.forecast?.FHPPG ?? player.historicalSplits?.FHPPG],
          ['SHPPG', player.forecast?.SHPPG ?? player.historicalSplits?.SHPPG],
          ['Source tab', player.historicalSplits?.sourceTab],
        ])}</dl></article>
        <article class="detail-card"><h3>Composite Forecast Score</h3><dl class="kv-list">${metricMarkup(scoreRows)}</dl></article>
        <article class="detail-card"><h3>Risk &amp; Pedigree (Dobber PDF Intel)</h3><dl class="kv-list">${metricMarkup(riskRows)}</dl>
          <p><strong>Strengths:</strong> ${(player.strengths || []).map(escapeHtml).join(', ') || 'NULL'}</p>
          <p><strong>Risks:</strong> ${(player.risks || []).map(escapeHtml).join(', ') || 'NULL'}</p>
        </article>
        ${prospect ? `<article class="detail-card"><h3>Prospect Intelligence (Dobber Report)</h3><dl class="kv-list">${metricMarkup(prospectRows)}</dl>
          ${prospect.writeUp ? `<p>${escapeHtml(prospect.writeUp)}</p>` : ''}
        </article>` : ''}
        <article class="detail-card"><h3>Keeper / Contract</h3><dl class="kv-list">${metricMarkup([
          ['KVS', player.keeper?.KVS],
          ['Salary', player.salary],
          ['AAV', player.aav],
        ])}</dl></article>
        <article class="detail-card"><h3>Availability</h3><dl class="kv-list">${metricMarkup([
          ['Owner', player.ownership || 'NULL'],
          ['Availability', availability],
          ['Removed-local', player.localStatus === 'removed-local'],
          ['Not-in-ahl', player.status === 'not-in-ahl'],
        ])}</dl></article>
      </div>
      <p><strong>Auction value:</strong> ${player.auctionValue === null ? 'UNPRICED' : money(player.auctionValue)}
        <strong>Recommended max bid:</strong> ${money(recommendation)}${player.draftOwner ? ` <strong>Draft 2026 / winning bid:</strong> ${money(player.draftPrice)}` : ''}</p>
      <form class="winning-bid-form" data-winning-bid-form="${escapeHtml(player.id)}" data-assignment-key="${escapeHtml(player.assignmentKey || player.id)}">
        <label>Winning team
          <select name="team" required>
            <option value="">Select team</option>
            ${teams.map((team) => `<option value="${escapeHtml(team)}" ${selectedTeam === team ? 'selected' : ''}>${escapeHtml(team)}</option>`).join('')}
          </select>
        </label>
        <label>Winning bid
          <input name="bid" type="number" min="0.50" step="0.50" placeholder="0.50" required />
        </label>
        <label>Roster category
          <select name="classification" required>
            <option value="">Select category</option>
            ${['Farm', 'Rookie', 'Veteran'].map((category) => `<option value="${category}" ${player.category === category ? 'selected' : ''}>${category}</option>`).join('')}
          </select>
        </label>
        <button class="primary" type="submit" ${teams.length && player.available && player.status !== 'not-in-ahl' && !player.draftOwner ? '' : 'disabled'}>Record winning bid</button>
      </form>
    </section>
  </div>`;
}

export function renderDraftAuctionDashboard({
  activeTab,
  players,
  draftedPlayers = [],
  ahlPool = {},
  draftIQ = {},
  draftIQv3 = {},
  availableKeys,
  personalDraftList = [],
  personalDraftListSort = 'rank',
  personalDraftPositionFilter = '',
  personalDraftCategoryFilter = '',
  personalDraftAvailabilityFilter = 'all',
  search,
  positionFilter,
  bestPositionFilter = '',
  bestAvailableSearch = '',
  categoryFilter,
  bestAvailableSort,
  bestAvailableNeedsTeam = '',
  showRemovedPlayers = false,
  highlightUnavailablePlayers = false,
  teamBudgets,
  teamNames,
  selectedPlayer,
  selectedTeam,
  sourceAvailability,
  toolsHtml,
  workspaceHtml,
  gpWarning = '',
}) {
  const availableKeySet = availableKeys instanceof Set ? availableKeys : new Set(availableKeys || []);
  const canonicalPool = ahlPool instanceof Map ? ahlPool : new Map(Object.entries(ahlPool || {}));
  const allPositions = [...new Set(draftedPlayers.flatMap(getAhlPlayerPositions))].sort();
  const filtered = draftedPlayers.filter((player) => {
    const removed = player.localStatus === 'removed-local';
    if (removed && !showRemovedPlayers) return false;
    const matchesSearch = !search || `${player.name} ${player.team || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesPosition = !positionFilter || getAhlPlayerPositions(player).includes(positionFilter);
    const matchesCategory = !categoryFilter || getExperienceTierFromGames(player.nhlCareerGamesPlayed) === categoryFilter;
    return matchesSearch && matchesPosition && matchesCategory;
  });
  const playersByKey = new Map();
  (players || []).forEach((player) => {
    const playerKey = normalizeLookupKey(player.name);
    if (playerKey && !playersByKey.has(playerKey)) playersByKey.set(playerKey, player);
  });
  const finiteOrNull = (...values) => values.find(Number.isFinite) ?? null;
  // Rows come from the canonical pool ∩ availableKeys; positions come only from the pool (AHL
  // Position + AHL Utility), never from NHL API, Dobber, or player-level position fields.
  const bestPlayers = [...canonicalPool].flatMap(([playerKey, poolPlayer]) => {
    if (!availableKeySet.has(playerKey)) return [];
    const player = playersByKey.get(playerKey) || null;
    if (player && (player.localStatus === 'removed-local' || player.status === 'not-in-ahl')) return [];
    const positions = [...(poolPlayer.positions instanceof Set
      ? poolPlayer.positions
      : poolPlayer.positions || [])];
    return [{
      ...(player || { id: `pool:${playerKey}`, name: poolPlayer.name, status: 'in-ahl', poolOnly: true }),
      team: poolPlayer.team || player?.team || '',
      finalPosition: positions.join('/') || null,
      finalPositionOverride: null,
      ahlPosition: poolPlayer.flags?.primaryPosition || null,
      utilityPosition: poolPlayer.flags?.utilityPosition || null,
      poolPositions: positions,
      forecastedGoals: finiteOrNull(player?.forecast?.projectedGoals, player?.forecastedGoals),
      forecastedAssists: finiteOrNull(player?.forecast?.projectedAssists, player?.forecastedAssists),
      forecastedPoints: finiteOrNull(player?.forecast?.projectedPoints, player?.forecastedPoints),
      adp: finiteOrNull(player?.adp, player?.forecast?.adp),
      draftIQv2: finiteOrNull(draftIQ?.[playerKey]?.draftIQ),
      draftIQv3: finiteOrNull(draftIQv3?.[playerKey]?.draftIQ),
    }];
  });
  const bestSortOptions = ['ADP', 'Forecasted Points', 'DraftIQ', 'DraftIQ v3'];
  // No bundled source supplies ADP today; sorting by an all-NULL column would silently fall
  // through to the points tie-breaker while still claiming "ADP", so it is disabled instead.
  const hasAdpData = bestPlayers.some((player) => player.adp !== null);
  const bestSort = bestSortOptions.includes(bestAvailableSort) && (bestAvailableSort !== 'ADP' || hasAdpData)
    ? bestAvailableSort
    : 'Forecasted Points';
  const compareNullable = (left, right, direction) => {
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return direction * (left - right);
  };
  const primaryCompare = {
    ADP: (left, right) => compareNullable(left.adp, right.adp, 1),
    DraftIQ: (left, right) => compareNullable(left.draftIQv2, right.draftIQv2, -1),
    'DraftIQ v3': (left, right) => compareNullable(left.draftIQv3, right.draftIQv3, -1),
    'Forecasted Points': () => 0,
  }[bestSort];
  // Tie-breakers: forecasted points -> goals -> assists -> ADP; NULLs always sort last.
  bestPlayers.sort((left, right) => primaryCompare(left, right)
    || compareNullable(left.forecastedPoints, right.forecastedPoints, -1)
    || compareNullable(left.forecastedGoals, right.forecastedGoals, -1)
    || compareNullable(left.forecastedAssists, right.forecastedAssists, -1)
    || compareNullable(left.adp, right.adp, 1)
    || left.name.localeCompare(right.name));
  const bestSearchKey = normalizeLookupKey(bestAvailableSearch || '');
  const rankedBestPlayers = bestSearchKey
    ? bestPlayers.filter((player) => normalizeLookupKey(player.name).includes(bestSearchKey))
    : bestPlayers
      .filter((player) => !bestPositionFilter || player.poolPositions.includes(bestPositionFilter))
      .slice(0, 25);
  const tab = (id, label) => `<button type="button" role="tab" aria-selected="${activeTab === id}" data-dashboard-tab="${id}">${label}</button>`;
  const selected = (value, current) => value === current ? 'selected' : '';
  const localPlayerFilters = `<div class="draft-board-filters draft-local-edit-toggles">
    <label><input type="checkbox" data-show-removed-players ${showRemovedPlayers ? 'checked' : ''} /> Show Removed Players</label>
    <label><input type="checkbox" data-highlight-ahl-unavailable ${highlightUnavailablePlayers ? 'checked' : ''} /> Highlight AHL-eligible but unavailable players</label>
  </div>`;
  const bestAvailableEmptyMessage = 'No available, undrafted AHL-eligible players match the current filters.';
  const draftBoardEmptyMessage = 'No drafted players match the current filters.';
  const sourceRows = Object.entries(sourceAvailability || {}).map(([name, loaded]) => `<tr><td>${escapeHtml(name)}</td><td>${loaded ? 'Available' : 'Missing'}</td></tr>`).join('');
  const legend = `<details class="acronym-legend"><summary class="secondary">Legend</summary>
    <dl>${[
      ['PPTOI', 'Power Play Time on Ice'],
      ['PPG', 'Points per Game'],
      ['FHPPG', 'First-Half Points per Game'],
      ['SHPPG', 'Second-Half Points per Game'],
      ['ProjPts', 'Projected Points'],
      ['DraftIQ', 'Best Available ranking score: Forecasted Points + positional scarcity + (pedigree - risk) + team needs + shots per game'],
      ['DraftIQ v3', 'Extended ranking score: DraftIQ inputs plus upside, AHL splits consistency, projection confidence, and contract value (points per auction $), minus an age-regression penalty'],
      ['KVS', 'Keeper Value Score'],
      ['BPS', 'Breakout Probability Score'],
      ['RSS', 'Risk Stability Score'],
    ].map(([acronym, description]) => `<div><dt>${acronym}</dt><dd>${description}</dd></div>`).join('')}</dl>
  </details>`;
  const boardPanel = `<section id="draft-board-panel" class="dashboard-panel" role="tabpanel" ${activeTab === 'draft-board' ? '' : 'hidden'}>
    <div class="panel draft-board-panel">
      <div class="preview-header"><div><h2>Draft Board</h2><p class="panel-subtitle">Draft 2026 owners and paid prices, plus local winning bids; estimated auction values are not shown here.</p></div>
        <span class="meta-pill">${draftedPlayers.length} drafted</span></div>
      ${gpWarning ? `<p class="warning-banner">${escapeHtml(gpWarning)}</p>` : ''}
      <div class="draft-board-filters draft-local-edit-toggles">
        <label><input type="checkbox" data-show-removed-players ${showRemovedPlayers ? 'checked' : ''} /> Show Removed Players</label>
      </div>
      <div class="draft-board-filters">
        <label>Search <input id="draftBoardSearch" type="search" value="${escapeHtml(search)}" placeholder="Player or NHL team" /></label>
        <label>Position <select id="draftPositionFilter"><option value="">All positions</option>${allPositions.map((position) => `<option ${selected(position, positionFilter)}>${escapeHtml(position)}</option>`).join('')}</select></label>
        <label>Experience Tier <select id="draftCategoryFilter"><option value="">All tiers</option>${['Farm', 'Rookie', 'Veteran'].map((category) => `<option ${selected(category, categoryFilter)}>${category}</option>`).join('')}</select></label>
      </div>
      ${renderPlayerTable(filtered, availableKeys, personalDraftList, { emptyMessage: draftBoardEmptyMessage })}
    </div>
  </section>`;
  const bestPanel = `<section id="best-available-panel" class="dashboard-panel" role="tabpanel" ${activeTab === 'best-available' ? '' : 'hidden'}>
    <div class="panel"><div class="preview-header"><div><h2>Best Available</h2><p class="panel-subtitle">${bestSearchKey
    ? `${rankedBestPlayers.length} currently available player${rankedBestPlayers.length === 1 ? '' : 's'} matching &ldquo;${escapeHtml(bestAvailableSearch.trim())}&rdquo; across the canonical AHL pool (position filter ignored while searching).`
    : 'Top 25 currently available, undrafted players matching the selected position.'} Sorted by ${{ ADP: 'ADP (lowest first)', 'Forecasted Points': 'Forecasted Points (highest first)', DraftIQ: 'DraftIQ (highest first)', 'DraftIQ v3': 'DraftIQ v3 (highest first)' }[bestSort]}; forecast fields are NULL when Dobber has no projection.</p></div>
      <div class="best-available-toolbar"><label>Search <input id="bestAvailableSearch" type="search" value="${escapeHtml(bestAvailableSearch)}" placeholder="Player name" /></label><label>Position <select id="bestPositionFilter"><option value="">All</option>${['C', 'LW', 'RW', 'D'].map((position) => `<option value="${position}" ${selected(position, bestPositionFilter)}>${position}</option>`).join('')}</select></label><label>Sort by <select id="bestAvailableSort">${bestSortOptions.map((key) => (key === 'ADP' && !hasAdpData
    ? '<option value="ADP" disabled>ADP (no data)</option>'
    : `<option ${selected(key, bestSort)}>${key}</option>`)).join('')}</select></label><label>Team needs <select id="bestAvailableNeedsTeam"><option value="">None</option>${(teamNames || []).map((team) => `<option value="${escapeHtml(team)}" ${selected(team, bestAvailableNeedsTeam)}>${escapeHtml(team)}</option>`).join('')}</select></label>${legend}</div></div>
      ${localPlayerFilters}
      ${renderPlayerTable(rankedBestPlayers, availableKeySet, personalDraftList, { kind: 'best-available', emptyMessage: bestAvailableEmptyMessage, highlightUnavailable: highlightUnavailablePlayers })}
    </div>
  </section>`;
  const budgetsPanel = `<section id="team-budgets-panel" class="dashboard-panel" role="tabpanel" ${activeTab === 'team-budgets' ? '' : 'hidden'}>
    <div class="panel"><h2>Team Budgets</h2><p class="panel-subtitle">AHL Draft balances adjusted by local ownership changes (winning bids, manual assign/unassign); recomputed on every change.</p>${renderTeamBudgets(teamBudgets)}</div>
    ${workspaceHtml}
  </section>`;
  const personalPanel = renderPersonalDraftList(players, personalDraftList, availableKeys, {
  sort: personalDraftListSort,
  positionFilter: personalDraftPositionFilter,
  categoryFilter: personalDraftCategoryFilter,
  availabilityFilter: personalDraftAvailabilityFilter,
  });
  const toolsPanel = `<section id="tools-validation-panel" class="dashboard-panel" role="tabpanel" ${activeTab === 'tools-validation' ? '' : 'hidden'}>
    <div class="panel"><h2>Tools &amp; Validation</h2>
      <button type="button" class="secondary" data-export-draft-json>Export generated Draft Intelligence JSON</button>
      <button type="button" class="secondary" id="reset-local-edits">Reset Local Edits</button>
      <p class="panel-subtitle">Reset clears local draft overlays after a successful authoritative AHL refresh; locally imported Dobber data is retained.</p>
      <div class="table-wrap"><table class="validation-table"><thead><tr><th>Source</th><th>Status</th></tr></thead><tbody>${sourceRows}</tbody></table></div>
      <p class="warning-banner">Pricing remains UNPRICED when required source data, scarcity rules, or team budget inputs are absent. Historical statistics are not projections.</p>
    </div>
    ${toolsHtml}
  </section>`;
  const panels = { 'draft-board': boardPanel, 'best-available': bestPanel, 'team-budgets': budgetsPanel, 'personal-draft-list': personalPanel, 'tools-validation': toolsPanel };

  return `<div class="dashboard-tabs" role="tablist" aria-label="Draft dashboard">
      ${tab('draft-board', 'Draft Board')}${tab('best-available', 'Best Available')}
      ${tab('team-budgets', 'Team Budgets')}${tab('personal-draft-list', 'Personal Draft List')}${tab('tools-validation', 'Tools & Validation')}
    </div>
    ${panels[activeTab] || boardPanel}
    ${renderModal(selectedPlayer, teamNames, teamBudgets, selectedTeam)}`;
}
