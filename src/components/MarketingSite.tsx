import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Download,
  Code2,
  Link2,
  Mail,
  PenLine,
  Printer,
  Ruler,
  ShieldCheck,
} from 'lucide-react';
/**
 * A real project saved out of the editor - a custom S-style body rather than
 * one of the built-in reference blueprints, so the hero shows what someone
 * makes with this rather than what ships in the box.
 *
 * Two files, because the screen and the printer want opposite things. The
 * download is the plan at its true print weights, thin enough to cut to
 * accurately. The display copy is the same geometry with heavier strokes, so
 * it survives being scaled into the hero. See scripts/build-marketing-plan.ts.
 */
const PLAN_PRINT_URL = '/marketing/custom-s-style-plan.axe.svg';
const PLAN_DISPLAY_URL = '/marketing/custom-s-style-plan-display.svg';

const GITHUB_URL = 'https://github.com/steelfinger/axe-shaper';
const IPAD_EMAIL = 'steelfinger@steelfinger.fi';
const IPAD_MAILTO = `mailto:${IPAD_EMAIL}?subject=Axe%20Shaper%20for%20iPad%20updates&body=Please%20let%20me%20know%20when%20Axe%20Shaper%20for%20iPad%20is%20available.`;

/** Every off-site link opens in a new tab so the page is never lost mid-evaluation. */
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

function Brand(): React.JSX.Element {
  return (
    <a className="marketing-brand" href="/" aria-label="Axe Shaper home">
      <img src="/brand/axe-shaper-mark.png" alt="" aria-hidden="true" width={28} height={28} />
      <span>Axe Shaper</span>
    </a>
  );
}

/**
 * Runs the swing-in once, then swaps to the idle sway class on that
 * animation's `animationend` rather than letting a delayed second CSS
 * animation pick up where it left off. The two-animation-with-delay version
 * matched at every value we sampled, but real playback still showed a
 * handoff hiccup - starting the sway fresh, only once the entrance is fully
 * gone from the element, avoids relying on the browser to hand off two
 * concurrent animations on the same property cleanly.
 */
function BetaPlate(): React.JSX.Element {
  const [settled, setSettled] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settled) return;
    const el = ref.current;
    if (!el) return;
    const onEnd = (event: AnimationEvent) => {
      if (event.animationName === 'beta-plate-swing-in') setSettled(true);
    };
    el.addEventListener('animationend', onEnd);
    return () => el.removeEventListener('animationend', onEnd);
  }, [settled]);

  return (
    <div ref={ref} className={`beta-plate ${settled ? 'beta-plate--sway' : 'beta-plate--enter'}`}>
      <img src="/badges/still-in-beta-plate.png" alt="Still in beta" width={480} height={480} />
    </div>
  );
}

function Footer(): React.JSX.Element {
  return (
    <footer className="marketing-footer">
      <Brand />
      <p>Precision tools for builders who measure twice.</p>
      <nav aria-label="Footer">
        <a href="/privacy">Privacy</a>
        <a href="/support">Support</a>
        <a href={GITHUB_URL} {...external}>GitHub</a>
      </nav>
    </footer>
  );
}

function StaticPage({ kind }: { kind: 'privacy' | 'support' }): React.JSX.Element {
  const isPrivacy = kind === 'privacy';
  return (
    <div className="marketing-page">
      <header className="marketing-nav compact">
        <Brand />
        <a className="marketing-nav-cta" href="/app">Open editor <ArrowRight size={15} /></a>
      </header>
      <main className="static-page">
        <a className="back-link" href="/">← Back to Axe Shaper</a>
        <h1>{isPrivacy ? 'Privacy' : 'Support'}</h1>
        {isPrivacy ? (
          <div className="prose">
            <p>Axe Shaper’s browser editor keeps your working project in the browser unless you choose to download or share it. The current web app does not require an account.</p>
            <h2>Files and guide images</h2>
            <p>Guide images are decoded locally for use on the canvas. Saved projects are exported to your device as <code>.axe.svg</code> files. Do not publish a file or image you do not have permission to share.</p>
            <h2>External services</h2>
            <p>The site is hosted with Firebase Hosting and loads web fonts from Google Fonts. Following the GitHub or email links leaves this site and is governed by the destination service’s privacy terms.</p>
            <h2>iPad updates</h2>
            <p>The current interest link opens your email application. Axe Shaper does not silently collect the address you enter on this website.</p>
            <p className="page-updated">Updated August 2026</p>
          </div>
        ) : (
          <div className="prose">
            <p>For bugs, feature requests, and questions about the open-source web editor, open an issue on GitHub. Include your browser, the steps that led to the problem, and a sample <code>.axe.svg</code> when it is safe to share.</p>
            <div className="static-actions">
              <a className="marketing-button primary" href={`${GITHUB_URL}/issues`} {...external}><Code2 size={17} /> Open a GitHub issue</a>
              <a className="marketing-button secondary" href="mailto:steelfinger@steelfinger.fi?subject=Axe%20Shaper%20support"><Mail size={17} /> Email support</a>
            </div>
            <h2>Before printing</h2>
            <p>Print at 100% or Actual Size, then measure the exported 100 × 100 mm calibration square. Do not cut material until that square measures correctly.</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export function MarketingSite({ path }: { path: string }): React.JSX.Element {
  useEffect(() => {
    document.documentElement.classList.add('marketing-document');
    document.title = path === '/privacy'
      ? 'Privacy — Axe Shaper'
      : path === '/support'
        ? 'Support — Axe Shaper'
        : 'Axe Shaper — True-scale electric guitar body designer';
    const scrollToHash = () => {
      if (!window.location.hash) return;
      requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView());
    };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => {
      document.documentElement.classList.remove('marketing-document');
      window.removeEventListener('hashchange', scrollToHash);
    };
  }, [path]);

  if (path === '/privacy') return <StaticPage kind="privacy" />;
  if (path === '/support') return <StaticPage kind="support" />;

  return (
    <div className="marketing-page">
      <header className="marketing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#linked-geometry">Linked geometry</a>
          <a href="#how-it-works">How it works</a>
          <a href="#ipad">iPad</a>
          <a href={GITHUB_URL} {...external}>Open source</a>
        </nav>
        <a className="marketing-nav-cta" href="/app">Open editor <ArrowRight size={15} /></a>
      </header>

      <main>
        <section className="marketing-hero">
          <div className="hero-copy">
            <div className="hero-title-row">
              <h1>Shape the body. Trust the blueprint.</h1>
              <BetaPlate />
            </div>
            <p className="hero-lede">Design an electric guitar body with the neck, bridge, pickups, and scale length working as one measured system—then export a true-scale plan for the shop.</p>
            <div className="hero-actions">
              <a className="marketing-button primary" href="/app">Design in your browser <ArrowRight size={17} /></a>
              <a className="marketing-button secondary" href={GITHUB_URL} {...external}><Code2 size={17} /> View source</a>
            </div>
            <p className="hero-note"><ShieldCheck size={15} /> Free web editor · no account required · projects save to your device</p>
          </div>

          <figure className="blueprint-stage">
            <div className="sheet-tab"><span>Custom S-style body</span><span>647.7 mm scale</span></div>
            <div className="blueprint-sheet">
              <img
                src={PLAN_DISPLAY_URL}
                alt="A true-scale plan for a custom S-style guitar body: the body outline and edge inset, a neck pocket, three single-coil pickup routes, front and back cavity routes, a pickguard, the centreline and neck-joint guides, a marked saddle line, and a 100 mm calibration box."
                width={1633}
                height={2542}
              />
            </div>
            <figcaption className="sheet-actions">
              <a className="sheet-action" href={PLAN_PRINT_URL} download="axe-shaper-custom-s-style.axe.svg">
                <Download size={15} /> Download this plan
                <small>38 KB .axe.svg</small>
              </a>
              <a className="sheet-action" href={`/app?plan=${encodeURIComponent(PLAN_PRINT_URL)}`}>
                <PenLine size={15} /> Open it in the editor
                <small>no account needed</small>
              </a>
            </figcaption>
            <div className="bench-callout callout-scale">
              <Ruler size={16} />
              <span><strong>100 × 100 mm</strong>Measure this square after printing. If it is off, the print is scaled.</span>
            </div>
          </figure>
        </section>

        <section className="proof-strip" aria-label="What the export guarantees">
          <div><span className="proof-value">1:1</span><span>prints true to scale, with a calibration square to prove it</span></div>
          <div><span className="proof-value">mm</span><span>every anchor stored in physical millimetres, never inches</span></div>
          <div><span className="proof-value">8</span><span>reference body blueprints to start from, or trace your own</span></div>
          <div><span className="proof-value">MIT</span><span>open source, free, and yours to fork</span></div>
        </section>

        <section className="linked-section" id="linked-geometry">
          <div className="linked-copy">
            <h2>A guitar is not a pile of independent shapes.</h2>
            <p>Change the neck or scale and the saddle line must still land where the instrument can intonate. Axe Shaper keeps that relationship in the project instead of asking you to reconstruct it in a generic vector editor.</p>
          </div>
          <ol className="geometry-chain">
            <li className="chain-item"><strong>Scale length</strong><small>647.7 mm</small><span>you choose it</span></li>
            <li className="chain-link" aria-hidden="true"><Link2 size={20} /></li>
            <li className="chain-item"><strong>Neck pocket</strong><small>55.56 mm wide</small><span>the joint follows</span></li>
            <li className="chain-link" aria-hidden="true"><Link2 size={20} /></li>
            <li className="chain-item"><strong>Saddle line</strong><small>+ 2.0 mm compensation</small><span>and the bridge lands here</span></li>
          </ol>
        </section>

        <section className="workflow-section" id="how-it-works">
          <h2 className="section-heading">Plan, print, cut.</h2>
          <div className="workflow-grid">
            <div className="workflow-rail" aria-hidden="true"><span /><span /><span /></div>
            <article><Ruler size={24} /><h3>Start from measured geometry</h3><p>Choose one of eight reference body blueprints or trace a calibrated photo of your own. Every anchor you drag stays in physical millimetres.</p></article>
            <article><Printer size={24} /><h3>Export the thing you build from</h3><p>The project and the printable drawing live in one standard SVG, with a calibration square that catches printer scaling before you cut.</p></article>
            <article><Link2 size={24} /><h3>Carry the work forward</h3><p>Reopen the same <code>.axe.svg</code> months later with every curve, preset and pickup still editable — the project data rides inside the drawing.</p></article>
          </div>
        </section>

        <section className="workbench-section" id="workbench">
          <div className="workbench-collage">
            <figure className="workbench-photo workbench-photo-wide">
              <img src="/photos/unfinished-guitar-body.webp" alt="An unfinished electric guitar body, its cavities already routed, on a padded luthier's workbench" loading="lazy" />
              <figcaption>Photo by <a href="https://unsplash.com/@alexkall?utm_source=axe_shaper&utm_medium=referral" {...external}>Alex Kalligas</a> on <a href="https://unsplash.com/photos/N_kSeJWM6xM?utm_source=axe_shaper&utm_medium=referral" {...external}>Unsplash</a></figcaption>
            </figure>
            <img className="workbench-mark" src="/brand/axe-shaper-mark-large.png" alt="" aria-hidden="true" loading="lazy" />
            <figure className="workbench-photo workbench-photo-tall">
              <img src="/photos/guitar-body-workbench.webp" alt="An unfinished electric guitar body resting under a workshop lamp" loading="lazy" />
              <figcaption>Photo by <a href="https://unsplash.com/@alexkall?utm_source=axe_shaper&utm_medium=referral" {...external}>Alex Kalligas</a> on <a href="https://unsplash.com/photos/_AL_uONnBTg?utm_source=axe_shaper&utm_medium=referral" {...external}>Unsplash</a></figcaption>
            </figure>
          </div>
          <div className="workbench-copy">
            <h2>Drawn to be cut.</h2>
            <p>The drawing is not the destination. It becomes a paper pattern, a router guide, and eventually an instrument. Axe Shaper keeps the digital plan grounded in the measurements that survive that handoff.</p>
            <a className="marketing-button secondary" href="/app">Start a shop-ready plan <ArrowRight size={17} /></a>
          </div>
        </section>

        <section className="ipad-section" id="ipad">
          <div className="ipad-device" aria-hidden="true">
            <div className="ipad-screen">
              <div className="ipad-toolbar"><span /><span /><span /></div>
              <img src={PLAN_DISPLAY_URL} alt="" />
              <div className="pencil-line" />
            </div>
          </div>
          <div className="ipad-copy">
            <h2>The same plan, coming to an Apple Pencil workbench.</h2>
            <p>Axe Shaper for iPad is a native build in development. It is written from scratch rather than wrapped, and it stays honest against this editor the only way that counts: both are checked against the same frozen geometry corpus, and both read and write the same <code>.axe.svg</code>.</p>
            <a className="marketing-button primary" href={IPAD_MAILTO}><Mail size={17} /> Ask for iPad release updates</a>
            <small>Opens your email app — or write to <a href={IPAD_MAILTO}>{IPAD_EMAIL}</a>. No release date is promised.</small>
          </div>
        </section>

        <section className="closing-section">
          <h2>Your next body starts as a line you can trust.</h2>
          <p>Open the editor, choose a blueprint, and make the first curve yours.</p>
          <a className="marketing-button primary" href="/app">Open Axe Shaper <ArrowRight size={17} /></a>
        </section>
      </main>
      <Footer />
    </div>
  );
}
