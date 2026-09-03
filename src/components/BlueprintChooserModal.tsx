import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Bookmark, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { BLUEPRINT_ORDER } from '../constants/blueprintManifest';
import { REFERENCE_TEMPLATES } from '../constants/templates';
import type { GuitarProject } from '../types/guitar';
import { instrumentLabel } from '../utils/instrument';
import { isTemplateCompatible } from '../utils/presets';
import {
  deleteUserTemplate,
  loadUserTemplates,
  saveUserTemplate,
  type UserTemplate,
} from '../utils/userTemplates';

interface BlueprintChooserModalProps {
  isOpen: boolean;
  project: GuitarProject;
  onClose: () => void;
  onSelectTemplate: (templateId: string) => void;
  onNewDesign: () => void;
}

/**
 * Blueprint choice is a document-level action, matching the iOS editor. It is
 * intentionally outside the tool tabs: selecting a blueprint replaces the
 * body, hardware and routed shapes rather than changing one editing setting.
 */
export function BlueprintChooserModal({
  isOpen,
  project,
  onClose,
  onSelectTemplate,
  onNewDesign,
}: BlueprintChooserModalProps): React.JSX.Element | null {
  const [extraOpen, setExtraOpen] = useState(false);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setUserTemplates(loadUserTemplates());
    setExtraOpen(REFERENCE_TEMPLATES[project.activeTemplateId]?.tier === 'extra');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, project.activeTemplateId]);

  const compatibleTemplates = useMemo(
    () => BLUEPRINT_ORDER
      .map((id) => REFERENCE_TEMPLATES[id])
      .filter((template) => template && isTemplateCompatible(template, project)),
    [project]
  );
  const referenceTemplates = compatibleTemplates.filter((template) => template.tier === 'reference');
  const extraTemplates = compatibleTemplates.filter((template) => template.tier === 'extra');
  const compatibleUserTemplates = userTemplates.filter((template) => isTemplateCompatible(template, project));
  const instrument = instrumentLabel(project.instrumentType);

  if (!isOpen) return null;

  const selectTemplate = (id: string) => {
    onSelectTemplate(id);
    onClose();
  };

  const saveCurrentAsTemplate = () => {
    const name = window.prompt('Name this template:', project.settings.name)?.trim();
    if (!name) return;
    const template: UserTemplate = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      instrumentType: project.instrumentType,
      stringCount: project.stringCount,
      neckPresetId: project.neckPresetId,
      bridgePresetId: project.bridgePresetId,
      defaultAnchors: structuredClone(project.contour.anchors),
      edgeProfile: project.edgeProfile ? structuredClone(project.edgeProfile) : undefined,
      bodyThicknessMm: project.bodyThicknessMm,
      defaultPickups: structuredClone(project.pickups),
      defaultPickguards: structuredClone(project.pickguards ?? []),
      defaultFrontRoutes: structuredClone(project.frontRoutes ?? []),
      defaultBackRoutes: structuredClone(project.backRoutes ?? []),
      createdAt: new Date().toISOString(),
    };
    setUserTemplates(saveUserTemplate(template));
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="app-modal blueprint-chooser-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blueprint-chooser-title"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close blueprint chooser" autoFocus>
          <X size={18} />
        </button>

        <div className="blueprint-chooser-heading">
          <div>
            <h2 id="blueprint-chooser-title">Switch blueprint</h2>
            <p>
              Choose another {instrument.toLowerCase()} starting point. This replaces the body outline,
              construction, hardware and routed shapes in the current design.
            </p>
          </div>
          <button className="btn btn-sm" onClick={onNewDesign}>
            <ArrowLeftRight size={15} /> New instrument&hellip;
          </button>
        </div>

        <div className="blueprint-chooser-scroll">
          <section className="blueprint-chooser-section" aria-labelledby="reference-blueprints-title">
            <h3 id="reference-blueprints-title">Reference blueprints</h3>
            <div className="blueprint-choice-list">
              {referenceTemplates.map((template) => (
                <button
                  key={template.id}
                  className={`blueprint-choice${project.activeTemplateId === template.id ? ' is-selected' : ''}`}
                  onClick={() => selectTemplate(template.id)}
                >
                  <span><strong>{template.name}</strong>{template.description}</span>
                  <span>{template.category}</span>
                </button>
              ))}
            </div>
          </section>

          {extraTemplates.length > 0 && (
            <section className="blueprint-chooser-section" aria-labelledby="extra-blueprints-title">
              <button
                id="extra-blueprints-title"
                className="blueprint-extra-toggle"
                onClick={() => setExtraOpen((open) => !open)}
                aria-expanded={extraOpen}
                aria-controls="blueprint-extra-list"
              >
                <span>Extra blueprints ({extraTemplates.length})</span>
                {extraOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div id="blueprint-extra-list" className="blueprint-choice-list" hidden={!extraOpen}>
                {extraTemplates.map((template) => (
                  <button
                    key={template.id}
                    className={`blueprint-choice${project.activeTemplateId === template.id ? ' is-selected' : ''}`}
                    onClick={() => selectTemplate(template.id)}
                  >
                    <span><strong>{template.name}</strong>{template.description}</span>
                    <span>{template.category}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="blueprint-chooser-section" aria-labelledby="my-templates-title">
            <div className="blueprint-section-heading">
              <h3 id="my-templates-title"><Bookmark size={15} /> My templates</h3>
              <button className="btn btn-sm" onClick={saveCurrentAsTemplate}>
                <Plus size={14} /> Save current
              </button>
            </div>
            {compatibleUserTemplates.length === 0 ? (
              <p className="blueprint-empty">No saved {instrument.toLowerCase()} templates yet.</p>
            ) : (
              <div className="blueprint-choice-list">
                {compatibleUserTemplates.map((template) => (
                  <div className="blueprint-user-choice" key={template.id}>
                    <button
                      className={`blueprint-choice${project.activeTemplateId === template.id ? ' is-selected' : ''}`}
                      onClick={() => selectTemplate(template.id)}
                    >
                      <span>
                        <strong>{template.name}</strong>
                        Saved {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      className="blueprint-delete"
                      onClick={() => setUserTemplates(deleteUserTemplate(template.id))}
                      aria-label={`Delete ${template.name}`}
                      title="Delete template"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
