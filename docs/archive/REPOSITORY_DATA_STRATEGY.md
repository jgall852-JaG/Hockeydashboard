# Repository Data Strategy

## Summary
The project is intentionally local-first: local CSV imports remain authoritative, NHL API information is enrichment only, and the app is built to work even when the live feed fails. That design is sound, but it needs a disciplined repository data strategy so a user can pull the repo and launch the dashboard without needing a hidden or machine-specific runtime setup.

The goal is simple: a user should be able to `git pull`, run the dashboard, and have everything required without hunting for missing files or re-creating local state.

## Findings

### 1. The app is built around local CSV authority
The project’s source-of-truth rule is already clear: imported local data remains the authoritative layer; live data enriches it but does not replace it.

This is the right principle for both reliability and portability.

### 2. The repo should hold the stable, reproducible data layer
The dashboard depends on a mix of:
- app code
- parser logic
- reference metadata
- roster data
- scoring metadata
- optional cached enrichment
- user-created state

Not every piece of that belongs in Git.

### 3. The real risk is soft state and stale user data
The app stores browser-specific state in `localStorage`, which is useful for the browser app but not an appropriate long-term source of repository truth. It makes a strong case for a clean separation between:
- repo-managed baseline data
- loaded user data
- transient local browser state

## Data classification

### Must live in git
These are the core system assets and should be versioned in the repository:
- app code and UI files
- parser logic
- schema and documentation
- team/reference metadata used for identity and label consistency
- static scoring and league reference tables needed for output rendering
- small baseline reference datasets for roster and player identity where they are stable and shareable
- curated static files that support fresh-machine startup without network dependence

These are the things a user should get automatically when they pull the project.

### Should live in git when stable and shareable
These are good candidates for versioned repo storage when they are small, curated, and not user-specific:
- reference roster snapshots
- static team and conference/division metadata
- a baseline set of common player mappings
- curated league lookup data expressed as transparent reference files
- scoring tables and canonical lookup dictionaries
- minimal historical snapshots that are intentionally frozen rather than continuously regenerated

The key test is whether the data is deterministic, shareable, and needed to make the app launchable without custom setup.

### Should stay external
These should not be treated as core repo data:
- browser `localStorage` state
- user-specific manual overrides
- imported datasets created locally by the user during a session
- transient caches generated in the browser
- real-time NHL API responses used for enrichment
- private or league-specific drafts, trade info, or historical snapshots not intended to be shared
- large historical archives that are not needed for launch or default dashboard behavior

These should be generated or imported outside the repo, or treated as user-scoped ephemeral state.

## Repository design principles

### 1. Keep the repo reproducible
A user should be able to clone the project and start from a known static baseline.

### 2. Keep the repo lean
Large dynamic artifacts should not be checked into Git unless they are truly required for the startup path.

### 3. Keep the repo explicit
Every file in the repo should be clearly identified as one of:
- application logic
- reference data
- schema/docs
- generated cache
- user-generated input

### 4. Keep living data out of the core identity model
Live data should enrich the UI, not become the canonical source of truth. The repo should support this by storing static identity references and separate live enrichment caches.

## Proposed repository structure
A practical structure would look like this conceptually:

- `Data/Reference/` — static identity and league lookup metadata
- `Data/Rosters/` — stable roster snapshots and reference files
- `Data/Scoring/` — scoring tables and rating metadata
- `Data/Historical/` — curated frozen history, only if essential and small enough to version
- `Data/Drafts/` — future draft-related concept files, but not active V0.75 build artifacts

This is a planning structure only; it does not require a new architecture today. It simply clarifies what belongs in the branch and what stays out of it.

## Risks

- Hidden machine state: the dashboard may fail on a fresh machine because a crucial file or browser state is missing.
- Data drift: a static repo plus volatile external data creates confusion if the source-of-truth line is unclear.
- Storage bloat: keeping too much generated or user-specific data in Git makes the repo heavy and harder to use.
- Unclear ownership: the project may mix repo-managed data with ephemeral local data without explicit boundaries.

## Recommendations

### 1. Define clear repo boundaries [Critical]
The repository should hold the app and the stable reference layer; it should not be the home of user-generated browser state.

### 2. Keep static reference data in Git [Critical]
If a file is required for a fresh-machine or draft-day startup, it belongs in Git.

### 3. Treat live data and caches as external or local runtime artifacts [High]
These should be derived, cached, or imported rather than being the repo’s authoritative state.

### 4. Keep the project easy to pull and launch [High]
If a user can move from `git pull` to dashboard launch without manual repair, the repo strategy is working.

## Quick Wins

- Document the source-of-truth hierarchy for all data.
- Separate static reference files from ephemeral user cache files.
- Standardize folder names for reference, roster, scoring, and historical data.
- Keep the default launch path working with repo-backed data only.
- Ensure the app still renders when live enrichment is unavailable.

## Future Work

- Define a versioning and migration strategy for reference data.
- Add a small validation script to confirm that required reference data is present.
- Decide which historical datasets belong in Git and which should remain external.
- Prepare a draft-day release checklist that clearly states what is repo-backed and what is user-provided.

## Final recommendation
The repository should contain the app, its static reference layer, and enough versioned data to make a fresh-machine launch reliable. Everything dynamic, user-specific, or transient should stay outside the authoritative repo state. This preserves the project’s local-first design while making it resilient enough for draft-day use.
