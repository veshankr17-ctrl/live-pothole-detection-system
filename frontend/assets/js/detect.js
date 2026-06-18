const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const stateEl = document.getElementById("detect-state");
const gpsEl = document.getElementById("gps-state");
const saveEl = document.getElementById("save-state");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const uploadInput = document.getElementById("upload-input");
const uploadPreview = document.getElementById("upload-preview");
const uploadOverlay = document.getElementById("upload-overlay");
const uploadStateEl = document.getElementById("upload-state");
const detectUploadBtn = document.getElementById("detect-upload-btn");
const saveUploadBtn = document.getElementById("save-upload-btn");
const uploadCtx = uploadOverlay ? uploadOverlay.getContext("2d") : null;

let stream = null;
let running = false;
let latestLocation = null;
let lastSavedAt = 0;
let uploadedImageBase64 = null;
let uploadedDetectionResult = null;
let consecutiveTimeouts = 0;

const FRAME_INTERVAL_MS = 2000;  // Increased from 1200ms to reduce server load
const SAVE_COOLDOWN_MS = 5000;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.35;
const MAX_CONSECUTIVE_TIMEOUTS = 3;

function setText(el, text, cls) {
  el.textContent = text;
  el.className = `status ${cls || ""}`;
}

function getFrameBase64() {
  const temp = document.createElement("canvas");
  temp.width = video.videoWidth;
  temp.height = video.videoHeight;
  const tctx = temp.getContext("2d");
  tctx.drawImage(video, 0, 0, temp.width, temp.height);
  return temp.toDataURL("image/jpeg", 0.8);
}

function drawDetections(detections) {
  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;
  const scaleX = canvas.width / video.videoWidth;
  const scaleY = canvas.height / video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.font = "14px Arial";
  for (const d of detections) {
    const x = d.x1 * scaleX;
    const y = d.y1 * scaleY;
    const w = (d.x2 - d.x1) * scaleX;
    const h = (d.y2 - d.y1) * scaleY;
    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "#ef4444";
    ctx.strokeRect(x, y, w, h);
    ctx.fillText(`${d.class_name} ${Math.round(d.confidence * 100)}%`, x, Math.max(y - 5, 12));
  }
}

function drawUploadDetections(detections) {
  if (!uploadPreview || !uploadOverlay || !uploadCtx) return;
  if (!uploadPreview.naturalWidth || !uploadPreview.naturalHeight) return;
  uploadOverlay.width = uploadPreview.clientWidth;
  uploadOverlay.height = uploadPreview.clientHeight;
  const scaleX = uploadOverlay.width / uploadPreview.naturalWidth;
  const scaleY = uploadOverlay.height / uploadPreview.naturalHeight;
  uploadCtx.clearRect(0, 0, uploadOverlay.width, uploadOverlay.height);
  uploadCtx.lineWidth = 2;
  uploadCtx.font = "14px Arial";
  for (const d of detections) {
    const x = d.x1 * scaleX;
    const y = d.y1 * scaleY;
    const w = (d.x2 - d.x1) * scaleX;
    const h = (d.y2 - d.y1) * scaleY;
    uploadCtx.strokeStyle = "#dc2626";
    uploadCtx.fillStyle = "#dc2626";
    uploadCtx.strokeRect(x, y, w, h);
    uploadCtx.fillText(`${d.class_name} ${Math.round(d.confidence * 100)}%`, x, Math.max(y - 5, 12));
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function startLocationTracking() {
  if (!navigator.geolocation) {
    setText(gpsEl, "Geolocation not supported", "warn");
    return;
  }
  
  // Request permission explicitly (for iOS 13+)
  if (navigator.geolocation.requestPermission) {
    navigator.geolocation.requestPermission().then((permission) => {
      if (permission === "granted") {
        setText(gpsEl, "GPS permission granted. Acquiring location...", "ok");
        startWatchPosition();
      } else if (permission === "denied") {
        setText(gpsEl, "GPS permission denied. Reports will save without map pin.", "warn");
      } else {
        setText(gpsEl, "GPS permission not decided", "warn");
      }
    }).catch((error) => {
      setText(gpsEl, `GPS error: ${error.message}`, "err");
    });
  } else {
    // For browsers without requestPermission (Android Chrome)
    setText(gpsEl, "Requesting GPS location...", "ok");
    startWatchPosition();
  }
}

function startWatchPosition() {
  navigator.geolocation.watchPosition(
    (pos) => {
      latestLocation = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        location_accuracy: pos.coords.accuracy,
      };
      setText(
        gpsEl,
        `GPS: ${latestLocation.latitude.toFixed(5)}, ${latestLocation.longitude.toFixed(5)} (±${Math.round(latestLocation.location_accuracy)}m)`,
        "ok"
      );
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        setText(gpsEl, "GPS permission denied. Reports will save without map pin.", "warn");
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        setText(gpsEl, "Location information unavailable. Using last known location.", "warn");
      } else if (error.code === error.TIMEOUT) {
        setText(gpsEl, "GPS location request timed out. Retrying...", "warn");
      } else {
        setText(gpsEl, `GPS error: ${error.message}`, "err");
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
  );
}

async function saveReport(imageBase64, detectionResult) {
  if (!detectionResult?.detections?.length) {
    setText(saveEl, "Waiting for pothole detection...", "warn");
    return;
  }
  const now = Date.now();
  if (now - lastSavedAt < SAVE_COOLDOWN_MS) {
    const waitSec = Math.ceil((SAVE_COOLDOWN_MS - (now - lastSavedAt)) / 1000);
    setText(saveEl, `Cooldown active. Next auto-save in ${waitSec}s`, "warn");
    return;
  }
  lastSavedAt = now;
  const payload = {
    image_base64: imageBase64,
    confidence: detectionResult.max_confidence,
    detections_count: detectionResult.detections.length,
    detected_at: new Date().toISOString(),
    ...latestLocation,
  };
  try {
    const result = await saveReportData(payload);
    const mode = result?.is_fallback ? " (local fallback)" : "";
    setText(saveEl, `Saved report: ${result.report_id}${mode}`, "ok");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setText(saveEl, `Failed to save report: ${msg.slice(0, 120)}`, "err");
  }
}

async function saveUploadedReport() {
  if (!uploadedImageBase64 || !uploadedDetectionResult || !uploadedDetectionResult.has_pothole) {
    setText(uploadStateEl, "Detect pothole in uploaded image first.", "warn");
    return;
  }
  const payload = {
    image_base64: uploadedImageBase64,
    confidence: uploadedDetectionResult.max_confidence,
    detections_count: uploadedDetectionResult.detections.length,
    detected_at: new Date().toISOString(),
    ...latestLocation,
  };
  try {
    const result = await apiPost("/reports", payload);
    setText(uploadStateEl, `Uploaded image report saved: ${result.report_id}`, "ok");
  } catch {
    setText(uploadStateEl, "Failed to save uploaded image report.", "err");
  }
}

async function detectionLoop() {
  consecutiveTimeouts = 0;
  while (running) {
    if (!video.videoWidth) {
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }
    const imageBase64 = getFrameBase64();
    try {
      const result = await predictPothole(imageBase64, DEFAULT_CONFIDENCE_THRESHOLD);
      consecutiveTimeouts = 0;  // Reset on success
      drawDetections(result.detections);
      if (result.has_pothole) {
        const mode = result?.is_fallback ? " [local detector]" : "";
        setText(stateEl, `✅ Pothole detected (${Math.round(result.max_confidence * 100)}%)${mode}`, "warn");
        await saveReport(imageBase64, result);
      } else {
        const mode = result?.is_fallback ? " (local detector active)" : "";
        setText(stateEl, `✅ No pothole detected${mode}`, "ok");
      }
      // Normal interval after successful prediction
      await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("abort")) {
        consecutiveTimeouts++;
        // Exponential backoff on timeouts - but don't go too long
        const backoffMs = Math.min(FRAME_INTERVAL_MS * (1 + consecutiveTimeouts), 12000);
        const waitSec = Math.ceil(backoffMs / 1000);
        const hint = consecutiveTimeouts === 1 
          ? " 🔧 Check Settings to set Backend API URL if using phone." 
          : consecutiveTimeouts > 3 
          ? " ⚠️ Connection unstable. Check your network and API settings."
          : "";
        setText(stateEl, `⏱️ Timeout (${consecutiveTimeouts}/${MAX_CONSECUTIVE_TIMEOUTS}). Waiting ${waitSec}s...${hint}`, "warn");
        await new Promise((r) => setTimeout(r, backoffMs));
      } else if (msg.includes("Backend unavailable")) {
        setText(stateEl, `❌ Backend error. Go to Settings to configure API URL.`, "err");
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        setText(stateEl, `❌ Error: ${msg.slice(0, 100)}`, "err");
        await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
      }
    }
  }
}

async function startDetection() {
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  video.srcObject = stream;
  await video.play();
  running = true;
  setText(stateEl, "Live detection started", "ok");
  startLocationTracking();
  detectionLoop();
}

function stopDetection() {
  running = false;
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setText(stateEl, "Detection stopped", "warn");
}

startBtn.addEventListener("click", startDetection);
stopBtn.addEventListener("click", stopDetection);

if (uploadInput && uploadPreview && uploadOverlay && uploadStateEl && detectUploadBtn && saveUploadBtn) {
  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files?.[0];
    if (!file) {
      uploadedImageBase64 = null;
      setText(uploadStateEl, "No uploaded image selected.", "warn");
      return;
    }
    try {
      uploadedImageBase64 = await compressDataUrlForApi(await fileToBase64(file));
      uploadPreview.src = uploadedImageBase64;
      uploadPreview.style.display = "block";
      uploadOverlay.style.display = "block";
      uploadedDetectionResult = null;
      saveUploadBtn.disabled = true;
      uploadCtx?.clearRect(0, 0, uploadOverlay.width, uploadOverlay.height);
      setText(uploadStateEl, `Image selected: ${file.name}. Click detect.`, "ok");
    } catch {
      uploadedImageBase64 = null;
      setText(uploadStateEl, "Could not read selected image.", "err");
    }
  });

  detectUploadBtn.addEventListener("click", async () => {
    const selectedFile = uploadInput.files?.[0];
    if (!selectedFile) {
      setText(uploadStateEl, "Please choose an image first.", "warn");
      return;
    }
    if (!uploadedImageBase64) {
      try {
        uploadedImageBase64 = await compressDataUrlForApi(await fileToBase64(selectedFile));
      } catch {
        setText(uploadStateEl, "Could not read selected image.", "err");
        return;
      }
    }
    try {
      const imagePayload = await compressDataUrlForApi(uploadedImageBase64);
      const result = await apiPost("/predict", {
        image_base64: imagePayload,
        confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
      });
      uploadedDetectionResult = result;
      // Delay draw slightly to ensure preview dimensions are available.
      setTimeout(() => drawUploadDetections(result.detections), 80);
      if (result.has_pothole) {
        saveUploadBtn.disabled = false;
        setText(
          uploadStateEl,
          `Pothole detected in upload (${Math.round(result.max_confidence * 100)}%). Click save.`,
          "warn"
        );
      } else {
        saveUploadBtn.disabled = true;
        setText(uploadStateEl, "No pothole detected in uploaded image.", "ok");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setText(uploadStateEl, `Upload detection failed: ${msg.slice(0, 160)}`, "err");
    }
  });

  saveUploadBtn.addEventListener("click", saveUploadedReport);
}

startLocationTracking();
