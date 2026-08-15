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
    // fret 19 without redrawing those horns drags the whole body ~40mm up the neck - this
    // value is still back-solved the same way as gibson_firebird_19 / gretsch_thunderbird_22
    // below, not derived from a fret number.
    // Target bridge (compensated saddle) position 214.5mm - a fixed real
    // target, independent of whatever tune_o_matic's own compensationMm
    // says - -> theoreticalSaddleY = 214.5 - compensationMm.treble ->
    // nutToBodyEdgeMm = 628.65 - theoreticalSaddleY. Originally solved
    // against tune_o_matic's old (buggy) 3.0mm treble compensation:
    // theoreticalSaddleY 211.5mm -> nutToBodyEdgeMm 417.15mm. Re-solved here
    // for the corrected 37.5mm: theoreticalSaddleY = 214.5 - 37.5 = 177.0mm
    // -> nutToBodyEdgeMm = 628.65 - 177.0 = 451.65mm - otherwise this body's
    // real 214.5mm bridge position would jump ~34.5mm down the body for a
    // reason that has nothing to do with this template.
    nutToBodyEdgeMm: 451.65,
    // A real SG joins at fret 19; theoretical fret-19 distance on this
    // 628.65mm scale is ~418.9mm (same figure gibson_firebird_19 states
    // below). Unlike nutToBodyEdgeMm, this field isn't read by any geometry -
    // scaleMath.ts warns against using it for saddle Y - it's sidebar display
    // only, so it doesn't need back-solving around the Y=0 quirk; the plain
    // fret-19 distance is what "Nut-to-Joint" should show. Previously
    // 414.27mm, byte-identical to gibson_lp_22's - a copy-paste placeholder.
    nutToJointMm: 418.9,
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
    // average 207.5mm via getSaddleYMm), which is more precise than the
    // theoretical fret math alone. That average is a fixed real target,
    // independent of whatever tune_o_matic's own compensationMm says -
    // originally solved against its old (buggy) 3.0mm treble compensation:
    // theoreticalSaddleY 204.5mm -> nutToBodyEdgeMm 424.15mm. Re-solved here
    // for the corrected 37.5mm: theoreticalSaddleY = 207.5 - 37.5 = 170.0mm
    // -> nutToBodyEdgeMm = 628.65 - 170.0 = 458.65mm - a ~34.5mm shift that
    // exactly cancels tune_o_matic's own compensation correction, so the
    // real measured 207.5mm bridge position is unchanged.
    nutToBodyEdgeMm: 458.65,  // Nut to body entrance edge Y=0, back-solved from the measured bridge position
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
    // Started from gibson_sg_22's original nutToBodyEdgeMm (379.2mm, giving a
    // 252.45mm saddle line with tune_o_matic's old 3.0mm compensation), then
    // shifted 5mm toward the neck per spec for this body: target saddle line
    // 247.45mm - a fixed real target, independent of whatever tune_o_matic's
    // own compensationMm says. Originally solved against the old 3.0mm:
    // theoreticalSaddleY 244.45mm -> nutToBodyEdgeMm 384.2mm. Re-solved here
    // for the corrected 37.5mm: theoreticalSaddleY = 247.45 - 37.5 = 209.95mm
    // -> nutToBodyEdgeMm = 628.65 - 209.95 = 418.7mm.
    nutToBodyEdgeMm: 418.7,
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
    // 483.15 (this table's value through the TOM-compensation fix) was never
    // the number actually shipping to a *new* document created from this
    // template: gibson_flying_v.axe.svg's own embedded copy diverged from
    // this table entry across three separate fixes today (blueprint-shape
    // clearance, TOM bridgePlateTopY) - each one only ever patched the
    // blueprint file's copy, never this shared entry, because "the copy
    // wins" applies to *opening an existing file*, not to *creating a new
    // one*: ReferenceTemplate (src/constants/templates.ts) carries only
    // neckPresetId/bridgePresetId, not the embedded neckPreset/bridgePreset
    // themselves, so a fresh document resolves straight from this table and
    // never saw any of those fixes. Set to match: fret22Distance(628.65) -
    // 74 = 378.24, where 74 is this body's own fret-22-past-the-joint-line
    // measurement (2.37mm past the horn-scoop start), not re-derived here -
    // see gibson_flying_v.axe.svg's own embedded copy, which now matches.
    nutToBodyEdgeMm: 378.24,
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
  jaguar_22: {
    id: 'jaguar_22',
    name: 'Jaguar-Style (610 mm Scale, 22 Frets)',
    scaleLengthMm: 610.0,
    // jag_style.axe.svg's default bridge is tune_o_matic (this app's own
    // pairing choice, not a real Jaguar's floating vibrato). Target
    // compensated saddle line: 237.5mm - a fixed real target, independent of
    // whatever tune_o_matic's own compensationMm says. Originally solved
    // against its old (buggy) 3.0mm treble compensation: theoretical saddle
    // Y 234.5mm -> nutToBodyEdgeMm 375.5mm. Re-solved here for the corrected
    // 37.5mm: theoretical saddle Y = 237.5 - 37.5 = 200.0mm ->
    // nutToBodyEdgeMm = 610.0 - 200.0 = 410.0mm.
    nutToBodyEdgeMm: 410.0,
    nutToJointMm: 439.0,
    frets: 22,
    jointWidthMm: 55.56,
    jointDepthMm: 76.2,
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 55.56,
    pocketDepthMm: 76.2,
    pocketCornerRadiusMm: 6.35,
    style: 'fender_style',
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
    name: 'F-style Hardtail',
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
    name: 'F-style Tremolo',
    scaleReference: 'saddle_line',
    compensationMm: {
      treble: 2.0,
      bass: 5.0,
    },
    // Plate footprint measured directly: front edge 249mm from the joint
    // line -> saddleOffsetYMm = saddleY(259.0, fender_strat_21 + this
    // bridge's 2.0mm treble compensation) - 249 = 10mm. widthMm/lengthMm are
    // the measured 74mm / 38mm plate size, not the original guess.
    //
    // This table entry, not s_style.axe.svg's embedded copy, is what
    // template selection actually resolves - see the tele_bridge_plate
    // comment above (same bug, same fix, this is the S-Style equivalent).
    saddleOffsetYMm: 10.0,
    // No mountingPoints: real screw positions are bridge-model-specific
    // detail this app doesn't model accurately, and the old six were fixed
    // to the pre-fix plate's geometry - stale, drawn outside the corrected
    // plate. Omitted rather than re-guessed.
    widthMm: 74.0,
    lengthMm: 38.0,
  },
  tune_o_matic: {
    id: 'tune_o_matic',
    name: 'TOM-style Bridge',
    scaleReference: 'post_line',
    // getSaddleYMm doesn't branch on scaleReference (see the comment there) -
    // it just adds compensationMm.treble to the theoretical saddle Y, same as
    // every other bridge type. A real Tune-O-Matic bridge sits slanted 2-3
    // degrees off the post line (treble/high-E side ~3mm closer to the neck
    // than bass/low-E), and its saddles sit well back of the post line
    // itself - the high E's free string length should land almost exactly on
    // the neck's own nominal scale length, with the saddle set back roughly
    // 37-38mm from that theoretical (uncompensated) point. An earlier pass
    // here used 4.0/8.0mm - just far enough from hardtail_6/tremolo_strat's
    // 1.5-2.5mm cluster to stop reading as "selecting a TOM bridge does
    // nothing," but not a real measurement. This replaces that guess with
    // the actual bridge geometry: 37.5mm treble (midpoint of the 37-38mm
    // range), bass 3mm further out (the low-E side's longer free length from
    // the same slant) at 40.5mm - a much larger treble/bass gap than the
    // other bridges' 2-3.5mm, because most of this number is the bridge's
    // own structural post-to-saddle offset (shared by both strings), not
    // per-string intonation compensation.
    compensationMm: {
      treble: 37.5,
      bass: 40.5,
    },
    saddleOffsetYMm: 7.0,
    // One shared tailpiece spacing for every Tune-O-Matic-mounted body
    // (formerly split out into tune_o_matic_firebird's own 39.5mm figure) -
    // as long as the bridge-to-tailpiece run is long enough to string
    // through, the exact distance isn't worth a second preset entry.
    mountingPoints: [
      { x: -37.0, y: 0 },
      { x: 37.0, y: 0 },
      { x: -41.0, y: 45.0 },
      { x: 41.0, y: 45.0 },
    ],
    widthMm: 84.0,
    lengthMm: 14.0,
  },
  tele_bridge_plate: {
    id: 'tele_bridge_plate',
    name: 'T-Style Vintage',
    scaleReference: 'saddle_line',
    compensationMm: {
      treble: 2.5,
      bass: 5.5,
    },
    // Plate footprint measured directly: front edge 192mm from the joint
    // line, back edge 284mm -> lengthMm = 284 - 192 = 92mm; saddleOffsetYMm
    // (front edge to the saddle line) = saddleY(259.5, fender_tele_22 +
    // this bridge's 2.5mm treble compensation) - 192 = 67.5mm. widthMm is
    // the earlier-measured plate width (79.9mm), not the original guess.
    //
    // This table entry, not a blueprint file's embedded copy, is what
    // t_style.axe.svg's bridgePresetId: 'tele_bridge_plate' actually
    // resolves to on template selection - see the neckPresetFields/
    // bridgePresetFields comment in utils/presets.ts. Three earlier fixes
    // that only edited the blueprint file's embedded bridgePreset never
    // reached the app, because handleSelectTemplate re-resolves hardware by
    // id from this table and discards whatever a blueprint's own copy says.
    saddleOffsetYMm: 67.5,
    // No mountingPoints: real screw positions are bridge-model-specific
    // detail this app doesn't model accurately, and the old three (-32.5/0/
    // 32.5, y:24) were fixed to the pre-fix plate's geometry - now stale and
    // drawn outside the corrected plate. Omitted rather than guessed.
    widthMm: 79.90847906788953,
    lengthMm: 92.0,
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
