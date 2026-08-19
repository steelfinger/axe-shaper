---
target: marketing landing page
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-19T03-50-26Z
slug: src-components-marketingsite-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `.chain-item.active` shows a gold "current" state nothing produced and nothing can change |
| 2 | Match System / Real World | 3 | Domain language is excellent; "2 sibling workbenches" and "shares no UI code" are internal-engineering register; "55.56 mm" names no dimension |
| 3 | User Control and Freedom | 2 | Nav `display:none` below 980px with no replacement; not sticky on a 4,230px page; 8 external links have no `rel="noopener"` |
| 4 | Consistency and Standards | 2 | Four labels for one destination; inches and mm for the same fact; 24 font sizes / 38 spacing values against a documented 6-role / 5-step system |
| 5 | Error Prevention | 3 | Strong disclosures, but the missing viewport meta guarantees a broken render for every mobile visitor |
| 6 | Recognition Rather Than Recall | 3 | The callout naming the calibration square does not point at it; the square's own instruction renders at ~3px |
| 7 | Flexibility and Efficiency | 2 | A skim path is deliberately designed (anchor nav, proof strip) and fails: no sticky nav, no back-to-top, and the section that *is* "how it works" has no anchor |
| 8 | Aesthetic and Minimalist Design | 2 | ~40% of the hero paper is blank; a decorative gold glow that clips visibly on narrow viewports; a 220px mark dropped onto a photo; the connector rail strikes through its own icons |
| 9 | Error Recovery | 2 | The only failure path — a 200-char prefilled `mailto:` — has no visible plaintext address and no fallback |
| 10 | Help and Documentation | 2 | `/support` carries the most important instruction in the product ("do not cut material until that square measures correctly") and it is linked only from the footer |
| **Total** | | **24/40** | **Needs work** |

All ten heuristics scored; none marked n/a.

## Design Specificity Verdict

**LLM assessment:** Authored for roughly the first 900px, category-interchangeable for the remaining 3,330. The hero could not be lifted onto another product — a rotated real `.axe.svg`, a counter-rotated sheet tab, bench callouts. `.linked-section` carries the one original argument. But `.proof-strip`, `.workflow-section`, `.workbench-section`, `.ipad-section` and `.closing-section` — five of seven — are stock landing-page furniture in a good palette. The deeper failure: the one behavior the product is *about* (change a number, another number moves) is drawn as three static boxes at the smallest type sizes on the page.

**Deterministic scan:** `detect.mjs` on the `.tsx` returns clean (exit 0) — near-vacuous, since all styling is external. The browser overlay pass at 1280×800 returned 47 findings: `ai-color-palette` 17, `undersized-ui-text` 13, `low-contrast` 11, `tiny-text` 3, plus singles. Independently verified: `--text-muted` `#64748b` is 3.97:1 on `#0f1117` and 3.69:1 on `#161922` — 8 text styles fail AA.

**False positives filtered:** `text-occlusion` was the overlay's own badge; `clipped-overflow-container` fired only at a degenerate 0px viewport; `ai-color-palette` counts per-SVG-child (17 findings = 4 icons) and misreads gold and slate icons as "cyan neon".

**Corrections to Assessment A:** the gold-glow seam is real but was overstated for desktop — the cut alpha is 0.009 at 1440px (invisible), rising to 0.092 at 375px (plainly visible). It is a narrow-viewport defect. The `Tablet` icon is not broken; lucide's Tablet genuinely *is* a rounded rectangle plus a short line, so it merely reads as a plain rectangle at 30px.

## Overall Impression

The hero is the work of someone who understands the product. Everything below it is a competent dark landing page that happens to be about guitars. The single biggest opportunity is not styling — it is that the page's two strongest trust assets (the calibration square and the golden geometry corpus) are respectively rendered at 3px and buried in a subordinate clause about an unreleased iPad app.

## What's Working

1. **The hero treats the export as a physical object and uses the real file.** `rotate(2.6deg)`, a directional drop shadow, a 900ms `settle-plan` entry from `translateY(22px) rotate(4.2deg) blur(3px)`, and a sheet tab counter-rotated to `-4deg`. Matched rotations would have read as a sticker; the counter-rotation sells "tab clipped to a drawing." The source is `s_style.axe.svg` imported directly — DESIGN.md's "use the app's own exported drawing" honored literally rather than mocked up.
2. **The copy earns trust by costing the author something.** "This opens your email app. No release date is promised." PRODUCT.md's ban on fabricated evidence is respected without the page going vague.
3. **The CTA system invents nothing.** Conversion through contrast (`#f0f4f8` on void), every button `min-height: 44px`, shared `:focus-visible`. In a design that fails color discipline elsewhere, the button layer holds the line.

## Priority Issues

### [P0] No `<meta name="viewport">` in `index.html`
**Why it matters:** Measured live — at a 375px device the page reports `innerWidth: 980`. Both `@media` blocks, ~260 lines of responsive CSS, never execute on a real phone. The surface constraint says public pages must be responsive and indexable; they are neither.
**Fix:** Add `<meta name="viewport" content="width=device-width, initial-scale=1" />`. Verified by injection: `scrollWidth` then equals 375 with zero overflow — the existing responsive CSS is already correct and simply never runs.
**Command:** `/impeccable adapt`

### [P0] The hero proof artifact cannot be inspected
**Why it matters:** The visitor is asked to inspect a real output and cannot. Measured: the drawing renders 282×508px inside a 486×554 sheet — **0.775 px/mm**. The 0.4mm outline becomes **0.31 CSS px**; the 0.2mm guide becomes 0.155px; the calibration label becomes **3.1px**. The sheet's aspect is 0.87 while the plan's is 0.555, so **42% of the paper is blank margin**. It is also a bare `<img>` — no download, no zoom, no "open in editor."
**Fix:** (a) match `.blueprint-sheet`'s inset to the plan's 364.31:656.41 aspect, gaining ~1.7× linear scale for free; (b) ship a display-only SVG with heavier strokes or `vector-effect="non-scaling-stroke"` so every line lands ≥1 CSS px, and drop `filter: sepia(0.12) contrast(0.95)`; (c) wrap it in a download link and add "Open this exact plan in the editor" — the file is 26KB and already imported.
**Command:** `/impeccable bolder`

### [P1] The Gold Is Truth rule is inverted
**Why it matters:** Five of six gold appearances are decorative — the `::before` glow, the sheet-tab border, both bench callouts, and all three chain eyebrows. The three gold eyebrows cancel the one legitimate signal (`.chain-item.active`) four pixels away. Gold now means "Axe Shaper brand," which is the one thing DESIGN.md's most-cited rule forbids. The glow also clips against its own box edge, visible from ~768px down (alpha 0.056) and obvious at 375px (alpha 0.092).
**Fix:** Delete `.marketing-page::before` — the sheet's drop shadow already establishes the lamp. Set `.sheet-tab` border to `var(--panel-border)`, `.bench-callout` to `var(--text-secondary)`, `.chain-item > span` to `var(--text-muted)`. Leave gold only on `.chain-item.active`.
**Command:** `/impeccable colorize`

### [P1] Eight text styles fail WCAG AA, all from one token
**Why it matters:** `--text-muted` `#64748b` yields 3.97:1 on void and 3.69:1 on slate. It is applied to the workflow body copy (13.12px), the free/no-account trust line (11.52px), every proof-strip label (11.52px), and the Unsplash attribution (9.28px). The lowest-contrast text on the page is doing the highest-trust work — for hobbyists in their 40s–60s reading in a workshop.
**Fix:** Promote everything on `--text-muted` below 18px to `var(--text-secondary)` (`#94a3b8`, 7.36:1). Reserve `#64748b` for ≥18px. Raise `.workbench-photo figcaption` to 0.68rem.
**Command:** `/impeccable audit`

### [P2] The linked-geometry promise is asserted, never demonstrated
**Why it matters:** This is *the* differentiator per PRODUCT.md, and the page proves it with three `<div>`s and two `Link2` glyphs. `+ compensation` is a mono readout with no number, reading as an unfilled placeholder. One card is gold-"active" for no discoverable reason. A competitor could copy this positioning by writing the same three words.
**Fix:** Make the chain a live 24.75″ / 25.5″ / 27″ toggle that recomputes the saddle Y and redraws the saddle line on the hero sheet. `src/utils/scaleMath.ts` is already the single source of truth and the golden corpus guarantees the number. Gold then genuinely marks the current selection and the mono readouts become live measured quantities.
**Command:** `/impeccable delight`

## Persona Red Flags

**Marko, 52 — hobbyist luthier, one build a year, never opened Illustrator, browsing on his phone at the bench.** Gets a 980px desktop layout at 38% scale. Even fixed, the hero is 1144px tall and the plan starts at y=703 — the artifact is below the fold on his 812px screen. `.callout-format` (".axe.svg portable project") is `display:none` below 700px, so the portability promise is deleted rather than reflowed. **His actual question is never answered:** does he need to know vector software? No editor screenshot, no mention that he can start from a Strat/Tele/Les Paul/SG template rather than from nothing — the single fact that would reassure him.

**Dave, 38 — skeptical builder with $200 of quartersawn ash on the bench.** He cannot get the file; the hero sheet is a bare `<img>`. The `100 × 100 mm print check` callout is at the stage's bottom-right while the calibration square is at the sheet's bottom-left, ~380px away over blank paper. The square's own instruction — the most trust-critical sentence in the product — renders at 3.1px. And **the golden geometry corpus, the strongest trust asset this project owns, appears once, as a subordinate clause in the iPad paragraph.** He is given assertions where proof exists.

**Priya, 34 — arrives on an iPad in portrait.** At 768 the nav is `display:none` with no hamburger and no DOM replacement — the `#ipad` anchor she came for is unreachable except by scrolling past 3,600px about a web editor. `.ipad-toolbar`'s three gray dots read as macOS traffic lights, not iPadOS. `.pencil-line` at `rotate(-42deg)` reads as a scratch on the drawing. The CTA is a `mailto:` with no visible plaintext address and no recovery path.

## Minor Observations

- `axe-shaper-mark-large.png` is 618KB at 800×800 for an `aria-hidden` element shown at 140–220px; neither brand `<img>` has `width`/`height`, so the nav mark shifts layout on load.
- No code splitting anywhere: a single 803KB bundle. A landing-page visitor downloads Konva and the entire editor before the hero paints.
- `.workflow-section` has three `<h3>`s and no `<h2>`; they nest under the previous section's h2 in the accessibility outline.
- `aria-label` on plain `<div>`s (`.blueprint-stage`, `.geometry-chain`) is ignored without a `role`.
- `scroll-behavior: smooth` sits on `.marketing-page`, which is not the scroll container — anchor jumps are instant; the reduced-motion block then resets that same non-effective property.
- The hero `<br/>` never achieves its two-beat reading: the column is 473px at 1440 (`max-width: 660px` is dead code), so the h1 sets as four lines at every width.
- `.marketing-brand` and the four figcaption links have no `:hover` state. `.marketing-nav-cta` is 36px tall where every other CTA is 44px.
- Six mono violations: `S-STYLE STANDARD`, `.axe.svg`, `50`, `2`, `NUT`/`JOINT`/`SADDLE`, `+ compensation` — none are physical quantities.
- `.proof-strip`'s `aria-label` is "Core product guarantees," but "50 undo steps" is a feature and "2 sibling workbenches" is undefined jargon.
- Heading outline, accessible names, alt attributes, `prefers-reduced-motion` and `:focus-visible` all scan clean. Zero console errors, zero 404s across 52 resources.

## Questions to Consider

1. The product's claim is that changing one number moves another. Why is the only depiction of it three boxes that cannot change — when `scaleMath.ts` already computes it and the corpus guarantees it?
2. If the two strongest pieces of evidence you own (the calibration square, the golden corpus) are the two least visible things on the page, what is the paper actually proving?
3. Delete the hero sheet and the geometry chain. Does anything on the remaining 3,300px say "guitars" rather than "cabinets, skateboards, or knife handles"?
4. The page opens with paper on a bench and closes with a dark rectangle and a white button. The product ends with a paper pattern on a bandsaw. Which is the memory you want?
5. Gold means "the current, active, or locked one." What is current on this landing page?
