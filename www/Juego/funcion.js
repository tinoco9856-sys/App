/* ══════════════════════════════════════════════════
   REFERENCIAS DOM
══════════════════════════════════════════════════ */
const canvas   = document.getElementById('gc');
const ctx      = canvas.getContext('2d');
const video    = document.getElementById('webcam');
const statusEl = document.getElementById('status');
const cdEl     = document.getElementById('cd');
const vScore   = document.getElementById('v-score');
const vLives   = document.getElementById('v-lives');
const vTimer   = document.getElementById('v-timer');
const vRecord  = document.getElementById('v-record');

/* ══════════════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════════════ */
const TOTAL_TIME = 60;
const MAX_LIVES  = 3;
const HEARTS     = ['', '❤️', '❤️❤️', '❤️❤️❤️'];

/* ══════════════════════════════════════════════════
   ESTADO DEL JUEGO
══════════════════════════════════════════════════ */
let score      = 0;
let lives      = MAX_LIVES;
let timeLeft   = TOTAL_TIME;
let popped     = 0;
let secondsUsed = 0;

// REQ 3: arreglos de objetos
let bubbles    = [];   // burbujas activas
let particles  = [];   // partículas de explosión
let fingers    = [];   // punteros de dedos detectados por MediaPipe

let running    = false;
let rafId      = null;
let timerIv    = null;
let frameCount = 0;
let spawnEvery = 55;   // fotogramas entre burbujas (se reduce con el tiempo)
let dmgFlash   = 0;

/* ══════════════════════════════════════════════════
   CANVAS – AJUSTE DE TAMAÑO
══════════════════════════════════════════════════ */
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

/* ══════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════ */
const rnd = (a, b) => Math.random() * (b - a) + a;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  if (id) document.getElementById(id).classList.remove('hidden');
}

/* ══════════════════════════════════════════════════
   RÉCORDS (localStorage)
══════════════════════════════════════════════════ */
function loadRec() {
  try { return JSON.parse(localStorage.getItem('cb_v3') || '[]'); }
  catch { return []; }
}
function saveRec(entry) {
  let r = loadRec();
  r.push(entry);
  r.sort((a, b) => b.score - a.score);
  r = r.slice(0, 10);
  localStorage.setItem('cb_v3', JSON.stringify(r));
  return r;
}
function clearRec()  { localStorage.removeItem('cb_v3'); renderRecords(); }
function renderRecords() {
  const rows   = loadRec();
  const medals = ['🥇','🥈','🥉'];
  document.getElementById('rec-body').innerHTML = rows.length
    ? rows.map((r, i) =>
        `<tr><td>${medals[i] || i+1}</td><td>${r.score}</td><td>${r.bub}</td><td>${r.time}s</td></tr>`
      ).join('')
    : `<tr><td colspan="4" style="color:rgba(160,200,255,.4);padding:16px">Sin récords todavía</td></tr>`;
  vRecord.textContent = rows[0]?.score ?? 0;
}
renderRecords();
function goRecords() { renderRecords(); showScreen('s-records'); }

/* ══════════════════════════════════════════════════
   REQ 3: GENERACIÓN DE BURBUJAS
   Estructura: { x, y, radius, speed, active, hue, wobbleOffset, wobbleSpeed }
══════════════════════════════════════════════════ */
function spawnBubble() {
  const radius = rnd(20, 52);
  const hue    = rnd(170, 275);
  bubbles.push({
    x:            rnd(radius + 20, canvas.width - radius - 20),
    y:            -radius - 10,
    radius,
    speed:        rnd(1.4, 3.2 + (TOTAL_TIME - timeLeft) * 0.04),
    active:       true,
    hue,
    wobbleOffset: rnd(0, Math.PI * 2),
    wobbleSpeed:  rnd(0.018, 0.055)
  });
}

/* ══════════════════════════════════════════════════
   DIBUJO DE UNA BURBUJA (gradiente radial traslúcido)
══════════════════════════════════════════════════ */
function drawBubble(b) {
  b.wobbleOffset += b.wobbleSpeed;
  b.x += Math.sin(b.wobbleOffset) * 2.2;

  const grd = ctx.createRadialGradient(
    b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.06,
    b.x, b.y, b.radius
  );
  grd.addColorStop(0,   `rgba(255,255,255,0.55)`);
  grd.addColorStop(0.4, `hsla(${b.hue},80%,65%,0.72)`);
  grd.addColorStop(1,   `hsla(${b.hue},80%,55%,0.12)`);

  ctx.save();
  ctx.shadowColor = `hsla(${b.hue},100%,75%,0.6)`;
  ctx.shadowBlur  = 20;

  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fillStyle   = grd;
  ctx.fill();
  ctx.strokeStyle = `hsla(${b.hue},100%,80%,0.65)`;
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Reflejo
  ctx.shadowBlur  = 0;
  ctx.beginPath();
  ctx.arc(b.x - b.radius * 0.28, b.y - b.radius * 0.3, b.radius * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
  ctx.restore();
}

/* ══════════════════════════════════════════════════
   REQ 5 (Avanzado): PARTÍCULAS DE EXPLOSIÓN
══════════════════════════════════════════════════ */
function createExplosion(x, y, hue) {
  for (let i = 0; i < 16; i++) {
    const angle = rnd(0, Math.PI * 2);
    const speed = rnd(2.5, 8);
    particles.push({
      x, y,
      vx:     Math.cos(angle) * speed,
      vy:     Math.sin(angle) * speed - rnd(1, 3),
      radius: rnd(3, 9),
      alpha:  1,
      hue
    });
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.18;
    p.vx *= 0.97;
    p.alpha  -= 0.036;
    p.radius *= 0.97;

    if (p.alpha <= 0.04) { particles.splice(i, 1); continue; }

    ctx.save();
    ctx.globalAlpha  = p.alpha;
    ctx.shadowColor  = `hsla(${p.hue},100%,70%,0.8)`;
    ctx.shadowBlur   = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue},90%,65%,1)`;
    ctx.fill();
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════
   DIBUJO DE LOS PUNTEROS DE DEDOS
══════════════════════════════════════════════════ */
function drawFingers() {
  for (const f of fingers) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,220,255,0.9)';
    ctx.shadowBlur  = 22;
    const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 16);
    g.addColorStop(0, 'rgba(0,240,255,0.95)');
    g.addColorStop(1, 'rgba(0,100,255,0.0)');
    ctx.beginPath();
    ctx.arc(f.x, f.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════
   REQ 4: DETECCIÓN DE COLISIONES CIRCULARES
   dist = √( (fx−bx)² + (fy−by)² )
   Colisión si dist ≤ radius
══════════════════════════════════════════════════ */
function checkCollisions() {
  for (const b of bubbles) {
    if (!b.active) continue;
    for (const f of fingers) {
      const dx   = f.x - b.x;
      const dy   = f.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);   // distancia euclidiana

      if (dist <= b.radius) {         // REQ 4: condición de colisión
        b.active = false;             // REQ 5: estado → inactiva
        score   += 10;                // REQ 5: +10 puntos
        popped++;
        vScore.textContent = score;
        createExplosion(b.x, b.y, b.hue);  // REQ 5: efecto de partículas
        break;
      }
    }
  }
}

/* ══════════════════════════════════════════════════
   REQ 3: GAME LOOP (requestAnimationFrame)
══════════════════════════════════════════════════ */
function gameLoop() {
  if (!running) return;
  rafId = requestAnimationFrame(gameLoop);
  frameCount++;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Flash de daño (burbuja cayó al suelo)
  if (dmgFlash > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(220,0,50,0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    dmgFlash--;
  }

  // REQ 3: spawn periódico
  if (frameCount % spawnEvery === 0) spawnBubble();

  // REQ 3: actualizar y dibujar burbujas
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];

    if (!b.active) { bubbles.splice(i, 1); continue; }

    b.y += b.speed;   // simula caída libre

    // REQ 3: burbuja fuera del límite inferior → eliminar del arreglo
    if (b.y - b.radius > canvas.height) {
      bubbles.splice(i, 1);
      lives--;
      dmgFlash = 10;
      updateLives();
      if (lives <= 0) { endGame('lives'); return; }
      continue;
    }
    drawBubble(b);
  }

  drawParticles();
  checkCollisions();
  drawFingers();
}

/* ══════════════════════════════════════════════════
   TIMER
══════════════════════════════════════════════════ */
function startTimer() {
  clearInterval(timerIv);
  timerIv = setInterval(() => {
    if (!running) { clearInterval(timerIv); return; }
    timeLeft--;
    secondsUsed++;
    vTimer.textContent   = timeLeft;
    vTimer.style.color   = timeLeft <= 10 ? '#ff6b8a' : '#7fffb0';
    // Aumentar dificultad cada 15 seg
    if (timeLeft % 15 === 0 && spawnEvery > 28) spawnEvery -= 5;
    if (timeLeft <= 0) endGame('time');
  }, 1000);
}

function updateLives() {
  vLives.textContent = HEARTS[Math.max(0, lives)] || '';
}

/* ══════════════════════════════════════════════════
   RESET
══════════════════════════════════════════════════ */
function resetGame() {
  score = 0; lives = MAX_LIVES; timeLeft = TOTAL_TIME;
  popped = 0; secondsUsed = 0; frameCount = 0; spawnEvery = 55;
  bubbles = []; particles = [];
  vScore.textContent  = 0;
  vTimer.textContent  = TOTAL_TIME;
  vTimer.style.color  = '#7fffb0';
  updateLives();
  cancelAnimationFrame(rafId);
  clearInterval(timerIv);
}

/* ══════════════════════════════════════════════════
   CUENTA ATRÁS
══════════════════════════════════════════════════ */
function doCountdown() {
  showScreen(null);
  resetGame();
  let n = 3;
  cdEl.textContent = n;
  cdEl.style.opacity = '1';
  const iv = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(iv);
      cdEl.textContent = '¡Ya!';
      setTimeout(() => { cdEl.style.opacity = '0'; startGame(); }, 650);
    } else {
      cdEl.textContent = n;
    }
  }, 900);
}

/* ══════════════════════════════════════════════════
   INICIAR / TERMINAR
══════════════════════════════════════════════════ */
function startGame() {
  running = true;
  startTimer();
  gameLoop();
}

function endGame(reason) {
  running = false;
  cancelAnimationFrame(rafId);
  clearInterval(timerIv);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const entry   = { score, bub: popped, time: secondsUsed };
  const records = saveRec(entry);
  renderRecords();

  const isTop = records.length > 0 &&
    records[0].score === score &&
    records.filter(r => r.score === score).length === 1;

  document.getElementById('go-title').textContent =
    reason === 'lives' ? '💔 ¡Sin vidas!' : '⏱ ¡Tiempo agotado!';
  document.getElementById('go-pts').textContent = score;
  document.getElementById('go-bub').textContent = popped;
  document.getElementById('go-t').textContent   = secondsUsed + 's';
  document.getElementById('go-msg').textContent = isTop ? '🏆 ¡Nuevo récord personal!' : '';
  showScreen('s-over');
}

/* ══════════════════════════════════════════════════
   REQ 2: INICIALIZACIÓN DE MEDIAPIPE HANDS
   maxNumHands: 2 | Puntos 8 (índice) y 12 (medio)
══════════════════════════════════════════════════ */
function initMediaPipe() {
  if (typeof Hands === 'undefined') {
    statusEl.textContent = '⚠ MediaPipe no disponible — modo ratón/táctil activo';
    fallbackMouseTouch();
    return;
  }

  const hands = new Hands({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`
  });

  hands.setOptions({
    maxNumHands:            2,       // REQ 2: hasta dos manos
    modelComplexity:        1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence:  0.55
  });

  // REQ 2: callback – extraer puntos 8 y 12 de cada mano
  hands.onResults(results => {
    fingers = [];
    if (!results.multiHandLandmarks) return;

    for (const landmarks of results.multiHandLandmarks) {
      // Punto 8 = punta índice | Punto 12 = punta medio
      for (const idx of [8, 12]) {
        const lm = landmarks[idx];
        if (!lm) continue;
        // Video en espejo → invertir X con (1 − lm.x)
        fingers.push({
          x: (1 - lm.x) * canvas.width,
          y:       lm.y  * canvas.height
        });
      }
    }

    const n = results.multiHandLandmarks.length;
    statusEl.textContent = n > 0
      ? `✅ ${n} mano(s) detectada(s) — dedos activos: ${fingers.length}`
      : '👐 Esperando manos frente a la cámara…';
  });

  // Camera de MediaPipe: alimenta cada frame a Hands
  if (typeof Camera !== 'undefined') {
    new Camera(video, {
      onFrame: async () => { await hands.send({ image: video }); },
      width: 1280, height: 720
    }).start()
      .then(() => statusEl.textContent = '✅ Detección activa — ¡a jugar!')
      .catch(() => { statusEl.textContent = '⚠ Error cámara — modo ratón activo'; fallbackMouseTouch(); });
  } else {
    video.addEventListener('loadeddata', function feed() {
      if (!running) return;
      hands.send({ image: video }).then(() => requestAnimationFrame(feed));
    });
  }
}

/* ══════════════════════════════════════════════════
   ACCESO A LA CÁMARA WEB
══════════════════════════════════════════════════ */
function initCamera() {
  navigator.mediaDevices
    .getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } })
    .then(stream => {
      video.srcObject = stream;
      statusEl.textContent = '📷 Cámara lista — iniciando MediaPipe…';
      initMediaPipe();
    })
    .catch(() => {
      statusEl.textContent = '⚠ Sin cámara — modo ratón/táctil activo';
      fallbackMouseTouch();
    });
}

/* ══════════════════════════════════════════════════
   MODO DE RESPALDO: ratón y táctil
══════════════════════════════════════════════════ */
function fallbackMouseTouch() {
  const wrap = document.getElementById('wrap');
  wrap.style.cursor = 'crosshair';
  wrap.addEventListener('mousemove', e => {
    fingers = [{ x: e.clientX, y: e.clientY }];
  });
  wrap.addEventListener('mouseleave', () => { fingers = []; });
  wrap.addEventListener('touchmove', e => {
    e.preventDefault();
    fingers = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
  }, { passive: false });
  wrap.addEventListener('touchend', () => { fingers = []; });
}

/* ══════════════════════════════════════════════════
   ARRANQUE
══════════════════════════════════════════════════ */
initCamera();