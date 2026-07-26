# 🎸 Axe Shaper - 2D Custom Electric Guitar Body Designer

**Axe Shaper** is a modern, high-precision 2D vector web application for designing custom electric guitar body shapes from scratch or starting from iconic luthier blueprints (Stratocaster, Telecaster, Les Paul, and Double-Cut SG).

Built with **React 18**, **TypeScript**, **Konva.js**, **Lucide Icons**, and a sleek **Dark Luthier Studio** design system.

---

## ✨ Features

- 📐 **Physical Millimeter Coordinate System (`LengthMm`)**: All geometry, anchors, and cavity dimensions are stored in physical millimeters. Viewport zoom and pan operate as an independent camera, preserving exact model dimensions.
- 🎨 **Node-Based Bezier Curve Editor**: Drag anchor points and handle bars with cubic Bezier path evaluation. Subdivide curve segments on-the-fly using De Casteljau's algorithm without distorting existing curves.
- ↔️ **Switchable Canvas Orientation**: Toggle between **Vertical** (neck pocket at top) and **Horizontal** (neck joint pointing right in standard right-handed playing orientation).
- 🎸 **Iconic Luthier Templates**:
  - **Double-Cut SG Vintage** (Symmetric Gibson/Yamaha style double-cutaway)
  - **Single-Cut Vintage** (Les Paul style with authentic cutaway scoop and teardrop lower bout)
  - **S-Style Standard** (Double cutaway with sweeping horns and waist contours)
  - **T-Style Standard** (Single cutaway with classic flat edge profile)
- 📐 **Dynamic Scale-Length & Intonation Math**:
  - Automatically calculates bridge saddle Y-offset:
    $$\text{Saddle } Y = \text{ScaleLength}_{\text{mm}} - \text{NutToJoint}_{\text{mm}} + \text{Compensation}_{\text{treble}}$$
  - Supports 25.5" Fender, 24.75" Gibson, and 27" Baritone scale lengths.
- 🔒 **Neck Pocket Auto-Snapping**: Body shoulder anchors automatically snap when swapping neck joint presets (55.56mm Fender vs 38.1mm Mortise).
- 🖨️ **1:1 True-Scale Printable SVG Export**: Export SVG files formatted in physical millimeters with an included **100mm x 100mm ruler calibration box** for 100% true-scale paper printing on standard printers or plotters.
- 💾 **Project Persistence & History**: Full Undo/Redo (`Cmd+Z` / `Ctrl+Z`, `Cmd+Y` / `Ctrl+Y`) and `.guitar` JSON file save and load.

---

## 🛠️ Technology Stack

- **Frontend Framework**: React 18 + Vite
- **Language**: TypeScript (Full type safety)
- **Canvas Engine**: Konva.js & `react-konva`
- **Icons**: Lucide React
- **Styling**: Vanilla CSS Design System (Dark Glassmorphism UI)

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/axe-shaper-app.git
   cd axe-shaper-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your web browser.

4. Build for production:
   ```bash
   npm run build
   ```

---

## 📚 Documentation

- [Implementation Plan](file:///Users/teroaarnio/dev/axe-shaper-app/docs/IMPLEMENTATION_PLAN.md)
- [Project Roadmap](file:///Users/teroaarnio/dev/axe-shaper-app/docs/ROADMAP.md)
- [Architectural Walkthrough](file:///Users/teroaarnio/dev/axe-shaper-app/docs/WALKTHROUGH.md)

---

## 📄 License

MIT License © 2026 Axe Shaper Contributors
