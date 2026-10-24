import type { SharedProjectEnvelope, SharingErrorCode } from './sharingContract';
import { minimumIpadVersion } from './deployment';

/**
 * Server-rendered `/share/:id` page: real HTML that works without JavaScript,
 * with social metadata for link previews. Pure, so it runs in the Function
 * and in unit tests alike.
 *
 * Release A uses the generic site card for every share (plan section 7); a
 * per-design image is Release B. Unlisted shares are `noindex` - a discovery
 * hint, not confidentiality.
 */
export interface LandingPage { status: number; html: string; headers: Record<string, string> }

const MAX_TITLE = 120;
const CARD = { path: '/brand/axe-shaper-marketing-2x1.jpg', width: 1200, height: 593 };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);
}
function bounded(value: string, max: number): string {
  const characters = Array.from(value.replace(/\s+/g, ' ').trim());
  return characters.length > max ? `${characters.slice(0, max - 1).join('')}…` : characters.join('');
}

function headers(cacheControl: string): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': cacheControl,
    // No scripts, frames or third-party anything: the page is static HTML.
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
  };
}

const STYLE = `
:root{color-scheme:dark;--bg:#0f1117;--panel:#161922;--border:rgba(255,255,255,.08);--text:#f0f4f8;--muted:#94a3b8;--gold:#d1a53d;--blue:#38bdf8}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--text);font:16px/1.5 Inter,system-ui,-apple-system,sans-serif}
main{width:min(100%,560px);background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:28px}
.brand{margin:0 0 20px;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--gold)}
.brand a{color:inherit;text-decoration:none}
h1{margin:0 0 6px;font-size:1.5rem;line-height:1.25;overflow-wrap:anywhere}
.meta{margin:0 0 24px;color:var(--muted);font-size:.9rem}
.actions{display:grid;gap:10px}
.actions a{display:block;padding:12px 16px;border-radius:10px;border:1px solid var(--border);color:var(--text);text-decoration:none;font-weight:600}
.actions a span{display:block;font-weight:400;font-size:.85rem;color:var(--muted)}
.actions a.primary{background:#2563eb;border-color:#2563eb}
.actions a.primary span{color:#dbeafe}
.actions a:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.note{margin:22px 0 0;color:var(--muted);font-size:.82rem}
`;

function page(origin: string, status: number, cacheControl: string, title: string, description: string,
  canonicalPath: string | null, body: string): LandingPage {
  const canonical = canonicalPath ? `${origin}${canonicalPath}` : null;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="same-origin">
<title>${escapeHtml(title)} — Axe Shaper</title>
<meta name="description" content="${escapeHtml(description)}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
` : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="Axe Shaper">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(origin + CARD.path)}">
<meta property="og:image:width" content="${CARD.width}">
<meta property="og:image:height" content="${CARD.height}">
<meta property="og:image:alt" content="Axe Shaper — true-scale guitar and bass body designer">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(origin + CARD.path)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${STYLE}</style>
</head>
<body>
<main>
<p class="brand"><a href="/">Axe Shaper</a></p>
${body}
</main>
</body>
</html>
`;
  return { status, html, headers: headers(cacheControl) };
}

function describe(envelope: SharedProjectEnvelope): string {
  const { instrumentType, stringCount } = envelope.project;
  const instrument = instrumentType === 'bass' ? 'Bass' : 'Electric guitar';
  return `${instrument} body design, ${stringCount} strings, shared from Axe Shaper. View it in 3D, download it, or open an editable copy.`;
}

/** The page for an active share. `origin` is the configured public origin, never a request Host header. */
export function renderShareLandingPage(envelope: SharedProjectEnvelope, origin: string): LandingPage {
  const id = envelope.id;
  const title = bounded(envelope.project.settings?.name || 'Untitled design', MAX_TITLE);
  const author = bounded(envelope.project.metadata?.author ?? '', 80);
  const { instrumentType, stringCount } = envelope.project;
  const created = envelope.createdAt.slice(0, 10);
  const minimumIpad = minimumIpadVersion(envelope.requirements.projectSchema);
  const meta = [
    `${instrumentType === 'bass' ? 'Bass' : 'Guitar'} · ${stringCount}-string`,
    author ? `by ${author}` : null,
    `shared ${created}`,
  ].filter(Boolean).join(' · ');
  const body = `<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(meta)}</p>
<nav class="actions" aria-label="What to do with this design">
<a class="primary" href="/share/${id}/3d">View in 3D<span>Look around the body in the 3D viewer.</span></a>
<a href="/app/share/${id}">Open editable copy<span>Edit your own copy in the editor. The original does not change.</span></a>
<a href="/download/share/${id}">Download project<span>Save the .axe.svg file - a true-scale, printable plan that reopens in Axe Shaper.</span></a>
</nav>
<p class="note">${minimumIpad ? `To edit the downloaded project on iPad, use Axe Shaper ${escapeHtml(minimumIpad)} or later.` : 'iPad editing support for this design has not been confirmed.'}</p>
<p class="note">Anyone with this link can see this design. The editor and 3D viewer need JavaScript.</p>`;
  // Five minutes: a revoked share can stay visible in caches this long (plan, "Social page and caching").
  return page(origin, 200, 'public, max-age=300, s-maxage=300', title, describe(envelope), `/share/${id}`, body);
}

const ERRORS: Partial<Record<SharingErrorCode, { status: number; heading: string; text: string; cache: string }>> = {
  revoked: { status: 410, heading: 'This design is no longer shared',
    text: 'The person who shared it has removed the link.', cache: 'public, max-age=60, s-maxage=60' },
  'not-found': { status: 404, heading: 'No design at this link',
    text: 'Check that the link was copied completely.', cache: 'public, max-age=60, s-maxage=60' },
  'invalid-id': { status: 404, heading: 'No design at this link',
    text: 'Check that the link was copied completely.', cache: 'public, max-age=60, s-maxage=60' },
};

/** A share that cannot be shown. Busy or failing storage is "try again", never "not found". */
export function renderShareErrorPage(code: SharingErrorCode, origin: string): LandingPage {
  const known = ERRORS[code] ?? { status: code === 'quota-exceeded' ? 429 : 503, heading: 'This design cannot be shown right now',
    text: 'Try again in a moment.', cache: 'no-store' };
  const body = `<h1>${escapeHtml(known.heading)}</h1>
<p class="meta">${escapeHtml(known.text)}</p>
<nav class="actions"><a href="/app">Start your own design<span>Open the Axe Shaper editor.</span></a></nav>`;
  return page(origin, known.status, known.cache, known.heading, known.text, null, body);
}
