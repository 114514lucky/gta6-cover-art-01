// Sunset Coast Cover Studio — the cover renderer. One deterministic draw:
// panels, chrome title, script subtitle, tagline ribbon, top quote bar,
// billing block, barcode, seal, grain and vignette. No wall clock, no
// Math.random: grain and the barcode both come from a seeded hash of the
// title, so the same state always paints the same pixels.
import { gradeById, sizeById } from './state.js';

export const PLUM = '#170a24';
export const PLUM_DEEP = '#241031';
export const GOLD = '#ffd94a';
export const GOLD_SOFT = '#ffcf7d';
export const PINK = '#ff5da2';
export const CREAM = '#f4e9d4';

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Panel rectangles for a cover of W x H in the chosen layout. Returns the
// six panel rects in cast order plus the title seam (the y the big title
// sits on) and the top bar / billing bands.
export function computeLayout(width, height, layout) {
  const margin = width * 0.014;
  const gap = Math.max(6, width * 0.005);
  const topBar = height * 0.056;
  const billing = height * 0.066;
  const gridX = margin;
  const gridY = topBar + margin * 0.6;
  const gridW = width - margin * 2;
  const gridH = height - billing - gridY - margin * 0.6;
  const wide = width >= height;
  const panels = [];

  if (layout === 'hero') {
    // Panel 1 (the boulevard portrait) is always the hero; the other five
    // fill the remaining space around it.
    const heroRect = (x, y, w, h) => ({ x, y, w, h });
    const rest = [0, 2, 3, 4, 5];
    const placed = new Array(6);
    if (wide) {
      const heroW = gridW * 0.56;
      const rightX = gridX + heroW + gap;
      const rightW = gridW - heroW - gap;
      const halfW = (rightW - gap) / 2;
      const rowH = (gridH - gap * 2) / 3;
      placed[1] = heroRect(gridX, gridY, heroW, gridH);
      const rightRects = [
        heroRect(rightX, gridY, halfW, rowH),
        heroRect(rightX + halfW + gap, gridY, halfW, rowH),
        heroRect(rightX, gridY + rowH + gap, halfW, rowH),
        heroRect(rightX + halfW + gap, gridY + rowH + gap, halfW, rowH),
        heroRect(rightX, gridY + rowH * 2 + gap * 2, rightW, rowH),
      ];
      rightRects.forEach((r, k) => { placed[rest[k]] = r; });
      return { panels: placed, seamY: gridY + gridH * 0.6, topBar, billing, margin, gap };
    }
    const heroH = gridH * 0.54;
    const restY = gridY + heroH + gap;
    const restH = gridH - heroH - gap;
    const rowH = (restH - gap) / 2;
    const thirdW = (gridW - gap * 2) / 3;
    const halfW = (gridW - gap) / 2;
    placed[1] = heroRect(gridX, gridY, gridW, heroH);
    const restRects = [
      heroRect(gridX, restY, thirdW, rowH),
      heroRect(gridX + thirdW + gap, restY, thirdW, rowH),
      heroRect(gridX + thirdW * 2 + gap * 2, restY, thirdW, rowH),
      heroRect(gridX, restY + rowH + gap, halfW, rowH),
      heroRect(gridX + halfW + gap, restY + rowH + gap, halfW, rowH),
    ];
    restRects.forEach((r, k) => { placed[rest[k]] = r; });
    return { panels: placed, seamY: gridY + heroH, topBar, billing, margin, gap };
  }

  // Poster: a 3 x 2 grid on wide and square covers, 2 x 3 on portrait.
  if (wide || width === height) {
    const colW = [0.26, 0.48, 0.26].map((f) => f * (gridW - gap * 2));
    const rowH = [0.52, 0.48].map((f) => f * (gridH - gap));
    const xs = [gridX, gridX + colW[0] + gap, gridX + colW[0] + colW[1] + gap * 2];
    const ys = [gridY, gridY + rowH[0] + gap];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        panels.push({ x: xs[c], y: ys[r], w: colW[c], h: rowH[r] });
      }
    }
    return { panels, seamY: gridY + rowH[0], topBar, billing, margin, gap };
  }
  const colW = (gridW - gap) / 2;
  const rowH = (gridH - gap * 2) / 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      panels.push({
        x: gridX + c * (colW + gap),
        y: gridY + r * (rowH + gap),
        w: colW,
        h: rowH,
      });
    }
  }
  return { panels, seamY: gridY + rowH, topBar, billing, margin, gap };
}

// Draws one photo into its panel: cover-fit, zoomed around a focus point,
// graded, then washed with the grade's sunset/neon tint.
export function drawPanelPhoto(ctx, img, rect, panel, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, Math.max(3, w * 0.008));
  ctx.clip();
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  // Tall photos in wide panels hide faces at the top: shift the image
  // down on the canvas by part of the vertical overflow, so the window
  // covers the photo's top (where faces are) instead of its torso.
  const tallBias = img.naturalHeight > img.naturalWidth * 1.15 && w > h
    ? (ph - h) * 0.18
    : 0;
  const cx = x + w / 2 + (panel.ox || 0) * w;
  const cy = y + h / 2 + (panel.oy || 0) * h + tallBias;
  ctx.filter = `saturate(${grade.saturate}) contrast(${grade.contrast}) brightness(${grade.brightness})`;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.filter = 'none';
  const wash = ctx.createLinearGradient(x, y, x, y + h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.globalCompositeOperation = grade.blend;
  ctx.globalAlpha = grade.washAlpha;
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const shade = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  shade.addColorStop(0, 'rgba(20,4,31,0)');
  shade.addColorStop(1, 'rgba(20,4,31,0.42)');
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,217,138,0.9)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  roundRectPath(ctx, x, y, w, h, Math.max(3, w * 0.008));
  ctx.stroke();
}

// A cast tag: black chip, gold slash, white caps. Panels above the title
// seam wear it at the top, panels below at the bottom, so the big title
// never covers a tag.
export function drawRoleTag(ctx, rect, role, unit, atTop) {
  const text = (role || '').trim().toUpperCase();
  if (!text) return;
  const size = Math.max(11, unit * 0.021);
  ctx.save();
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.letterSpacing = '1px';
  const tw = ctx.measureText(text).width;
  const padX = size * 0.7;
  const chipW = tw + padX * 2 + size * 0.5;
  const chipH = size * 1.9;
  const cx = rect.x + size * 0.55;
  const cy = atTop
    ? rect.y + size * 0.55
    : rect.y + rect.h - chipH - size * 0.55;
  ctx.fillStyle = 'rgba(12,3,20,0.88)';
  roundRectPath(ctx, cx, cy, chipW, chipH, chipH * 0.22);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.fillRect(cx + size * 0.18, cy + size * 0.3, size * 0.22, chipH - size * 0.6);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx + padX + size * 0.3, cy + chipH / 2 + size * 0.06);
  ctx.restore();
}

// The chrome title: dark extrude, dark outline, then a striped sunset
// gradient fill with a pink glow. Shrinks until it fits maxWidth.
export function drawChromeTitle(ctx, text, cx, cy, maxWidth, baseSize) {
  const words = (text || 'VICE COAST').trim().toUpperCase();
  let size = baseSize;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const setFont = () => { ctx.font = `${size}px Anton, sans-serif`; };
  setFont();
  while (ctx.measureText(words).width > maxWidth && size > 24) {
    size -= 4;
    setFont();
  }
  const stripe = ctx.createLinearGradient(0, cy - size * 0.62, 0, cy + size * 0.62);
  const bands = ['#fff6bf', '#ffd94a', '#ff9a3d', '#ff5e62', '#ff2e88', '#c33fd6', '#7a2fd0'];
  bands.forEach((color, i) => {
    stripe.addColorStop(i / (bands.length - 1), color);
  });
  for (let i = 5; i >= 1; i--) {
    ctx.fillStyle = '#2a0a3d';
    ctx.fillText(words, cx, cy + size * 0.022 * i);
  }
  ctx.strokeStyle = '#1c0626';
  ctx.lineWidth = size * 0.055;
  ctx.strokeText(words, cx, cy);
  ctx.shadowColor = 'rgba(255,80,180,0.6)';
  ctx.shadowBlur = size * 0.14;
  ctx.fillStyle = stripe;
  ctx.fillText(words, cx, cy);
  ctx.shadowBlur = 0;
  ctx.restore();
  return size;
}

export function drawScriptSubtitle(ctx, text, cx, y, size) {
  const words = (text || '').trim();
  if (!words) return;
  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(-0.045);
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1.5, size * 0.045);
  ctx.strokeText(words, 0, 0);
  ctx.shadowColor = 'rgba(255,46,136,0.85)';
  ctx.shadowBlur = size * 0.35;
  ctx.fillStyle = PINK;
  ctx.fillText(words, 0, 0);
  ctx.restore();
}

export function drawTaglineRibbon(ctx, text, cx, y, unit) {
  const words = (text || '').trim().toUpperCase();
  if (!words) return;
  const size = Math.max(12, unit * 0.021);
  ctx.save();
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.letterSpacing = `${Math.max(2, size * 0.22)}px`;
  const tw = ctx.measureText(words).width;
  const padX = size * 1.4;
  const pillW = tw + padX * 2;
  const pillH = size * 2.1;
  ctx.fillStyle = 'rgba(12,3,20,0.92)';
  roundRectPath(ctx, cx - pillW / 2, y - pillH / 2, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1.2, size * 0.08);
  roundRectPath(ctx, cx - pillW / 2, y - pillH / 2, pillW, pillH, pillH / 2);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(words, cx, y + size * 0.08);
  ctx.restore();
}

function drawTopBar(ctx, width, quote, topBar, unit) {
  const cy = topBar * 0.52;
  const starR = Math.max(8, topBar * 0.24);
  let sx = width * 0.028 + starR;
  ctx.save();
  ctx.fillStyle = GOLD;
  for (let i = 0; i < 5; i++) {
    starPath(ctx, sx, cy, starR);
    ctx.fill();
    sx += starR * 2.5;
  }
  const size = Math.max(12, unit * 0.02);
  const quoteText = `“${(quote || '').trim().toUpperCase()}”  —  THE COAST GAZETTE`;
  // Shrink the quote until it fits between the stars and the VOL chip.
  let qSize = size;
  ctx.save();
  const starsEnd = sx + starR;
  const chip = 'VOL. 1';
  ctx.font = `${qSize}px Anton, sans-serif`;
  const chipW0 = ctx.measureText(chip).width + qSize * 1.6;
  const chipX0 = width - width * 0.028 - chipW0;
  const setQuoteFont = () => {
    ctx.font = `${qSize}px Anton, sans-serif`;
    ctx.letterSpacing = `${Math.max(1, qSize * 0.28)}px`;
  };
  setQuoteFont();
  while (ctx.measureText(quoteText).width > chipX0 - starsEnd - 32 && qSize > 9) {
    qSize -= 1;
    setQuoteFont();
  }
  ctx.fillStyle = GOLD_SOFT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(quoteText, width / 2, cy + qSize * 0.05);
  const chipW = ctx.measureText(chip).width + qSize * 1.6;
  const chipH = qSize * 2;
  const chipX = width - width * 0.028 - chipW;
  ctx.letterSpacing = '0px';
  ctx.font = `${qSize}px Anton, sans-serif`;
  ctx.fillStyle = GOLD;
  roundRectPath(ctx, chipX, cy - chipH / 2, chipW, chipH, 3);
  ctx.fill();
  ctx.fillStyle = PLUM;
  ctx.fillText(chip, chipX + chipW / 2, cy + qSize * 0.05);
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seed) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#111111';
  let bx = x + 4;
  while (bx < x + w - 5) {
    const bw = 1 + Math.floor(rnd() * 4);
    if (rnd() > 0.42) ctx.fillRect(bx, y + 3, bw, h - 10);
    bx += bw + 1 + Math.floor(rnd() * 3);
  }
  ctx.restore();
}

function drawSeal(ctx, cx, cy, r, unit) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.22);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const rad = i % 2 === 0 ? r : r * 0.86;
    const a = (i * Math.PI) / 12;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PLUM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.max(9, r * 0.24);
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.fillText('ORIGINAL', 0, -size * 0.55);
  ctx.fillText('COVER ART', 0, size * 0.55);
  starPath(ctx, 0, 0, size * 0.32);
  ctx.fill();
  ctx.restore();
}

function drawBilling(ctx, width, height, billing, unit, seed) {
  const y0 = height - billing;
  ctx.save();
  ctx.fillStyle = 'rgba(8,2,14,0.55)';
  ctx.fillRect(0, y0, width, billing);
  const size = Math.max(10, unit * 0.0135);
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.letterSpacing = '2px';
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A SUNSET COAST PICTURE  ·  STARRING YOU AND YOUR CREW  ·  SHOT ON YOUR OWN PHONE', width / 2, y0 + billing * 0.32);
  ctx.fillText('GRADED AT SUNSET  ·  LETTERED BY HAND  ·  NO PHOTO EVER LEAVES YOUR DEVICE', width / 2, y0 + billing * 0.72);
  const soonSize = Math.max(15, unit * 0.028);
  ctx.font = `${soonSize}px Anton, sans-serif`;
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(255,46,136,0.9)';
  ctx.shadowBlur = soonSize * 0.4;
  ctx.fillStyle = PINK;
  ctx.fillText('COMING SOON', width * 0.028, y0 + billing * 0.52);
  ctx.shadowBlur = 0;
  const bw = Math.max(64, unit * 0.085);
  const bh = billing * 0.52;
  drawBarcode(ctx, width - width * 0.028 - bw, y0 + billing * 0.16, bw, bh, seed);
  ctx.font = `${Math.max(8, size * 0.8)}px system-ui, sans-serif`;
  ctx.letterSpacing = '1px';
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'right';
  ctx.fillText('0 18472 65991 8', width - width * 0.028, y0 + billing * 0.92);
  ctx.restore();
}

function drawGrain(ctx, width, height, seed) {
  const rnd = mulberry32(seed);
  ctx.save();
  const count = Math.floor((width * height) / 1400);
  for (let i = 0; i < count; i++) {
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rnd() * width, rnd() * height, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
  }
  ctx.restore();
}

function drawVignette(ctx, width, height) {
  const g = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.42,
    width / 2, height / 2, Math.max(width, height) * 0.72,
  );
  g.addColorStop(0, 'rgba(10,2,18,0)');
  g.addColorStop(1, 'rgba(10,2,18,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

// Renders the whole cover onto canvas (sized to the state's export size)
// from a map of photo key -> loaded image. Returns the layout used, so the
// editor can hit-test clicks on the preview.
export function renderCover(canvas, state, photos) {
  const size = sizeById(state.size);
  const { w, h } = size;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const unit = Math.min(w / 1.92, h / 1.08);
  const grade = gradeById(state.grade);
  const layout = computeLayout(w, h, state.layout);
  const seed = hashString(`${state.title}|${state.size}|${state.layout}|${state.grade}`);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, PLUM_DEEP);
  bg.addColorStop(0.5, PLUM);
  bg.addColorStop(1, '#12061d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  state.panels.forEach((panel, i) => {
    const img = photos[panel.photo];
    const rect = layout.panels[i];
    if (!rect) return;
    if (img) drawPanelPhoto(ctx, img, rect, panel, grade);
    else {
      ctx.fillStyle = '#2c1540';
      roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 6);
      ctx.fill();
    }
    drawRoleTag(ctx, rect, panel.role, unit, rect.y + rect.h / 2 < layout.seamY);
  });

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(2, w * 0.0016);
  ctx.strokeRect(layout.margin * 0.55, layout.topBar * 0.55, w - layout.margin * 1.1, h - layout.topBar * 0.55 - layout.billing * 0.4);
  drawTopBar(ctx, w, state.quote, layout.topBar, unit);

  const titleGlow = ctx.createRadialGradient(
    w / 2, layout.seamY, 10, w / 2, layout.seamY, w * 0.42,
  );
  titleGlow.addColorStop(0, 'rgba(16,3,26,0.62)');
  titleGlow.addColorStop(1, 'rgba(16,3,26,0)');
  ctx.fillStyle = titleGlow;
  ctx.fillRect(0, layout.seamY - h * 0.22, w, h * 0.44);

  const baseTitle = Math.min(w * 0.115, h * 0.16);
  const titleSize = drawChromeTitle(ctx, state.title, w / 2, layout.seamY, w * 0.88, baseTitle);
  drawScriptSubtitle(ctx, state.subtitle, w / 2, layout.seamY + titleSize * 0.62, titleSize * 0.4);
  drawTaglineRibbon(ctx, state.tagline, w / 2, layout.seamY + titleSize * 1.08, unit);
  drawBilling(ctx, w, h, layout.billing, unit, seed);
  drawSeal(ctx, w - layout.margin - w * 0.055, h - layout.billing - h * 0.075, Math.max(30, unit * 0.055), unit);
  drawGrain(ctx, w, h, seed ^ 0x9e3779b9);
  drawVignette(ctx, w, h);
  return layout;
}

// Renders the state to a fresh offscreen canvas at export size.
export function renderCoverToCanvas(state, photos) {
  const canvas = document.createElement('canvas');
  renderCover(canvas, state, photos);
  return canvas;
}
