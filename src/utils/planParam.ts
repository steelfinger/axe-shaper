/**
 * The plan for `/app?plan=...` to open on load, from a location's search
 * string, or null.
 *
 * Deliberately restricted to a same-origin absolute path. This fetches
 * whatever it points at and loads it as the project, so allowing an off-site
 * URL would let a crafted link drop arbitrary content into someone's editor.
 * "/marketing/x.axe.svg" passes; "//host/x" and "https://host/x" do not.
 */
export function planParamFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('plan');
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}
