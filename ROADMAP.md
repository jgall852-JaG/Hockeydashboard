Hockey Dashboard Roadmap

Generated: 2026-08-15T21:43:19.070-04:00

Overview

This roadmap records completed milestones and proposed future versions for the Hockey Dashboard project. It builds on the existing local-first, no-framework architecture and the unified localStorage schema implemented through v0.3c-phase1.

Completed

- ✅ v0.1 — Upload & Import
  - Goal: Provide CSV upload, preview, and confirm import flow.
  - Key outcomes: Prospects & Veterans parsers validated; client-side storage of parsed data; preview and confirm import UX.

- ✅ v0.2 — Owner View
  - Goal: Aggregate imported datasets into an owner-centric dashboard.
  - Key outcomes: Unified multi-dataset state persisted in localStorage; Owner View lists owners and shows per-owner players across datasets.

- ✅ v0.3 — Dashboard Summary, Search, League Intelligence (v0.3c Phase 1 completed)
  - Goal: Provide summary metrics, searchable owner/player views, and league-level insights.
  - Key outcomes: Dashboard summary (totals), owner/player search (real-time, case-insensitive), owner statistics (counts and cost metrics), league intelligence cards, data quality panel, dataset status badges, and persistence across page reloads.

Suggested Future Versions

v0.4 — Owner Rankings
- Goal
  - Provide sortable/ranking views to find top owners by various metrics and support exportable leaderboards.
- Features
  - Owner ranking table (sortable by prospects, veterans, farm players, matching rights, total prospect cost).
  - Pagination / top-N selector and quick filters (e.g., show top 10).
  - Click-through from ranking row to focused Owner View.
  - Export CSV of rankings.
- Dependencies
  - Reuse computeOwnerAggregates and existing owner data structures.
  - Minor UI components for table sorting and pagination.
- Priority
  - High — Useful for immediate league analysis and complements existing intelligence cards.

v0.5 — Prospect Explorer
- Goal
  - Provide an explorer interface for prospect scouting and multi-criteria filtering.
- Features
  - Filter prospects by year, cost range, term, matching rights, farm status, position.
  - Sort by cost, age, or projected metrics (if present).
  - Multi-select owners and compare prospect sets side-by-side.
- Dependencies
  - Prospect parsing outputs (no parser changes) and owner aggregates.
  - UI components for advanced filtering and multi-column lists.
- Priority
  - Medium — Adds depth to prospect analysis; valuable for power users.

v0.6 — Veteran Explorer
- Goal
  - Provide an analytics surface for veteran players (contracts, cost, roster fit).
- Features
  - Veteran list view with filters for season, cost, term, team/owner.
  - Aggregates for veteran payroll and veteran counts by owner.
  - Quick view of the most expensive veterans and trends.
- Dependencies
  - Veteran parser outputs; computeOwnerAggregates extension for veteran cost metrics.
- Priority
  - Medium — Complements Prospect Explorer and Owner Rankings.

v0.7 — Trade Analyzer
- Goal
  - Allow owners to model and evaluate trade proposals and their impact on roster/finance metrics.
- Features
  - Propose multi-player trades between owners.
  - Instant recalculation of owner statistics (prospect/veteran counts, costs, matching rights, farm changes).
  - Allow side-by-side owner snapshots pre/post-trade and exportable trade summaries.
- Dependencies
  - Deterministic owner data model; ability to clone/simulate state in-memory without persisting.
  - UI for drag/drop trade building or selection-based proposals.
- Priority
  - Medium-High — High value for users doing active roster management and negotiation.

v0.8 — Salary Cap Dashboard
- Goal
  - Provide deeper financial analysis of veteran costs and cap-like constraints for leagues that track money.
- Features
  - Veteran cost breakdowns by owner, projected totals, highest cost veterans, and aggregate veteran payroll.
  - Alerts and visualizations for owners approaching configurable thresholds.
  - Historical import snapshots (lightweight) to show trendlines if multiple import timestamps are available.
- Dependencies
  - Veteran dataset with cost fields; optional light-weight snapshots feature to preserve past states (in-memory or localStorage as optional extension).
- Priority
  - Low-Medium — Specialized feature; high value for finance-focused leagues but depends on consistent cost data.

v0.9 — League Reports
- Goal
  - Generate printable/exportable league reports summarizing owners, prospects, veterans, and key analytics.
- Features
  - Customizable report templates (Summary, Top Prospects, Veteran Payroll, Owner Rankings).
  - Export to PDF/print-friendly HTML and CSV data extracts.
  - Scheduled export or manual snapshotting.
- Dependencies
  - Existing aggregates and ranking outputs; a client-side PDF generation helper (optional third-party library if needed).
- Priority
  - Low — Nice-to-have for league commissioners and for sharing insights externally.

Cross-cutting considerations
- No framework, local-first: continue building in plain JS and persist in localStorage; avoid introducing servers or backend dependencies.
- Parser stability: Do not change parser files; future features must consume existing parser outputs as-is.
- Performance: For large datasets, consider incremental rendering, virtualization for long lists, or caching of compute-heavy aggregates.
- UX & Accessibility: Keep existing dark theme and responsiveness; add keyboard accessibility and contrast checks for new UI components.

Suggested next actions (short term)
1. Implement v0.4 Owner Rankings (High priority) — natural next increment that leverages computeOwnerAggregates and provides immediate user value.
2. Add automated integration test that simulates sequential imports and validates persisted unified state and computed aggregates.
3. After v0.4, begin v0.5 Prospect Explorer (Medium priority) focusing on filtering and comparison UX.

Contact / Notes
- This roadmap is generated from the current project status and constraints (no parser changes, no upload workflow changes, localStorage schema preserved).
- For any version that needs larger client-side storage (snapshots, history), propose schema extension and migration plan before implementation.

# =====================================================
# FUTURE VISION - FANTASY HOCKEY FRONT OFFICE
# =====================================================

## League Intelligence Philosophy

Player Value != Fantasy Projection

Player Value should consider:

- Position Scarcity
- Games Played
- First Half Schedule
- Second Half Schedule
- Playoff Schedule
- Farm Eligibility
- Matching Rights
- Contract Cost
- Age
- Draft Pedigree
- League-Specific Position Rules
- Owner Behavior Patterns

---

## Intelligence Data Sources

Location:

Hockey DB's

Sources:

- NHL API
- NHL EDGE Data
- Historical NHL Data
- Excel Projections
- Draft Guides
- Prospect Rankings
- Scouting Reports
- Historical Auction Results
- Historical League Exports
- Position Scarcity Models
- Personal Research

Potential Data Tools:

- nhl-api-py
- Fantasy-NHML
- Custom valuation models

---

## v0.4 Prospect Explorer

Features:

- Owner Filter
- Farm Filter
- Matching Rights Filter
- Draft Year Filter
- Cost Range Filter
- Prospect Search
- Position Search

---

## v0.5 Draft War Room

Features:

- Live Auction Draft Board
- Current Bid Tracking
- Target Value Calculation
- Draft Watchlists
- Drafted Player Tracking
- Value Alerts

Outputs:

- Bargain
- Fair Value
- Overpay

---

## v0.6 League Valuation Engine

Inputs:

- NHL Statistics
- Schedule Data
- League Costs
- Position Scarcity
- Farm Status
- Matching Rights

Outputs:

- Expected League Value
- Current Cost
- Difference
- Undervalued Rating
- Overvalued Rating

---

## v0.7 Trade Analyzer

Features:

- Team A vs Team B
- Asset Comparison
- Future Value Comparison
- Farm Impact Analysis
- Matching Rights Impact

---

## v0.8 Intelligence Database

Purpose:

Build a hockey research warehouse using:

- PDFs
- Excel Files
- CSV Files
- NHL Data
- Draft Guides
- Scouting Reports

Location:

C:\Users\galla\OneDrive\Desktop\Hockey DB's

---

## v1.0 Fantasy Hockey Front Office

Goals:

Answer:

- Who should I draft?
- What is this player worth?
- Am I overpaying?
- Who has the best prospect pool?
- What trades improve my team?
- Which prospects are undervalued?
- Which owners have surplus assets?

