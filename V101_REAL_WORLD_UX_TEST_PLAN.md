# V1.0.1 Real World UX Test Plan

## Purpose

This test plan prepares a realistic mock-draft usability review using actual league names and draft scenarios.

It is a planning and testing document only.

- no implementation
- no code
- no UI changes
- no new features

The goal is to verify that the Draft Hub is usable in real draft conditions for search, filtering, queueing, comparison, fit, scarcity, value, and confidence labeling.

---

## Test conditions

Use actual league names, real owner names, and real player scenarios from the current league data.

The test should use the current Google Sheet snapshot as the operational source of truth.

### Required setup

- current League Roster
- current Draft Log
- current Prospects
- current Veterans
- current draft order or current pick state
- current retention and roster state

---

## Priority rating scale

- Critical: blocks realistic mock-draft use
- High: strongly affects draft-day trust or speed
- Medium: useful but not immediately blocking
- Low: polish or secondary validation

---

## Test cases

### 1. Search

**Priority:** Critical

#### Scenario

Search for a real player by full name during a live draft moment.

#### What to verify

- the player can be found quickly
- full-name typing works without interruption
- the result matches the current sheet snapshot
- drafted players do not appear as available

#### Failure signal

- search input loses focus
- search results lag behind the board
- stale results remain visible after a roster update

---

### 2. Filters

**Priority:** High

#### Scenario

Filter the board by position and current draft context.

#### What to verify

- filters reflect the active player pool
- the filtered list is still relevant to the draft decision
- filters do not break board context

#### Failure signal

- filter state conflicts with current availability
- the filtered board looks correct but is actually stale

---

### 3. Queue

**Priority:** High

#### Scenario

Build a queue for the next several picks using real targets and backups.

#### What to verify

- targets can be added in priority order
- backups remain visible
- queue still makes sense after board changes

#### Failure signal

- the queue becomes misleading after a player is drafted
- the queue and board no longer agree

---

### 4. Best Available

**Priority:** Critical

#### Scenario

Review the best available player at the current pick.

#### What to verify

- the ranking reflects the latest snapshot
- the top players are understandable
- the recommendation matches the draft context

#### Failure signal

- best available is stale
- the top recommendation does not match the visible board

---

### 5. Comparison

**Priority:** High

#### Scenario

Compare two real players being considered for the same pick.

#### What to verify

- the comparison is easy to understand
- the comparison reflects actual board and roster context
- the comparison helps the GM choose, rather than distract

#### Failure signal

- the comparison lacks enough context to be actionable
- one player is no longer available but still appears in the comparison

---

### 6. Team Fit

**Priority:** High

#### Scenario

Review a pick against the current roster structure and team need.

#### What to verify

- team need is based on current roster data
- the fit explanation feels grounded in actual roster gaps
- the system can distinguish need from preference

#### Failure signal

- fit is based on stale roster state
- the recommended player fits the board but not the actual team needs

---

### 7. Scarcity

**Priority:** High

#### Scenario

Check whether a position is thinning out before the next pick.

#### What to verify

- scarcity is visible quickly
- the user can tell whether to wait or act now
- the scarcity signal matches the actual pool

#### Failure signal

- scarcity is misleading because the player pool is stale
- the signal is too vague to guide a decision

---

### 8. Value Profile

**Priority:** Medium

#### Scenario

Review the value profile of a candidate player relative to the current board.

#### What to verify

- the profile can be read quickly
- the value message is understandable
- the player is clearly above, within, or below the value band

#### Failure signal

- the value signal is too ambiguous to be useful in draft pressure

---

### 9. Confidence Labels

**Priority:** Medium

#### Scenario

Review confidence labeling for a likely pick.

#### What to verify

- the label is easy to interpret
- the label matches the strength of the supporting evidence
- the label helps the GM decide faster

#### Failure signal

- the confidence label feels arbitrary
- the label conflicts with the visible comparison and fit data

---

## Suggested real-world scenarios

Use actual league-style scenarios such as:

- a top player is nominated early in the auction
- a positional need appears while budgets are still flexible
- a snake draft turn comes up and the queue is at risk
- a player the GM wants is just ahead of the next pick
- a comparison is needed between best value and best fit

Use real owner names and real player names from the current sheets when running the test.

---

## Test execution order

1. Refresh the current sheet snapshot
2. Verify roster and draft state
3. Run search validation
4. Run filter validation
5. Run queue validation
6. Run best available validation
7. Run comparison validation
8. Run team fit validation
9. Run scarcity validation
10. Run value profile validation
11. Run confidence label validation

---

## Pass criteria

The Draft Hub passes the real-world UX test plan if:

- search works with real player names
- filters stay aligned with the board
- queue reflects current targets
- best available is believable and current
- comparison helps decision-making
- team fit matches current roster reality
- scarcity is readable at draft speed
- value profile is interpretable
- confidence labels support, not confuse, the pick

---

## Final recommendation

This test plan should be used before any real mock draft is treated as a meaningful rehearsal.

If these tests fail, the Draft Hub should not be treated as ready for draft-day pressure.
