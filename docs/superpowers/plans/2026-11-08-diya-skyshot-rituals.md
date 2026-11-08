# Diya and Skyshot Rituals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free Diwali greeting that lets a visitor select a Diya or Cracker ritual, drag three moving light orbs to its ignition point, and see the matching final light or skyshot burst.

**Architecture:** A static HTML shell contains all three screen states (discovery, choice, ritual). `src/ritual-state.js` owns the pure three-drop state machine and is tested with Node’s built-in test runner. `src/app.js` drives screen transitions, renders vector-like DOM scenes and drifting orbs, and connects Pointer Events to the state machine; `styles.css` supplies the visual language and responsive choreography.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Node.js built-in `node:test`; no package install or external runtime dependency.

**Spec:** `docs/superpowers/specs/2026-11-08-diya-ignition-design.md`

## Global Constraints

- English only; Hindi remains a visible disabled placeholder.
- Use vector-like DOM/CSS elements, not images.
- Require exactly three successful drops in either ritual.
- Support mouse and touch through Pointer Events.
- Do not add dependencies, audio, persistence, sharing, or either path beyond its final payoff.
- The workspace is not a Git repository; commits are intentionally unavailable.

## Review Focus

- A missed drop must leave the selected orb usable and must not change progress; test it in Task 1.
- A fourth target drop after completion must not re-run the final sequence; test it in Task 1.
- A touch drag must keep working if the finger crosses another DOM element; use pointer capture in Task 3 and manually exercise it.
- A narrow viewport must preserve a reachable wick/fuse target; include the responsive rule and manual check in Task 2.
- Rapid clicks on both choice tiles must not create two ritual scenes; gate state transitions in Task 3.

---

### Task 1: Ritual State Machine

**Files:**
- Create: `src/ritual-state.js`
- Create: `test/ritual-state.test.mjs`

**Interfaces:**
- Produces: `createRitual(kind: "diya" | "skyshot") -> RitualState` and `applyDrop(state: RitualState, hitTarget: boolean) -> DropResult`.
- Consumed by: `src/app.js` in Task 3.

- [ ] **Step 1: Write the failing state-machine tests**

Assert that a target hit increments the count; two hits remain collecting; the third completes with the selected kind; a miss preserves the state; and completion is idempotent.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test test/ritual-state.test.mjs`

Expected: FAIL because `src/ritual-state.js` does not exist.

- [ ] **Step 3: Implement the pure ritual state module**

Implement `createRitual` and `applyDrop` as immutable, dependency-free functions. `DropResult` must expose whether a drop was accepted, the new state, and whether this drop completed the ritual.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test test/ritual-state.test.mjs`

Expected: PASS.

### Task 2: Static Greeting and Ritual Visuals

**Files:**
- Create: `index.html`
- Create: `styles.css`

**Interfaces:**
- Consumes: `data-screen`, `data-choice`, ritual `data-kind`, and named regions supplied by the HTML.
- Produces: semantic screen containers, choice buttons, and CSS-only vector pieces for the diya and skyshot scene that Task 3 can activate.

- [ ] **Step 1: Add an initial browser-level smoke check scaffold**

Create `test/page-contract.test.mjs` that reads `index.html` and asserts the discovery orb, both choice tiles, ritual canvas, diya wick, skyshot fuse, and the module-script entry point are present.

- [ ] **Step 2: Run the smoke check to verify it fails**

Run: `node --test test/page-contract.test.mjs`

Expected: FAIL because `index.html` does not exist.

- [ ] **Step 3: Build the static HTML and CSS scenes**

Build a black discovery screen with its seven-second prompt, a two-tile choice screen, and a reusable ritual screen. Represent the diya with CSS bowl/wick/flame elements; represent the skyshot with small rounded patterned cylinders, a fuse, and a radial burst element. Keep the scene centred at mobile and desktop widths, hide unselected state, and include reduced-motion styling.

- [ ] **Step 4: Run the smoke check to verify it passes**

Run: `node --test test/page-contract.test.mjs`

Expected: PASS.

### Task 3: Screen Flow, Draggable Orbs, and Payoffs

**Files:**
- Create: `src/app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Test: `test/ritual-state.test.mjs`
- Test: `test/page-contract.test.mjs`

**Interfaces:**
- Consumes: `createRitual`, `applyDrop`, and the HTML data regions from Tasks 1–2.
- Produces: click-only entry from discovery, selection-gated ritual transitions, 10 pointer-draggable orbs per ritual, three-drop progress, and one final visual payoff per kind.

- [ ] **Step 1: Extend the page contract test for the interaction hooks**

Assert that the entry module is `src/app.js`, the target and progress regions have stable IDs/data attributes, and the choice tiles expose their ritual kind.

- [ ] **Step 2: Run the tests to verify the new contract fails**

Run: `node --test test/page-contract.test.mjs test/ritual-state.test.mjs`

Expected: FAIL because the interaction hooks and app entry do not yet exist.

- [ ] **Step 3: Implement the interaction controller**

Make the discovery orb advance only on click; fade a selected choice to the matching ritual. Generate 10 varied orbs, use pointer capture to drag, determine target proximity on release, pass the result to `applyDrop`, return misses to drift, and update a three-step indicator. On the completing Diya drop, animate the flame/halo; on the completing Skyshot drop, animate a fuse spark and radial burst; remove remaining orbs and lock interaction.

- [ ] **Step 4: Run focused automated checks and manually exercise both rituals**

Run: `node --test`

Expected: PASS. Then use a local static server to confirm click-only entry, one missed drop, three successful drops, and one final payoff for each path at desktop and narrow widths.

## Self-review

- Spec coverage: Tasks 2–3 cover both vector scenes, transitions, drifting orbs, three-drop thresholds, missed drops, and distinct payoffs. Task 1 covers the governing state behavior.
- Step scan: Every code change has a preceding failing check and a corresponding pass check.
- Type consistency: `RitualState` and `DropResult` originate in Task 1 and are the only source of completion truth in Task 3.
- Review focus: Each risk has an owned automated check or manual verification in the named task.
- Proportion: The plan defines the fixed interaction and verification boundaries without prescribing CSS implementation detail.
