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
        <a href="/ipad">iPad</a>
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
            <p>This policy covers the Axe Shaper browser editor and Axe Shaper for iPad. Neither product requires an account.</p>
            <h2>Axe Shaper for iPad</h2>
            <p>The iPad app does not use advertising, analytics, or tracking. Your designs and guide images are processed on your device. When you save or export, files go to the location you choose in Files or iCloud Drive; they are not sent to an Axe Shaper server.</p>
            <p>If you choose to scan a paper template or instrument body, the camera is used only to create the guide image you select. The app does not collect your camera feed or photo library.</p>
            <h2>Browser editor</h2>
            <p>The browser editor keeps your working project in the browser unless you choose to download or share it. Guide images are decoded locally for use on the canvas, and saved projects are exported to your device as <code>.axe.svg</code> files.</p>
            <h2>Website services and links</h2>
            <p>The website is hosted with Firebase Hosting and loads web fonts from Google Fonts. Following the GitHub or email links leaves this site and is governed by the destination service’s privacy terms. The iPad release-updates link opens your email app; Axe Shaper does not silently collect the address you enter there.</p>
            <h2>Contact</h2>
            <p>For privacy questions, email <a href="mailto:steelfinger@steelfinger.fi?subject=Axe%20Shaper%20privacy">steelfinger@steelfinger.fi</a>.</p>
            <p className="page-updated">Updated 24 August 2026</p>
          </div>
        ) : (
          <div className="prose">
            <p>Get help with Axe Shaper for iPad or the open-source browser editor. Email is the best place for questions, bug reports, and feature requests.</p>
            <div className="static-actions">
              <a className="marketing-button primary" href="mailto:steelfinger@steelfinger.fi?subject=Axe%20Shaper%20support"><Mail size={17} /> Email support</a>
              <a className="marketing-button secondary" href={`${GITHUB_URL}/issues`} {...external}><Code2 size={17} /> Web editor issues</a>
            </div>
            <h2>For iPad support</h2>
            <p>Include your iPad model, iPadOS version, Axe Shaper version, what you expected to happen, and the steps that reproduce the issue. Attach a screenshot or a sample <code>.axe.svg</code> only when it is safe to share.</p>
            <h2>Before printing</h2>
            <p>Print at 100% or Actual Size, then measure the exported 100 × 100 mm calibration square. Do not cut material until that square measures correctly.</p>
            <h2>Browser editor</h2>
            <p>For browser-editor bugs, you can also open a GitHub issue. Include your browser, the steps that led to the problem, and a sample <code>.axe.svg</code> when it is safe to share.</p>
            <p className="page-updated">Updated 24 August 2026</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function IpadPage(): React.JSX.Element {
  return (
    <div className="marketing-page ipad-marketing-page">
      <header className="marketing-nav">
        <Brand />
        <nav aria-label="iPad page navigation">
          <a href="#workflow">How it works</a>
          <a href="#features">Features</a>
          <a href="/support">Support</a>
        </nav>
        <a className="marketing-nav-cta" href="/app">Open web editor <ArrowRight size={15} /></a>
      </header>
      <main>
        <section className="ipad-hero">
          <div className="ipad-hero-copy">
            <h1>Shape a solid body. Take it to the bench.</h1>
            <p>Design solid-body electric guitar and bass bodies on iPad with exact millimetre dimensions, live symmetry, and an export you can print at full scale.</p>
            <div className="ipad-hero-actions">
              <a className="marketing-button primary" href={IPAD_MAILTO}><Mail size={17} /> Get iPad release updates</a>
              <a className="marketing-button secondary" href="#features">Explore the tool <ArrowRight size={17} /></a>
            </div>
            <p className="ipad-release-note">App Store availability is being prepared. This link opens your email app; Axe Shaper does not collect your address.</p>
          </div>
          <div className="ipad-hero-device" aria-hidden="true">
            <div className="ipad-hero-screen">
              <div className="ipad-hero-toolbar"><span>Axe Shaper</span><i /><i /><i /></div>
              <img src={PLAN_DISPLAY_URL} alt="" />
              <div className="ipad-hero-measure">100 mm</div>
              <div className="ipad-hero-pencil" />
            </div>
          </div>
        </section>

        <section className="ipad-intro" id="workflow">
          <h2>Sixteen starting points. Every curve yours.</h2>
          <p>Begin with one of 16 built-in solid-body templates—eight guitar and eight bass—or bring in a photo or camera scan for reference. You can also start from a blank outline. Axe Shaper keeps the work grounded in measurements from the first anchor to the printed template.</p>
        </section>

        <section className="ipad-features" id="features">
          <article>
            <span>01</span>
            <h2>Draw with intent.</h2>
            <p>Shape smooth body contours with Apple Pencil or touch. Live symmetry keeps a balanced design in step while you work.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Trace what you trust.</h2>
            <p>Import a photo or scan a template with the iPad camera, then calibrate it from two real-world points before tracing.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Check the build.</h2>
            <p>Place pickups, bridges, neck pockets, routs, pickguards, and layers. Inspect the design in 3D before making sawdust.</p>
          </article>
          <article>
            <span>04</span>
            <h2>Print the pattern.</h2>
            <p>Export a tiled, full-size PDF with a calibration square—ready to check, print, and take into the workshop.</p>
          </article>
        </section>

        <section className="ipad-privacy-note">
          <ShieldCheck size={28} aria-hidden="true" />
          <div>
            <h2>Your work stays yours.</h2>
            <p>Axe Shaper for iPad has no account, analytics, or advertising. Projects and reference images stay on your device or in the Files location you choose.</p>
          </div>
          <a href="/privacy">Read the privacy policy <ArrowRight size={16} /></a>
        </section>

        <section className="closing-section">
          <h2>Start with a familiar body. End with your own.</h2>
          <p>Get release updates for Axe Shaper on iPad, or start designing in the browser today.</p>
          <div className="ipad-hero-actions">
            <a className="marketing-button primary" href={IPAD_MAILTO}><Mail size={17} /> Get iPad release updates</a>
            <a className="marketing-button secondary" href="/app">Open web editor <ArrowRight size={17} /></a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export function MarketingSite({ path }: { path: string }): React.JSX.Element {
  useEffect(() => {
    // marketing-document: this page's own smooth-scroll-to-anchor behaviour.
    // page-scrolls: the shared opt-out from the app shell's fixed-viewport
    // layout (also used by NewDesignScreen) - see the rule's own comment in
    // styles/index.css.
    document.documentElement.classList.add('marketing-document', 'page-scrolls');
    document.title = path === '/privacy'
      ? 'Privacy — Axe Shaper'
      : path === '/support'
        ? 'Support — Axe Shaper'
        : path === '/ipad'
          ? 'Axe Shaper for iPad — Solid-body guitar and bass design'
        : 'Axe Shaper — True-scale guitar and bass body designer';
    const scrollToHash = () => {
      if (!window.location.hash) return;
      requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView());
    };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => {
      document.documentElement.classList.remove('marketing-document', 'page-scrolls');
      window.removeEventListener('hashchange', scrollToHash);
    };
  }, [path]);

  if (path === '/privacy') return <StaticPage kind="privacy" />;
  if (path === '/support') return <StaticPage kind="support" />;
  if (path === '/ipad') return <IpadPage />;

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
            <p className="hero-lede">Design a solid-body electric guitar or bass with the neck, bridge, pickups, and scale length working as one measured system—then export a true-scale plan for the shop.</p>
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
          <div><span className="proof-value">16</span><span>built-in body blueprints: eight guitar and eight bass</span></div>
          <div><span className="proof-value">MIT</span><span>open source, free, and yours to fork</span></div>
        </section>

        <section className="linked-section" id="linked-geometry">
          <div className="linked-copy">
            <h2>An instrument is not a pile of independent shapes.</h2>
            <p>Change the neck or scale and the saddle line must still land where the guitar or bass can intonate. Axe Shaper keeps that relationship in the project instead of asking you to reconstruct it in a generic vector editor.</p>
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
            <article><Ruler size={24} /><h3>Start from measured geometry</h3><p>Choose from eight guitar and eight bass blueprints, or trace a calibrated photo of your own. Every anchor you drag stays in physical millimetres.</p></article>
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
            <h2>A solid-body workbench, built for iPad.</h2>
            <p>Design solid-body electric guitar and bass bodies with the same measured approach: start from 16 templates, trace a real-world reference, shape every curve, and export a full-size pattern for the shop.</p>
            <a className="marketing-button primary" href="/ipad">Explore Axe Shaper for iPad <ArrowRight size={17} /></a>
            <small>App Store availability is being prepared. Get release updates from the iPad page.</small>
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
