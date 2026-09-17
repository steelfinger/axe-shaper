# DXF export

In the web editor, choose **Export → Export DXF (.dxf)**. On narrower screens,
use **Editor menu → Export DXF (.dxf)**. Save an `.axe.svg` separately to retain
the editable project; DXF is an output format and cannot be reopened in Axe Shaper.

The file contains 1:1 2D outlines for CAD/CAM handoff. It is ASCII AutoCAD 2000
DXF (`AC1015`), with millimetres declared through `$INSUNITS = 4` and metric
measurement settings. All entities are closed, zero-width `LWPOLYLINE`s at Z=0.
This export does not generate toolpaths or G-code.

| Layer | Contents |
| --- | --- |
| `BODY_OUTLINE` | Body perimeter |
| `NECK_POCKET` | Rounded pocket outline from the design's resolved neck preset |
| `PICKUP_CAVITIES` | Actual pickup rout contours, including their placement and rotation |
| `FRONT_ROUTES` | Custom front cavity outlines |
| `BACK_ROUTES` | Custom back cavity outlines |
| `PICKGUARDS` | Pickguard perimeters |

Individual shapes marked hidden are omitted; locked shapes are included.
Canvas view toggles, zoom, pan, display units and horizontal/vertical presentation
do not change the exported coordinates. Pickguards are separate parts even though
they remain aligned with the body in the same drawing. Overlapping cavities remain
separate outlines; a CAM operator determines which operations to combine.

## Coordinates and accuracy

The origin is the intersection of the body centreline and the neck joint line.
X grows toward the right of the front view. Y grows toward the neck in CAD:
`(x, y)` in the editor becomes `(x, -y)` in DXF. This keeps the visual orientation
of an asymmetric design when moving from the screen's downward Y axis to CAD's
upward Y axis.

**Back routes use the same front-view coordinates.** They are not mirrored or
repositioned for a machining flip. The service provider must define the back-side
setup, registration and work origin. All layers share the same origin.

Cubic Bézier outlines are adaptively subdivided with a maximum curve-to-chord
deviation of 0.01 mm. Rounded neck-pocket corners use the same chord tolerance.
Coordinates are written to six decimal places (at most another 0.000001 mm of
rounding displacement). This is an export approximation tolerance, not a claim
about blueprint measurements or machining accuracy. Duplicate consecutive vertices
are removed. Open, collapsed, non-finite or excessively complex outlines fail the
whole export rather than producing a partial file or silently closing a gap.

## Information still needed for machining

Cutting depths, body thickness, edge profiles, bevels, binding, and carved surfaces
are not encoded in this 2D file. A neck preset's `jointDepthMm` is the pocket's
length in the drawing plane, not its cutting depth. Even when a custom route has a
saved depth, this first export carries only its outline.

Bridge, switch and knob illustrations, generic mounting markers, pickup covers,
centreline guides, labels, guide images, and the printing calibration square are
excluded. Hole positions and diameters need measured manufacturing definitions
before a future export can include them.

The receiving service should review dimensions against the actual hardware,
check intersecting/overlapping contours and tool access, and specify material,
stock thickness, pocket depths, tolerances, tools and workholding in CAM. The
export validates basic outline structure; it does not certify manufacturability.

## Verification

`npm run dxf:check` uses an independent DXF parser to verify every built-in
blueprint, saved iOS fixtures, physical scale, handedness, pickup rotation,
hidden shapes, Bézier tolerance, and rejection of incomplete geometry.

To write all blueprint files for inspection in a CAD program:

```sh
DXF_CHECK_OUTPUT=/tmp/axe-dxf-output npm run dxf:check
```

Format references: [Autodesk LWPOLYLINE group codes](https://help.autodesk.com/cloudhelp/2015/ENU/AutoCAD-DXF/files/GUID-748FC305-F3F2-4F74-825A-61F04D757A50.htm)
and [DXF header variables](https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-DXF/files/GUID-A85E8E67-27CD-4C59-BE61-4DC9FADBE74A.htm).
