import React, { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { loadSharedProject } from '../sharing/shareLinkClient';
import type { GuitarProject } from '../types/guitar';
import { buildProjectFilename, downloadSVGFile, exportProjectToSVG } from '../utils/svgExporter';

type DownloadState =
  | { kind: 'loading' }
  | { kind: 'ready'; project: GuitarProject }
  | { kind: 'failed'; message: string };

function download(project: GuitarProject): boolean {
  try {
    downloadSVGFile(buildProjectFilename(project.settings.name), exportProjectToSVG(project));
    return true;
  } catch {
    return false;
  }
}

/**
 * `/download/share/:id`: fetch the shared design and save it through the same
 * `.axe.svg` exporter as the editor's Save - there is no second, server-side
 * exporter (plan section 7, "Project download and reuse information").
 */
export const DownloadSharePage: React.FC<{ id: string }> = ({ id }) => {
  const [state, setState] = useState<DownloadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadSharedProject(id, (input, init) => fetch(input, init));
      if (cancelled) return;
      if (!result.ok) { setState({ kind: 'failed', message: result.message }); return; }
      setState(download(result.project)
        ? { kind: 'ready', project: result.project }
        : { kind: 'failed', message: 'The project file could not be created from this design.' });
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="new-design-screen">
      <div className="design-loading share-open-error" role={state.kind === 'failed' ? 'alert' : 'status'}>
        {state.kind === 'loading' && <p>Preparing the project file&hellip;</p>}
        {state.kind === 'failed' && (
          <>
            <p>{state.message}</p>
            <a className="btn btn-primary" href="/app">Start your own design</a>
          </>
        )}
        {state.kind === 'ready' && (
          <>
            <p>
              <strong>{state.project.settings.name}</strong> has been saved as an <code>.axe.svg</code> file. Print it
              at 100% for a true-scale plan, or open it in Axe Shaper to edit.
            </p>
            <div className="share-download-actions">
              <button type="button" className="btn btn-primary" onClick={() => download(state.project)}>
                <Download size={15} /> Download again
              </button>
              <a className="btn btn-sm" href={`/app/share/${id}`}>
                <ExternalLink size={15} /> Open editable copy
              </a>
              <a className="btn btn-sm" href={`/share/${id}`}>Back to the shared design</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
