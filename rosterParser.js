/**
 * rosterParser.js
 * Parses CSV roster data and converts it to an array of player objects
 */

/**
 * Parses CSV roster data
 * @param {string} csvData - Raw CSV data with headers
 * @returns {Object} Object containing players, teams, goalieFranchises, and contacts
 */
function parseRoster(csvData) {
  const lines = csvData.trim().split('\n');
  
  if (lines.length === 0) {
    return {
      players: {},
      teams: {},
      goalieFranchises: [],
      contacts: {}
    };
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Initialize result structure
  const result = {
    players: {},
    teams: {},
    goalieFranchises: [],
    contacts: {}
  };
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; // Skip empty lines
    
    const values = parseCSVLine(lines[i]);
    const player = {};
    
    headers.forEach((header, index) => {
      player[header.toLowerCase()] = values[index] || '';
    });
    
    // Use player name as key, or index if no name
    const playerKey = player.name || `player_${i}`;
    result.players[playerKey] = player;
    
    // Track teams
    if (player.nhlteam) {
      if (!result.teams[player.nhlteam]) {
        result.teams[player.nhlteam] = [];
      }
      result.teams[player.nhlteam].push(playerKey);
    }
  }
  
  return result;
}

/**
 * Parses a single CSV line, handling quoted values
 * @param {string} line - A single CSV line
 * @returns {Array} Array of values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

/**
 * Filters roster by position
 * @param {Object} roster - Parsed roster object
 * @param {string} position - Position to filter by
 * @returns {Object} Filtered players by position
 */
function filterByPosition(roster, position) {
  const filtered = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    if (player.position === position) {
      filtered[key] = player;
    }
  });
  return filtered;
}

/**
 * Filters roster by NHL team
 * @param {Object} roster - Parsed roster object
 * @param {string} nhlTeam - NHL team to filter by
 * @returns {Object} Filtered players by NHL team
 */
function filterByNHLTeam(roster, nhlTeam) {
  const filtered = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    if (player.nhlteam === nhlTeam) {
      filtered[key] = player;
    }
  });
  return filtered;
}

/**
 * Filters roster by owner
 * @param {Object} roster - Parsed roster object
 * @param {string} owner - Owner name to filter by
 * @returns {Object} Filtered players by owner
 */
function filterByOwner(roster, owner) {
  const filtered = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    if (player.owner === owner) {
      filtered[key] = player;
    }
  });
  return filtered;
}

/**
 * Gets players with a specific status (prospect, veteran, farm)
 * @param {Object} roster - Parsed roster object
 * @param {string} status - Status type to filter by
 * @returns {Object} Filtered players by status
 */
function filterByStatus(roster, status) {
  const filtered = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    if (player[status.toLowerCase()] === 'true' || player[status.toLowerCase()] === '1') {
      filtered[key] = player;
    }
  });
  return filtered;
}

/**
 * Sorts roster by cost (highest to lowest)
 * @param {Object} roster - Parsed roster object
 * @returns {Array} Array of player objects sorted by cost
 */
function sortByCost(roster) {
  return Object.entries(roster.players)
    .map(([key, player]) => ({ ...player, playerKey: key }))
    .sort((a, b) => parseFloat(b.cost || 0) - parseFloat(a.cost || 0));
}

/**
 * Groups roster by owner
 * @param {Object} roster - Parsed roster object
 * @returns {Object} Roster grouped by owner
 */
function groupByOwner(roster) {
  const grouped = {};
  Object.entries(roster.players).forEach(([key, player]) => {
    const owner = player.owner || 'Unknown';
    if (!grouped[owner]) {
      grouped[owner] = {};
    }
    grouped[owner][key] = player;
  });
  return grouped;
}

if (typeof window !== 'undefined') {
  window.parseRoster = parseRoster;
}

export {
  parseRoster,
  parseCSVLine,
  filterByPosition,
  filterByNHLTeam,
  filterByOwner,
  filterByStatus,
  sortByCost,
  groupByOwner
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseRoster,
    parseCSVLine,
    filterByPosition,
    filterByNHLTeam,
    filterByOwner,
    filterByStatus,
    sortByCost,
    groupByOwner
  };
}
