// 1. Cámara (versión corregida)
try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
            "Tu navegador no soporta acceso a cámara o no estás usando HTTPS/localhost."
        );
    }

    let stream;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });
    } catch {
        // Fallback para cámaras problemáticas
        stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });
    }

    cam.srcObject = stream;

    await new Promise(resolve => {
        cam.onloadedmetadata = async () => {
            await cam.play();
            resolve();
        };
    });

    monitor.width = VIDEO_W;
    monitor.height = VIDEO_H;

    statusEl.textContent = "✅ Cámara lista";
}
catch (err) {
    console.error("Error cámara:", err);

    if (err.name === "NotAllowedError") {
        statusEl.textContent =
            "❌ Permiso denegado. Habilita la cámara en el navegador.";
    }
    else if (err.name === "NotFoundError") {
        statusEl.textContent =
            "❌ No se encontró ninguna cámara.";
    }
    else if (err.name === "NotReadableError") {
        statusEl.textContent =
            "❌ La cámara está siendo usada por otra aplicación.";
    }
    else {
        statusEl.textContent =
            "❌ Error cámara: " + err.message;
    }

    return;
}