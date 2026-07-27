import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { InspectorPanel } from './components/InspectorPanel';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { REFERENCE_TEMPLATES } from './constants/templates';
import type { GuitarProject, GuideImageState, CalibrationState, Vector2D } from './types/guitar';
import { curveSegment, insertAnchorOnSegment, isSegmentStraight, straightenSegment } from './utils/bezier';
import { HistoryManager } from './utils/history';
import { downloadSVGFile, exportProjectToSVG, extractProjectFromSVG } from './utils/svgExporter';
import { TemplateCodeModal } from './components/TemplateCodeModal';

const INITIAL_PROJECT: GuitarProject = {
  schemaVersion: 1,
  appVersion: '1.0.0',
  metadata: {
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    author: 'Axe Shaper Luthier',
  },
  settings: {
    name: 'Custom S-Style Build',
    unitDisplay: 'mm',
    canvasOrientation: 'vertical',
    symmetry: {
      mode: 'none',
      sourceSide: 'left',
    },
    showCenterAxis: true,
    showGhostGuide: true,
    showHardwareCavities: true,
    showDimensions: true,
    showGrid: true,
    gridSizeMm: 50,
    finishStyle: 'sunburst',
    bodyColor: '#3b82f6',
    secondaryColor: '#f59e0b',
    bodyFillOpacity: 0.35,
    pickguardEnabled: true,
    pickguardColor: '#ffffff',
  },
  activeTemplateId: 's_style',
  contour: {
    anchors: REFERENCE_TEMPLATES.s_style.defaultAnchors,
    closed: true,
  },
  neckPresetId: REFERENCE_TEMPLATES.s_style.neckPresetId,
  bridgePresetId: REFERENCE_TEMPLATES.s_style.bridgePresetId,
  pickups: REFERENCE_TEMPLATES.s_style.defaultPickups,
};

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

export function App(): React.JSX.Element {
  const [project, setProject] = useState<GuitarProject>(INITIAL_PROJECT);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [isTemplateCodeModalOpen, setIsTemplateCodeModalOpen] = useState(false);
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
    // Ids and segment indices may not survive a structural change
    setSelectedAnchorId(null);
    setSelectedSegmentIndex(null);
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

  // Template switching
  const handleSelectTemplate = (templateId: string) => {
    const template = REFERENCE_TEMPLATES[templateId];
    if (!template) return;

    handleUpdateProject((prev) => ({
      ...prev,
      activeTemplateId: templateId,
      neckPresetId: template.neckPresetId,
      bridgePresetId: template.bridgePresetId,
      contour: {
        anchors: JSON.parse(JSON.stringify(template.defaultAnchors)),
        closed: true,
      },
      pickups: JSON.parse(JSON.stringify(template.defaultPickups)),
      settings: {
        ...prev.settings,
        name: `Custom ${template.name}`,
      },
    }));
    setSelectedAnchorId(null);
    setSelectedSegmentIndex(null);
  };

  const handleResetTemplate = () => {
    handleSelectTemplate(project.activeTemplateId);
  };

  // Anchor and segment selection are mutually exclusive - the Inspector shows one
  // set of controls, and it should never be ambiguous which one an action applies to.
  const handleSelectAnchor = (id: string | null) => {
    setSelectedAnchorId(id);
    if (id) setSelectedSegmentIndex(null);
  };

  const handleSelectSegment = (index: number | null) => {
    setSelectedSegmentIndex(index);
    if (index !== null) setSelectedAnchorId(null);
  };

  const handleToggleSegmentStraight = () => {
    if (selectedSegmentIndex === null) return;
    handleUpdateProject((prev) => {
      const { anchors, closed } = prev.contour;
      const straight = isSegmentStraight(anchors, selectedSegmentIndex, closed);
      return {
        ...prev,
        contour: {
          ...prev.contour,
          anchors: straight
            ? curveSegment(anchors, selectedSegmentIndex, closed)
            : straightenSegment(anchors, selectedSegmentIndex, closed),
        },
      };
    });
  };

  // De Casteljau Bezier Curve Splitting (Add Node on Segment)
  const handleAddAnchorOnSegment = () => {
    const idx =
      selectedSegmentIndex ??
      project.contour.anchors.findIndex((a) => a.id === selectedAnchorId);
    if (idx === undefined || idx < 0) return;

    // Split up front: React runs the updater after this handler returns, so an id
    // read from inside it would still be empty when we go to select the new node.
    const anchors = insertAnchorOnSegment(project.contour.anchors, idx, 0.5);
    const insertedId = anchors[idx + 1]?.id;

    handleUpdateProject((prev) => ({ ...prev, contour: { ...prev.contour, anchors } }));
    if (insertedId) handleSelectAnchor(insertedId);
  };

  // Delete Anchor
  const handleDeleteSelectedAnchor = () => {
    if (!selectedAnchorId) return;
    handleUpdateProject((prev) => ({
      ...prev,
      contour: {
        ...prev.contour,
        anchors: prev.contour.anchors.filter((a) => a.id !== selectedAnchorId),
      },
    }));
    setSelectedAnchorId(null);
  };

  // Export 1:1 SVG - also the project save file, since it embeds the full
  // project data. The .axe.svg double extension marks it as such while
  // staying a plain, openable .svg for any other viewer.
  const handleExportSVG = () => {
    const svgString = exportProjectToSVG(project);
    downloadSVGFile(`${project.settings.name.toLowerCase().replace(/\s+/g, '-')}.axe.svg`, svgString);
  };

  // Open a project file - either the legacy .guitar/.json format, or an
  // exported SVG carrying embedded project data.
  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const isSVG = file.name.toLowerCase().endsWith('.svg') || text.trimStart().startsWith('<');
      try {
        const imported = isSVG ? extractProjectFromSVG(text) : (JSON.parse(text) as GuitarProject);
        if (imported && imported.contour && imported.settings) {
          handleUpdateProject(() => imported);
          setSelectedAnchorId(null);
          setSelectedSegmentIndex(null);
        } else {
          alert(isSVG ? 'This SVG does not contain Axe Shaper project data.' : 'Invalid .guitar project file format.');
        }
      } catch (err) {
        alert('Failed to parse project file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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
        if (selectedAnchorId) {
          e.preventDefault();
          handleDeleteSelectedAnchor();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnchorId, canUndo, canRedo]);

  return (
    <div className="app-container">
      <Header
        project={project}
        onUpdateProject={handleUpdateProject}
        onEndEdit={endEdit}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onResetTemplate={handleResetTemplate}
        onExportSVG={handleExportSVG}
        onOpenFile={handleOpenFile}
        onOpenTemplateCodeModal={() => setIsTemplateCodeModalOpen(true)}
      />

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
      />

      <CanvasWorkspace
        project={project}
        selectedAnchorId={selectedAnchorId}
        onSelectAnchor={handleSelectAnchor}
        selectedSegmentIndex={selectedSegmentIndex}
        onSelectSegment={handleSelectSegment}
        onUpdateProject={handleUpdateProject}
        onBeginEdit={beginEdit}
        onEndEdit={endEdit}
        guideImage={guideImage}
        onUpdateGuideImage={handleUpdateGuideImage}
        calibration={calibration}
        onCalibrationPick={handleCalibrationPick}
        onApplyCalibration={handleApplyCalibration}
        onCancelCalibration={handleCancelCalibration}
      />

      <InspectorPanel
        project={project}
        selectedAnchorId={selectedAnchorId}
        selectedSegmentIndex={selectedSegmentIndex}
        onUpdateProject={handleUpdateProject}
        onEndEdit={endEdit}
        onDeleteSelectedAnchor={handleDeleteSelectedAnchor}
        onAddAnchorOnSegment={handleAddAnchorOnSegment}
        onToggleSegmentStraight={handleToggleSegmentStraight}
      />

      <TemplateCodeModal
        project={project}
        isOpen={isTemplateCodeModalOpen}
        onClose={() => setIsTemplateCodeModalOpen(false)}
      />
    </div>
  );
}

export default App;
