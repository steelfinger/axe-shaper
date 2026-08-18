import { useEffect } from 'react';
import {
  ArrowRight,
  Download,
  Code2,
  Link2,
  Mail,
  Printer,
  Ruler,
  ShieldCheck,
  Tablet,
} from 'lucide-react';
import blueprintUrl from '../constants/blueprints/s_style.axe.svg?url';

const GITHUB_URL = 'https://github.com/steelfinger/axe-shaper';
const IPAD_MAILTO = 'mailto:tero.aarnio@gmail.com?subject=Axe%20Shaper%20for%20iPad%20updates&body=Please%20let%20me%20know%20when%20Axe%20Shaper%20for%20iPad%20is%20available.';

function Brand(): React.JSX.Element {
  return (
    <a className="marketing-brand" href="/" aria-label="Axe Shaper home">
      <img src="/brand/axe-shaper-mark.png" alt="" aria-hidden="true" />
      <span>Axe Shaper</span>
    </a>
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
        <a href={GITHUB_URL}>GitHub</a>
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
              <a className="marketing-button primary" href={`${GITHUB_URL}/issues`}><Code2 size={17} /> Open a GitHub issue</a>
              <a className="marketing-button secondary" href="mailto:tero.aarnio@gmail.com?subject=Axe%20Shaper%20support"><Mail size={17} /> Email support</a>
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
          <a href="#how-it-works">How it works</a>
          <a href="#ipad">iPad</a>
          <a href={GITHUB_URL}>Open source</a>
        </nav>
        <a className="marketing-nav-cta" href="/app">Open editor <ArrowRight size={15} /></a>
      </header>

      <main>
        <section className="marketing-hero">
          <div className="hero-copy">
            <h1>Shape the body.<br />Trust the blueprint.</h1>
            <p className="hero-lede">Design an electric guitar body with the neck, bridge, pickups, and scale length working as one measured system—then export a true-scale plan for the shop.</p>
            <div className="hero-actions">
              <a className="marketing-button primary" href="/app">Design in your browser <ArrowRight size={17} /></a>
              <a className="marketing-button secondary" href={GITHUB_URL}><Code2 size={17} /> View source</a>
            </div>
            <p className="hero-note"><ShieldCheck size={15} /> Free web editor · no account required · projects save to your device</p>
          </div>

          <div className="blueprint-stage" aria-label="A real S-style plan exported by Axe Shaper">
            <div className="sheet-tab"><span>S-STYLE STANDARD</span><span>647.7 mm SCALE</span></div>
            <div className="blueprint-sheet">
              <img src={blueprintUrl} alt="True-scale S-style guitar body blueprint with hardware routes and calibration square" />
            </div>
            <div className="bench-callout callout-scale"><Ruler size={16} /><span><strong>100 × 100 mm</strong> print check</span></div>
            <div className="bench-callout callout-format"><Download size={16} /><span><strong>.axe.svg</strong> portable project</span></div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Core product guarantees">
          <div><span className="proof-value">1:1</span><span>physical SVG output</span></div>
          <div><span className="proof-value">mm</span><span>geometry at every step</span></div>
          <div><span className="proof-value">50</span><span>undo steps</span></div>
          <div><span className="proof-value">2</span><span>sibling workbenches</span></div>
        </section>

        <section className="linked-section" id="how-it-works">
          <div className="linked-copy">
            <h2>A guitar is not a pile of independent shapes.</h2>
            <p>Change the neck or scale and the saddle line must still land where the instrument can intonate. Axe Shaper keeps that relationship in the project instead of asking you to reconstruct it in a generic vector editor.</p>
          </div>
          <div className="geometry-chain" aria-label="Linked geometry workflow">
            <div className="chain-item"><span>NUT</span><strong>Scale length</strong><small>25.5 in</small></div>
            <div className="chain-link"><Link2 size={20} /></div>
            <div className="chain-item active"><span>JOINT</span><strong>Neck pocket</strong><small>55.56 mm</small></div>
            <div className="chain-link"><Link2 size={20} /></div>
            <div className="chain-item"><span>SADDLE</span><strong>Bridge line</strong><small>+ compensation</small></div>
          </div>
        </section>

        <section className="workflow-section">
          <div className="workflow-rail" aria-hidden="true"><span /><span /><span /></div>
          <article><Ruler size={24} /><h3>Start from measured geometry</h3><p>Choose a familiar body blueprint or trace a calibrated reference image. Every anchor stays in physical millimetres.</p></article>
          <article><Printer size={24} /><h3>Export the thing you build from</h3><p>The project and printable drawing live in one standard SVG, with a calibration square that catches printer scaling.</p></article>
          <article><Link2 size={24} /><h3>Carry the work forward</h3><p>Open the same <code>.axe.svg</code> later without giving up the project data embedded inside it.</p></article>
        </section>

        <section className="workbench-section" id="workbench">
          <div className="workbench-collage">
            <figure className="workbench-photo workbench-photo-wide">
              <img src="/photos/unfinished-guitar-body.webp" alt="Unfinished electric guitar body blanks on a padded luthier's workbench" loading="lazy" />
              <figcaption>Photo by <a href="https://unsplash.com/@alexkall?utm_source=axe_shaper&utm_medium=referral">Alex Kalligas</a> on <a href="https://unsplash.com/photos/N_kSeJWM6xM?utm_source=axe_shaper&utm_medium=referral">Unsplash</a></figcaption>
            </figure>
            <img className="workbench-mark" src="/brand/axe-shaper-mark-large.png" alt="" aria-hidden="true" loading="lazy" />
            <figure className="workbench-photo workbench-photo-tall">
              <img src="/photos/guitar-body-workbench.webp" alt="An unfinished electric guitar body resting under a workshop lamp" loading="lazy" />
              <figcaption>Photo by <a href="https://unsplash.com/@alexkall?utm_source=axe_shaper&utm_medium=referral">Alex Kalligas</a> on <a href="https://unsplash.com/photos/_AL_uONnBTg?utm_source=axe_shaper&utm_medium=referral">Unsplash</a></figcaption>
            </figure>
          </div>
          <div className="workbench-copy">
            <h2>Designed on screen. Proven at the bench.</h2>
            <p>The drawing is not the destination. It becomes a paper pattern, a router guide, and eventually an instrument. Axe Shaper keeps the digital plan grounded in the measurements that survive that handoff.</p>
            <a className="marketing-button secondary" href="/app">Start a shop-ready plan <ArrowRight size={17} /></a>
          </div>
        </section>

        <section className="ipad-section" id="ipad">
          <div className="ipad-device" aria-hidden="true">
            <div className="ipad-screen">
              <div className="ipad-toolbar"><span /><span /><span /></div>
              <img src={blueprintUrl} alt="" />
              <div className="pencil-line" />
            </div>
          </div>
          <div className="ipad-copy">
            <Tablet size={30} />
            <h2>The same plan is coming to a Pencil-first workbench.</h2>
            <p>Axe Shaper for iPad is a private, native build in development. It shares no UI code with the web editor; it shares the geometry corpus and the portable <code>.axe.svg</code> contract that matter.</p>
            <a className="marketing-button primary" href={IPAD_MAILTO}><Mail size={17} /> Ask for iPad release updates</a>
            <small>This opens your email app. No release date is promised.</small>
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
