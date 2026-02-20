const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");
const diagCanvas = document.getElementById("diagCanvas");
const dctx = diagCanvas ? diagCanvas.getContext("2d") : null;

const bSlider = document.getElementById("bSlider");
const hSlider = document.getElementById("hSlider");
const wSlider = document.getElementById("wSlider");
const rSlider = document.getElementById("rSlider");
const uSlider = document.getElementById("uSlider");
const vectorsToggle = document.getElementById("vectorsToggle");
const currentVectorsToggle = document.getElementById("currentVectorsToggle");
const bDirBtn = document.getElementById("bDirBtn");

const playPauseBtn = document.getElementById("playPauseBtn") || document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const slowBtn = document.getElementById("slowBtn");
const graphModeSelect = document.getElementById("graphModeSelect");

const bValue = document.getElementById("bValue");
const hValue = document.getElementById("hValue");
const wValue = document.getElementById("wValue");
const rValue = document.getElementById("rValue");
const uSetValue = document.getElementById("uSetValue");

const tValue = document.getElementById("tValue");
const xValue = document.getElementById("xValue");
const uValue = document.getElementById("uValue");
const phiValue = document.getElementById("phiValue");
const eValue = document.getElementById("eValue");
const iValue = document.getElementById("iValue");
const currentDirValue = document.getElementById("currentDirValue");
const fmagValue = document.getElementById("fmagValue");
const inFieldValue = document.getElementById("inFieldValue");
const statusValue = document.getElementById("statusValue");

const WORLD_LEFT = 0;
const WORLD_RIGHT = 8;
const FIELD_START = 3.1;
const FIELD_END = 6.5;
const BASE_TIME_SCALE = 0.75;
const TRACE_MAX = 5000;

function resizeCanvasToDisplaySize(targetCanvas, targetCtx, fallbackWidth, fallbackHeight) {
  if (!targetCanvas || !targetCtx) {
    return;
  }
  const rect = targetCanvas.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.floor(rect.width || fallbackWidth));
  const cssHeight = Math.max(1, Math.floor(rect.height || fallbackHeight));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const nextWidth = Math.floor(cssWidth * dpr);
  const nextHeight = Math.floor(cssHeight * dpr);

  if (targetCanvas.width !== nextWidth || targetCanvas.height !== nextHeight) {
    targetCanvas.width = nextWidth;
    targetCanvas.height = nextHeight;
  }
  targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeCanvases() {
  resizeCanvasToDisplaySize(canvas, ctx, 980, 560);
  if (diagCanvas && dctx) {
    resizeCanvasToDisplaySize(diagCanvas, dctx, 980, 460);
  }
}

const state = {
  B: Number(bSlider.value),
  Bdir: 1,
  h: Number(hSlider.value),
  w: Number(wSlider.value),
  R: Number(rSlider.value),
  uSet: Number(uSlider.value),
  showVectors: vectorsToggle ? vectorsToggle.checked : true,
  showCurrentVectors: currentVectorsToggle ? currentVectorsToggle.checked : true,
  playing: false,
  slowMotion: false,
  timeScale: BASE_TIME_SCALE,
  t: 0,
  x: 0.7,
  u: Number(uSlider.value),
  phi: 0,
  emf: 0,
  I: 0,
  Fmag: 0,
  overlap: 0,
  dOverlapDt: 0,
  currentDir: "-",
  pJoule: 0,
  heatJ: 0,
  graphMode: graphModeSelect ? graphModeSelect.value : "i",
  trace: [],
  yMin: -0.2,
  yMax: 0.2,
  tAxisMax: 8,
  lastTime: null
};

function graphSeriesConfig() {
  switch (state.graphMode) {
    case "e":
      return { key: "e", label: "Eεπ(t) [V]", color: "#c1121f" };
    case "phi":
      return { key: "phi", label: "Φ(t) [Wb]", color: "#2a9d8f" };
    case "fl":
      return { key: "fl", label: "F_L(t) [N]", color: "#457b9d" };
    case "x":
      return { key: "x", label: "x(t) [m]", color: "#6a4c93" };
    case "i":
    default:
      return { key: "i", label: "Iεπ(t) [A]", color: "#1d3557" };
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function overlapWidth(left, width, start, end) {
  const right = left + width;
  return Math.max(0, Math.min(right, end) - Math.max(left, start));
}

function overlapRate(left, speed, width, start, end) {
  if (speed <= 0) {
    return 0;
  }
  if (left >= start - width && left < start) {
    return speed;
  }
  if (left > end - width && left <= end) {
    return -speed;
  }
  return 0;
}

function pushHistory() {
  state.trace.push({
    t: state.t,
    i: state.I,
    e: state.emf,
    phi: state.phi,
    fl: state.Fmag,
    x: state.x
  });
  if (state.trace.length > TRACE_MAX) {
    state.trace.shift();
  }
  updateTraceBounds();
}

function updateTraceBounds() {
  if (state.trace.length === 0) {
    state.yMin = -0.2;
    state.yMax = 0.2;
    state.tAxisMax = 8;
    return;
  }

  const { key } = graphSeriesConfig();
  const values = state.trace.map((p) => p[key]);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const span = Math.max(0.15, vMax - vMin);
  const pad = 0.18 * span;

  if (state.trace.length <= 1) {
    state.yMin = vMin - pad;
    state.yMax = vMax + pad;
  } else {
    state.yMin = Math.min(state.yMin, vMin - pad);
    state.yMax = Math.max(state.yMax, vMax + pad);
  }

  state.tAxisMax = Math.max(8, state.t);
}

function resetTraceAtCurrentTime() {
  state.trace = [{
    t: state.t,
    i: state.I,
    e: state.emf,
    phi: state.phi,
    fl: state.Fmag,
    x: state.x
  }];
  updateTraceBounds();
}

function syncSlidersUI() {
  bValue.textContent = state.B.toFixed(2);
  hValue.textContent = state.h.toFixed(2);
  wValue.textContent = state.w.toFixed(2);
  rValue.textContent = state.R.toFixed(2);
  uSetValue.textContent = state.uSet.toFixed(2);
}

function syncPlayPauseUI() {
  if (playPauseBtn) {
    playPauseBtn.textContent = state.playing ? "Pause" : "Play";
  }
}

function recalcMeasured() {
  state.u = state.uSet;
  state.overlap = overlapWidth(state.x, state.w, FIELD_START, FIELD_END);
  const dOverlapDt = overlapRate(state.x, state.u, state.w, FIELD_START, FIELD_END);
  state.dOverlapDt = dOverlapDt;
  const Bsigned = state.B * state.Bdir;

  state.phi = Bsigned * state.h * state.overlap;
  state.emf = -Bsigned * state.h * dOverlapDt;
  state.I = state.emf / state.R;

  const inTransition = Math.abs(dOverlapDt) > 1e-6;
  state.Fmag = inTransition ? Math.abs(state.I) * state.B * state.h : 0;
  state.pJoule = state.I * state.I * state.R;

  if (dOverlapDt > 1e-6) {
    state.currentDir = state.Bdir > 0 ? "Αντιωρολογιακά" : "Ωρολογιακά";
  } else if (dOverlapDt < -1e-6) {
    state.currentDir = state.Bdir > 0 ? "Ωρολογιακά" : "Αντιωρολογιακά";
  } else {
    state.currentDir = "-";
  }
}

function updateMeasurements() {
  tValue.textContent = state.t.toFixed(2);
  xValue.textContent = state.x.toFixed(2);
  uValue.textContent = state.u.toFixed(2);
  phiValue.textContent = state.phi.toFixed(3);
  eValue.textContent = state.emf.toFixed(2);
  iValue.textContent = state.I.toFixed(2);
  currentDirValue.textContent = state.currentDir;
  fmagValue.textContent = state.Fmag.toFixed(2);
  inFieldValue.textContent = state.overlap.toFixed(2);

  if (state.overlap <= 0.0001 && state.x + state.w <= FIELD_START) {
    statusValue.textContent = "Κατάσταση: Εκτός πεδίου (πριν την είσοδο).";
  } else if (state.overlap > 0.0001 && state.overlap < state.w - 0.0001) {
    if (state.x < FIELD_START) {
      statusValue.textContent = `Κατάσταση: Το πλαίσιο εισέρχεται στο πεδίο (Lenz: ${state.currentDir.toLowerCase()} ρεύμα).`;
    } else {
      statusValue.textContent = `Κατάσταση: Το πλαίσιο εξέρχεται από το πεδίο (Lenz: ${state.currentDir.toLowerCase()} ρεύμα).`;
    }
  } else if (state.overlap >= state.w - 0.0001) {
    statusValue.textContent = "Κατάσταση: Το πλαίσιο είναι ολόκληρο μέσα στο πεδίο.";
  } else {
    statusValue.textContent = "Κατάσταση: Εκτός πεδίου (μετά την έξοδο).";
  }
}

function worldToCanvasX(xWorld) {
  const viewW = canvas.getBoundingClientRect().width || 980;
  const pad = Math.max(24, Math.min(70, viewW * 0.075));
  return pad + ((xWorld - WORLD_LEFT) / (WORLD_RIGHT - WORLD_LEFT)) * (viewW - 2 * pad);
}

function worldToCanvasY(yNorm) {
  const viewH = canvas.getBoundingClientRect().height || 560;
  const top = Math.max(32, Math.min(110, viewH * 0.2));
  const bottom = Math.max(top + 56, Math.min(viewH - 20, viewH * 0.84));
  return top + yNorm * (bottom - top);
}

function drawArrow(x, y, vx, vy, color, label) {
  if (Math.hypot(vx, vy) < 1) {
    return;
  }
  const tx = x + vx;
  const ty = y + vy;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  const a = Math.atan2(vy, vx);
  const h = 11;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - h * Math.cos(a - Math.PI / 6), ty - h * Math.sin(a - Math.PI / 6));
  ctx.lineTo(tx - h * Math.cos(a + Math.PI / 6), ty - h * Math.sin(a + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  if (label) {
    ctx.font = "bold 13px Arial";
    ctx.fillText(label, tx + 6, ty - 6);
  }
}

function drawCanvasStatus(text) {
  if (!text || text === "Κατάσταση: -") {
    return;
  }

  const padX = 12;
  const boxY = 8;
  const viewW = canvas.getBoundingClientRect().width || 980;
  const small = viewW < 520;
  const boxH = small ? 24 : 28;
  ctx.font = small ? "bold 12px Arial" : "bold 14px Arial";
  const metrics = ctx.measureText(text);
  const boxW = Math.min(viewW - 24, metrics.width + padX * 2);
  const boxX = (viewW - boxW) / 2;

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.strokeStyle = "#b7c7da";
  ctx.lineWidth = 1.2;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = "#1d3557";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2 + 0.5, boxW - padX * 2);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawFieldPattern(x0, y0, w, h, intoPage) {
  for (let y = y0 + 18; y < y0 + h; y += 28) {
    for (let x = x0 + 18; x < x0 + w; x += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      if (intoPage) {
        ctx.fillStyle = "#6a7800";
        ctx.fill();
        ctx.strokeStyle = "#f7f9d4";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 3);
        ctx.lineTo(x + 3, y + 3);
        ctx.moveTo(x + 3, y - 3);
        ctx.lineTo(x - 3, y + 3);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#6a7800";
        ctx.fill();
        ctx.strokeStyle = "#f7f9d4";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = "#f7f9d4";
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawScene() {
  const viewW = canvas.getBoundingClientRect().width || 980;
  const viewH = canvas.getBoundingClientRect().height || 560;
  const small = viewW < 520;
  const titleX = small ? 16 : 40;
  const titleY = small ? 24 : 36;
  const infoY1 = small ? 66 : 86;
  const infoY2 = small ? 86 : 108;
  ctx.clearRect(0, 0, viewW, viewH);

  const bLeft = worldToCanvasX(FIELD_START);
  const bRight = worldToCanvasX(FIELD_END);
  const bTop = worldToCanvasY(0.2);
  const bBottom = worldToCanvasY(0.8);
  const frameCenterY = (bTop + bBottom) / 2;
  const pxPerMeterX = worldToCanvasX(1) - worldToCanvasX(0);
  const frameHeight = state.h * pxPerMeterX;
  const frameTop = frameCenterY - frameHeight / 2;
  const frameBottom = frameCenterY + frameHeight / 2;

  ctx.fillStyle = "rgba(137, 194, 37, 0.12)";
  ctx.fillRect(bLeft, bTop, bRight - bLeft, bBottom - bTop);
  drawFieldPattern(bLeft, bTop, bRight - bLeft, bBottom - bTop, state.Bdir > 0);

  const frameLeft = worldToCanvasX(state.x);
  const frameRight = worldToCanvasX(state.x + state.w);
  const frameWidth = frameRight - frameLeft;

  const overlapLeftWorld = clamp(Math.max(state.x, FIELD_START), FIELD_START, FIELD_END);
  const overlapRightWorld = clamp(Math.min(state.x + state.w, FIELD_END), FIELD_START, FIELD_END);
  if (overlapRightWorld > overlapLeftWorld) {
    const ox = worldToCanvasX(overlapLeftWorld);
    const ow = worldToCanvasX(overlapRightWorld) - ox;
    ctx.fillStyle = "rgba(251, 133, 0, 0.14)";
    ctx.fillRect(ox, frameTop, ow, frameHeight);
  }

  ctx.strokeStyle = "#e76f51";
  ctx.lineWidth = small ? 4 : 6;
  ctx.strokeRect(frameLeft, frameTop, frameWidth, frameHeight);

  ctx.fillStyle = "#13233f";
  ctx.font = small ? "bold 12px Arial" : "bold 15px Arial";
  ctx.fillText("Πλαίσιο με σταθερή ταχύτητα", titleX, titleY);
  ctx.fillText(state.Bdir > 0 ? "B προς τα μέσα (×)" : "B προς τα έξω (•)", bLeft + 8, Math.max(16, bTop - 16));
  ctx.fillText(`R = ${state.R.toFixed(2)} Ω`, frameLeft + 8, Math.max(16, frameTop - 12));
  ctx.fillText(`υ = ${state.u.toFixed(2)} m/s`, Math.min(viewW - 128, frameRight + 10), frameCenterY - 8);

  if (state.currentDir !== "-" && state.showCurrentVectors) {
    const clockwise = state.currentDir === "Ωρολογιακά";
    const topY = frameTop - (small ? 8 : 10);
    const bottomY = frameBottom + (small ? 8 : 10);
    const currentArrow = small ? 34 : 48;
    if (clockwise) {
      drawArrow(frameLeft + 10, topY, currentArrow, 0, "#1d3557", "");
      drawArrow(frameRight + 10, frameTop + 10, 0, currentArrow, "#1d3557", "");
      drawArrow(frameRight - 10, bottomY, -currentArrow, 0, "#1d3557", "");
      drawArrow(frameLeft - 10, frameBottom - 10, 0, -currentArrow, "#1d3557", "");
    } else {
      drawArrow(frameRight - 10, topY, -currentArrow, 0, "#1d3557", "");
      drawArrow(frameLeft - 10, frameTop + 10, 0, currentArrow, "#1d3557", "");
      drawArrow(frameLeft + 10, bottomY, currentArrow, 0, "#1d3557", "");
      drawArrow(frameRight + 10, frameBottom - 10, 0, -currentArrow, "#1d3557", "");
    }
    ctx.fillStyle = "#1d3557";
    ctx.font = small ? "bold 12px Arial" : "bold 14px Arial";
    ctx.fillText(`Iεπ: ${state.currentDir}`, frameLeft, frameBottom + 30);
  }

  if (state.showVectors) {
    const centerX = (frameLeft + frameRight) / 2;
    const centerY = (frameTop + frameBottom) / 2;
    const velArrow = small ? 42 : 72;
    drawArrow(frameRight + 16, centerY + 8, velArrow, 0, "#f77f00", "υ");
    if (state.Fmag > 0.0001) {
      drawArrow(centerX, centerY + (small ? 22 : 30), small ? -38 : -60, 0, "#457b9d", "F_L");
    }
  }

  ctx.fillStyle = "#0f1c33";
  ctx.font = small ? "12px Arial" : "14px Arial";
  ctx.fillText(`x = ${state.x.toFixed(2)} m`, titleX, infoY1);
  ctx.fillText(`Φ = ${state.phi.toFixed(3)} Wb`, titleX, infoY2);
  drawCanvasStatus(statusValue.textContent);
}

function drawMiniSeriesBox(x, y, w, h, label, points, key, color, minVal, maxVal, tMax) {
  dctx.strokeStyle = "#b5c5d9";
  dctx.fillStyle = "rgba(255,255,255,0.9)";
  dctx.lineWidth = 1.2;
  dctx.fillRect(x, y, w, h);
  dctx.strokeRect(x, y, w, h);

  dctx.fillStyle = "#2a3f5e";
  dctx.font = "bold 14px Arial";
  dctx.fillText(label, x + 8, y + 15);

  const plotX = x + 56;
  const plotY = y + 22;
  const plotW = w - 64;
  const plotH = h - 28;

  if (points.length < 2 || maxVal - minVal < 1e-9 || tMax <= 0) {
    return;
  }

  const toX = (t) => plotX + (t / tMax) * plotW;
  const toY = (v) => plotY + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;

  const yTicks = 5;
  dctx.font = "11px Arial";
  dctx.fillStyle = "#34506f";
  dctx.strokeStyle = "#d6e0eb";
  dctx.lineWidth = 1;
  for (let i = 0; i <= yTicks; i += 1) {
    const frac = i / yTicks;
    const yv = maxVal - frac * (maxVal - minVal);
    const py = plotY + frac * plotH;
    dctx.beginPath();
    dctx.moveTo(plotX, py);
    dctx.lineTo(plotX + plotW, py);
    dctx.stroke();
    dctx.fillText(yv.toFixed(2), x + 6, py + 4);
  }

  dctx.strokeStyle = color;
  dctx.lineWidth = 2.6;
  dctx.beginPath();
  points.forEach((p, i) => {
    const px = toX(p.t);
    const py = toY(p[key]);
    if (i === 0) {
      dctx.moveTo(px, py);
    } else {
      dctx.lineTo(px, py);
    }
  });
  dctx.stroke();

  const latest = points[points.length - 1];
  if (latest) {
    const yNow = toY(latest[key]);
    const valueNow = latest[key];

    dctx.save();
    dctx.setLineDash([5, 4]);
    dctx.strokeStyle = "rgba(42, 63, 94, 0.55)";
    dctx.lineWidth = 1.3;
    dctx.beginPath();
    dctx.moveTo(plotX, yNow);
    dctx.lineTo(plotX + plotW, yNow);
    dctx.stroke();
    dctx.restore();

    dctx.fillStyle = "#2a3f5e";
    dctx.font = "bold 11px Arial";
    dctx.textAlign = "right";
    dctx.textBaseline = "middle";
    dctx.fillText(valueNow.toFixed(2), plotX + plotW - 4, yNow - 8);
    dctx.textAlign = "start";
    dctx.textBaseline = "alphabetic";
  }
}

function drawLiveBars(x, y, w, h) {
  dctx.fillStyle = "rgba(255,255,255,0.92)";
  dctx.strokeStyle = "#b5c5d9";
  dctx.lineWidth = 1.2;
  dctx.fillRect(x, y, w, h);
  dctx.strokeRect(x, y, w, h);

  const labels = ["|Eεπ|", "|Iεπ|", "|F_L|"];
  const colors = ["#c1121f", "#1d3557", "#457b9d"];
  const values = [Math.abs(state.emf), Math.abs(state.I), Math.abs(state.Fmag)];
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const zeroY = y + h * 0.86;
  const innerPad = 10;
  const gaugeW = 18;
  const gap = 10;
  const barAreaW = Math.max(90, w - innerPad * 3 - gaugeW - gap * 2);
  const barW = Math.max(20, barAreaW / 3);
  const startX = x + innerPad;

  dctx.strokeStyle = "#c8d7e8";
  dctx.beginPath();
  dctx.moveTo(x + 8, zeroY);
  dctx.lineTo(x + w - 8, zeroY);
  dctx.stroke();

  values.forEach((v, i) => {
    const bh = (Math.abs(v) / maxAbs) * (h * 0.62);
    const bx = startX + i * (barW + gap);
    const by = zeroY - bh;
    dctx.fillStyle = colors[i];
    dctx.fillRect(bx, by, barW, bh);
    dctx.fillStyle = "#233c5b";
    dctx.font = "bold 12px Arial";
    dctx.fillText(labels[i], bx, y + h - 10);
    dctx.fillText(v.toFixed(2), bx, by - 5);
  });

  const gaugeX = x + w - innerPad - gaugeW;
  const gaugeY = y + 14;
  const gaugeH = h - 36;
  const qMax = Math.max(5, state.heatJ * 1.2);
  const fill = (state.heatJ / qMax) * gaugeH;

  dctx.strokeStyle = "#6b7f9d";
  dctx.lineWidth = 2;
  dctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);
  dctx.fillStyle = "#ff7b00";
  dctx.fillRect(gaugeX + 2, gaugeY + gaugeH - fill + 2, gaugeW - 4, Math.max(0, fill - 4));
  dctx.fillStyle = "#233c5b";
  dctx.font = "bold 12px Arial";
  dctx.fillText("Q", gaugeX + 3, gaugeY - 4);
  dctx.fillText(`${state.heatJ.toFixed(1)} J`, gaugeX - 18, gaugeY + gaugeH + 14);
}

function drawFormulaBox(x, y, w, h) {
  dctx.fillStyle = "rgba(255,255,255,0.93)";
  dctx.strokeStyle = "#b5c5d9";
  dctx.lineWidth = 1.2;
  dctx.fillRect(x, y, w, h);
  dctx.strokeRect(x, y, w, h);

  dctx.fillStyle = "#223854";
  dctx.font = "bold 14px Arial";
  dctx.fillText("Live σχέσεις", x + 8, y + 15);
  dctx.font = w < 300 ? "12px Arial" : "13px Arial";

  const compact = w < 300;
  const l1 = compact
    ? `Φ = ${state.phi.toFixed(3)} Wb`
    : `Φ = B·(ℓ·xεντός) = ${state.B.toFixed(2)}·(${state.h.toFixed(2)}·${state.overlap.toFixed(2)}) = ${state.phi.toFixed(3)} Wb`;
  const l2 = compact
    ? `Eεπ = ${state.emf.toFixed(2)} V`
    : `Eεπ = -dΦ/dt = ${state.emf.toFixed(2)} V`;
  const l3 = compact
    ? `Iεπ = ${state.I.toFixed(2)} A`
    : `Iεπ = Eεπ/R = ${state.emf.toFixed(2)}/${state.R.toFixed(2)} = ${state.I.toFixed(2)} A`;
  const l4 = compact
    ? `F_L = ${state.Fmag.toFixed(2)} N`
    : `F_L = B·Iεπ·ℓ = ${state.B.toFixed(2)}·${Math.abs(state.I).toFixed(2)}·${state.h.toFixed(2)} = ${state.Fmag.toFixed(2)} N`;

  dctx.fillText(l1, x + 8, y + 34);
  dctx.fillText(l2, x + 8, y + 52);
  dctx.fillText(l3, x + 8, y + 70);
  dctx.fillText(l4, x + 8, y + 88);
}

function drawDiagnosticsPanel() {
  if (!dctx) {
    return;
  }

  const viewW = diagCanvas.getBoundingClientRect().width || 980;
  const viewH = diagCanvas.getBoundingClientRect().height || 460;
  dctx.clearRect(0, 0, viewW, viewH);

  const pad = 12;
  const graphCfg = graphSeriesConfig();
  const narrow = viewW < 760;

  if (narrow) {
    const fullW = viewW - pad * 2;
    const graphH = Math.floor(viewH * 0.47);
    const barsH = Math.floor(viewH * 0.23);
    const formulaH = viewH - graphH - barsH - pad * 4;
    drawMiniSeriesBox(pad, pad, fullW, graphH, graphCfg.label, state.trace, graphCfg.key, graphCfg.color, state.yMin, state.yMax, state.tAxisMax);
    drawLiveBars(pad, pad * 2 + graphH, fullW, barsH);
    drawFormulaBox(pad, pad * 3 + graphH + barsH, fullW, formulaH);
  } else {
    const leftW = Math.floor(viewW * 0.5);
    const rightW = viewW - leftW - pad * 3;
    const gx = pad;
    const gy = pad;
    const gw = leftW;
    const graphH = viewH - pad * 2;
    drawMiniSeriesBox(gx, gy, gw, graphH, graphCfg.label, state.trace, graphCfg.key, graphCfg.color, state.yMin, state.yMax, state.tAxisMax);

    const rightX = gx + gw + pad;
    const barsH = 165;
    drawLiveBars(rightX, gy, rightW, barsH);
    drawFormulaBox(rightX, gy + barsH + 8, rightW, viewH - (gy + barsH + 8) - pad);
  }
}

function integrate(dt) {
  state.x += state.uSet * dt;
  state.t += dt;

  if (state.x > WORLD_RIGHT + 0.6) {
    state.playing = false;
  }

  recalcMeasured();
  state.heatJ += state.pJoule * dt;
  pushHistory();
}

function tick(timestamp) {
  if (state.lastTime === null) {
    state.lastTime = timestamp;
  }

  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000) * state.timeScale;
  state.lastTime = timestamp;

  if (state.playing) {
    integrate(dt);
  } else {
    recalcMeasured();
  }

  resizeCanvases();
  syncSlidersUI();
  syncPlayPauseUI();
  updateMeasurements();
  drawScene();
  drawDiagnosticsPanel();
  requestAnimationFrame(tick);
}

function resetSimulation() {
  state.playing = false;
  state.t = 0;
  state.x = 0.7;
  state.u = state.uSet;
  state.heatJ = 0;
  state.trace = [];
  state.yMin = -0.2;
  state.yMax = 0.2;
  state.tAxisMax = 8;
  recalcMeasured();
  resetTraceAtCurrentTime();
  syncPlayPauseUI();
  updateMeasurements();
  drawScene();
  drawDiagnosticsPanel();
}

bSlider.addEventListener("input", () => {
  state.B = Number(bSlider.value);
});

hSlider.addEventListener("input", () => {
  state.h = Number(hSlider.value);
});

wSlider.addEventListener("input", () => {
  state.w = Number(wSlider.value);
});

rSlider.addEventListener("input", () => {
  state.R = Number(rSlider.value);
});

uSlider.addEventListener("input", () => {
  state.uSet = Number(uSlider.value);
  state.u = state.uSet;
  if (!state.playing && state.t === 0) {
    recalcMeasured();
    resetTraceAtCurrentTime();
  }
});

if (vectorsToggle) {
  vectorsToggle.addEventListener("change", () => {
    state.showVectors = vectorsToggle.checked;
  });
}

if (currentVectorsToggle) {
  currentVectorsToggle.addEventListener("change", () => {
    state.showCurrentVectors = currentVectorsToggle.checked;
  });
}

if (bDirBtn) {
  bDirBtn.addEventListener("click", () => {
    state.Bdir *= -1;
    bDirBtn.textContent = state.Bdir > 0 ? "B: προς τα μέσα (×)" : "B: προς τα έξω (•)";
  });
}

if (playPauseBtn) {
  playPauseBtn.addEventListener("click", () => {
    state.playing = !state.playing;
    syncPlayPauseUI();
  });
}

if (pauseBtn) {
  pauseBtn.addEventListener("click", () => {
    state.playing = false;
    syncPlayPauseUI();
  });
}

resetBtn.addEventListener("click", resetSimulation);

slowBtn.addEventListener("click", () => {
  state.slowMotion = !state.slowMotion;
  state.timeScale = state.slowMotion ? 0.25 : BASE_TIME_SCALE;
  slowBtn.textContent = `Slow motion: ${state.slowMotion ? "On" : "Off"}`;
  slowBtn.classList.toggle("slow-on", state.slowMotion);
});

if (graphModeSelect) {
  graphModeSelect.addEventListener("change", () => {
    state.graphMode = graphModeSelect.value;
    state.yMin = -0.2;
    state.yMax = 0.2;
    updateTraceBounds();
  });
}

window.addEventListener("resize", resizeCanvases);
window.addEventListener("orientationchange", resizeCanvases);

resetSimulation();
requestAnimationFrame(tick);
