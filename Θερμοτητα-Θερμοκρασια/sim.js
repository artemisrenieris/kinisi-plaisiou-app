const simCanvas = document.getElementById("simCanvas");
const simCtx = simCanvas.getContext("2d");
const graphCanvas = document.getElementById("graphCanvas");
const graphCtx = graphCanvas.getContext("2d");

const hotSlider = document.getElementById("hotSlider");
const coldSlider = document.getElementById("coldSlider");
const hotValue = document.getElementById("hotValue");
const coldValue = document.getElementById("coldValue");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const lossesToggle = document.getElementById("lossesToggle");
const statusText = document.getElementById("statusText");
const timeValue = document.getElementById("timeValue");
const eqValue = document.getElementById("eqValue");
const delta1Value = document.getElementById("delta1Value");
const delta2Value = document.getElementById("delta2Value");

const state = {
  running: false,
  t: 0,
  hotT: Number(hotSlider.value),
  coldT: Number(coldSlider.value),
  initHot: Number(hotSlider.value),
  initCold: Number(coldSlider.value),
  eqReached: false,
  eqTime: null,
  eqTemp: null,
  coldMonotonic: Number(coldSlider.value),
  contactProgress: 0,
  postEqHold: 2.5,
  lastTimestamp: null,
  hotPoints: [],
  coldPoints: [],
  particles: []
};

const transferK = 0.28;
const ambientT = 22;
const lossKHot = 0.07;
const lossKCold = 0.05;
const lossKEqual = 0.06;
const contactDuration = 1.35;
const containerW = 180;
const containerH = 120;
const containerBaseY = 52;
const sideMargin = 150;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function tempToColor(tempC) {
  const t = clamp(tempC, 0, 100) / 100;
  const cold = { r: 35, g: 107, b: 255 };
  const hot = { r: 226, g: 40, b: 46 };
  const r = Math.round(cold.r + (hot.r - cold.r) * t);
  const g = Math.round(cold.g + (hot.g - cold.g) * t);
  const b = Math.round(cold.b + (hot.b - cold.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function initStateFromInputs() {
  if (Number(hotSlider.value) <= Number(coldSlider.value)) {
    hotSlider.value = String(Number(coldSlider.value) + 1);
  }

  state.running = false;
  state.t = 0;
  state.initHot = Number(hotSlider.value);
  state.initCold = Number(coldSlider.value);
  state.hotT = state.initHot;
  state.coldT = state.initCold;
  state.eqReached = false;
  state.eqTime = null;
  state.eqTemp = null;
  state.coldMonotonic = state.initCold;
  state.contactProgress = 0;
  state.lastTimestamp = null;
  state.hotPoints = [{ t: 0, T: state.hotT }];
  state.coldPoints = [{ t: 0, T: state.coldT }];
  state.particles = [];

  hotValue.textContent = String(state.initHot);
  coldValue.textContent = String(state.initCold);
  statusText.textContent = "Έτοιμο";
  timeValue.textContent = "0.00";
  delta1Value.textContent = "-";
  delta2Value.textContent = "-";
  if (lossesToggle.checked) {
    eqValue.textContent = "Θα προκύψει (με απώλειες)";
  } else {
    eqValue.textContent = ((state.initHot + state.initCold) / 2).toFixed(2) + " °C";
  }
  startBtn.textContent = "Start";
}

function formatDelta(delta) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)} °C`;
}

function setFinalDeltas() {
  delta1Value.textContent = formatDelta(state.hotT - state.initHot);
  delta2Value.textContent = formatDelta(state.coldT - state.initCold);
}

function addPointIfNeeded() {
  const last = state.hotPoints[state.hotPoints.length - 1];
  if (!last || state.t - last.t >= 0.05) {
    state.hotPoints.push({ t: state.t, T: state.hotT });
    state.coldPoints.push({ t: state.t, T: state.coldT });
  }
}

function spawnHeatParticle(leftX, rightX, y, bandHalf) {
  state.particles.push({
    x: leftX + 2,
    y: y + (Math.random() - 0.5) * bandHalf * 2,
    v: 95 + Math.random() * 45,
    endX: rightX - 2
  });
}

function updateParticles(dt, leftX, rightX, y, bandHalf) {
  const deltaT = state.hotT - state.coldT;
  if (state.contactProgress >= 1 && deltaT > 0.15 && state.running) {
    const spawnCount = Math.max(1, Math.floor(deltaT / 22));
    for (let i = 0; i < spawnCount; i += 1) {
      if (Math.random() < 0.35) {
        spawnHeatParticle(leftX, rightX, y, bandHalf);
      }
    }
  }

  state.particles.forEach((p) => {
    p.x += p.v * dt;
    p.x = clamp(p.x, leftX, rightX);
    p.y = clamp(p.y, y - bandHalf, y + bandHalf);
  });
  state.particles = state.particles.filter((p) => p.x < p.endX);
}

function update(dt) {
  if (!state.running) {
    return;
  }

  state.contactProgress = clamp(state.contactProgress + dt / contactDuration, 0, 1);

  if (state.contactProgress >= 1) {
    state.t += dt;
    const delta = state.hotT - state.coldT;
    const flow = Math.min(transferK * delta * dt, delta * 0.5);
    state.hotT -= flow;
    state.coldT += flow;
    if (lossesToggle.checked) {
      state.hotT += (ambientT - state.hotT) * lossKHot * dt;
      state.coldT += (ambientT - state.coldT) * lossKCold * dt;

      // Διδακτική προσαρμογή: το ψυχρό δοχείο δεν κάνει "κορυφή και πτώση".
      state.coldT = Math.max(state.coldT, state.coldMonotonic);
      state.coldMonotonic = state.coldT;

      if (state.coldT >= state.hotT) {
        const eqT = state.coldT;
        state.hotT = eqT;
        state.coldT = eqT;
      }
    }

    addPointIfNeeded();

    if (!state.eqReached && Math.abs(state.hotT - state.coldT) < 0.2) {
      state.eqReached = true;
      state.eqTime = state.t;
      const eqT = (state.hotT + state.coldT) / 2;
      state.eqTemp = eqT;
      state.hotT = eqT;
      state.coldT = eqT;
      statusText.textContent = "Θερμική ισορροπία";
      eqValue.textContent = eqT.toFixed(2) + " °C";

      if (lossesToggle.checked) {
        setFinalDeltas();
        state.running = false;
        startBtn.textContent = "Start";
        return;
      }
    }

    if (state.eqReached) {
      let eqT = (state.hotT + state.coldT) / 2;
      if (lossesToggle.checked) {
        eqT += (ambientT - eqT) * lossKEqual * dt;
      }
      state.hotT = eqT;
      state.coldT = eqT;
    }

    if (state.eqReached && state.t - state.eqTime >= state.postEqHold) {
      setFinalDeltas();
      state.running = false;
      statusText.textContent = "Ολοκληρώθηκε";
      startBtn.textContent = "Start";
    }
  }
}

function drawContainer(x, y, w, h, temp, title) {
  const color = tempToColor(temp);
  simCtx.save();
  simCtx.shadowColor = "rgba(0,0,0,0.12)";
  simCtx.shadowBlur = 14;
  simCtx.fillStyle = "#ffffff";
  simCtx.strokeStyle = "#9ab0c9";
  simCtx.lineWidth = 3;
  simCtx.beginPath();
  simCtx.roundRect(x, y, w, h, 16);
  simCtx.fill();
  simCtx.stroke();
  simCtx.restore();

  const fillH = h * 0.7;
  simCtx.fillStyle = color;
  simCtx.globalAlpha = 0.9;
  simCtx.beginPath();
  simCtx.roundRect(x + 10, y + h - fillH - 8, w - 20, fillH, 10);
  simCtx.fill();
  simCtx.globalAlpha = 1;

  simCtx.fillStyle = "#12213d";
  simCtx.font = "700 16px Trebuchet MS";
  simCtx.fillText(title, x + 12, y + 24);
  simCtx.font = "700 18px Trebuchet MS";
  simCtx.fillText(`${temp.toFixed(1)} °C`, x + 12, y + h - 14);
}

function drawHeatFlow(contactX0, contactX1, centerY) {
  const x0 = contactX0 - 62;
  const x1 = Math.max(contactX1 + 62, x0 + 140);
  const bandHalf = 24;

  simCtx.fillStyle = "rgba(245, 158, 11, 0.2)";
  simCtx.beginPath();
  simCtx.roundRect(x0, centerY - bandHalf, x1 - x0, bandHalf * 2, 10);
  simCtx.fill();

  simCtx.strokeStyle = "rgba(245, 158, 11, 0.85)";
  simCtx.lineWidth = 4;
  simCtx.beginPath();
  simCtx.moveTo(x0, centerY);
  simCtx.lineTo(x1, centerY);
  simCtx.stroke();

  const step = 30;
  for (let ax = x0 + 16; ax < x1 - 10; ax += step) {
    simCtx.fillStyle = "rgba(245, 158, 11, 0.95)";
    simCtx.beginPath();
    simCtx.moveTo(ax + 10, centerY);
    simCtx.lineTo(ax - 2, centerY - 7);
    simCtx.lineTo(ax - 2, centerY + 7);
    simCtx.closePath();
    simCtx.fill();
  }

  state.particles.forEach((p) => {
    simCtx.shadowColor = "rgba(245, 158, 11, 0.55)";
    simCtx.shadowBlur = 8;
    simCtx.fillStyle = "rgba(255, 184, 28, 0.95)";
    simCtx.beginPath();
    simCtx.arc(p.x, p.y, 4.8, 0, Math.PI * 2);
    simCtx.fill();
    simCtx.shadowBlur = 0;
  });
}

function drawSim() {
  simCtx.clearRect(0, 0, simCanvas.width, simCanvas.height);
  simCtx.fillStyle = "#eef4ff";
  simCtx.fillRect(0, 0, simCanvas.width, simCanvas.height);

  const w = containerW;
  const h = containerH;
  const baseY = containerBaseY;
  const leftStartX = sideMargin;
  const rightStartX = simCanvas.width - sideMargin - w;
  const centerX = simCanvas.width / 2;
  const leftTargetX = centerX - w;
  const rightTargetX = centerX;

  const leftX = leftStartX + (leftTargetX - leftStartX) * state.contactProgress;
  const rightX = rightStartX + (rightTargetX - rightStartX) * state.contactProgress;

  drawContainer(leftX, baseY, w, h, state.hotT, "Θερμό δοχείο");
  drawContainer(rightX, baseY, w, h, state.coldT, "Ψυχρό δοχείο");

  if (state.contactProgress >= 0.02) {
    drawHeatFlow(leftX + w, rightX, baseY + h / 2);
  }

  simCtx.fillStyle = "#10213a";
  simCtx.font = "700 15px Trebuchet MS";
  simCtx.fillText("Ροή θερμότητας: από το θερμό προς το ψυχρό", 34, 34);
}

function drawGraph() {
  graphCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
  graphCtx.fillStyle = "#f9fbff";
  graphCtx.fillRect(0, 0, graphCanvas.width, graphCanvas.height);

  const m = { l: 56, r: 24, t: 20, b: 42 };
  const W = graphCanvas.width - m.l - m.r;
  const H = graphCanvas.height - m.t - m.b;

  const minTime = 0;
  const maxTime = Math.max(8, state.t + 0.8);
  const minT = 0;
  const maxT = 100;
  const x = (t) => m.l + ((t - minTime) / (maxTime - minTime)) * W;
  const y = (T) => m.t + H - ((T - minT) / (maxT - minT)) * H;

  graphCtx.strokeStyle = "#b9cbe0";
  graphCtx.lineWidth = 1;
  graphCtx.beginPath();
  graphCtx.moveTo(m.l, m.t);
  graphCtx.lineTo(m.l, m.t + H);
  graphCtx.lineTo(m.l + W, m.t + H);
  graphCtx.stroke();

  graphCtx.fillStyle = "#233a5a";
  graphCtx.font = "12px Trebuchet MS";
  graphCtx.fillText("Θερμοκρασία (°C)", m.l - 40, m.t - 6);
  graphCtx.fillText("Χρόνος (s)", m.l + W - 52, m.t + H + 28);

  function drawRefLine(temp, label, color) {
    const yy = y(temp);
    graphCtx.save();
    graphCtx.strokeStyle = color;
    graphCtx.setLineDash([6, 5]);
    graphCtx.lineWidth = 1.4;
    graphCtx.beginPath();
    graphCtx.moveTo(m.l, yy);
    graphCtx.lineTo(m.l + W, yy);
    graphCtx.stroke();
    graphCtx.setLineDash([]);
    graphCtx.fillStyle = color;
    graphCtx.font = "700 11px Trebuchet MS";
    graphCtx.fillText(`${label}: ${temp.toFixed(1)}°C`, m.l + 6, yy - 5);
    graphCtx.restore();
  }

  drawRefLine(state.initHot, "T αρχ. θερμού", "#b91c1c");
  drawRefLine(state.initCold, "T αρχ. ψυχρού", "#1d4ed8");
  if (state.eqReached && state.eqTemp !== null) {
    drawRefLine(state.eqTemp, "T ισορρ.", "#0f766e");
  } else if (!lossesToggle.checked) {
    drawRefLine((state.initHot + state.initCold) / 2, "T ισορρ.", "#0f766e");
  }

  graphCtx.strokeStyle = "#d90429";
  graphCtx.lineWidth = 2.6;
  graphCtx.beginPath();
  state.hotPoints.forEach((p, i) => {
    if (i === 0) {
      graphCtx.moveTo(x(p.t), y(p.T));
    } else {
      graphCtx.lineTo(x(p.t), y(p.T));
    }
  });
  graphCtx.stroke();

  graphCtx.strokeStyle = "#1d4ed8";
  graphCtx.lineWidth = 2.6;
  graphCtx.beginPath();
  state.coldPoints.forEach((p, i) => {
    if (i === 0) {
      graphCtx.moveTo(x(p.t), y(p.T));
    } else {
      graphCtx.lineTo(x(p.t), y(p.T));
    }
  });
  graphCtx.stroke();
}

function tick(ts) {
  if (state.lastTimestamp === null) {
    state.lastTimestamp = ts;
  }
  const dt = Math.min(0.033, (ts - state.lastTimestamp) / 1000);
  state.lastTimestamp = ts;

  hotValue.textContent = hotSlider.value;
  coldValue.textContent = coldSlider.value;

  const leftBaseX = sideMargin;
  const w = containerW;
  const rightStartX = simCanvas.width - sideMargin - w;
  const centerX = simCanvas.width / 2;
  const leftTargetX = centerX - w;
  const rightTargetX = centerX;
  const leftX = leftBaseX + (leftTargetX - leftBaseX) * state.contactProgress;
  const rightX = rightStartX + (rightTargetX - rightStartX) * state.contactProgress;
  const flowStartX = leftX + w - 8;
  const flowEndX = Math.max(rightX + 6, flowStartX + 22);
  updateParticles(dt, flowStartX, flowEndX, containerBaseY + containerH / 2, 24);
  update(dt);

  timeValue.textContent = state.t.toFixed(2);
  if (!state.eqReached && !lossesToggle.checked) {
    eqValue.textContent = ((state.initHot + state.initCold) / 2).toFixed(2) + " °C";
  }

  drawSim();
  drawGraph();
  requestAnimationFrame(tick);
}

function handleStartPause() {
  if (!state.running) {
    if (state.eqReached && state.t > 0) {
      initStateFromInputs();
    }
    state.running = true;
    statusText.textContent = "Σε εξέλιξη";
    startBtn.textContent = "Pause";
  } else {
    state.running = false;
    statusText.textContent = "Σε παύση";
    startBtn.textContent = "Start";
  }
}

hotSlider.addEventListener("input", () => {
  if (!state.running) {
    initStateFromInputs();
  }
});

coldSlider.addEventListener("input", () => {
  if (!state.running) {
    initStateFromInputs();
  }
});

lossesToggle.addEventListener("change", () => {
  if (!state.running) {
    initStateFromInputs();
  }
});

startBtn.addEventListener("click", handleStartPause);

resetBtn.addEventListener("click", () => {
  initStateFromInputs();
  drawSim();
  drawGraph();
});

initStateFromInputs();
drawSim();
drawGraph();
requestAnimationFrame(tick);
