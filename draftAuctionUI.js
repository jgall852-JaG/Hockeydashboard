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

function renderPlayerRows(players, shortlist, availableKeys, personalDraftList, {
  kind = 'board',
  emptyMessage = 'No matching players.',
  highlightUnavailable = false,
} = {}) {
  if (!players.length) return `<tr><td colspan="${kind === 'best-available' ? 6 : 12}" class="empty-state">${escapeHtml(emptyMessage)}</td></tr>`;
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
    const experienceTier = player.experienceTier || player.category || 'NULL';
    const finalPosition = player.finalPosition || player.finalPositionOverride || 'NULL';
    if (kind === 'best-available') {
      const forecastedPoints = player.forecast?.projectedPoints ?? player.forecastedPoints ?? null;
      const compositeScore = player.forecast?.compositeScore ?? player.compositeForecastScore ?? null;
      return `<tr class="${rowClasses}" data-player-status="${escapeHtml(player.status || '')}">
        <td><button type="button" class="link-button" data-player-details="${escapeHtml(player.id)}">${escapeHtml(player.name)}</button></td>
        <td>${escapeHtml(finalPosition)}</td>
        <td>${escapeHtml(experienceTier)}</td>
        <td>${forecastedPoints ?? 'NULL'}</td>
        <td>${compositeScore ?? 'NULL'}</td>
        <td>${isAvailable ? 'Available' : 'Unavailable'}</td>
      </tr>`;
    }
    return `<tr class="${rowClasses}" data-player-status="${escapeHtml(player.status || '')}">
      <td><button type="button" class="link-button" data-player-details="${escapeHtml(player.id)}">${escapeHtml(player.name)}</button></td>
      <td>${escapeHtml(finalPosition)}</td>
      <td>${escapeHtml(experienceTier)}</td>
      <td>${player.tier ?? 'NULL'}</td>
      <td>${player.auctionValue === null ? 'UNPRICED' : money(player.auctionValue)}</td>
      <td>${player.recommendedMaxBid === null ? 'NULL' : money(player.recommendedMaxBid)}</td>
      <td>${escapeHtml(player.classification || 'UNPRICED')}</td>
      <td>${escapeHtml(player.ownership || 'Unassigned')}${player.localAssignmentTeam ? ' (local)' : ''}</td>
      <td>${isAvailable ? 'Available' : 'Unavailable'}</td>
      <td><button type="button" class="secondary shortlist-toggle" data-shortlist-player="${escapeHtml(player.id)}" aria-pressed="${shortlist.has(player.id)}">${shortlist.has(player.id) ? '★' : '☆'}</button></td>
      <td><button type="button" class="secondary personal-list-toggle" data-personal-add="${escapeHtml(player.id)}" ${isPersonal ? 'disabled aria-disabled="true"' : ''}>${isPersonal ? 'In List' : 'Add to Personal List'}</button></td>
      <td><button type="button" class="secondary" ${removed
    ? `data-undo-player="${escapeHtml(player.id)}">Undo remove`
    : `data-remove-player="${escapeHtml(player.id)}">Remove locally`}</button></td>
    </tr>`;
  }).join('');
}

function renderPlayerTable(players, shortlist, availableKeys, personalDraftList, options = {}) {
  const normalizedOptions = { kind: 'board', ...options };
  const headers = normalizedOptions.kind === 'best-available'
    ? ['Player', 'Final Position', 'Experience Tier', 'Forecasted Points', 'Composite Score', 'Availability']
    : ['Player', 'Final Position', 'Experience Tier', 'Tier', 'Auction Value', 'Max Bid', 'Value/Risk', 'Owner', 'Availability', 'Shortlist', 'Personal List', 'Local Edit'];
  return `<div class="table-wrap"><table class="validation-table">
    <thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead>
    <tbody>${renderPlayerRows(players, shortlist, availableKeys, personalDraftList, normalizedOptions)}</tbody>
  </table></div>`;
}

function renderTeamBudgets(teamBudgets) {
  const rows = teamBudgets.map((team) => `<tr>
    <td>${escapeHtml(team.team)}</td>
    <td>${money(team.retained)}</td>
    <td>${money(team.remainingBudget)}</td>
    <td>${team.skaters ? `${team.skaters.count}/${team.skaters.max}` : 'NULL'}</td>
    <td>${team.playersDrafted}</td>
    <td>${team.openSlots}</td>
    <td>${money(team.averageSpendRemaining)}</td>
    <td>${money(team.maxPossibleBid)}</td>
    <td>${money(team.keeperCosts)}</td>
    <td>${money(team.rookieFarmCosts)}</td>
    <td>${money(team.penalties)}</td>
    <td>${money(team.adjustments)}</td>
  </tr>`).join('');
  return `<div class="table-wrap"><table class="validation-table">
    <thead><tr><th>Team</th><th>Retained</th><th>Budget Remaining</th><th>Skaters</th><th>Players Drafted</th><th>Open Slots</th><th>Avg Spend Remaining</th><th>Max Possible Bid</th><th>Keeper Costs</th><th>Rookie/Farm Costs</th><th>Penalties</th><th>Adjustments</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="12" class="empty-state">No AHL Draft budget data is available.</td></tr>'}</tbody>
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
  ];
  const availability = player.localStatus === 'removed-local'
    ? 'removed-local'
    : player.status === 'not-in-ahl' ? 'not-in-ahl' : player.available ? 'available' : 'unavailable';
  return `<div class="draft-modal-backdrop" data-close-player-details>
    <section class="draft-modal panel" role="dialog" aria-modal="true" aria-labelledby="draftModalTitle">
      <button type="button" class="modal-close secondary" aria-label="Close player profile" data-close-player-details>Close</button>
      <h2 id="draftModalTitle">${escapeHtml(player.name)}</h2>
      <p>Final Position ${escapeHtml(player.finalPosition || player.finalPositionOverride || 'NULL')} | AHL Position ${escapeHtml(player.ahlPosition || 'NULL')} | Utility ${escapeHtml(player.utilityPosition || 'NULL')} | Experience Tier ${escapeHtml(player.experienceTier || player.category || 'NULL')}</p>
      ${player.valuationStatus !== 'priced' ? '<p class="warning-banner">UNPRICED - required source-backed inputs are missing. No auction value or max bid is estimated.</p>' : ''}
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
        <strong>Recommended max bid:</strong> ${money(recommendation)}</p>
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
        <button class="primary" type="submit" ${teams.length ? '' : 'disabled'}>Record winning bid</button>
      </form>
    </section>
  </div>`;
}

export function renderDraftAuctionDashboard({
  activeTab,
  players,
  availableKeys,
  shortlist,
  personalDraftList = [],
  personalDraftListSort = 'rank',
  personalDraftPositionFilter = '',
  personalDraftCategoryFilter = '',
  personalDraftAvailabilityFilter = 'all',
  search,
  positionFilter,
  categoryFilter,
  availabilityFilter,
  bestAvailableSort,
  showAllAhlPlayers = false,
  showRemovedPlayers = false,
  highlightUnavailablePlayers = false,
  teamBudgets,
  teamNames,
  selectedPlayer,
  selectedTeam,
  sourceAvailability,
  toolsHtml,
  workspaceHtml,
}) {
  const eligiblePlayers = players.filter((player) => player.status !== 'not-in-ahl');
  const allPositions = [...new Set(eligiblePlayers.flatMap(getAhlPlayerPositions))].sort();
  const filtered = eligiblePlayers.filter((player) => {
    const removed = player.localStatus === 'removed-local';
    if (removed && !showRemovedPlayers) return false;
    const isAvailable = !removed && availableKeys.has(normalizeLookupKey(player.name));
    if (
      !showAllAhlPlayers
      && availabilityFilter !== 'unavailable'
      && !isAvailable
      && !(removed && showRemovedPlayers)
    ) return false;
    const matchesSearch = !search || `${player.name} ${player.team || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesPosition = !positionFilter || getAhlPlayerPositions(player).includes(positionFilter);
    const matchesCategory = !categoryFilter || player.category === categoryFilter;
    const matchesAvailability = availabilityFilter === 'all'
      || (availabilityFilter === 'available' ? isAvailable : !isAvailable);
    return matchesSearch && matchesPosition && matchesCategory && matchesAvailability;
  });
  const availableEligibleCount = eligiblePlayers.filter((player) => (
    player.localStatus !== 'removed-local'
    && availableKeys.has(normalizeLookupKey(player.name))
  )).length;
  const bestPlayers = eligiblePlayers.filter((player) => {
    const removed = player.localStatus === 'removed-local';
    const isAvailable = !removed && availableKeys.has(normalizeLookupKey(player.name));
    if (removed && !showRemovedPlayers) return false;
    return showAllAhlPlayers || isAvailable || (removed && showRemovedPlayers);
  });
  const sortKeys = {
    ADP: 'adp',
    'Forecasted Points': 'forecastedPoints',
    'Composite Score': 'compositeScore',
    FHPPG: 'FHPPG',
    SHPPG: 'SHPPG',
  };
  const sortValueKeys = {
    adp: ['adp', 'forecast.adp'],
    forecastedPoints: ['forecast.projectedPoints', 'forecastedPoints'],
    compositeScore: ['forecast.compositeScore', 'compositeForecastScore'],
    FHPPG: ['forecast.FHPPG', 'historicalSplits.FHPPG'],
    SHPPG: ['forecast.SHPPG', 'historicalSplits.SHPPG'],
  };
  const readSortValue = (player, key) => key.split('.').reduce((value, part) => value?.[part], player);
  const getSortValue = (player) => {
    const key = sortKeys[bestAvailableSort] || 'adp';
    const candidates = sortValueKeys[key] || [key];
    return candidates.map((candidate) => readSortValue(player, candidate)).find(Number.isFinite) ?? null;
  };
  bestPlayers.sort((left, right) => {
    const leftValue = getSortValue(left);
    const rightValue = getSortValue(right);
    if (leftValue === null || leftValue === undefined) return rightValue === null || rightValue === undefined ? left.name.localeCompare(right.name) : 1;
    if (rightValue === null || rightValue === undefined) return -1;
    return rightValue - leftValue || left.name.localeCompare(right.name);
  });
  const tab = (id, label) => `<button type="button" role="tab" aria-selected="${activeTab === id}" data-dashboard-tab="${id}">${label}</button>`;
  const selected = (value, current) => value === current ? 'selected' : '';
  const localPlayerFilters = `<div class="draft-board-filters draft-local-edit-toggles">
    <label><input type="checkbox" data-show-all-ahl-players ${showAllAhlPlayers ? 'checked' : ''} /> Show All AHL Players</label>
    <label><input type="checkbox" data-show-removed-players ${showRemovedPlayers ? 'checked' : ''} /> Show Removed Players</label>
    <label><input type="checkbox" data-highlight-ahl-unavailable ${highlightUnavailablePlayers ? 'checked' : ''} /> Highlight AHL-eligible but unavailable players</label>
  </div>`;
  const bestAvailableEmptyMessage = availableEligibleCount === 0
    ? 'All AHL-eligible players are currently unavailable.'
    : 'No matching players.';
  const draftBoardEmptyMessage = 'No draftable players available under current filters.';
  const sourceRows = Object.entries(sourceAvailability || {}).map(([name, loaded]) => `<tr><td>${escapeHtml(name)}</td><td>${loaded ? 'Available' : 'Missing'}</td></tr>`).join('');
  const legend = `<details class="acronym-legend"><summary class="secondary">Legend</summary>
    <dl>${[
      ['PPTOI', 'Power Play Time on Ice'],
      ['PPG', 'Points per Game'],
      ['FHPPG', 'First-Half Points per Game'],
      ['SHPPG', 'Second-Half Points per Game'],
      ['ProjPts', 'Projected Points'],
      ['CompScore', 'Composite Forecast Score'],
      ['KVS', 'Keeper Value Score'],
      ['BPS', 'Breakout Probability Score'],
      ['RSS', 'Risk Stability Score'],
    ].map(([acronym, description]) => `<div><dt>${acronym}</dt><dd>${description}</dd></div>`).join('')}</dl>
  </details>`;
  const boardPanel = `<section id="draft-board-panel" class="dashboard-panel" role="tabpanel" ${activeTab === 'draft-board' ? '' : 'hidden'}>
    <div class="panel draft-board-panel">
      <div class="preview-header"><div><h2>Draft Board</h2><p class="panel-subtitle">Source-backed values only; missing values remain unpriced.</p></div>
        <span class="meta-pill">${availableEligibleCount} available</span></div>
      ${localPlayerFilters}
      <div class="draft-board-filters">
        <label>Search <input id="draftBoardSearch" type="search" value="${escapeHtml(search)}" placeholder="Player or NHL team" /></label>
        <label>Position <select id="draftPositionFilter"><option value="">All positions</option>${allPositions.map((position) => `<option ${selected(position, positionFilter)}>${escapeHtml(position)}</option>`).join('')}</select></label>
        <label>Experience Tier <select id="draftCategoryFilter"><option value="">All tiers</option>${['Farm', 'Rookie', 'Veteran'].map((category) => `<option ${selected(category, categoryFilter)}>${category}</option>`).join('')}</select></label>
        <label>Availability <select id="draftAvailabilityFilter"><option value="all" ${selected('all', availabilityFilter)}>All</option><option value="available" ${selected('available', availabilityFilter)}>Available</option><option value="unavailable" ${selected('unavailable', availabilityFilter)}>Unavailable</option></select></label>
      </div>
      ${renderPlayerTable(filtered, shortlist, availableKeys, personalDraftList, { emptyMessage: draftBoardEmptyMessage, highlightUnavailable: highlightUnavailablePlayers })}
    </div>
  </section>`;
  const bestPanel = `<section id="best-available-panel" class="dashboard-panel" role="tabpanel" ${activeTab === 'best-available' ? '' : 'hidden'}>
    <div class="panel"><div class="preview-header"><div><h2>Best Available</h2><p class="panel-subtitle">Forecast fields remain NULL until source-backed projections are available.</p></div>
      <div class="best-available-toolbar"><label>Sort by <select id="bestAvailableSort">${Object.keys(sortKeys).map((key) => `<option ${selected(key, bestAvailableSort)}>${key}</option>`).join('')}</select></label>${legend}</div></div>
      ${localPlayerFilters}
      ${renderPlayerTable(bestPlayers, shortlist, availableKeys, personalDraftList, { kind: 'best-available', emptyMessage: bestAvailableEmptyMessage, highlightUnavailable: highlightUnavailablePlayers })}
    </div>
  </section>`;
  const budgetsPanel = `<section id="team-budgets-panel" class="dashboard-panel" role="tabpanel" ${activeTab === 'team-budgets' ? '' : 'hidden'}>
    <div class="panel"><h2>Team Budgets</h2><p class="panel-subtitle">Working assignments are included in remaining budget and slots.</p>${renderTeamBudgets(teamBudgets)}</div>
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
