import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileUp, MousePointer2, Printer, Ruler } from 'lucide-react';
import { REFERENCE_TEMPLATES } from '../constants/templates';
import { BLUEPRINT_ORDER } from '../constants/blueprintManifest';
import { DEFAULT_NECK_JOINT_MECHANISM, NECK_PRESETS } from '../constants/hardware';
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
 * - **No project exists until a card is activated or Open editor is
 *   pressed.** The screen holds a template *id*, and `createProject` runs
 *   once, at that point. Choosing Bass therefore cannot briefly render or
 *   initialise a guitar project - there is nothing to initialise until the
 *   choice is made.
 * - **Every control is a real radio input.** Arrow-key navigation within a
 *   group, Space to select, and the roving tab stop all come from the
 *   platform; a div with an onClick would have to reimplement each of them,
 *   and would get the roving tab stop wrong. The cards are `<label>`s for
 *   their own input, so the whole card stays clickable.
 *
 * A real pointer click (mouse, touch, pen) on a card opens the editor
 * immediately, rather than only selecting it and leaving "Open editor" as a
 * second, separate click - a card was selectable but that wasn't obvious as
 * a two-step flow, and clicking a card was the natural expectation of
 * "choose this one." Arrow-key browsing within the radio group deliberately
 * still only *selects* (updates the preview) without submitting, because a
 * keyboard-only user has no other way to move between cards, and needs to be
 * able to pass a card by without committing to it.
 *
 * That distinction is harder than "click vs. change": a native radio group's
 * arrow-key navigation is specified to run the newly-focused radio's own
 * activation behaviour, which fires a real `click` event - not just
 * `change`. `onClick` alone can't tell that apart from an actual pointer
 * click; `event.detail` can't either (both are `0`, same as a keyboard Space
 * activation). The one reliable signal is `pointerType`: empty for anything
 * keyboard-originated, `"mouse"`/`"touch"`/`"pen"` for a real pointing
 * device. Confirmed empirically, not assumed - see `BlueprintCard`'s own
 * comment. "Open editor" stays as the explicit, always-present action for
 * arrow-key/Tab-only navigation.
 */

interface NewDesignScreenProps {
  onOpenProject: (project: GuitarProject) => void;
  onOpenFile: (file: File) => void;
}

/** A blueprint's headline facts, for the card and the detail line. */
function templateFacts(template: ReferenceTemplate): { scaleLengthMm: number | null; construction: string } {
  const neck = NECK_PRESETS[template.neckPresetId];
  const mechanism = DEFAULT_NECK_JOINT_MECHANISM[template.id] ?? 'bolt_on';
  return {
    scaleLengthMm: neck?.scaleLengthMm ?? null,
    construction: mechanism === 'glued' ? 'Glued neck' : 'Bolt-on neck',
  };
}

/**
 * The blueprint's own outline, drawn from the same anchors the editor will
 * open with - not an illustration of it. Scaled to fit the card by viewBox
 * rather than by touching the geometry.
 */
function BlueprintPreview({ template }: { template: ReferenceTemplate }): React.JSX.Element {
  const path = useMemo(() => anchorsToSVGPath(template.defaultAnchors, true), [template]);
  const bounds = useMemo(() => {
    const xs = template.defaultAnchors.map((a) => a.position.x);
    const ys = template.defaultAnchors.map((a) => a.position.y);
    const pad = 12;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    return {
      minX,
      minY,
      width: Math.max(...xs) - minX + pad,
      height: Math.max(...ys) - minY + pad,
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

export function NewDesignScreen({ onOpenProject, onOpenFile }: NewDesignScreenProps): React.JSX.Element {
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

  const firstTemplateFor = (type: InstrumentType): string | null => {
    const templates = byInstrument.get(type) ?? [];
    return (templates.find((t) => t.tier === 'reference') ?? templates[0])?.id ?? null;
  };

  // Guitar first, for continuity with every build before this screen existed.
  const [instrumentType, setInstrumentType] = useState<InstrumentType>('guitar');
  const [templateId, setTemplateId] = useState<string | null>(() => firstTemplateFor('guitar'));
  const [extraOpen, setExtraOpen] = useState(false);

  const templates = byInstrument.get(instrumentType) ?? [];
  const reference = templates.filter((t) => t.tier === 'reference');
  const extra = templates.filter((t) => t.tier === 'extra');
  const selected = templateId ? REFERENCE_TEMPLATES[templateId] : undefined;

  const handleInstrumentChange = (type: InstrumentType) => {
    setInstrumentType(type);
    // Selecting an instrument re-selects its own first reference blueprint;
    // carrying the previous one over would leave a guitar selected under a
    // Bass heading, and it is the *template* that decides the instrument the
    // project is created with.
    setTemplateId(firstTemplateFor(type));
    setExtraOpen(false);
  };

  const openWithTemplate = (id: string) => {
    setTemplateId(id);
    onOpenProject(createProject({ templateId: id }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateId) return;
    openWithTemplate(templateId);
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

      <form className="new-design-body" onSubmit={handleSubmit}>
        <div className="new-design-intro">
          <h1>New design</h1>
          <p>Pick the instrument and a baseline blueprint. Everything stays editable afterwards.</p>
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
                    onChange={() => handleInstrumentChange(type)}
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
            <fieldset className="design-template-group">
              <legend>Blueprint</legend>
              <div className="design-card-grid">
                {reference.map((template) => (
                  <BlueprintCard
                    key={template.id}
                    template={template}
                    checked={templateId === template.id}
                    onSelect={setTemplateId}
                    onActivate={openWithTemplate}
                  />
                ))}
              </div>

              {extra.length > 0 && (
                <div className="design-extra">
                  <button
                    type="button"
                    className="btn btn-sm design-extra-toggle"
                    aria-expanded={extraOpen}
                    aria-controls="design-extra-grid"
                    onClick={() => setExtraOpen((open) => !open)}
                  >
                    {extraOpen ? 'Hide' : 'Show'} extra blueprints ({extra.length})
                  </button>
                  {/* Kept mounted but hidden, so a card selected here stays
                      selected if the group is collapsed again. */}
                  <div id="design-extra-grid" className="design-card-grid" hidden={!extraOpen}>
                    {extra.map((template) => (
                      <BlueprintCard
                        key={template.id}
                        template={template}
                        checked={templateId === template.id}
                        onSelect={setTemplateId}
                        onActivate={openWithTemplate}
                      />
                    ))}
                  </div>
                </div>
              )}
            </fieldset>

            <div className="design-summary">
              <p className="design-summary-text" role="status">
                {selected ? (
                  <>
                    <strong>{selected.name}</strong> — {selected.description}
                  </>
                ) : (
                  'Select a blueprint to continue.'
                )}
              </p>
              <button type="submit" className="btn btn-accent design-submit" disabled={!selected}>
                Open editor <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        <div className="design-open-existing">
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
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
            <FileUp size={15} /> Open existing project
          </button>
          <span>
            Any <code>.axe.svg</code> saved by Axe Shaper, on this device or the iPad app.
          </span>
        </div>

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
      </form>
    </div>
  );
}

function BlueprintCard({
  template,
  checked,
  onSelect,
  onActivate,
}: {
  template: ReferenceTemplate;
  checked: boolean;
  /** Arrow-key browsing within the radio group: preview only, no commit. */
  onSelect: (id: string) => void;
  /** A real pointer click (mouse, touch, pen) on the card: select and open the editor in one step. */
  onActivate: (id: string) => void;
}): React.JSX.Element {
  const facts = templateFacts(template);
  return (
    <label
      className={`design-card${checked ? ' is-selected' : ''}`}
      onClick={(event) => {
        // Wrapping the input in a <label> is what makes the whole card
        // clickable, but that means EVERY activation of the input - a real
        // pointer click, *and* the click a browser synthesises when arrow
        // keys move focus within a native radio group - bubbles through this
        // handler as a 'click'. Those two are indistinguishable by event type
        // (both are `detail: 0` for a plain keyboard Space too); the one
        // reliable signal is `pointerType`, empty for anything keyboard-
        // originated and "mouse"/"touch"/"pen" for a real pointer device.
        // Gating on it is what keeps arrow-key browsing (still just a
        // preview via onChange below) from instantly opening the editor on
        // whichever card the second arrow press happens to land on - which a
        // first version of this fix did, and it made browsing past the
        // second card impossible for a keyboard-only user.
        if ((event.nativeEvent as PointerEvent).pointerType) onActivate(template.id);
      }}
    >
      <input
        type="radio"
        name="blueprint"
        value={template.id}
        checked={checked}
        onChange={() => onSelect(template.id)}
      />
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
              <span className="design-card-measure">{formatLength(facts.scaleLengthMm, 'mm')}</span> mm scale
            </span>
          )}
          <span>{facts.construction}</span>
        </span>
      </span>
    </label>
  );
}
