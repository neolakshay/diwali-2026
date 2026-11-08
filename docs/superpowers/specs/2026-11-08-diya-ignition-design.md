# Diya and Skyshot Rituals — Short Design

## Intent

The greeting turns each choice into a small, tactile ritual. Choosing either path fades the decision screen to black, then asks the visitor to bring wandering light to a vector-styled object. Three small acts build to a single visual payoff: a diya becomes fully lit, or a skyshot cracker ignites and bursts.

## Goals

- Fade either choice screen completely into black after its tile is selected.
- Reveal one centered, initially unlit vector diya for the Diya path, or a compact vector skyshot-cracker setup (small rounded cylinders plus a fuse) for the Cracker path.
- Show 8–10 warm yellow/orange light orbs drifting around the selected object.
- Let a visitor drag any orb with mouse or touch and release it at the object’s wick/fuse target.
- Require three successful orb drops for each path. A successful drop is absorbed into the wick/fuse and advances visible progress; a missed drop returns the orb to its drifting state.
- On the third Diya drop, light the diya with a warm flame and retire the remaining orbs.
- On the third Cracker drop, turn the fuse from a small spark into a vector-style skyshot burst; retire the remaining orbs.
- Keep the interaction responsive and English-first. The visible language control remains a non-functional Hindi placeholder for now.

## Non-goals

- No sound, score, persistence, sharing, Hindi copy, or post-ignition story in this slice.
- No third-party animation library, canvas scene, or physics engine.

## Approaches

1. **DOM elements with Pointer Events — selected.** Each orb is an absolutely positioned element whose drift is CSS-driven; a short pointer-drag controller positions the captured orb under the visitor’s finger or cursor and checks a wick/fuse target region on release. This is lightweight, responsive, and works for mouse and touch.
2. **Canvas simulation.** This could produce physical-looking particles, but it would add bespoke hit testing and make the single drag target less accessible. It does not fit this narrow interaction.

## Interaction and visual decisions

- Selecting either choice starts a short fade-to-black; the language control stays unobtrusive.
- The diya enters at the screen centre with a soft, low warm halo but no flame. The Cracker path uses CSS/SVG-like vector shapes: a cluster of small, rounded, patterned cylinders and a visible fuse—never photographic artwork.
- Orbs vary slightly in size, brightness, route, and animation delay so they feel alive rather than mechanically orbiting.
- While an orb is dragged, its autonomous drift pauses and it gains a subtle glow/scale increase. The wick/fuse receives a quiet visual cue when the orb is near enough to drop.
- The drop zone is sized generously for touch. A missed drop returns the orb to its drifting state. Each accepted orb increments a three-step visual progress indicator.
- On the third Diya success, interaction locks; a flame and larger halo animate in, and all other orbs fade away. On the third Cracker success, the fuse spark travels through the vector skyshot and resolves into a large, abstract radial burst above it before remaining orbs fade.
- The implementation uses vanilla HTML, CSS, and JavaScript with `pointerdown`, `pointermove`, `pointerup`, and pointer capture. This is the builder’s choice; there is no repository framework to reuse.

## Acceptance checks

1. Choosing either tile visibly replaces the choice screen with its matching unlit scene.
2. Multiple yellow orbs visibly move before interaction.
3. The first two successful drops visibly advance progress without triggering the final payoff.
4. The third successful Diya drop lights the diya exactly once; the third successful Cracker drop creates the skyshot burst exactly once.
5. Dragging/releasing an orb away from the target does not advance progress and leaves it usable.
6. The interaction works at desktop and narrow touch-oriented widths without external dependencies.
