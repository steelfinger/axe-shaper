import React, { useState } from 'react';
import { Layers, Palette, Shield, Image as ImageIcon, Trash2, Upload, Lock, Unlock, Eye, EyeOff, Ruler, Plus, Zap, Scissors, Info, CircleDot } from 'lucide-react';
import { NECK_PRESETS, PICKUP_SPECIFICATIONS } from '../constants/hardware';
import {
  DEFAULT_EDGE_PROFILES,
  EDGE_PROFILE_CONTROLS,
  EDGE_PROFILE_KINDS,
  EDGE_PROFILE_LABELS,
  edgeProfileKindOf,
  edgeProfileValue,
  isKnownEdgeProfileKind,
  type EdgeProfileKind,
} from '../constants/edgeProfiles';
import { BINDING_KINDS, BINDING_LABELS, bindingKindOf, bindingParamsFor, type BindingKind } from '../constants/binding';
import type {
  GuitarProject,
  GuideImageState,
  SymmetryMode,
  CalibrationState,
  NeckJointMechanism,
  NeckJointPlanParameters,
  PickguardPlacement,
  RoutedCavity,
  PickupType,
  SelectedHardwarePlacement,
  SwitchType,
} from '../types/guitar';
import {
  bridgePresetFields,
  convertLegacyNeckJointToCustom,
  documentedBlueprintNeckJoint,
  documentedBlueprintNeckPlacement,
  neckPresetFields,
  neckPresetFieldsForTemplate,
  offeredBridgePresets,
  offeredNeckPresets,
  offeredPickupTypes,
  resolveBridgePreset,
  resolveNeckPreset,
  resolvedNeckJointMechanism,
  withEmbeddedPresets,
} from '../utils/presets';
import {
  NeckJointContractError,
  neckJointCutterWarnings,
  requiredPocketWidthForHeelFit,
  updateCustomNeckPlacement,
  updateCustomNeckJoint,
  type CustomNeckJointUpdate,
} from '../utils/neckJointGeometry';
import { neckJointFabricationDisclosure } from '../utils/neckJointDisclosure';
import { type ActiveLayer, activeLayersEqual } from '../utils/layerShapes';
import { getSaddleYMm, getTheoreticalSaddleYMm } from '../utils/scaleMath';
import { GRID_PRESETS, formatLength, gridMinorDivisor, toDisplayUnits, toMm, unitLabel } from '../utils/units';
import { DecimalInput } from './DecimalInput';
import type { HandleAngleSnapPreference } from '../utils/handleAngleSnap';
import {
  MAX_BODY_THICKNESS_MM,
  MIN_BODY_THICKNESS_MM,
  resolvedBodyThickness,
} from '../utils/bodyThickness';
import { SWITCH_TYPE_LABELS } from '../utils/controlEditing';
import { CONTROL_DRAWING_GEOMETRY } from '../constants/planDrawingStyle';
import { archedTopConstructionForTemplate, isArchedTop } from '../utils/bodyTop';

interface SidebarProps {
  project: GuitarProject;
  onUpdateProject: (updater: (prev: GuitarProject) => GuitarProject, coalesceKey?: string) => void;
  guideImage: GuideImageState;
  onUploadGuideImage: (file: File) => void;
  onUpdateGuideImage: (
    updater: (prev: GuideImageState) => GuideImageState,
    coalesceKey?: string
  ) => void;
  /** Close a slider/typing gesture so the next one is its own undo step. */
  onEndEdit: () => void;
  onClearGuideImage: () => void;
  calibration: CalibrationState;
  onStartCalibration: () => void;
  onCancelCalibration: () => void;
  activeLayer: ActiveLayer;
  onSetActiveLayer: (layer: ActiveLayer) => void;
  onAddPickguard: () => void;
  onAddFrontRoute: () => void;
  onAddBackRoute: () => void;
  onDeleteLayerShape: (layer: Exclude<ActiveLayer, { kind: 'body' }>) => void;
  selectedHardware: SelectedHardwarePlacement | null;
  onSelectHardware: (selection: SelectedHardwarePlacement | null) => void;
  onAddPickup: (type: PickupType) => void;
  onDeletePickup: (id: string) => void;
  onAddPotentiometer: () => void;
  onAddSwitch: (type: SwitchType) => void;
  onDeleteHardware: (selection: SelectedHardwarePlacement) => void;
  handleAngleSnap: HandleAngleSnapPreference;
  onHandleAngleSnapChange: (preference: HandleAngleSnapPreference) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  project,
  onUpdateProject,
  guideImage,
  onUploadGuideImage,
  onUpdateGuideImage,
  onEndEdit,
  onClearGuideImage,
  calibration,
  onStartCalibration,
  onCancelCalibration,
  activeLayer,
  onSetActiveLayer,
  onAddPickguard,
  onAddFrontRoute,
  onAddBackRoute,
  onDeleteLayerShape,
  selectedHardware,
  onSelectHardware,
  onAddPickup,
  onDeletePickup,
  onAddPotentiometer,
  onAddSwitch,
  onDeleteHardware,
  handleAngleSnap,
  onHandleAngleSnapChange,
}) => {
  const [activeTab, setActiveTab] = useState<'body' | 'hardware' | 'layers' | 'guide'>('body');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [bodyThicknessError, setBodyThicknessError] = useState<string | null>(null);
  const [jointGeometryError, setJointGeometryError] = useState<string | null>(null);
  const [neckPlacementError, setNeckPlacementError] = useState<string | null>(null);
  const [neckPlacementDraftMm, setNeckPlacementDraftMm] = useState<number | null>(null);

  const edgeProfileKind = edgeProfileKindOf(project.edgeProfile);
  const knownEdgeKind: EdgeProfileKind = isKnownEdgeProfileKind(edgeProfileKind) ? edgeProfileKind : 'slab';
  const edgeProfileControls = isKnownEdgeProfileKind(edgeProfileKind)
    ? EDGE_PROFILE_CONTROLS[edgeProfileKind]
    : [];

  const bodyTopConstruction = project.bodyTop?.construction;
  const archedTop = isArchedTop(bodyTopConstruction);
  const edgeTreatmentValue = archedTop ? 'arched_top' : edgeProfileKind;

  /**
   * The five choices are one list because they are genuinely exclusive: a
   * carved top *is* the top-face treatment, so Arched Top writes Slab into
   * `edgeProfile` rather than leaving a bevel behind it.
   *
   * Writing it matters. `bevelInsetLoop` draws the top-face boundary on the
   * canvas and into the exported plan from `edgeProfile` alone, and it is
   * right to: `bodyTop` is a preview construction and must never move the
   * drawing (docs/AXE_SVG_FORMAT.md). Leaving a bevel stored and merely
   * hiding its controls is what printed a boundary the sidebar no longer
   * admitted to. Changing the document instead keeps the plan honest, makes
   * per-node edge intensity genuinely inert (only Beveled and German Carve
   * ever read it), and leaves both 3D previews free to draw the straight
   * wall they already draw.
   *
   * Changing the kind replaces the profile outright rather than merging: the
   * field sets don't overlap, so spreading would leave a beveled profile
   * carrying the slab's easeMm. Re-picking the kind the document already
   * carries keeps its tuned values - coming back from Arched Top to Slab
   * must not stamp a fresh one over the slab already there. An absent
   * profile stays absent, which is what absence already means.
   *
   * Per-anchor bevelIntensity is untouched either way - it lives on the
   * contour, and those values are what make a bevel follow the outline
   * instead of running at a constant width. Arched Top costs the shape of a
   * bevel, not the work of aiming one.
   */
  const handleEdgeTreatmentChange = (kind: string) => {
    onUpdateProject((prev) => {
      const storedKind = edgeProfileKindOf(prev.edgeProfile);
      if (kind === 'arched_top') {
        return {
          ...prev,
          bodyTop: { construction: archedTopConstructionForTemplate(prev.activeTemplateId) },
          // An absent profile already means Slab, so leave it absent.
          ...(storedKind === 'slab' ? {} : { edgeProfile: { ...DEFAULT_EDGE_PROFILES.slab } }),
        };
      }
      if (!isKnownEdgeProfileKind(kind)) return prev;
      const { bodyTop: _bodyTop, ...flatTop } = prev;
      return storedKind === kind ? flatTop : { ...flatTop, edgeProfile: { ...DEFAULT_EDGE_PROFILES[kind] } };
    });
  };

  const bindingKind = bindingKindOf(project.binding);
  const showsAdvancedBindingAdvisory = bindingKind !== 'none' && edgeProfileKind !== 'slab';

  const handleBindingKindChange = (kind: BindingKind) => {
    onUpdateProject((prev) => ({ ...prev, binding: bindingParamsFor(kind) }));
  };

  /** Editing a dimension spreads, so keys this build has no model for survive. */
  const handleEdgeProfileValueChange = (field: string, valueMm: number) => {
    onUpdateProject(
      (prev) => ({
        ...prev,
        edgeProfile: { ...(prev.edgeProfile ?? DEFAULT_EDGE_PROFILES[knownEdgeKind]), [field]: valueMm },
      }),
      `edgeProfile.${field}`
    );
  };

  const bodyThicknessMm = resolvedBodyThickness(project);
  // formatLength gives imperial values one extra digit, so this yields one
  // decimal place in millimetres and three in inches.
  const bodyThicknessDigits = project.settings.unitDisplay === 'mm' ? 1 : 2;
  const bodyThicknessOutOfEditableRange =
    bodyThicknessMm < MIN_BODY_THICKNESS_MM || bodyThicknessMm > MAX_BODY_THICKNESS_MM;

  const commitBodyThickness = (input: HTMLInputElement) => {
    const nextMm = toMm(Number(input.value), project.settings.unitDisplay);
    if (!Number.isFinite(nextMm) || nextMm < MIN_BODY_THICKNESS_MM || nextMm > MAX_BODY_THICKNESS_MM) {
      setBodyThicknessError(
        `Enter ${formatLength(MIN_BODY_THICKNESS_MM, project.settings.unitDisplay, bodyThicknessDigits)}–${formatLength(MAX_BODY_THICKNESS_MM, project.settings.unitDisplay, bodyThicknessDigits)} ${unitLabel(project.settings.unitDisplay)}.`
      );
      input.value = formatLength(bodyThicknessMm, project.settings.unitDisplay, bodyThicknessDigits);
      return;
    }
    setBodyThicknessError(null);
    onUpdateProject((prev) => ({ ...prev, bodyThicknessMm: nextMm }));
    onEndEdit();
  };

  type LayerShapeKind = 'pickguard' | 'frontRoute' | 'backRoute';

  const toggleField = <T extends { id: string }>(arr: T[], id: string, patch: (item: T) => Partial<T>): T[] =>
    arr.map((item) => (item.id === id ? { ...item, ...patch(item) } : item));

  const handleToggleShapeVisible = (kind: LayerShapeKind, id: string) => {
    onUpdateProject((prev) => {
      switch (kind) {
        case 'pickguard':
          return { ...prev, pickguards: toggleField(prev.pickguards ?? [], id, (s) => ({ visible: s.visible === false })) };
        case 'frontRoute':
          return { ...prev, frontRoutes: toggleField(prev.frontRoutes ?? [], id, (s) => ({ visible: s.visible === false })) };
        case 'backRoute':
          return { ...prev, backRoutes: toggleField(prev.backRoutes ?? [], id, (s) => ({ visible: s.visible === false })) };
      }
    });
  };

  const handleToggleShapeLocked = (kind: LayerShapeKind, id: string) => {
    onUpdateProject((prev) => {
      switch (kind) {
        case 'pickguard':
          return { ...prev, pickguards: toggleField(prev.pickguards ?? [], id, (s) => ({ locked: !(s.locked ?? false) })) };
        case 'frontRoute':
          return { ...prev, frontRoutes: toggleField(prev.frontRoutes ?? [], id, (s) => ({ locked: !(s.locked ?? false) })) };
        case 'backRoute':
          return { ...prev, backRoutes: toggleField(prev.backRoutes ?? [], id, (s) => ({ locked: !(s.locked ?? false) })) };
      }
    });
  };

  const renderLayerShapeList = (
    kind: LayerShapeKind,
    shapes: (PickguardPlacement | RoutedCavity)[],
    emptyLabel: string
  ) => (
    <>
      {shapes.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{emptyLabel}</p>
      ) : (
        shapes.map((shape, i) => {
          const layer: Exclude<ActiveLayer, { kind: 'body' }> = { kind, id: shape.id };
          const isActive = activeLayersEqual(activeLayer, layer);
          const locked = shape.locked ?? false;
          return (
            <div
              key={shape.id}
              onClick={() => onSetActiveLayer(layer)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: isActive ? 'rgba(147, 51, 234, 0.15)' : 'var(--bg-primary)',
                border: isActive ? '1px solid #9333ea' : '1px solid var(--panel-border)',
                marginBottom: '6px',
                cursor: locked ? 'not-allowed' : 'pointer',
                opacity: locked && !isActive ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{shape.name || `Shape ${i + 1}`}</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button
                  className="btn btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleShapeVisible(kind, shape.id);
                  }}
                  style={{ padding: '4px 6px', border: 'none', background: 'transparent' }}
                  title={shape.visible === false ? 'Show' : 'Hide'}
                >
                  {shape.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleShapeLocked(kind, shape.id);
                  }}
                  style={{
                    padding: '4px 6px',
                    border: 'none',
                    background: 'transparent',
                    color: locked ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  }}
                  title={locked ? 'Unlock' : 'Lock'}
                >
                  {locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLayerShape(layer);
                  }}
                  style={{ padding: '4px 6px', border: 'none', background: 'transparent', color: 'var(--accent-red)' }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })
      )}
    </>
  );

  const { settings, neckPresetId, bridgePresetId } = project;
  // Resolved, so the spec readouts below describe the hardware the design is
  // actually drawn against - which, on a file from another build, need not be
  // what this app's table has under that id.
  const currentNeck = resolveNeckPreset(project);
  const currentBridge = resolveBridgePreset(project);
  const currentMechanism = resolvedNeckJointMechanism(project);
  const jointCutterWarnings = project.neckJointGeometry
    ? neckJointCutterWarnings(project.neckJointGeometry)
    : [];
  const jointFabricationDisclosure = neckJointFabricationDisclosure(project);

  /**
   * Re-resolve the neck for `neckId`/`mechanism` against the active body and
   * snap the neck-pocket shoulder anchors to the result's joint width - the
   * one piece of geometry both the Neck and Neck Joint pickers have to keep
   * in sync (the pocket's rout shape comes from the mechanism, not the neck,
   * but both pickers can change it).
   */
  const applyNeckJointChange = (
    prev: GuitarProject,
    neckId: string,
    mechanism: NeckJointMechanism
  ): GuitarProject => {
    // A v7 joint is its own authoritative contract. Changing scale/fret data
    // may update the compatibility mirrors, but must never replace the
    // profile, move its mouth anchors, or alter body-owned placement. A
    // construction change needs the explicit replacement flow (Release B),
    // not the legacy generic resolver below.
    if (prev.neckJointGeometry) {
      if (mechanism !== prev.neckJointGeometry.mechanism) return prev;
      return withEmbeddedPresets({ ...prev, ...neckPresetFields(neckId) });
    }
    const neckFields = neckPresetFieldsForTemplate(
      neckId,
      prev.activeTemplateId,
      mechanism,
      prev.instrumentType
    );
    const halfWidth = neckFields.neckPreset.jointWidthMm / 2;
    const updatedAnchors = prev.contour.anchors.map((a) => {
      if (a.semanticRole === 'neck_pocket_left') {
        return { ...a, position: { ...a.position, x: -halfWidth } };
      }
      if (a.semanticRole === 'neck_pocket_right') {
        return { ...a, position: { ...a.position, x: halfWidth } };
      }
      return a;
    });
    return {
      ...prev,
      ...neckFields,
      neckJointMechanism: mechanism,
      contour: { ...prev.contour, anchors: updatedAnchors },
    };
  };

  const convertLegacyJoint = () => {
    try {
      // Compute before scheduling React's state update so a malformed legacy
      // contour becomes a visible field error, not an exception thrown from a
      // deferred state updater.
      const converted = convertLegacyNeckJointToCustom(project);
      onUpdateProject(() => converted);
      setJointGeometryError(null);
    } catch (error) {
      setJointGeometryError(error instanceof NeckJointContractError ? error.message : 'Could not convert the legacy neck joint.');
    }
  };

  const updateCustomJoint = (update: CustomNeckJointUpdate, coalesceKey: string) => {
    try {
      if (!project.neckJointGeometry || project.neckJointGeometry.mode !== 'custom') return;
      const resized = updateCustomNeckJoint(project.neckJointGeometry, project.contour, update);
      const updated = withEmbeddedPresets({ ...project, contour: resized.contour, neckJointGeometry: resized.geometry });
      // As above, validate the complete candidate before handing it to React.
      // This keeps failed numeric input local to the form instead of making
      // the application's update callback throw after the event handler ends.
      onUpdateProject(() => updated, coalesceKey);
      setJointGeometryError(null);
    } catch (error) {
      setJointGeometryError(error instanceof NeckJointContractError ? error.message : 'Could not change the neck-joint dimensions.');
    }
  };

  const changeCustomJointDimension = (
    parameter: keyof NeckJointPlanParameters,
    displayValue: number,
  ) => {
    const valueMm = toMm(displayValue, settings.unitDisplay);
    const joint = project.neckJointGeometry;
    if (!joint || joint.mode !== 'custom') return;
    const parameters: Partial<NeckJointPlanParameters> = { [parameter]: valueMm };
    if (joint.planShape === 'bolt_on_pocket' && joint.parameters.endTreatment === 'compound') {
      const deepWidthMm = parameter === 'deepEndWidthMm'
        ? valueMm
        : joint.parameters.deepEndWidthMm ?? joint.parameters.mouthWidthMm;
      const planLengthMm = parameter === 'planLengthMm' ? valueMm : joint.parameters.planLengthMm;
      parameters.deepEndWidthMm = deepWidthMm;
      parameters.mouthWidthMm = deepWidthMm - 2 * planLengthMm * Math.tan(0.84 * Math.PI / 180);
    }
    updateCustomJoint({ parameters }, `neck-joint-${parameter}`);
  };

  const resetNeckJointToBlueprint = () => {
    const joint = documentedBlueprintNeckJoint(project);
    if (!joint) return;
    onUpdateProject((prev) => {
      const reset = documentedBlueprintNeckJoint(prev);
      if (!reset) return prev;
      const halfWidth = reset.parameters.mouthWidthMm / 2;
      const contour = {
        ...prev.contour,
        anchors: prev.contour.anchors.map((anchor) => {
          if (anchor.id === reset.mouthAnchorIds[0]) return { ...anchor, locked: true, position: { ...anchor.position, x: -halfWidth, y: 0 } };
          if (anchor.id === reset.mouthAnchorIds[1]) return { ...anchor, locked: true, position: { ...anchor.position, x: halfWidth, y: 0 } };
          return anchor;
        }),
      };
      return withEmbeddedPresets({ ...prev, contour, neckJointGeometry: reset });
    }, 'neck-joint-reset-blueprint');
    setJointGeometryError(null);
    onEndEdit();
  };

  const applyCustomNeckPlacement = () => {
    if (!project.neckPlacement) return;
    const nextValue = neckPlacementDraftMm ?? project.neckPlacement.jointToReferenceFretMm;
    try {
      const placement = updateCustomNeckPlacement(
        project.neckPlacement,
        project.instrumentType,
        currentNeck.scaleLengthMm,
        nextValue,
      );
      onUpdateProject(
        (prev) => withEmbeddedPresets({ ...prev, neckPlacement: placement }),
        'neck-placement',
      );
      setNeckPlacementDraftMm(null);
      setNeckPlacementError(null);
      onEndEdit();
    } catch (error) {
      setNeckPlacementError(error instanceof NeckJointContractError ? error.message : 'Could not change neck placement.');
    }
  };

  const resetNeckPlacementToBlueprint = () => {
    const reset = documentedBlueprintNeckPlacement(project);
    if (!reset) return;
    onUpdateProject(
      (prev) => {
        const placement = documentedBlueprintNeckPlacement(prev);
        return placement ? withEmbeddedPresets({ ...prev, neckPlacement: placement }) : prev;
      },
      'neck-placement',
    );
    setNeckPlacementDraftMm(null);
    setNeckPlacementError(null);
    onEndEdit();
  };

  const bodyLayersPanel = (
    <div className="panel-section">
      <div className="section-title">
        <Layers size={16} /> Body Layers
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Editable shapes on top of the body outline - a pickguard, and cavities routed from the
        front or back. Select one to edit its own anchors and handles, exactly like the body.
      </p>

      <button
        type="button"
        className={`layer-body-choice${activeLayer.kind === 'body' ? ' is-selected' : ''}`}
        onClick={() => onSetActiveLayer({ kind: 'body' })}
      >
        Body Outline{activeLayer.kind === 'body' ? ' (editing)' : ''}
      </button>

      <div style={{ marginBottom: '16px' }}>
        <div className="layer-shape-heading">
          <span>Pickguard</span>
          <button className="btn btn-sm" onClick={onAddPickguard} title="Add a pickguard shape">
            <Plus size={13} /> Add
          </button>
        </div>
        {renderLayerShapeList('pickguard', project.pickguards ?? [], 'No pickguard yet.')}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div className="layer-shape-heading">
          <span>Front Routed Cavities</span>
          <button className="btn btn-sm" onClick={onAddFrontRoute} title="Add a front-routed cavity">
            <Plus size={13} /> Add
          </button>
        </div>
        {renderLayerShapeList('frontRoute', project.frontRoutes ?? [], 'No front routes yet.')}
      </div>

      <div>
        <div className="layer-shape-heading">
          <span>Back Routed Cavities</span>
          <button className="btn btn-sm" onClick={onAddBackRoute} title="Add a back-routed cavity">
            <Plus size={13} /> Add
          </button>
        </div>
        {renderLayerShapeList('backRoute', project.backRoutes ?? [], 'No back routes yet.')}
      </div>
    </div>
  );

  return (
    <aside className="app-sidebar">
      <div className="sidebar-tabs" role="tablist" aria-label="Editor tools">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'body'}
          className={`sidebar-tab ${activeTab === 'body' ? 'active' : ''}`}
          onClick={() => setActiveTab('body')}
        >
          Body
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'hardware'}
          className={`sidebar-tab ${activeTab === 'hardware' ? 'active' : ''}`}
          onClick={() => setActiveTab('hardware')}
        >
          Hardware
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'layers'}
          className={`sidebar-tab ${activeTab === 'layers' ? 'active' : ''}`}
          onClick={() => setActiveTab('layers')}
        >
          Layers
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'guide'}
          className={`sidebar-tab ${activeTab === 'guide' ? 'active' : ''}`}
          onClick={() => setActiveTab('guide')}
          title="Upload and transform a background guide image"
        >
          Guide
        </button>
      </div>

      <div className="sidebar-content">
        {/* BODY TAB */}
        {activeTab === 'body' && (
          <div>
            <div className="panel-section">
              <div className="section-title">
                <Scissors size={16} /> Body Construction
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Physical body dimensions and edge treatment used by the 3D preview.
              </p>

              <div className="form-group">
                <label className="form-label" htmlFor="body-thickness-input">Body Thickness</label>
                <div className="measured-input-row">
                  <input
                    key={`${settings.unitDisplay}-${bodyThicknessMm}`}
                    id="body-thickness-input"
                    type="number"
                    className="form-input measured-input"
                    defaultValue={formatLength(bodyThicknessMm, settings.unitDisplay, bodyThicknessDigits)}
                    min={toDisplayUnits(MIN_BODY_THICKNESS_MM, settings.unitDisplay)}
                    max={toDisplayUnits(MAX_BODY_THICKNESS_MM, settings.unitDisplay)}
                    step={settings.unitDisplay === 'mm' ? 0.5 : 0.01}
                    aria-invalid={bodyThicknessError !== null || bodyThicknessOutOfEditableRange}
                    aria-describedby="body-thickness-help"
                    onBlur={(event) => commitBodyThickness(event.currentTarget)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                  <span>{unitLabel(settings.unitDisplay)}</span>
                </div>
                <p
                  id="body-thickness-help"
                  style={{
                    fontSize: '0.75rem',
                    color: bodyThicknessError || bodyThicknessOutOfEditableRange ? 'var(--accent-red)' : 'var(--text-muted)',
                    marginTop: '4px',
                  }}
                >
                  {bodyThicknessError ?? (bodyThicknessOutOfEditableRange
                    ? `Saved value is outside the editable ${formatLength(MIN_BODY_THICKNESS_MM, settings.unitDisplay, bodyThicknessDigits)}–${formatLength(MAX_BODY_THICKNESS_MM, settings.unitDisplay, bodyThicknessDigits)} ${unitLabel(settings.unitDisplay)} range.`
                    : 'Stored in millimetres and carried into the 3D preview.')}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edge-treatment-select">Edge Treatment</label>
                <select
                  id="edge-treatment-select"
                  value={edgeTreatmentValue}
                  onChange={(e) => handleEdgeTreatmentChange(e.target.value)}
                  className="form-select"
                  aria-describedby="edge-treatment-help"
                >
                  <option value="arched_top">Arched Top</option>
                  {!isKnownEdgeProfileKind(edgeProfileKind) && (
                    <option value={edgeProfileKind}>{edgeProfileKind} (from file)</option>
                  )}
                  {EDGE_PROFILE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {EDGE_PROFILE_LABELS[kind]}
                    </option>
                  ))}
                </select>
                <p id="edge-treatment-help" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {bodyTopConstruction === 'carved_cap'
                    ? 'A raised crown in the 3D preview, with the stored thickness as the core below the rim. The plan stays the flat outline you print and cut.'
                    : bodyTopConstruction === 'solid_body_carve'
                      ? 'A crown carved into the stored overall thickness in the 3D preview. The plan stays the flat outline you print and cut.'
                      : 'Beveled and German Carve draw a top-face boundary on the plan; per-node edge intensities shape how far the treatment runs at each node. Arched Top carves the face in 3D instead, and sets the edge to Slab.'}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="binding-select">Binding</label>
                <select
                  id="binding-select"
                  value={bindingKind}
                  onChange={(e) => handleBindingKindChange(e.target.value as BindingKind)}
                  className="form-select"
                  aria-describedby={showsAdvancedBindingAdvisory ? 'binding-help binding-advisory' : 'binding-help'}
                >
                  <option value="none">{BINDING_LABELS.none}</option>
                  {BINDING_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {BINDING_LABELS[kind]}
                    </option>
                  ))}
                </select>
                <p id="binding-help" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Adds binding to the top edge or both edges. Binding is currently preview-only.
                </p>
                {showsAdvancedBindingAdvisory && (
                  <div
                    id="binding-advisory"
                    className="fabrication-advisory"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <Info size={16} aria-hidden="true" />
                    <div>
                      <strong>Advanced binding</strong>
                      <p>
                        Axe Shaper previews this binding but does not generate or validate its routing
                        channel. This edge may require a custom jig or CNC toolpath. Verify the routing
                        setup before cutting.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {edgeProfileControls.map((control) => {
                const valueMm = edgeProfileValue(project.edgeProfile, control, knownEdgeKind);
                // A file written by another build can carry a dimension wider than
                // this slider edits. Show the real number rather than the clamped
                // one, and say so, instead of quietly rewriting someone's plan the
                // first time they touch the control.
                const outOfRange = valueMm < control.minMm || valueMm > control.maxMm;
                return (
                  <div className="form-group" key={control.field} style={{ marginBottom: '12px' }}>
                    <label className="form-label">
                      {control.label}:{' '}
                      <strong>
                        {formatLength(valueMm, settings.unitDisplay, 1)} {unitLabel(settings.unitDisplay)}
                      </strong>
                    </label>
                    <input
                      type="range"
                      min={control.minMm}
                      max={control.maxMm}
                      step={control.stepMm}
                      value={valueMm}
                      onChange={(e) => handleEdgeProfileValueChange(control.field, parseFloat(e.target.value))}
                      onPointerUp={onEndEdit}
                      onBlur={onEndEdit}
                      style={{ width: '100%' }}
                    />
                    {outOfRange && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '4px' }}>
                        Saved as {formatLength(valueMm, settings.unitDisplay, 1)}{' '}
                        {unitLabel(settings.unitDisplay)}, outside the range editable here - moving
                        the slider will clamp it.
                      </p>
                    )}
                  </div>
                );
              })}

              {edgeProfileKind === 'contoured' && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  A radiused edge has no hard top-face boundary, so nothing extra is drawn on the plan.
                </p>
              )}
            </div>

            <div className="panel-section">
              <div className="section-title">
                <Palette size={16} /> Appearance
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="finish-style-select">Finish Style</label>
                <select
                  id="finish-style-select"
                  value={settings.finishStyle}
                  onChange={(event) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        finishStyle: event.target.value as GuitarProject['settings']['finishStyle'],
                      },
                    }))
                  }
                  className="form-select"
                >
                  <option value="sunburst">Vintage 3-Tone Sunburst</option>
                  <option value="flame_maple">Amber Flame Maple</option>
                  <option value="natural_wood">Natural Mahogany Wood</option>
                  <option value="solid">Solid Gloss Color</option>
                </select>
              </div>

              {settings.finishStyle === 'solid' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="body-color-input">Body Color</label>
                  <input
                    id="body-color-input"
                    type="color"
                    value={settings.bodyColor}
                    onChange={(event) =>
                      onUpdateProject(
                        (prev) => ({
                          ...prev,
                          settings: { ...prev.settings, bodyColor: event.target.value },
                        }),
                        'settings.bodyColor'
                      )
                    }
                    onBlur={onEndEdit}
                    className="body-color-input"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Body Fill: <strong>{(settings.bodyFillOpacity * 100).toFixed(0)}%</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.bodyFillOpacity}
                  onChange={(event) =>
                    onUpdateProject(
                      (prev) => ({
                        ...prev,
                        settings: { ...prev.settings, bodyFillOpacity: Number(event.target.value) },
                      }),
                      'settings.bodyFillOpacity'
                    )
                  }
                  onPointerUp={onEndEdit}
                  onBlur={onEndEdit}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Lower the fill while tracing a guide image; raise it to judge the finish on its own.
                </p>
              </div>
            </div>

            <div className="panel-section">
              <div className="section-title">
                <Shield size={16} /> Outline Editing
              </div>
              <div className="form-group">
                <label className="form-label">Symmetry Mode</label>
                <select
                  value={settings.symmetry.mode}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        symmetry: { ...prev.settings.symmetry, mode: e.target.value as SymmetryMode },
                      },
                    }))
                  }
                  className="form-select"
                >
                  <option value="none">Free-Form Asymmetrical Editing (Default)</option>
                  <option value="live_centerline">Live Centerline Mirroring</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* GUIDE TAB */}
        {activeTab === 'guide' && (
          <div>
            <div className="panel-section">
              <div className="section-title">
                <ImageIcon size={16} /> Background Reference Image
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Upload a blueprint photo or SVG design to trace over. Adjust position, scale, rotation, and opacity.
              </p>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadGuideImage(file);
                  e.target.value = '';
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={15} /> Upload Image
                </button>
                {guideImage.imageUrl && (
                  <>
                    <button
                      className={`btn btn-sm ${guideImage.locked ? 'btn-primary' : ''}`}
                      style={{
                        borderColor: guideImage.locked ? 'var(--accent-gold)' : 'var(--panel-border)',
                        color: guideImage.locked ? 'var(--accent-gold)' : 'var(--text-secondary)',
                      }}
                      onClick={() =>
                        onUpdateGuideImage((prev) => ({ ...prev, locked: !prev.locked }))
                      }
                      title={guideImage.locked ? 'Unlock Guide Image dragging' : 'Lock Guide Image dragging'}
                    >
                      {guideImage.locked ? <Lock size={15} /> : <Unlock size={15} />}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                      onClick={onClearGuideImage}
                      title="Remove guide image"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>

              {guideImage.imageUrl ? (
                <div>
                  {/* SCALE - calibration first, since it is the only exact method */}
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Image Scale</label>
                    <button
                      className={`btn btn-sm ${calibration.active ? '' : 'btn-primary'}`}
                      style={{ width: '100%', justifyContent: 'center', marginBottom: '8px' }}
                      onClick={calibration.active ? onCancelCalibration : onStartCalibration}
                      title="Click two points of known real-world distance to set the scale exactly"
                    >
                      <Ruler size={15} />
                      {calibration.active ? 'Cancel calibration' : 'Set scale by known distance'}
                    </button>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>
                          Image width ({unitLabel(settings.unitDisplay)})
                        </label>
                        <DecimalInput
                          className="form-input"
                          min={0.1}
                          step={settings.unitDisplay === 'mm' ? 0.5 : 0.05}
                          value={
                            guideImage.element
                              ? toDisplayUnits(guideImage.element.width * guideImage.scale, settings.unitDisplay)
                              : null
                          }
                          digits={1}
                          onValueChange={(v) => {
                            const widthMm = toMm(v, settings.unitDisplay);
                            const natural = guideImage.element?.width;
                            if (!natural || !(widthMm > 0)) return;
                            onUpdateGuideImage((prev) => ({ ...prev, scale: widthMm / natural }), 'guide:scale');
                          }}
                          onBlur={onEndEdit}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>
                          Scale factor
                        </label>
                        <DecimalInput
                          className="form-input"
                          min={0.001}
                          step={0.005}
                          value={guideImage.scale}
                          digits={4}
                          onValueChange={(v) => {
                            if (!(v > 0)) return;
                            onUpdateGuideImage((prev) => ({ ...prev, scale: v }), 'guide:scale');
                          }}
                          onBlur={onEndEdit}
                        />
                      </div>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Check your work against the grid: minor lines are{' '}
                      {formatLength(settings.gridSizeMm / gridMinorDivisor(settings.unitDisplay), settings.unitDisplay, 1)}{' '}
                      {unitLabel(settings.unitDisplay)}, major lines{' '}
                      {formatLength(settings.gridSizeMm, settings.unitDisplay, 1)}{' '}
                      {unitLabel(settings.unitDisplay)}.
                    </p>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">
                      Position Offset X:{' '}
                      <strong>
                        {formatLength(guideImage.offsetXMm, settings.unitDisplay, 0)}{' '}
                        {unitLabel(settings.unitDisplay)}
                      </strong>
                    </label>
                    <input
                      type="range"
                      min="-300"
                      max="300"
                      step="1"
                      value={guideImage.offsetXMm}
                      onChange={(e) =>
                        onUpdateGuideImage(
                          (prev) => ({ ...prev, offsetXMm: parseFloat(e.target.value) }),
                          'guide:offsetX'
                        )
                      }
                      onPointerUp={onEndEdit}
                      onBlur={onEndEdit}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">
                      Position Offset Y:{' '}
                      <strong>
                        {formatLength(guideImage.offsetYMm, settings.unitDisplay, 0)}{' '}
                        {unitLabel(settings.unitDisplay)}
                      </strong>
                    </label>
                    <input
                      type="range"
                      min="-200"
                      max="600"
                      step="1"
                      value={guideImage.offsetYMm}
                      onChange={(e) =>
                        onUpdateGuideImage(
                          (prev) => ({ ...prev, offsetYMm: parseFloat(e.target.value) }),
                          'guide:offsetY'
                        )
                      }
                      onPointerUp={onEndEdit}
                      onBlur={onEndEdit}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">
                      Rotation Angle: <strong>{guideImage.rotationDegrees.toFixed(0)}°</strong>
                    </label>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={guideImage.rotationDegrees}
                      onChange={(e) =>
                        onUpdateGuideImage(
                          (prev) => ({ ...prev, rotationDegrees: parseFloat(e.target.value) }),
                          'guide:rotation'
                        )
                      }
                      onPointerUp={onEndEdit}
                      onBlur={onEndEdit}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">
                      Image Opacity: <strong>{(guideImage.opacity * 100).toFixed(0)}%</strong>
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="1.0"
                      step="0.05"
                      value={guideImage.opacity}
                      onChange={(e) =>
                        onUpdateGuideImage(
                          (prev) => ({ ...prev, opacity: parseFloat(e.target.value) }),
                          'guide:opacity'
                        )
                      }
                      onPointerUp={onEndEdit}
                      onBlur={onEndEdit}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  No guide image loaded. Click upload above to load any instrument template photo or PNG.
                </p>
              )}
            </div>

          </div>
        )}

        {/* HARDWARE TAB */}
        {activeTab === 'hardware' && (
          <div>
            <div className="panel-section">
              <div className="section-title">Neck & Joint Presets</div>

              <div className="form-group">
                <label className="form-label">Neck & Scale Length</label>
                <select
                  value={neckPresetId}
                  onChange={(e) =>
                    onUpdateProject((prev) => applyNeckJointChange(prev, e.target.value, currentMechanism))
                  }
                  className="form-select"
                >
                  {offeredNeckPresets(project.instrumentType).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                  {/* A file can still carry one of the 9 original per-body ids
                      (every bundled blueprint does) - show its real name as an
                      extra, already-selected row instead of a foreign/unknown
                      value, exactly like axe-shaper-ios's own picker. Picking
                      one of the offered rows above replaces it. Guarded on the
                      id not already being offered, since a bass project's own
                      necks come from NECK_PRESETS and would otherwise appear
                      twice. */}
                  {NECK_PRESETS[neckPresetId] &&
                    !offeredNeckPresets(project.instrumentType).some((n) => n.id === neckPresetId) && (
                      <option key={neckPresetId} value={neckPresetId}>
                        {NECK_PRESETS[neckPresetId].name}
                      </option>
                    )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Neck Joint</label>
                <select
                  value={currentMechanism}
                  onChange={(e) =>
                    onUpdateProject((prev) =>
                      applyNeckJointChange(prev, neckPresetId, e.target.value as NeckJointMechanism)
                    )
                  }
                  className="form-select"
                  disabled={Boolean(project.neckJointGeometry)}
                  title={project.neckJointGeometry
                    ? project.neckJointGeometry.mode === 'locked'
                      ? 'This neck joint is locked to its selected profile.'
                      : 'Construction changes require creating a new custom joint.'
                    : undefined}
                >
                  <option value="bolt_on">Bolt-On</option>
                  <option value="glued">Glued</option>
                </select>
                {project.neckJointGeometry && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {project.neckJointGeometry.mode === 'locked'
                      ? 'Joint construction is locked to the selected profile.'
                      : 'Construction changes require creating a new custom joint.'}
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <div>• Scale Length: <strong>{currentNeck.scaleLengthMm} mm</strong> ({(currentNeck.scaleLengthMm / 25.4).toFixed(2)}")</div>
                <div>• Joint Pocket Width: <strong>{currentNeck.jointWidthMm} mm</strong></div>
                <div>• Joint Pocket Depth: <strong>{currentNeck.jointDepthMm} mm</strong></div>
                <div>• Nut-to-Joint: <strong>{currentNeck.nutToJointMm} mm</strong></div>
              </div>
            </div>

            <div className="panel-section">
              <div className="section-title">Neck Joint Geometry</div>
              {jointFabricationDisclosure && (
                <p className="panel-help" role="status">
                  <Info size={14} style={{ verticalAlign: 'text-bottom', marginRight: '5px', color: 'var(--accent-blue)' }} />
                  {jointFabricationDisclosure} DXF and print export require confirmation.
                </p>
              )}
              {!project.neckJointGeometry && project.instrumentType === 'bass' ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Generic bass pockets remain legacy-only while documented bass-joint profiles are researched.
                </p>
              ) : !project.neckJointGeometry ? (
                <>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    This design uses the frozen generic legacy pocket. Convert it to make a local custom joint; the body’s locked mouth anchors remain the attachment points.
                  </p>
                  <button type="button" className="btn btn-sm" onClick={convertLegacyJoint}>
                    Convert to Custom Joint
                  </button>
                </>
              ) : project.neckJointGeometry.mode === 'custom' ? (
                <>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Custom {project.neckJointGeometry.mechanism === 'bolt_on' ? 'bolt-on pocket' : 'glued mortise'}. Numeric changes keep the mouth anchors symmetric and reject a rout that leaves the body.
                  </p>
                  {project.neckJointGeometry.planShape !== 'bolt_on_pocket' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="neck-joint-mouth-width">Mouth Width</label>
                    <div className="measured-input-row">
                      <DecimalInput
                        id="neck-joint-mouth-width"
                        className="form-input measured-input"
                        value={toDisplayUnits(project.neckJointGeometry.parameters.mouthWidthMm, settings.unitDisplay)}
                        digits={settings.unitDisplay === 'mm' ? 3 : 4}
                        min={toDisplayUnits(0.001, settings.unitDisplay)}
                        step={settings.unitDisplay === 'mm' ? 0.1 : 0.005}
                        onValueChange={(value) => changeCustomJointDimension('mouthWidthMm', value)}
                        onBlur={onEndEdit}
                      />
                      <span>{unitLabel(settings.unitDisplay)}</span>
                    </div>
                  </div>
                  )}
                  <div className="form-group">
                    <label className="form-label" htmlFor="neck-joint-plan-length">Plan Length</label>
                    <div className="measured-input-row">
                      <DecimalInput
                        id="neck-joint-plan-length"
                        className="form-input measured-input"
                        value={toDisplayUnits(project.neckJointGeometry.parameters.planLengthMm, settings.unitDisplay)}
                        digits={settings.unitDisplay === 'mm' ? 3 : 4}
                        min={toDisplayUnits(
                          project.neckJointGeometry.parameters.endTreatment === 'rounded'
                            ? project.neckJointGeometry.parameters.endRoundnessMm
                            : project.neckJointGeometry.parameters.endCornerRadiusMm,
                          settings.unitDisplay,
                        )}
                        step={settings.unitDisplay === 'mm' ? 0.1 : 0.005}
                        onValueChange={(value) => changeCustomJointDimension('planLengthMm', value)}
                        onBlur={onEndEdit}
                      />
                      <span>{unitLabel(settings.unitDisplay)}</span>
                    </div>
                  </div>
                  {(project.neckJointGeometry.planShape === 'bolt_on_pocket'
                    || project.neckJointGeometry.planShape === 'tapered_mortise') && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="neck-joint-deep-width">
                        {project.neckJointGeometry.planShape === 'bolt_on_pocket' ? 'Pocket Width (Deep End)' : 'Deep-End Width'}
                      </label>
                      <div className="measured-input-row">
                        <DecimalInput
                          id="neck-joint-deep-width"
                          className="form-input measured-input"
                          value={toDisplayUnits(
                            project.neckJointGeometry.parameters.deepEndWidthMm
                              ?? project.neckJointGeometry.parameters.mouthWidthMm,
                            settings.unitDisplay,
                          )}
                          digits={settings.unitDisplay === 'mm' ? 3 : 4}
                          min={toDisplayUnits(
                            project.neckJointGeometry.planShape === 'bolt_on_pocket'
                              ? project.neckJointGeometry.parameters.mouthWidthMm
                              : 0.001,
                            settings.unitDisplay,
                          )}
                          step={settings.unitDisplay === 'mm' ? 0.1 : 0.005}
                          onValueChange={(value) => changeCustomJointDimension('deepEndWidthMm', value)}
                          onBlur={onEndEdit}
                        />
                        <span>{unitLabel(settings.unitDisplay)}</span>
                      </div>
                    </div>
                  )}
                  {project.neckJointGeometry.planShape === 'bolt_on_pocket' && (
                    <p className="panel-help" style={{ marginTop: '-4px' }}>
                      Mouth width: {formatLength(project.neckJointGeometry.parameters.mouthWidthMm, settings.unitDisplay, 3)} {unitLabel(settings.unitDisplay)}. It follows the stored pocket taper; the mouth anchors update symmetrically.
                    </p>
                  )}
                  {project.neckJointGeometry.targetHeelWidthMm === undefined ? (
                    <div className="form-group">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => updateCustomJoint(
                          {
                            targetHeelWidthMm: project.neckJointGeometry!.parameters.deepEndWidthMm
                              ?? project.neckJointGeometry!.parameters.mouthWidthMm,
                            fittingClearanceMm: 0,
                          },
                          'neck-joint-fit-target',
                        )}
                      >
                        Add Heel Fit Target
                      </button>
                    </div>
                  ) : (() => {
                    const joint = project.neckJointGeometry!;
                    const deepEndWidthMm = joint.parameters.deepEndWidthMm ?? joint.parameters.mouthWidthMm;
                    const targetHeelWidthMm = joint.targetHeelWidthMm!;
                    const requiredWidthMm = requiredPocketWidthForHeelFit(joint)!;
                    const availablePerSideMm = (deepEndWidthMm - targetHeelWidthMm) / 2;
                    return (
                      <>
                        <div className="form-group">
                          <label className="form-label" htmlFor="neck-joint-heel-width">Measured Heel Width</label>
                          <div className="measured-input-row">
                            <DecimalInput
                              id="neck-joint-heel-width"
                              className="form-input measured-input"
                              value={toDisplayUnits(targetHeelWidthMm, settings.unitDisplay)}
                              digits={settings.unitDisplay === 'mm' ? 3 : 4}
                              min={toDisplayUnits(0.001, settings.unitDisplay)}
                              step={settings.unitDisplay === 'mm' ? 0.1 : 0.005}
                              onValueChange={(value) => updateCustomJoint(
                                { targetHeelWidthMm: toMm(value, settings.unitDisplay) },
                                'neck-joint-fit-target',
                              )}
                              onBlur={onEndEdit}
                            />
                            <span>{unitLabel(settings.unitDisplay)}</span>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="neck-joint-side-clearance">Side Clearance</label>
                          <div className="measured-input-row">
                            <DecimalInput
                              id="neck-joint-side-clearance"
                              className="form-input measured-input"
                              value={toDisplayUnits(joint.fittingClearanceMm ?? 0, settings.unitDisplay)}
                              digits={settings.unitDisplay === 'mm' ? 3 : 4}
                              min={0}
                              step={settings.unitDisplay === 'mm' ? 0.05 : 0.002}
                              onValueChange={(value) => updateCustomJoint(
                                { fittingClearanceMm: toMm(value, settings.unitDisplay) },
                                'neck-joint-fit-clearance',
                              )}
                              onBlur={onEndEdit}
                            />
                            <span>{unitLabel(settings.unitDisplay)}</span>
                          </div>
                        </div>
                        <p className="panel-help" role="status">
                          Deep end: {formatLength(deepEndWidthMm, settings.unitDisplay, 3)} {unitLabel(settings.unitDisplay)} pocket; {formatLength(availablePerSideMm, settings.unitDisplay, 3)} {unitLabel(settings.unitDisplay)} per side. Required: {formatLength(requiredWidthMm, settings.unitDisplay, 3)} {unitLabel(settings.unitDisplay)}.
                        </p>
                        <div className="form-group">
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => updateCustomJoint(
                              { targetHeelWidthMm: null, fittingClearanceMm: null },
                              'neck-joint-fit-target',
                            )}
                          >
                            Clear Heel Fit Target
                          </button>
                        </div>
                      </>
                    );
                  })()}
                  <div className="form-group">
                    <label className="form-label" htmlFor="neck-joint-end-treatment">Deep End</label>
                    <select
                      id="neck-joint-end-treatment"
                      value={project.neckJointGeometry.parameters.endTreatment}
                      onChange={(event) => {
                        const endTreatment = event.target.value as NeckJointPlanParameters['endTreatment'];
                        const deepWidth = project.neckJointGeometry!.parameters.deepEndWidthMm
                          ?? project.neckJointGeometry!.parameters.mouthWidthMm;
                        updateCustomJoint(
                          {
                            parameters: endTreatment === 'compound'
                              ? {
                                  endTreatment,
                                  endCornerRadiusMm: 6.35,
                                  endRoundnessMm: 127,
                                  deepEndWidthMm: deepWidth,
                                  mouthWidthMm: deepWidth - 2 * project.neckJointGeometry!.parameters.planLengthMm * Math.tan(0.84 * Math.PI / 180),
                                }
                              : endTreatment === 'rounded'
                              ? {
                                  endTreatment,
                                  endRoundnessMm: project.neckJointGeometry!.parameters.endRoundnessMm || deepWidth / 2,
                                }
                              : { endTreatment },
                          },
                          'neck-joint-end-treatment',
                        );
                      }}
                      className="form-select"
                    >
                      <option value="square">Cornered end</option>
                      <option value="rounded">Rounded end</option>
                      {project.neckJointGeometry.planShape === 'bolt_on_pocket' && (
                        <option value="compound">S-style compound end</option>
                      )}
                    </select>
                  </div>
                  {project.neckJointGeometry.parameters.endTreatment !== 'compound' ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="neck-joint-end-radius">
                      {project.neckJointGeometry.parameters.endTreatment === 'rounded' ? 'Overall End Radius' : 'End-Corner Radius'}
                    </label>
                    <div className="measured-input-row">
                      <DecimalInput
                        id="neck-joint-end-radius"
                        className="form-input measured-input"
                        value={toDisplayUnits(
                          project.neckJointGeometry.parameters.endTreatment === 'rounded'
                            ? project.neckJointGeometry.parameters.endRoundnessMm
                            : project.neckJointGeometry.parameters.endCornerRadiusMm,
                          settings.unitDisplay,
                        )}
                        digits={settings.unitDisplay === 'mm' ? 3 : 4}
                        min={0}
                        max={toDisplayUnits(
                          Math.min(
                            (project.neckJointGeometry.parameters.deepEndWidthMm
                              ?? project.neckJointGeometry.parameters.mouthWidthMm) / 2,
                            project.neckJointGeometry.parameters.planLengthMm,
                          ),
                          settings.unitDisplay,
                        )}
                        step={settings.unitDisplay === 'mm' ? 0.1 : 0.005}
                        onValueChange={(value) => changeCustomJointDimension(
                          project.neckJointGeometry!.parameters.endTreatment === 'rounded'
                            ? 'endRoundnessMm'
                            : 'endCornerRadiusMm',
                          value,
                        )}
                        onBlur={onEndEdit}
                      />
                      <span>{unitLabel(settings.unitDisplay)}</span>
                    </div>
                    <p className="panel-help" style={{ marginTop: '5px', marginBottom: 0 }}>
                      A cornered and a rounded end are alternate generic shapes.
                    </p>
                  </div>
                  ) : (
                    <p className="panel-help" style={{ marginTop: '5px', marginBottom: 0 }}>
                      Documented S-style deep end: 6.35 mm corner fillets flow into a 127 mm / 5″ closing arc. The 0.84° side taper derives the mouth width.
                    </p>
                  )}
                  {project.neckJointGeometry.mechanism === 'glued' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="neck-joint-angle">Neck Angle</label>
                      <div className="measured-input-row">
                        <DecimalInput
                          id="neck-joint-angle"
                          className="form-input measured-input"
                          value={project.neckJointGeometry.neckAngleDegrees ?? 0}
                          digits={1}
                          step={0.1}
                          onValueChange={(value) => updateCustomJoint(
                            { neckAngleDegrees: value },
                            'neck-joint-angle',
                          )}
                          onBlur={onEndEdit}
                        />
                        <span>°</span>
                      </div>
                      <p className="panel-help" style={{ marginTop: '5px', marginBottom: 0 }}>
                        0° is parallel to the body construction plane; positive raises the nut/headstock end. An arched top does not set this value or make this a complete angled-mortise template.
                      </p>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label" htmlFor="neck-joint-cutter-diameter">Cutter Diameter (optional)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', gap: '8px' }}>
                      <DecimalInput
                        id="neck-joint-cutter-diameter"
                        className="form-input measured-input"
                        value={project.neckJointGeometry.cutterDiameterMm === undefined
                          ? null
                          : toDisplayUnits(project.neckJointGeometry.cutterDiameterMm, settings.unitDisplay)}
                        digits={settings.unitDisplay === 'mm' ? 3 : 4}
                        min={toDisplayUnits(0.001, settings.unitDisplay)}
                        step={settings.unitDisplay === 'mm' ? 0.1 : 0.005}
                        placeholder="Unset"
                        onValueChange={(value) => updateCustomJoint(
                          { cutterDiameterMm: toMm(value, settings.unitDisplay) },
                          'neck-joint-cutter-diameter',
                        )}
                        onBlur={onEndEdit}
                      />
                      <span style={{ minWidth: '22px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {unitLabel(settings.unitDisplay)}
                      </span>
                      {project.neckJointGeometry.cutterDiameterMm !== undefined && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => updateCustomJoint({ cutterDiameterMm: null }, 'neck-joint-cutter-diameter')}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {jointCutterWarnings.map((warning) => (
                    <p key={warning} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }} role="status">
                      <Info size={14} style={{ verticalAlign: 'text-bottom', marginRight: '5px', color: 'var(--accent-blue)' }} />
                      {warning}
                    </p>
                  ))}
                  {documentedBlueprintNeckJoint(project) && (
                    <div className="form-group" style={{ marginTop: '12px' }}>
                      <button type="button" className="btn btn-sm" onClick={resetNeckJointToBlueprint}>
                        Reset Neck Joint to Blueprint
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Locked profile: its mouth anchors, sides and end geometry are read-only.
                </p>
              )}
              {jointGeometryError && (
                <p style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '6px' }} role="alert">
                  {jointGeometryError}
                </p>
              )}
            </div>

            {project.neckPlacement && (() => {
              const currentPlacementMm = project.neckPlacement.jointToReferenceFretMm;
              const draftedPlacementMm = neckPlacementDraftMm ?? currentPlacementMm;
              const bridgeShiftMm = draftedPlacementMm - currentPlacementMm;
              const direction = bridgeShiftMm > 0 ? 'toward the tail' : 'toward the neck';
              return (
                <div className="panel-section">
                  <div className="section-title">Neck Placement</div>
                  <p className="panel-help">
                    This body-owned datum moves the neck and scale-linked bridge. The pocket and pickups stay where they are.
                  </p>
                  <div className="form-group">
                    <label className="form-label" htmlFor="neck-placement-reference-fret">
                      Joint to Fret {project.neckPlacement.referenceFret}
                    </label>
                    <div className="measured-input-row">
                      <DecimalInput
                        id="neck-placement-reference-fret"
                        className="form-input measured-input"
                        value={toDisplayUnits(draftedPlacementMm, settings.unitDisplay)}
                        digits={settings.unitDisplay === 'mm' ? 3 : 4}
                        min={0}
                        step={settings.unitDisplay === 'mm' ? 0.1 : 0.005}
                        onValueChange={(value) => setNeckPlacementDraftMm(toMm(value, settings.unitDisplay))}
                      />
                      <span>{unitLabel(settings.unitDisplay)}</span>
                    </div>
                  </div>
                  <p className="panel-help" role="status">
                    {Math.abs(bridgeShiftMm) < 0.000001
                      ? 'Preview: bridge position is unchanged. Pickups remain body-relative.'
                      : `Preview: bridge moves ${formatLength(Math.abs(bridgeShiftMm), settings.unitDisplay, 3)} ${unitLabel(settings.unitDisplay)} ${direction}. Pickups remain body-relative.`}
                  </p>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={applyCustomNeckPlacement}
                    disabled={Math.abs(bridgeShiftMm) < 0.000001}
                  >
                    Apply Placement
                  </button>
                  {project.neckPlacement.mode === 'custom' && documentedBlueprintNeckPlacement(project) && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginLeft: '8px' }}
                      onClick={resetNeckPlacementToBlueprint}
                    >
                      Reset to Blueprint
                    </button>
                  )}
                  {neckPlacementError && (
                    <p className="panel-help" style={{ color: 'var(--accent-red)' }} role="alert">
                      {neckPlacementError}
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="panel-section">
              <div className="section-title">Bridge & Intonation Math</div>

              <div className="form-group">
                <label className="form-label">Bridge Hardware Type</label>
                <select
                  value={bridgePresetId}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({ ...prev, ...bridgePresetFields(e.target.value) }))
                  }
                  className="form-select"
                >
                  {offeredBridgePresets(project.instrumentType).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <div>• Theoretical Saddle Y: <strong>{getTheoreticalSaddleYMm(currentNeck).toFixed(1)} mm</strong></div>
                <div>• Treble Compensation: <strong>+{currentBridge.compensationMm.treble} mm</strong></div>
                <div>• Bass Compensation: <strong>+{currentBridge.compensationMm.bass} mm</strong></div>
                <div>• Compensated Saddle Y: <strong>{getSaddleYMm(currentNeck, currentBridge).toFixed(1)} mm</strong></div>
              </div>
            </div>

            <div className="panel-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>
                  <Zap size={16} /> Pickups
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) onAddPickup(e.target.value as PickupType);
                    e.target.value = '';
                  }}
                  className="form-select"
                  style={{ width: 'auto', fontSize: '0.78rem', padding: '4px 6px' }}
                  title="Add a pickup"
                >
                  <option value="">+ Add Pickup&hellip;</option>
                  {offeredPickupTypes(project.instrumentType).map((type) => (
                    <option key={type} value={type}>
                      {PICKUP_SPECIFICATIONS[type].name}
                    </option>
                  ))}
                </select>
              </div>

              {project.pickups.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  No pickups yet.
                </p>
              ) : (
                <div className="hardware-placement-list">
                  {project.pickups.map((pickup) => {
                    const isSelected = selectedHardware?.kind === 'pickup' && pickup.id === selectedHardware.id;
                    return (
                      <div key={pickup.id} className={`hardware-placement-row${isSelected ? ' is-selected' : ''}`}>
                        <button
                          type="button"
                          className="hardware-placement-select"
                          onClick={() => onSelectHardware(isSelected ? null : { kind: 'pickup', id: pickup.id })}
                        >
                          <span className="hardware-placement-name">
                            {PICKUP_SPECIFICATIONS[pickup.type]?.name ?? pickup.type}
                          </span>
                          <span className="hardware-placement-detail">
                            {pickup.widthMm.toFixed(0)} &times; {pickup.heightMm.toFixed(0)} mm,{' '}
                            {pickup.angleDegrees.toFixed(1)}&deg;
                          </span>
                        </button>
                        <button
                          type="button"
                          className="hardware-placement-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePickup(pickup.id);
                          }}
                          aria-label={`Delete ${PICKUP_SPECIFICATIONS[pickup.type]?.name ?? 'pickup'}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel-section">
              <div className="section-title">
                <CircleDot size={16} /> Controls
              </div>
              <p className="panel-help">
                Place potentiometer knobs and selector switches. Electrical values and switch state are not modelled.
              </p>

              <div className="control-add-row">
                <button type="button" className="btn btn-sm" onClick={onAddPotentiometer}>
                  <CircleDot size={13} /> Potentiometer
                </button>
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value) onAddSwitch(event.target.value as SwitchType);
                    event.target.value = '';
                  }}
                  className="form-select control-add-select"
                  aria-label="Add selector switch"
                >
                  <option value="">+ Switch&hellip;</option>
                  {(Object.entries(SWITCH_TYPE_LABELS) as [SwitchType, string][]).map(([type, label]) => (
                    <option key={type} value={type}>{label}</option>
                  ))}
                </select>
              </div>

              {(project.potentiometers ?? []).length === 0 && (project.switches ?? []).length === 0 ? (
                <p className="hardware-placement-empty">No controls yet.</p>
              ) : (
                <div className="hardware-placement-list">
                  {(project.potentiometers ?? []).map((potentiometer, index) => {
                    const isSelected = selectedHardware?.kind === 'potentiometer' && potentiometer.id === selectedHardware.id;
                    return (
                      <div key={potentiometer.id} className={`hardware-placement-row${isSelected ? ' is-selected' : ''}`}>
                        <button
                          type="button"
                          className="hardware-placement-select"
                          onClick={() => onSelectHardware(isSelected ? null : { kind: 'potentiometer', id: potentiometer.id })}
                        >
                          <span className="hardware-placement-name">Potentiometer {index + 1}</span>
                          <span className="hardware-placement-detail">
                            {potentiometer.bodyDiameterMm.toFixed(0)} mm body ·{' '}
                            {CONTROL_DRAWING_GEOMETRY.potentiometerKnobDiameterMm} mm knob ·{' '}
                            {CONTROL_DRAWING_GEOMETRY.potentiometerShaftHoleDiameterMm} mm shaft hole
                          </span>
                        </button>
                        <button
                          type="button"
                          className="hardware-placement-delete"
                          onClick={() => onDeleteHardware({ kind: 'potentiometer', id: potentiometer.id })}
                          aria-label={`Delete potentiometer ${index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  {(project.switches ?? []).map((selector, index) => {
                    const isSelected = selectedHardware?.kind === 'switch' && selector.id === selectedHardware.id;
                    return (
                      <div key={selector.id} className={`hardware-placement-row${isSelected ? ' is-selected' : ''}`}>
                        <button
                          type="button"
                          className="hardware-placement-select"
                          onClick={() => onSelectHardware(isSelected ? null : { kind: 'switch', id: selector.id })}
                        >
                          <span className="hardware-placement-name">{SWITCH_TYPE_LABELS[selector.type] ?? 'Selector Switch'} {index + 1}</span>
                          <span className="hardware-placement-detail">{selector.angleDegrees.toFixed(1)}&deg;</span>
                        </button>
                        <button
                          type="button"
                          className="hardware-placement-delete"
                          onClick={() => onDeleteHardware({ kind: 'switch', id: selector.id })}
                          aria-label={`Delete ${SWITCH_TYPE_LABELS[selector.type] ?? 'selector switch'} ${index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* LAYERS TAB */}
        {activeTab === 'layers' && (
          <div>
            {bodyLayersPanel}
            <div className="panel-section">
              <div className="section-title">
                <Layers size={16} /> Canvas Display &amp; Snapping
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Center Alignment Axis</span>
                <input
                  type="checkbox"
                  checked={settings.showCenterAxis}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showCenterAxis: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Ghost Reference Guide</span>
                <input
                  type="checkbox"
                  checked={settings.showGhostGuide}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showGhostGuide: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Hardware Cavities & Routs</span>
                <input
                  type="checkbox"
                  checked={settings.showHardwareCavities}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showHardwareCavities: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Knobs &amp; Switches</span>
                <input
                  type="checkbox"
                  aria-label="Show knobs and switches"
                  checked={settings.showControls !== false}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showControls: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Live Dimensions Overlay</span>
                <input
                  type="checkbox"
                  checked={settings.showDimensions}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showDimensions: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Background Grid</span>
                <input
                  type="checkbox"
                  checked={settings.showGrid}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showGrid: e.target.checked },
                    }))
                  }
                />
              </div>

              {settings.showGrid && (
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Major Grid Spacing</label>
                  <select
                    value={settings.gridSizeMm}
                    onChange={(e) =>
                      onUpdateProject((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, gridSizeMm: parseFloat(e.target.value) },
                      }))
                    }
                    className="form-select"
                  >
                    {GRID_PRESETS[settings.unitDisplay].map((preset) => (
                      <option key={preset.majorMm} value={preset.majorMm}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="toggle-row" style={{ marginTop: '12px' }}>
                <span style={{ fontSize: '0.85rem' }}>Snap to Grid</span>
                <input
                  type="checkbox"
                  checked={settings.snapToGridEnabled}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, snapToGridEnabled: e.target.checked },
                    }))
                  }
                />
              </div>
              {settings.snapToGridEnabled && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Nodes, pickups and controls snap to{' '}
                  {formatLength(settings.gridSizeMm / gridMinorDivisor(settings.unitDisplay), settings.unitDisplay, 1)}{' '}
                  {unitLabel(settings.unitDisplay)} increments.
                </p>
              )}

              <div className="toggle-row" style={{ marginTop: '12px' }}>
                <span style={{ fontSize: '0.85rem' }}>Snap Handle Angles</span>
                <input
                  type="checkbox"
                  checked={handleAngleSnap.enabled}
                  onChange={(e) => onHandleAngleSnapChange({ ...handleAngleSnap, enabled: e.target.checked })}
                  aria-label="Snap Handle Angles"
                  aria-describedby="handle-angle-snap-description"
                />
              </div>
              {handleAngleSnap.enabled && (
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label" htmlFor="handle-angle-snap-increment">Handle Angle</label>
                  <select
                    id="handle-angle-snap-increment"
                    value={handleAngleSnap.incrementDegrees}
                    onChange={(e) => onHandleAngleSnapChange({
                      ...handleAngleSnap,
                      incrementDegrees: Number(e.target.value) === 30 ? 30 : 15,
                    })}
                    className="form-select"
                  >
                    <option value={15}>15°</option>
                    <option value={30}>30°</option>
                  </select>
                  <p id="handle-angle-snap-description" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Keeps dragged Bézier handles on {handleAngleSnap.incrementDegrees}° increments. Stored in this browser only.
                  </p>
                </div>
              )}

              <div className="toggle-row" style={{ marginTop: '12px' }}>
                <span style={{ fontSize: '0.85rem' }}>Pickguard</span>
                <input
                  type="checkbox"
                  checked={settings.showPickguard !== false}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showPickguard: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Front Routed Cavities</span>
                <input
                  type="checkbox"
                  checked={settings.showFrontRoutes !== false}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showFrontRoutes: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Back Routed Cavities</span>
                <input
                  type="checkbox"
                  checked={settings.showBackRoutes !== false}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showBackRoutes: e.target.checked },
                    }))
                  }
                />
              </div>
            </div>

          </div>
        )}
      </div>
    </aside>
  );
};
