// Sunset Coast Cover Studio — bootstrap. Loads the vendored lettering
// (Anton for the chrome title, Pacifico for the script subtitle) before
// the first paint, then either opens the editor or a fixed ?shot= scene.
import { renderCover } from './cover.js';
import { initEditor, loadImage } from './editor.js';
import { markShotReady, shotStateFromQuery } from './shots.js';
import { SAMPLES } from './state.js';

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
    await document.fonts.ready;
  } catch {
    // The app still renders with the system fallback if a font file fails.
  }
}

async function runCoverShot(query) {
  document.body.classList.add('shot-cover');
  const state = shotStateFromQuery(query);
  const photos = {};
  await Promise.all(SAMPLES.map(async (s) => {
    photos[s.key] = await loadImage(s.file);
  }));
  renderCover(document.getElementById('preview'), state, photos);
  markShotReady();
}

async function runEditorShot(query) {
  const editor = await initEditor();
  const shot = shotStateFromQuery(query);
  // Merge the shot scene into the live editor state in place. Assigning
  // shot.panels wholesale would swap in fresh panel objects and orphan the
  // ones the slot cards were built around — the same stale-panel hazard the
  // editor's undo/redo path has — so each panel keeps its identity and
  // only its fields change.
  Object.keys(shot).forEach((k) => {
    if (k === 'panels') {
      shot.panels.forEach((panel, i) => {
        if (editor.state.panels[i]) Object.assign(editor.state.panels[i], panel);
      });
    } else {
      editor.state[k] = shot[k];
    }
  });
  editor.queueRender();
  // The editor's own render is queued on an animation frame; wait two
  // frames past it before declaring the scene ready.
  requestAnimationFrame(() => requestAnimationFrame(() => markShotReady()));
}

async function boot() {
  await loadFonts();
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot === 'cover') {
    await runCoverShot(query);
  } else if (shot === 'editor') {
    await runEditorShot(query);
  } else {
    await initEditor();
  }
}

boot();
