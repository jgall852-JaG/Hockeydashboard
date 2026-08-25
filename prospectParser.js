// prospectParser.js

function createPlayerId(name) {
    if (!name) return "";

    // Remove diacritics, lowercase, then collapse non-alphanumerics to dashes
    const normalized = String(name)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

    return normalized
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            // Handle escaped quotes: "" inside a quoted field represents a literal quote
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // skip the escaped quote
                continue;
            }

            inQuotes = !inQuotes;
            continue;
        }

        if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current.trim());
    return result;
}

function extractPlayerName(rawName) {
    if (!rawName) return "";

    let name = String(rawName).trim();

    // Remove common trailing patterns like " LW - 2024", " - 2024 (LW)", or just " - 2024"
    name = name.replace(/\s*(?:\(|\s)?(LW|RW|C|D)(?:\)|\s)?\s*-\s*\d{4}$/i, "");
    name = name.replace(/\s*-\s*\d{4}\s*(?:\(|\s)?(LW|RW|C|D)?(?:\)|\s)?$/i, "");
    name = name.replace(/\s*-\s*\d{4}$/, "");

    return name.trim();
}

function extractDraftYear(rawName) {
    if (!rawName) return null;

    const match = String(rawName).trim().match(/(\d{4})$/);
    return match ? Number(match[1]) : null;
}

function extractPoolPosition(rawName) {
    if (!rawName) return "";

    const name = String(rawName).trim();
    const match = name.match(/\b(C|LW|RW|D|G|F|LD|RD)\b(?=\s*-\s*\d{4}\s*$|\s*$)/i);
    return match ? match[1].toUpperCase() : "";
}

function parsePlayerRow(columns, owner) {
    const rawPlayer = columns[0];
    if (!rawPlayer) return null;

    const playerName = extractPlayerName(rawPlayer);
    const draftYear = extractDraftYear(rawPlayer);
    const poolPosition = extractPoolPosition(rawPlayer);

    // Robust cost and term parsing: handle costs that may be split by commas (e.g., $1,200.50)
    // Try different lengths for the cost field (1..4 columns) and pick the one where the following column
    // looks like a termRemaining (FARM or integer) or is empty.
    let cost = 0;
    let termRemaining = null;
    let farm = false;

    const maxCostCols = Math.min(4, Math.max(1, columns.length - 1));
    let costParsed = false;

    for (let k = 1; k <= maxCostCols; k++) {
        const costCandidate = columns.slice(1, 1 + k).join(',').trim();
        const termCandidate = (columns[1 + k] || '').trim();

        const termLooksLikeFarm = /^\s*FARM\s*$/i.test(termCandidate);
        const termLooksLikeInt = /^\s*\d+\s*$/.test(termCandidate);
        const termLooksEmpty = termCandidate === '';

        if (termLooksEmpty || termLooksLikeFarm || termLooksLikeInt) {
            // parse costCandidate into a number: remove currency and commas
            const cleaned = String(costCandidate).replace(/[^0-9.\-]/g, '');
            const parsed = cleaned === '' ? 0 : Number(cleaned);
            if (!Number.isNaN(parsed)) {
                cost = parsed || 0;
                // set termRemaining based on termCandidate
                farm = termLooksLikeFarm;
                if (!farm) {
                    if (termLooksLikeInt) {
                        termRemaining = Number(termCandidate);
                    } else {
                        termRemaining = termLooksEmpty ? null : null;
                    }
                } else {
                    termRemaining = null;
                }

                // shift columns for later fields by k (we'll compute matchingRights using absolute index)
                costParsed = true;
                break;
            }
        }
    }

    if (!costParsed) {
        // fallback: try columns[1] as cost
        const costStr = String(columns[1] || '').replace(/[^0-9.\-]/g, '');
        cost = costStr === '' ? 0 : Number(costStr) || 0;
        const termRemainingRaw = columns[2] || '';
        farm = String(termRemainingRaw).trim().toUpperCase() === 'FARM';
        if (!farm) {
            const n = Number(String(termRemainingRaw).trim());
            termRemaining = Number.isFinite(n) && !Number.isNaN(n) ? n : null;
        } else {
            termRemaining = null;
        }
    }

    // Matching Rights column is the 7th column (index 6) in the CSV header
    const matchingRights = String(columns[6] || '').trim().toUpperCase() === 'Y';

    return {
        playerId: createPlayerId(playerName),
        name: playerName,
        owner,
        cost,
        prospect: true,
        farm,
        termRemaining,
        matchingRights,
        draftYear,
        poolPosition,
    };
}

export function parseProspects(csvData) {
    const prospects = {};
    const farmPlayers = [];
    const owners = {};
    let currentOwner = null;

    const rows = csvData.split(/\r?\n/);

    rows.forEach(row => {
        if (!row.trim()) return;

        const cols = parseCSVLine(row);
        const first = (cols[0] || "").trim();
        if (!first) return;

        // Skip headers
        if (first === "TEAMS" || first === "COST") return;

        // Team row
        const isTeamRow =
            first === first.toUpperCase() && !first.includes("$") && cols[1] === "";

        if (isTeamRow) {
            currentOwner = first;
            owners[currentOwner] = [];
            return;
        }

        if (!currentOwner) return;

        const prospect = parsePlayerRow(cols, currentOwner);
        if (!prospect) return;

        prospects[prospect.playerId] = prospect;
        owners[currentOwner].push(prospect.playerId);

        if (prospect.farm) {
            farmPlayers.push(prospect.playerId);
        }
    });

    return {
        prospects,
        farmPlayers,
        owners,
    };
}


// ----------------------------
// Helper Queries
// ----------------------------

export function getFarmPlayers(prospectData) {
    return Object.values(prospectData.prospects).filter(player => player.farm);
}

export function getRightsPlayers(prospectData) {
    return Object.values(prospectData.prospects).filter(player => player.matchingRights);
}

export function getProspectsByTerm(prospectData, years) {
    return Object.values(prospectData.prospects).filter(player => player.termRemaining === years);
}

export function getProspectsByOwner(prospectData, owner) {
    return Object.values(prospectData.prospects).filter(player => player.owner === owner);
}
