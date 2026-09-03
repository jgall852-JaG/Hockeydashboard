# V13 Real Draft Workflow Notes

## Scope
This review was run against the current local-first dashboard using a realistic draft workflow: research players, scan team context, and test draft-decision speed under pressure.

The goal was not to redesign the product. It was to validate whether the current workflow supports a GM making fast, confident decisions during an active draft.

## Scenario 1: Player research

Research set:
- Macklin Celebrini
- Michael Misa
- Lane Hutson
- Dylan Guenther
- Beckett Sennecke

### Player snapshot

| Player | Owner | Cost | Term | Rights | Retention | Value |
|---|---:|---:|---:|---:|---:|---|
| Macklin Celebrini | FIGHTING IRISH | $16.00 | 2 | Yes | Not clearly surfaced; inferred as active rights with a meaningful cost commitment | Elite premium prospect; strong pick if you are comfortable paying for franchise-caliber upside |
| Michael Misa | TOYE SOLDIERS | $6.50 | 3 | Yes | Not clearly surfaced; rights are active but not a short-term bargain | High-end center upside; premium but still more flexible than a true top-of-board asset |
| Lane Hutson | IRONMEN | $12.00 | 2 | Yes | Not clearly surfaced; appears as a controlled, expensive upside asset | Best-in-class fantasy/defensive upside with a real cost premium |
| Dylan Guenther | IRONMEN | $0.50 | 1 | Yes | Inferred as cheap, short-term, controllable value | Best “value” play of the group; easy to justify if you want immediate upside |
| Beckett Sennecke | FIGHTING IRISH | $0.50 | 3 | No | Inferred as low-cost, no active matching-rights pressure | High variance swing piece; good cheap upside but less decision certainty |

### Observed workflow and clicks
- Import prospects CSV: 1 click to choose file + 1 click to confirm import
- Search or locate player in owner/prospect data: roughly 2-4 additional clicks depending on screen state
- To answer the full question (“who owns him / how much / how long / rights / retention / value”), the GM still has to drill into otherwise separate pieces of the data
- True end-to-end answer time is usually 4-7 clicks, not 1-2

### What is difficult to find
- Retention status is not obvious at the moment of decision and often has to be inferred rather than read directly
- Rights and matching-rights context are present but not strong enough at a glance
- Cost, term, owner, and value are spread across the same workflow rather than being grouped as a single decision record
- The app makes the user do context stitching instead of presenting a clean draft-speed answer

### What slows decision making
- The key fields are not front-loaded on the fastest surfaces
- The GM must mentally combine owner, cost, term, rights, and retention before making a call
- Similar players feel like separate research tasks, not a single side-by-side decision moment
- The absence of an obvious “decision delta” makes close calls feel slow and uncertain

## Scenario 2: Team review

### Team 1: TOYE SOLDIERS
Strengths:
- Strong forward depth and elite center pool
- Michael Misa gives the team a true high-end prospect lane
- Multiple rights-bearing prospects give flexibility and upside

Weaknesses:
- Not as structurally deep on defense in the prospect stack
- Some premium costs are already built into the pipeline

Prospect depth:
- Good to very good; multiple high-upside names in the prospect pool

Veteran depth:
- Solid veteran core with real NHL contributors and a stable top end

Rights inventory:
- Strong; active rights are a real asset

Roster composition:
- Young talent forward-heavy with some legitimate top-end pieces

### Team 2: FIGHTING IRISH
Strengths:
- Excellent top-end prospect and young-player concentration
- Macklin Celebrini is an obvious premium asset
- Beckett Sennecke adds cheap upside with volatility
- Good mix of high-end talent and flexible budget pressure

Weaknesses:
- Expensive prospect book is a real commitment risk
- A few of the premium assets carry a heavy decision burden

Prospect depth:
- Deep and volatile; strong ceiling but not entirely balanced

Veteran depth:
- Above-average veterans with real NHL quality

Rights inventory:
- Useful but the pool is expensive and the decision burden is heavier than it looks

Roster composition:
- More premium, more volatile, more “win now with a stretched prospect list” than a balanced long-term structure

### Team 3: IRONMEN
Strengths:
- Excellent premium talent base and a very strong current roster
- Lane Hutson and Dylan Guenther together show a strong balance of upside and value
- Good rights inventory with a mix of high-end and bargain assets

Weaknesses:
- A few assets are expensive relative to the rest of the flow
- The pool reads less “cheap and deep” than a true value team

Prospect depth:
- Good; several players offer real upside with a strong spread between premium and bargain value

Veteran depth:
- Strong; the roster is built to compete now and still carry quality depth

Rights inventory:
- Solid; the team can make strategic bets without being forced into overcommitment

Roster composition:
- Balanced, talent-heavy, and more stable than the other teams reviewed

### What information is still missing
- Team fit in a single, readable summary
- Clear “offense/defense/aging risk” framing by team
- Retention pressure by team, not just by player
- Prospects and veterans in one compressed decision view
- Draft-queue impact tied to team roster shape and available rights

## Scenario 3: Draft Hub workflow

### Draft queue build
A realistic queue in a real draft setting would likely be built around the following logic:
1. Rank premium talent by ceiling and fit
2. Add a value tier for cheaper assets with strong upside
3. Place team needs and roster pressure into the queue order
4. Keep a short list of comparable names for side-by-side decisioning

### Comparison test
The app makes comparison feel slower than it should when the user is trying to answer, “Is this player the better pick?”

Example:
- Macklin Celebrini vs Michael Misa
- Lane Hutson vs Dylan Guenther
- Beckett Sennecke vs Dylan Guenther

In a real draft, the answer is not just “who is better” but also:
- Who owns them?
- What does it cost?
- How long do I control them?
- Do matching rights or retention change the decision?
- Is this a value or a burden?

### Can I confidently choose between two similar players?
Not confidently enough in the current workflow.

The product gives enough raw information to eventually make the call, but the confidence moment happens too late. The user still has to do too much context stitching before the decision feels clean.

This is the central issue: the app is useful, but it does not yet produce a comfortable “draft-speed” decision read on the board or in comparison.

## CRITICAL findings

### 1. League context is still too hidden on the fastest draft surfaces
- The biggest problem is not player quality; it is the missing draft-speed context around cost, owner, term, rights, and retention
- At the moment of decision, the GM still pauses to do too much mental reconstruction

### 2. Retention and rights are not strong enough at a glance
- These are high-impact decisions and they still feel buried
- The user should not have to infer the effect of retention or rights while comparing players under pressure

## HIGH findings

### 3. Cost and term need to dominate the decision surface
- Low-cost, short-term assets are easier to value; the tool must make that obvious
- Expensive long-term assets need to be called out as a deliberate premium, not just another row item

### 4. Owner visibility is helpful but still not decisive enough
- Owner information matters, but it should be grouped with cost/term/rights in the same rapid-read layer
- The decision should be: “Who owns them and what does that mean for my draft path?” not “search for it later”

### 5. Comparison is still the main friction point
- A close call should become clear within one screen, not after extra drilling
- The app reduces research burden, but it does not yet create a crisp decision delta between similar players

## MEDIUM findings

### 6. The workflow is better than before, but still not draft-fluent
- The product is improved, but it still feels like a static database with a decision layer layered on top rather than a true draft-speed decision tool

### 7. Team review is informative but fragmented
- Team strengths, weaknesses, prospect depth, and rights inventory exist, but they are not assembled into a single decision-ready read

### 8. The app makes a GM work harder than necessary in close-call scenarios
- The final confidence moment is still too late and too manual

## LOW findings

### 9. The current workflow is usable and credible for basic research
- It is not a failure; it is just not yet decisive enough for real-time draft pressure

### 10. The product is closer to a useful decision-support layer than a full draft war room
- That is acceptable as a baseline, but it leaves a real speed gap during live decisions

## “I wish I could see...” notes
- I wish I could see owner, cost, term, rights, and retention in one compact row without drilling
- I wish I could see a clear compare delta between two similar players in one screen
- I wish I could see team fit and prospect depth next to the draft decision, not after the fact
- I wish I could see retention pressure and rights risk without hunting through separate fields
- I wish I could see the draft decision framed as “value vs burden” instead of just raw player quality

## Top 3 improvements that would most improve fast, confident draft decisions

1. Compact league-context strip on every decision surface
- Show Owner, Cost, Term, Rights, Retention, and Value in a single board-level readout
- This is the biggest gain because it removes the need to stitch fields together manually

2. Stronger comparison delta
- Compare two similar players and immediately show the real decision tradeoff
- Decision wording should be simple: “more expensive / shorter term / higher retention risk / stronger fit / more scarce”

3. One-click team-fit and roster-pressure context
- The GM should be able to jump from a player to team fit, prospect depth, and rights inventory without re-searching
- This turns a player decision into a draft decision instead of a raw player evaluation

## Final assessment
If the draft was tonight, the product would be much better with a compact league-context layer, a compare-first decision model, and faster team-fit handoff.

The current app has usable data, but it still makes the GM do too much work before the final decision feels confident. The most meaningful improvement is not adding more data. It is making the right data visible at the right place, at the right time, with the right framing.
