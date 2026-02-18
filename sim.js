const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const bSlider = document.getElementById("bSlider");
const hSlider = document.getElementById("hSlider");
const wSlider = document.getElementById("wSlider");
const rSlider = document.getElementById("rSlider");
const uSlider = document.getElementById("uSlider");
const vectorsToggle = document.getElementById("vectorsToggle");
const currentVectorsToggle = document.getElementById("currentVectorsToggle");
const bDirBtn = document.getElementById("bDirBtn");

// Backward-compatible ids help when Netlify serves cached/older HTML.
const playPauseBtn = document.getElementById("playPauseBtn") || document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const slowBtn = document.getElementById("slowBtn");

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
const FIELD_START = 3.2;
const FIELD_END = 6.2;
const BASE_TIME_SCALE = 0.75;

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
  lastTime: null
};

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
  const pad = 70;
  return pad + ((xWorld - WORLD_LEFT) / (WORLD_RIGHT - WORLD_LEFT)) * (canvas.width - 2 * pad);
}

function worldToCanvasY(yNorm) {
  const top = 110;
  const bottom = 470;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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
  ctx.lineWidth = 6;
  ctx.strokeRect(frameLeft, frameTop, frameWidth, frameHeight);

  ctx.fillStyle = "#13233f";
  ctx.font = "bold 15px Arial";
  ctx.fillText("Πλαίσιο με σταθερή ταχύτητα", 40, 36);
  ctx.fillText(state.Bdir > 0 ? "B προς τα μέσα (×)" : "B προς τα έξω (•)", bLeft + 8, bTop - 16);
  ctx.fillText(`R = ${state.R.toFixed(2)} Ω`, frameLeft + 10, frameTop - 18);
  ctx.fillText(`υ = ${state.u.toFixed(2)} m/s`, frameRight + 38, frameCenterY - 8);

  if (state.currentDir !== "-" && state.showCurrentVectors) {
    const clockwise = state.currentDir === "Ωρολογιακά";
    const topY = frameTop - 10;
    const bottomY = frameBottom + 10;
    if (clockwise) {
      drawArrow(frameLeft + 10, topY, 48, 0, "#1d3557", "");
      drawArrow(frameRight + 10, frameTop + 10, 0, 48, "#1d3557", "");
      drawArrow(frameRight - 10, bottomY, -48, 0, "#1d3557", "");
      drawArrow(frameLeft - 10, frameBottom - 10, 0, -48, "#1d3557", "");
    } else {
      drawArrow(frameRight - 10, topY, -48, 0, "#1d3557", "");
      drawArrow(frameLeft - 10, frameTop + 10, 0, 48, "#1d3557", "");
      drawArrow(frameLeft + 10, bottomY, 48, 0, "#1d3557", "");
      drawArrow(frameRight + 10, frameBottom - 10, 0, -48, "#1d3557", "");
    }
    ctx.fillStyle = "#1d3557";
    ctx.font = "bold 14px Arial";
    ctx.fillText(`I: ${state.currentDir}`, frameLeft, frameBottom + 30);
  }

  if (state.showVectors) {
    const centerX = (frameLeft + frameRight) / 2;
    const centerY = (frameTop + frameBottom) / 2;
    drawArrow(frameRight + 20, centerY + 8, 72, 0, "#f77f00", "υ");
    if (state.Fmag > 0.0001) {
      drawArrow(centerX, centerY + 30, -60, 0, "#457b9d", "Fₗ");
    }
  }

  ctx.fillStyle = "#0f1c33";
  ctx.font = "14px Arial";
  ctx.fillText(`x = ${state.x.toFixed(2)} m`, 40, 86);
  ctx.fillText(`Φ = ${state.phi.toFixed(3)} Wb`, 40, 108);
}

function integrate(dt) {
  state.x += state.uSet * dt;
  state.t += dt;

  if (state.x > WORLD_RIGHT + 0.6) {
    state.playing = false;
  }

  recalcMeasured();
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

  syncSlidersUI();
  syncPlayPauseUI();
  updateMeasurements();
  drawScene();
  requestAnimationFrame(tick);
}

function resetSimulation() {
  state.playing = false;
  state.t = 0;
  state.x = 0.7;
  state.u = state.uSet;
  recalcMeasured();
  syncPlayPauseUI();
  updateMeasurements();
  drawScene();
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

resetSimulation();
requestAnimationFrame(tick);
