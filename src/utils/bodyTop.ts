import type { BodyTop, BodyTopConstruction } from '../types/guitar';

/**
 * The editor presents one Arched Top edge treatment, while the preview keeps
 * its two construction profiles private. A single-cut receives the taller
 * carved-cap profile; every other outline uses the shallow solid-body carve.
 */
export function archedTopConstructionForTemplate(templateId: string | undefined): BodyTopConstruction {
  return templateId === 'single_cut' ? 'carved_cap' : 'solid_body_carve';
}

/** New Single-Cut projects begin with the established carved-cap treatment. */
export function defaultBodyTopForTemplate(templateId: string, authored?: BodyTop): BodyTop | undefined {
  return authored ?? (templateId === 'single_cut' ? { construction: 'carved_cap' } : undefined);
}

export function isArchedTop(construction: string | undefined): construction is BodyTopConstruction {
  return construction === 'carved_cap' || construction === 'solid_body_carve';
}
