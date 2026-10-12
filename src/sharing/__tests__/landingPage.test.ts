import { describe, expect, it } from 'vitest';
import requestFixture from '../../../tests/fixtures/sharing/creation-v1.json';
import { renderShareErrorPage, renderShareLandingPage } from '../landingPage';
import type { SharedProjectEnvelope } from '../sharingContract';

const origin = 'https://axe-shaper-staging.web.app';
const id = 'mNYiSR2ND7TWcLMTkYk4';
function envelope(overrides: { name?: string; author?: string } = {}): SharedProjectEnvelope {
  const project = structuredClone(requestFixture.project);
  if (overrides.name !== undefined) project.settings.name = overrides.name;
  if (overrides.author !== undefined) project.metadata.author = overrides.author;
  return { shareFormatVersion: 1, id, createdAt: '2026-10-12T15:15:25.125Z', uploadPolicyRevision: 'project-upload-v2',
    digestCanonicalization: 'rfc8785', projectDigest: requestFixture.projectDigest as `sha256:${string}`,
    project: project as unknown as SharedProjectEnvelope['project'],
    requirements: { projectSchema: project.schemaVersion, supportManifest: '/sharing/releases/v1.2.0.json' },
    preview: { kind: 'generic' } };
}

describe('share landing page', () => {
  it('serves real HTML with the three actions as plain links and cacheable for five minutes', () => {
    const page = renderShareLandingPage(envelope({ name: 'Sunburst Strat' }), origin);
    expect(page.status).toBe(200);
    expect(page.headers['Cache-Control']).toBe('public, max-age=300, s-maxage=300');
    expect(page.html).toContain('<h1>Sunburst Strat</h1>');
    expect(page.html).toContain(`href="/share/${id}/3d"`);
    expect(page.html).toContain(`href="/app/share/${id}"`);
    expect(page.html).toContain(`href="/download/share/${id}"`);
    expect(page.html).not.toMatch(/<script/i);
  });

  it('carries social metadata with the configured origin, and asks not to be indexed', () => {
    const page = renderShareLandingPage(envelope({ name: 'Sunburst Strat' }), origin);
    expect(page.html).toContain(`<meta property="og:url" content="${origin}/share/${id}">`);
    expect(page.html).toContain(`<link rel="canonical" href="${origin}/share/${id}">`);
    expect(page.html).toContain(`<meta property="og:image" content="${origin}/brand/axe-shaper-marketing-2x1.jpg">`);
    expect(page.html).toContain('<meta property="og:title" content="Sunburst Strat">');
    expect(page.html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(page.html).toContain('<meta name="robots" content="noindex">');
    expect(page.headers['X-Robots-Tag']).toBe('noindex');
    expect(page.headers['Content-Security-Policy']).toContain("default-src 'none'");
  });

  it('escapes and bounds the design name and author everywhere they appear', () => {
    const name = '"><script>alert(1)</script>' + 'x'.repeat(300);
    const page = renderShareLandingPage(envelope({ name, author: '<img src=x onerror=alert(1)>' }), origin);
    expect(page.html).not.toContain('<script>alert');
    expect(page.html).not.toContain('<img src=x');
    expect(page.html).toContain('&#34;&#62;&#60;script&#62;');
    const heading = /<h1>(.*)<\/h1>/.exec(page.html)![1];
    expect(heading.length).toBeLessThan(200);
    expect(heading.endsWith('…')).toBe(true);
  });

  it('says removed for revoked, not found for unknown, and try again - never not found - when busy', () => {
    expect(renderShareErrorPage('revoked', origin).status).toBe(410);
    expect(renderShareErrorPage('revoked', origin).html).toContain('no longer shared');
    expect(renderShareErrorPage('not-found', origin).status).toBe(404);
    const busy = renderShareErrorPage('unavailable', origin);
    expect(busy.status).toBe(503);
    expect(busy.headers['Cache-Control']).toBe('no-store');
    expect(busy.html).not.toContain('No design at this link');
    expect(renderShareErrorPage('quota-exceeded', origin).status).toBe(429);
  });
});
