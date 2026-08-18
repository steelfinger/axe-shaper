---
name: Axe Shaper
description: A dark, precision workspace for designing true-scale electric guitar bodies.
colors:
  bg-primary: "#0f1117"
  bg-secondary: "#161922"
  bg-tertiary: "#1e2230"
  bg-hover: "#282d3f"
  panel-bg: "rgba(22, 25, 34, 0.85)"
  panel-border: "rgba(255, 255, 255, 0.08)"
  text-primary: "#f0f4f8"
  text-secondary: "#94a3b8"
  text-muted: "#64748b"
  accent-gold: "#d1a53d"
  accent-blue: "#38bdf8"
  accent-green: "#10b981"
  accent-red: "#ef4444"
  accent-purple: "#a855f7"
  paper-plan: "#f5f3eb"
  paper-screen: "#eeece4"
typography:
  marketing-display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(3.5rem, 6.5vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    letterSpacing: "0.05em"
    fontFeature: "uppercase"
  mono:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: "0.78rem"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "30px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, #2563eb, #1d4ed8)"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "linear-gradient(135deg, #1d4ed8, #1e40af)"
  button-accent:
    backgroundColor: "linear-gradient(135deg, #059669, #047857)"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-accent-hover:
    backgroundColor: "linear-gradient(135deg, #047857, #065f46)"
  button-ghost:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-ghost-hover:
    backgroundColor: "{colors.bg-hover}"
  button-marketing:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.bg-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
---

# Design System: Axe Shaper

## Overview

**Creative North Star: "The Luthier's Night Bench"**

Axe Shaper reads like a workshop after hours: a dark room, one warm
antique-gold work-light, and precision instruments laid out on dark glass.
The chrome around the canvas is quiet on purpose — near-black slate panels,
hairline borders, no ornament — so the only thing asking for attention is the
gold accent marking whatever is *currently live*: the active tab, the
selected template, a locked anchor. The mood is precise, quiet, and
technical, closer to a well-made measuring tool than a creative app; it
should never read as playful or as generic SaaS chrome.

**Key Characteristics:**
- Near-black navy-slate surfaces (`#0f1117` → `#282d3f`) with a single warm
  antique-gold accent (`#d1a53d`) reserved for "this is active/current/locked."
  A cooler sky-blue and emerald green carry secondary, purpose-specific
  signals (focus/info, save/confirm) rather than competing for the same
  attention gold owns.
- Flat, bordered structural chrome; floating overlays get glass treatment.
  See the Floating Glass Rule in Elevation & Depth.
- JetBrains Mono for every physical/numeric readout (zoom %, scale bar,
  coordinates), Inter for everything else — the split makes measurement text
  visually distinct from UI copy at a glance.
- Tactile, confident controls: buttons read as solid and clickable, sized for
  a tool used for long sessions.
- Public surfaces open the dark bench around one bright, physical artifact: the
  actual printable plan. The paper is proof and content, never ambient decoration.
- The split guitar/axe mark is the recognizable brand signature: simplified at
  chrome scale, materially textured when it has enough room to read.

## Colors

Dark navy-slate neutrals dominate; color is spent narrowly and each hue has
exactly one job.

### Primary
- **Antique Gold** (`#d1a53d`): the "this is active" signal — active sidebar
  tab, selected template card, locked anchor point, the brand badge, the
  neck-pocket joint line on canvas. Never decorative.

### Secondary
- **Sky Blue** (`#38bdf8`): focus and information — input focus rings, the
  primary save/confirm button gradient (`#2563eb`→`#1d4ed8`), selected Bezier
  nodes/handles, the centerline axis on canvas.
- **Emerald Green** (`#10b981`): the save/confirm action — the header's Save
  button gradient (`#059669`→`#047857`), default (unselected) Bezier handles.
- **Signal Red** (`#ef4444`): destructive actions only — delete buttons on
  saved templates and layer shapes. The deep figured crimson inside the brand
  mark is identity artwork, not an additional interface status color.

### Tertiary
- **Violet Purple** (`#a855f7`, canvas-drawn variant `#9333ea`): a rare
  overlay color for the live bridge/neck hardware preview outline. Not a
  fourth primary action color — it appears in exactly one place.

### Neutral
- **Void** (`#0f1117`): app background, canvas backdrop (`#0b0c10` on the
  canvas itself, slightly darker still).
- **Slate** (`#161922`): header, sidebar, inspector — the docked structural
  panels.
- **Slate Raised** (`#1e2230`): cards and inputs sitting on top of slate
  (`.panel-section`, `.form-input`, `.btn`).
- **Slate Hover** (`#282d3f`): hover state for raised surfaces.
- **Hairline Border** (`rgba(255,255,255,0.08)`): the only border color in
  the system (`--panel-border`) — see the Don't about `--border-color` below.
- **Fog / Ash / Slate Text** (`#f0f4f8` / `#94a3b8` / `#64748b`): primary,
  secondary, and muted text, in that order of emphasis.
- **Plan Paper / Screen Paper** (`#f5f3eb` / `#eeece4`): the printable artifact
  and its native-device preview. These warm near-whites belong only to a real
  output or work surface; they are not alternate page backgrounds.

### Named Rules
**The Gold Is Truth Rule.** The antique-gold accent always means "this is the
current, active, or locked one." It is never used for a button that isn't the
active state of a toggle, never for decoration. Its rarity across an
otherwise near-monochrome UI is what makes it legible at a glance.

## Typography

**Body/UI Font:** Inter (with system-ui, -apple-system, sans-serif)
**Label/Mono Font:** JetBrains Mono (physical readouts only)

**Character:** A plain, technical grotesque doing all the talking — no
display face, no decorative headline type. Precision comes from restraint
and the mono/sans split, not from typographic flourish.

### Hierarchy
- **Marketing Display** (700, `clamp(3.5rem, 6.5vw, 6rem)`, 0.94, -0.04em):
  public-page thesis statements only. It keeps the same technical sans voice
  but uses physical scale rather than introducing a decorative display face.
- **Title** (700, 1.15rem, -0.02em): the "Axe Shaper" brand wordmark — the
  only place this weight/size combination appears.
- **Section Label** (600, 0.85rem, 0.05em, uppercase): panel section
  headings (`.section-title`), form labels.
- **Body** (400–500, 0.78–0.9rem): panel copy, template names, modal text.
- **Small Label** (600–800, 0.7–0.78rem, often uppercase): badges (`2D
  Luthier`), category tags, calibration units.
- **Numeric/Mono** (400–500, 0.72–0.8rem, JetBrains Mono): zoom percentage,
  scale-bar text, anything that states a physical quantity.

### Named Rules
**The Mono-Means-Measured Rule.** If a piece of text states a physical
quantity the user could act on with a ruler or a router, it is set in
JetBrains Mono. Everything else — labels, copy, names — is Inter.

## Layout

A fixed three-column CSS grid, not a fluid app shell: `56px` header row over
`320px` sidebar / flexible canvas / `300px` inspector columns
(`grid-template-columns: 320px 1fr 300px`). This is a professional-tool
layout, not a responsive marketing page — it assumes a desktop viewport wide
enough to show all three columns at once, and no breakpoint currently
collapses it. Panel interiors run a `16px` padding rhythm
(`.sidebar-content`, `.app-inspector`), with `12–14px` for nested cards
(`.panel-section`) and `20px` for the header's horizontal padding. Floating
overlays center themselves independently of the grid (calibration card:
top-centered; canvas toolbar: bottom-centered).

Public pages use a separate responsive composition: a `1240px` maximum outer
rail for navigation and the opening artifact, narrowing to `1120px` for reading
sections. The first viewport is a two-part bench with copy and CTA beside one
large print sheet; below `980px` it stacks, and below `700px` all flows become a
single column. The public site changes the page layout, never the editor grid.

## Elevation & Depth

Hybrid, split by **docking**, not by z-order or by what's underneath.
Anything docked to a layout edge — header, sidebar, inspector — stays flat: a
`1px` hairline border (`--panel-border`) and nothing else, no shadow, no
blur. Anything floating free of the grid — the canvas toolbar, the
calibration card, modals — gets glass treatment: `var(--panel-bg)` at 85%
opacity, `backdrop-filter: blur(12px)`, and `--shadow-lg`
(`0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)`).
On public pages, the physical plan and iPad mockup are literal objects on the
bench and may cast deeper directional shadows; surrounding marketing sections
remain flat and separated by hairlines.

### Shadow Vocabulary
- **`--shadow-lg`** (`0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)`):
  the only shadow token; used exclusively on floating/undocked surfaces.

### Named Rules
**The Floating Glass Rule.** Blur and shadow are reserved for elements that
float free of the layout's edges — toolbars, calibration cards, modals.
Anything docked to a grid edge (header, sidebar, inspector) stays flat with a
border only, regardless of whether it happens to sit visually over the
canvas.

## Shapes

Two radius families. Structural UI (buttons, inputs, small badges) uses the
small end of the scale (`--radius-sm`, 6px). Cards, panels, and modals use
the medium step (`--radius-md`, 10px); nothing in the app currently reaches
for `--radius-lg` (14px) as a container radius. The one deliberate exception
is the floating canvas toolbar, which breaks the scale entirely with a full
`30px` pill — floating controls read as a distinct, movable object rather
than a docked panel.

### Named Rules
**The Toolbar Pill Rule.** The bottom-centered canvas toolbar is the one
element allowed a full pill radius; every other **interface container** uses
the sm/md radius scale. A second pill-shaped control surface anywhere else
would read as a second toolbar. Literal depicted hardware is exempt: the iPad
mockup follows the device silhouette rather than the UI container scale.

## Components

### Buttons
- **Shape:** 6px radius (`--radius-sm`), 1px border in `--panel-border`.
- **Default (`.btn`):** `--bg-tertiary` background, `--text-primary` text —
  the tactile, neutral base every other variant builds on.
- **Primary (`.btn-primary`):** blue gradient (`#2563eb`→`#1d4ed8`), white
  text, 600 weight — used for the active state of a segmented toggle (unit
  switch, orientation switch), not for a standalone CTA.
- **Accent (`.btn-accent`):** green gradient (`#059669`→`#047857`) — reserved
  for the header's Save action; the only green button in the app.
- **Hover:** background steps one tone lighter (`--bg-hover`, or the darker
  half of the variant's own gradient); border brightens to `rgba(255,255,255,0.2)`.
- **Small (`.btn-sm`):** `5px 10px` padding, `0.78rem` — the default size for
  icon-plus-label toolbar buttons.
- **Disabled:** `opacity: 0.4`, cursor `not-allowed`; no color change.

### Marketing CTA
- **Primary:** fog-white fill on the dark bench with void text, 6px radius and
  `10px 16px` padding. Public conversion uses contrast, not a new accent color.
- **Secondary:** raised slate with the shared hairline border.
- **Hover / Focus:** a one-pixel lift on hover and the shared sky-blue keyboard
  focus outline.

### Cards / Containers
- **Corner Style:** `--radius-md` (10px).
- **Background:** `--bg-tertiary` on a `--bg-secondary` panel (one tone up
  from the surface it sits on).
- **Border:** `1px solid --panel-border`; template/list cards swap this for
  `1px solid --accent-gold` plus a faint gold tint background
  (`rgba(209,165,61,0.12)`) when selected.
- **Shadow:** none — see Elevation & Depth; cards are docked-panel content,
  not floating.

### Inputs / Fields
- **Style:** `--bg-primary` background (one tone *darker* than its
  surrounding panel, reading as an inset well), `1px --panel-border`,
  `--radius-sm`.
- **Focus:** border shifts to `--accent-blue`; no glow or outline ring.

### Brand Mark
- **Chrome scale:** use the transparent simplified mark at `24–28px` beside the
  Axe Shaper name. Never place the opaque gray-backed small source asset there.
- **Feature scale:** the textured transparent mark may reach `140–220px` when
  bridging a digital artifact and a physical workshop image.
- **Wordmark:** keep “Axe Shaper” as accessible HTML text. The supplied metallic
  text image has an opaque gray field and is not the primary web wordmark.

### Navigation (Sidebar Tabs)
- **Style:** flex row of equal-width tabs, `0.75rem` label, `--text-muted` at
  rest, 2px bottom border transparent.
- **Active:** text and bottom border both switch to `--accent-gold`, with a
  faint gold-tinted background (`rgba(209,165,61,0.05)`) — the same gold
  language as the active-template card.

### Modals
- **Backdrop:** `rgba(0,0,0,0.75)` with `blur(4px)`.
- **Panel:** `--bg-secondary`, `--radius-md`, `0 20px 40px rgba(0,0,0,0.5)`
  shadow — a heavier shadow than `--shadow-lg`, appropriate to a modal being
  the topmost floating layer in the app.
- **Footer:** one tone up (`--bg-tertiary`) to separate actions from body
  copy.

### Canvas Workspace (signature component)
The Bezier editing surface is the product, and it has its own deliberate
color language, independent of the chrome palette above:
- **Anchor points:** `#2563eb` blue by default with a white stroke; antique
  gold (`--accent-gold`) when locked; cyan-blue (`--accent-blue`) when
  selected.
- **Bezier handles:** emerald (`--accent-green`) by default, cyan-blue when
  selected, connected to their anchor by a thin dashed line.
- **Centerline axis (X=0):** cyan-blue, labeled, low-opacity.
- **Neck-pocket joint line (Y=0):** antique gold, labeled, low-opacity — the
  one place gold marks a fixed reference rather than a UI active-state.
- **Body outline:** violet-purple when active/hovered, near-white at 15%
  opacity as the faint "ghost" reference outline.
- **Dimension/calibration overlays:** antique-gold dashed lines and tick
  marks.

## Do's and Don'ts

### Do:
- **Do** reserve the antique-gold accent exclusively for "this is the
  active/current/locked one" (The Gold Is Truth Rule) — never as a
  decorative accent.
- **Do** keep docked structural chrome (header, sidebar, inspector) flat —
  border only, no shadow or blur (The Floating Glass Rule).
- **Do** set any physical/numeric readout in JetBrains Mono (The
  Mono-Means-Measured Rule).
- **Do** size lucide icons explicitly per context: `15px` inside `.btn-sm`,
  `16–18px` in headers and modals, `20px` for the brand mark.
- **Do** use the app's own exported drawing when a public surface needs visual
  proof; the printable artifact should be recognizable without marketing copy.
- **Do** use documentary workshop photography to show the handoff from plan to
  wood, with visible creator attribution and restrained dark treatment.

### Don't:
- **Don't** add a CSS background pattern to the canvas container to imply a
  grid — it won't scale with zoom and will misrepresent millimetres; the real
  grid is drawn on the canvas itself (there's a comment to this effect in the
  code already).
- **Don't** introduce a new border token; `--panel-border` is the established
  hairline everywhere.
- **Don't** style a lucide icon with Tailwind-style class names — this project
  has no Tailwind installed. Use an explicit `size={}` prop and CSS variables.
- **Don't** give purple a second job — it's reserved for the live
  bridge/neck hardware preview overlay on canvas, nowhere else.
- **Don't** reach for `--radius-lg` (14px) on an interface container without a
  reason; the pill radius belongs to the canvas toolbar alone (The Toolbar
  Pill Rule). Literal device silhouettes are not interface containers.
- **Don't** use plan paper as a generic light section background. It denotes a
  real printable or editable work surface.
- **Don't** present the composite marketing illustration as an actual product
  screenshot; its interface is illustrative. It is reserved for social-preview
  artwork until replaced by a verified product montage.
