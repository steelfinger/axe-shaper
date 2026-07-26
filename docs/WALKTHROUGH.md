# Axe Shaper (2D Guitar Designer) - Architectural Walkthrough

**Axe Shaper** is a 2D vector-based custom electric guitar body designer web application built with **React + TypeScript + Konva**.

---

## 🏗️ Architecture Overview

```
[ Domain Data Model (Millimeters) ]
              │
    ┌─────────┴─────────┐
    ▼                   ▼
[ Geometry Engine ]  [ SVG Serializer ]
(De Casteljau,      (1:1 Scale SVG Export
 Symmetry, Math)     with 100mm Calibration Box)
    │
    ▼
[ Konva Viewport ]
(Zoom, Pan, Grid, Layers, Bezier Handles)
```

### Core Architecture Components

1. **Domain Model (`src/types/guitar.ts`)**:
   - Stored strictly in physical millimeters (`LengthMm = number`).
   - Uses `PathAnchor` containing position, cubic Bezier `handleIn`, `handleOut`, `handleMode`, and `semanticRole`.

2. **Bezier Curve & Splitting Utility (`src/utils/bezier.ts`)**:
   - Calculates smooth SVG cubic paths (`M... C... Z`).
   - Implements De Casteljau's algorithm (`insertAnchorOnSegment`) to subdivide curve segments without distorting existing geometry.

3. **Live Centerline Symmetry Engine (`src/utils/symmetry.ts`)**:
   - Mirrors left-side anchors ($x < 0$) to right-side anchors ($x > 0$) across the $X=0$ centerline axis when enabled.

4. **Printable 1:1 Scale SVG Exporter (`src/utils/svgExporter.ts`)**:
   - Generates physical SVG files formatted in millimeters with a **100mm x 100mm ruler calibration box** for 100% true-scale paper printing.

5. **Iconic Luthier Templates (`src/constants/templates.ts`)**:
   - **Double-Cut SG Vintage (`sg_style`)**: Symmetric Gibson/Yamaha style double-cutaway.
   - **Single-Cut Vintage (`single_cut`)**: Authentic Les Paul silhouette with cutaway scoop (`cutaway_inner_scoop`).
   - **S-Style Standard (`s_style`)**: Double cutaway body with contoured waist and upper horn sweeps.
   - **T-Style Standard (`t_style`)**: Single cutaway solid body with flat edge profile.

6. **Interactive Canvas Viewport (`src/components/CanvasWorkspace.tsx`)**:
   - Supports mouse wheel zoom ($0.4\times$ to $3.5\times$), panning, grid overlay, centerline axis, and draggable anchor/handle circles.
   - Switchable orientation: **Vertical** (neck pocket at top) and **Horizontal** (neck joint pointing right in standard right-handed playing position).

7. **Undo/Redo History Manager (`src/utils/history.ts`)**:
   - Full command history stack with `Cmd+Z` / `Ctrl+Z` and `Cmd+Y` / `Ctrl+Y` support.
