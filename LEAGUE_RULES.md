# League Rules

This document captures the league-specific logic, valuation assumptions, and schedule intelligence used by the Hockey Dashboard. It is intended to serve as the canonical reference for future development, AI sessions, and feature planning.

This project is intentionally local-first and model-driven. The CSV imports remain the source of truth, while league-specific intelligence (such as GamesPlayedBulator outputs and valuation assumptions) informs future analytics and decision support.

---

# League Structure

## Team Count

- Number of teams is dynamic and derived from the owners present in imported league data.
- The dashboard should not assume a fixed team count in the UI or valuation logic.
- The current app treats owners as the unit of league structure.
- Future systems should calculate team totals from imported owner records rather than hard-coding a league size.

## Draft Format

- This league uses an auction draft format.
- Draft value is not based solely on raw player projections.
- Auction draft logic should consider cost, scarcity, team fit, schedule opportunity, and league-specific rules.
- Future valuation and draft tools should build from auction context, not a generic fantasy baseline.

## Prospect System

- Prospects are tracked as a distinct dataset in the dashboard.
- Prospect records are imported from the Prospects.csv dataset.
- Prospect value should consider:
  - cost
  - team ownership
  - farm status
  - matching rights
  - draft pedigree
  - position scarcity
  - schedule opportunity

## Veteran System

- Veterans are tracked as a distinct dataset in the dashboard.
- Veteran records are imported from the Veterans.csv dataset.
- Veteran value is influenced by:
  - contract cost
  - current role
  - workload
  - age
  - roster fit
  - eligible games
  - home/away schedule balance

## Farm System

- Farm players are tracked as a specialized subset of prospect data.
- Farm eligibility is a meaningful value input in this league.
- Future tools should treat farm status as a strategic asset, especially when evaluating top prospects and long-term value.
- Farm value is not equivalent to a raw prospect rank; it includes upside, availability, and roster flexibility.

## Matching Rights System

- Matching rights are a unique league mechanism.
- Matching rights are not treated as a cosmetic flag; they materially affect asset value.
- Matching rights should be considered in:
  - trade analysis
  - prospect valuation
  - owner rankings
  - draft decision support
- The dashboard already recognizes matching rights as a major ownership and valuation input.

---

# Position Rules

## League-Defined Positions

- Positions in this league are defined by league rules, not by standard fantasy hockey defaults.
- Position scarcity may differ from generic fantasy rankings or externally published values.
- The league may overvalue or undervalue certain roles relative to standard models.
- Valuation models must therefore consider league-defined position structure instead of assuming standard positional norms.

## Purpose of Position Rules

- Balance the league.
- Create scarcity.
- Reward strategic roster construction.
- Distinguish between premium and marginal roster spots.
- Prevent over-reliance on generic projections that ignore the league environment.

## Position Logic Future Guidance

- Value should scale based on scarcity and team need.
- Position strength should factor into expected value.
- Future tools should allow position filters and position-adjusted scoring models.
- This should remain league-aware rather than imported from a generic fantasy template.

---

# GamesPlayedBulator

## Purpose

The GamesPlayedBulator is a league-specific schedule intelligence dataset used to evaluate player opportunity in a way that is more useful than raw NHL games.

It measures eligible fantasy games under league-specific rules rather than simply counting total NHL games.

The purpose is to calculate fantasy-relevant availability and opportunity, not schedule volume in its raw form.

## Core Rule

- Eligible night = 7+ NHL games scheduled.
- GamesPlayedBulator output is considered authoritative.
- Playoffs are handled separately and are not part of the GamesPlayedBulator calculations.

## Output Fields

Each team contains the following values:

- Home eligible games
- Away eligible games
- Total eligible games

These values are more important for valuation than raw NHL calendar data because they reflect actual player opportunity under league-specific thresholds.

## Example Values

League average:

- 62.1 eligible games

High totals:

- Nashville: 69
- Dallas: 68
- Montreal: 68
- Boston: 67
- Edmonton: 67
- Minnesota: 67

Low totals:

- Anaheim: 52
- Utah: 52
- Chicago: 55
- Calgary: 57

## Interpretation

- A team with more total eligible games has more fantasy opportunity available to its players.
- Home and away splits matter because schedule context may affect lineup usage, team deployment, and roster flexibility.
- This dataset is one of the key inputs for league intelligence and valuation modeling.

## Future Use Cases

The GamesPlayedBulator should be used in future systems such as:

- Prospect Explorer
- Draft War Room
- League Valuation Engine
- Trade Analyzer
- Intelligence Database

---

# Schedule Intelligence

Schedule matters because fantasy value is not purely a stat-line question. It is also about opportunity.

## Why Eligible Games Matter

- More eligible games generally means more opportunity to produce value.
- It helps distinguish between players on teams with year-long continuity and players on teams with constrained game windows.
- It improves the realism of player value modeling beyond static projections.

## Why Home and Away Eligible Games Matter

- Home and away splits provide directional context for opportunity.
- A team may have strong total eligible games but a weak home/away balance that affects player usage or lineup structure.
- Monitoring split data helps identify schedule-driven advantages or disadvantages.

## Why First-Half and Second-Half Schedule Matter

- First-half schedule and second-half schedule affect valuation timing.
- Players may be worth more when a team is in a stronger schedule stretch.
- Future valuation tools should incorporate schedule timing when comparing current value to future upside.

## Why Schedule Intelligence Matters in Valuation

- A player with a strong schedule profile may be undervalued by projections alone.
- A player with a poor schedule profile may be overvalued if only projected volume is considered.
- Schedule data helps explain where opportunity is strongest and where it is constrained.

## Playoff Handling

- League playoffs are handled separately.
- Go through the local playoff rules and separate playoff intelligence models.
- GamesPlayedBulator is not designed to include playoff calculations.

---

# League Valuation Philosophy

## Core Rule

Player value is not based solely on projections.

The project should prefer a league-specific valuation model over a generic fantasy baseline.

## Factors to Consider

Future valuation models should consider:

- Position scarcity
- Eligible games
- Home/away splits
- First-half schedule
- Second-half schedule
- Farm eligibility
- Matching rights
- Contract cost
- Age
- Draft pedigree
- Historical owner behavior
- League-specific position weighting
- League-specific rules

## Output Philosophy

A valuation system should produce outputs such as:

- Expected value
- Current cost
- Difference
- Undervalued rating
- Overvalued rating
- Fair value assessment

## Example Assessment Labels

- 🟢 Undervalued
- 🟡 Fair value
- 🔴 Overpriced

## Future Intelligence Goal

The long-term goal is to answer questions such as:

- Who should I draft?
- What is this player worth?
- Am I overpaying?
- Who has the best prospect pool?
- What trades improve my team?
- Which prospects are undervalued?
- Which owners have surplus assets?

---

# Future Systems

## Prospect Explorer

Planned features:

- owner filter
- farm filter
- matching rights filter
- draft year filter
- cost range filter
- prospect search
- position search

This system should become a primary scouting and valuation surface for prospect decisions.

## Draft War Room

Planned features:

- live auction draft board
- current bid tracking
- target value calculation
- draft watchlists
- drafted player tracking
- value alerts

Outputs should categorize players as:

- bargain
- fair value
- overpay

## League Valuation Engine

Planned inputs:

- NHL statistics
- schedule data
- league costs
- position scarcity
- farm status
- matching rights
- age and pedigree

Planned outputs:

- expected league value
- current cost
- difference
- undervalued rating
- overvalued rating

## Trade Analyzer

Planned features:

- team A vs team B comparison
- asset comparison
- future value comparison
- farm impact analysis
- matching rights impact

This should help owners evaluate whether a trade improves long-term value and roster structure.

## Intelligence Database

Purpose:

- create a research warehouse for league intelligence
- centralize historical and external data sources
- improve future valuation and AI-assisted decision support

This database will likely incorporate:

- PDFs
- Excel files
- CSV files
- NHL data
- draft guides
- scouting reports
- historical auction results
- owner behavior data

---

# Data Sources

## League Data

The current application is built around local league CSV imports:

- Prospects.csv
- Veterans.csv
- Roster.csv
- Transactions.csv

These datasets remain authoritative for the current dashboard and should be preserved without redesigning parser or upload workflows.

## Intelligence Sources

Current and future intelligence inputs include:

- GamesPlayedBulator
- NHL API
- NHL EDGE
- Historical statistics
- Draft guides
- Excel projections
- PDF reports
- Auction history
- Internal league export histories
- Personal research and league notes

## Notes

- League data and intelligence data should remain distinct layers.
- Local CSV imports are operational data.
- Intelligence layers support valuation, ranking, and decision support.
- The system should extend organically from current data sources instead of forcing a rebuild.

---

# Design Principles for Future AI and Future Development

- Reuse the existing architecture.
- Preserve working features.
- Preserve parser outputs and upload logic.
- Keep storage local-first.
- Prefer league-aware valuation over generic projection-only logic.
- Prefer decision support over cosmetic UI work.
- Keep metrics understandable and transparent.
- Document assumptions explicitly so future sessions do not lose context.

---

# Summary

This document defines the league-specific logic that distinguishes Hockey Dashboard from a generic fantasy tool. The key idea is simple:

- Value is not just projections.
- Opportunity matters.
- Schedule matters.
- Position scarcity matters.
- League context matters.

The long-term goal is a Fantasy Hockey Front Office that blends owner intelligence, prospect evaluation, veteran analysis, draft support, and trade modeling into one league-specific platform.
