# Manual Override UX Review

## Summary
The override flow is functionally close to working, but it fails the draft-day usability test. The core problem is not save logic; it is response quality. Users can save an override, and the list can update, but the UI does not clearly tell the user that the correction is now active, that coverage has changed, or that the unmapped status has cleared.

This matters because the app is being used in a fast, decision-heavy environment. A user correcting a player name such as `Zane Parekh` to `Zayne Parekh` should see the dashboard immediately resolve that issue without needing to guess whether the action succeeded.

## Findings

### 1. Save success is weakly communicated
The current flow appears to save the override and update the override list, but the user receives minimal feedback. That creates a false sense of uncertainty in a live environment where seconds matter.

### 2. Refresh is not clearly tied to outcome
A valid override should trigger the same view refresh that a normal import or enrichment update would trigger. The app should not require the user to reload or manually inspect a secondary list to confirm the change took effect.

### 3. Coverage state is stale or visually incomplete
The dashboard should reflect updated coverage immediately after a manual override. If coverage and mapping counts remain unchanged in the UI, the user cannot tell whether the correction has materially changed system state.

### 4. Unmapped status is not clearly resolved
When a player is manually corrected, the item should no longer remain in an unmapped or pending state. The override should visibly clear the prior mismatch and mark the player as resolved without ambiguity.

### 5. Success feedback lacks action clarity
The best-case experience is an immediate, single acknowledgment: "Override saved and resolved". The user should not have to infer success from a list change or a hidden state update.

## Risks

- Draft-day confusion: users may think an override failed and retry the same correction.
- Hidden stale data: coverage cards and unmapped counts may still show previous state after a saved change.
- Duplicate or conflicting overrides: if the UI does not clearly show the current state, users may create multiple corrections for the same player.
- Trust erosion: weak feedback undermines confidence in the override system and causes slower user adoption.
- High-friction troubleshooting: when the issue is obvious on screen, the user should not need to search across multiple panels to verify it was fixed.

## Recommendations

### 1. Make the save path instant and visible [Critical]
After saving an override, the UI should immediately refresh the affected player record, any related coverage summaries, and the unmapped list. The user should see the change without a manual refresh.

### 2. Update all dependent surfaces in one event cycle [Critical]
A manual override should trigger updates to:
- the player record itself
- the mapped/unmapped counts
- the coverage summary
- the override status badge or entry
- the relevant list row

This should happen in the same render cycle so the user sees a coherent state change.

### 3. Clear override status on resolution [High]
Once a correction resolves a mismatch, the system should clear stale override indicators. The record should show as resolved rather than waiting or failed.

### 4. Provide explicit success feedback [High]
Use a visible confirmation pattern, such as a toast or inline message: 
- "Override saved"
- "Player resolved"
- "Coverage updated"

The message should be brief, positive, and clearly tied to the affected record.

### 5. Preserve a clear audit trail [Medium]
Keep the override history, but surface only the current active resolution in the primary workflow. This prevents confusion without losing the ability to review prior edits.

## Example behavior
For `Zane Parekh` corrected to `Zayne Parekh`:

- the player should immediately become resolved in the current view
- the name should display as corrected everywhere relevant
- the unmapped count should drop immediately
- the coverage card should update immediately
- the UI should announce a clear success state

This is the expected draft-day experience: no lag, no ambiguity, no second-guessing.

## Quick Wins

- Add a visible success toast after save.
- Trigger a full local state refresh after override save.
- Recompute coverage and unmapped counts immediately after the override.
- Clear any previous override warning status for the resolved record.
- Ensure a corrected player no longer appears in the unresolved list.

## Future Work

- Add reversible override actions with an undo flow.
- Add a lightweight override log with timestamp and source.
- Support bulk correction review for repeated naming mismatches.
- Surface validation warnings when a manual override matches multiple candidates.

## Final verdict
The flow should be judged as a UX success only when the corrected player is visibly resolved in the same moment the override is saved. Anything less is not draft-day ready.
