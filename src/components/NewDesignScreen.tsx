import React, { useEffect, useMemo, useState } from 'react';
import { FileUp, MousePointer2, Printer, Ruler } from 'lucide-react';
import { REFERENCE_TEMPLATES } from '../constants/templates';
import { BLUEPRINT_ORDER } from '../constants/blueprintManifest';
import { DEFAULT_NECK_JOINT_MECHANISM } from '../constants/hardware';
import { resolveNeckPreset } from '../utils/presets';
import type { GuitarProject, InstrumentType, ReferenceTemplate } from '../types/guitar';
import { INSTRUMENT_TYPES, instrumentLabel } from '../utils/instrument';
import { createProject } from '../utils/projectFactory';
import { anchorsToSVGPath } from '../utils/bezier';
import { formatLength } from '../utils/units';

/**
 * The startup decision surface: which instrument, which blueprint, then open
 * the editor. Replaces the first-run WelcomeModal, which could only ever
 * offer "start with S-Style" because the S-Style project had already been
 * built at import time behind it.
 *
 * Two things here are structural rather than cosmetic:
 *
 * - **No project exists until a card is clicked.** The screen holds an
 *   instrument and nothing else, and `createProject` runs once, on the card's
 *   click. Choosing Bass therefore cannot briefly render or initialise a guitar
 *   project - there is nothing to initialise until the choice is made.
 * - **The instrument choice is a real radio group** (arrow keys, Space and the
 *   roving tab stop come from the platform). The blueprint cards are buttons:
 *   one click opens the editor, so there is no "selected, not yet opened"
 *   state to model. Each card carries its own description instead of a
 *   summary bar below the grid, and browser Back returns here seeded with the
 *   same instrument and blueprint, so a mis-click costs one step.
 *
 * Reference blueprints get full cards; extras sit in a second, always visible
 * section with compact cards, not behind a toggle.
 */

interface NewDesignScreenProps {
  onOpenProject: (project: GuitarProject) => void;
  onOpenFile: (file: File) => void;
  /**
   * When the chooser is reopened from the editor (via the header's instrument
   * control or a browser Back), the design that was open - so the screen lands
   * on that instrument and blueprint rather than the guitar default, and
   * switching guitar <-> bass is a single click. `templateId` marks that
   * blueprint's card as the one that was open, when it names a bundled
   * blueprint for that instrument; a user template or a stale id marks none.
   */
  initialSelection?: { instrumentType: InstrumentType; templateId: string };
}

/** A blueprint's headline facts, for the card and the detail line. */
function templateFacts(template: ReferenceTemplate): { scaleLengthMm: number | null; construction: string } {
  const neck = resolveNeckPreset({ neckPresetId: template.neckPresetId });
  const mechanism = DEFAULT_NECK_JOINT_MECHANISM[template.id] ?? 'bolt_on';
  return {
    scaleLengthMm: neck?.scaleLengthMm ?? null,
    construction: mechanism === 'glued' ? 'Glued neck' : 'Bolt-on neck',
  };
}

/**
 * The blueprint's own outline, drawn from the same anchors the editor will
 * open with - not an illustration of it. Each is fitted to its own bounds by
 * viewBox, so every card fills its tile; sizes are therefore not comparable
 * between cards, and the scale length in the facts line is the real measure.
 */
function BlueprintPreview({ template }: { template: ReferenceTemplate }): React.JSX.Element {
  const path = useMemo(() => anchorsToSVGPath(template.defaultAnchors, true), [template]);
  const bounds = useMemo(() => {
    const xs = template.defaultAnchors.map((a) => a.position.x);
    const ys = template.defaultAnchors.map((a) => a.position.y);
    const pad = 6;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    return {
      minX,
      minY,
      width: Math.max(...xs) + pad - minX,
      height: Math.max(...ys) + pad - minY,
    };
  }, [template]);
  return (
    <svg
      className="design-card-preview"
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

export function NewDesignScreen({
  onOpenProject,
  onOpenFile,
  initialSelection,
}: NewDesignScreenProps): React.JSX.Element {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'New design — Axe Shaper';
    // Opt out of the app shell's fixed-viewport layout (html/body/#root are
    // height:100%+overflow:hidden globally, correct for .app-container's own
    // internal panel scrolling) - this screen is a normal page and needs to
    // scroll like one. Without it, "Open editor" was unreachable whenever the
    // window was too short to fit every card above the fold: there was no
    // scrolling ancestor for the page to scroll within. See the rule's own
    // comment in styles/index.css; MarketingSite uses the same class.
    document.documentElement.classList.add('page-scrolls');
    return () => document.documentElement.classList.remove('page-scrolls');
  }, []);

  const byInstrument = useMemo(() => {
    const groups = new Map<InstrumentType, ReferenceTemplate[]>();
    for (const type of INSTRUMENT_TYPES) groups.set(type, []);
    // BLUEPRINT_ORDER, not Object.values - the manifest is keyed for lookup,
    // and display order is the manifest's own job.
    for (const id of BLUEPRINT_ORDER) {
      const template = REFERENCE_TEMPLATES[id];
      if (template) groups.get(template.instrumentType)?.push(template);
    }
    return groups;
  }, []);

  // A chooser reopened from the editor lands on the instrument that was open;
  // a cold start is Guitar, for continuity with every build before this screen.
  const [instrumentType, setInstrumentType] = useState<InstrumentType>(
    () => initialSelection?.instrumentType ?? 'guitar'
  );
  const currentId =
    initialSelection &&
    REFERENCE_TEMPLATES[initialSelection.templateId]?.instrumentType === instrumentType
      ? initialSelection.templateId
      : null;

  const templates = byInstrument.get(instrumentType) ?? [];
  const reference = templates.filter((t) => t.tier === 'reference');
  const extra = templates.filter((t) => t.tier === 'extra');

  const openWithTemplate = (id: string) => {
    onOpenProject(createProject({ templateId: id }));
  };

  return (
    <div className="new-design-screen">
      <header className="new-design-header">
        <a className="brand-title" href="/" aria-label="Axe Shaper product site">
          <img className="brand-icon" src="/brand/axe-shaper-mark.png" alt="" aria-hidden="true" />
          <span>Axe Shaper</span>
          <span className="brand-badge">2D Luthier</span>
        </a>
      </header>

      <div className="new-design-body">
        <div className="new-design-intro">
          <h1>New design</h1>
          <p>
            Pick the instrument and a baseline blueprint. Everything stays editable afterwards.
            {initialSelection &&
              ' Opening one here starts a new design — the one you were editing is left untouched.'}
          </p>
        </div>

        <fieldset className="design-instrument-group">
          <legend>Instrument</legend>
          <div className="design-instrument-options">
            {INSTRUMENT_TYPES.map((type) => {
              const count = (byInstrument.get(type) ?? []).length;
              return (
                <label key={type} className="design-instrument-option">
                  <input
                    type="radio"
                    name="instrument"
                    value={type}
                    checked={instrumentType === type}
                    onChange={() => setInstrumentType(type)}
                  />
                  <span className="design-instrument-face">
                    <span className="design-instrument-name">{instrumentLabel(type)}</span>
                    <span className="design-instrument-count">
                      {count === 0 ? 'None yet' : `${count} blueprint${count === 1 ? '' : 's'}`}
                    </span>
                  </span>
                </label>
              );
            })}
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onOpenFile(file);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn design-open-existing"
              title="Any .axe.svg saved by Axe Shaper, on this device or the iPad app"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp size={15} /> Open existing project
            </button>
          </div>
        </fieldset>

        {templates.length === 0 ? (
          // Honest rather than empty: the instrument is modelled end to end -
          // hardware, pocket, routs, file format - and only the traced bodies
          // are outstanding. Saying so beats an unexplained blank grid.
          <p className="design-empty" role="status">
            No {instrumentLabel(instrumentType).toLowerCase()} blueprints are bundled yet. The hardware,
            neck pocket and file format are in place; the traced bodies are still being drawn.
          </p>
        ) : (
          <>
            <section className="design-template-group" aria-labelledby="design-reference-title">
              <h2 id="design-reference-title">Blueprint</h2>
              <div className="design-card-grid">
                {reference.map((template) => (
                  <BlueprintCard
                    key={template.id}
                    template={template}
                    current={currentId === template.id}
                    onOpen={openWithTemplate}
                  />
                ))}
              </div>
            </section>

            {extra.length > 0 && (
              <section className="design-template-group" aria-labelledby="design-extra-title">
                <h2 id="design-extra-title">More shapes</h2>
                <div className="design-card-grid is-compact">
                  {extra.map((template) => (
                    <BlueprintCard
                      key={template.id}
                      template={template}
                        current={currentId === template.id}
                      compact
                      onOpen={openWithTemplate}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Below the decision, deliberately: this used to be a modal in front
            of it, which meant the first thing a new user did was dismiss
            something to reach the thing they came for. */}
        <section className="design-primer" aria-labelledby="design-primer-title">
          <h2 id="design-primer-title">How it works</h2>
          <div className="welcome-steps">
            <div>
              <MousePointer2 size={20} />
              <strong>Shape</strong>
              <span>Select an outline segment or anchor on the canvas.</span>
            </div>
            <div>
              <Ruler size={20} />
              <strong>Measure</strong>
              <span>Set the neck, scale, bridge, pickups, and routes in millimetres.</span>
            </div>
            <div>
              <Printer size={20} />
              <strong>Build</strong>
              <span>
                Save a 1:1 <code>.axe.svg</code> and verify its calibration square.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function BlueprintCard({
  template,
  current,
  compact = false,
  onOpen,
}: {
  template: ReferenceTemplate;
  /** The blueprint the reopened chooser's previous design was built from. */
  current: boolean;
  /** Extras: outline, name and facts only - no description. */
  compact?: boolean;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const facts = templateFacts(template);
  return (
    <button
      type="button"
      className={`design-card${compact ? ' is-compact' : ''}${current ? ' is-current' : ''}`}
      aria-current={current || undefined}
      onClick={() => onOpen(template.id)}
    >
      <BlueprintPreview template={template} />
      <span className="design-card-body">
        <span className="design-card-name">{template.name}</span>
        <span className="design-card-category">{template.category}</span>
        <span className="design-card-facts">
          {facts.scaleLengthMm !== null && (
            <span>
              {/* formatLength returns the bare number - the unit is the
                  caller's, everywhere in this app. Only the number is set in
                  mono, per the Mono-Means-Measured rule. */}
              <span className="design-card-measure">{formatLength(facts.scaleLengthMm, 'mm')}</span>
              {compact ? ' mm' : ' mm scale'}
            </span>
          )}
          <span>{compact ? facts.construction.replace(' neck', '') : facts.construction}</span>
        </span>
        {!compact && <span className="design-card-description">{template.description}</span>}
      </span>
    </button>
  );
}
