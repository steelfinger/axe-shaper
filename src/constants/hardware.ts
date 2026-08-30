import type {
  BridgePreset,
  InstrumentType,
  LengthMm,
  NeckJointMechanism,
  NeckPreset,
  PickupRoutSpec,
  PickupType,
} from '../types/guitar';

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
    // This was back-solved from a measured bridge position (451.65, target
    // 214.5mm compensated saddle line) until the iOS sibling app replaced
    // that whole approach: trying to preserve an independently-measured
    // bridge position *and* a fret-based joint position as two separate
    // facts was itself the bug (docs/m17-hardware-and-body-refinements.md,
    // "Step 4c" in the iOS repo) - swapping a different neck onto this body
    // had no defined answer under the old model. The fix there, mirrored
    // here: nutToBodyEdgeMm = fret22Distance(scaleLengthMm) -
    // fingerboardOverhangMm, where fingerboardOverhangMm is this body's own
    // "how far past the joint line should the fingerboard reach" constant -
    // for the SG, fret22Distance(628.65) - fret19Distance(628.65) = 452.24 -
    // 418.86 = 33.38 (a real SG joins at fret 19). nutToBodyEdgeMm =
    // 452.241058 - 33.38 = 418.86. This does move the bridge ~32.8mm up the
    // body from the old measured position - a deliberate trade, same as the
    // iOS side already made and already shipping there.
    //
    // Every contour/pickguard/pickup/route node in sg_style.axe.svg except
    // the two locked neck-pocket corners was moved +10mm in Y - same
    // mechanics as the Flying V's +52mm shift (22556dd) and the Firebird's
    // +35mm shift (c76a5d8), much smaller here because the SG's outline was
    // already close, just not quite enough room for a bolt-on neck heel
    // (75mm pocket). This value has to move by the same +10mm so the
    // computed bridge Y (scaleLengthMm - nutToBodyEdgeMm) tracks the
    // shifted pickups instead of crushing their spacing to the bridge:
    // fingerboardOverhangMm grows by 10 to stay derived from the fret model
    // rather than patched: 33.38 + 10 = 43.38 -> nutToBodyEdgeMm =
    // 452.241058 - 43.38 = 408.86. Updated here (the shared table new
    // documents resolve from) and in the blueprint's own embedded copy
    // together via scripts/refresh-blueprint-presets.ts, so the two can't
    // diverge the way they did for the V (dd5d8a4).
    nutToBodyEdgeMm: 408.86,
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
    // This was back-solved from a measured TOM post-line position on a real
    // routing template (458.65) until the iOS sibling app replaced that
    // whole approach - see the identical note on gibson_sg_22 above
    // (docs/m17-hardware-and-body-refinements.md, "Step 4c" in the iOS
    // repo). A real neck-through Firebird's fingerboard runs further into
    // the body than any bolted/glued joint this app models could reach, so
    // trying to preserve the measured bridge position as a fact independent
    // of the fret-based joint position was the actual bug (it went negative
    // mid-fix on the iOS side before landing on this). Mirrored here:
    // nutToBodyEdgeMm = fret22Distance(628.65) - fingerboardOverhangMm,
    // where fingerboardOverhangMm reuses the same fret-19 fact as
    // gibson_sg_22 (33.38, no independently-measured Firebird-specific
    // value took its place) = 452.241058 - 33.38 = 418.86. This moves the
    // bridge ~39.8mm up the body from the old measured position - the same
    // trade the iOS side already made and already ships.
    //
    // Every contour/pickguard/pickup/route node in gibson_firebird.axe.svg
    // except the two locked neck-pocket corners was moved +35mm in Y (same
    // move as gibson_flying_v_22 got, +52mm, for the same reason - the
    // outline left essentially no room for a bolt-on neck heel). This value
    // has to move by the same +35mm so the computed bridge Y
    // (scaleLengthMm - nutToBodyEdgeMm) tracks the pickups/body instead of
    // staying put and crushing the neck-pickup-to-bridge spacing - the exact
    // bug the V's first fix attempt (dabbd75) made. fingerboardOverhangMm
    // grows by the same 35mm to stay derived from the fret model rather than
    // patched: 33.38 + 35 = 68.38 -> nutToBodyEdgeMm = 452.241058 - 68.38 =
    // 383.86. Updated here (the shared table new documents resolve from) and
    // in the blueprint's own embedded copy together via
    // scripts/refresh-blueprint-presets.ts, so the two can't diverge the way
    // they did for the V (dd5d8a4).
    nutToBodyEdgeMm: 383.86,  // Nut to body entrance edge Y=0
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
    // This was back-solved from a measured/derived target (418.7, itself
    // shifted off gibson_sg_22's own old value) until the iOS sibling app
    // replaced that whole approach - see the identical note on gibson_sg_22
    // above (docs/m17-hardware-and-body-refinements.md, "Step 4c"/"Step 4i"
    // in the iOS repo). Superseded a first fret-based attempt that
    // (for lack of an independently sourced fact) inherited gibson_sg_22's
    // own fret-19 overhang (33.38) - close enough to the old value that the
    // divergence went unnoticed at first, but wrong: it put the bridge close
    // enough to Y=0 to overlap the bridge pickup rout, reported directly.
    // A real measurement replaces the guess: fret 22 sits 73mm past the
    // joint line -> nutToBodyEdgeMm = fret22Distance(628.65) - 73 =
    // 452.241058 - 73 = 379.24.
    nutToBodyEdgeMm: 379.24,
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
    // This was back-solved from a measured compensated-saddle target
    // (410.0, target 237.5mm) until the iOS sibling app replaced that whole
    // approach - see the identical note on gibson_sg_22 above
    // (docs/m17-hardware-and-body-refinements.md, "Step 4c" in the iOS
    // repo). jag_style.axe.svg's default bridge is tune_o_matic (this app's
    // own pairing choice, not a real Jaguar's floating vibrato) and there's
    // no separately-measured real target to defer to beyond the plain "nut
    // to fret 16" fact s_style/t_style already use, so this joins them
    // rather than keeping an independently-measured fact. Mirrored here:
    // nutToBodyEdgeMm = fret22Distance(610.0) - fingerboardOverhangMm,
    // where fingerboardOverhangMm = fret22Distance(610) -
    // fret16Distance(610) = 438.82 - 367.92 = 70.9 ->
    // nutToBodyEdgeMm = 438.824538 - 70.9 = 367.92. This moves the bridge
    // ~42.1mm up the body from the old measured position - the same trade
    // the iOS side already made and already ships.
    nutToBodyEdgeMm: 367.92,
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

  // --- Four-string bass necks ------------------------------------------------
  //
  // Scale-length-only entries, like CURATED_NECK_PRESETS is for guitar - one
  // per scale in the bass catalogue (docs/BASS_BODY_DESIGN_MILESTONES.md),
  // not one per body. They live here rather than in a separate table because
  // `scripts/generate-golden-corpus.ts` iterates this dictionary and the bass
  // scale/compensation matrix has to be part of the contract; the
  // compatibility filter there stops them pairing with guitar bridges.
  //
  // Shared, sourced measurements:
  //
  // - Scale lengths are exact inch conversions (30", 30.5", 33.25", 34").
  // - `nutToBodyEdgeMm` is the **fret-17 distance** for that scale. Fender
  //   puts a bass neck's body joint at the 17th fret and uses it as the
  //   reference point in its own setup instructions, the same way the guitar
  //   entries above use fret 16. As with CURATED_NECK_PRESETS, this stored
  //   value only reaches the drawing for a custom/unrecognised body -
  //   `neckPresetFieldsForTemplate` recomputes it from the body's own
  //   `FINGERBOARD_OVERHANG_MM` for anything bundled.
  // - `nutToJointMm` is the last fret's distance plus 5mm of fingerboard
  //   overhang. Sidebar display only; `scaleMath.ts` warns against using it
  //   for saddle Y.
  // - The pocket fields carry the real Fender bass pocket, 2-1/2" x 3-7/8"
  //   (63.5 x 98.425mm) - not the guitar's 2-3/16" x 3". See
  //   GENERIC_POCKET_SPEC below, which is what actually resolves.
  // - `nutStringSpacingMm` is the **total spread**, outer string to outer
  //   string: 3 intervals at the published ~10mm centre-to-centre spacing of
  //   a 38.2mm four-string nut = 30mm. Not the per-string pitch - see
  //   docs/AXE_SVG_FORMAT.md, which pins that definition for both platforms.
  bass_long_34: {
    id: 'bass_long_34',
    name: 'Bass Long Scale (34" Scale, 20 Frets)',
    scaleLengthMm: 863.6,     // 34 inches - P/J, StingRay, Thunderbird, Streamer
    nutToBodyEdgeMm: 540.1155, // fret 17
    nutToJointMm: 596.583,    // fret 20 + 5mm overhang
    frets: 20,
    jointWidthMm: 63.5,
    jointDepthMm: 98.425,
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 63.5,
    pocketDepthMm: 98.425,
    pocketCornerRadiusMm: 6.35,
    nutStringSpacingMm: 30.0,
    style: 'fender_style',
  },
  bass_medium_33_25: {
    id: 'bass_medium_33_25',
    name: 'Bass Medium Scale (33.25" Scale, 20 Frets)',
    scaleLengthMm: 844.55,    // 33.25 inches - R-Style
    nutToBodyEdgeMm: 528.2012, // fret 17
    nutToJointMm: 583.5334,   // fret 20 + 5mm overhang
    frets: 20,
    jointWidthMm: 63.5,
    jointDepthMm: 98.425,
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 63.5,
    pocketDepthMm: 98.425,
    pocketCornerRadiusMm: 6.35,
    nutStringSpacingMm: 30.0,
    // Not a construction claim - `style` is a cosmetic family label nothing
    // in this build reads, and the R-Style archetype is neck-through, which
    // `NeckJointMechanism` models as `glued` (see
    // DEFAULT_NECK_JOINT_MECHANISM).
    style: 'gibson_style',
  },
  bass_short_30_5: {
    id: 'bass_short_30_5',
    name: 'Bass Short Scale (30.5" Scale, 20 Frets)',
    scaleLengthMm: 774.7,     // 30.5 inches - SG-Style / EB-3
    nutToBodyEdgeMm: 484.5154, // fret 17
    nutToJointMm: 535.6848,   // fret 20 + 5mm overhang
    frets: 20,
    jointWidthMm: 63.5,
    jointDepthMm: 98.425,
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 63.5,
    pocketDepthMm: 98.425,
    pocketCornerRadiusMm: 6.35,
    nutStringSpacingMm: 30.0,
    style: 'gibson_style',
  },
  bass_short_30: {
    id: 'bass_short_30',
    name: 'Bass Short Scale (30" Scale, 19 Frets)',
    scaleLengthMm: 762,       // 30 inches - Mustang-Style
    nutToBodyEdgeMm: 476.5725, // fret 17
    nutToJointMm: 512.713,    // fret 19 + 5mm overhang (a Mustang Bass has 19)
    frets: 19,
    jointWidthMm: 63.5,
    jointDepthMm: 98.425,
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 63.5,
    pocketDepthMm: 98.425,
    pocketCornerRadiusMm: 6.35,
    nutStringSpacingMm: 30.0,
    style: 'fender_style',
  },
};

/**
 * The 4 generic, scale-length-only necks offered by the Neck picker, instead
 * of the 9 per-body entries in `NECK_PRESETS` above. Kept as a genuinely
 * separate table rather than folded into `NECK_PRESETS`: `npm run
 * corpus:check` pins that dictionary's key set exactly against
 * `tests/golden/geometry-corpus.json`, so adding 4 non-corpus ids there would
 * fail the check outright, and `scripts/generate-golden-corpus.ts` iterates
 * every `NECK_PRESETS` x `BRIDGE_PRESETS` pair - the same reason
 * axe-shaper-ios's `PresetCatalogue.curatedNecks` is a separate table from
 * its own corpus-pinned `necks` (docs/m17-hardware-and-body-refinements.md,
 * "Step 3", in that repo). `NECK_PRESETS[id] ?? CURATED_NECK_PRESETS[id]` in
 * `resolveNeckPreset` still resolves either kind, so a file naming any of
 * the original 9 ids (every bundled blueprint does) keeps opening and
 * drawing exactly as before - only the *picker* now offers these 4.
 *
 * One representative per real scale length actually in use across the 9
 * legacy presets (Fender/Gibson/Jaguar/Baritone) - not sourced from
 * anywhere else, this app's own decision, transcribed to match the values
 * axe-shaper-ios's `PresetCatalogue.curatedNecks` already settled on so a
 * fresh project created on either platform starts from the same numbers.
 * `nutToBodyEdgeMm`/`nutToJointMm`/pocket fields here only matter for a
 * custom/unrecognized body (`utils/presets.ts`'s `neckPresetFieldsForTemplate`
 * recomputes `nutToBodyEdgeMm` fresh for any of the 8 bundled bodies, so
 * these stored values are dead weight for rendering there, kept only
 * because `NeckPreset` requires them structurally).
 */
export const CURATED_NECK_PRESETS: Record<string, NeckPreset> = {
  baritone_scale: {
    id: 'baritone_scale',
    name: 'Baritone Scale (27" Scale, 22 Frets)',
    scaleLengthMm: 685.8,
    nutToBodyEdgeMm: 415.8,
    nutToJointMm: 485.8,
    frets: 22,
    jointWidthMm: 57.0,
    jointDepthMm: 76.2,
    jointCornerRadiusMm: 12.7,
    pocketWidthMm: 57.0,
    pocketDepthMm: 76.2,
    pocketCornerRadiusMm: 12.7,
    style: 'baritone',
  },
  fender_scale: {
    id: 'fender_scale',
    name: 'Fender Scale (25.5" Scale, 22 Frets)',
    scaleLengthMm: 647.7,
    nutToBodyEdgeMm: 390.7,
    nutToJointMm: 458.7,
    frets: 22,
    jointWidthMm: 55.56,
    jointDepthMm: 76.2,
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 55.56,
    pocketDepthMm: 76.2,
    pocketCornerRadiusMm: 6.35,
    style: 'fender_style',
  },
  // nutToBodyEdgeMm/nutToJointMm/pocketDepthMm here are gibson_lp_22's own -
  // the one member of this scale-length group whose data was verified
  // structurally sound on its own terms, not just relative to the SG's old
  // copy-paste bug. The deepest pocket of the group (101.6mm) is the
  // conservative choice for an unrecognized body: too deep never stops a
  // neck from seating, too shallow does.
  gibson_scale: {
    id: 'gibson_scale',
    name: 'Gibson Scale (24.75" Scale, 22 Frets)',
    scaleLengthMm: 628.65,
    nutToBodyEdgeMm: 379.2,
    nutToJointMm: 414.27,
    frets: 22,
    jointWidthMm: 38.1,
    jointDepthMm: 101.6,
    jointCornerRadiusMm: 6.35,
    pocketWidthMm: 38.1,
    pocketDepthMm: 101.6,
    pocketCornerRadiusMm: 6.35,
    style: 'gibson_style',
  },
  jaguar_scale: {
    id: 'jaguar_scale',
    name: 'Jaguar Scale (24" Scale, 22 Frets)',
    scaleLengthMm: 610,
    nutToBodyEdgeMm: 375.5,
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
};

/**
 * How far past Y=0 (the neck-pocket joint line) each bundled body's
 * *reference fret* sits - one entry per `activeTemplateId` in
 * `BLUEPRINT_ORDER` (`constants/blueprintManifest.ts`). Each value is
 * `fretRefDistance(nativeNeck.scaleLengthMm) - nativeNeck.nutToBodyEdgeMm`
 * for that body's own native `NECK_PRESETS` entry above - the same
 * body-owned constant axe-shaper-ios's `BlueprintCosmetics
 * .fingerboardOverhangMm` stores (docs/m17-hardware-and-body-refinements.md
 * there). `utils/presets.ts`'s `neckPresetFieldsForTemplate` uses this to
 * recompute `nutToBodyEdgeMm` for whichever neck a project attaches, so the
 * bridge lands where each body's own native neck was measured against
 * regardless of which neck is picked.
 *
 * **The reference fret is per instrument** - `FINGERBOARD_REFERENCE_FRET` in
 * `utils/instrument.ts`: 22 for guitar, 20 for bass. All eight entries below
 * are guitar, so all eight are fret 22; the bass bodies arriving at milestone
 * W6 use fret 20 and *must* be computed with it. Getting that wrong slides
 * the body along the neck and takes the bridge and pickups with it.
 *
 * The number is a rate rather than a claim about where a fingerboard
 * actually ends - it is derived and consumed with the same fret, so the
 * absolute position cancels and only `1 - 2^(-N/12)` survives. `s_style`'s
 * value below is computed from the *21*-fret `fender_strat_21` using fret 22
 * and is exact for every same-scale swap regardless. See
 * `FINGERBOARD_REFERENCE_FRET`'s own comment for the algebra, and for why
 * reading the fret count off each neck instead would be a 10.8mm bug.
 *
 * Deliberately literal, not derived from `constants/templates.ts` at
 * runtime: `templates.ts` decodes blueprints via `utils/svgExporter.ts`,
 * which already imports from `utils/presets.ts` - importing `templates.ts`
 * back from `presets.ts` would be a real import cycle
 * (presets -> templates -> svgExporter -> presets), not just a style
 * preference. Recompute by hand (`fretNDistance(s) = s * (1 - 2 **
 * (-N/12))` with N from `FINGERBOARD_REFERENCE_FRET` for that body's
 * instrument, via `utils/scaleMath.ts`'s `getFretDistanceFromNutMm`) if a
 * template's native `NECK_PRESETS` entry's `scaleLengthMm`/
 * `nutToBodyEdgeMm` above ever changes.
 */
export const FINGERBOARD_OVERHANG_MM: Record<string, LengthMm> = {
  // Guitar bodies - reference fret 22.
  single_cut: 73.0411, // gibson_lp_22
  sg_style: 43.3811, // gibson_sg_22
  s_style: 75.2453, // fender_strat_21
  t_style: 75.2453, // fender_tele_22
  gibson_firebird: 68.3811, // gibson_firebird_19
  gretsch_thunderbird: 73.0011, // gretsch_thunderbird_22
  gibson_flying_v: 74.0011, // gibson_flying_v_22
  jag_style: 70.9045, // jaguar_22

  // Bass masters: authoritative theoretical scale lines, measured from each
  // body's fixed Y=0 joint line. Bridge compensation is applied separately.
  p_bass_style: 92.983, // 34" / 365mm scale line
  j_bass_style: 92.983, // 34" / 365mm scale line
  mm_bass_style: 77.983, // 34" / 350mm scale line
  r_bass_style: 101.9834, // 33.25" / 368mm scale line
  thunderbird_bass_style: 139.983, // 34" / 412mm scale line
  mustang_bass_style: 105.985, // 30" / 346mm scale line
  sg_bass_style: 95.9848, // 30.5" / 340mm scale line
  streamer_bass_style: 42.983, // 34" / 315mm scale line
};

/**
 * The neck-pocket rout - width, depth, and corner radius - for each
 * `NeckJointMechanism`, independent of which neck or body it's attached to.
 * Mirrors axe-shaper-ios's `PresetCatalogue.genericPocketSpec(for:)`
 * (docs/m17-hardware-and-body-refinements.md, "Step 4", there): pocket shape
 * used to be neck-owned (each of the 9 legacy `NECK_PRESETS` entries carries
 * its own `jointWidthMm`/`jointDepthMm`/`jointCornerRadiusMm`), which broke
 * the moment necks stopped being 1:1 with bodies (`CURATED_NECK_PRESETS`
 * above) - a Gibson-style body with a Fender-scale neck attached has no
 * single right answer for "whose pocket depth". One fixed spec per
 * mechanism instead, applied by `utils/presets.ts`'s
 * `neckPresetFieldsForTemplate` regardless of which neck/body is involved.
 *
 * Keyed by instrument first, then mechanism. The instrument axis is not
 * cosmetic: the table used to be mechanism-only and explicitly "independent
 * of which neck or body it's attached to", with `bolt_on` carrying the real
 * Fender *guitar* pocket at 55.56mm. A four-string bass heel is 63.5mm, so
 * every bass project would have silently routed a pocket 8mm too narrow.
 * Mirrors axe-shaper-ios's `PresetCatalogue.genericPocketSpec(for:)`, which
 * gains the same axis.
 *
 * `guitar.bolt_on`'s numbers aren't invented - they're exactly what
 * `fender_scale`/`jaguar_scale`/`baritone_scale` above already agreed on
 * (55.56mm x 76.2mm, 6.35mm corners, the real standard Fender pocket).
 * `guitar.glued`'s width/radius (38.1mm/6.35mm) are the same universal agreement
 * across every Gibson-style entry in `NECK_PRESETS`; its depth (101.6mm)
 * takes the deepest of the 5 Gibson-style bodies (67-101.6mm) as the
 * conservative generic default - too deep never stops a neck from seating,
 * too shallow does - the same reasoning `CURATED_NECK_PRESETS.gibson_scale`
 * already uses for the same number.
 */
export const GENERIC_POCKET_SPEC: Record<
  InstrumentType,
  Record<NeckJointMechanism, Pick<NeckPreset, 'jointWidthMm' | 'jointDepthMm' | 'jointCornerRadiusMm'>>
> = {
  guitar: {
    bolt_on: { jointWidthMm: 55.56, jointDepthMm: 76.2, jointCornerRadiusMm: 6.35 },
    glued: { jointWidthMm: 38.1, jointDepthMm: 101.6, jointCornerRadiusMm: 6.35 },
  },
  bass: {
    // The real Fender four-string bass pocket: 2-1/2" wide x 3-7/8" long,
    // the dimension every Fender-spec replacement neck and routing template
    // is built to. Both numbers are larger than the guitar's, and the width
    // is the one that matters: without this axis a bass project routed a
    // 55.56mm guitar pocket for a 63.5mm bass heel.
    bolt_on: { jointWidthMm: 63.5, jointDepthMm: 98.425, jointCornerRadiusMm: 6.35 },
    // Deliberately the same as bolt_on, and deliberately *not* the guitar's
    // glued mortise. No measured set-neck bass tenon was available when this
    // landed, and the two bass blueprints this build maps to `glued` -
    // R-Style and Thunderbird - are really neck-through, where the mortise
    // is notional anyway. Falling back to the guitar's 38.1mm would rout a
    // mortise 25mm too narrow for a bass heel, which is the failure this
    // whole axis exists to prevent; repeating the measured bass pocket is
    // the conservative answer until a bass blueprint's own evidence packet
    // supplies a real one (milestone W6). SG-Style, a genuine set-neck bass,
    // is the entry that will need it first.
    glued: { jointWidthMm: 63.5, jointDepthMm: 98.425, jointCornerRadiusMm: 6.35 },
  },
};

/**
 * Each bundled body's own real-world construction, seeded as its default
 * `NeckJointMechanism` when a new project/document is created on it (the
 * user can always override via the Neck Joint picker). Fender/Jaguar/
 * Baritone-style bodies are bolt-on; the 5 Gibson-style bodies are glued,
 * including Firebird/Thunderbird, whose real neck-through construction
 * isn't modeled as a third option - `glued` is the closer of the two
 * available buckets, not a claim they're built like an SG. Matches
 * axe-shaper-ios's own per-template `defaultMechanism` exactly - confirmed
 * against the `neckJointMechanism` iOS's fixture sync already wrote into
 * `tests/fixtures/ios-written/*.axe.svg` (single_cut/sg_style/
 * gibson_firebird/gretsch_thunderbird/gibson_flying_v: glued; s_style/
 * t_style/jag_style: bolt_on).
 */
export const DEFAULT_NECK_JOINT_MECHANISM: Record<string, NeckJointMechanism> = {
  single_cut: 'glued',
  sg_style: 'glued',
  s_style: 'bolt_on',
  t_style: 'bolt_on',
  gibson_firebird: 'glued',
  gretsch_thunderbird: 'glued',
  gibson_flying_v: 'glued',
  jag_style: 'bolt_on',

  // The eight bass blueprints, decided here rather than left to the
  // `?? FALLBACK_NECK_JOINT_MECHANISM` default - an omitted entry silently
  // yields bolt-on, which would be wrong for four of these. The ids are the
  // shared contract column from docs/BASS_BODY_DESIGN_MILESTONES.md and must
  // stay in step with iOS; the bodies themselves arrive at milestone W6.
  //
  // R-Style and Thunderbird are neck-through in reality. `glued` is the
  // closer of the two buckets this enum offers, not a claim they are built
  // like an SG - exactly the modelling choice already made for the Firebird
  // and the Gretsch Thunderbird above. A third neck-through mechanism is
  // explicitly deferred.
  p_bass_style: 'bolt_on',
  j_bass_style: 'bolt_on',
  mm_bass_style: 'bolt_on',
  r_bass_style: 'glued',
  thunderbird_bass_style: 'glued',
  mustang_bass_style: 'bolt_on',
  sg_bass_style: 'glued',
  // Warwick built the Streamer both ways - neck-through on the Stage
  // models, bolt-on on the Standard/LX. The bolt-on is the far more common
  // one and the one this blueprint is drawn from; W6's evidence packet
  // records which instrument the body was measured against.
  streamer_bass_style: 'bolt_on',
};

/**
 * Which instrument each catalogue id is for.
 *
 * Deliberately side-tables keyed by id, not a field on `NeckPreset` /
 * `BridgePreset` / `PickupRoutSpec`. Three reasons, in order of how much they
 * would hurt:
 *
 * 1. Those structs are *embedded into every saved file*, and the embedded
 *    copy is the physical source of truth for geometry. An `instrumentType`
 *    living inside the embedded neck would be a second, stale answer to a
 *    question the project already answers at the top level - exactly the "two
 *    facts competing" failure this codebase has documented twice already.
 * 2. `scripts/generate-golden-corpus.ts` embeds `NECK_PRESETS`,
 *    `BRIDGE_PRESETS` and `PICKUP_SPECIFICATIONS` verbatim, so a new field on
 *    any of them is a corpus change - and a contract change every port has to
 *    reproduce - for what is purely a picker-filtering concern here.
 * 3. Compatibility is catalogue knowledge that can be corrected in a later
 *    build; the physical measurements in the presets themselves must not be.
 *
 * An id absent from these tables has no known instrument (see
 * `utils/instrument.ts`), which is the right answer for a preset id from a
 * file this build has never heard of.
 */
export const NECK_PRESET_INSTRUMENT: Record<string, InstrumentType> = {
  // NECK_PRESETS - the 9 per-body legacy entries
  fender_strat_21: 'guitar',
  fender_tele_22: 'guitar',
  gibson_lp_22: 'guitar',
  gibson_sg_22: 'guitar',
  gibson_firebird_19: 'guitar',
  gretsch_thunderbird_22: 'guitar',
  gibson_flying_v_22: 'guitar',
  jaguar_22: 'guitar',
  baritone_27: 'guitar',
  // CURATED_NECK_PRESETS - the 4 scale-length-only entries the picker offers
  baritone_scale: 'guitar',
  fender_scale: 'guitar',
  gibson_scale: 'guitar',
  jaguar_scale: 'guitar',
  // The 4 bass necks. Unlike the guitar side there is no legacy/curated
  // split: these were authored as scale-length-only necks from the start, so
  // the same four entries are both what the picker offers and what the
  // corpus pairs.
  bass_long_34: 'bass',
  bass_medium_33_25: 'bass',
  bass_short_30_5: 'bass',
  bass_short_30: 'bass',
};

export const BRIDGE_PRESET_INSTRUMENT: Record<string, InstrumentType> = {
  hardtail_6: 'guitar',
  tremolo_strat: 'guitar',
  tune_o_matic: 'guitar',
  tele_bridge_plate: 'guitar',
  bass_vintage_plate: 'bass',
  bass_precision_plate: 'bass',
  bass_r_style_plate: 'bass',
};

export const PICKUP_TYPE_INSTRUMENT: Record<PickupType, InstrumentType> = {
  humbucker: 'guitar',
  mini_humbucker: 'guitar',
  single_coil: 'guitar',
  lipstick: 'guitar',
  p90_soapbar: 'guitar',
  p90_dogear: 'guitar',
  tele_neck: 'guitar',
  tele_bridge: 'guitar',
  bass_split_coil: 'bass',
  bass_j_single_coil: 'bass',
  bass_humbucker: 'bass',
  bass_soapbar: 'bass',
  bass_r_toaster: 'bass',
  bass_r_horseshoe: 'bass',
  bass_mudbucker: 'bass',
  bass_mini_humbucker: 'bass',
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
    // No mountingPoints: a hardtail's real screw positions are a
    // bridge-model-specific detail this app doesn't model, and the old three
    // (-21/0/21 at y:15) were an even guess, not a measurement. Same call as
    // tremolo_strat and tele_bridge_plate below. The drawing is the plate
    // outline plus saddle housing, nothing else.
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
    // Post holes are measured from the post line (getMountingPointOriginYMm
    // branches on scaleReference above), not the compensated saddle line -
    // every bridge's mountingPoints used to be anchored to the saddle line
    // regardless of this field, which for a TOM put the post holes 37.5mm
    // downstream, inside the saddle plate instead of the bridge plate they
    // actually belong to.
    //
    // The two posts are also slanted, per the same real-bridge geometry the
    // compensationMm comment above already documents: treble/high-E sits
    // ~3mm closer to the neck than bass/low-E. x=37 is the treble/high-E
    // side (StringGeometry's index-6-is-high-E / positive-X convention), so
    // it gets the smaller y; x=-37 (bass) gets the larger one, split
    // symmetrically around the nominal post line rather than putting the
    // whole 3mm on one side.
    //
    // One shared tailpiece spacing for every Tune-O-Matic-mounted body
    // (formerly split out into tune_o_matic_firebird's own 39.5mm figure) -
    // as long as the bridge-to-tailpiece run is long enough to string
    // through, the exact distance isn't worth a second preset entry. The
    // tailpiece itself isn't slanted - it's just a string anchor, not part
    // of intonation.
    mountingPoints: [
      { x: -37.0, y: 1.5 },
      { x: 37.0, y: -1.5 },
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

  // --- Four-string bass ------------------------------------------------------
  bass_vintage_plate: {
    id: 'bass_vintage_plate',
    name: 'Bass Vintage Plate (4-String)',
    scaleReference: 'saddle_line',
    // A 34" bass intonates out to roughly 34-1/8" on the G and 34-3/8" on
    // the E - i.e. the saddles sit ~3.2mm and ~9.5mm behind the theoretical
    // line. Much larger than a guitar's 1.5-2.0/4.5-5.0mm because the
    // strings are far heavier and stretch further when fretted. Unlike the
    // Tune-O-Matic's 37.5mm, all of this is real per-string compensation -
    // there is no structural post-to-saddle offset in a plate bridge.
    compensationMm: {
      treble: 3.2,
      bass: 9.5,
    },
    // Plate footprint from the Fender-spec four-string retrofit envelope,
    // 3.19" x 2.09" - a direct replacement for vintage and standard Fender
    // top-load bass bridges, so its outline is the Fender footprint.
    widthMm: 81.03,
    lengthMm: 53.09,
    // Half the plate length: no independently measured front-edge-to-saddle
    // offset was available, so the plate is centred on the saddle line -
    // the same convention tune_o_matic's own `7` on a 14mm plate uses.
    saddleOffsetYMm: 26.5,
    // TOTAL SPREAD across all four strings, not per-string pitch. The
    // Fender-standard .750" per string is published as "2-1/4" (57mm) for
    // the outer strings" - the same number read both ways, which is exactly
    // the ambiguity docs/AXE_SVG_FORMAT.md exists to close.
    stringSpacingMm: 57.15,
    heightMm: 12.0,
    // No mountingPoints: the five-screw pattern is bridge-model-specific
    // detail this app doesn't model accurately, and nothing in the scale or
    // saddle math reads it. Omitted rather than guessed - same call as
    // tremolo_strat above.
  },
  // The second bass bridge, the "measured with the body at W6" entry the
  // milestone doc anticipated. Same family as bass_vintage_plate (a one-piece
  // bent-steel top-load Fender bass plate) but every dimension is measured off
  // a real Precision bridge rather than taken from the generic retrofit
  // envelope: the plate is 84 x 46mm and the saddle line sits 12mm behind its
  // front edge, not centred. Used by the P-Style and Mustang-Style blueprints.
  bass_precision_plate: {
    id: 'bass_precision_plate',
    name: 'Bass Precision Plate (4-String)',
    scaleReference: 'saddle_line',
    // Same 34"-derived per-string compensation as bass_vintage_plate - a
    // plate bridge has no structural post-to-saddle offset, and the string
    // stretch that sets these numbers is a property of the strings, not the
    // bridge model.
    compensationMm: {
      treble: 3.2,
      bass: 9.5,
    },
    widthMm: 84,
    lengthMm: 46,
    // Measured: the saddle line is 12mm behind (toward the tail of) the
    // plate's front edge, so on a build whose saddle line lands at Y the
    // plate spans Y-12 .. Y+34.
    saddleOffsetYMm: 12,
    stringSpacingMm: 57.15,
    heightMm: 12.0,
    // One-piece plate: draw a single rectangle, not the base + saddle-carrier
    // pair. See BridgePreset.singlePlate.
    singlePlate: true,
  },
  // R-style master blueprint: Front Route Shape 2 was a bridge-plate marker,
  // not a rout. Its exact tapered 100mm-to-80mm, 110mm-long outline is
  // expressed relative to the 368mm theoretical scale line.
  bass_r_style_plate: {
    id: 'bass_r_style_plate',
    name: 'R-Style Tapered Plate (4-String)',
    scaleReference: 'saddle_line',
    compensationMm: { treble: 3.2, bass: 9.5 },
    widthMm: 100,
    lengthMm: 110,
    saddleOffsetYMm: 33,
    stringSpacingMm: 57.15,
    heightMm: 12,
    outlineMm: [
      { x: -50, y: -33 },
      { x: 50, y: -33 },
      { x: 40, y: 77 },
      { x: -40, y: 77 },
    ],
  },
};

/**
 * Real routed-cavity shapes per pickup type - traced outlines (mounting ears
 * and all, where the real pickup has them), not idealized rounded rects.
 * `anchors` is centered at (0,0) - the placement/rotation pivot, which for
 * most types is the shape's own geometric center, but not for every type;
 * see single_coil and tele_neck below - unrotated, sized to widthMm x
 * heightMm. These seed a PickupPlacement's own `anchors`/widthMm/heightMm
 * (and `angleDegrees`, via `defaultAngleDegrees`) when one is created; the
 * placement carries its own copy from then on (see resolvePickupSpec in
 * presets.ts), so editing a shape here does not change the rout on existing
 * designs.
 */
/**
 * A rounded-rectangle rout outline, centred on (0,0) and sized to
 * `widthMm` x `heightMm`, as this app's own anchors.
 *
 * The guitar routs above/below are traced from real routing templates, ears
 * and all, and are literal data for that reason. The four-string bass routs
 * are simple rounded rectangles - which is what a J, a Music Man and a
 * soapbar cavity actually are - so generating them beats transcribing 32
 * hand-written control points, and it keeps the corner radius honest instead
 * of eyeballed per shape.
 *
 * Eight anchors: two per corner, with the straight edges between them left
 * handle-free (an absent handle *is* a straight segment) and a quarter-circle
 * Bezier at each corner. Deterministic, so the golden corpus is stable.
 */
const CIRCLE_KAPPA = 0.5522847498307936;

function roundedRectAnchors(
  idPrefix: string,
  widthMm: LengthMm,
  heightMm: LengthMm,
  radiusMm: LengthMm
): PickupRoutSpec['anchors'] {
  const x = widthMm / 2;
  const y = heightMm / 2;
  const r = Math.min(radiusMm, x, y);
  const k = r * CIRCLE_KAPPA;
  const round = (v: number) => Number(v.toFixed(3));
  const at = (px: number, py: number) => ({ x: round(px), y: round(py) });

  // Clockwise from the top edge; Y grows downward.
  const corners: Array<{ position: { x: number; y: number }; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } }> = [
    { position: at(-x + r, -y), handleIn: at(-k, 0) },
    { position: at(x - r, -y), handleOut: at(k, 0) },
    { position: at(x, -y + r), handleIn: at(0, -k) },
    { position: at(x, y - r), handleOut: at(0, k) },
    { position: at(x - r, y), handleIn: at(k, 0) },
    { position: at(-x + r, y), handleOut: at(-k, 0) },
    { position: at(-x, y - r), handleIn: at(0, k) },
    { position: at(-x, -y + r), handleOut: at(0, -k) },
  ];

  return corners.map((corner, index) => ({
    id: `${idPrefix}_a${index}`,
    ...corner,
    handleMode: 'corner' as const,
  }));
}

export const PICKUP_SPECIFICATIONS: Record<
  PickupType,
  PickupRoutSpec & { name: string; defaultAngleDegrees?: number }
> = {
  humbucker: {
    name: 'Standard Humbucker',
    widthMm: 87.072,
    heightMm: 40.171,
    anchors: [
      { id: 'humbucker_a0', position: { x: -32.147, y: -19.988 }, handleOut: { x: -1.592, y: 0.086 }, handleMode: 'corner' },
      { id: 'humbucker_a1', position: { x: -36.137, y: -17.556 }, handleIn: { x: 0.433, y: -1.748 }, handleMode: 'corner' },
      { id: 'humbucker_a2', position: { x: -36.227, y: -7.487 }, handleOut: { x: -1.695, y: 0.087 }, handleMode: 'corner' },
      { id: 'humbucker_a3', position: { x: -41.324, y: -7.251 }, handleIn: { x: 1.672, y: -0.307 }, handleOut: { x: -1.711, y: 0.568 }, handleMode: 'corner' },
      { id: 'humbucker_a4', position: { x: -43.469, y: -3.016 }, handleIn: { x: -0.304, y: -1.666 }, handleOut: { x: 0.081, y: 2.451 }, handleMode: 'corner' },
      { id: 'humbucker_a5', position: { x: -43.343, y: 4.343 }, handleIn: { x: -0.254, y: -2.439 }, handleOut: { x: 0.276, y: 1.584 }, handleMode: 'corner' },
      { id: 'humbucker_a6', position: { x: -39.994, y: 7.331 }, handleIn: { x: -1.75, y: 0.21 }, handleOut: { x: 1.255, y: -0.044 }, handleMode: 'corner' },
      { id: 'humbucker_a7', position: { x: -36.227, y: 7.308 }, handleIn: { x: -1.255, y: 0.002 }, handleMode: 'corner' },
      { id: 'humbucker_a8', position: { x: -36.155, y: 16.313 }, handleOut: { x: 0.52, y: 2.316 }, handleMode: 'corner' },
      { id: 'humbucker_a9', position: { x: -30.987, y: 20.0 }, handleIn: { x: -2.165, y: -0.226 }, handleMode: 'corner' },
      { id: 'humbucker_a10', position: { x: 32.279, y: 20.085 }, handleOut: { x: 1.596, y: -0.051 }, handleMode: 'corner' },
      { id: 'humbucker_a11', position: { x: 36.072, y: 17.48 }, handleIn: { x: -0.26, y: 1.775 }, handleMode: 'corner' },
      { id: 'humbucker_a12', position: { x: 36.126, y: 7.308 }, handleOut: { x: 2.023, y: 0.004 }, handleMode: 'corner' },
      { id: 'humbucker_a13', position: { x: 42.222, y: 6.954 }, handleIn: { x: -1.928, y: 0.797 }, handleOut: { x: 1.158, y: -0.619 }, handleMode: 'corner' },
      { id: 'humbucker_a14', position: { x: 43.45, y: 3.69 }, handleIn: { x: 0.265, y: 1.203 }, handleOut: { x: -0.162, y: -2.98 }, handleMode: 'corner' },
      { id: 'humbucker_a15', position: { x: 43.357, y: -5.258 }, handleIn: { x: 0.129, y: 2.98 }, handleOut: { x: -0.185, y: -1.432 }, handleMode: 'corner' },
      { id: 'humbucker_a16', position: { x: 40.273, y: -7.546 }, handleIn: { x: 1.31, y: 0.095 }, handleOut: { x: -1.388, y: -0.003 }, handleMode: 'corner' },
      { id: 'humbucker_a17', position: { x: 36.103, y: -7.511 }, handleIn: { x: 1.392, y: 0.032 }, handleMode: 'corner' },
      { id: 'humbucker_a18', position: { x: 35.806, y: -16.806 }, handleOut: { x: -0.509, y: -2.161 }, handleMode: 'corner' },
      { id: 'humbucker_a19', position: { x: 30.877, y: -20.085 }, handleIn: { x: 2.039, y: 0.073 }, handleMode: 'corner' },
    ],
  },
  mini_humbucker: {
    name: 'Mini Humbucker',
    widthMm: 83.448,
    heightMm: 29.878,
    anchors: [
      { id: 'mini_humbucker_a0', position: { x: 29.534, y: -14.939 }, handleOut: { x: -0.123, y: 0.001 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a1', position: { x: 29.164, y: -14.918 }, handleIn: { x: 0.123, y: -0.013 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a2', position: { x: -30.109, y: -14.892 }, handleOut: { x: -2.371, y: 0.217 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a3', position: { x: -33.959, y: -9.925 }, handleIn: { x: -0.32, y: -2.332 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a4', position: { x: -33.959, y: -6.026 }, handleOut: { x: -1.916, y: 0.036 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a5', position: { x: -39.713, y: -5.914 }, handleIn: { x: 1.894, y: -0.212 }, handleOut: { x: -1.504, y: 0.421 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a6', position: { x: -41.685, y: -2.35 }, handleIn: { x: -0.214, y: -1.442 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a7', position: { x: -41.547, y: 4.076 }, handleOut: { x: 0.444, y: 1.472 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a8', position: { x: -37.997, y: 6.006 }, handleIn: { x: -1.431, y: 0.23 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a9', position: { x: -33.957, y: 6.006 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a10', position: { x: -33.774, y: 11.816 }, handleOut: { x: 0.633, y: 2.113 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a11', position: { x: -28.692, y: 14.896 }, handleIn: { x: -2.133, y: 0.296 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a12', position: { x: 29.975, y: 14.87 }, handleOut: { x: 2.403, y: -0.163 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a13', position: { x: 33.953, y: 9.928 }, handleIn: { x: 0.283, y: 2.36 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a14', position: { x: 33.953, y: 6.003 }, handleOut: { x: 1.93, y: -0.055 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a15', position: { x: 39.752, y: 5.867 }, handleIn: { x: -1.913, y: 0.283 }, handleOut: { x: 1.461, y: -0.459 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a16', position: { x: 41.679, y: 2.317 }, handleIn: { x: 0.237, y: 1.434 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a17', position: { x: 41.559, y: -4.035 }, handleOut: { x: -0.412, y: -1.468 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a18', position: { x: 38.075, y: -6.028 }, handleIn: { x: 1.437, y: -0.239 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a19', position: { x: 33.945, y: -6.028 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a20', position: { x: 33.727, y: -11.917 }, handleOut: { x: -0.565, y: -1.765 }, handleMode: 'corner' },
      { id: 'mini_humbucker_a21', position: { x: 29.534, y: -14.939 }, handleIn: { x: 1.846, y: -0.017 }, handleMode: 'corner' },
    ],
  },
  single_coil: {
    name: 'Strat-Style Single Coil',
    widthMm: 86.041,
    heightMm: 26.11,
    // Not symmetric top-to-bottom - the coil sits 10mm from the top edge,
    // not 13.055mm (half the height), so (0,0) - the placement/rotation
    // pivot - is offset from the shape's own geometric center accordingly.
    anchors: [
      { id: 'single_coil_a0', position: { x: 33.615, y: -9.992 }, handleOut: { x: -22.541, y: 0.027 }, handleMode: 'corner' },
      { id: 'single_coil_a1', position: { x: -34.01, y: -9.936 }, handleIn: { x: 22.54, y: -0.071 }, handleOut: { x: -5.343, y: 0.203 }, handleMode: 'corner' },
      { id: 'single_coil_a2', position: { x: -42.986, y: 0.685 }, handleIn: { x: -0.457, y: -5.2 }, handleOut: { x: 0.079, y: 4.64 }, handleMode: 'corner' },
      { id: 'single_coil_a3', position: { x: -34.505, y: 9.825 }, handleIn: { x: -4.579, y: -0.502 }, handleOut: { x: 9.192, y: 2.083 }, handleMode: 'corner' },
      { id: 'single_coil_a4', position: { x: -6.928, y: 16.07 }, handleIn: { x: -9.194, y: -2.075 }, handleOut: { x: 4.5, y: -0.029 }, handleMode: 'corner' },
      { id: 'single_coil_a5', position: { x: 6.582, y: 15.968 }, handleIn: { x: -4.481, y: 0.265 }, handleOut: { x: 9.803, y: -2.241 }, handleMode: 'corner' },
      { id: 'single_coil_a6', position: { x: 35.996, y: 9.256 }, handleIn: { x: -9.778, y: 2.341 }, handleOut: { x: 4.94, y: -1.328 }, handleMode: 'corner' },
      { id: 'single_coil_a7', position: { x: 42.7, y: -2.494 }, handleIn: { x: 1.363, y: 4.928 }, handleOut: { x: -0.895, y: -4.188 }, handleMode: 'corner' },
      { id: 'single_coil_a8', position: { x: 33.615, y: -9.992 }, handleIn: { x: 4.427, y: -0.199 }, handleMode: 'corner' },
    ],
  },
  lipstick: {
    name: 'Lipstick Tube',
    widthMm: 82.025,
    heightMm: 17.974,
    anchors: [
      { id: 'lipstick_a0', position: { x: -31.193, y: -8.987 }, handleIn: { x: -6.83, y: 0.0 }, handleMode: 'corner' },
      { id: 'lipstick_a1', position: { x: 31.193, y: -8.987 }, handleOut: { x: 6.83, y: 0.0 }, handleMode: 'corner' },
      { id: 'lipstick_a2', position: { x: 41.012, y: 0.0 }, handleIn: { x: 0.0, y: -4.979 }, handleOut: { x: 0.0, y: 4.979 }, handleMode: 'corner' },
      { id: 'lipstick_a3', position: { x: 31.193, y: 8.987 }, handleIn: { x: 6.83, y: 0.0 }, handleMode: 'corner' },
      { id: 'lipstick_a4', position: { x: -31.193, y: 8.987 }, handleOut: { x: -6.83, y: 0.0 }, handleMode: 'corner' },
      { id: 'lipstick_a5', position: { x: -41.012, y: 0.0 }, handleIn: { x: 0.0, y: 4.979 }, handleOut: { x: 0.0, y: -4.979 }, handleMode: 'corner' },
    ],
  },
  p90_soapbar: {
    name: 'P-90 Soapbar',
    widthMm: 74.389,
    heightMm: 28.423,
    anchors: [
      { id: 'p90_soapbar_a0', position: { x: -29.311, y: -14.212 }, handleIn: { x: -4.368, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_soapbar_a1', position: { x: 29.311, y: -14.212 }, handleOut: { x: 4.368, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_soapbar_a2', position: { x: 37.194, y: -6.328 }, handleIn: { x: 0.0, y: -4.368 }, handleMode: 'corner' },
      { id: 'p90_soapbar_a3', position: { x: 37.194, y: 6.328 }, handleOut: { x: 0.0, y: 4.368 }, handleMode: 'corner' },
      { id: 'p90_soapbar_a4', position: { x: 29.311, y: 14.212 }, handleIn: { x: 4.368, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_soapbar_a5', position: { x: -29.311, y: 14.212 }, handleOut: { x: -4.368, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_soapbar_a6', position: { x: -37.194, y: 6.328 }, handleIn: { x: 0.0, y: 4.368 }, handleMode: 'corner' },
      { id: 'p90_soapbar_a7', position: { x: -37.194, y: -6.328 }, handleOut: { x: 0.0, y: -4.368 }, handleMode: 'corner' },
    ],
  },
  p90_dogear: {
    name: 'P-90 Dog Ear',
    widthMm: 105.843,
    heightMm: 33.212,
    anchors: [
      { id: 'p90_dogear_a0', position: { x: -35.555, y: -16.606 }, handleOut: { x: -4.188, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_dogear_a1', position: { x: -43.115, y: -9.047 }, handleIn: { x: 0.0, y: -4.188 }, handleMode: 'corner' },
      { id: 'p90_dogear_a2', position: { x: -43.115, y: -6.956 }, handleMode: 'corner' },
      { id: 'p90_dogear_a3', position: { x: -48.385, y: -6.956 }, handleOut: { x: -2.513, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_dogear_a4', position: { x: -52.921, y: -2.42 }, handleIn: { x: 0.0, y: -2.513 }, handleMode: 'corner' },
      { id: 'p90_dogear_a5', position: { x: -52.921, y: 2.205 }, handleOut: { x: 0.0, y: 2.513 }, handleMode: 'corner' },
      { id: 'p90_dogear_a6', position: { x: -48.385, y: 6.741 }, handleIn: { x: -2.513, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_dogear_a7', position: { x: -43.115, y: 6.741 }, handleMode: 'corner' },
      { id: 'p90_dogear_a8', position: { x: -43.115, y: 9.046 }, handleOut: { x: 0.0, y: 4.188 }, handleMode: 'corner' },
      { id: 'p90_dogear_a9', position: { x: -35.555, y: 16.606 }, handleIn: { x: -4.188, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_dogear_a10', position: { x: 36.8, y: 16.606 }, handleOut: { x: 4.188, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_dogear_a11', position: { x: 44.36, y: 9.046 }, handleIn: { x: 0.0, y: 4.188 }, handleMode: 'corner' },
      { id: 'p90_dogear_a12', position: { x: 44.36, y: 6.741 }, handleMode: 'corner' },
      { id: 'p90_dogear_a13', position: { x: 48.385, y: 6.741 }, handleOut: { x: 2.513, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_dogear_a14', position: { x: 52.921, y: 2.205 }, handleIn: { x: 0.0, y: 2.513 }, handleMode: 'corner' },
      { id: 'p90_dogear_a15', position: { x: 52.921, y: -2.42 }, handleOut: { x: 0.0, y: -2.513 }, handleMode: 'corner' },
      { id: 'p90_dogear_a16', position: { x: 48.385, y: -6.956 }, handleIn: { x: 2.513, y: 0.0 }, handleMode: 'corner' },
      { id: 'p90_dogear_a17', position: { x: 44.36, y: -6.956 }, handleMode: 'corner' },
      { id: 'p90_dogear_a18', position: { x: 44.36, y: -9.047 }, handleOut: { x: 0.0, y: -4.188 }, handleMode: 'corner' },
      { id: 'p90_dogear_a19', position: { x: 36.8, y: -16.606 }, handleIn: { x: 4.188, y: 0.0 }, handleMode: 'corner' },
    ],
  },
  tele_neck: {
    name: 'Tele-Style Neck Pickup',
    widthMm: 79.635,
    heightMm: 20.997,
    // Not symmetric top-to-bottom - the coil sits 7.5mm from the top edge,
    // not 10.4985mm (half the height), so (0,0) - the placement/rotation
    // pivot - is offset from the shape's own geometric center accordingly.
    anchors: [
      { id: 'tele_neck_a0', position: { x: -33.558, y: -7.477 }, handleOut: { x: -7.221, y: 0.002 }, handleMode: 'corner' },
      { id: 'tele_neck_a1', position: { x: -36.507, y: 5.086 }, handleIn: { x: -5.232, y: -1.454 }, handleMode: 'corner' },
      { id: 'tele_neck_a2', position: { x: -6.235, y: 13.498 }, handleMode: 'corner' },
      { id: 'tele_neck_a3', position: { x: 6.618, y: 13.498 }, handleMode: 'corner' },
      { id: 'tele_neck_a4', position: { x: 36.573, y: 5.285 }, handleOut: { x: 5.24, y: -1.437 }, handleMode: 'corner' },
      { id: 'tele_neck_a5', position: { x: 34.837, y: -7.5 }, handleIn: { x: 5.488, y: -0.002 }, handleMode: 'corner' },
    ],
  },
  tele_bridge: {
    name: 'Tele-Style Bridge Pickup',
    widthMm: 74.776,
    heightMm: 40.071,
    // The only cavity that's actually installed at an angle - a Tele bridge
    // plate cants the pickup, unlike every other type here.
    defaultAngleDegrees: 15,
    anchors: [
      { id: 'tele_bridge_a0', position: { x: -0.296, y: -20.034 }, handleOut: { x: -9.23, y: 2.95 }, handleMode: 'corner' },
      { id: 'tele_bridge_a1', position: { x: -27.893, y: -10.68 }, handleIn: { x: 9.182, y: -3.14 }, handleOut: { x: -2.641, y: 0.161 }, handleMode: 'corner' },
      { id: 'tele_bridge_a2', position: { x: -34.81, y: -7.251 }, handleIn: { x: 1.737, y: -1.991 }, handleOut: { x: -1.692, y: 1.902 }, handleMode: 'corner' },
      { id: 'tele_bridge_a3', position: { x: -37.379, y: -0.243 }, handleIn: { x: -0.119, y: -2.558 }, handleOut: { x: 0.099, y: 3.164 }, handleMode: 'corner' },
      { id: 'tele_bridge_a4', position: { x: -34.076, y: 8.219 }, handleIn: { x: -1.892, y: -2.45 }, handleOut: { x: 2.985, y: 3.702 }, handleMode: 'corner' },
      { id: 'tele_bridge_a5', position: { x: -25.122, y: 19.324 }, handleIn: { x: -2.985, y: -3.702 }, handleOut: { x: 0.321, y: 0.268 }, handleMode: 'corner' },
      { id: 'tele_bridge_a6', position: { x: -23.951, y: 19.72 }, handleIn: { x: -0.425, y: 0.051 }, handleMode: 'corner' },
      { id: 'tele_bridge_a7', position: { x: 23.566, y: 20.035 }, handleOut: { x: 0.412, y: -0.078 }, handleMode: 'corner' },
      { id: 'tele_bridge_a8', position: { x: 24.616, y: 19.378 }, handleIn: { x: -0.23, y: 0.362 }, handleOut: { x: 3.157, y: -3.829 }, handleMode: 'corner' },
      { id: 'tele_bridge_a9', position: { x: 34.085, y: 7.888 }, handleIn: { x: -3.152, y: 3.834 }, handleOut: { x: 1.349, y: -1.993 }, handleMode: 'corner' },
      { id: 'tele_bridge_a10', position: { x: 37.171, y: 1.374 }, handleIn: { x: -0.489, y: 2.384 }, handleOut: { x: 0.49, y: -2.271 }, handleMode: 'corner' },
      { id: 'tele_bridge_a11', position: { x: 36.172, y: -5.371 }, handleIn: { x: 1.149, y: 2.025 }, handleOut: { x: -1.866, y: -3.34 }, handleMode: 'corner' },
      { id: 'tele_bridge_a12', position: { x: 27.347, y: -10.703 }, handleIn: { x: 3.585, y: 0.514 }, handleOut: { x: -9.099, y: -3.099 }, handleMode: 'corner' },
      { id: 'tele_bridge_a13', position: { x: 0.049, y: -20.001 }, handleIn: { x: 9.099, y: 3.099 }, handleOut: { x: -0.114, y: -0.029 }, handleMode: 'corner' },
      { id: 'tele_bridge_a14', position: { x: -0.296, y: -20.034 }, handleIn: { x: 0.117, y: -0.004 }, handleMode: 'corner' },
    ],
  },

  // --- Four-string bass ------------------------------------------------------
  //
  // Every dimension below is a *cavity* measurement where one was published,
  // and a pickup measurement plus 2.0mm total clearance (1mm a side) where
  // only the pickup was - each entry says which. The J, MM and soapbar
  // outlines are rounded rectangles at a 3.175mm corner radius, the radius a
  // 1/4" router bit leaves - which is what those cavities actually are;
  // bass_split_coil is a real traced outline, like the guitar shapes.
  bass_split_coil: {
    name: 'Split Coil (P-Style)',
    // ONE routed cavity for the whole pickup - traced verbatim from a real
    // Fender Precision routing template (the user's
    // `Fender-Precision-Pickup Cavity.svg`, mirrored into
    // docs/bass-blueprint-evidence/). Two ~70 x 32mm bobbin pockets in the P
    // "split" stagger - the E/A pocket toward the neck and bass side, the D/G
    // pocket toward the bridge and treble side - joined by a short strip into
    // one Z-shaped opening. The two pockets meet but do NOT overlap; this is
    // not the symmetric-overlap rectangle pair an earlier draft used.
    //
    // Centred on (0,0), unrotated. widthMm/heightMm are the outline's bounding
    // box; the ~62mm height is the sourced figure. Real routing depth is 3/4"
    // (19.05mm), not modelled - the printable plan has no pickup-depth field.
    widthMm: 105.106,
    heightMm: 62.166,
    anchors: [
      { id: 'bass_split_coil_a0', position: { x: -18.834, y: 0.389 }, handleIn: { x: -8.553, y: 0 }, handleOut: { x: 2.471, y: 0.467 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a1', position: { x: -17.246, y: 5.643 }, handleIn: { x: -0.264, y: -1.787 }, handleOut: { x: 0.082, y: 6.787 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a2', position: { x: -17.117, y: 26.013 }, handleIn: { x: -0.295, y: -6.774 }, handleOut: { x: 0.628, y: 3.675 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a3', position: { x: -9.185, y: 31.083 }, handleIn: { x: -3.438, y: 0.47 }, handleOut: { x: 18.679, y: -0.022 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a4', position: { x: 46.852, y: 31.05 }, handleIn: { x: -18.677, y: 0.077 }, handleOut: { x: 3.966, y: -0.274 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a5', position: { x: 52.553, y: 23.022 }, handleIn: { x: 0.549, y: 3.661 }, handleOut: { x: -0.08, y: -6.91 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a6', position: { x: 52.424, y: 2.284 }, handleIn: { x: 0.294, y: 6.897 }, handleOut: { x: -0.628, y: -3.675 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a7', position: { x: 44.491, y: -2.786 }, handleIn: { x: 3.438, y: -0.47 }, handleOut: { x: -8.553, y: 0 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a8', position: { x: 18.832, y: -2.786 }, handleIn: { x: 8.553, y: 0 }, handleOut: { x: -2.471, y: -0.467 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a9', position: { x: 17.245, y: -8.041 }, handleIn: { x: 0.264, y: 1.787 }, handleOut: { x: -0.08, y: -5.988 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a10', position: { x: 17.116, y: -26.013 }, handleIn: { x: 0.293, y: 5.975 }, handleOut: { x: -0.628, y: -3.675 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a11', position: { x: 9.183, y: -31.083 }, handleIn: { x: 3.438, y: -0.47 }, handleOut: { x: -18.678, y: 0.022 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a12', position: { x: -46.852, y: -31.05 }, handleIn: { x: 18.677, y: -0.077 }, handleOut: { x: -3.966, y: 0.274 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a13', position: { x: -52.553, y: -23.022 }, handleIn: { x: -0.549, y: -3.661 }, handleOut: { x: 0.078, y: 6.111 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a14', position: { x: -52.424, y: -4.681 }, handleIn: { x: -0.291, y: -6.098 }, handleOut: { x: 0.628, y: 3.675 }, handleMode: 'corner' },
      { id: 'bass_split_coil_a15', position: { x: -44.491, y: 0.389 }, handleIn: { x: -3.438, y: 0.47 }, handleOut: { x: 8.553, y: 0 }, handleMode: 'corner' },
    ],
  },
  bass_j_single_coil: {
    name: 'J-Style Single Coil (Bass)',
    // Neck-position pickup 3.60" x 0.76" (91.4 x 19.3mm) + 2.0mm clearance.
    // A J bridge pickup is ~2.7mm longer; because a PickupPlacement carries
    // its own widthMm/heightMm, the bridge one is the same type resized
    // rather than a second entry for what is the same rout shape.
    widthMm: 93.4,
    heightMm: 21.3,
    anchors: roundedRectAnchors('bass_j_single_coil', 93.4, 21.3, 3.175),
  },
  bass_humbucker: {
    name: 'Bass Humbucker (MM-Style)',
    // Published routing-template cavity, 103.7 x 50.5mm, for a 101.7 x
    // 48.5mm pickup - a measured cavity, not a derived one.
    widthMm: 103.7,
    heightMm: 50.5,
    anchors: roundedRectAnchors('bass_humbucker', 103.7, 50.5, 3.175),
  },
  bass_soapbar: {
    name: 'Bass Soapbar (4-String)',
    // The 3.5" (88.9mm) four-string soapbar housing, 1.5" (38.1mm) wide -
    // the size that names the series - plus 2.0mm clearance.
    widthMm: 90.9,
    heightMm: 40.1,
    anchors: roundedRectAnchors('bass_soapbar', 90.9, 40.1, 3.175),
  },
  // The following four routs are transcribed from the user's
  // `bass-pickups.svg` source sheet.  These are separate types because their
  // cavity footprints genuinely differ, not merely because they are familiar
  // model names.
  bass_r_toaster: {
    name: 'R-Style Toaster Pickup',
    widthMm: 70.96314,
    heightMm: 26.50078,
    anchors: roundedRectAnchors('bass_r_toaster', 70.96314, 26.50078, 4),
  },
  bass_r_horseshoe: {
    name: 'R-Style Horseshoe Bridge Pickup',
    widthMm: 140.408386,
    heightMm: 39.50052,
    anchors: roundedRectAnchors('bass_r_horseshoe', 140.408386, 39.50052, 8),
  },
  bass_mudbucker: {
    name: 'EB-Style Mudbucker',
    widthMm: 68.30416,
    heightMm: 43.233333,
    anchors: roundedRectAnchors('bass_mudbucker', 68.30416, 43.233333, 4),
  },
  bass_mini_humbucker: {
    name: 'Bass Mini Humbucker',
    widthMm: 88.94165,
    heightMm: 37.4125,
    anchors: roundedRectAnchors('bass_mini_humbucker', 88.94165, 37.4125, 4),
  },
};

/**
 * Visible pickup-cover footprints, used only on the printable plan. The rout
 * and cover are deliberately separate: a pickguard can require the smaller
 * cover opening while the body still needs the larger mounting-ear cavity.
 * Lipstick tubes are omitted because their cover and rout nearly coincide.
 */
export const PICKUP_COVER_OUTLINES: Partial<Record<PickupType, {
  widthMm: LengthMm;
  heightMm: LengthMm;
  cornerRadiusMm: LengthMm;
}>> = {
  humbucker: { widthMm: 70, heightMm: 38, cornerRadiusMm: 4 },
  mini_humbucker: { widthMm: 70, heightMm: 25, cornerRadiusMm: 4 },
  single_coil: { widthMm: 70, heightMm: 18, cornerRadiusMm: 9 },
  p90_soapbar: { widthMm: 85, heightMm: 35, cornerRadiusMm: 6 },
  p90_dogear: { widthMm: 85, heightMm: 35, cornerRadiusMm: 6 },
  tele_neck: { widthMm: 65, heightMm: 15, cornerRadiusMm: 7.5 },
  tele_bridge: { widthMm: 73, heightMm: 20, cornerRadiusMm: 6 },
};
