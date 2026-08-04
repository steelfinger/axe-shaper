import type { BridgePreset, NeckPreset, PickupRoutSpec, PickupType } from '../types/guitar';

// pocketWidthMm/pocketDepthMm/pocketCornerRadiusMm duplicate
// jointWidthMm/jointDepthMm/jointCornerRadiusMm below - the iOS writer's name
// for the same measurement. Rendering and export here still read joint*; the
// pocket* copy exists so a project this app writes carries both names.
export const NECK_PRESETS: Record<string, NeckPreset> = {
  fender_strat_21: {
    id: 'fender_strat_21',
    name: 'S-Style Standard (25.5" Scale, 21 Frets)',
    scaleLengthMm: 647.7,     // 25.5 inches
    nutToBodyEdgeMm: 390.7,   // Nut to Fret 16 (body entrance edge Y=0)
    nutToJointMm: 458.7,      // Nut to end of fingerboard overhang
    frets: 21,
    jointWidthMm: 55.56,      // 2-3/16 inches
    jointDepthMm: 76.2,       // 3.0 inches pocket length into the body
    jointCornerRadiusMm: 6.35, // 1/4 inch - radius left by the router bit
    pocketWidthMm: 55.56,
    pocketDepthMm: 76.2,
    pocketCornerRadiusMm: 6.35,
    style: 'fender_style',
  },
  fender_tele_22: {
    id: 'fender_tele_22',
    name: 'T-Style Standard (25.5" Scale, 22 Frets)',
    scaleLengthMm: 647.7,     // 25.5 inches
    nutToBodyEdgeMm: 390.7,   // Nut to Fret 16 (body entrance edge Y=0)
    nutToJointMm: 458.7,
    frets: 22,
    jointWidthMm: 55.56,
    jointDepthMm: 76.2,
    jointCornerRadiusMm: 6.35, // Same routed pocket as the S-Style - not square
    pocketWidthMm: 55.56,
    pocketDepthMm: 76.2,
    pocketCornerRadiusMm: 6.35,
    style: 'fender_style',
  },
  gibson_lp_22: {
    id: 'gibson_lp_22',
    name: 'Single-Cut Vintage (24.75" Scale, 22 Frets)',
    scaleLengthMm: 628.65,    // 24.75 inches
    nutToBodyEdgeMm: 379.2,   // Nut to Fret 16 (body entrance edge Y=0)
    nutToJointMm: 414.27,
    frets: 22,
    jointWidthMm: 38.1,       // 1.5 inches mortise
    jointDepthMm: 101.6,      // 4.0 inches - long tenon, runs under the neck pickup rout
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 38.1,
    pocketDepthMm: 101.6,
    pocketCornerRadiusMm: 6.35,
    style: 'gibson_style',
  },
  gibson_sg_22: {
    id: 'gibson_sg_22',
    name: 'Double-Cut SG Vintage (24.75" Scale, 22 Frets, Fret 16 Joint Line)',
    scaleLengthMm: 628.65,    // 24.75 inches
    // A real SG joins at fret 19, but Y=0 here is the top of the *outline*, and the SG
    // template's horn tips sit at Y=0 rather than reaching up past the joint. Dialling in
    // fret 19 without redrawing those horns drags the whole body ~40mm up the neck.
    nutToBodyEdgeMm: 379.2,   // Nut to Fret 16 (body entrance edge Y=0)
    nutToJointMm: 414.27,
    frets: 22,
    jointWidthMm: 38.1,       // 1.5 inches mortise
    jointDepthMm: 76.2,       // SG pocket depth inside body
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 38.1,
    pocketDepthMm: 76.2,
    pocketCornerRadiusMm: 6.35,
    style: 'gibson_style',
  },
  gibson_firebird_19: {
    id: 'gibson_firebird_19',
    name: 'Firebird-Style (24.75" Scale, 22 Frets, Fret 19 Joint Line)',
    scaleLengthMm: 628.65,    // 24.75 inches
    // Unlike sg_style, GIBSON_FIREBIRD_ANCHORS' horn tip sits above Y=0
    // (~-19mm), so - per the warning on sg_style below - it's safe to use a
    // deeper join than fret 16 here. The real Firebird joins around fret 19
    // (theoretical fret-19 distance is ~418.9mm), but this preset models a
    // normal glued/bolted pocket joint rather than the real guitar's
    // neck-through construction (this app has no distinct neck-through
    // concept), so the value is calibrated instead to the measured TOM post
    // line on a real routing template (206-209mm from the joint line,
    // average 207.5mm via getSaddleYMm with tune_o_matic_firebird's 3.0mm
    // treble compensation), which is more precise than the theoretical fret
    // math alone.
    nutToBodyEdgeMm: 424.15,  // Nut to body entrance edge Y=0, back-solved from the measured bridge position
    nutToJointMm: 459.2,
    frets: 22,
    jointWidthMm: 38.1,       // 1.5 inches - same pocket width as the other Gibson-style presets, matches the routing template's 3.80cm reference dimension
    jointDepthMm: 82.0,       // Pocket depth, measured off the routing template
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 38.1,
    pocketDepthMm: 82.0,
    pocketCornerRadiusMm: 6.35,
    style: 'gibson_style',
  },
  gretsch_thunderbird_22: {
    id: 'gretsch_thunderbird_22',
    name: 'Thunderbird-Style (24.75" Scale, 22 Frets)',
    scaleLengthMm: 628.65,    // 24.75 inches - same as gibson_sg_22, unchanged from the SG template this was built from
    // Started from gibson_sg_22's nutToBodyEdgeMm (379.2mm, giving a 252.45mm
    // saddle line with tune_o_matic), then shifted 5mm toward the neck per
    // spec for this body, i.e. saddle line at 247.45mm -> theoreticalSaddleY
    // 244.45mm -> nutToBodyEdgeMm = 628.65 - 244.45 = 384.2mm.
    nutToBodyEdgeMm: 384.2,
    nutToJointMm: 419.3,
    frets: 22,
    jointWidthMm: 38.1,       // Matches THUNDERBIRD_ANCHORS' pocket anchors (x=+-19.05)
    jointDepthMm: 76.2,       // Carried over from gibson_sg_22 - not separately measured for this template
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 38.1,
    pocketDepthMm: 76.2,
    pocketCornerRadiusMm: 6.35,
    style: 'gibson_style',
  },
  gibson_flying_v_22: {
    id: 'gibson_flying_v_22',
    name: 'V-Style Vintage (24.75" Scale, 22 Frets)',
    scaleLengthMm: 628.65,    // 24.75 inches - same as gibson_sg_22, unchanged from the SG template this was built from
    // Measured from the joint line: bridge at 7-3/4" to 7-27/32" (tilted;
    // averaged to 198.04mm) -> theoreticalSaddleY 195.04mm (less
    // tune_o_matic's 3.0mm treble compensation) -> nutToBodyEdgeMm =
    // 628.65 - 195.04 = 433.61mm.
    nutToBodyEdgeMm: 433.61,
    nutToJointMm: 468.68,
    frets: 22,
    jointWidthMm: 38.1,       // Matches V_STYLE_ANCHORS' pocket anchors (x=+-19.05)
    jointDepthMm: 67.0,       // Given directly for this template
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 38.1,
    pocketDepthMm: 67.0,
    pocketCornerRadiusMm: 6.35,
    style: 'gibson_style',
  },
  baritone_27: {
    id: 'baritone_27',
    name: 'Baritone Extended (27.0" Scale, 24 Frets)',
    scaleLengthMm: 685.8,     // 27.0 inches
    nutToBodyEdgeMm: 415.8,   // Nut to body entrance edge Y=0
    nutToJointMm: 485.8,
    frets: 24,
    jointWidthMm: 57.0,
    jointDepthMm: 76.2,
    jointCornerRadiusMm: 12.7,
    pocketWidthMm: 57.0,
    pocketDepthMm: 76.2,
    pocketCornerRadiusMm: 12.7,
    style: 'baritone',
  },
};

export const BRIDGE_PRESETS: Record<string, BridgePreset> = {
  hardtail_6: {
    id: 'hardtail_6',
    name: 'Hardtail 6-Saddle Plate',
    scaleReference: 'saddle_line',
    compensationMm: {
      treble: 1.5,
      bass: 4.5,
    },
    saddleOffsetYMm: 24.0,
    mountingPoints: [
      { x: -21, y: 15 },
      { x: 0, y: 15 },
      { x: 21, y: 15 },
    ],
    widthMm: 73.0,
    lengthMm: 42.0,
  },
  tremolo_strat: {
    id: 'tremolo_strat',
    name: 'Vintage 6-Screw Tremolo Bridge',
    scaleReference: 'saddle_line',
    compensationMm: {
      treble: 2.0,
      bass: 5.0,
    },
    saddleOffsetYMm: 22.0,
    mountingPoints: [
      { x: -28, y: -8 },
      { x: -16.8, y: -8 },
      { x: -5.6, y: -8 },
      { x: 5.6, y: -8 },
      { x: 16.8, y: -8 },
      { x: 28, y: -8 },
    ],
    widthMm: 83.5,
    lengthMm: 40.0,
  },
  tune_o_matic: {
    id: 'tune_o_matic',
    name: 'Tune-O-Matic + Stopbar Tailpiece',
    scaleReference: 'post_line',
    compensationMm: {
      treble: 3.0,
      bass: 6.0,
    },
    saddleOffsetYMm: 7.0,
    mountingPoints: [
      { x: -37.0, y: 0 },
      { x: 37.0, y: 0 },
      { x: -41.0, y: 45.0 },
      { x: 41.0, y: 45.0 },
    ],
    widthMm: 84.0,
    lengthMm: 14.0,
  },
  tune_o_matic_firebird: {
    id: 'tune_o_matic_firebird',
    name: 'Tune-O-Matic + Stopbar Tailpiece (Firebird spacing)',
    scaleReference: 'post_line',
    // Same plate/compensation as tune_o_matic, but the tailpiece sits 39.5mm
    // behind the post line here (not 45mm) - measured off the real routing
    // template (bridge posts ~207.5mm, tailpiece 247mm from the joint line).
    compensationMm: {
      treble: 3.0,
      bass: 6.0,
    },
    saddleOffsetYMm: 7.0,
    mountingPoints: [
      { x: -37.0, y: 0 },
      { x: 37.0, y: 0 },
      { x: -41.0, y: 39.5 },
      { x: 41.0, y: 39.5 },
    ],
    widthMm: 84.0,
    lengthMm: 14.0,
  },
  tele_bridge_plate: {
    id: 'tele_bridge_plate',
    name: 'Vintage T-Style Bridge & Pickup Plate',
    scaleReference: 'saddle_line',
    compensationMm: {
      treble: 2.5,
      bass: 5.5,
    },
    saddleOffsetYMm: 52.0,
    mountingPoints: [
      { x: -32.5, y: 24 },
      { x: 0, y: 24 },
      { x: 32.5, y: 24 },
    ],
    widthMm: 76.5,
    lengthMm: 86.0,
  },
};

/**
 * Default rout dimensions per pickup type. These seed a PickupPlacement when
 * one is created; the placement carries its own copy from then on, so editing
 * a spec here does not resize routs on existing designs.
 */
export const PICKUP_SPECIFICATIONS: Record<PickupType, PickupRoutSpec & { name: string }> = {
  humbucker: {
    name: 'Standard Humbucker (Covered)',
    widthMm: 70.0,
    heightMm: 38.0,
    cornerRadiusMm: 4.0,
  },
  single_coil: {
    name: 'Strat-Style Single Coil',
    widthMm: 70.0,
    heightMm: 18.0,
    cornerRadiusMm: 9.0,
  },
  p90: {
    name: 'P-90 Soapbar',
    widthMm: 85.0,
    heightMm: 35.0,
    cornerRadiusMm: 6.0,
  },
  tele_neck: {
    name: 'Tele-Style Chrome Neck Pickup',
    widthMm: 65.0,
    heightMm: 15.0,
    cornerRadiusMm: 7.5,
  },
  tele_bridge: {
    name: 'Tele-Style Slanted Bridge Pickup',
    widthMm: 73.0,
    heightMm: 20.0,
    cornerRadiusMm: 6.0,
  },
};
