# 🏒 PROJECT_CONTEXT.md

## Project Name

Hockey Dashboard

---

# Purpose

Hockey Dashboard is a local-first fantasy hockey management application.

The application imports league CSV exports and transforms them into a searchable, analytical dashboard for owners, prospects, veterans, farm systems, matching rights, draft preparation, and future league intelligence tools.

The long-term vision is to create a Fantasy Hockey Front Office platform.

---

# Development Principles

## Architecture

- Local-first
- Browser-based
- No backend
- No React
- No framework
- HTML + CSS + JavaScript

## Data

- CSV imports are source-of-truth
- Parser outputs remain authoritative
- No manual database maintenance
- All data stored locally

## Development Style

- Small iterative features
- Avoid large rewrites
- Preserve working features
- Build on existing architecture

---

# Current Version

v0.3c

---

# Technology Stack

Frontend:

- HTML
- CSS
- JavaScript

Persistence:

- localStorage

Testing:

- Jest

Version Control:

- Git
- GitHub

---

# Repository Structure

Parsers:

- prospectParser.js
- veteranParser.js
- rosterParser.js

Core UI:

- index.html
- styles.css
- app.js

Documentation:

- ROADMAP.md
- PROJECT_CONTEXT.md

---

# Completed Features

## Parser Layer

✅ Prospects Parser

Validated against:

- AHL Draft - Prospects.csv

Fixes:

- Matching Rights column mapping corrected

---

✅ Veterans Parser

Validated against:

- AHL Draft - Veterans.csv

Fixes:

- Trailing hyphen cleanup

---

✅ League Data Validation

Files:

- validateProspects.js
- validateVeterans.js
- validateLeagueData.js

---

## Import Workflow

✅ File Upload

- Drag and drop
- File picker

✅ Dataset Detection

Header-based detection

Supported:

- Prospects
- Veterans
- Roster
- Transactions

✅ Preview

- First 10 records

✅ Confirm Import

- Persists data locally

---

## Persistence Layer

Unified localStorage schema:

```js
{
  version: 1,

  datasets: {
    prospects: null,
    veterans: null,
    roster: null,
    transactions: null
  },

  metadata: {
    prospects: {},
    veterans: {},
    roster: {},
    transactions: {}
  }
}
```

Capabilities:

✅ Multiple datasets coexist

✅ Prospects + Veterans loaded simultaneously

✅ Migration support

✅ Reload persistence

---

# Owner View

Implemented

Capabilities:

✅ Owner list

✅ Prospect counts

✅ Veteran counts

✅ Farm counts

✅ Matching Rights counts

✅ Owner statistics

Including:

- Total Prospect Cost
- Average Prospect Cost
- Highest Cost Prospect

---

# Dashboard Summary

Implemented

Displays:

- Total Owners
- Total Prospects
- Total Veterans
- Total Farm Players
- Total Matching Rights

---

# Search

Implemented

Owner Search:

- Case-insensitive
- Real-time

Player Search:

- Case-insensitive
- Real-time

Applies to:

- Prospects
- Veterans
- Farm Players
- Matching Rights

---

# League Intelligence

Implemented

Displays:

- Owner with Most Prospects
- Owner with Most Veterans
- Owner with Most Farm Players
- Owner with Most Matching Rights
- Most Expensive Prospect
- Most Expensive Veteran

---

# Data Quality

Implemented

Displays:

- Dataset status
- Record counts
- Import timestamps
- Last updated timestamp

---

# Current Dataset Status

Supported:

✅ Prospects

✅ Veterans

⚠ Roster (basic support)

⚠ Transactions (basic support)

---

# Future Vision

The long-term goal is to create a league-specific valuation and draft intelligence platform.

Unlike standard fantasy tools, player value is determined using league-specific rules.

---

# League Value Factors

Player Value ≠ Projections Alone

Future valuation engine should consider:

- Position scarcity
- Games played
- First-half schedule
- Second-half schedule
- Playoff schedule
- Contract cost
- Farm eligibility
- Matching rights
- Age
- League-defined position weighting

Output:

```text
Expected Value
Current Cost
Difference

Assessment:

🟢 Undervalued
🟡 Fair Value
🔴 Overpriced
```

---

# Planned Versions

## v0.4

Prospect Explorer

Filters:

- Owner
- Farm
- Matching Rights
- Draft Year
- Cost

---

## v0.5

Draft War Room

Auction draft assistant:

- Draft board
- Current bids
- Target values
- Watchlist
- Overpay warnings

---

## v0.6

League Valuation Engine

Uses:

- Cost
- Scarcity
- Schedule
- Farm status
- League rules

---

## v0.7

Trade Analyzer

Compare:

- Prospect value
- Farm impact
- Matching rights
- Team impact

---

## v1.0

Fantasy Hockey Front Office

Includes:

- Owner intelligence
- Prospect explorer
- Veteran explorer
- Draft assistant
- Trade analyzer
- League valuation engine

---

# Rules For AI Assistants

When working on this repository:

DO:

✅ Reuse existing architecture

✅ Preserve parser outputs

✅ Preserve localStorage schema

✅ Build incrementally

✅ Explain implementation plans before coding

DON'T:

❌ Introduce React

❌ Introduce a backend

❌ Redesign parser architecture

❌ Rewrite working features

❌ Break upload workflow

---

# Current Status

The project has successfully evolved from a CSV parser project into a functioning hockey management dashboard.

Current milestone:

✅ Upload & Import

✅ Multi-Dataset Persistence

✅ Owner View

✅ Search

✅ Statistics

✅ League Intelligence

Next recommended milestone:

🎯 v0.4 Prospect Explorer
