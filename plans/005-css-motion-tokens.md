# 005 — CSS motion tokens, press feedback and quieter decorative motion (shadcn rebuild)

- **Status**: DONE (applied in the shadcn rebuild, 2026-10-02)
- **Commit**: n/a (not a git repository; snapshot 2026-10-02)
- **Severity**: MEDIUM (bundles LOW findings that touch the same stylesheet)
- **Category**: Cohesion & tokens, Physicality & origin, Purpose & frequency
- **Estimated scope**: the rebuilt stylesheet (`hexagon-lab/lab.css`) and the toast and copy-button code in `hexagon-lab/bench.js`

## Problem

Durations and curves are hand-typed per rule with the default `ease`, and there are no tokens:

```css
/* hexagon-lab/lab.css:72  */ transition: background-color 0.35s ease;            /* 350 ms, over budget */
/* hexagon-lab/lab.css:88  */ transition: transform 0.2s;                          /* switch thumb, default ease */
/* hexagon-lab/lab.css:100 */ transition: border-color 0.15s, background-color 0.15s, transform 0.15s;
/* hexagon-lab/lab.css:103 */ .btn:active { transform: translateY(1px); }          /* not a press */
/* hexagon-lab/lab.css:181 */ .tile:hover { transform: translateY(-2px); ... }      /* ungated hover lift, hit tens of times */
/* hexagon-lab/lab.css:83  */ animation: blink 1.2s ease-in-out infinite;           /* decorative, constant */
/* hexagon-lab/lab.css:182 */ animation-delay: calc(var(--i) * 14ms);              /* index stagger, 672 ms tail on 48 tiles */
/* hexagon-lab/lab.css:246 */ transform: translate(-50%, 16px); transition: opacity 0.2s, transform 0.2s;
```

The shadcn components being adopted ship `transition-all` on Button, Switch and Tabs. Copying that verbatim would animate unintended properties.

## Target

Tokens on `:root`, used everywhere, with no hand-typed curves:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--dur-press: 160ms;   /* press feedback */
--dur-fast: 150ms;    /* hover, color, toggles */
--dur-ui: 200ms;      /* toast, colorway ground, overlays */
```

- Buttons, toggles, tabs: `transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease, border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease, transform var(--dur-press) var(--ease-out)`. Never `transition: all`.
- Press feedback on every button-like control: `:active { transform: scale(0.97) }`.
- Switch thumb: `transition: transform var(--dur-fast) var(--ease-out)`.
- Stage ground color change: `background-color var(--dur-ui) ease`.
- Variation tile hover: no movement. A 1px ring via `box-shadow` with `var(--dur-fast) ease`, inside `@media (hover: hover) and (pointer: fine)`.
- Tour control: no blinking. A play/pause icon carries the state.
- Tile entrance on "draw again": `@keyframes tile-in { from { opacity: 0; transform: scale(0.96) } }`, `200ms var(--ease-out)`, delay `calc((var(--r) + var(--c)) * 30ms)` (diagonal wave, 30 ms per step, roughly 360 ms total on an 8 × 6 grid). Clicks are never blocked.
- Toast: enters from `translateY(100%)` and opacity 0 to rest, `var(--dur-ui) var(--ease-out)`. Exits with opacity only, `var(--dur-fast) ease`.
- Copy button: on success, swap its icon to a check for 1500 ms (feedback at the trigger). The toast is secondary.

## Repo conventions to follow

- All colors are shadcn tokens on `:root` (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, ...). Put the motion tokens in the same block.
- Focus ring follows shadcn: `border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)`.

## Steps

1. Add the motion tokens to `:root`.
2. Write every component transition with an explicit property list and the tokens above.
3. Add `:active { transform: scale(0.97) }` to `.btn`, `.toggle`, `.tab`, `.preset`, `.tile`.
4. Gate all hover-only motion or rings in `@media (hover: hover) and (pointer: fine)`.
5. Grid tiles get `--r` and `--c` custom properties from JS (`row = floor(i / cols)`, `col = i % cols`, cols read from `getComputedStyle(grid).gridTemplateColumns`).
6. Toast and copy-button feedback as specified.

## Boundaries

- Motion only. Visual design comes from the shadcn rebuild.
- Do NOT add a motion library. CSS and WAAPI only.

## Verification

- **Mechanical**: `grep -n "transition: all\|transition-all\|ease-in[^-]" hexagon-lab/lab.css` returns nothing.
- **Feel check**:
  - Press and hold a button: it settles to 97% in about 160 ms and springs back on release.
  - On a touch device (or with touch emulation), tapping a tile leaves no stuck hover state.
  - Draw new variations: the grid washes in diagonally from the top-left and is fully in under about 0.6 s. Clicking a tile mid-wave works.
  - Copy SVG: the icon becomes a check right at the button.
- **Done when**: every transition uses the tokens and no infinite decorative animation remains.
