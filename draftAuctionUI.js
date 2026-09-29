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
  const utilityPositions = String(player.utilityPosition || '')
    .split(/[\/,\s]+/)
    .filter(Boolean)
    .map((position) => position === 'L' ? 'LW' : position === 'R' ? 'RW' : position);
  return [...new Set([player.ahlPosition || player.position, ...utilityPositions].filter(Boolean))];
}

function renderPlayerRows(players, shortlist, availableKeys, personalDraftList, { showAvailable = true } = {}) {
  if (!players.length) return `<tr><td colspan="${showAvailable ? 11 : 10}" class="empty-state">No matching players.</td></tr>`;
  return players.map((player) => {
    const isAvailable = availableKeys.has(normalizeLookupKey(player.name));
    const isPersonal = personalDraftList.some((entry) => entry.playerId === player.id);
    return `<tr>
      <td><button type="button" class="link-button" data-player-details="${escapeHtml(player.id)}">${escapeHtml(player.name)}</button></td>
      <td>${escapeHtml(player.ahlPosition || player.position || 'NULL')}</td>
      <td>${escapeHtml(player.category || 'NULL')}</td>
      <td>${player.tier ?? 'NULL'}</td>
      <td>${player.auctionValue === null ? 'UNPRICED' : money(player.auctionValue)}</td>
      <td>${player.recommendedMaxBid === null ? 'NULL' : money(player.recommendedMaxBid)}</td>
      <td>${escapeHtml(player.classification || 'UNPRICED')}</td>
      ${showAvailable ? `<td>${isAvailable ? 'Available' : 'Unavailable'}</td>` : ''}
      <td><button type="button" class="secondary shortlist-toggle" data-shortlist-player="${escapeHtml(player.id)}" aria-pressed="${shortlist.has(player.id)}">${shortlist.has(player.id) ? '★' : '☆'}</button></td>
      <td><button type="button" class="secondary" data-player-details="${escapeHtml(player.id)}">Insights</button></td>
      <td><button type="button" class="secondary personal-list-toggle" data-personal-add="${escapeHtml(player.id)}" ${isPersonal ? 'disabled aria-disabled="true"' : ''}>${isPersonal ? 'In List' : 'Add to Personal List'}</button></td>
    </tr>`;
  }).join('');
}

function renderPlayerTable(players, shortlist, availableKeys, personalDraftList, options = { showAvailable: true }) {
  return `<div class="table-wrap"><table class="validation-table">
    <thead><tr><th>Name</th><th>AHL Pos</th><th>Category</th><th>Tier</th><th>Auction Value</th><th>Max Bid</th><th>Value/Risk</th>${options.showAvailable ? '<th>Availability</th>' : ''}<th>Shortlist</th><th>Insights</th><th>Personal List</th></tr></thead>
    <tbody>${renderPlayerRows(players, shortlist, availableKeys, personalDraftList, options)}</tbody>
  </table></div>`;
}

function renderTeamBudgets(teamBudgets) {
  const rows = teamBudgets.map((team) => `<tr>
    <td>${escapeHtml(team.team)}</td>
    <td>${money(team.remainingBudget)}</td>
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
    <thead><tr><th>Team</th><th>Budget Remaining</th><th>Players Drafted</th><th>Open Slots</th><th>Avg Spend Remaining</th><th>Max Possible Bid</th><th>Keeper Costs</th><th>Rookie/Farm Costs</th><th>Penalties</th><th>Adjustments</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="10" class="empty-state">No AHL Draft budget data is available.</td></tr>'}</tbody>
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
      return (!positionFilter || (player?.ahlPosition || player?.position) === positionFilter)
        && (!categoryFilter || player?.category === categoryFilter)
        && (availabilityFilter === 'all'
          || (availabilityFilter === 'available' ? isAvailable : !isAvailable));
    })
    .sort((left, right) => {
      if (sort === 'name') return (left.player?.name || left.entry.playerId).localeCompare(right.player?.name || right.entry.playerId);
      if (sort === 'position') return (left.player?.ahlPosition || left.player?.position || '').localeCompare(right.player?.ahlPosition || right.player?.position || '');
      if (sort === 'team') return (left.player?.team || '').localeCompare(right.player?.team || '');
      return left.entry.rank - right.entry.rank;
    });
  const rowMarkup = rows.map(({ entry, player }) => {
    const name = player?.name || `${entry.playerId} (not in current AHL inventory)`;
    const isAvailable = Boolean(player && availableKeys.has(normalizeLookupKey(player.name)));
    return `<tr>
      <td><input aria-label="Rank for ${escapeHtml(name)}" type="number" min="1" max="${entries.length}" step="1" value="${entry.rank}" data-personal-rank="${escapeHtml(entry.playerId)}" /></td>
      <td>${player ? `<button type="button" class="link-button" data-player-details="${escapeHtml(player.id)}">${escapeHtml(name)}</button>` : escapeHtml(name)}</td>
      <td>${escapeHtml(player?.ahlPosition || player?.position || 'NULL')}</td>
      <td>${escapeHtml(player?.category || 'NULL')}</td>
      <td>${escapeHtml(player?.team || 'NULL')}</td>
      <td>${isAvailable ? 'Available' : 'Unavailable'}</td>
      <td><input aria-label="Notes for ${escapeHtml(name)}" type="text" value="${escapeHtml(entry.notes)}" data-personal-notes="${escapeHtml(entry.playerId)}" /></td>
      <td><button type="button" class="secondary" data-personal-remove="${escapeHtml(entry.playerId)}">Remove</button></td>
    </tr>`;
  }).join('');

  return `<section class="dashboard-panel" role="tabpanel" id="personal-draft-list-panel">
    <div class="panel">
      <div class="preview-header"><div><h2>Personal Draft List</h2><p class="panel-subtitle">Private to this browser; rankings and notes do not update AHL Sheets.</p></div>
        <button type="button" class="secondary" data-personal-export>Export JSON</button></div>
      <div class="draft-board-filters">
        <label>Sort by <select id="personalDraftSort">
          <option value="rank" ${selected('rank', sort)}>Rank</option><option value="name" ${selected('name', sort)}>Name</option>
          <option value="position" ${selected('position', sort)}>Position</option><option value="team" ${selected('team', sort)}>Team</option>
        </select></label>
        <label>AHL Position <select id="personalDraftPositionFilter"><option value="">All positions</option>
          ${allPositions.map((position) => `<option value="${escapeHtml(position)}" ${selected(position, positionFilter)}>${escapeHtml(position)}</option>`).join('')}
        </select></label>
        <label>Category <select id="personalDraftCategoryFilter"><option value="">All categories</option>
          ${['Farm', 'Rookie', 'Veteran'].map((category) => `<option value="${category}" ${selected(category, categoryFilter)}>${category}</option>`).join('')}
        </select></label>
        <label>Availability <select id="personalDraftAvailabilityFilter">
          <option value="all" ${selected('all', availabilityFilter)}>All</option>
          <option value="available" ${selected('available', availabilityFilter)}>Available</option>
          <option value="unavailable" ${selected('unavailable', availabilityFilter)}>Unavailable</option>
        </select></label>
      </div>
      <div class="table-wrap"><table class="validation-table">
        <thead><tr><th>Rank</th><th>Name</th><th>AHL Position</th><th>Category</th><th>Team</th><th>Availability</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>${rowMarkup || `<tr><td colspan="8" class="empty-state">${entries.length ? 'No list entries match these filters.' : 'Add players from Draft Board or Best Available.'}</td></tr>`}</tbody>
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
  const sourceRows = Object.entries(player.sourcesUsed || {})
    .map(([source, loaded]) => `<li>${escapeHtml(source)}: ${loaded ? 'loaded' : 'missing'}</li>`).join('');
  const missingRows = Object.keys(player.missingSources || {}).map((source) => `<li>${escapeHtml(source)}</li>`).join('');
  const scoreRows = [
    ['DS', player.deployment?.DS], ['RSS', player.deployment?.RSS], ['OS', player.deployment?.OS],
    ['RRS', player.deployment?.RRS], ['PPS', player.production?.PPS], ['BPS', player.prospect?.BPS],
    ['KVS', player.keeper?.KVS], ['DraftIQ', player.draftIQ], ['Adjusted DraftIQ', player.adjustedDraftIQ],
    ['Category Multiplier', player.keeper?.categoryMultiplier],
    ['Scarcity Multiplier', player.scarcityMultiplier], ['Keeper Inflation', player.keeperInflation],
    ['Price Curve Factor', player.priceCurveFactor],
  ];
  const scoreMarkup = scoreRows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value ?? 'NULL'}</dd></div>`).join('');
  return `<div class="draft-modal-backdrop" data-close-player-details>
    <section class="draft-modal panel" role="dialog" aria-modal="true" aria-labelledby="draftModalTitle">
      <button type="button" class="modal-close secondary" aria-label="Close player insights" data-close-player-details>Close</button>
      <h2 id="draftModalTitle">${escapeHtml(player.name)}</h2>
      <p>${escapeHtml(player.team || 'NULL')} | AHL Position ${escapeHtml(player.ahlPosition || player.position || 'NULL')} | Utility ${escapeHtml(player.utilityPosition || 'NULL')} | NHL Position ${escapeHtml(player.nhlPosition || 'NULL')} | ${escapeHtml(player.category || 'NULL')} | Tier ${player.tier ?? 'NULL'}</p>
      <p><strong>Auction value:</strong> ${player.auctionValue === null ? 'UNPRICED' : money(player.auctionValue)}
        <strong>Recommended max bid:</strong> ${money(recommendation)}</p>
      ${player.valuationStatus !== 'priced' ? '<p class="warning-banner">UNPRICED - required source-backed inputs are missing. No auction value or max bid is estimated.</p>' : ''}
      <div class="draft-score-grid">${scoreMarkup}</div>
      <div class="detail-grid">
        <article class="detail-card"><h3>WHY VALUE?</h3><ul>${(player.strengths || []).map(escapeHtml).map((text) => `<li>${text}</li>`).join('') || '<li>No source-backed strengths available.</li>'}</ul></article>
        <article class="detail-card"><h3>WHY RISK?</h3><ul>${(player.risks || []).map(escapeHtml).map((text) => `<li>${text}</li>`).join('') || '<li>No source-backed risks available.</li>'}</ul></article>
      </div>
      <details><summary>Data sources and missing inputs</summary><div class="detail-grid">
        <article class="detail-card"><h3>Sources</h3><ul>${sourceRows}</ul></article>
        <article class="detail-card"><h3>Missing sources / metric inputs</h3><ul>${missingRows || '<li>No missing-source flags.</li>'}</ul></article>
      </div></details>
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
  teamBudgets,
  teamNames,
  selectedPlayer,
  selectedTeam,
  sourceAvailability,
  toolsHtml,
  workspaceHtml,
}) {
  const allPositions = [...new Set(players.map((player) => player.ahlPosition || player.position).filter(Boolean))].sort();
  const filtered = players.filter((player) => {
    const matchesSearch = !search || `${player.name} ${player.team || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesPosition = !positionFilter || getAhlPlayerPositions(player).includes(positionFilter);
    const matchesCategory = !categoryFilter || player.category === categoryFilter;
    const isAvailable = availableKeys.has(normalizeLookupKey(player.name));
    const matchesAvailability = availabilityFilter === 'all'
      || (availabilityFilter === 'available' ? isAvailable : !isAvailable);
    return matchesSearch && matchesPosition && matchesCategory && matchesAvailability;
  });
  const bestPlayers = players.filter((player) => availableKeys.has(normalizeLookupKey(player.name)));
  const sortKeys = { AuctionValue: 'auctionValue', DraftIQ: 'draftIQ', PPS: 'production.PPS', BPS: 'prospect.BPS', KVS: 'keeper.KVS' };
  const readSortValue = (player, key) => key.split('.').reduce((value, part) => value?.[part], player);
  bestPlayers.sort((left, right) => {
    const key = sortKeys[bestAvailableSort] || 'auctionValue';
    const leftValue = readSortValue(left, key);
    const rightValue = readSortValue(right, key);
    if (leftValue === null || leftValue === undefined) return rightValue === null || rightValue === undefined ? left.name.localeCompare(right.name) : 1;
    if (rightValue === null || rightValue === undefined) return -1;
    return rightValue - leftValue || left.name.localeCompare(right.name);
  });
  const tab = (id, label) => `<button type="button" role="tab" aria-selected="${activeTab === id}" data-dashboard-tab="${id}">${label}</button>`;
  const selected = (value, current) => value === current ? 'selected' : '';
  const sourceRows = Object.entries(sourceAvailability || {}).map(([name, loaded]) => `<tr><td>${escapeHtml(name)}</td><td>${loaded ? 'Available' : 'Missing'}</td></tr>`).join('');
  const boardPanel = `<section id="draft-board-panel" class="dashboard-panel" role="tabpanel" ${activeTab === 'draft-board' ? '' : 'hidden'}>
    <div class="panel draft-board-panel">
      <div class="preview-header"><div><h2>Draft Board</h2><p class="panel-subtitle">Source-backed values only; missing values remain unpriced.</p></div>
        <span class="meta-pill">${availableKeys.size} available</span></div>
      <div class="draft-board-filters">
        <label>Search <input id="draftBoardSearch" type="search" value="${escapeHtml(search)}" placeholder="Player or NHL team" /></label>
        <label>Position <select id="draftPositionFilter"><option value="">All positions</option>${allPositions.map((position) => `<option ${selected(position, positionFilter)}>${escapeHtml(position)}</option>`).join('')}</select></label>
        <label>Category <select id="draftCategoryFilter"><option value="">All categories</option>${['Farm', 'Rookie', 'Veteran'].map((category) => `<option ${selected(category, categoryFilter)}>${category}</option>`).join('')}</select></label>
        <label>Availability <select id="draftAvailabilityFilter"><option value="all" ${selected('all', availabilityFilter)}>All</option><option value="available" ${selected('available', availabilityFilter)}>Available</option><option value="unavailable" ${selected('unavailable', availabilityFilter)}>Unavailable</option></select></label>
      </div>
      ${renderPlayerTable(filtered, shortlist, availableKeys, personalDraftList)}
    </div>
  </section>`;
  const bestPanel = `<section id="best-available-panel" class="dashboard-panel" role="tabpanel" ${activeTab === 'best-available' ? '' : 'hidden'}>
    <div class="panel"><div class="preview-header"><div><h2>Best Available</h2><p class="panel-subtitle">Draftable players only. Unpriced records are retained and labeled.</p></div>
      <label>Sort by <select id="bestAvailableSort">${Object.keys(sortKeys).map((key) => `<option ${selected(key, bestAvailableSort)}>${key}</option>`).join('')}</select></label></div>
      ${renderPlayerTable(bestPlayers, shortlist, availableKeys, personalDraftList, { showAvailable: false })}
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
