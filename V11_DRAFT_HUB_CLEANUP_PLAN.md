# V1.1 Draft Hub Cleanup Plan

## Goal

Trim Draft Hub into a focused draft-decision screen now that League, Teams, and Players exist.

Draft Hub should answer:

- Who is best available?
- What is scarce?
- What should I queue?
- Which choice is better?
- What is the confidence?

It should not remain a general information dashboard.

---

## 1. Current components

Current Draft Hub surfaces include:

- top summary cards
  - Players in pool
  - Best available
  - Queue
  - Positions tracked
- Best Available panel
- Draft Board
- Draft Queue
- Position Scarcity
- Team Needs
- Value Profile
- Drivers
- Team Fit Analysis
- Scarcity Drop-Off
- Why this player?
- Comparison
- Decision Confidence
- search
- position filter
- value filter
- add-to-queue actions
- compare actions

---

## 2. Keep

These belong in Draft Hub because they directly support draft-time decisions.

- Best Available
- Draft Board
- Draft Queue
- Position Scarcity
- Team Fit
- Comparison
- Confidence
- search
- filters
- queue actions
- compare actions

Keep the board lightweight:

- player name
- position
- NHL team
- value band
- risk band

That is enough for fast draft scanning.

---

## 3. Move

These belong more naturally in League, Teams, or Players.

### Move to League

- top summary cards
  - Players in pool
  - Positions tracked
- any broad overview metrics that are not needed at pick speed

### Move to Teams

- roster-style context that explains team need
- ownership-driven roster framing
- anything that behaves like a team dashboard instead of a pick screen

### Move to Players

- full Value Profile
- Drivers
- detailed Team Fit Analysis
- Scarcity Drop-Off narrative
- Why this player?
- ownership
- cost
- term
- matching rights
- retention status
- detailed player context
- detailed live NHL context

Players should remain the encyclopedia for player detail.

---

## 4. Remove

Remove anything that duplicates the new tabs or expands Draft Hub beyond decision support.

- standalone full Value Profile section
- deep player-identity detail inside Draft Hub
- league-style overview cards inside Draft Hub
- any auction, commissioner, trade, or operations concepts
- any future scoring additions

Draft Hub should not be the place where the user reads the full story of a player.
It should be the place where the user decides.

---

## 5. Recommended final Draft Hub layout

### Top row

- Best Available
- search
- position filter
- value filter

### Main center

- Draft Board
  - compact rows
  - value band
  - risk band
  - compare action
  - queue action

### Side column

- Draft Queue
- Position Scarcity
- Team Needs

### Decision footer / detail strip

- Comparison
- Team Fit
- Confidence

### Rule

If a field helps the GM scan, compare, or queue a pick quickly, it stays.

If it needs explanation, it moves to Players.

If it is broad context, it moves to League or Teams.

---

## Final recommendation

Keep Draft Hub small and sharp:

- scan
- compare
- queue
- confirm

Everything else belongs elsewhere.
