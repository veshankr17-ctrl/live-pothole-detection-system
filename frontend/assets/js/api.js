const LOCAL_DEV_API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_API_BASE_URL = getDefaultApiBaseUrl();
const DIRECT_RENDER_API_BASE_URL = "https://pothole-detection-yolo.onrender.com";
const NETWORK_TIMEOUT_MS = 90000;  // Increased from 50s to 90s for tunnel stability
const TUNNEL_TIMEOUT_MS = 120000;  // 120s timeout specifically for tunnel requests
const TRANSIENT_WAIT_MS = 2200;
const LOCAL_REPORTS_KEY = "LOCAL_POTHOLE_REPORTS_V1";
const FAST_PREDICT_TIMEOUT_MS = 25000;  // Increased from 8s to 25s for tunnel
const ENABLE_HEURISTIC_FALLBACK = window.location.search.includes("fallback=1");
let API_BASE_URL = resolveApiBaseUrl();
let IS_TUNNEL_MODE = false;  // Track if we're using tunnel URLs

function getDefaultApiBaseUrl() {
  const host = window.location.hostname;
  if (host === "127.0.0.1" || host === "localhost") {
    return LOCAL_DEV_API_BASE_URL;
  }
  // If accessing from a tunnel URL (trycloudflare.com), return relative path
  if (host.includes("trycloudflare.com")) {
    IS_TUNNEL_MODE = true;
    return "/api";  // Will be proxied by frontend tunnel
  }
  return "/api";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeBaseUrl(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("/")) return rawUrl.replace(/\/+$/, "");
  try {
    const parsed = new URL(rawUrl);
    if (window.location.protocol === "https:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function resolveApiBaseUrl() {
  const stored = localStorage.getItem("API_BASE_URL");
  const sanitizedStored = sanitizeBaseUrl(stored);
  if (sanitizedStored) return sanitizedStored;
  if (stored) localStorage.removeItem("API_BASE_URL");
  return DEFAULT_API_BASE_URL;
}

function isNetworkLevelError(err) {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
}

function isTunnelUrl(url) {
  return url.includes("trycloudflare.com") || url.includes("ngrok.io") || url.includes(".dev");
}

async function fetchWithTimeout(url, init, timeoutMs = NETWORK_TIMEOUT_MS) {
  // Increase timeout for tunnel URLs
  if (isTunnelUrl(url)) {
    timeoutMs = TUNNEL_TIMEOUT_MS;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Downscale images for faster API transmission. More aggressive for tunnels. */
function compressDataUrlForApi(dataUrl, maxSide = null, quality = null) {
  // Detect if we're in tunnel mode for more aggressive compression
  const isPhone = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTunnel = IS_TUNNEL_MODE || (typeof API_BASE_URL === 'string' && isTunnelUrl(API_BASE_URL));
  
  // More aggressive compression for phones and tunnels
  if (maxSide === null) {
    maxSide = (isPhone || isTunnel) ? 640 : 960;
  }
  if (quality === null) {
    quality = (isPhone || isTunnel) ? 0.60 : 0.72;
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (!w || !h) {
          reject(new Error("Invalid image dimensions"));
          return;
        }
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, tw, th);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Could not load image for compression"));
    img.src = dataUrl;
  });
}

async function apiPost(path, body) {
  const urlsToTry =
    API_BASE_URL === DEFAULT_API_BASE_URL
      ? [API_BASE_URL, DIRECT_RENDER_API_BASE_URL]
      : [API_BASE_URL, DEFAULT_API_BASE_URL, DIRECT_RENDER_API_BASE_URL];
  let lastError = null;
  for (const baseUrl of urlsToTry) {
    try {
      let res = await fetchWithTimeout(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // Render free tier can respond transiently while waking up.
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        await delay(TRANSIENT_WAIT_MS);
        res = await fetchWithTimeout(`${baseUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        throw new Error(await res.text());
      }
      if (baseUrl !== API_BASE_URL) {
        API_BASE_URL = baseUrl;
        localStorage.setItem("API_BASE_URL", baseUrl);
      }
      return res.json();
    } catch (err) {
      lastError = err;
      // Always continue to next fallback URL; /api may fail if proxy isn't active yet.
      continue;
    }
  }
  const errMsg = lastError instanceof Error ? lastError.message : String(lastError || "Unknown request error");
  throw new Error(`API request failed via ${API_BASE_URL}: ${errMsg}`);
}

async function apiGet(path) {
  let res;
  const urlsToTry =
    API_BASE_URL === DEFAULT_API_BASE_URL
      ? [API_BASE_URL, DIRECT_RENDER_API_BASE_URL]
      : [API_BASE_URL, DEFAULT_API_BASE_URL, DIRECT_RENDER_API_BASE_URL];
  let lastErr = null;
  for (const baseUrl of urlsToTry) {
    try {
      res = await fetchWithTimeout(`${baseUrl}${path}`, { method: "GET" });
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        await delay(TRANSIENT_WAIT_MS);
        res = await fetchWithTimeout(`${baseUrl}${path}`, { method: "GET" });
      }
      if (!res.ok) {
        throw new Error(await res.text());
      }
      if (baseUrl !== API_BASE_URL) {
        API_BASE_URL = baseUrl;
        localStorage.setItem("API_BASE_URL", API_BASE_URL);
      }
      return res.json();
    } catch (err) {
      lastErr = err;
      if (!isNetworkLevelError(err) && baseUrl !== DEFAULT_API_BASE_URL) {
        break;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || "API get failed"));
}

function getLocalReports() {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalReports(reports) {
  const trimmed = reports.slice(0, 120);
  while (trimmed.length >= 0) {
    try {
      localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(trimmed));
      return;
    } catch {
      if (!trimmed.length) {
        throw new Error("Local storage full; could not save fallback report");
      }
      trimmed.pop();
    }
  }
}

async function saveLocalReport(payload) {
  const localReports = getLocalReports();
  const compactImage = await compressDataUrlForApi(payload.image_base64, 720, 0.58);
  const reportId = `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const report = {
    id: reportId,
    image_path: compactImage,
    confidence: payload.confidence,
    detections_count: payload.detections_count,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    location_accuracy: payload.location_accuracy ?? null,
    address: payload.address ?? null,
    detected_at: payload.detected_at || new Date().toISOString(),
    created_at: new Date().toISOString(),
    is_local_fallback: true,
  };
  localReports.unshift(report);
  setLocalReports(localReports);
  return { report_id: reportId, is_fallback: true };
}

function getImageUrl(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("data:")) return imagePath;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) return imagePath;
  return `${API_BASE_URL}${imagePath}`;
}

async function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for local detection"));
    img.src = dataUrl;
  });
}

async function runLocalHeuristicDetection(imageBase64, threshold = 0.35) {
  const image = await loadImageFromDataUrl(imageBase64);
  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const gray = new Uint8Array(w * h);
  let sumGray = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    gray[p] = g;
    sumGray += g;
  }
  const meanGray = sumGray / (w * h);
  const darkThreshold = Math.max(28, Math.min(95, Math.round(meanGray * 0.62)));

  const cell = 16;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const active = new Uint8Array(cols * rows);
  const density = new Float32Array(cols * rows);
  let bestDensity = 0;
  let bestCellIndex = 0;

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let dark = 0;
      let total = 0;
      const x0 = cx * cell;
      const y0 = cy * cell;
      const x1 = Math.min(w, x0 + cell);
      const y1 = Math.min(h, y0 + cell);
      for (let y = y0; y < y1; y++) {
        let idx = y * w + x0;
        for (let x = x0; x < x1; x++, idx++) {
          if (gray[idx] <= darkThreshold) dark++;
          total++;
        }
      }
      const ratio = total ? dark / total : 0;
      const ci = cy * cols + cx;
      density[ci] = ratio;
      if (ratio > bestDensity) {
        bestDensity = ratio;
        bestCellIndex = ci;
      }
      if (ratio > 0.18) active[ci] = 1;
    }
  }

  const visited = new Uint8Array(cols * rows);
  const detections = [];
  const imageArea = w * h;

  for (let i = 0; i < active.length; i++) {
    if (!active[i] || visited[i]) continue;
    const queue = [i];
    visited[i] = 1;
    let minCx = cols;
    let minCy = rows;
    let maxCx = 0;
    let maxCy = 0;
    let weight = 0;
    let count = 0;
    while (queue.length) {
      const cur = queue.pop();
      const cy = Math.floor(cur / cols);
      const cx = cur % cols;
      minCx = Math.min(minCx, cx);
      minCy = Math.min(minCy, cy);
      maxCx = Math.max(maxCx, cx);
      maxCy = Math.max(maxCy, cy);
      weight += density[cur];
      count++;
      for (let ny = cy - 1; ny <= cy + 1; ny++) {
        for (let nx = cx - 1; nx <= cx + 1; nx++) {
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (!active[ni] || visited[ni]) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }
    }

    const x1 = minCx * cell;
    const y1 = minCy * cell;
    const x2 = Math.min(w, (maxCx + 1) * cell);
    const y2 = Math.min(h, (maxCy + 1) * cell);
    const bw = Math.max(1, x2 - x1);
    const bh = Math.max(1, y2 - y1);
    const areaRatio = (bw * bh) / imageArea;
    const aspect = bw / bh;
    if (count < 2 || areaRatio < 0.0005 || areaRatio > 0.75 || aspect > 25 || aspect < 0.04) continue;

    const darkRatio = weight / Math.max(1, count);
    const conf = Math.max(threshold, Math.min(0.91, 0.28 + darkRatio * 0.9 + areaRatio * 0.55));
    detections.push({
      x1: Number((x1 / scale).toFixed(2)),
      y1: Number((y1 / scale).toFixed(2)),
      x2: Number((x2 / scale).toFixed(2)),
      y2: Number((y2 / scale).toFixed(2)),
      confidence: Number(conf.toFixed(4)),
      class_id: 0,
      class_name: "pothole",
      area_ratio: Number(areaRatio.toFixed(6)),
    });
  }

  detections.sort((a, b) => b.confidence - a.confidence);
  let top = detections.slice(0, 3);
  if (!top.length && bestDensity > 0.2) {
    const cy = Math.floor(bestCellIndex / cols);
    const cx = bestCellIndex % cols;
    const minCx = Math.max(0, cx - 2);
    const maxCx = Math.min(cols - 1, cx + 2);
    const minCy = Math.max(0, cy - 2);
    const maxCy = Math.min(rows - 1, cy + 2);
    const x1 = minCx * cell;
    const y1 = minCy * cell;
    const x2 = Math.min(w, (maxCx + 1) * cell);
    const y2 = Math.min(h, (maxCy + 1) * cell);
    const areaRatio = ((x2 - x1) * (y2 - y1)) / imageArea;
    top = [
      {
        x1: Number((x1 / scale).toFixed(2)),
        y1: Number((y1 / scale).toFixed(2)),
        x2: Number((x2 / scale).toFixed(2)),
        y2: Number((y2 / scale).toFixed(2)),
        confidence: Number(Math.max(threshold, Math.min(0.72, 0.24 + bestDensity)).toFixed(4)),
        class_id: 0,
        class_name: "pothole",
        area_ratio: Number(areaRatio.toFixed(6)),
      },
    ];
  }
  return {
    has_pothole: top.length > 0,
    max_confidence: top.length ? top[0].confidence : 0,
    detections: top,
    rejected_count: 0,
    is_fallback: true,
  };
}

async function predictViaApiFast(imageBase64, confidenceThreshold) {
  // Compress image before sending to reduce transmission time
  console.log("[Pothole Detection] Compressing image for API...");
  let compressedImage;
  try {
    compressedImage = await compressDataUrlForApi(imageBase64);
  } catch (err) {
    console.warn("[Pothole Detection] Compression failed, using original:", err);
    compressedImage = imageBase64;
  }
  
  const urlsToTry =
    API_BASE_URL === DEFAULT_API_BASE_URL
      ? [API_BASE_URL, DIRECT_RENDER_API_BASE_URL]
      : [API_BASE_URL, DEFAULT_API_BASE_URL, DIRECT_RENDER_API_BASE_URL];
  
  let lastErr = null;
  for (const baseUrl of urlsToTry) {
    try {
      console.log(`[Pothole Detection] Trying to predict via: ${baseUrl}`);
      const timeoutMs = isTunnelUrl(baseUrl) ? TUNNEL_TIMEOUT_MS : FAST_PREDICT_TIMEOUT_MS;
      const res = await fetchWithTimeout(
        `${baseUrl}/predict`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: compressedImage,
            confidence_threshold: confidenceThreshold,
          }),
        },
        timeoutMs
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      console.log(`[Pothole Detection] Successfully connected to backend: ${baseUrl}`);
      if (baseUrl !== API_BASE_URL) {
        API_BASE_URL = baseUrl;
        localStorage.setItem("API_BASE_URL", baseUrl);
      }
      return await res.json();
    } catch (err) {
      console.warn(`[Pothole Detection] Failed with ${baseUrl}:`, err);
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || "predict failed"));
}

async function predictPothole(imageBase64, confidenceThreshold) {
  try {
    const apiResult = await predictViaApiFast(imageBase64, confidenceThreshold);
    return { ...apiResult, is_fallback: false };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (ENABLE_HEURISTIC_FALLBACK) {
      console.warn("Backend failed, using local heuristic detector:", errMsg);
      return runLocalHeuristicDetection(imageBase64, confidenceThreshold);
    }
    const backendUrl = API_BASE_URL;
    const suggestions = [
      `1. Start backend: cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`,
      `2. If on mobile, use tunnel: run_mobile_backend_tunnel.ps1`,
      `3. Current backend URL: ${backendUrl}`,
      `4. To use local heuristic, add ?fallback=1 to URL`,
    ];
    throw new Error(
      `Backend unavailable (${backendUrl}). ${errMsg}. ${suggestions.join(" | ")}`
    );
  }
}

async function saveReportData(payload) {
  try {
    console.log(`[Pothole Detection] Saving report to server...`);
    const result = await apiPost("/reports", payload);
    console.log(`[Pothole Detection] Report saved to server:`, result.report_id);
    return result;
  } catch (err) {
    console.warn(`[Pothole Detection] Server save failed, using local storage:`, err);
    const fallback = await saveLocalReport(payload);
    console.log(`[Pothole Detection] Report saved locally:`, fallback.report_id);
    return fallback;
  }
}

async function fetchReportsMerged() {
  const local = getLocalReports();
  let remote = [];
  try {
    remote = await apiGet("/reports");
  } catch {
    remote = [];
  }
  const combined = [...remote, ...local];
  const seen = new Set();
  return combined
    .filter((r) => {
      if (!r?.id || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .sort((a, b) => new Date(b.created_at || b.detected_at).getTime() - new Date(a.created_at || a.detected_at).getTime());
}

async function fetchMapPointsMerged() {
  let points = [];
  try {
    points = await apiGet("/map-points");
  } catch {
    points = [];
  }
  if (points.length) return points;
  const reports = await fetchReportsMerged();
  return reports.filter((r) => r.latitude != null && r.longitude != null);
}

async function deleteAllReports() {
  const urlsToTry =
    API_BASE_URL === DEFAULT_API_BASE_URL
      ? [API_BASE_URL, DIRECT_RENDER_API_BASE_URL]
      : [API_BASE_URL, DEFAULT_API_BASE_URL, DIRECT_RENDER_API_BASE_URL];
  let lastError = null;
  
  for (const baseUrl of urlsToTry) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}/reports`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = await res.json();
      if (baseUrl !== API_BASE_URL) {
        API_BASE_URL = baseUrl;
        localStorage.setItem("API_BASE_URL", baseUrl);
      }
      return result;
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  const errMsg = lastError instanceof Error ? lastError.message : String(lastError || "Unknown error");
  throw new Error(`Failed to delete reports: ${errMsg}`);
}

async function deleteReportById(reportId) {
  const urlsToTry =
    API_BASE_URL === DEFAULT_API_BASE_URL
      ? [API_BASE_URL, DIRECT_RENDER_API_BASE_URL]
      : [API_BASE_URL, DEFAULT_API_BASE_URL, DIRECT_RENDER_API_BASE_URL];
  let lastError = null;
  
  for (const baseUrl of urlsToTry) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}/reports/${reportId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = await res.json();
      if (baseUrl !== API_BASE_URL) {
        API_BASE_URL = baseUrl;
        localStorage.setItem("API_BASE_URL", baseUrl);
      }
      return result;
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  const errMsg = lastError instanceof Error ? lastError.message : String(lastError || "Unknown error");
  throw new Error(`Failed to delete report: ${errMsg}`);
}
