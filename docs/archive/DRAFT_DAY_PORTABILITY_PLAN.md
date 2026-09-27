# Draft-Day Portability Plan

## Summary
The dashboard is already a local-first browser app with a clean, no-framework architecture. The real draft-day risk is not hockey logic; it is portability. On draft day, the user may be on a different laptop, in a different browser, with a different `localStorage` state, and without a desktop machine available to power the workflow.

The portability question is therefore simple: can the dashboard survive a draft laptop, a fresh machine, and a short-lived connection profile? The answer is yes, if the project is designed around a reliable launch path that does not depend on one machine or one browser state.

## Findings

### 1. The app is inherently local-first, which is a strength
The project already uses:
- browser-first local rendering
- local CSV imports
- localStorage persistence
- optional NHL enrichment
- a source-of-truth model that preserves local data

This is a good draft-day foundation because the app can run without a server when the data is present.

### 2. The biggest portability risk is not code execution; it is user setup
The risk is that the user cannot immediately open the dashboard on a new machine because the app depends on:
- a specific machine environment
- a specific browser profile
- a specific local data state
- a powered desktop machine or persisted browser state

### 3. Reliable draft-day access requires repeatable launch steps
A draft laptop needs a simple command or workflow that does not require one-off troubleshooting. The more complexity required to start the app, the more likely the dashboard fails under time pressure.

### 4. The recommended path is resilient, not exotic
The best draft-day design is one that preserves the app’s current architecture while reducing setup friction. That means keeping the dashboard simple to run and easy to rehydrate.

## Option review

### Option A: GitHub-only workflow
This means the user pulls the repo and runs the dashboard directly from the checked-in project files.

Pros:
- simple and transparent
- keeps everything in one source of truth
- easy to share and audit
- works well for static browser apps

Cons:
- still depends on the user knowing how to launch the app locally
- still depends on local browser state if the project expects prior imports or browser persistence
- not enough if the laptop is offline or the repo is not fully self-contained

Verdict:
- viable as the primary source of truth
- not robust enough as the only draft-day workflow

### Option B: Portable package workflow
This means a packaged bundle or self-contained folder is prepared ahead of time, including the app and required data.

Pros:
- works on a different laptop without setup complexity
- portable across machines
- easiest path for a quick launch under time pressure
- resilient to browser profile differences and local environment differences

Cons:
- requires a prebuilt package or export step
- must be carefully versioned to avoid stale data
- still needs a simple launch method

Verdict:
- strongest single fallback for draft day
- should be treated as the practical emergency plan

### Option C: Cloud-hosted workflow
This means storing or serving the dashboard remotely.

Pros:
- central access point
- usable from multiple devices
- easy to share a single environment

Cons:
- fails if the laptop lacks internet access
- depends on the desktop or remote service staying online
- introduces a dependency on cloud connectivity at the moment decisions are made
- not aligned with the project’s current local-first posture

Verdict:
- useful as a convenience layer
- not reliable enough as the primary draft-day plan

### Option D: Hybrid workflow
This means combining GitHub as the canonical source with a portable local bundle and optional cloud access as a convenience layer.

Pros:
- best resilience
- supports both offline and online work
- aligns with the project’s local-first architecture
- gives the user a clean fallback when the desktop is unavailable

Cons:
- requires a bit more documentation and operational discipline
- needs a clear versioning and refresh process

Verdict:
- best overall strategy for a real draft environment

## Recommendation
Use a hybrid workflow for V0.75. [Critical]

The repository should remain the long-lived source of truth, but the user should also have a portable package or launch bundle that can be used on a draft laptop without depending on a desktop machine or a particular browser state.

Minimum practical design:
- GitHub repo is the canonical project state
- user can `git pull` or use a known release bundle
- portable bundle includes the dashboard and required static reference data
- local browser storage is treated as ephemeral and not the system’s primary reliability mechanism
- live data remains optional enrichment, not a critical startup dependency

### Recommended deployment architecture [Critical]
- GitHub-backed repository as source of truth
- portable local bundle for laptop/offline operation
- optional cloud access as convenience layer only
- localStorage treated as ephemeral and non-authoritative

### Supporting actions [High]
- publish a one-minute launch checklist
- keep repo launch path valid on fresh machines
- maintain a release bundle or zip for draft-day emergencies
- document the exact data required to run without a desktop machine

## Risks

- Browser storage mismatch: the same user may have different local data on different laptops.
- Desktop dependency: if the dashboard requires one machine to be active, it cannot survive draft day.
- User error: unclear launch steps create delay and stress.
- Version drift: a draft laptop may run stale code if not clearly versioned.
- Data mismatch: local imports may not match the current reference state if the user has not refreshed.

## Recommendations

### 1. Treat GitHub as canonical, not incidental
The dashboard should be maintainable from the repository and easy to pull on a fresh machine.

### 2. Produce a portable bundle for draft use
This can be a prebuilt folder, zip, or release artifact that includes the required assets and runs via a simple static server.

### 3. Define a no-guess launch checklist
The user should know exactly how to start the dashboard in under one minute.

### 4. Keep live data and local data distinct
The app should never depend on a machine-specific local state for basic startup. The core product should work from repository data plus imported datasets.

### 5. Add a draft-day fallback path
If the laptop has no desktop state, the user should still be able to open the dashboard and continue from a known-good local bundle.

## Quick Wins

- Publish a single repo launch path with a one-minute setup procedure.
- Keep the repo self-contained enough to open after a fresh machine clone.
- Maintain a portable bundle or zip release for emergency draft-day usage.
- Document exactly what data is required to get the dashboard working without a desktop machine.
- Require version tags so users know which runbook matches the data they are using.

## Future Work

### Future V1.0 concept (placeholder only)
This is not a build target for V0.75. It is a conceptual placeholder only.

Player + Owner + Cost + Term + Rights + Farm + Prospect + Veteran

This concept describes a future draft hub where player decisions are evaluated in a richer context: ownership, contract cost, term, rights, farm implications, prospect pipeline, and veteran roster impact.

## Final recommendation
The project should be designed for a draft-day laptop to work from a portable, repo-backed, low-friction path. The most reliable plan is a hybrid model: GitHub as the source of truth, a portable local bundle as the emergency execution path, and cloud access only as a convenience layer—not as the core requirement.
