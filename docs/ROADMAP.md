# Axe Shaper (2D Guitar Designer) - Project Roadmap

This document outlines the development phases, technical architecture milestones, and feature roadmap for **Axe Shaper**.

---

## 🎯 Phase Overview

```
Phase 1: Core Geometry & Bezier Engine (Completed)
  ├── Millimeter-based Physical Coordinate Model (LengthMm)
  ├── De Casteljau Bezier Curve Splitting Algorithm
  ├── Live Centerline Symmetry Engine
  ├── Switchable Canvas Orientation (Vertical ↕ / Horizontal ↔ with Neck Joint Pointing Right)
  ├── Konva Interactive Canvas Viewport with Zoom, Pan, Grid, and Centerline Axis
  ├── Full Undo/Redo History Manager Stack
  └── 1:1 True-Scale Printable SVG Exporter (with 100mm Ruler Calibration Box)

Phase 2: Luthier Constraints & Dynamic Hardware Math (Completed)
  ├── Neck Pocket Presets (Fender Square 55.56mm, Fender Rounded 55.56mm, Mortise 38.1mm)
  ├── Dynamic Scale-Length & Intonation Compensation Bridge Placement (25.5", 24.75", 27")
  ├── Neck Shoulder Anchor Auto-Snapping
  ├── Live Dimension Overlays (Max Body Width, Total Length)
  └── Iconic Refined Blueprint Templates (Double-Cut SG, Single-Cut LP, S-Style, T-Style)

Phase 3: Hardware Placement & Project Persistence (Next Scope)
  ├── Additional Pickup Cavities (Humbucker, Single-Coil, P90, Tele Neck/Bridge)
  ├── Control Cavity Routing Outlines & Jack Plate Markers
  ├── Pickguard Contour Generator Layer
  └── Versioned .guitar JSON Project File Import/Export

Phase 4: Advanced Manufacturing & Rendering
  ├── DXF CAD Vector Export for CNC Routers
  ├── Tiled Multi-Page PDF Printing for Standard Printers
  ├── Parametric Edge Bevels & Contour Sliders
  └── High-Resolution PNG Render Export with Photorealistic Wood Grain Patterns
```

---

## 📐 Mathematical Foundations

### 1. Coordinate System Matrix
- **Origin `(0, 0)`**: Set at the intersection of the body centerline ($X = 0$) and the neck pocket joint line ($Y = 0$).
- **Units**: Physical millimeters (`LengthMm = number`). Viewport conversion is strictly camera mapping:
  $$\text{screenX} = \text{originX} + x \cdot \text{zoom}$$
  $$\text{screenY} = \text{originY} + y \cdot \text{zoom}$$

### 2. Scale-Length & Intonation Bridge Math
- Theoretical Saddle Line $Y$-position:
  $$Y_{\text{saddle}} = \text{ScaleLength}_{\text{mm}} - \text{NutToJoint}_{\text{mm}}$$
- Actual Hardware Position:
  $$Y_{\text{bridge}} = Y_{\text{saddle}} + \text{Compensation}_{\text{treble}}$$
