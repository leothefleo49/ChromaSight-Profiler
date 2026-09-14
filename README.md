# ChromaSight Profiler

An adaptive, science-based color vision screening test that measures your
thresholds along the three cone-confusion axes and hands your profile to
[Colorfle Unlimited](https://colorfle-unlimited.vercel.app).
Live at **[chroma-sight-profiler.vercel.app](https://chroma-sight-profiler.vercel.app)**

## How the test works

Each plate hides a chevron in pseudo-isochromatic (Ishihara-style) dots. The
figure and background colors differ **only along one LMS cone axis** — computed
in real cone space (sRGB → XYZ → Hunt-Pointer-Estevez LMS), not hand-picked
palette approximations:

- A dichromat missing that cone physically cannot see the difference at any
  separation — the same principle as laboratory tests like the Cambridge Color
  Test.
- A trichromat sees it clearly, with visibility scaling by separation.

A **transformed staircase (2-down/1-up)** adapts the separation per axis until
it converges on your threshold, interleaving axes so you can't settle into a
rhythm. Difficulty never drops below a per-axis **visibility floor** (measured
so every plate is clearly visible to normal trichromats — e.g., the tritan
floor is far higher than red-green because small S-axis shifts are genuinely
hard to render distinguishably on sRGB screens), and pair selection keeps only
contrast-strong candidates. Thresholds map to **continuous severities
(0–100%)** per axis instead of coarse pass/fail plates. Attention-check
control plates validate screen/attention, **blank catch plates** (same colors,
no chevron) give an honest "No arrow" answer and expose noise-guessing, and
all dots carry shared luminance jitter so brightness can never leak the shape.

## Results

- Per-axis severity meters (protan / deutan / tritan) with a primary diagnosis
  and borderline flagging; all-axes-high flags a possible achromatopsia pattern.
- **"What Colorfle looks like for you"** — a live mini game board under your
  measured simulation, with a standard-vision comparison and a preview of
  Colorfle's assistive mode (high-contrast borders, symbols, labels).
- **Send to Colorfle** — one tap navigates to Colorfle with your profile
  (`#cb-profile=…` base64url) and it applies instantly. Copy/paste JSON and
  `.json` import remain as fallbacks.
- Result history stored locally.

Profile format (v2, backward compatible with v1):

```json
{
  "v": 2,
  "app": "chromasight",
  "type": "deuteranopia",
  "strength": 0.62,
  "axes": { "protanopia": 0.08, "deuteranopia": 0.62, "tritanopia": 0.05 },
  "testedAt": "2026-09-13"
}
```

## Development

```bash
npm install
npm run dev        # vite dev server
npm test           # unit tests (color science + staircase)
npm run build      # production build
npm run icons      # regenerate PWA icons
```

- `src/colorscience.js` — cone-space transforms, confusable-pair generation
  (gamut-scanned, with per-axis max separations derived from the gamut itself),
  severity mapping, and Colorfle-identical simulation matrices.
- `src/adaptive.js` — the staircase controller.
- `src/plategen.js` — seeded pseudo-isochromatic plate rendering.
- Unit tests in `src/colorscience.test.mjs` verify the core scientific claims
  (held-equal cone coordinates, gamut feasibility, staircase convergence).

This is a screening tool, not a medical device.

## Deployment

Pushes to `main` auto-deploy on Vercel (Vite preset, no config needed).
