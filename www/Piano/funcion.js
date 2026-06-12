/* ── ESTROFAS: cada dedo = un acorde distinto ─────────────────── */
const STROFAS = [
  { name:"Do Mayor",  color:"#FF6B6B", notes:["C3","E3","G3","C4"],   desc:"Tónica grave" },
  { name:"Sol Mayor", color:"#FFB347", notes:["G3","B3","D4","G4"],   desc:"Dominante" },
  { name:"Re Menor",  color:"#FFE066", notes:["D4","F4","A4","D5"],   desc:"Melancólica" },
  { name:"La Menor",  color:"#66FF99", notes:["A3","C4","E4","A4"],   desc:"Oscura" },
  { name:"Fa Mayor",  color:"#5DCAA5", notes:["F3","A3","C4","F4"],   desc:"Subdominante" },
  { name:"Mi Menor",  color:"#5DCAA5", notes:["E3","G3","B3","E4"],   desc:"Suave" },
  { name:"Si♭ Mayor", color:"#66CCFF", notes:["Bb3","D4","F4","Bb4"], desc:"Jazz" },
  { name:"Do7",       color:"#B47FFF", notes:["C3","E3","G3","Bb3"],  desc:"Dominante 7ª" },
  { name:"La Mayor",  color:"#FF80BF", notes:["A3","C#4","E4","A4"],  desc:"Brillante" },
  { name:"Sol Menor", color:"#FF6B6B", notes:["G3","Bb3","D4","G4"],  desc:"Dramática" },
];

/* Render tarjetas de estrofas */
const strfasEl = document.getElementById("strfas");
STROFAS.forEach((s, i) => {
  const div = document.createElement("div");
  div.className = "stcard";
  div.id = "sc" + i;
  div.style.setProperty("--sc", s.color);
  div.innerHTML = `<div class="stnum">Dedo ${i + 1}</div>
    <div class="stname" style="color:${s.color}">${s.name}</div>
    <div class="stkeys">${s.desc}</div>`;
  div.onclick = () => triggerFinger(i);
  strfasEl.appendChild(div);
});

/* ── DOM refs ── */
const video   = document.getElementById("video");
const ovEl    = document.getElementById("overlay");
const ctx2d   = ovEl.getContext("2d");
const startov = document.getElementById("startov");
const sbtn    = document.getElementById("sbtn");
const sdot    = document.getElementById("sdot");
const stxt    = document.getElementById("stxt");
const anote   = document.getElementById("anote");
const aname   = document.getElementById("aname");
const cambox  = document.getElementById("cambox");

/* ── AUDIO (Tone.js) ── */
let synth = null, audioReady = false;

async function ensureAudio() {
  if (audioReady) return;
  await Tone.start();
  const rev = new Tone.Reverb({ decay: 1.2, wet: 0.18 }).toDestination();
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle8" },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 1.4 }
  }).connect(rev);
  audioReady = true;
}

/* Debounce por dedo para evitar repetición rápida */
const lastFire = {};
const DEBMS = 300;

async function triggerFinger(idx) {
  await ensureAudio();
  const now = Date.now();
  if (lastFire[idx] && now - lastFire[idx] < DEBMS) return;
  lastFire[idx] = now;

  const s = STROFAS[idx];
  synth.triggerAttackRelease(s.notes, "4n");

  /* Resaltar dedo */
  document.querySelectorAll(".fdig").forEach(e => e.classList.remove("pressed"));
  const fEl = document.getElementById("fd" + idx);
  if (fEl) { fEl.classList.add("pressed"); setTimeout(() => fEl.classList.remove("pressed"), 400); }

  /* Resaltar tarjeta */
  document.querySelectorAll(".stcard").forEach(e => e.classList.remove("active"));
  const sc = document.getElementById("sc" + idx);
  if (sc) { sc.classList.add("active"); setTimeout(() => sc.classList.remove("active"), 600); }

  anote.textContent = s.name;
  anote.style.color = s.color;
  aname.textContent = `Dedo ${idx + 1} · ${s.notes.join(" ")}`;
  clearTimeout(triggerFinger._t);
  triggerFinger._t = setTimeout(() => {
    anote.textContent = "—";
    anote.style.color = "#FFE066";
    aname.textContent = "Baja un dedo";
  }, 900);
}

/* ── Canvas overlay ── */
function resizeOv() {
  ovEl.width  = cambox.offsetWidth;
  ovEl.height = cambox.offsetHeight;
}
window.addEventListener("resize", resizeOv);
resizeOv();

/* ── MediaPipe: detección de dedos bajados ── */
const TIP_IDS = [4, 8, 12, 16, 20]; // pulgar, índice, medio, anular, meñique
const MCP_IDS = [3, 6, 10, 14, 18]; // articulaciones base

function isFingerDown(lm, i) {
  if (i === 0) {
    // Pulgar: cercanía al índice (pinza)
    return Math.abs(lm[4].x - lm[2].x) < 0.08;
  }
  // Resto: la yema baja por debajo de la articulación base
  return lm[TIP_IDS[i]].y > lm[MCP_IDS[i]].y + 0.04;
}

const CONN = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

function drawSkeleton(c, lm, W, H, col) {
  c.strokeStyle = col;
  c.lineWidth = 1;
  CONN.forEach(([a, b]) => {
    c.beginPath();
    c.moveTo((1 - lm[a].x) * W, lm[a].y * H);
    c.lineTo((1 - lm[b].x) * W, lm[b].y * H);
    c.stroke();
  });
}

function drawTip(c, x, y, col, pressed) {
  c.beginPath();
  c.arc(x, y, pressed ? 9 : 5, 0, Math.PI * 2);
  c.fillStyle = col;
  c.fill();
  if (pressed) {
    c.beginPath();
    c.arc(x, y, 13, 0, Math.PI * 2);
    c.strokeStyle = col + "88";
    c.lineWidth = 2;
    c.stroke();
  }
}

function onResults(res) {
  resizeOv();
  ctx2d.clearRect(0, 0, ovEl.width, ovEl.height);
  const W = ovEl.width, H = ovEl.height;
  const lms   = res.multiHandLandmarks || [];
  const hands = res.multiHandedness    || [];

  hands.forEach((h, hi) => {
    const lm = lms[hi];
    // MediaPipe etiqueta "Right"/"Left" según el modelo (espejo invierte)
    const isRight = h.label === "Left";
    const baseIdx = isRight ? 5 : 0; // der=5–9, izq=0–4

    drawSkeleton(ctx2d, lm, W, H, (isRight ? "#66CCFF" : "#FF6B6B") + "44");

    TIP_IDS.forEach((tid, fi) => {
      const down = isFingerDown(lm, fi);
      const tx = (1 - lm[tid].x) * W;
      const ty = lm[tid].y * H;
      const fc = STROFAS[baseIdx + fi].color;
      drawTip(ctx2d, tx, ty, fc, down);
      if (down) triggerFinger(baseIdx + fi);
    });
  });
}

function setStatus(st, msg) { sdot.className = st; stxt.textContent = msg; }

/* ── Iniciar cámara ── */
sbtn.addEventListener("click", async () => {
  await ensureAudio();
  setStatus("loading", "Solicitando cámara...");
  sbtn.disabled = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" }
    });
    video.srcObject = stream;
    await new Promise(r => { video.onloadedmetadata = r; });

    setStatus("loading", "Cargando detector de manos...");

    const handsMP = new Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });
    handsMP.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.72,
      minTrackingConfidence: 0.6
    });
    handsMP.onResults(onResults);

    const cam = new Camera(video, {
      onFrame: async () => { await handsMP.send({ image: video }); },
      width: 640, height: 480
    });
    await cam.start();

    startov.style.display = "none";
    setStatus("active", "¡Listo! Baja cualquier dedo para sonar su estrofa");

  } catch (err) {
    const msg = err.name === "NotAllowedError"
      ? "Cámara denegada — usa clic en las tarjetas"
      : "Error: " + err.message;
    setStatus("error", msg);
    startov.style.display = "none";
  }
});