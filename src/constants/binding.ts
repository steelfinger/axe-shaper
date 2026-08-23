import type { BindingParams } from '../types/guitar';

/**
 * A thin trim strip glued around the body's edge (the classic Les Paul
 * detail) - the 3D-preview-only counterpart to `constants/edgeProfiles.ts`.
 * Width, height, and color are fixed builder constants on the native/3D
 * side, not wire data; the only user-facing choice is on/off and which
 * face(s) it runs along, reusing `appliesTo`'s existing `top_and_back`
 * wire vocabulary from `EdgeProfile.appliesTo` (see beveled's default
 * below) rather than inventing a second one that means the same thing.
 */
export type BindingKind = 'none' | 'top_only' | 'top_and_back';

export const BINDING_KINDS: Exclude<BindingKind, 'none'>[] = ['top_only', 'top_and_back'];

export const BINDING_LABELS: Record<BindingKind, string> = {
  none: 'None',
  top_only: 'Top Only',
  top_and_back: 'Top and Back',
};

/** An absent binding means off. A present-but-unrecognized `appliesTo` (a
 *  cross-app or future value this build has never heard of) reads as
 *  'none' too, rather than being forced into one of the two known choices. */
export function bindingKindOf(binding: BindingParams | undefined): BindingKind {
  if (!binding) return 'none';
  return binding.appliesTo === 'top_only' || binding.appliesTo === 'top_and_back' ? binding.appliesTo : 'none';
}

export function bindingParamsFor(kind: BindingKind): BindingParams | undefined {
  return kind === 'none' ? undefined : { appliesTo: kind };
}
