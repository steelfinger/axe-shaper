import React, { useState, useEffect, useRef } from 'react';
import { PanelLeft, SlidersHorizontal, X } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { InspectorPanel } from './components/InspectorPanel';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { REFERENCE_TEMPLATES } from './constants/templates';
import {
  bridgePresetFields,
  defaultNeckJointMechanism,
  loadProject,
  neckPresetFieldsForNewTemplate,
  withEmbeddedPresets,
} from './utils/presets';
import { createProject } from './utils/projectFactory';
import { buildViewer3DPath } from './utils/viewer3dLink';
import type {
  GuitarProject,
  GuideImageState,
  CalibrationState,
  StoredProject,
  Vector2D,
  PickupType,
} from './types/guitar';
import { curveSegment, insertAnchorOnSegment, isSegmentStraight, straightenSegment } from './utils/bezier';
import { HistoryManager } from './utils/history';
import { withMirroredInsertion } from './utils/symmetry';
import { buildProjectFilename, downloadSVGFile, exportProjectToSVG, extractProjectFromSVG } from './utils/svgExporter';
import { getUserTemplate } from './utils/userTemplates';
import { printTiledProject } from './utils/tiledPrint';
import {
  loadHandleAngleSnapPreference,
  saveHandleAngleSnapPreference,
  type HandleAngleSnapPreference,
} from './utils/handleAngleSnap';
import {
  type ActiveLayer,
  addingBackRoute,
  addingFrontRoute,
  addingPickguard,
  deletingLayerShape,
  getActiveContour,
  withActiveContour,
} from './utils/layerShapes';
import { addingPickup, removingPickup } from './utils/pickupEditing';
import { SaveInfoModal } from './components/SaveInfoModal';
import { WelcomeModal } from './components/WelcomeModal';
import { AboutModal } from './components/AboutModal';
import { MarketingSite } from './components/MarketingSite';

/** Matches the floor InspectorPanel's delete button enforces - a contour needs at least this many nodes to stay a sane shape. */
export const MIN_ANCHOR_COUNT = 4;

const INITIAL_GUIDE_IMAGE: GuideImageState = {
  imageUrl: null,
  element: null,
  offsetXMm: 0,
  offsetYMm: 180,
  scale: 1.0,
  rotationDegrees: 0,
  opacity: 0.6,
  visible: true,
  locked: false,
};

/**
 * Everything undo/redo restores. The guide image belongs here too - lining a
 * photo up is real work, and losing it to an undo of something else is the kind
 * of thing that makes people stop trusting undo.
 */
interface EditorDoc {
  project: GuitarProject;
  guideImage: GuideImageState;
}

const cloneDoc = (doc: EditorDoc): EditorDoc => ({
  project: JSON.parse(JSON.stringify(doc.project)) as GuitarProject,
  // Shallow: every field is a primitive except `element`, a decoded image that
  // is never mutated and cannot be cloned by JSON or structuredClone anyway.
  guideImage: { ...doc.guideImage },
});

const UNDO_STEPS = 50;
const WELCOME_STORAGE_KEY = 'axe-shaper:welcome-seen-v1';

const shouldShowWelcome = (): boolean => {
  try {
    return window.localStorage.getItem(WELCOME_STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
};

/**
 * A plan for `/app?plan=...` to open on load, or null.
 *
 * Deliberately restricted to a same-origin absolute path. This fetches
 * whatever it points at and loads it as the project, so allowing an off-site
 * URL would let a crafted link drop arbitrary content into someone's editor.
 * "/marketing/x.axe.svg" passes; "//host/x" and "https://host/x" do not.
 */
const planParamFromLocation = (): string | null => {
  const raw = new URLSearchParams(window.location.search).get('plan');
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
};

function EditorApp(): React.JSX.Element {
  // Built on first render, not at module scope: the old module-level literal
  // was evaluated at import, which made every new project's metadata.created
  // the timestamp of the page load. See utils/projectFactory.ts.
  const [project, setProject] = useState<GuitarProject>(() => createProject());
  const [selectedAnchorIds, setSelectedAnchorIds] = useState<Set<string>>(() => new Set());
  // The single selected anchor's id, when exactly one is selected - most
  // existing single-node logic (position edit, add-node-here, delete
  // cascade) only makes sense for one anchor at a time.
  const selectedAnchorId = selectedAnchorIds.size === 1 ? [...selectedAnchorIds][0] : null;
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  // Live model-space cursor position for the sidebar readout - null while the pointer is off the canvas.
  const [cursorPos, setCursorPos] = useState<Vector2D | null>(null);
  // Which contour a canvas gesture or inspector edit targets - body by default,
  // so every existing file and every session that never opens the Layers tab
  // behaves exactly as it did before this concept existed.
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>({ kind: 'body' });
  const [handleAngleSnap, setHandleAngleSnap] = useState<HandleAngleSnapPreference>(loadHandleAngleSnapPreference);
  const [isSaveInfoModalOpen, setIsSaveInfoModalOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(shouldShowWelcome);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'tools' | 'inspector' | null>(null);
  // In-memory only - reappears on reload, deliberately not persisted to localStorage.
  const hasSeenSaveInfoRef = useRef(false);
  const [guideImage, setGuideImage] = useState<GuideImageState>(INITIAL_GUIDE_IMAGE);

  const historyRef = useRef(new HistoryManager<EditorDoc>(cloneDoc, UNDO_STEPS));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Always the live document, so history never reads a stale render's closure
  const docRef = useRef<EditorDoc>({ project, guideImage });
  docRef.current = { project, guideImage };

  const updateHistoryState = () => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  };

  /**
   * Snapshot the document before an edit. Pass a `coalesceKey` for continuous
   * edits (dragging, typing, sliders) so the whole gesture is one undo step;
   * omit it for discrete ones.
   */
  const beginEdit = (coalesceKey?: string) => {
    historyRef.current.push(docRef.current, coalesceKey);
    updateHistoryState();
  };

  /** Close the current gesture - call on drag end / input blur. */
  const endEdit = () => historyRef.current.endGesture();

  const handleUpdateProject = (
    updater: (prev: GuitarProject) => GuitarProject,
    coalesceKey?: string
  ) => {
    beginEdit(coalesceKey);
    setProject((prev) => {
      const next = updater(prev);
      return { ...next, metadata: { ...next.metadata, modified: new Date().toISOString() } };
    });
  };

  const handleUpdateGuideImage = (
    updater: (prev: GuideImageState) => GuideImageState,
    coalesceKey?: string
  ) => {
    beginEdit(coalesceKey);
    setGuideImage(updater);
  };

  const handleUploadGuideImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      handleUpdateGuideImage((prev) => ({
        ...prev,
        imageUrl: url,
        element: img,
        visible: true,
      }));
    };
    img.src = url;
  };

  const handleClearGuideImage = () => {
    // The blob URL stays alive: an undo has to be able to show the image again,
    // and the browser reclaims it when the document unloads.
    handleUpdateGuideImage(() => INITIAL_GUIDE_IMAGE);
    setCalibration({ active: false, points: [] });
  };

  // --- Guide image two-point scale calibration ---
  const [calibration, setCalibration] = useState<CalibrationState>({ active: false, points: [] });

  const handleStartCalibration = () => setCalibration({ active: true, points: [] });
  const handleCancelCalibration = () => setCalibration({ active: false, points: [] });

  const handleCalibrationPick = (point: Vector2D) => {
    setCalibration((prev) => {
      if (!prev.active) return prev;
      // A third click starts a fresh pair rather than being ignored
      const points = prev.points.length >= 2 ? [point] : [...prev.points, point];
      return { ...prev, points };
    });
  };

  const handleApplyCalibration = (knownDistanceMm: number) => {
    const [p1, p2] = calibration.points;
    if (!p1 || !p2 || !(knownDistanceMm > 0)) return;

    const measuredMm = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (measuredMm < 0.01) return;

    const factor = knownDistanceMm / measuredMm;
    handleUpdateGuideImage((prev) => ({
      ...prev,
      scale: prev.scale * factor,
      // Scaling happens about the image centre, so shift the image to keep the
      // first picked point where the user put it.
      offsetXMm: prev.offsetXMm + (p1.x - prev.offsetXMm) * (1 - factor),
      offsetYMm: prev.offsetYMm + (p1.y - prev.offsetYMm) * (1 - factor),
    }));
    setCalibration({ active: false, points: [] });
  };

  const applyDoc = (doc: EditorDoc) => {
    setProject(doc.project);
    setGuideImage(doc.guideImage);
    // Ids and segment indices may not survive a structural change, and an
    // active pickguard/route id has no guarantee of surviving one either
    setSelectedAnchorIds(new Set());
    setSelectedSegmentIndex(null);
    setSelectedPickupId(null);
    setActiveLayer({ kind: 'body' });
    updateHistoryState();
  };

  const handleUndo = () => {
    const prev = historyRef.current.undo(docRef.current);
    if (prev) applyDoc(prev);
  };

  const handleRedo = () => {
    const next = historyRef.current.redo(docRef.current);
    if (next) applyDoc(next);
  };

  // Template switching - checks built-in blueprints first, then falls back
  // to a user-saved template, since both are applied the same way.
  const handleSelectTemplate = (templateId: string) => {
    const template = REFERENCE_TEMPLATES[templateId] ?? getUserTemplate(templateId);
    if (!template) return;

    handleUpdateProject((prev) => ({
      ...prev,
      activeTemplateId: templateId,
      // Built-in blueprints and user templates both reference hardware by id,
      // and for those this build's table is the authority - so resolve fresh
      // rather than carrying over whatever the previous project had embedded.
      // Remaps the template's own legacy neckPresetId to its curated
      // equivalent (see neckPresetFieldsForNewTemplate) so the Neck picker
      // lands on one of the 4 offered choices, not a foreign 5th row.
      ...neckPresetFieldsForNewTemplate(template.neckPresetId, templateId),
      neckJointMechanism: defaultNeckJointMechanism(templateId),
      ...bridgePresetFields(template.bridgePresetId),
      contour: {
        anchors: JSON.parse(JSON.stringify(template.defaultAnchors)),
        closed: true,
      },
      // A blueprint's edge treatment belongs to its outline. This also
      // restores every bevelIntensity embedded in defaultAnchors; selecting
      // a blueprint with no profile explicitly returns the body to Slab.
      edgeProfile: template.edgeProfile
        ? JSON.parse(JSON.stringify(template.edgeProfile))
        : undefined,
      // No blueprint or user template carries a binding choice yet - reset
      // explicitly rather than via the `...prev` spread above, so a binding
      // picked on the previous body doesn't linger on an unrelated new one.
      binding: undefined,
      pickups: JSON.parse(JSON.stringify(template.defaultPickups)),
      pickguards: JSON.parse(JSON.stringify(template.defaultPickguards ?? [])),
      frontRoutes: JSON.parse(JSON.stringify(template.defaultFrontRoutes ?? [])),
      backRoutes: JSON.parse(JSON.stringify(template.defaultBackRoutes ?? [])),
      settings: {
        ...prev.settings,
        name: `Custom ${template.name}`,
      },
    }));
    setSelectedAnchorIds(new Set());
    setSelectedSegmentIndex(null);
    setSelectedPickupId(null);
    setActiveLayer({ kind: 'body' });
  };

  const handleResetTemplate = () => {
    handleSelectTemplate(project.activeTemplateId);
  };

  // Anchor, segment and pickup selection are mutually exclusive - the Inspector
  // shows one set of controls, and it should never be ambiguous which one an
  // action applies to.
  const handleSelectAnchor = (id: string | null, shiftKey = false) => {
    if (id === null) {
      setSelectedAnchorIds(new Set());
      return;
    }
    setSelectedAnchorIds((prev) => {
      if (!shiftKey) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedSegmentIndex(null);
    setSelectedPickupId(null);
  };

  const handleSelectSegment = (index: number | null) => {
    setSelectedSegmentIndex(index);
    if (index !== null) {
      setSelectedAnchorIds(new Set());
      setSelectedPickupId(null);
    }
  };

  const handleSelectPickup = (id: string | null) => {
    setSelectedPickupId(id);
    if (id) {
      setSelectedAnchorIds(new Set());
      setSelectedSegmentIndex(null);
    }
  };

  const handleToggleSegmentStraight = () => {
    if (selectedSegmentIndex === null) return;
    handleUpdateProject((prev) => {
      const active = getActiveContour(prev, activeLayer);
      if (!active) return prev;
      const { anchors, closed } = active;
      const straight = isSegmentStraight(anchors, selectedSegmentIndex, closed);
      return withActiveContour(prev, activeLayer, {
        ...active,
        anchors: straight
          ? curveSegment(anchors, selectedSegmentIndex, closed)
          : straightenSegment(anchors, selectedSegmentIndex, closed),
      });
    });
  };

  // De Casteljau Bezier Curve Splitting (Add Node on Segment)
  const handleAddAnchorOnSegment = () => {
    const activeContour = getActiveContour(project, activeLayer);
    if (!activeContour) return;
    const idx =
      selectedSegmentIndex ??
      activeContour.anchors.findIndex((a) => a.id === selectedAnchorId);
    if (idx === undefined || idx < 0) return;

    // Split up front: React runs the updater after this handler returns, so an id
    // read from inside it would still be empty when we go to select the new node.
    let anchors = insertAnchorOnSegment(activeContour.anchors, idx, 0.5);
    const insertedId = anchors[idx + 1]?.id;
    // Live-centerline mirroring only exists for the body - pickguards and
    // routed cavities have no symmetry concept in this version.
    if (insertedId && activeLayer.kind === 'body') {
      anchors = withMirroredInsertion(anchors, insertedId, project.settings.symmetry, activeContour.closed);
    }

    handleUpdateProject((prev) => withActiveContour(prev, activeLayer, { ...activeContour, anchors }));
    if (insertedId) handleSelectAnchor(insertedId);
  };

  // Delete Anchor(s)
  const handleDeleteSelectedAnchors = () => {
    if (selectedAnchorIds.size === 0) return;
    handleUpdateProject((prev) => {
      const active = getActiveContour(prev, activeLayer);
      if (!active) return prev;
      const { anchors } = active;

      if (selectedAnchorIds.size === 1) {
        const id = [...selectedAnchorIds][0];
        const selected = anchors.find((a) => a.id === id);
        // Mirrored-partner deletion is a body-only, live-centerline concept.
        const partner =
          activeLayer.kind === 'body' && prev.settings.symmetry.mode === 'live_centerline' && selected?.mirrorId
            ? anchors.find((a) => a.id === selected.mirrorId && !a.locked)
            : undefined;

        // Matches the InspectorPanel's delete-button floor - don't let a paired
        // delete drop the contour below a usable node count. Falls back to
        // deleting just the selected anchor rather than blocking the action.
        const idsToRemove =
          partner && anchors.length - 2 >= MIN_ANCHOR_COUNT ? [id, partner.id] : [id];

        return withActiveContour(prev, activeLayer, {
          ...active,
          anchors: anchors.filter((a) => !idsToRemove.includes(a.id)),
        });
      }

      // Bulk delete: remove exactly the selected set. Deliberately not
      // cascading to mirror partners the way single-delete does - a
      // multi-selection is already an explicit set the user built by
      // shift-clicking; auto-expanding it with hidden partners would make
      // "delete these N" silently delete more than N.
      if (anchors.length - selectedAnchorIds.size < MIN_ANCHOR_COUNT) return prev;
      return withActiveContour(prev, activeLayer, {
        ...active,
        anchors: anchors.filter((a) => !selectedAnchorIds.has(a.id)),
      });
    });
    setSelectedAnchorIds(new Set());
  };

  // A locked shape can't become the active layer - same "locked doesn't
  // hit-test" rule the guide image already follows.
  const isLayerLocked = (layer: ActiveLayer): boolean => {
    switch (layer.kind) {
      case 'body':
        return false;
      case 'pickguard':
        return (project.pickguards ?? []).find((p) => p.id === layer.id)?.locked ?? false;
      case 'frontRoute':
        return (project.frontRoutes ?? []).find((r) => r.id === layer.id)?.locked ?? false;
      case 'backRoute':
        return (project.backRoutes ?? []).find((r) => r.id === layer.id)?.locked ?? false;
    }
  };

  const handleSetActiveLayer = (layer: ActiveLayer) => {
    if (isLayerLocked(layer)) return;
    setActiveLayer(layer);
    setSelectedAnchorIds(new Set());
    setSelectedSegmentIndex(null);
  };

  const handleAddPickguard = () => {
    const { project: next, layer } = addingPickguard(project);
    handleUpdateProject(() => next);
    handleSetActiveLayer(layer);
  };

  const handleAddFrontRoute = () => {
    const { project: next, layer } = addingFrontRoute(project);
    handleUpdateProject(() => next);
    handleSetActiveLayer(layer);
  };

  const handleAddBackRoute = () => {
    const { project: next, layer } = addingBackRoute(project);
    handleUpdateProject(() => next);
    handleSetActiveLayer(layer);
  };

  const handleDeleteLayerShape = (layer: Exclude<ActiveLayer, { kind: 'body' }>) => {
    handleUpdateProject((prev) => deletingLayerShape(prev, layer));
    if (activeLayer.kind === layer.kind && 'id' in activeLayer && activeLayer.id === layer.id) {
      setActiveLayer({ kind: 'body' });
    }
  };

  const handleAddPickup = (type: PickupType) => {
    const { project: next, id } = addingPickup(project, type);
    handleUpdateProject(() => next);
    handleSelectPickup(id);
  };

  const handleDeletePickup = (id: string) => {
    handleUpdateProject((prev) => removingPickup(prev, id));
    if (selectedPickupId === id) setSelectedPickupId(null);
  };

  const handleDeleteSelectedPickup = () => {
    if (selectedPickupId) handleDeletePickup(selectedPickupId);
  };

  // Save the project as a .axe.svg - a printable 1:1 true-scale SVG that
  // also embeds the full project data, so it doubles as the save file.
  const downloadProjectSVG = () => {
    const svgString = exportProjectToSVG(project);
    downloadSVGFile(buildProjectFilename(project.settings.name), svgString);
  };

  const handleSaveProject = () => {
    if (!hasSeenSaveInfoRef.current) {
      setIsSaveInfoModalOpen(true);
      return;
    }
    downloadProjectSVG();
  };

  const handleShareProject = async () => {
    const svgString = exportProjectToSVG(project);
    const filename = buildProjectFilename(project.settings.name);
    const file = new File([svgString], filename, { type: 'image/svg+xml' });

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({
          title: project.settings.name,
          text: 'An electric guitar body design made with Axe Shaper.',
          files: [file],
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    downloadSVGFile(filename, svgString);
    alert('This browser cannot share project files directly, so the .axe.svg was downloaded instead.');
  };

  const handleView3D = async () => {
    // Open the tab synchronously, inside the click's user gesture, so
    // popup blockers don't get involved - the URL isn't ready yet, so it
    // starts blank and gets redirected below. `noopener` isn't used here
    // because we need the handle back to set that URL, and the destination
    // is our own first-party viewer, not third-party content.
    const newTab = window.open('', '_blank');
    try {
      const path = await buildViewer3DPath(withEmbeddedPresets(project));
      if (newTab) {
        newTab.location.href = path;
      } else {
        window.location.href = path;
      }
    } catch {
      newTab?.close();
      alert('This browser can’t open the 3D view. Try updating it or use a different browser.');
    }
  };

  const closeWelcome = () => {
    try {
      window.localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    } catch {
      // The guide can still close when storage is blocked.
    }
    setIsWelcomeModalOpen(false);
  };

  const handleContinueFromSaveInfo = () => {
    hasSeenSaveInfoRef.current = true;
    setIsSaveInfoModalOpen(false);
    downloadProjectSVG();
  };

  // Open a .axe.svg project file.
  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // loadProject is the gate: it migrates a version 1/2 file to the
      // current schema, and refuses a payload this build must not edit - a
      // future schema version, or an instrument/string-count combination it
      // cannot draw - with a message written to be shown as-is.
      const result = loadProject(extractProjectFromSVG(text));
      if (result.ok) {
        handleUpdateProject(() => result.project);
        setSelectedAnchorIds(new Set());
        setSelectedSegmentIndex(null);
        setSelectedPickupId(null);
        setActiveLayer({ kind: 'body' });
      } else {
        alert(result.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /**
   * Open the plan named by `?plan=`, so a link like the public page's "Open it
   * in the editor" arrives with that drawing already on the canvas instead of
   * the default project.
   *
   * Two details matter. The plan is set with `setProject`, not
   * `handleUpdateProject`, so it becomes the baseline document rather than an
   * undoable edit on top of a default nobody chose. And the parameter is
   * stripped from the URL once it has been applied, so a later reload cannot
   * silently throw away work by loading the plan a second time.
   */
  useEffect(() => {
    const src = planParamFromLocation();
    if (!src) return;
    let cancelled = false;

    void (async () => {
      let imported: StoredProject | null = null;
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        imported = extractProjectFromSVG(await response.text());
      } catch {
        imported = null;
      }
      if (cancelled) return;

      const result = loadProject(imported);
      if (result.ok) {
        setProject(result.project);
        // They came to look at a specific drawing, not to be onboarded.
        setIsWelcomeModalOpen(false);
      } else {
        alert(`${result.message} The editor started from the default project instead.`);
      }
      window.history.replaceState(null, '', window.location.pathname);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = `${project.settings.name} — Axe Shaper Editor`;
  }, [project.settings.name]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAnchorIds.size > 0) {
          e.preventDefault();
          handleDeleteSelectedAnchors();
        } else if (selectedPickupId) {
          e.preventDefault();
          handleDeleteSelectedPickup();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnchorIds, selectedPickupId, canUndo, canRedo]);

  return (
    <div className={`app-container${mobilePanel ? ` mobile-panel-${mobilePanel}` : ''}`}>
      <Header
        project={project}
        onUpdateProject={handleUpdateProject}
        onEndEdit={endEdit}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onResetTemplate={handleResetTemplate}
        onSave={handleSaveProject}
        onShare={handleShareProject}
        onView3D={handleView3D}
        onPrintTiled={(paper) => printTiledProject(project, paper)}
        onShowWelcome={() => setIsWelcomeModalOpen(true)}
        onShowAbout={() => setIsAboutModalOpen(true)}
        onOpenFile={handleOpenFile}
      />

      <nav className="mobile-editor-nav" aria-label="Editor panels">
        <button
          className={`mobile-editor-nav-button ${mobilePanel === 'tools' ? 'active' : ''}`}
          onClick={() => setMobilePanel((panel) => (panel === 'tools' ? null : 'tools'))}
          aria-expanded={mobilePanel === 'tools'}
          aria-controls="editor-tools"
        >
          {mobilePanel === 'tools' ? <X size={18} /> : <PanelLeft size={18} />}
          Tools
        </button>
        <button
          className={`mobile-editor-nav-button ${mobilePanel === 'inspector' ? 'active' : ''}`}
          onClick={() => setMobilePanel((panel) => (panel === 'inspector' ? null : 'inspector'))}
          aria-expanded={mobilePanel === 'inspector'}
          aria-controls="editor-inspector"
        >
          {mobilePanel === 'inspector' ? <X size={18} /> : <SlidersHorizontal size={18} />}
          Inspect
        </button>
      </nav>

      <div id="editor-tools" className="responsive-panel-wrap tools-panel-wrap">
      <button className="responsive-panel-close" onClick={() => setMobilePanel(null)} aria-label="Close tools panel">
        <X size={18} /> Close tools
      </button>
      <Sidebar
        project={project}
        onUpdateProject={handleUpdateProject}
        onSelectTemplate={handleSelectTemplate}
        guideImage={guideImage}
        onUploadGuideImage={handleUploadGuideImage}
        onUpdateGuideImage={handleUpdateGuideImage}
        onEndEdit={endEdit}
        onClearGuideImage={handleClearGuideImage}
        calibration={calibration}
        onStartCalibration={handleStartCalibration}
        onCancelCalibration={handleCancelCalibration}
        activeLayer={activeLayer}
        onSetActiveLayer={handleSetActiveLayer}
        onAddPickguard={handleAddPickguard}
        onAddFrontRoute={handleAddFrontRoute}
        onAddBackRoute={handleAddBackRoute}
        onDeleteLayerShape={handleDeleteLayerShape}
        selectedPickupId={selectedPickupId}
        onSelectPickup={handleSelectPickup}
        onAddPickup={handleAddPickup}
        onDeletePickup={handleDeletePickup}
        handleAngleSnap={handleAngleSnap}
        onHandleAngleSnapChange={(preference) => {
          setHandleAngleSnap(preference);
          saveHandleAngleSnapPreference(preference);
        }}
      />
      </div>

      <CanvasWorkspace
        project={project}
        selectedAnchorIds={selectedAnchorIds}
        onSelectAnchor={handleSelectAnchor}
        selectedSegmentIndex={selectedSegmentIndex}
        onSelectSegment={handleSelectSegment}
        selectedPickupId={selectedPickupId}
        onSelectPickup={handleSelectPickup}
        onCursorMove={setCursorPos}
        onUpdateProject={handleUpdateProject}
        onBeginEdit={beginEdit}
        onEndEdit={endEdit}
        guideImage={guideImage}
        onUpdateGuideImage={handleUpdateGuideImage}
        calibration={calibration}
        onCalibrationPick={handleCalibrationPick}
        onApplyCalibration={handleApplyCalibration}
        onCancelCalibration={handleCancelCalibration}
        activeLayer={activeLayer}
        handleAngleSnapIncrementDegrees={handleAngleSnap.enabled ? handleAngleSnap.incrementDegrees : null}
      />

      <div id="editor-inspector" className="responsive-panel-wrap inspector-panel-wrap">
      <button className="responsive-panel-close" onClick={() => setMobilePanel(null)} aria-label="Close inspector panel">
        <X size={18} /> Close inspector
      </button>
      <InspectorPanel
        project={project}
        selectedAnchorIds={selectedAnchorIds}
        selectedSegmentIndex={selectedSegmentIndex}
        selectedPickupId={selectedPickupId}
        cursorPos={cursorPos}
        onUpdateProject={handleUpdateProject}
        onEndEdit={endEdit}
        onDeleteSelectedAnchors={handleDeleteSelectedAnchors}
        onAddAnchorOnSegment={handleAddAnchorOnSegment}
        onToggleSegmentStraight={handleToggleSegmentStraight}
        onDeleteSelectedPickup={handleDeleteSelectedPickup}
        activeLayer={activeLayer}
      />
      </div>

      <WelcomeModal isOpen={isWelcomeModalOpen} onClose={closeWelcome} />
      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />

      <SaveInfoModal
        isOpen={isSaveInfoModalOpen}
        onClose={() => {
          // Dismissing without saving still counts as "seen" - otherwise the
          // next Save click would just reopen the same modal instead of saving.
          hasSeenSaveInfoRef.current = true;
          setIsSaveInfoModalOpen(false);
        }}
        onContinue={handleContinueFromSaveInfo}
      />
    </div>
  );
}

export function App(): React.JSX.Element {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/app') return <EditorApp />;
  return <MarketingSite path={path} />;
}

export default App;
