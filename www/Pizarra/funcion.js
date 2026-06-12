
// ══════════════════════════════════════════════
//  CONFIGURACIÓN
// ══════════════════════════════════════════════
const PALETA = [
  '#4af7a0','#4488ff','#ff4466','#cc44ff',
  '#ffee33','#ff8833','#ffffff','#888888'
];

const PINCH_TH       = 0.065;
const VICTORY_TH     = 0.08;
const ERASER_R       = 32;
const SMOOTH_WIN     = 7;
const MIN_B          = 2;
const MAX_B          = 26;
const GESTURE_CD     = 650;  // ms entre cambios de color
const MAX_UNDO       = 15;

// Estado compartido (color y grosor los controla la derecha, los usa la izquierda)
const shared = {
  colorIdx: 0,
  brush:    4,
};

const leftState = {
  prevSmoothed: null,
  rawBuffer:    [],
  drawing:      false,
};

const rightState = {
  gesture:          'standby',
  lastGestureTime:  0,
};

const undoStack = [];

// ══════════════════════════════════════════════
//  DOM
// ══════════════════════════════════════════════
const video        = document.getElementById('video');
const canvas       = document.getElementById('drawCanvas');
const ctx          = canvas.getContext('2d');
const startOverlay = document.getElementById('startOverlay');
const gestureTip   = document.getElementById('gestureTip');
const cursorLeft   = document.getElementById('cursorLeft');
const cursorRight  = document.getElementById('cursorRight');

// ══════════════════════════════════════════════
//  CANVAS
// ══════════════════════════════════════════════
function resizeCanvas() {
  const c = document.getElementById('container');
  const img = canvas.width > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
  canvas.width  = c.offsetWidth;
  canvas.height = c.offsetHeight;
  if (img) ctx.putImageData(img, 0, 0);
}

function saveUndo() {
  if (undoStack.length >= MAX_UNDO) undoStack.shift();
  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

// ══════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════
function buildPalette() {
  const row = document.getElementById('colorsLeft');
  row.innerHTML = '';
  PALETA.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'color-dot' + (i === shared.colorIdx ? ' active' : '');
    d.style.background = c;
    d.addEventListener('click', () => { shared.colorIdx = i; refreshUI(); });
    row.appendChild(d);
  });
}

function refreshUI() {
  const color = PALETA[shared.colorIdx];
  const pct   = ((shared.brush - MIN_B) / (MAX_B - MIN_B) * 100).toFixed(0);

  buildPalette();

  document.getElementById('brushBarLeft').style.width      = pct + '%';
  document.getElementById('brushBarLeft').style.background = color;
  document.getElementById('brushValLeft').textContent      = shared.brush + 'px';
}

function setLeftMode(mode) {
  const el    = document.getElementById('modeLeft');
  const color = PALETA[shared.colorIdx];
  if (mode === 'draw')    { el.style.color = color;   el.textContent = '✏ Dibujando'; }
  else if (mode === 'pause') { el.style.color = '#333'; el.textContent = '— Pausa'; }
  else                    { el.style.color = '#333';   el.textContent = '— Standby'; }
}

function setRightMode(gesture) {
  const el = document.getElementById('modeRight');
  const labels = {
    erase:   { color:'#888',    text:'⬜ Borrando' },
    color:   { color:'#cc88ff', text:'🎨 Cambiando color' },
    resize:  { color:'#ffbb44', text:'↕ Ajustando grosor' },
    standby: { color:'#333',    text:'— Standby' },
  };
  const l = labels[gesture] || labels.standby;
  el.style.color  = l.color;
  el.textContent  = l.text;

  // resalta el gesto activo en la lista
  ['gErase','gColor','gResize','gStandby'].forEach(id => {
    document.getElementById(id).className = '';
  });
  const map = { erase:'gErase', color:'gColor', resize:'gResize', standby:'gStandby' };
  if (map[gesture]) document.getElementById(map[gesture]).className = 'active-gesture';
}

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function lm2px(lm) {
  return { x: (1 - lm.x) * canvas.width, y: lm.y * canvas.height };
}
function distLm(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function isUp(lm, tip, pip, mcp) { return lm[tip].y < lm[pip].y && lm[pip].y < lm[mcp].y; }

function smoothPos(raw) {
  const buf = leftState.rawBuffer;
  buf.push(raw);
  if (buf.length > SMOOTH_WIN) buf.shift();
  let wx=0, wy=0, wt=0;
  buf.forEach((p,i) => { const w=i+1; wx+=p.x*w; wy+=p.y*w; wt+=w; });
  return { x: wx/wt, y: wy/wt };
}

let tipTimer;
function flashTip(msg) {
  gestureTip.textContent = msg;
  gestureTip.classList.add('flash');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => {
    gestureTip.textContent = '✏ Izquierda dibuja · 🎛 Derecha controla color, grosor y borrador';
    gestureTip.classList.remove('flash');
  }, 2200);
}

// ══════════════════════════════════════════════
//  MANO IZQUIERDA — solo dibuja
// ══════════════════════════════════════════════
function processLeft(lm) {
  const rawPos   = lm2px(lm[8]);
  const indexUp  = isUp(lm, 8, 6, 5);

  // cursor fantasma
  cursorLeft.style.left         = rawPos.x + 'px';
  cursorLeft.style.top          = rawPos.y + 'px';
  cursorLeft.style.opacity      = '0.55';
  cursorLeft.style.borderColor  = PALETA[shared.colorIdx];

  if (!indexUp) {
    // dedo bajado: pausa sin borrar nada
    leftState.prevSmoothed = null;
    leftState.rawBuffer    = [];
    leftState.drawing      = false;
    setLeftMode('pause');
    return;
  }

  // índice arriba → dibuja
  if (!leftState.drawing) {
    saveUndo();
    leftState.drawing      = true;
    leftState.rawBuffer    = [];
    leftState.prevSmoothed = null;
  }

  const smoothed = smoothPos(rawPos);
  setLeftMode('draw');

  if (leftState.prevSmoothed) {
    ctx.beginPath();
    ctx.strokeStyle = PALETA[shared.colorIdx];
    ctx.lineWidth   = shared.brush;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.moveTo(leftState.prevSmoothed.x, leftState.prevSmoothed.y);
    ctx.lineTo(smoothed.x, smoothed.y);
    ctx.stroke();
  }

  leftState.prevSmoothed = smoothed;
}

// ══════════════════════════════════════════════
//  MANO DERECHA — control total
// ══════════════════════════════════════════════
function detectRightGesture(lm) {
  const pinch    = distLm(lm[4], lm[8]);
  const indexUp  = isUp(lm, 8,  6,  5);
  const middleUp = isUp(lm, 12, 10, 9);
  const ringUp   = isUp(lm, 16, 14, 13);

  if (pinch < PINCH_TH)                return 'erase';
  if (indexUp && middleUp && ringUp)    return 'resize';
  if (indexUp && middleUp && !ringUp) {
    if (distLm(lm[8], lm[12]) > VICTORY_TH) return 'color';
  }
  return 'standby';
}

function processRight(lm) {
  const gesture = detectRightGesture(lm);
  const now     = performance.now();

  // cursor fantasma
  const rawPos = lm2px(lm[8]);
  cursorRight.style.left        = rawPos.x + 'px';
  cursorRight.style.top         = rawPos.y + 'px';
  cursorRight.style.opacity     = '0.55';
  cursorRight.style.borderColor = '#ff8833';

  setRightMode(gesture);
  rightState.gesture = gesture;

  // ── BORRADOR ─────────────────────────────
  if (gesture === 'erase') {
    const tip4 = lm2px(lm[4]);
    const tip8 = lm2px(lm[8]);
    const mid  = { x:(tip4.x+tip8.x)/2, y:(tip4.y+tip8.y)/2 };
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, ERASER_R, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fill();
    ctx.restore();
    return;
  }

  // ── CAMBIAR COLOR ────────────────────────
  if (gesture === 'color') {
    if (now - rightState.lastGestureTime > GESTURE_CD) {
      shared.colorIdx = (shared.colorIdx + 1) % PALETA.length;
      rightState.lastGestureTime = now;
      refreshUI();
      flashTip('🎨 Color → ' + PALETA[shared.colorIdx]);
    }
    return;
  }

  // ── AJUSTAR GROSOR ───────────────────────
  // La distancia entre pulgar (4) y meñique (20) en modo 3-dedos
  // da un rango más amplio y natural
  if (gesture === 'resize') {
    const apertura = distLm(lm[4], lm[8]);
    const mapped   = Math.round(MIN_B + (apertura / 0.38) * (MAX_B - MIN_B));
    shared.brush   = Math.min(MAX_B, Math.max(MIN_B, mapped));
    refreshUI();
    return;
  }
}

// ══════════════════════════════════════════════
//  CALLBACK MEDIAPIPE
// ══════════════════════════════════════════════
function onResults(results) {
  let detectedLeft  = false;
  let detectedRight = false;

  if (results.multiHandLandmarks) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const lm    = results.multiHandLandmarks[i];
      const label = results.multiHandedness[i].label;
      // Invertir etiqueta: MediaPipe ve espejo → invertimos
      const side  = label === 'Left' ? 'Right' : 'Left';

      if (side === 'Left')  { detectedLeft  = true; processLeft(lm);  }
      if (side === 'Right') { detectedRight = true; processRight(lm); }
    }
  }

  if (!detectedLeft) {
    cursorLeft.style.opacity   = '0';
    leftState.prevSmoothed     = null;
    leftState.rawBuffer        = [];
    leftState.drawing          = false;
    setLeftMode('standby');
  }
  if (!detectedRight) {
    cursorRight.style.opacity  = '0';
    setRightMode('standby');
  }
}

// ══════════════════════════════════════════════
//  TOOLBAR
// ══════════════════════════════════════════════
document.getElementById('btnUndo').addEventListener('click', () => {
  if (undoStack.length > 0) { ctx.putImageData(undoStack.pop(), 0, 0); flashTip('↩ Deshecho'); }
  else flashTip('Sin acciones para deshacer');
});

document.getElementById('btnClear').addEventListener('click', () => {
  saveUndo();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  flashTip('🗑 Lienzo limpiado');
});

document.getElementById('btnSave').addEventListener('click', () => {
  const exp = document.createElement('canvas');
  exp.width  = canvas.width;
  exp.height = canvas.height;
  const ec = exp.getContext('2d');
  ec.fillStyle = '#0d0d0d';
  ec.fillRect(0, 0, exp.width, exp.height);
  ec.drawImage(canvas, 0, 0);
  const a = document.createElement('a');
  a.download = 'pizarra_' + Date.now() + '.png';
  a.href = exp.toDataURL('image/png');
  a.click();
  flashTip('💾 Guardado como PNG');
});

// ══════════════════════════════════════════════
//  INICIO
// ══════════════════════════════════════════════
document.getElementById('startBtn').addEventListener('click', async () => {
  startOverlay.style.display = 'none';
  resizeCanvas();
  refreshUI();

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width:860, height:620, facingMode:'user' }
    });
  } catch(e) {
    alert('Cámara no disponible: ' + e.message);
    startOverlay.style.display = 'flex';
    return;
  }

  video.srcObject = stream;
  video.play();

  const hands = new Hands({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  hands.setOptions({
    maxNumHands:            2,
    modelComplexity:        1,
    minDetectionConfidence: 0.75,
    minTrackingConfidence:  0.65
  });
  hands.onResults(onResults);

  const camera = new Camera(video, {
    onFrame: async () => { await hands.send({ image: video }); },
    width:860, height:620
  });
  camera.start();
});

window.addEventListener('resize', resizeCanvas);