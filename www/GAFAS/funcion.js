/* ─── Estado global ─────────────────────────────────────────── */
  let selectedGlass = 0;
  let verticalOffset = -10;
  let glassOpacity  = 0.90;
  let showDebug     = false;
  let faceMesh      = null;
  let mpCamera      = null;

  /* ─── Elementos del DOM ─────────────────────────────────────── */
  const video    = document.getElementById('videoEl');
  const canvas   = document.getElementById('overlayCanvas');
  const ctx      = canvas.getContext('2d');
  const badge    = document.getElementById('status-badge');
  const statusTx = document.getElementById('status-text');
  const lmInfo   = document.getElementById('landmark-info');

  /* ─── Definición de modelos de gafas ────────────────────────── */
  /*
   * Cada modelo expone:
   *   draw(ctx, w, h, isPreview) → dibuja las gafas en un canvas de w×h
   *   aspectRatio                → w/h nativo del accesorio
   */
  const GLASSES = [
    { name: 'Aviador Dorado', aspectRatio: 2.8, draw: drawAviador },
    { name: 'Retro Carey',    aspectRatio: 2.2, draw: drawRetro   },
    { name: 'Cat-Eye',        aspectRatio: 2.5, draw: drawCatEye  },
    { name: 'Wayfarer',       aspectRatio: 2.3, draw: drawWayfarer},
  ];

  /* ────────────────────────────────────────────────────────────
   * FUNCIONES DE DIBUJO DE CADA MODELO
   * Parámetros:
   *   ctx        : CanvasRenderingContext2D
   *   w, h       : dimensiones del canvas temporal (dinámicas en AR)
   *   isPreview  : booleano — líneas más finas en las miniaturas
   * ──────────────────────────────────────────────────────────── */

  /** Gafas Aviador — lentes ovalados con puente fino y varillas */
  function drawAviador(ctx, w, h, isPreview) {
    const lw = isPreview ? 1.5 : Math.max(1.5, w * 0.005);
    const lensW = w * 0.38, lensH = h * 0.72;
    const lx = w * 0.06, rx = w * 0.56;
    const cy = h * 0.45;

    ctx.lineWidth = lw;
    ctx.strokeStyle = '#C8A94A';

    /* Lente izquierda */
    ctx.fillStyle = 'rgba(100,160,220,0.32)';
    ctx.beginPath();
    ctx.ellipse(lx + lensW / 2, cy, lensW / 2, lensH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Lente derecha */
    ctx.beginPath();
    ctx.ellipse(rx + lensW / 2, cy, lensW / 2, lensH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* Puente central */
    ctx.beginPath();
    ctx.moveTo(lx + lensW, cy - lensH * 0.08);
    ctx.bezierCurveTo(
      lx + lensW + (rx - lx - lensW) * 0.3, cy + lensH * 0.15,
      rx - (rx - lx - lensW) * 0.3,         cy + lensH * 0.15,
      rx, cy - lensH * 0.08
    );
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();

    /* Varillas (brazos) */
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, cy - lensH * 0.05);
    ctx.lineTo(lx, cy - lensH * 0.05);
    ctx.moveTo(rx + lensW, cy - lensH * 0.05);
    ctx.lineTo(w, cy - lensH * 0.05);
    ctx.stroke();

    /* Remaches decorativos */
    [lx, rx + lensW].forEach(x => {
      ctx.beginPath();
      ctx.arc(x, cy - lensH * 0.05, lw * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#C8A94A';
      ctx.fill();
    });
  }

  /** Gafas Retro Carey — montura rectangular gruesa */
  function drawRetro(ctx, w, h, isPreview) {
    const lw = isPreview ? 2.5 : Math.max(3, w * 0.012);
    const lensW = w * 0.40, lensH = h * 0.75;
    const lx = w * 0.04, rx = w * 0.56;
    const ty = h * 0.12;
    const radius = lensH * 0.15;

    ctx.lineWidth = lw;
    ctx.strokeStyle = '#6B3A1F';

    /* Gradiente tortoiseshell simplificado */
    const grad = ctx.createLinearGradient(lx, ty, lx + lensW, ty + lensH);
    grad.addColorStop(0,   'rgba(120,68,28,0.55)');
    grad.addColorStop(0.4, 'rgba(200,130,50,0.35)');
    grad.addColorStop(1,   'rgba(80,30,10,0.55)');
    ctx.fillStyle = grad;

    for (const ox of [lx, rx]) {
      ctx.beginPath();
      ctx.roundRect(ox, ty, lensW, lensH, radius);
      ctx.fill();
      ctx.stroke();
    }

    /* Puente */
    ctx.lineWidth = lw * 0.6;
    ctx.beginPath();
    ctx.moveTo(lx + lensW, h * 0.38);
    ctx.lineTo(rx,         h * 0.38);
    ctx.stroke();

    /* Varillas */
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.36);
    ctx.lineTo(lx, h * 0.38);
    ctx.moveTo(rx + lensW, h * 0.38);
    ctx.lineTo(w, h * 0.36);
    ctx.stroke();
  }

  /** Gafas Cat-Eye — punta elevada en las esquinas externas */
  function drawCatEye(ctx, w, h, isPreview) {
    const lw = isPreview ? 2 : Math.max(2, w * 0.009);
    const lensW = w * 0.40, lensH = h * 0.72;
    const lx = w * 0.05, rx = w * 0.55;
    const ty = h * 0.16;

    ctx.lineWidth = lw;
    ctx.strokeStyle = '#3a1060';

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(100,40,180,0.45)');
    grad.addColorStop(1, 'rgba(60,10,120,0.30)');
    ctx.fillStyle = grad;

    /* Lente izquierdo (espejo de cat-eye) */
    ctx.save();
    ctx.translate(lx + lensW / 2, ty + lensH / 2);
    ctx.beginPath();
    ctx.moveTo(-lensW / 2,  lensH * 0.15);
    ctx.bezierCurveTo(-lensW / 2, -lensH / 2, lensW * 0.05, -lensH / 2, lensW * 0.3, -lensH / 2 - lensH * 0.28);
    ctx.bezierCurveTo( lensW / 2,  -lensH * 0.05, lensW / 2, lensH * 0.1, lensW / 2, lensH * 0.15);
    ctx.bezierCurveTo( lensW / 2,   lensH / 2, -lensW / 2, lensH / 2, -lensW / 2, lensH * 0.15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    /* Lente derecho (reflejo horizontal) */
    ctx.save();
    ctx.translate(rx + lensW / 2, ty + lensH / 2);
    ctx.scale(-1, 1);
    ctx.beginPath();
    ctx.moveTo(-lensW / 2,  lensH * 0.15);
    ctx.bezierCurveTo(-lensW / 2, -lensH / 2, lensW * 0.05, -lensH / 2, lensW * 0.3, -lensH / 2 - lensH * 0.28);
    ctx.bezierCurveTo( lensW / 2,  -lensH * 0.05, lensW / 2, lensH * 0.1, lensW / 2, lensH * 0.15);
    ctx.bezierCurveTo( lensW / 2,   lensH / 2, -lensW / 2, lensH / 2, -lensW / 2, lensH * 0.15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    /* Puente */
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(lx + lensW, h * 0.42);
    ctx.lineTo(rx,         h * 0.42);
    ctx.stroke();

    /* Varillas */
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.40);
    ctx.lineTo(lx, h * 0.42);
    ctx.moveTo(rx + lensW, h * 0.42);
    ctx.lineTo(w, h * 0.40);
    ctx.stroke();
  }

  /** Gafas Wayfarer — forma trapezoidal icónica */
  function drawWayfarer(ctx, w, h, isPreview) {
    const lw = isPreview ? 2.5 : Math.max(3, w * 0.011);
    const lensW = w * 0.40, lensH = h * 0.74;
    const lx = w * 0.04, rx = w * 0.56;
    const ty = h * 0.13;
    const bevel = lensH * 0.22;

    ctx.lineWidth = lw;
    ctx.strokeStyle = '#1a1a1a';
    ctx.fillStyle   = 'rgba(30,30,30,0.42)';

    for (const ox of [lx, rx]) {
      /* Trapecio: arriba más ancho que abajo */
      ctx.beginPath();
      ctx.moveTo(ox + bevel * 0.3,       ty);
      ctx.lineTo(ox + lensW,             ty);
      ctx.lineTo(ox + lensW - bevel * 0.5, ty + lensH);
      ctx.lineTo(ox + bevel * 0.5,        ty + lensH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    /* Puente */
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(lx + lensW, h * 0.36);
    ctx.lineTo(rx,         h * 0.36);
    ctx.stroke();

    /* Varillas */
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.34);
    ctx.lineTo(lx, h * 0.36);
    ctx.moveTo(rx + lensW, h * 0.36);
    ctx.lineTo(w, h * 0.34);
    ctx.stroke();
  }

  /* ─── Renderizar previews del catálogo ──────────────────────── */
  function renderPreviews() {
    GLASSES.forEach((g, i) => {
      const pc   = document.getElementById('prev' + i);
      const pctx = pc.getContext('2d');
      pctx.clearRect(0, 0, pc.width, pc.height);
      g.draw(pctx, pc.width, pc.height, true);
    });
  }

  /* ─── Selección de modelo ───────────────────────────────────── */
  function selectGlass(idx) {
    selectedGlass = idx;
    document.querySelectorAll('.glass-card').forEach((c, i) => {
      c.classList.toggle('active', i === idx);
    });
  }

  /* ─── Controles ─────────────────────────────────────────────── */
  function updateOffset(v) {
    verticalOffset = parseInt(v);
    document.getElementById('offset-val').textContent = v;
  }

  function updateOpacity(v) {
    glassOpacity = parseInt(v) / 100;
    document.getElementById('opacity-val').textContent = v + '%';
  }

  function toggleDebug(v) {
    showDebug = v;
    lmInfo.style.display = v ? 'block' : 'none';
  }

  /* ─── Iniciar cámara y MediaPipe ────────────────────────────── */
  function startCamera() {
    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Cargando modelo…';

    /*
     * Face Mesh de MediaPipe
     * locateFile apunta al CDN donde están los archivos WASM / BIN del modelo
     */
    faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
      maxNumFaces:          1,       // Solo un rostro
      refineLandmarks:      true,    // Activa los 478 puntos (incluye iris)
      minDetectionConfidence: 0.5,
      minTrackingConfidence:  0.5,
    });

    faceMesh.onResults(onResults);

    /*
     * Camera utility de MediaPipe — itera fotograma a fotograma
     * y envía cada frame a Face Mesh para su procesamiento
     */
    mpCamera = new Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
      width:  640,
      height: 480,
    });

    mpCamera.start()
      .then(() => {
        badge.classList.add('active');
        statusTx.textContent = 'Detectando rostro…';
        btn.textContent = '✅ Cámara activa';
      })
      .catch((err) => {
        console.error(err);
        badge.classList.remove('active');
        statusTx.textContent = 'Error de cámara';
        btn.disabled = false;
        btn.textContent = '🔁 Reintentar';
      });
  }

  /* ─── Callback principal: procesamiento por fotograma ───────── */
  function onResults(results) {
    /*
     * Sincronizar tamaño del canvas con el video
     * (puede cambiar si el navegador escala el stream)
     */
    const W = video.videoWidth  || 640;
    const H = video.videoHeight || 480;
    if (canvas.width !== W)  canvas.width  = W;
    if (canvas.height !== H) canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    /* Sin rostro detectado → no dibujamos nada */
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      statusTx.textContent = 'Buscando rostro…';
      return;
    }

    statusTx.textContent = 'Rostro detectado ✓';
    const lm = results.multiFaceLandmarks[0];

    /* ── 1. Extraer los tres landmarks clave ─────────────────────
     *
     * MediaPipe devuelve coordenadas normalizadas [0,1].
     * Como el video está en modo espejo (scaleX(-1)),
     * invertimos el eje X: px = (1 - lm.x) * W
     */
    const nose    = lm[6];    // Puente de la nariz → ancla central
    const templeL = lm[234];  // Sien izquierda (vista del usuario)
    const templeR = lm[454];  // Sien derecha

    const noseX = (1 - nose.x)    * W;
    const noseY = nose.y           * H;

    const leftX  = (1 - templeL.x) * W;
    const leftY  = templeL.y        * H;

    const rightX = (1 - templeR.x) * W;
    const rightY = templeR.y        * H;

    /* ── 2. Escalado dinámico ────────────────────────────────────
     *
     * Distancia euclidiana entre sienes → ancho de las gafas.
     * Cuanto más cerca esté el usuario a la cámara, mayor será
     * esta distancia en píxeles y mayor el tamaño del accesorio.
     */
    const sienDist = Math.sqrt(
      Math.pow(rightX - leftX, 2) +
      Math.pow(rightY - leftY, 2)
    );

    const glassWidth  = sienDist;
    const glassHeight = glassWidth / GLASSES[selectedGlass].aspectRatio;

    /* ── 3. Ángulo Roll ──────────────────────────────────────────
     *
     * Cuando el usuario inclina la cabeza hacia un hombro,
     * las sienes suben/bajan de manera opuesta.
     * Math.atan2(Δy, Δx) devuelve el ángulo en radianes.
     *
     * Fórmula:  roll = atan2(rightY - leftY,  rightX - leftX)
     */
    const rollAngle = Math.atan2(rightY - leftY, rightX - leftX);

    /* ── 4. Debug / info de landmarks ───────────────────────────── */
    if (showDebug) {
      /* Pintar los tres puntos clave */
      const pts = [
        { x: noseX,  y: noseY,  color: '#00ff88', label: '6' },
        { x: leftX,  y: leftY,  color: '#ff4444', label: '234' },
        { x: rightX, y: rightY, color: '#ff4444', label: '454' },
      ];
      pts.forEach(({ x, y, color, label }) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(label, x + 7, y - 4);
      });

      /* Línea entre sienes */
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.stroke();
      ctx.setLineDash([]);

      /* Actualizar cuadro de info */
      document.getElementById('li-nose').textContent =
        `Punto 6  (nariz): (${Math.round(noseX)}, ${Math.round(noseY)})`;
      document.getElementById('li-left').textContent =
        `Punto 234 (sien izq): (${Math.round(leftX)}, ${Math.round(leftY)})`;
      document.getElementById('li-right').textContent =
        `Punto 454 (sien der): (${Math.round(rightX)}, ${Math.round(rightY)})`;
      document.getElementById('li-dist').textContent =
        `Distancia entre sienes: ${Math.round(sienDist)} px`;
      document.getElementById('li-angle').textContent =
        `Ángulo Roll: ${(rollAngle * 180 / Math.PI).toFixed(2)}°`;
      document.getElementById('li-size').textContent =
        `Gafas: ${Math.round(glassWidth)} × ${Math.round(glassHeight)} px`;
    }

    /* ── 5. Renderizado del accesorio con transformaciones ───────
     *
     * Flujo:
     *   a) ctx.save()           — guarda el estado actual del canvas
     *   b) ctx.globalAlpha      — aplica opacidad del slider
     *   c) ctx.translate(x, y)  — mueve el origen al puente nasal + offset vertical
     *   d) ctx.rotate(angle)    — rota según el ángulo Roll
     *   e) dibujar las gafas centradas en (0,0)
     *   f) ctx.restore()        — recupera el estado original (sin rotación)
     */
    ctx.save();
    ctx.globalAlpha = glassOpacity;

    /* c) Trasladar al puente de la nariz + corrección vertical */
    ctx.translate(noseX, noseY + verticalOffset);

    /* d) Rotar según el ángulo Roll de la cabeza */
    ctx.rotate(rollAngle);

    /*
     * Dibujamos en un OffscreenCanvas auxiliar del tamaño exacto
     * de las gafas y luego lo componemos centrado en (0,0).
     * Esto permite que cada función de dibujo trabaje
     * con coordenadas locales simples sin preocuparse por
     * la rotación ni la traslación.
     */
    const gW = Math.max(1, Math.round(glassWidth));
    const gH = Math.max(1, Math.round(glassHeight));
    const offscreen = new OffscreenCanvas(gW, gH);
    const offCtx    = offscreen.getContext('2d');

    GLASSES[selectedGlass].draw(offCtx, gW, gH, false);

    /* e) Dibujar centrado: desplazar -w/2 y -h/2 */
    ctx.drawImage(offscreen, -gW / 2, -gH / 2);

    /* f) Restaurar el contexto */
    ctx.restore();
  }

  /* ─── Arrancar previews al cargar la página ─────────────────── */
  renderPreviews();