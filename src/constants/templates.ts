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
    handleIn: { x: 3.7715, y: -0.1988 },
    handleOut: { x: -3.7715, y: 0.1988 },
    handleMode: "symmetric",
    locked: true,
    semanticRole: "neck_pocket_left"
  },
  {
    id: "anchor_1785067009169_pw65q",
    position: { x: -37.6196, y: 16.7773 },
    handleIn: { x: 13.1847, y: -0.0605 },
    handleOut: { x: -8.8679, y: 0.0407 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "t_shoulder_left",
    position: { x: -93.4096, y: -3.2136 },
    handleIn: { x: 31.0774, y: 0.7585 },
    handleOut: { x: -25.9933, y: -0.6344 },
    handleMode: "smooth",
    semanticRole: "upper_horn_left"
  },
  {
    id: "t_upper_bout_left",
    position: { x: -140.751, y: 39.317 },
    handleIn: { x: 0.7335, y: -29.71 },
    handleOut: { x: -1.4601, y: 59.1448 },
    handleMode: "smooth"
  },
  {
    id: "t_waist_left",
    position: { x: -116.0259, y: 151.1595 },
    handleIn: { x: 2.2337, y: -39.5996 },
    handleOut: { x: -2.2337, y: 39.5996 },
    handleMode: "symmetric",
    semanticRole: "waist_left"
  },
  {
    id: "t_lower_bout_left",
    position: { x: -163.345, y: 305.1295 },
    handleIn: { x: 0.9025, y: -64.3281 },
    handleOut: { x: -0.495, y: 35.2873 },
    handleMode: "smooth",
    semanticRole: "lower_bout_left"
  },
  {
    id: "t_bottom_left",
    position: { x: -114.9, y: 388.0618 },
    handleIn: { x: -29.2072, y: -15.2987 },
    handleOut: { x: 29.2072, y: 15.2987 },
    handleMode: "symmetric"
  },
  {
    id: "t_tail_center",
    position: { x: -0.7848, y: 402.7739 },
    handleIn: { x: -36.4575, y: 1.1773 },
    handleOut: { x: 36.4575, y: -1.1773 },
    handleMode: "symmetric",
    semanticRole: "tail_center"
  },
  {
    id: "t_bottom_right",
    position: { x: 114.1151, y: 387.2769 },
    handleIn: { x: -30.3846, y: 17.6534 },
    handleOut: { x: 30.3846, y: -17.6534 },
    handleMode: "symmetric"
  },
  {
    id: "t_lower_bout_right",
    position: { x: 160.9903, y: 306.6993 },
    handleIn: { x: -2.1593, y: 32.5023 },
    handleOut: { x: 4.4987, y: -67.7131 },
    handleMode: "smooth",
    semanticRole: "lower_bout_right"
  },
  {
    id: "t_waist_right",
    position: { x: 114.2383, y: 151.0847 },
    handleIn: { x: 0.3317, y: 39.4747 },
    handleOut: { x: -0.2827, y: -33.6401 },
    handleMode: "smooth",
    semanticRole: "waist_right"
  },
  {
    id: "t_cutaway_outer",
    position: { x: 138.6805, y: 53.5807 },
    handleIn: { x: -0.2811, y: 33.5069 },
    handleOut: { x: 0.1292, y: -15.4049 },
    handleMode: "smooth"
  },
  {
    id: "t_cutaway_horn_tip",
    position: { x: 114.0882, y: 3.2929 },
    handleIn: { x: 22.1364, y: 0.1384 },
    handleOut: { x: -32.9936, y: -0.2063 },
    handleMode: "smooth",
    semanticRole: "upper_horn_right"
  },
  {
    id: "anchor_1785071325379_cyuab",
    position: { x: 52.0019, y: 71.2004 },
    handleIn: { x: 46.3643, y: -0.0031 },
    handleOut: { x: -23.164, y: 0.0016 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "anchor_1785071314260_gt9ae",
    position: { x: 28.5885, y: 45.3796 },
    handleIn: { x: 0.0459, y: 5.547 },
    handleOut: { x: -0.0816, y: -9.8655 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "t_pocket_right",
    position: { x: 27.78, y: 0 },
    handleIn: { x: 0.4424, y: 4.6073 },
    handleOut: { x: -14.7067, y: 0 },
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
    handleOut: { x: -59.704, y: 0.1498 },
    handleMode: "corner",
    locked: true,
    semanticRole: "neck_pocket_left"
  },
  {
    id: "sc_upper_shoulder",
    position: { x: -119.8466, y: 67.2112 },
    handleIn: { x: 0.948, y: -38.8223 },
    handleOut: { x: -0.9669, y: 39.5971 },
    handleMode: "smooth"
  },
  {
    id: "sc_upper_bout",
    position: { x: -94.0355, y: 153.4528 },
    handleIn: { x: 0.0999, y: -31.0674 },
    handleOut: { x: -0.1197, y: 37.1984 },
    handleMode: "smooth",
    semanticRole: "upper_horn_left"
  },
  {
    id: "sc_lower_bout_left",
    position: { x: -165.8339, y: 297.9389 },
    handleIn: { x: 1.1293, y: -81.1473 },
    handleOut: { x: -1.2527, y: 90.0179 },
    handleMode: "smooth",
    semanticRole: "lower_bout_left"
  },
  {
    id: "sc_tail_center",
    position: { x: -0.609, y: 438.1457 },
    handleIn: { x: -95.721, y: 0.5398 },
    handleOut: { x: 95.721, y: -0.5398 },
    handleMode: "symmetric",
    semanticRole: "tail_center"
  },
  {
    id: "sc_lower_bout_right",
    position: { x: 164.6504, y: 301.4893 },
    handleIn: { x: -0.8324, y: 87.9197 },
    handleOut: { x: 0.8192, y: -86.5376 },
    handleMode: "smooth",
    semanticRole: "lower_bout_right"
  },
  {
    id: "sc_waist_right",
    position: { x: 89.6479, y: 153.1115 },
    handleIn: { x: 1.6284, y: 33.4278 },
    handleOut: { x: -1.1994, y: -24.6205 },
    handleMode: "smooth",
    semanticRole: "waist_right"
  },
  {
    id: "anchor_1785072642913_kdp70",
    position: { x: 116.2537, y: 71.5394 },
    handleIn: { x: -0.4874, y: 29.5886 },
    handleOut: { x: 0.2571, y: -15.6055 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "sc_cutaway_horn_tip",
    position: { x: 103.8841, y: 44.4418 },
    handleIn: { x: 7.7664, y: 0.0917 },
    handleOut: { x: -14.7545, y: -0.1743 },
    handleMode: "smooth",
    semanticRole: "upper_horn_right"
  },
  {
    id: "anchor_1785072576588_chpj8",
    position: { x: 62.4454, y: 71.3843 },
    handleIn: { x: 29.7717, y: -0.5733 },
    handleOut: { x: -17.1738, y: 0.3306 },
    handleMode: "smooth",
    semanticRole: "custom"
  },
  {
    id: "sc_cutaway_inner_scoop",
    position: { x: 28.1075, y: 41.0049 },
    handleIn: { x: 4.6599, y: 23.5215 },
    handleOut: { x: -0.2219, y: -12.9442 },
    handleMode: "corner"
  },
  {
    id: "anchor_1785072512647_iico5",
    position: { x: 27.6156, y: 2.0525 },
    handleIn: { x: 0.7127, y: 18.076 },
    handleOut: { x: -3.3895, y: -0.0185 },
    handleMode: "corner",
    semanticRole: "custom"
  },
  {
    id: "sc_pocket_right",
    position: { x: 19.05, y: 0 },
    handleIn: { x: 2.5888, y: 0 },
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

// 5. Gibson Firebird Blueprint Anchors (drawn from the Single-Cut template)
//
// NOTE: bridge and pickup positions are NOT derived from this outline - see
// getSaddleYMm/getBridgePlateTopYMm in scaleMath.ts and the absolute
// `y={p.offsetYMm}` / `y={bridgeY}` placement in CanvasWorkspace.tsx. They come
// entirely from neckPresetId + bridgePresetId + defaultPickups below, so
// dragging this outline up or down does not move hardware and does not fix
// misalignment - only correcting those fields does.
//
// This models a Firebird-style body with a normal glued/bolted pocket joint
// and standard-size humbuckers - not the real Firebird's neck-through
// construction or mini-humbuckers, which this app doesn't have a distinct
// concept for and would be misleading to claim here.
//
// neckPresetId is 'gibson_firebird_19' (see hardware.ts) because the real
// Firebird's neck joins around fret 19, not fret 16 like the Les Paul/SG
// templates - this outline's horn tip extends above Y=0, so it's safe to use
// that deeper join. nutToBodyEdgeMm there and the tailpiece offset on
// 'tune_o_matic_firebird' are both calibrated to a measured routing template
// rather than left as theoretical fret math, so the TOM post line and
// tailpiece land exactly on the measured 207.5mm/247mm marks.
// defaultPickups.offsetYMm below are likewise measured directly off that
// template (65mm/171mm from the joint line).
export const GIBSON_FIREBIRD_ANCHORS: PathAnchor[] = [
  {
    id: 'sc_pocket_left',
    position: { x: -19.05, y: 0 },
    handleOut: { x: -4.648928571428559, y: 0.5094357142857147 },
    handleMode: 'corner',
    locked: true,
    semanticRole: 'neck_pocket_left',
  },
  {
    id: 'anchor_1785150198769_73vv7',
    position: { x: -28.02765714285715, y: -0.016158928571428532 },
    handleIn: { x: 5.885185714285706, y: 0.2357125000000004 },
    handleOut: { x: -1.9149337541426965, y: 31.76876056150709 },
    handleMode: 'corner',
    semanticRole: 'custom',
  },
  {
    id: 'sc_upper_shoulder',
    position: { x: -72.70374285714287, y: 42.35405714285714 },
    handleIn: { x: 20.473999999999997, y: -7.982578571428576 },
    handleOut: { x: -18.4516035303294, y: 7.194069304957671 },
    handleMode: 'smooth',
  },
  {
    id: 'anchor_1785150194644_a3ifc',
    position: { x: -128.12331785714287, y: 97.24492321428572 },
    handleIn: { x: 2.122118259281466, y: -38.45013044906603 },
    handleOut: { x: -0.9939925805548943, y: 18.00990318073988 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'anchor_1785150339995_gfwa3',
    position: { x: -108.37760068541617, y: 164.42400863555488 },
    handleIn: { x: -12.649860939463204, y: -25.319075997189927 },
    handleOut: { x: 12.205267787995856, y: 24.429209472672255 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'sc_upper_bout',
    position: { x: -91.74978571428572, y: 234.8813714285714 },
    handleIn: { x: 0.04920262374600481, y: -18.205126675888454 },
    handleOut: { x: -0.03788584977046737, y: 14.017884449730023 },
    handleMode: 'smooth',
    semanticRole: 'upper_horn_left',
  },
  {
    id: 'anchor_1785150335918_z6bkx',
    position: { x: -115.68248403018501, y: 315.9218829801547 },
    handleIn: { x: 12.848255099347398, y: -25.554232001874976 },
    handleOut: { x: -9.907943501048862, y: 19.7061690423731 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'sc_lower_bout_left',
    position: { x: -157.26247142857142, y: 422.22461428571427 },
    handleIn: { x: 0.9136254009138481, y: -24.23058403713003 },
    handleOut: { x: -0.5502004663469506, y: 14.592062155619544 },
    handleMode: 'smooth',
    semanticRole: 'lower_bout_left',
  },
  {
    id: 'anchor_1785150459628_f8ln7',
    position: { x: -125.27947534976019, y: 468.26020018814324 },
    handleIn: { x: -27.422378002360222, y: -8.696163276060497 },
    handleOut: { x: 31.442935830872443, y: 9.97115946109508 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'sc_tail_center',
    position: { x: -0.32328571428570285, y: 449.8599857142857 },
    handleIn: { x: -45.43192857142857, y: 13.127042857142897 },
    handleOut: { x: 45.43192857142857, y: -13.127042857142897 },
    handleMode: 'symmetric',
    semanticRole: 'tail_center',
  },
  {
    id: 'anchor_1785150454968_l105k',
    position: { x: 108.49678214285713, y: 410.22781964285707 },
    handleIn: { x: -34.731967243382314, y: 14.192155459653973 },
    handleOut: { x: 52.35281785714288, y: -21.392376785714273 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'sc_lower_bout_right',
    position: { x: 175.22182857142857, y: 350.6321571428571 },
    handleIn: { x: 1.959578622297858, y: 24.144613365412418 },
    handleOut: { x: -1.634529000641383, y: -20.13956995956726 },
    handleMode: 'smooth',
    semanticRole: 'lower_bout_right',
  },
  {
    id: 'anchor_1785150540415_k3wo9',
    position: { x: 150.85374450346646, y: 286.1146993913961 },
    handleIn: { x: 7.845216062749524, y: 20.773759895972557 },
    handleOut: { x: -10.805708906199666, y: -28.613004476576766 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'sc_waist_right',
    position: { x: 131.6479, y: 203.96864285714287 },
    handleIn: { x: 0.525588367820535, y: 41.880736012171965 },
    handleOut: { x: -0.3121875278548032, y: -24.876203966606813 },
    handleMode: 'smooth',
    semanticRole: 'waist_right',
  },
  {
    id: 'anchor_1785150536261_k9hlq',
    position: { x: 158.42539285714287, y: 100.04563035714285 },
    handleIn: { x: -9.009695529319973, y: 27.07300046420081 },
    handleOut: { x: 15.204735714285723, y: -45.68831607142858 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'anchor_1785072642913_kdp70',
    position: { x: 176.8251285714286, y: 9.5394 },
    handleIn: { x: 2.4239829857785904, y: 25.099033977901197 },
    handleOut: { x: -2.1890491428239978, y: -22.666420984546285 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'sc_cutaway_horn_tip',
    position: { x: 141.59838571428574, y: -18.986771428571437 },
    handleIn: { x: 12.327433318836164, y: -0.9177714286027879 },
    handleOut: { x: -35.298642753670656, y: 2.627966824065067 },
    handleMode: 'smooth',
    semanticRole: 'upper_horn_right',
  },
  {
    id: 'anchor_1785072576588_chpj8',
    position: { x: 65.30254285714285, y: 41.09858571428572 },
    handleIn: { x: 29.76976869439527, y: -0.3391110060880747 },
    handleOut: { x: -25.176981738191834, y: 0.28679401896416884 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'anchor_1785072512647_iico5',
    position: { x: 27.90131428571429, y: 0.90964285714285 },
    handleIn: { x: 0.4269857142857063, y: 22.361714285714292 },
    handleOut: { x: -1.9154205729166698, y: -0.010454427083333329 },
    handleMode: 'corner',
    semanticRole: 'custom',
  },
  {
    id: 'sc_pocket_right',
    position: { x: 19.05, y: 0 },
    handleIn: { x: 1.1258583333333334, y: 0 },
    handleMode: 'smooth',
    locked: true,
    semanticRole: 'neck_pocket_right',
  },
];

// 6. Thunderbird Blueprint Anchors (drawn from the Double-Cut SG template;
// inspired by the Gretsch Billy-Bo Jupiter Thunderbird body shape)
//
// See the note on GIBSON_FIREBIRD_ANCHORS above - hardware here is likewise
// independent of this outline. neckPresetId 'gretsch_thunderbird_22' and
// defaultPickups.offsetYMm below apply the deltas specified for this
// template on top of the sg_style/single_cut baseline (neck pickup 90mm,
// bridge pickup 205mm, saddle line 252.45mm): neck pickup +17mm toward the
// tail, bridge pickup -14mm toward the neck, bridge -5mm toward the neck.
export const THUNDERBIRD_ANCHORS: PathAnchor[] = [
  {
    id: 'sg_pocket_left',
    position: { x: -19.05, y: 0 },
    handleMode: 'corner',
    locked: true,
    semanticRole: 'neck_pocket_left',
    handleIn: { x: 20.2742, y: 0.0424 },
  },
  {
    id: 'anchor_1785159099149_9137v',
    position: { x: -23.74853977599407, y: 0.04823309043648494 },
    handleOut: { x: 0.6595344817638339, y: 20.41577263766362 },
    handleMode: 'corner',
    semanticRole: 'custom',
  },
  {
    id: 'sg_horn_scoop_left',
    position: { x: -49.184523923747186, y: 37.29084082465402 },
    handleIn: { x: 17.701699267385234, y: 0.3536295571217764 },
    handleOut: { x: -26.802009977410567, y: -0.5354278578073003 },
    handleMode: 'smooth',
  },
  {
    id: 'sg_upper_horn_tip_left',
    position: { x: -113.28807814515434, y: 0.925849327090744 },
    handleIn: { x: 18.850107856693562, y: 0.11206823074333475 },
    handleOut: { x: -18.15483224258522, y: -0.10793465715614495 },
    handleMode: 'smooth',
    semanticRole: 'upper_horn_left',
  },
  {
    id: 'sg_upper_bout_outer_left',
    position: { x: -137.24211733205152, y: 72.81577940596034 },
    handleIn: { x: -0.3298554871018146, y: -36.25287063459073 },
    handleOut: { x: 0.5790424014799912, y: 63.63983651518705 },
    handleMode: 'smooth',
  },
  {
    id: 'sg_waist_left',
    position: { x: -112.6394035610075, y: 232.6444728475294 },
    handleIn: { x: 0.9383067041035642, y: -35.34288585456822 },
    handleOut: { x: -0.8571428571428409, y: 32.285714285714256 },
    handleMode: 'smooth',
    semanticRole: 'waist_left',
  },
  {
    id: 'sg_lower_bout_left',
    position: { x: -135.48664285714287, y: 360.75201428571427 },
    handleIn: { x: 11.53068571428571, y: -48.69082857142855 },
    handleOut: { x: -12.646361739236875, y: 53.40201326748243 },
    handleMode: 'smooth',
    semanticRole: 'lower_bout_left',
  },
  {
    id: 'sg_lower_bout_bottom_left',
    position: { x: -143.17532857142857, y: 506.12067142857137 },
    handleIn: { x: -5.089395190615148, y: -40.9562139682148 },
    handleOut: { x: 2.974665388225527, y: 23.938214180864556 },
    handleMode: 'smooth',
  },
  {
    id: 'anchor_1785159562141_5exmr',
    position: { x: -118.77811018397225, y: 522.5853967884229 },
    handleIn: { x: -5.962660729820933, y: 5.548652744948803 },
    handleMode: 'corner',
    semanticRole: 'custom',
  },
  {
    id: 'anchor_1785159546339_vbj57',
    position: { x: -38.74881423507772, y: 454.3276331793568 },
    handleMode: 'corner',
    semanticRole: 'custom',
  },
  {
    id: 'sg_tail_center',
    position: { x: -31.080299999999998, y: 462.21758571428575 },
    handleMode: 'corner',
    semanticRole: 'tail_center',
  },
  {
    id: 'anchor_1785159484895_o4sfm',
    position: { x: 31.30419752686922, y: 461.1684811046613 },
    handleOut: { x: 5.9744614355931684, y: -14.995097216209226 },
    handleMode: 'corner',
    semanticRole: 'custom',
  },
  {
    id: 'sg_lower_bout_bottom_right',
    position: { x: 64.10474285714288, y: 436.0747857142857 },
    handleIn: { x: -13.043003069967654, y: 0.03636744379634495 },
    handleOut: { x: 17.95077833833603, y: -0.05005165749161331 },
    handleMode: 'smooth',
  },
  {
    id: 'anchor_1785159458378_219yx',
    position: { x: 125.60802571808871, y: 461.99531746075763 },
    handleIn: { x: -17.42831707887615, y: 0.6076334016817078 },
    handleOut: { x: 23.2698853066972, y: -0.8112980445363454 },
    handleMode: 'smooth',
    semanticRole: 'custom',
  },
  {
    id: 'sg_lower_bout_right',
    position: { x: 150.44368571428572, y: 408.71962857142853 },
    handleIn: { x: 1.2258874889306688, y: 35.20242052891126 },
    handleOut: { x: -1.8176434114086961, y: -52.19520414212543 },
    handleMode: 'smooth',
    semanticRole: 'lower_bout_right',
  },
  {
    id: 'sg_waist_right',
    position: { x: 104.10645714285712, y: 246.39785714285713 },
    handleIn: { x: 0.3210753002862085, y: 39.873603044178644 },
    handleOut: { x: -0.28579789891254986, y: -35.492583708373175 },
    handleMode: 'smooth',
    semanticRole: 'waist_right',
  },
  {
    id: 'sg_upper_bout_outer_right',
    position: { x: 121.17125714285716, y: 143.50204285714287 },
    handleIn: { x: -0.755996659482402, y: 51.59518749160907 },
    handleOut: { x: 0.3585551337719433, y: -24.47063637253151 },
    handleMode: 'smooth',
  },
  {
    id: 'sg_upper_horn_tip_right',
    position: { x: 108.90784285714287, y: 113.97634285714285 },
    handleIn: { x: 6.689571428571428, y: 6.603757142857148 },
    handleMode: 'corner',
    semanticRole: 'upper_horn_right',
  },
  {
    id: 'sg_horn_scoop_right',
    position: { x: 34.18535714285713, y: 63.98407142857143 },
    handleOut: { x: -6.1350581101190595, y: -4.570495758928579 },
    handleMode: 'corner',
  },
  {
    id: 'anchor_1785159351159_m5dfw',
    position: { x: 25.292452455121747, y: 48.421535551458746 },
    handleIn: { x: 0.8507857048160723, y: 6.567922123416075 },
    handleMode: 'corner',
    semanticRole: 'custom',
  },
  {
    id: 'anchor_1785159199674_5bk98',
    position: { x: 25.542530127170597, y: 0.5336235975857393 },
    handleMode: 'corner',
    semanticRole: 'custom',
  },
  {
    id: 'sg_pocket_right',
    position: { x: 19.05, y: 0 },
    handleMode: 'corner',
    locked: true,
    semanticRole: 'neck_pocket_right',
    handleOut: { x: -20.2697, y: -0.431 },
  },
];

export const REFERENCE_TEMPLATES: Record<string, ReferenceTemplate> = {
  single_cut: {
    id: 'single_cut',
    name: 'Single-Cut Vintage',
    description: 'Classic single-cut Mahogany body with dual humbuckers and Tune-O-Matic bridge.',
    category: 'Single-Cut',
    tier: 'reference',
    neckPresetId: 'gibson_lp_22',
    bridgePresetId: 'tune_o_matic',
    defaultAnchors: SINGLE_CUT_ANCHORS,
    defaultPickups: [
      // Neck pickup on the 24th-fret node; bridge pickup 44.5mm ahead of the saddle line
      { id: 'p_neck', type: 'humbucker', offsetYMm: 90, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
      { id: 'p_bridge', type: 'humbucker', offsetYMm: 205, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
    ],
  },
  sg_style: {
    id: 'sg_style',
    name: 'Double-Cut SG Vintage',
    description: 'Symmetric double-cutaway Vintage SG body (Gibson/Yamaha style) with bevel contours.',
    category: 'Double-Cut',
    tier: 'reference',
    neckPresetId: 'gibson_sg_22',
    bridgePresetId: 'tune_o_matic',
    defaultAnchors: SG_STYLE_ANCHORS,
    defaultPickups: [
      // Same positions as the Single-Cut - both are 24.75" Gibsons on a fret-16 joint line
      { id: 'p_neck', type: 'humbucker', offsetYMm: 90, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
      { id: 'p_bridge', type: 'humbucker', offsetYMm: 205, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
    ],
  },
  s_style: {
    id: 's_style',
    name: 'S-Style Standard',
    description: 'Double cutaway body with contoured waist and upper horns.',
    category: 'S-Style',
    tier: 'reference',
    neckPresetId: 'fender_strat_21',
    bridgePresetId: 'tremolo_strat',
    defaultAnchors: S_STYLE_ANCHORS,
    defaultPickups: [
      // 6-3/8", 3-7/8" and 1-5/8" ahead of the saddle line; the neck pickup lands on the 24th-fret node
      { id: 'p_neck', type: 'single_coil', offsetYMm: 95, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 18 },
      { id: 'p_middle', type: 'single_coil', offsetYMm: 159, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 18 },
      { id: 'p_bridge', type: 'single_coil', offsetYMm: 216, offsetXMm: 0, angleDegrees: 10, widthMm: 70, heightMm: 18 },
    ],
  },
  t_style: {
    id: 't_style',
    name: 'T-Style Standard',
    description: 'Single cutaway solid body with flat edge profile and classic bridge plate.',
    category: 'T-Style',
    tier: 'reference',
    neckPresetId: 'fender_tele_22',
    bridgePresetId: 'tele_bridge_plate',
    defaultAnchors: T_STYLE_ANCHORS,
    defaultPickups: [
      { id: 'p_neck', type: 'tele_neck', offsetYMm: 95, offsetXMm: 0, angleDegrees: 0, widthMm: 65, heightMm: 15 },
      { id: 'p_bridge', type: 'tele_bridge', offsetYMm: 222, offsetXMm: 0, angleDegrees: 11, widthMm: 73, heightMm: 20 },
    ],
  },
  gibson_firebird: {
    id: 'gibson_firebird',
    name: 'Firebird-Style',
    description: 'Firebird-style body with a fret-19 pocket joint, Tune-O-Matic bridge, and standard humbuckers, positioned from a real routing template.',
    category: 'Firebird',
    tier: 'extra',
    neckPresetId: 'gibson_firebird_19',
    bridgePresetId: 'tune_o_matic_firebird',
    defaultAnchors: GIBSON_FIREBIRD_ANCHORS,
    defaultPickups: [
      // Measured from the joint line (Y=0) on a real routing template
      { id: 'p_neck', type: 'humbucker', offsetYMm: 65, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
      { id: 'p_bridge', type: 'humbucker', offsetYMm: 171, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
    ],
  },
  gretsch_thunderbird: {
    id: 'gretsch_thunderbird',
    name: 'Thunderbird',
    description: 'Single-cutaway body inspired by the Gretsch Billy-Bo Jupiter Thunderbird, with a Tune-O-Matic bridge and standard humbuckers.',
    category: 'Thunderbird',
    tier: 'extra',
    neckPresetId: 'gretsch_thunderbird_22',
    bridgePresetId: 'tune_o_matic',
    defaultAnchors: THUNDERBIRD_ANCHORS,
    defaultPickups: [
      // sg_style baseline (90mm/205mm) shifted per spec: neck +17mm toward the tail, bridge -14mm toward the neck
      { id: 'p_neck', type: 'humbucker', offsetYMm: 107, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
      { id: 'p_bridge', type: 'humbucker', offsetYMm: 191, offsetXMm: 0, angleDegrees: 0, widthMm: 70, heightMm: 38 },
    ],
  },
};
