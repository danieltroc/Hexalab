# Hexagon Lab — animation plans

From the `improve-animations` audit of `hexagon-lab/` on 2026-10-02.

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | [Interpolate layer, fill and echo count](001-continuous-morph.md) | HIGH | DONE |
| 002 | [Shorter user-triggered morphs on shared curves](002-morph-easing-duration.md) | HIGH | DONE |
| 003 | [Reduced motion: drop movement, keep fades](003-reduced-motion.md) | MEDIUM | DONE |
| 004 | [No per-frame work for offscreen sections](004-offscreen-frame-work.md) | MEDIUM | DONE |
| 005 | [CSS motion tokens, press feedback, quieter decoration](005-css-motion-tokens.md) | MEDIUM (+2 LOW) | DONE |

## Order and dependencies

1. **002** first: it adds `HEX.EASE` and `HEX.DUR`, which 001 and 003 use.
2. **001**: it changes `lerpSpec` and `render`. 003's crossfade has to replace the same morph path.
3. **003** after 001 and 002.
4. **004** is independent.
5. **005** lands with the shadcn rebuild of the stylesheet.

## Missed opportunities (additive, all implemented in the rebuild)

- **Colorway switch**: the stage ground fades while the mark's colors swap instantly (`bench.js:72–77`). Interpolate the colorway through the morph pipeline over `HEX.DUR.color` (200 ms) on `EASE.out`.
- **Construction overlay**: pops in (`bench.js:180`). Render guides in their own layer and fade opacity over 150 ms `ease`.
- **Copy SVG**: the only feedback is a toast far from the button. Covered in 005 (check icon at the trigger).

## Already right (keep)

- Slider drags paint immediately with no tween. That's direct manipulation, and it's correct.
- `animateTo` starts from the current interpolated state, so rapid clicks retarget instead of restarting.
- Motion loops and the tour pause when off screen.

## Deviations

- 005 asked for a CSS `background-color` transition on the stage. The JS colorway fade now drives the ground and the mark together over 200 ms on `EASE.out`, so the CSS transition was removed to avoid smoothing the same change twice.
- Variation tiles clicked while the bench is off screen now morph after the scroll lands (`scrollend`, 700 ms fallback), so the change is seen.
