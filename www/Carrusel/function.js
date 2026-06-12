const VIDEO_W   = 320;
const VIDEO_H   = 240;
const SKIP      = 3;
const COOLDOWN  = 600;
const THRESHOLD = 75;

let detector     = null;
let currentIndex = 2;
let isCooling    = false;
let frameCount   = 0;

const cam      = document.getElementById('cam');
const monitor  = document.getElementById('monitor');
const mCtx     = monitor.getContext('2d');
const statusEl = document.getElementById('status');
const handEl   = document.getElementById('hand-indicator');
const cards    = document.querySelectorAll('.card');
const dots     = document.querySelectorAll('.dot');

function updateCarousel() {
  cards.forEach((c, i) => c.classList.toggle('central', i === currentIndex));
  dots.forEach((d, i)  => d.classList.toggle('active',  i === currentIndex));
}

function triggerSlide(dir) {
  if (isCooling) return;
  if (dir === 'left'  && currentIndex > 0)                    currentIndex--;
  else if (dir === 'right' && currentIndex < cards.length - 1) currentIndex++;
  else return;

  isCooling = true;
  updateCarousel();

  handEl.textContent = dir === 'left' ? '👈' : '👉';
  handEl.classList.add('show');
  statusEl.textContent = dir === 'left' ? '← Izquierda' : 'Derecha →';
  statusEl.classList.add('active');

  setTimeout(() => {
    isCooling = false;
    handEl.classList.remove('show');
    statusEl.textContent = 'Extiende tu mano para navegar';
    statusEl.classList.remove('active');
  }, COOLDOWN);
}

function processGesture(keypoints) {
  if (isCooling) return;
  const kp = {};
  keypoints.forEach(k => { kp[k.name] = k; });

  const nose   = kp['nose'];
  const lWrist = kp['left_wrist'];
  const rWrist = kp['right_wrist'];

  if (!nose || nose.score < 0.3) return;
  const cx = nose.x;

  if (rWrist && rWrist.score > 0.3 && rWrist.x < cx - THRESHOLD) {
    triggerSlide('left'); return;
  }
  if (lWrist && lWrist.score > 0.3 && lWrist.x > cx + THRESHOLD) {
    triggerSlide('right');
  }
}

function drawKeypoints(keypoints) {
  const nose = keypoints.find(k => k.name === 'nose');
  keypoints.forEach(kp => {
    if (!['nose','left_wrist','right_wrist'].includes(kp.name) || kp.score < 0.3) return;
    mCtx.beginPath();
    mCtx.arc(kp.x, kp.y, 7, 0, 2 * Math.PI);
    mCtx.fillStyle = kp.name === 'nose' ? '#a78bfa' : '#34d399';
    mCtx.fill();
    if (nose && kp.name !== 'nose') {
      mCtx.beginPath();
      mCtx.moveTo(nose.x, nose.y);
      mCtx.lineTo(kp.x, kp.y);
      mCtx.strokeStyle = 'rgba(167,139,250,0.4)';
      mCtx.lineWidth = 1.5;
      mCtx.stroke();
    }
  });
}

async function loop() {
  mCtx.drawImage(cam, 0, 0, VIDEO_W, VIDEO_H);
  if (detector && frameCount % SKIP === 0) {
    try {
      const poses = await detector.estimatePoses(cam, { flipHorizontal: false });
      if (poses.length > 0) {
        processGesture(poses[0].keypoints);
        drawKeypoints(poses[0].keypoints);
      }
    } catch (_) {}
  }
  frameCount++;
  requestAnimationFrame(loop);
}

(async () => {
  updateCarousel();

  // 1. Cámara
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: VIDEO_W, height: VIDEO_H, facingMode: 'user' },
      audio: false
    });
    cam.srcObject = stream;
    await new Promise(r => { cam.onloadedmetadata = () => { cam.play(); r(); }; });
    monitor.width  = VIDEO_W;
    monitor.height = VIDEO_H;
    statusEl.textContent = 'Cámara lista. Cargando IA…';
  } catch (e) {
    statusEl.textContent = 'Error: permite el acceso a la cámara.';
    return;
  }

  // 2. Modelo — con fallback a cpu si WebGL falla
  try {
    try {
      await tf.setBackend('webgl');
    } catch (_) {
      await tf.setBackend('cpu');
    }
    await tf.ready();

    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    );
    statusEl.textContent = 'Extiende tu mano para navegar';
  } catch (e) {
    statusEl.textContent = 'Error al cargar el modelo IA: ' + e.message;
    console.error(e);
    return;
  }

  loop();
})();