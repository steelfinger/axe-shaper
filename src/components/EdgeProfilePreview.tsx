import React from 'react';
import type { EdgeProfile } from '../types/guitar';
import { BEVEL_INTENSITY_MAX } from '../constants/edgeProfiles';
import { variableInsetWidthMm } from '../utils/bevelIntensity';
import { formatLength, unitLabel, type UnitDisplay } from '../utils/units';

/**
 * How far down the section is drawn. A project carries no body thickness, so
 * the cut is simply clipped here rather than inventing one - everything above
 * this line is real geometry, and nothing below it is claimed.
 */
const SECTION_DEPTH_MM = 22;

/** Flat top face shown inboard of the treatment, and air outside the edge. */
const BODY_MARGIN_MM = 12;
const OUTSIDE_MARGIN_MM = 4;

const DEFAULT_BEVEL_ANGLE_DEGREES = 45;

interface EdgeProfilePreviewProps {
  profile: EdgeProfile | undefined;
  /** The selected node's bevel intensity - a multiplier on the profile's width. */
  intensity: number;
  unitDisplay: UnitDisplay;
}

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * A cross-section through the edge at the selected node, in true proportion.
 *
 * The horizontal scale is pinned to the widest the profile can reach - its
 * base width at BEVEL_INTENSITY_MAX - so the cut visibly grows and shrinks
 * with the slider instead of the drawing rescaling to hide the change.
 */
export const EdgeProfilePreview: React.FC<EdgeProfilePreviewProps> = ({
  profile,
  intensity,
  unitDisplay,
}) => {
  const baseWidthMm = variableInsetWidthMm(profile);
  if (!profile || baseWidthMm === null || baseWidthMm <= 0) return null;

  const maxReachMm = baseWidthMm * BEVEL_INTENSITY_MAX;
  const reachMm = baseWidthMm * intensity;
  const innerX = -(maxReachMm + BODY_MARGIN_MM);

  // The top face, walked from deep inside the body out to the edge at x = 0.
  // y grows downward from the top face, matching the plan's own convention.
  const topFace: string[] = [`M ${innerX} 0`];
  let sideTopY = 0;
  let caption: string;

  if (profile.kind === 'german_carve') {
    // Read from the three numbers the format carries: a flat lip at the rim,
    // then a channel of `channelRadiusMm` scooped `dropMm` deep. Intensity
    // scales the two widths, not the depth - it multiplies the edge width.
    const insetMm = Math.max(numberOr(profile.insetMm, 0), 0) * intensity;
    const channelMm = Math.max(numberOr(profile.channelRadiusMm, 0), 0) * intensity;
    const dropMm = Math.max(numberOr(profile.dropMm, 0), 0);
    const channelStart = -(insetMm + channelMm);

    topFace.push(`L ${channelStart} 0`);
    if (channelMm > 0 && dropMm > 0) {
      // Quadratic control sits at twice the depth: the curve peaks at dropMm.
      topFace.push(`Q ${channelStart + channelMm / 2} ${dropMm * 2} ${-insetMm} 0`);
    }
    topFace.push('L 0 0');
    caption = `${formatLength(numberOr(profile.insetMm, 0) + numberOr(profile.channelRadiusMm, 0), unitDisplay, 1)} ${unitLabel(unitDisplay)} carve, ${formatLength(reachMm, unitDisplay, 1)} ${unitLabel(unitDisplay)} here`;
  } else {
    // Beveled: a chamfer running `reachMm` inward, falling at the profile's
    // own angle. Steep or wide enough and it leaves the bottom of the view,
    // so the face is cut where it crosses instead of overshooting the box.
    const angle = numberOr(profile.angleDegrees, DEFAULT_BEVEL_ANGLE_DEGREES);
    const dropMm = reachMm * Math.tan((angle * Math.PI) / 180);
    topFace.push(`L ${-reachMm} 0`);
    if (dropMm > SECTION_DEPTH_MM) {
      const crossX = -reachMm * (1 - SECTION_DEPTH_MM / dropMm);
      topFace.push(`L ${crossX} ${SECTION_DEPTH_MM}`);
      sideTopY = SECTION_DEPTH_MM;
    } else {
      topFace.push(`L 0 ${dropMm}`);
      sideTopY = dropMm;
    }
    caption = `${formatLength(baseWidthMm, unitDisplay, 1)} ${unitLabel(unitDisplay)} bevel at ${angle.toFixed(0)}°, ${formatLength(reachMm, unitDisplay, 1)} ${unitLabel(unitDisplay)} here`;
  }

  // Close the section: down the outer side, along the cut, and back up.
  const material = [
    ...topFace,
    `L 0 ${SECTION_DEPTH_MM}`,
    `L ${innerX} ${SECTION_DEPTH_MM}`,
    'Z',
  ].join(' ');
  const treatedFace = topFace.join(' ');

  const alsoOnBack = typeof profile.appliesTo === 'string' && profile.appliesTo.includes('back');

  return (
    <div style={{ marginTop: '8px' }}>
      <svg
        viewBox={`${innerX} -3 ${-innerX + OUTSIDE_MARGIN_MM} ${SECTION_DEPTH_MM + 3}`}
        style={{
          width: '100%',
          display: 'block',
          background: 'var(--bg-primary)',
          border: '1px solid var(--panel-border)',
          borderRadius: 'var(--radius-sm)',
        }}
        role="img"
        aria-label={`Edge cross-section: ${caption}`}
      >
        <path d={material} fill="var(--bg-tertiary)" stroke="none" />
        {/* Where the top face stops - the same boundary the plan draws dashed. */}
        {reachMm > 0 && (
          <line
            x1={-reachMm}
            y1={-3}
            x2={-reachMm}
            y2={SECTION_DEPTH_MM}
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={treatedFace}
          fill="none"
          stroke="var(--accent-gold)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* The outer side, below where the treatment lets go of it. */}
        <line
          x1={0}
          y1={sideTopY}
          x2={0}
          y2={SECTION_DEPTH_MM}
          stroke="var(--text-secondary)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
        {caption}
        {alsoOnBack && ' - cut on the back too'}
      </p>
    </div>
  );
};
