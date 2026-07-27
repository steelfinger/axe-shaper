import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { InspectorPanel } from './components/InspectorPanel';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { REFERENCE_TEMPLATES } from './constants/templates';
import type { GuitarProject, GuideImageState, CalibrationState, Vector2D } from './types/guitar';
import { insertAnchorOnSegment } from './utils/bezier';
import { HistoryManager } from './utils/history';
import { downloadSVGFile, exportProjectToSVG } from './utils/svgExporter';
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

export function App(): React.JSX.Element {
  const [project, setProject] = useState<GuitarProject>(INITIAL_PROJECT);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [isTemplateCodeModalOpen, setIsTemplateCodeModalOpen] = useState(false);
  const [guideImage, setGuideImage] = useState<GuideImageState>(INITIAL_GUIDE_IMAGE);

  const handleUploadGuideImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setGuideImage((prev) => ({
        ...prev,
        imageUrl: url,
        element: img,
        visible: true,
      }));
    };
    img.src = url;
  };

  const handleClearGuideImage = () => {
    if (guideImage.imageUrl) {
      URL.revokeObjectURL(guideImage.imageUrl);
    }
    setGuideImage(INITIAL_GUIDE_IMAGE);
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
    setGuideImage((prev) => ({
      ...prev,
      scale: prev.scale * factor,
      // Scaling happens about the image centre, so shift the image to keep the
      // first picked point where the user put it.
      offsetXMm: prev.offsetXMm + (p1.x - prev.offsetXMm) * (1 - factor),
      offsetYMm: prev.offsetYMm + (p1.y - prev.offsetYMm) * (1 - factor),
    }));
    setCalibration({ active: false, points: [] });
  };

  const historyRef = useRef(new HistoryManager());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateHistoryState = () => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  };

  // Helper to update project state and push to history stack
  const handleUpdateProject = (updater: (prev: GuitarProject) => GuitarProject) => {
    setProject((prev) => {
      historyRef.current.push(prev);
      const next = updater(prev);
      next.metadata.modified = new Date().toISOString();
      updateHistoryState();
      return next;
    });
  };

  // Snapshot before drag operations
  const handleDragStartHistory = () => {
    historyRef.current.push(project);
    updateHistoryState();
  };

  const handleUndo = () => {
    const prev = historyRef.current.undo(project);
    if (prev) {
      setProject(prev);
      updateHistoryState();
    }
  };

  const handleRedo = () => {
    const next = historyRef.current.redo(project);
    if (next) {
      setProject(next);
      updateHistoryState();
    }
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
  };

  const handleResetTemplate = () => {
    handleSelectTemplate(project.activeTemplateId);
  };

  // De Casteljau Bezier Curve Splitting (Add Node on Segment)
  const handleAddAnchorOnSegment = () => {
    if (!selectedAnchorId) return;
    const idx = project.contour.anchors.findIndex((a) => a.id === selectedAnchorId);
    if (idx === -1) return;

    handleUpdateProject((prev) => ({
      ...prev,
      contour: {
        ...prev.contour,
        anchors: insertAnchorOnSegment(prev.contour.anchors, idx, 0.5),
      },
    }));
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

  // Export 1:1 SVG
  const handleExportSVG = () => {
    const svgString = exportProjectToSVG(project);
    downloadSVGFile(`${project.settings.name.toLowerCase().replace(/\s+/g, '-')}-1to1-scale.svg`, svgString);
  };

  // Export JSON
  const handleExportJSON = () => {
    const jsonString = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.settings.name.toLowerCase().replace(/\s+/g, '-')}.guitar`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as GuitarProject;
        if (imported && imported.contour && imported.settings) {
          handleUpdateProject(() => imported);
          setSelectedAnchorId(null);
        } else {
          alert('Invalid .guitar project file format.');
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
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onResetTemplate={handleResetTemplate}
        onExportSVG={handleExportSVG}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onOpenTemplateCodeModal={() => setIsTemplateCodeModalOpen(true)}
      />

      <Sidebar
        project={project}
        onUpdateProject={handleUpdateProject}
        onSelectTemplate={handleSelectTemplate}
        guideImage={guideImage}
        onUploadGuideImage={handleUploadGuideImage}
        onUpdateGuideImage={setGuideImage}
        onClearGuideImage={handleClearGuideImage}
        calibration={calibration}
        onStartCalibration={handleStartCalibration}
        onCancelCalibration={handleCancelCalibration}
      />

      <CanvasWorkspace
        project={project}
        selectedAnchorId={selectedAnchorId}
        onSelectAnchor={setSelectedAnchorId}
        onUpdateProject={handleUpdateProject}
        onDragStartHistory={handleDragStartHistory}
        guideImage={guideImage}
        onUpdateGuideImage={setGuideImage}
        calibration={calibration}
        onCalibrationPick={handleCalibrationPick}
        onApplyCalibration={handleApplyCalibration}
        onCancelCalibration={handleCancelCalibration}
      />

      <InspectorPanel
        project={project}
        selectedAnchorId={selectedAnchorId}
        onUpdateProject={handleUpdateProject}
        onDeleteSelectedAnchor={handleDeleteSelectedAnchor}
        onAddAnchorOnSegment={handleAddAnchorOnSegment}
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
