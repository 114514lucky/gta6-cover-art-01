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
  Object.keys(shot).forEach((k) => { editor.state[k] = shot[k]; });
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
