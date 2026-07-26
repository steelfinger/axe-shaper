import type { BridgePreset, NeckPreset, PickupType } from '../types/guitar';

export const NECK_PRESETS: Record<string, NeckPreset> = {
  fender_strat_21: {
    id: 'fender_strat_21',
    name: 'S-Style Standard (25.5" Scale, 21 Frets)',
    scaleLengthMm: 647.7,     // 25.5 inches
    nutToJointMm: 458.7,      // Nut to 16th fret joint line
    frets: 21,
    jointWidthMm: 55.56,      // 2-3/16 inches
    jointDepthMm: 76.2,       // 3.0 inches
    jointCornerRadiusMm: 12.7,
    style: 'fender_style',
  },
  fender_tele_22: {
    id: 'fender_tele_22',
    name: 'T-Style Standard (25.5" Scale, 22 Frets)',
    scaleLengthMm: 647.7,     // 25.5 inches
    nutToJointMm: 458.7,
    frets: 22,
    jointWidthMm: 55.56,
    jointDepthMm: 76.2,
    jointCornerRadiusMm: 3.17, // Square heel corners
    style: 'fender_style',
  },
  gibson_lp_22: {
    id: 'gibson_lp_22',
    name: 'Single-Cut Vintage (24.75" Scale, 22 Frets)',
    scaleLengthMm: 628.65,    // 24.75 inches
    nutToJointMm: 414.27,     // Nut to joint line
    frets: 22,
    jointWidthMm: 38.1,       // 1.5 inches mortise
    jointDepthMm: 88.9,       // 3.5 inches
    jointCornerRadiusMm: 6.35,
    style: 'gibson_style',
  },
  baritone_27: {
    id: 'baritone_27',
    name: 'Baritone Extended (27.0" Scale, 24 Frets)',
    scaleLengthMm: 685.8,     // 27.0 inches
    nutToJointMm: 485.8,
    frets: 24,
    jointWidthMm: 57.0,
    jointDepthMm: 76.2,
    jointCornerRadiusMm: 12.7,
    style: 'baritone',
  },
};

export const BRIDGE_PRESETS: Record<string, BridgePreset> = {
  hardtail_6: {
    id: 'hardtail_6',
    name: 'Hardtail 6-Saddle Plate',
    scaleReference: 'saddle_line',
    compensationMm: {
      treble: 1.5, // 1.5mm back from theoretical saddle line
      bass: 4.5,   // 4.5mm back for intonation
    },
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
    mountingPoints: [
      { x: -37.0, y: 0 },
      { x: 37.0, y: 2.0 }, // Slanted post line
      { x: -41.0, y: 38.0 }, // Tailpiece post left
      { x: 41.0, y: 38.0 },  // Tailpiece post right
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
    mountingPoints: [
      { x: -32.5, y: 48 },
      { x: 0, y: 48 },
      { x: 32.5, y: 48 },
    ],
    widthMm: 76.5,
    lengthMm: 86.0,
  },
};

export const PICKUP_SPECIFICATIONS: Record<PickupType, { name: string; widthMm: number; heightMm: number; cornerRadiusMm: number }> = {
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
