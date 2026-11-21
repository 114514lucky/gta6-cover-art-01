// Sunset Coast Cover Studio — editor wiring: photo slots, words, look,
// export, undo/redo. The preview canvas shows the same renderCover the
// exporter draws, so what you see is what the PNG holds.
import { renderCover, renderCoverToCanvas } from './cover.js';
import { GRADES, LAYOUTS, SAMPLES, SIZES, cloneState, defaultState, sizeById } from './state.js';

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadSamples() {
  const photos = {};
  await Promise.all(SAMPLES.map(async (s) => {
    photos[s.key] = await loadImage(s.file);
  }));
  return photos;
}

function el(id) {
  return document.getElementById(id);
}

function buttonRow(container, items, activeId, onPick) {
  container.innerHTML = '';
  items.forEach((item) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (item.id === activeId ? ' on' : '');
    b.textContent = item.label;
    b.addEventListener('click', () => onPick(item.id));
    container.appendChild(b);
  });
}

export async function initEditor() {
  const state = defaultState();
  const photos = await loadSamples();
  const preview = el('preview');
  const status = el('status');
  let selected = 1;
  let layout = null;
  let renderQueued = false;
  let uploadCount = 0;
  const undoStack = [];
  const redoStack = [];
  // Snapshot-once per interaction: the first input of a drag or a typing
  // run records the state BEFORE it, so undo returns to the real prior one.
  const armed = new WeakSet();
  function snapshotOnce(target) {
    if (armed.has(target)) return;
    armed.add(target);
    snapshot();
  }

  function snapshot() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 40) undoStack.shift();
    redoStack.length = 0;
    syncUndoButtons();
  }

  function restore(serialised) {
    const next = JSON.parse(serialised);
    Object.keys(next).forEach((k) => { state[k] = next[k]; });
    syncSlots();
    syncControls();
    queueRender();
  }

  // Re-syncs every slot card (role, sliders, thumbnail) from the state —
  // used after undo/redo, which replace the state wholesale.
  function syncSlots() {
    slots.querySelectorAll('.slot').forEach((card) => {
      const i = Number(card.dataset.index);
      const panel = state.panels[i];
      card.querySelector('.role').value = panel.role;
      card.querySelector('.zoom').value = String(panel.zoom);
      card.querySelector('.ox').value = String(panel.ox);
      card.querySelector('.oy').value = String(panel.oy);
      const img = photos[panel.photo];
      if (img) card.querySelector('.thumb').style.backgroundImage = `url(${img.src})`;
    });
  }

  function syncUndoButtons() {
    el('undo').disabled = undoStack.length === 0;
    el('redo').disabled = redoStack.length === 0;
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      const size = sizeById(state.size);
      const box = preview.parentElement.getBoundingClientRect();
      const scale = Math.min(box.width / size.w, box.height / size.h, 1);
      preview.style.width = `${Math.floor(size.w * scale)}px`;
      preview.style.height = `${Math.floor(size.h * scale)}px`;
      layout = renderCover(preview, state, photos);
    });
  }

  // ---- photo slots -------------------------------------------------------
  // Each slot card is built once from the panel it starts with, but every
  // handler below resolves its panel live — state.panels[i] at event time —
  // instead of closing over the build-time panel object. restore() (undo /
  // redo) replaces state.panels wholesale with fresh objects, so a closed-over
  // panel would keep receiving edits that the preview and exporter never
  // see. The build-time `initial` is only used for the card's first paint.
  const slots = el('slots');
  state.panels.forEach((initial, i) => {
    const card = document.createElement('div');
    card.className = 'slot';
    card.dataset.index = String(i);
    card.innerHTML = `
      <div class="thumb"><span class="slot-num">${i + 1}</span></div>
      <input class="role" type="text" maxlength="16" value="${initial.role}" aria-label="Role tag for panel ${i + 1}">
      <label class="zoom-label">Zoom <input class="zoom" type="range" min="1" max="2.2" step="0.01" value="${initial.zoom}"></label>
      <label class="zoom-label">Across <input class="ox" type="range" min="-0.3" max="0.3" step="0.01" value="${initial.ox}"></label>
      <label class="zoom-label">Down <input class="oy" type="range" min="-0.3" max="0.3" step="0.01" value="${initial.oy}"></label>
      <div class="slot-actions">
        <button type="button" class="mini sample-cycle">Sample</button>
        <label class="mini upload-label">Upload<input type="file" accept="image/*" hidden></label>
      </div>`;
    const thumb = card.querySelector('.thumb');
    const img = photos[initial.photo];
    if (img) thumb.style.backgroundImage = `url(${img.src})`;
    card.addEventListener('click', (e) => {
      if (e.target.closest('input,button,label')) return;
      selectPanel(i);
    });
    card.querySelector('.role').addEventListener('input', (e) => {
      snapshotOnce(e.target);
      state.panels[i].role = e.target.value.toUpperCase();
      queueRender();
    });
    card.querySelector('.role').addEventListener('change', (e) => armed.delete(e.target));
    const bindRange = (selector, key) => {
      const input = card.querySelector(selector);
      input.addEventListener('input', (e) => {
        snapshotOnce(e.target);
        state.panels[i][key] = Number(e.target.value);
        queueRender();
      });
      input.addEventListener('change', (e) => armed.delete(e.target));
    };
    bindRange('.zoom', 'zoom');
    bindRange('.ox', 'ox');
    bindRange('.oy', 'oy');
    card.querySelector('.sample-cycle').addEventListener('click', () => {
      snapshot();
      const panel = state.panels[i];
      const now = SAMPLES.findIndex((s) => s.key === panel.photo);
      const next = SAMPLES[(now + 1) % SAMPLES.length];
      panel.photo = next.key;
      thumb.style.backgroundImage = `url(${photos[next.key].src})`;
      panel.role = next.role;
      card.querySelector('.role').value = next.role;
      queueRender();
    });
    card.querySelector('input[type=file]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const uploaded = await loadImage(url);
        snapshot();
        uploadCount += 1;
        const key = `up${uploadCount}`;
        photos[key] = uploaded;
        state.panels[i].photo = key;
        thumb.style.backgroundImage = `url(${url})`;
        status.textContent = `Loaded ${file.name} into panel ${i + 1}.`;
        queueRender();
      } catch {
        status.textContent = 'That file could not be read as a photo.';
      }
    });
    slots.appendChild(card);
  });

  function selectPanel(i) {
    selected = i;
    slots.querySelectorAll('.slot').forEach((c) => {
      c.classList.toggle('selected', Number(c.dataset.index) === i);
    });
    status.textContent = `Panel ${i + 1} selected — crop it with the sliders, or swap its photo.`;
  }

  preview.addEventListener('click', (e) => {
    if (!layout) return;
    const r = preview.getBoundingClientRect();
    const size = sizeById(state.size);
    const px = ((e.clientX - r.left) / r.width) * size.w;
    const py = ((e.clientY - r.top) / r.height) * size.h;
    const hit = layout.panels.findIndex((p) => px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h);
    if (hit >= 0) selectPanel(hit);
  });

  // ---- words -------------------------------------------------------------
  const bindText = (id, key, transform) => {
    const input = el(id);
    input.addEventListener('input', (e) => {
      snapshotOnce(e.target);
      state[key] = transform ? transform(e.target.value) : e.target.value;
      queueRender();
    });
    input.addEventListener('change', (e) => armed.delete(e.target));
  };
  bindText('title', 'title', (v) => v.toUpperCase());
  bindText('subtitle', 'subtitle');
  bindText('tagline', 'tagline', (v) => v.toUpperCase());
  bindText('quote', 'quote', (v) => v.toUpperCase());

  // ---- look --------------------------------------------------------------
  function syncPickers() {
    buttonRow(el('grades'), GRADES, state.grade, (id) => { snapshot(); state.grade = id; syncPickers(); queueRender(); });
    buttonRow(el('layouts'), LAYOUTS, state.layout, (id) => { snapshot(); state.layout = id; syncPickers(); queueRender(); });
    buttonRow(el('sizes'), SIZES, state.size, (id) => { snapshot(); state.size = id; syncPickers(); queueRender(); });
  }

  function syncControls() {
    el('title').value = state.title;
    el('subtitle').value = state.subtitle;
    el('tagline').value = state.tagline;
    el('quote').value = state.quote;
    syncPickers();
  }

  // ---- actions -----------------------------------------------------------
  el('fill-one').addEventListener('click', () => {
    snapshot();
    const hero = state.panels[selected].photo;
    state.panels.forEach((p) => { p.photo = hero; });
    slots.querySelectorAll('.slot .thumb').forEach((t) => {
      t.style.backgroundImage = `url(${photos[hero].src})`;
    });
    status.textContent = 'One photo now fills all six panels — crop each panel differently.';
    queueRender();
  });
  el('undo').addEventListener('click', () => {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(state));
    restore(undoStack.pop());
    syncUndoButtons();
  });
  el('redo').addEventListener('click', () => {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(state));
    restore(redoStack.pop());
    syncUndoButtons();
  });

  function download(canvas, name) {
    canvas.toBlob((blob) => {
      if (!blob) {
        status.textContent = 'Export failed — try again.';
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      status.textContent = `Saved ${name}.`;
    }, 'image/png');
  }

  el('export').addEventListener('click', () => {
    const size = sizeById(state.size);
    download(renderCoverToCanvas(state, photos), `sunset-coast-cover-${size.id}.png`);
  });
  el('export-all').addEventListener('click', () => {
    SIZES.forEach((size, i) => {
      setTimeout(() => {
        const copy = cloneState(state);
        copy.size = size.id;
        download(renderCoverToCanvas(copy, photos), `sunset-coast-cover-${size.id}.png`);
      }, i * 450);
    });
    status.textContent = 'Exporting all three sizes — allow multiple downloads if asked.';
  });

  syncControls();
  syncUndoButtons();
  selectPanel(1);
  queueRender();
  return { state, photos, queueRender, selectPanel };
}
