import type { PathAnchor, ReferenceTemplate } from '../types/guitar';

// 1. S-Style Blueprint Anchors (Iconic Stratocaster Blueprint Spline)
export const S_STYLE_ANCHORS: PathAnchor[] = [
  {
    id: "s_pocket_left",
    position: { x: -27.78, y: 0 },
    handleOut: { x: 0.2857, y: 10.2857 },
    handleMode: "corner",
    locked: true,
    semanticRole: "neck_pocket_left",
    handleIn: { x: 25.4661, y: -0.2415 }
  },
  {
    id: "s_horn_scoop_left",
    position: { x: -51.9339, y: 19.7886 },
    handleIn: { x: 18.2792, y: 0.8649 },
    handleOut: { x: -14.8712, y: -0.7037 },
    handleMode: "smooth"
  },
  {
    id: "anchor_1785076078057_sf1j7",
    position: { x: -90.5311, y: -13.2636 },
    handleIn: { x: 7.0419, y: 20.0405 },
    handleOut: { x: -8.03, y: -22.8525 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "s_upper_horn_tip",
    position: { x: -107.1323, y: -61.8832 },
    handleIn: { x: 19.0642, y: 2.4153 },
    handleOut: { x: -26.5176, y: -3.3596 },
    handleMode: "smooth",
    semanticRole: "upper_horn_left"
  },
  {
    id: "s_upper_bout_outer_left",
    position: { x: -141.7143, y: 15.7143 },
    handleIn: { x: -3.0951, y: -35.2196 },
    handleOut: { x: 4.1429, y: 47.1429 },
    handleMode: "smooth"
  },
  {
    id: "s_waist_left",
    position: { x: -115.4286, y: 134.8571 },
    handleIn: { x: 0.4847, y: -37.8928 },
    handleOut: { x: -0.496, y: 38.7761 },
    handleMode: "smooth",
    semanticRole: "waist_left"
  },
  {
    id: "s_lower_bout_left",
    position: { x: -163.725, y: 303.7229 },
    handleIn: { x: -0.0091, y: -70.001 },
    handleOut: { x: 0.0089, y: 68.6751 },
    handleMode: "smooth",
    semanticRole: "lower_bout_left"
  },
  {
    id: "s_tail_center",
    position: { x: 2.2671, y: 409.1564 },
    handleIn: { x: -134.4379, y: -0.7557 },
    handleOut: { x: 134.4379, y: 0.7557 },
    handleMode: "symmetric",
    semanticRole: "tail_center"
  },
  {
    id: "s_lower_bout_right",
    position: { x: 165.1543, y: 305.7764 },
    handleIn: { x: -0.7486, y: 63.8043 },
    handleOut: { x: 0.7706, y: -65.6768 },
    handleMode: "smooth",
    semanticRole: "lower_bout_right"
  },
  {
    id: "s_waist_right",
    position: { x: 117.1429, y: 149.1429 },
    handleIn: { x: -0.6525, y: 33.2017 },
    handleOut: { x: 0.6653, y: -33.8518 },
    handleMode: "smooth",
    semanticRole: "waist_right"
  },
  {
    id: "s_upper_bout_outer_right",
    position: { x: 142.7143, y: 50.2857 },
    handleIn: { x: -1.1332, y: 44.872 },
    handleOut: { x: 0.5459, y: -21.6156 },
    handleMode: "smooth"
  },
  {
    id: "s_treble_horn_tip",
    position: { x: 116.7143, y: 4.1429 },
    handleIn: { x: 21.5362, y: -0.5791 },
    handleOut: { x: -22.9453, y: 0.617 },
    handleMode: "smooth",
    semanticRole: "upper_horn_right"
  },
  {
    id: "anchor_1785075971501_6na5z",
    position: { x: 80.1781, y: 60.4292 },
    handleIn: { x: 29.7954, y: -20.8211 },
    handleOut: { x: -17.7472, y: 12.4018 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "s_horn_scoop_right",
    position: { x: 30.0283, y: 52.4225 },
    handleIn: { x: 9.4329, y: 12.0763 },
    handleOut: { x: 0.3199, y: -32.5219 },
    handleMode: "corner"
  },
  {
    id: "s_pocket_right",
    position: { x: 27.78, y: 0 },
    handleIn: { x: 0.5819, y: 13.4592 },
    handleMode: "corner",
    locked: true,
    semanticRole: "neck_pocket_right",
    handleOut: { x: -21.1533, y: 0.2551 }
  }
];

// 2. T-Style Blueprint Anchors (Iconic Telecaster Blueprint Spline)
export const T_STYLE_ANCHORS: PathAnchor[] = [
  {
    id: "t_pocket_left",
    position: { x: -27.78, y: 0 },
    handleIn: { x: 3.8467, y: -0.2028 },
    handleOut: { x: -3.8467, y: 0.2028 },
    handleMode: "symmetric",
    locked: true,
    semanticRole: "neck_pocket_left"
  },
  {
    id: "anchor_1785067009169_pw65q",
    position: { x: -38.3698, y: 17.1119 },
    handleIn: { x: 13.4476, y: -0.0617 },
    handleOut: { x: -9.0447, y: 0.0415 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "t_shoulder_left",
    position: { x: -95.2724, y: -3.2777 },
    handleIn: { x: 31.6971, y: 0.7736 },
    handleOut: { x: -26.5117, y: -0.6471 },
    handleMode: "smooth",
    semanticRole: "upper_horn_left"
  },
  {
    id: "t_upper_bout_left",
    position: { x: -143.5579, y: 40.1011 },
    handleIn: { x: 0.7481, y: -30.3025 },
    handleOut: { x: -1.4892, y: 60.3243 },
    handleMode: "smooth"
  },
  {
    id: "t_waist_left",
    position: { x: -118.3397, y: 154.1739 },
    handleIn: { x: 2.2782, y: -40.3893 },
    handleOut: { x: -2.2782, y: 40.3893 },
    handleMode: "symmetric",
    semanticRole: "waist_left"
  },
  {
    id: "t_lower_bout_left",
    position: { x: -166.6024, y: 311.2144 },
    handleIn: { x: 0.9205, y: -65.6109 },
    handleOut: { x: -0.5049, y: 35.991 },
    handleMode: "smooth",
    semanticRole: "lower_bout_left"
  },
  {
    id: "t_bottom_left",
    position: { x: -117.1913, y: 395.8005 },
    handleIn: { x: -29.7897, y: -15.6038 },
    handleOut: { x: 29.7897, y: 15.6038 },
    handleMode: "symmetric"
  },
  {
    id: "t_tail_center",
    position: { x: -0.8005, y: 410.806 },
    handleIn: { x: -37.1845, y: 1.2008 },
    handleOut: { x: 37.1845, y: -1.2008 },
    handleMode: "symmetric",
    semanticRole: "tail_center"
  },
  {
    id: "t_bottom_right",
    position: { x: 116.3908, y: 395 },
    handleIn: { x: -30.9905, y: 18.0054 },
    handleOut: { x: 30.9905, y: -18.0054 },
    handleMode: "symmetric"
  },
  {
    id: "t_lower_bout_right",
    position: { x: 164.2008, y: 312.8155 },
    handleIn: { x: -2.2024, y: 33.1505 },
    handleOut: { x: 4.5884, y: -69.0634 },
    handleMode: "smooth",
    semanticRole: "lower_bout_right"
  },
  {
    id: "t_waist_right",
    position: { x: 116.5164, y: 154.0976 },
    handleIn: { x: 0.3383, y: 40.2619 },
    handleOut: { x: -0.2883, y: -34.311 },
    handleMode: "smooth",
    semanticRole: "waist_right"
  },
  {
    id: "t_cutaway_outer",
    position: { x: 141.4461, y: 54.6492 },
    handleIn: { x: -0.2867, y: 34.1751 },
    handleOut: { x: 0.1318, y: -15.7121 },
    handleMode: "smooth"
  },
  {
    id: "t_cutaway_horn_tip",
    position: { x: 116.3633, y: 3.3586 },
    handleIn: { x: 22.5778, y: 0.1412 },
    handleOut: { x: -33.6516, y: -0.2104 },
    handleMode: "smooth",
    semanticRole: "upper_horn_right"
  },
  {
    id: "anchor_1785071325379_cyuab",
    position: { x: 53.0389, y: 72.6203 },
    handleIn: { x: 47.2889, y: -0.0032 },
    handleOut: { x: -23.6259, y: 0.0016 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "anchor_1785071314260_gt9ae",
    position: { x: 29.1586, y: 46.2846 },
    handleIn: { x: 0.0468, y: 5.6576 },
    handleOut: { x: -0.0832, y: -10.0622 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "t_pocket_right",
    position: { x: 27.78, y: 0 },
    handleIn: { x: 0.4512, y: 4.6992 },
    handleOut: { x: -15, y: 0 },
    handleMode: "corner",
    locked: true,
    semanticRole: "neck_pocket_right"
  }
];

// 3. Single-Cut Blueprint Anchors (Iconic Les Paul Blueprint Spline)
export const SINGLE_CUT_ANCHORS: PathAnchor[] = [
  {
    id: "sc_pocket_left",
    position: { x: -19.05, y: 0 },
    handleOut: { x: -57.6551, y: 0.1447 },
    handleMode: "corner",
    locked: true,
    semanticRole: "neck_pocket_left"
  },
  {
    id: "sc_upper_shoulder",
    position: { x: -115.7337, y: 64.9047 },
    handleIn: { x: 0.9155, y: -37.49 },
    handleOut: { x: -0.9337, y: 38.2382 },
    handleMode: "smooth"
  },
  {
    id: "sc_upper_bout",
    position: { x: -90.8084, y: 148.1867 },
    handleIn: { x: 0.0965, y: -30.0012 },
    handleOut: { x: -0.1156, y: 35.9218 },
    handleMode: "smooth",
    semanticRole: "upper_horn_left"
  },
  {
    id: "sc_lower_bout_left",
    position: { x: -160.1429, y: 287.7143 },
    handleIn: { x: 1.0905, y: -78.3625 },
    handleOut: { x: -1.2097, y: 86.9287 },
    handleMode: "smooth",
    semanticRole: "lower_bout_left"
  },
  {
    id: "sc_tail_center",
    position: { x: -0.5881, y: 423.1096 },
    handleIn: { x: -92.4361, y: 0.5213 },
    handleOut: { x: 92.4361, y: -0.5213 },
    handleMode: "symmetric",
    semanticRole: "tail_center"
  },
  {
    id: "sc_lower_bout_right",
    position: { x: 159, y: 291.1429 },
    handleIn: { x: -0.8038, y: 84.9025 },
    handleOut: { x: 0.7911, y: -83.5678 },
    handleMode: "smooth",
    semanticRole: "lower_bout_right"
  },
  {
    id: "sc_waist_right",
    position: { x: 86.5714, y: 147.8571 },
    handleIn: { x: 1.5725, y: 32.2806 },
    handleOut: { x: -1.1582, y: -23.7756 },
    handleMode: "smooth",
    semanticRole: "waist_right"
  },
  {
    id: "anchor_1785072642913_kdp70",
    position: { x: 112.2641, y: 69.0843 },
    handleIn: { x: -0.4707, y: 28.5732 },
    handleOut: { x: 0.2483, y: -15.07 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "sc_cutaway_horn_tip",
    position: { x: 100.319, y: 42.9167 },
    handleIn: { x: 7.4999, y: 0.0886 },
    handleOut: { x: -14.2482, y: -0.1683 },
    handleMode: "smooth",
    semanticRole: "upper_horn_right"
  },
  {
    id: "anchor_1785072576588_chpj8",
    position: { x: 60.3024, y: 68.9346 },
    handleIn: { x: 28.75, y: -0.5536 },
    handleOut: { x: -16.5844, y: 0.3193 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "sc_cutaway_inner_scoop",
    position: { x: 27.1429, y: 39.5977 },
    handleIn: { x: 4.5, y: 22.7143 },
    handleOut: { x: -0.2143, y: -12.5 },
    handleMode: "corner"
  },
  {
    id: "anchor_1785072512647_iico5",
    position: { x: 26.6679, y: 1.9821 },
    handleIn: { x: 0.6882, y: 17.4557 },
    handleOut: { x: -3.2732, y: -0.0179 },
    handleMode: "corner",
    semanticRole: "custom"
  },
  {
    id: "sc_pocket_right",
    position: { x: 19.05, y: 0 },
    handleIn: { x: 2.5, y: 0 },
    handleMode: "smooth",
    locked: true,
    semanticRole: "neck_pocket_right"
  }
];

// 4. Double-Cut SG Blueprint Anchors (Iconic Gibson/Yamaha SG Blueprint Spline)
export const SG_STYLE_ANCHORS: PathAnchor[] = [
  {
    id: "sg_pocket_left",
    position: { x: -19.05, y: 0 },
    handleOut: { x: -18.1737, y: -0.038 },
    handleMode: "smooth",
    locked: true,
    semanticRole: "neck_pocket_left",
    handleIn: { x: 20.2742, y: 0.0424 }
  },
  {
    id: "sg_horn_scoop_left",
    position: { x: -55.6823, y: 52.5555 },
    handleIn: { x: 40.39, y: -0.39 },
    handleOut: { x: -40.39, y: 0.39 },
    handleMode: "symmetric"
  },
  {
    id: "sg_upper_horn_tip_left",
    position: { x: -85.9702, y: 0.6912 },
    handleIn: { x: 8.0592, y: 2.2262 },
    handleOut: { x: -11.1702, y: -3.0855 },
    handleMode: "smooth",
    semanticRole: "upper_horn_left"
  },
  {
    id: "sg_upper_bout_outer_left",
    position: { x: -128.9765, y: 101.9509 },
    handleIn: { x: -5, y: -35 },
    handleOut: { x: 5, y: 35 },
    handleMode: "smooth"
  },
  {
    id: "sg_waist_left",
    position: { x: -106.8249, y: 186.7952 },
    handleIn: { x: -5, y: -35 },
    handleOut: { x: -20, y: 50 },
    handleMode: "smooth",
    semanticRole: "waist_left"
  },
  {
    id: "sg_lower_bout_left",
    position: { x: -152.6295, y: 260.4663 },
    handleIn: { x: 21.8164, y: -42.1194 },
    handleOut: { x: -25.2405, y: 48.7301 },
    handleMode: "smooth",
    semanticRole: "lower_bout_left"
  },
  {
    id: "sg_lower_bout_bottom_left",
    position: { x: -122.6039, y: 388.6921 },
    handleIn: { x: -44.1293, y: -24.7979 },
    handleOut: { x: 43.0053, y: 24.1663 },
    handleMode: "smooth"
  },
  {
    id: "sg_tail_center",
    position: { x: 0.9197, y: 416.5033 },
    handleIn: { x: -60, y: 0 },
    handleOut: { x: 60, y: 0 },
    handleMode: "symmetric",
    semanticRole: "tail_center"
  },
  {
    id: "sg_lower_bout_bottom_right",
    position: { x: 127.2476, y: 386.3605 },
    handleIn: { x: -34.7682, y: 24.8229 },
    handleOut: { x: 38.1737, y: -27.2543 },
    handleMode: "smooth"
  },
  {
    id: "sg_lower_bout_right",
    position: { x: 156.7294, y: 268.1482 },
    handleIn: { x: 19.4238, y: 45.5582 },
    handleOut: { x: -18.3408, y: -43.0179 },
    handleMode: "smooth",
    semanticRole: "lower_bout_right"
  },
  {
    id: "sg_waist_right",
    position: { x: 110.9636, y: 187.255 },
    handleIn: { x: 4.0273, y: 35.0758 },
    handleOut: { x: -3.7468, y: -32.6325 },
    handleMode: "smooth",
    semanticRole: "waist_right"
  },
  {
    id: "sg_upper_bout_outer_right",
    position: { x: 134.0284, y: 94.6449 },
    handleIn: { x: 1.3729, y: 35 },
    handleOut: { x: -1.3857, y: -35.3282 },
    handleMode: "smooth"
  },
  {
    id: "sg_upper_horn_tip_right",
    position: { x: 90.0507, y: 11.1192 },
    handleIn: { x: 9.261, y: -8.5391 },
    handleOut: { x: -6.9499, y: 6.4081 },
    handleMode: "smooth",
    semanticRole: "upper_horn_right"
  },
  {
    id: "sg_horn_scoop_right",
    position: { x: 57.0425, y: 52.5555 },
    handleIn: { x: 40.3773, y: -0.9321 },
    handleOut: { x: -40.3773, y: 0.9321 },
    handleMode: "symmetric"
  },
  {
    id: "sg_pocket_right",
    position: { x: 19.05, y: 0 },
    handleIn: { x: 19.5339, y: 0.4154 },
    handleMode: "smooth",
    locked: true,
    semanticRole: "neck_pocket_right",
    handleOut: { x: -20.2697, y: -0.431 }
  }
];

export const REFERENCE_TEMPLATES: Record<string, ReferenceTemplate> = {
  single_cut: {
    id: 'single_cut',
    name: 'Single-Cut Vintage',
    description: 'Classic single-cut Mahogany body with dual humbuckers and Tune-O-Matic bridge.',
    category: 'Single-Cut',
    neckPresetId: 'gibson_lp_22',
    bridgePresetId: 'tune_o_matic',
    defaultAnchors: SINGLE_CUT_ANCHORS,
    defaultPickups: [
      { id: 'p_neck', type: 'humbucker', offsetYMm: 90, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
      { id: 'p_bridge', type: 'humbucker', offsetYMm: 198, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
    ],
  },
  sg_style: {
    id: 'sg_style',
    name: 'Double-Cut SG Vintage',
    description: 'Symmetric double-cutaway Vintage SG body (Gibson/Yamaha style) with bevel contours.',
    category: 'Single-Cut',
    neckPresetId: 'gibson_sg_22',
    bridgePresetId: 'tune_o_matic',
    defaultAnchors: SG_STYLE_ANCHORS,
    defaultPickups: [
      { id: 'p_neck', type: 'humbucker', offsetYMm: 55, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
      { id: 'p_bridge', type: 'humbucker', offsetYMm: 150, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
    ],
  },
  s_style: {
    id: 's_style',
    name: 'S-Style Standard',
    description: 'Double cutaway body with contoured waist and upper horns.',
    category: 'S-Style',
    neckPresetId: 'fender_strat_21',
    bridgePresetId: 'tremolo_strat',
    defaultAnchors: S_STYLE_ANCHORS,
    defaultPickups: [
      { id: 'p_neck', type: 'single_coil', offsetYMm: 85, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 18 },
      { id: 'p_middle', type: 'single_coil', offsetYMm: 145, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 18 },
      { id: 'p_bridge', type: 'single_coil', offsetYMm: 205, offsetXMm: 0, angleDegrees: -10, widthMm: 70, heightMm: 18 },
    ],
  },
  t_style: {
    id: 't_style',
    name: 'T-Style Standard',
    description: 'Single cutaway solid body with flat edge profile and classic bridge plate.',
    category: 'T-Style',
    neckPresetId: 'fender_tele_22',
    bridgePresetId: 'tele_bridge_plate',
    defaultAnchors: T_STYLE_ANCHORS,
    defaultPickups: [
      { id: 'p_neck', type: 'tele_neck', offsetYMm: 95, offsetXMm: 0, angleDegrees: 0, widthMm: 65, heightMm: 15 },
      { id: 'p_bridge', type: 'tele_bridge', offsetYMm: 222, offsetXMm: 0, angleDegrees: -11, widthMm: 73, heightMm: 20 },
    ],
  },
};
