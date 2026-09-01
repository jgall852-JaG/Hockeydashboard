# V1.0.1 UX Stabilization

## 1. Root Cause

The Draft Board search field was breaking because the Draft Hub re-rendered the entire board structure on each keystroke.

The key issue was:
- the search input was created in the rendered HTML for the Draft Board
- each keystroke updated state and immediately re-rendered the board
- the DOM replaced the active input element
- focus was lost, the cursor position reset, and the input effectively stopped accepting long names

This created a classic UI loop:

1. user types one character
2. input event updates draftSearch state
3. renderDraftHubView rebuilds the entire Draft Hub screen
4. the old input is removed and replaced with a new one
5. focus is lost
6. typing resumes only briefly or stops entirely

Additional risk factors:
- re-rendering while the user is editing search text resets the input value and cursor state
- filter changes and queue updates also trigger rerenders, which amplified the interruption if a user was interacting while typing
- comparison state and selected-player state are also tied to the same rerender lifecycle, so the workflow could destabilize during active draft work

---

## 2. Fix Applied

The fix was intentionally small and focused on the search workflow.

### Applied change

Before rerendering the Draft Hub, the app captures the active search input state if the user is currently typing in the Draft Board search box.

That state includes:
- current search text
- cursor start position
- cursor end position

After the updated Draft Hub HTML is rendered, the app restores focus to the Draft Board search input and reapplies the cursor selection.

This preserves:
- full-name typing
- continuous text entry
- focus retention during rerender
- value filter + position filter continuity
- queue editing without disrupting the search workflow
- comparison mode without breaking the current decision context

### Why this is the correct stabilization approach

This is a UX-only fix. It does not add features or modules. It simply prevents the Draft Hub from destroying the active text input during a valid and expected state update.

---

## 3. Validation Results

Validation focused on the real search workflow the GM uses in the Draft Hub.

### Search behavior checks

Confirmed:
- full names can be typed without interruption
- the input remains focused while typing
- the input value is retained across re-renders
- position filters continue to work while the search field is active
- value filters continue to work while the search field is active
- queue updates do not break the search workflow
- comparison mode does not interfere with text entry

### Validation players

The following players were used to validate the workflow:
- Macklin Celebrini
- Michael Misa
- Lane Hutson
- Dylan Guenther
- Beckett Sennecke

Full names were typed without interruption and successfully filtered in the board as expected.

---

## 4. Additional UX Issues Found

While stabilizing the search interaction, a few adjacent workflow risks were identified and reviewed.

### 1. Input recreation during rerender

This was the primary root cause. The draft board recreated the search input element as part of a full rerender, so the browser lost the active input state.

### 2. State reactivity during typing

The search field updated state on every keystroke, which is expected for live filtering. The problem was not the state update itself; the problem was that the render cycle destroyed the input element before the browser could preserve focus.

### 3. Filter + queue churn

Any update that triggers a rerender can interrupt a typing flow. This includes filter changes and queue modifications. The fix addressed that by preserving the active input state during the rerender cycle.

### 4. Comparison-state churn

Comparison selection is a valid draft workflow, but it also triggers rerender behavior. The same fix pattern protects the active input when the user is comparing players and then returns to board search.

### 5. Scroll and selection preservation risk

The draft board standard rerender can also cause the browser to lose the user’s place in the list if the element tree is regenerated. This is less severe than input loss, but it is part of the same root cause pattern: rerendering the active widget without preserving its runtime state.

---

## 5. Recommendation

The Draft Hub should continue to keep search, filters, queue, and comparison as live, state-driven interactions, but the UI should preserve the active input state when rerendering a complex screen.

Recommended rule:
- if the user is actively typing in a search field, the app should preserve focus, value, and cursor location through any draft-board rerender

This is the correct stabilization model for a live draft workflow because it preserves the GM’s momentum without adding new features or extra complexity.

### Final recommendation

Keep the fix narrow and stable:
- preserve active input state during rerender
- do not add new modules
- do not introduce new draft features
- keep the focus on usability and reliability during live draft use

This is the right V1.0.1 stabilization scope.
