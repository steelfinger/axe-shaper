/**
 * The default project name derived from a blueprint or user template.
 *
 * Guitar blueprints historically carry bare names such as "S-Style Standard",
 * while bass blueprints already carry complete names such as
 * "Custom P-Style Bass Blueprint". Treating every template name as bare made
 * the latter become "Custom Custom ...". Keep the web convention for bare
 * names, but make applying it idempotent for names that already start with the
 * standalone word "Custom".
 */
export function projectNameFromTemplate(templateName: string): string {
  const normalizedName = templateName.trim();
  if (!normalizedName || /^custom(?:\s|$)/i.test(normalizedName)) {
    return normalizedName || 'Custom';
  }
  return `Custom ${normalizedName}`;
}
