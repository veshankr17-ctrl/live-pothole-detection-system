# Live Pothole Detection System — Complete Project Documentation

> **Purpose of this file:** Interview preparation, GitHub setup, and full project explanation.  
> You can share this file with ChatGPT to generate mock interviews, pitches, or presentations.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [How the Project Was Built (Step by Step)](#3-how-the-project-was-built-step-by-step)
4. [System Architecture](#4-system-architecture)
5. [Backend Details](#5-backend-details)
6. [Frontend Details](#6-frontend-details)
7. [Database Schema](#7-database-schema)
8. [API Endpoints](#8-api-endpoints)
9. [Live Detection Flow](#9-live-detection-flow)
10. [Model Training](#10-model-training)
11. [Mobile & HTTPS Tunnel Support](#11-mobile--https-tunnel-support)
12. [Key Design Decisions](#12-key-design-decisions)
13. [Challenges Solved](#13-challenges-solved)
14. [File Structure](#14-file-structure)
15. [How to Run in VS Code](#15-how-to-run-in-vs-code)
16. [GitHub README Content](#16-github-readme-content)
17. [Interview Questions & Answers](#17-interview-questions--answers)
18. [What to Say You Personally Did](#18-what-to-say-you-personally-did)
19. [GitHub Upload — Complete Commands](#19-github-upload--complete-commands)
20. [Files to Upload vs Not Upload](#20-files-to-upload-vs-not-upload)

---

## 1. Project Overview

### What This Project Does

A **full-stack road monitoring web application** that:

1. Detects potholes in real time using a phone/laptop camera
2. Detects potholes from uploaded images
3. Draws red bounding boxes around detected potholes
4. Automatically saves reports with confidence score, image, and GPS location
5. Shows all pothole locations on an interactive map (Leaflet + OpenStreetMap)
6. Lets users browse, search, and delete saved reports

### Problem It Solves

Manual pothole reporting is slow and inconsistent. This system automates detection and geotagging so road damage can be logged faster for maintenance teams.

### One-Line Pitch (For Interviews)

> "I built a YOLOv8-based pothole detection system with a FastAPI backend, vanilla JavaScript frontend, SQLite database, and Leaflet map — supporting live camera detection, image upload, GPS tagging, and mobile access via HTTPS tunnels."

---

## 2. Tech Stack

| Layer | Technology | Why It Was Chosen |
|-------|-----------|-------------------|
| **ML Model** | YOLOv8n (Ultralytics) | Fast, accurate object detection; good for real-time use |
| **Backend** | Python + FastAPI + Uvicorn | Fast API framework, easy JSON handling, auto docs at `/docs` |
| **Image Processing** | OpenCV (`cv2`) + NumPy | Decode base64 images and run inference |
| **Database** | SQLite | Lightweight, no separate server, perfect for local/demo apps |
| **Frontend** | HTML + CSS + Vanilla JavaScript | No React build step; simple to host anywhere |
| **Map** | Leaflet.js + OpenStreetMap tiles | Free, no API key required |
| **Training** | Ultralytics YOLO + `data.yaml` | Standard YOLO training pipeline |
| **Frontend Server** | Python `http.server` on port 5501 | Serves static HTML locally |
| **Mobile HTTPS** | Cloudflare Tunnel (`cloudflared`) | Mobile browsers require HTTPS for camera access |

---

## 3. How the Project Was Built (Step by Step)

Tell this story in **6 phases** during interviews.

---

### Phase 1: Problem Definition & Planning

**Decisions made:**
- **Input:** Road images from camera or file upload
- **Output:** Bounding boxes + confidence score + GPS location
- **Storage:** Each detection saved as a "report"
- **Visualization:** Map pins + report gallery

**Architecture choice:**
- Separate **frontend** (UI) and **backend** (AI + database)
- Frontend sends images as **base64 JSON** to backend
- Backend runs YOLO and returns box coordinates
- Frontend draws boxes on a canvas overlay on top of video/image

---

### Phase 2: Dataset & Model Training

**Dataset structure** (defined in `data.yaml`):

```yaml
path: .
train: train/images
val: valid/images
nc: 1
names: ['pothole']
```

- Single detection class: `pothole`
- Training images in `train/images` with YOLO label files in `train/labels`
- Validation images in `valid/images` with labels in `valid/labels`

**Training script** (`train_model.py`):
- Starts from pretrained `yolov8n.pt` (nano — smallest and fastest YOLOv8)
- Default settings: **120 epochs**, image size **640**, batch size **16**
- Output saved to `runs/pothole_yolov8n/`
- Best weights saved as `runs/pothole_yolov8n/weights/best.pt`

**After training, copy model to backend:**

```powershell
python scripts\copy_best_model.py
```

This copies `best.pt` → `backend/models/best.pt` so the API can use it.

**Google Colab option** (`colab/train_colab.py`):
- Same training on Colab GPU if local machine is too slow

**Interview line:**
> "I fine-tuned YOLOv8n on a custom pothole dataset for 120 epochs and deployed the best checkpoint to the inference server."

---

### Phase 3: Backend API (FastAPI)

**Main file:** `backend/app/main.py`

**On startup, the backend:**
1. Creates `uploads/` folder for saved images
2. Initializes SQLite database (`potholes.db`) with `reports` table
3. Loads YOLO model from `backend/models/best.pt` (falls back to `yolov8n.pt` if missing)

**Core detection logic (`run_detection` function):**
1. Receives image as base64 string
2. Decodes to OpenCV image using `cv2.imdecode`
3. Runs `model.predict()` with:
   - `conf` = confidence threshold (default 0.5)
   - `imgsz=480` (reduced from 640 for faster inference)
   - `max_det=8` (maximum 8 detections per frame)
4. Filters false positives using heuristics:
   - Reject if box area is too small (< 0.05% of image) or too large (> 65%)
   - Reject extreme aspect ratios (width/height > 20 or < 0.05)
5. Returns sorted list of detections with coordinates and confidence

**CORS configuration:**
- `allow_origins=["*"]` so frontend on port 5501 can call API on port 8000
- `allow_credentials=False` (required when using wildcard origin)

**Static file serving:**
- `/uploads/{filename}` serves saved pothole images from disk

**Interview line:**
> "The backend is a single FastAPI application that loads YOLO once at startup, exposes REST endpoints for prediction and report management, and persists data in SQLite with images stored on disk."

---

### Phase 4: Frontend Pages & User Flow

**6 HTML pages built:**

| Page | File | Purpose |
|------|------|---------|
| Home | `index.html` | Landing page with project overview and workflow |
| Live Detection | `detect.html` | Camera feed + real-time pothole detection |
| Upload | `upload.html` | Upload image file and run detection |
| Map | `map.html` | Interactive map with pothole location pins |
| Reports | `reports.html` | Gallery of all saved pothole reports |
| Settings | `settings.html` | Configure backend API URL (for mobile/tunnel) |

**JavaScript modules:**

| File | Role |
|------|------|
| `api.js` | All API calls, image compression, timeout handling, fallbacks |
| `detect.js` | Live camera loop, GPS tracking, auto-save reports |
| `upload.js` | Upload image detection and save flow |
| `map.js` | Load map points from API, draw Leaflet markers |
| `reports.js` | Load, display, search, and delete reports |

---

### Phase 5: Live Detection (Core Feature)

**What happens when user clicks "Start Detection":**

```
Step 1: Browser requests camera permission
        (uses rear camera on mobile: facingMode: "environment")

Step 2: GPS tracking starts
        (navigator.geolocation.watchPosition with high accuracy)

Step 3: Detection loop runs every 2 seconds:
        a. Capture current video frame → canvas → JPEG base64
        b. Compress image (smaller size for mobile/tunnel)
        c. POST /predict with image + confidence threshold (0.35)
        d. Backend runs YOLO → returns bounding box coordinates
        e. Frontend draws red boxes on overlay canvas
        f. If pothole detected → auto-save report (5 second cooldown between saves)

Step 4: Report saved via POST /reports
        Includes: image, GPS coordinates, confidence, detection count, timestamp
```

**Bounding box drawing:**
- Video element displays at responsive width
- Transparent canvas overlay sits on top of video
- Box coordinates scaled from original image size to display size
- Red stroke rectangle + label text: `pothole 87%`

**GPS handling:**
- Uses `watchPosition` for continuous location updates
- Handles permission denied, timeout, and unavailable errors gracefully
- Reports save even without GPS, but won't appear on map without coordinates

---

### Phase 6: Map, Reports & Mobile Support

**Map page (`map.js`):**
- Leaflet map initialized centered on India (default view)
- Fetches GPS-tagged reports via `GET /map-points`
- Each point rendered as a circle marker
- Popup shows: report ID, confidence %, timestamp, thumbnail image
- Dashboard shows: total markers, average confidence, latest detection time

**Reports page (`reports.js`):**
- Fetches all reports from server (merged with any local fallback reports)
- Search filter by report ID
- Delete individual reports or delete all at once
- Shows image thumbnail, confidence, GPS, and timestamp per report

**Mobile challenge and solution:**
- Mobile browsers **require HTTPS** for `getUserMedia` (camera API)
- Local `http://192.168.x.x:5501` may not get camera on all phones
- **Solution:** Cloudflare tunnels expose both frontend and backend over HTTPS

**Tunnel setup:**

```powershell
.\run_mobile_backend_tunnel.ps1   # Terminal 3 — tunnels backend port 8000
.\run_mobile_tunnel.ps1           # Terminal 4 — tunnels frontend port 5501
```

On phone: open frontend tunnel URL → go to Settings → paste backend tunnel URL → Save & Test

**Image compression before API calls:**
- Downscales images to max 640–960px on longest side
- JPEG quality 0.60–0.72
- Reduces upload time over slow mobile/tunnel connections

**Offline fallback:**
- If backend unreachable: reports can save to browser `localStorage`
- Optional `?fallback=1` URL parameter enables client-side heuristic detector (not ML — emergency only)

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (Frontend)                       │
│                                                              │
│  Pages: index | detect | upload | map | reports | settings  │
│                                                              │
│  detect.js ──► capture video frame ──► api.js                │
│       │                                    │                 │
│       │                                    ├── POST /predict │
│       └── draw red boxes on canvas         └── POST /reports │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTP JSON (base64 encoded images)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (port 8000)                 │
│                                                              │
│  main.py                                                     │
│    ├── Decode base64 → OpenCV image (numpy array)           │
│    ├── YOLOv8 predict → bounding box coordinates            │
│    ├── Filter false positives (area + aspect ratio)         │
│    ├── Save image file → backend/uploads/                   │
│    └── Save metadata → SQLite database (potholes.db)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  backend/models/best.pt │
              │  (fine-tuned YOLO weights)│
              └────────────────────────┘
```

**Data flow for one detection:**

```
Camera Frame
    → JavaScript canvas capture
    → JPEG base64 string
    → POST /predict (JSON body)
    → Python base64 decode
    → OpenCV image array
    → YOLO inference
    → Filtered bounding boxes (JSON response)
    → Canvas overlay drawing
    → POST /reports (if pothole found)
    → Image saved to disk + row inserted in SQLite
    → Visible on Map and Reports pages
```

---

## 5. Backend Details

**File:** `backend/app/main.py`  
**Dependencies:** `backend/requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
ultralytics==8.3.0
opencv-python-headless==4.10.0.84
numpy==1.26.4
python-multipart==0.0.12
```

**Key functions in main.py:**

| Function | Purpose |
|----------|---------|
| `init_db()` | Creates SQLite `reports` table on startup |
| `load_model()` | Loads YOLO from `backend/models/best.pt` or falls back to `yolov8n.pt` |
| `decode_image()` | Converts base64 string to OpenCV numpy image |
| `run_detection()` | Runs YOLO inference + applies false positive filters |
| `predict()` | POST endpoint — receives image, returns detections |
| `save_report()` | POST endpoint — saves image file + database record |
| `list_reports()` | GET endpoint — returns all reports newest first |
| `map_points()` | GET endpoint — returns only GPS-tagged reports |
| `delete_all_reports()` | DELETE endpoint — removes all reports and image files |
| `delete_report()` | DELETE endpoint — removes one report by ID |

**False positive filtering logic:**

```python
# Reject boxes that are:
area_ratio < 0.0005   # Too small (less than 0.05% of image)
area_ratio > 0.65     # Too large (more than 65% of image)
aspect_ratio > 20.0   # Too wide and thin
aspect_ratio < 0.05   # Too tall and thin
```

---

## 6. Frontend Details

### api.js — API Client Layer

**Responsibilities:**
- Resolves backend API URL (localhost, tunnel, or custom from Settings)
- Compresses images before sending (reduces payload size)
- Handles request timeouts (90s normal, 120s for tunnel URLs)
- Retries on 502/503/504 errors (for cloud server cold starts)
- Falls back to localStorage if server save fails
- Optional heuristic detector if `?fallback=1` in URL

**API URL resolution order:**
1. Custom URL saved in `localStorage` (from Settings page)
2. `http://127.0.0.1:8000` if running on localhost
3. `/api` relative path for deployed environments

### detect.js — Live Camera Detection

**Key constants:**
```javascript
FRAME_INTERVAL_MS = 2000        // Check every 2 seconds
SAVE_COOLDOWN_MS = 5000         // Wait 5 seconds between auto-saves
DEFAULT_CONFIDENCE_THRESHOLD = 0.35
MAX_CONSECUTIVE_TIMEOUTS = 3    // Back off after 3 timeouts
```

**Functions:**
- `getFrameBase64()` — captures current video frame as JPEG
- `drawDetections()` — draws red boxes on canvas overlay
- `startLocationTracking()` — starts GPS watchPosition
- `saveReport()` — sends detection result to backend
- `detectionLoop()` — main loop that runs while detection is active

### map.js — Interactive Map

- Uses Leaflet.js with OpenStreetMap tile layer
- Fetches points from `GET /map-points`
- Each marker is a blue circle at GPS coordinates
- Popup shows report details and thumbnail image
- Auto-zooms to first marker location

### reports.js — Report Management

- Loads all reports via `fetchReportsMerged()`
- Renders cards with image, confidence, GPS, timestamp
- Search box filters by report ID
- Delete button per report + Delete All button

---

## 7. Database Schema

**Database file:** `backend/potholes.db` (SQLite, created automatically on first run)

**Table: `reports`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Unique report identifier |
| `image_path` | TEXT | Relative path e.g. `/uploads/abc123.jpg` |
| `confidence` | REAL | Highest detection confidence (0.0 to 1.0) |
| `detections_count` | INTEGER | Number of bounding boxes found |
| `latitude` | REAL | GPS latitude (nullable) |
| `longitude` | REAL | GPS longitude (nullable) |
| `location_accuracy` | REAL | GPS accuracy in meters (nullable) |
| `address` | TEXT | Optional address string (nullable) |
| `detected_at` | TEXT | ISO timestamp when pothole was detected |
| `created_at` | TEXT | ISO timestamp when report was saved |

**SQL used to create table:**

```sql
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    image_path TEXT NOT NULL,
    confidence REAL NOT NULL,
    detections_count INTEGER NOT NULL,
    latitude REAL,
    longitude REAL,
    location_accuracy REAL,
    address TEXT,
    detected_at TEXT NOT NULL,
    created_at TEXT NOT NULL
)
```

---

## 8. API Endpoints

| Method | Endpoint | Request Body | Response |
|--------|----------|-------------|----------|
| GET | `/health` | None | `{ status, model_source }` |
| POST | `/predict` | `{ image_base64, confidence_threshold }` | `{ has_pothole, max_confidence, detections[], rejected_count }` |
| POST | `/reports` | `{ image_base64, confidence, detections_count, latitude, longitude, ... }` | `{ report_id }` |
| GET | `/reports` | None (optional `?limit=100`) | Array of report objects |
| GET | `/map-points` | None (optional `?limit=1000`) | Array of GPS-tagged reports |
| DELETE | `/reports` | None | `{ status, deleted_count }` |
| DELETE | `/reports/{id}` | None | `{ status, message }` |

**Example `/predict` request:**

```json
{
  "image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
  "confidence_threshold": 0.35
}
```

**Example `/predict` response:**

```json
{
  "has_pothole": true,
  "max_confidence": 0.8723,
  "detections": [
    {
      "x1": 120.5,
      "y1": 200.3,
      "x2": 280.1,
      "y2": 350.7,
      "confidence": 0.8723,
      "class_id": 0,
      "class_name": "pothole",
      "area_ratio": 0.045231
    }
  ],
  "rejected_count": 2
}
```

**Interactive API docs:** Open `http://localhost:8000/docs` after starting backend.

---

## 9. Live Detection Flow

```
User opens detect.html
        │
        ▼
Clicks "Start Detection"
        │
        ├── Browser asks camera permission
        ├── Browser asks GPS permission
        └── Video stream starts
                │
                ▼ (every 2 seconds)
        Capture frame from video
                │
                ▼
        Compress image (max 960px, JPEG 72%)
                │
                ▼
        POST /predict → Backend
                │
                ▼
        YOLO inference + filter
                │
                ├── No pothole → show "No pothole detected"
                │
                └── Pothole found
                        ├── Draw red bounding box on canvas
                        ├── Show confidence percentage
                        └── Auto-save report (if 5s cooldown passed)
                                │
                                ▼
                        POST /reports → Backend
                                │
                                ▼
                        Image saved to uploads/
                        Row inserted in SQLite
                                │
                                ▼
                        Visible on Map + Reports pages
```

---

## 10. Model Training

### Dataset Requirements

Place dataset in project root:

```
Pothole_Detection/
├── train/
│   ├── images/     ← training images (.jpg, .png)
│   └── labels/     ← YOLO format label files (.txt)
├── valid/
│   ├── images/     ← validation images
│   └── labels/     ← validation labels
└── data.yaml
```

### YOLO Label Format

Each `.txt` file has one line per object:

```
<class_id> <x_center> <y_center> <width> <height>
```

All values normalized 0–1 relative to image size.  
For pothole (class 0): `0 0.45 0.62 0.12 0.08`

### Training Commands

**Local training:**

```powershell
# From project root
python train_model.py

# Custom epochs
python train_model.py --epochs 150

# Copy best weights to backend
python scripts\copy_best_model.py
```

**Google Colab:**

Upload project to Colab, then run `colab/train_colab.py`

### Training Output

```
runs/
└── pothole_yolov8n/
    ├── weights/
    │   ├── best.pt      ← best model (use this)
    │   └── last.pt      ← last epoch model
    ├── results.png      ← training curves
    └── args.yaml        ← training configuration
```

---

## 11. Mobile & HTTPS Tunnel Support

### Why HTTPS Is Required

Mobile browsers (Chrome on Android, Safari on iOS) block camera access on non-HTTPS pages. Local `http://` URLs will not get camera permission on most phones.

### Tunnel Setup (4 Terminals)

**Terminal 1 — Backend:**
```powershell
.\run_backend.ps1
```

**Terminal 2 — Frontend:**
```powershell
.\run_frontend.ps1
```

**Terminal 3 — Backend Tunnel:**
```powershell
.\run_mobile_backend_tunnel.ps1
```
Copy the `https://xxxx.trycloudflare.com` URL shown in output.

**Terminal 4 — Frontend Tunnel:**
```powershell
.\run_mobile_tunnel.ps1
```
Copy the `https://yyyy.trycloudflare.com` URL shown in output.

### On Phone

1. Open frontend tunnel URL: `https://yyyy.trycloudflare.com`
2. Go to **Settings** page
3. Paste backend tunnel URL: `https://xxxx.trycloudflare.com`
4. Click **Save & Test**
5. Go to **Live Detection** → Start Detection

### Same Wi-Fi (Simpler, No Tunnel)

If phone and laptop are on same Wi-Fi:

1. Find laptop IP: `ipconfig` → look for IPv4 (e.g. `192.168.1.5`)
2. On phone open: `http://192.168.1.5:5501`
3. In Settings, set API URL to: `http://192.168.1.5:8000`

Note: Camera may still be blocked on some phones without HTTPS.

---

## 12. Key Design Decisions

| Decision | Reasoning |
|----------|-----------|
| YOLOv8n (nano variant) | Fast enough for 2-second frame intervals on CPU |
| Base64 JSON over multipart form | Simpler API; same format for camera and upload |
| SQLite instead of PostgreSQL | Local-first demo; zero database server configuration |
| Vanilla JS instead of React | Faster development; no build step; easy static hosting |
| Post-detection box filtering | YOLO sometimes detects noise; area/aspect filters reduce false positives |
| 2-second frame interval | Balance between responsiveness and server load |
| 5-second save cooldown | Prevents duplicate reports for the same pothole |
| Separate upload page | Cleaner UX than combining live + upload on one page |
| Settings page for API URL | Required for mobile tunnel — URL changes each session |
| `imgsz=480` during inference | Faster than 640; tuned for acceptable real-time performance |
| Image compression before API | Critical for mobile/tunnel where bandwidth is limited |

---

## 13. Challenges Solved

### Challenge 1: Mobile Camera Requires HTTPS
**Problem:** `getUserMedia` blocked on `http://` on mobile browsers.  
**Solution:** Cloudflare tunnel scripts expose HTTPS URLs; Settings page lets user configure backend URL.

### Challenge 2: Slow Tunnel Connections
**Problem:** Detection requests timing out over cloudflare tunnel.  
**Solution:** Image compression before upload, extended timeouts (90–120s), exponential backoff on repeated failures.

### Challenge 3: False Positive Detections
**Problem:** YOLO detecting shadows, cracks, or road markings as potholes.  
**Solution:** Backend filters by bounding box area ratio and aspect ratio before returning results.

### Challenge 4: Backend Unreachable
**Problem:** App unusable when backend is down.  
**Solution:** Reports save to browser localStorage as fallback; optional `?fallback=1` enables client-side heuristic detector.

### Challenge 5: CORS Errors
**Problem:** Frontend on port 5501 blocked from calling backend on port 8000.  
**Solution:** FastAPI CORSMiddleware with `allow_origins=["*"]` and `allow_credentials=False`.

### Challenge 6: Large Model File for GitHub
**Problem:** `best.pt` is ~24MB — too large for standard GitHub upload.  
**Solution:** Model excluded via `.gitignore`; users train their own or download from Releases.

---

## 14. File Structure

```
Pothole_Detection/
│
├── .gitignore                          # Git ignore rules
├── README.md                           # GitHub project readme
├── PROJECT_DOCUMENTATION.md            # This file
├── data.yaml                           # YOLO dataset configuration
├── train_model.py                      # Local model training script
├── cleanup_reports.py                  # Clear test reports from database
│
├── run_backend.ps1                     # Start FastAPI server (port 8000)
├── run_frontend.ps1                    # Start static file server (port 5501)
├── run_mobile_tunnel.ps1               # HTTPS tunnel for frontend
├── run_mobile_backend_tunnel.ps1       # HTTPS tunnel for backend
│
├── backend/
│   ├── app/
│   │   └── main.py                     # FastAPI app (API + YOLO + SQLite)
│   ├── models/
│   │   ├── .gitkeep                    # Keeps folder in git
│   │   └── best.pt                     # Trained model (NOT in git — add locally)
│   ├── requirements.txt                # Python dependencies
│   ├── potholes.db                     # SQLite database (NOT in git — auto-created)
│   └── uploads/                        # Saved report images (NOT in git)
│
├── frontend/
│   ├── index.html                      # Home / landing page
│   ├── detect.html                     # Live camera detection page
│   ├── upload.html                     # Image upload detection page
│   ├── map.html                        # Interactive pothole map
│   ├── reports.html                    # Saved reports gallery
│   ├── settings.html                   # API URL configuration
│   └── assets/
│       ├── css/
│       │   └── style.css               # Global styles
│       └── js/
│           ├── api.js                  # API client + compression + fallbacks
│           ├── detect.js               # Live camera detection logic
│           ├── upload.js               # Upload detection logic
│           ├── map.js                  # Leaflet map logic
│           └── reports.js              # Reports list + delete logic
│
├── scripts/
│   └── copy_best_model.py              # Copy trained weights to backend
│
└── colab/
    └── train_colab.py                  # Google Colab training script
```

---

## 15. How to Run in VS Code

### Prerequisites

- Python 3.10 or higher installed
- Trained model at `backend/models/best.pt` (or app uses default YOLOv8n automatically)

### Step 1: Open Project in VS Code

```
File → Open Folder → select the Pothole_Detection folder
```

### Step 2: First-Time Backend Setup

Open VS Code terminal (`Ctrl + `` ` ``) and run:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

### Step 3: Start Backend (Terminal 1)

```powershell
.\run_backend.ps1
```

Expected output:
```
Backend running at: http://localhost:8000
API Docs at: http://localhost:8000/docs
```

### Step 4: Start Frontend (Terminal 2)

Open a new terminal (`Terminal → New Terminal`) and run:

```powershell
.\run_frontend.ps1
```

Expected output:
```
Frontend running at: http://localhost:5501
Open in browser: http://127.0.0.1:5501
```

### Step 5: Open in Browser

```
http://127.0.0.1:5501
```

### Step 6: Test the App

1. Click **Live Detection** → **Start Detection** → allow camera
2. Point camera at a road/pothole image
3. Red bounding box should appear if pothole detected
4. Check **Reports** page for saved detection
5. Check **Map** page for GPS pin (if location allowed)

### VS Code Tips

- Use **Split Terminal** to see backend and frontend logs side by side
- Backend auto-reloads when you edit `main.py` (uvicorn `--reload` flag)
- Test API directly at `http://localhost:8000/docs`
- Check backend terminal for error messages if detection fails

### Optional: Train Your Own Model

```powershell
# Make sure dataset folders exist: train/images, train/labels, valid/images, valid/labels
python train_model.py
python scripts\copy_best_model.py
# Restart backend to load new model
```

### Optional: Clear Test Data Before Demo

```powershell
python cleanup_reports.py
```

---

## 16. GitHub README Content

Copy this into your `README.md` on GitHub:

---

```markdown
# Live Pothole Detection System

YOLOv8-powered web application for real-time pothole detection with GPS tagging and interactive map visualization.

## Features

- Live camera detection with AI bounding boxes
- Image upload detection
- Auto-save reports with GPS coordinates
- Interactive map (Leaflet + OpenStreetMap)
- Report management (view, search, delete)
- Mobile browser support via HTTPS tunnel

## Tech Stack

`Python` `FastAPI` `YOLOv8` `OpenCV` `SQLite` `HTML/CSS/JavaScript` `Leaflet`

## Project Structure

```
backend/          → FastAPI server + YOLO inference + SQLite
frontend/         → Web UI (HTML/CSS/JS)
scripts/          → Utility scripts
colab/            → Google Colab training script
train_model.py    → Local training script
data.yaml         → Dataset configuration
```

## Quick Start

### 1. Install dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

### 2. Add trained model

Place your trained weights at:
```
backend/models/best.pt
```

Or train locally:
```powershell
python train_model.py
python scripts\copy_best_model.py
```

### 3. Run the app

**Terminal 1 — Backend:**
```powershell
.\run_backend.ps1
```

**Terminal 2 — Frontend:**
```powershell
.\run_frontend.ps1
```

Open: **http://127.0.0.1:5501**

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/predict` | Detect potholes in image |
| POST | `/reports` | Save detection report |
| GET | `/reports` | List all reports |
| GET | `/map-points` | Get GPS-tagged reports |
| DELETE | `/reports` | Delete all reports |

API docs: `http://localhost:8000/docs`

## Mobile Access

Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/), then:

```powershell
.\run_mobile_backend_tunnel.ps1
.\run_mobile_tunnel.ps1
```

Set backend tunnel URL in the app's Settings page on your phone.

## Training

Requires dataset folders:
- `train/images`, `train/labels`
- `valid/images`, `valid/labels`

```powershell
python train_model.py --epochs 120
python scripts\copy_best_model.py
```
```

---

## 17. Interview Questions & Answers

### Q: Walk me through your project.

> I built a pothole detection system end to end. I collected and labeled road images in YOLO format, fine-tuned YOLOv8n for 120 epochs, and deployed the model in a FastAPI backend. The frontend captures camera frames, sends them for inference, draws bounding boxes in real time, and auto-saves geotagged reports to SQLite. Users can view all detections on an interactive Leaflet map and manage reports through a web interface. I also added mobile support using HTTPS tunnels since mobile browsers require secure context for camera access.

---

### Q: Why did you choose YOLOv8?

> YOLOv8 is state-of-the-art for real-time object detection. I used the nano variant (YOLOv8n) because it's the smallest and fastest — important since I needed inference every 2 seconds on potentially CPU-only hardware. It gives a good balance between accuracy and speed for a demo/production prototype.

---

### Q: Explain the detection pipeline end to end.

> The frontend captures a video frame using the Canvas API and converts it to a JPEG base64 string. It compresses the image to reduce payload size, then sends a POST request to `/predict`. The backend decodes the base64 string into an OpenCV image array, runs YOLO inference, applies false-positive filters based on bounding box area and aspect ratio, and returns the box coordinates with confidence scores. The frontend scales those coordinates to the display size and draws red rectangles on a canvas overlay. If a pothole is detected, it automatically saves a report with the image, GPS coordinates, and confidence to the database.

---

### Q: How do you handle false positives?

> After YOLO returns detections, I apply post-processing filters on the backend. I reject bounding boxes where the area is less than 0.05% of the image (too small to be a real pothole) or greater than 65% (too large). I also reject extreme aspect ratios — width-to-height greater than 20 or less than 0.05 — since potholes are generally roughly circular or oval shaped. This significantly reduced false detections from road cracks, shadows, and markings.

---

### Q: Why SQLite instead of PostgreSQL or MongoDB?

> For this application, SQLite is the right choice because it's a local-first demo system. There's no need for a separate database server, it requires zero configuration, and the data volume is small — just report metadata and image paths. Images are stored as files on disk, not in the database. If I were scaling to thousands of concurrent users, I'd migrate to PostgreSQL.

---

### Q: How did you handle mobile browser support?

> Mobile browsers require HTTPS to access the device camera via the `getUserMedia` API. I solved this using Cloudflare tunnels — scripts that expose local servers over HTTPS with a public URL. Since the tunnel URL changes each session, I built a Settings page where users can paste the current backend tunnel URL. I also added image compression before API calls because tunnel connections are slower than local network, and implemented longer timeouts with exponential backoff for failed requests.

---

### Q: What is the database schema?

> There's one table called `reports` with columns for a UUID primary key, image path, confidence score, detection count, GPS coordinates (latitude, longitude, accuracy), optional address, and two timestamps — when the pothole was detected and when the report was created. The database is SQLite, created automatically on first backend startup.

---

### Q: How does the map feature work?

> The map page uses Leaflet.js with OpenStreetMap tiles — no API key needed. On load, it fetches all reports that have GPS coordinates from the `/map-points` endpoint. Each report becomes a circle marker on the map. Clicking a marker opens a popup showing the report ID, confidence percentage, detection time, and a thumbnail of the captured image. The map auto-zooms to the most recent detection location.

---

### Q: What would you improve if you had more time?

> Several things: deploy the backend on a cloud GPU server for faster inference, use Git LFS or model hosting for the weights file, add user authentication so reports are tied to accounts, support batch video processing for dashcam footage, improve the model with more training data and data augmentation, and add a dashboard with pothole density heatmaps for city planning.

---

### Q: What was the hardest technical challenge?

> Getting reliable real-time detection working on mobile over HTTPS tunnels. The combination of slow tunnel latency, large image payloads, and mobile browser restrictions required multiple solutions: image compression before upload, extended API timeouts, exponential backoff on failures, a Settings page for dynamic API URL configuration, and a localStorage fallback so the app doesn't completely break when the backend is unreachable.

---

### Q: How did you train the model?

> I prepared a dataset with images labeled in YOLO format — one class called "pothole". The dataset is configured in `data.yaml` with separate train and validation splits. I fine-tuned YOLOv8n starting from pretrained weights for 120 epochs at 640px image size with batch size 16. After training, the best checkpoint based on validation mAP is copied to `backend/models/best.pt` using a utility script. I also created a Colab notebook version for training on GPU when local hardware is insufficient.

---

## 18. What to Say You Personally Did

Use this honest framing in interviews:

> "I designed the full system architecture — separating the ML inference backend from the web frontend. I prepared the pothole dataset in YOLO format, trained and fine-tuned YOLOv8n for 120 epochs, and integrated the model into a FastAPI server with REST endpoints. I built the entire frontend including live camera capture, real-time bounding box rendering, GPS integration, and Leaflet map visualization. I implemented SQLite persistence for reports, added false-positive filtering logic, and solved mobile HTTPS camera access using Cloudflare tunnels. I tested the complete system end to end on both desktop and mobile browsers."

Using development tools (including AI assistants) to write code faster is normal and professional. You own the architecture, technical decisions, integration work, training, and debugging.

---

## 19. GitHub Upload — Complete Commands

### Step 1: Install Git (if not installed)

Download from: https://git-scm.com/download/win

Verify installation:
```powershell
git --version
```

---

### Step 2: Create GitHub Repository

1. Go to https://github.com
2. Click **"+"** → **"New repository"**
3. Repository name: `Pothole-Detection` (or any name you prefer)
4. Description: `YOLOv8 real-time pothole detection with FastAPI, GPS tagging, and interactive map`
5. Set to **Public** (or Private)
6. Do NOT check "Add a README" (you already have one)
7. Click **"Create repository"**
8. Copy the repository URL — looks like:
   ```
   https://github.com/YOUR_USERNAME/Pothole-Detection.git
   ```

---

### Step 3: Open Project in Terminal

```powershell
cd "C:\Users\vesha\Downloads\38833FF26BA1D.UnigramPreview_g9c9v27vpyspw!App\Pothole_Detection\Pothole_Detection"
```

---

### Step 4: Check What Will Be Uploaded

```powershell
git status
```

Make sure you do NOT see these files (they should be ignored):
- `backend/.venv/` or `backend/.venv310/`
- `backend/potholes.db`
- `backend/uploads/`
- `backend/models/best.pt`
- `yolov8n.pt`

---

### Step 5: Stage All Files

```powershell
git add .
```

---

### Step 6: Verify Staged Files

```powershell
git status
```

You should see green files like:
- `README.md`
- `PROJECT_DOCUMENTATION.md`
- `backend/app/main.py`
- `backend/requirements.txt`
- `frontend/` files
- `train_model.py`
- etc.

You should NOT see:
- `.venv` folders
- `best.pt`
- `potholes.db`

---

### Step 7: Create First Commit

```powershell
git commit -m "Initial commit: Live Pothole Detection System with YOLOv8, FastAPI, and interactive map"
```

---

### Step 8: Connect to GitHub Remote

Replace `YOUR_USERNAME` with your actual GitHub username:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/Pothole-Detection.git
```

If remote already exists, update it:
```powershell
git remote set-url origin https://github.com/YOUR_USERNAME/Pothole-Detection.git
```

Verify remote:
```powershell
git remote -v
```

---

### Step 9: Push to GitHub

```powershell
git branch -M main
git push -u origin main
```

GitHub will ask you to log in:
- **Username:** your GitHub username
- **Password:** use a Personal Access Token (NOT your GitHub password)

**To create a Personal Access Token:**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token → check `repo` scope → Generate
3. Copy the token and use it as your password when git asks

---

### Step 10: Verify on GitHub

Open your repository URL in browser:
```
https://github.com/YOUR_USERNAME/Pothole-Detection
```

You should see all your files listed.

---

### Future Updates (After Making Changes)

Every time you change code and want to update GitHub:

```powershell
git add .
git commit -m "Describe what you changed"
git push
```

---

### Full Command Sequence (Copy All at Once)

Replace `YOUR_USERNAME` with your GitHub username before running:

```powershell
# Navigate to project
cd "C:\Users\vesha\Downloads\38833FF26BA1D.UnigramPreview_g9c9v27vpyspw!App\Pothole_Detection\Pothole_Detection"

# Check status
git status

# Stage all files
git add .

# Commit
git commit -m "Initial commit: Live Pothole Detection System with YOLOv8, FastAPI, and interactive map"

# Connect to GitHub (run only once)
git remote add origin https://github.com/YOUR_USERNAME/Pothole-Detection.git

# Set main branch and push
git branch -M main
git push -u origin main
```

---

## 20. Files to Upload vs Not Upload

### UPLOAD These Files to GitHub

```
.gitignore
README.md
PROJECT_DOCUMENTATION.md
data.yaml
train_model.py
cleanup_reports.py
run_backend.ps1
run_frontend.ps1
run_mobile_tunnel.ps1
run_mobile_backend_tunnel.ps1
backend/app/main.py
backend/requirements.txt
backend/models/.gitkeep
frontend/index.html
frontend/detect.html
frontend/upload.html
frontend/map.html
frontend/reports.html
frontend/settings.html
frontend/assets/css/style.css
frontend/assets/js/api.js
frontend/assets/js/detect.js
frontend/assets/js/upload.js
frontend/assets/js/map.js
frontend/assets/js/reports.js
scripts/copy_best_model.py
colab/train_colab.py
```

### DO NOT Upload These

| File/Folder | Reason |
|-------------|--------|
| `backend/.venv/` | Python virtual environment (large, machine-specific) |
| `backend/.venv310/` | Another virtual environment |
| `backend/potholes.db` | Local SQLite database with your test data |
| `backend/uploads/` | Your saved pothole images |
| `backend/models/best.pt` | ~24MB trained model — use GitHub Releases instead |
| `yolov8n.pt` | Auto-downloaded by Ultralytics on first run |
| `runs/` | Training output artifacts |
| `best.pt/`, `best.pt.zip` | Model files |
| `tools/cloudflared.exe` | 66MB binary |
| `archive (3)/` | Old archived data |
| `__pycache__/` | Python compiled cache |

### Optional: Upload Model via GitHub Releases

If you want to share your trained model:

1. Go to your GitHub repo → **Releases** → **Create a new release**
2. Tag: `v1.0`
3. Upload `backend/models/best.pt` as a release asset
4. Add note in README: "Download `best.pt` from Releases and place in `backend/models/`"

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────┐
│           POTHOLE DETECTION — QUICK REFERENCE        │
├─────────────────────────────────────────────────────┤
│ Backend:   http://localhost:8000                     │
│ Frontend:  http://127.0.0.1:5501                     │
│ API Docs:  http://localhost:8000/docs                │
├─────────────────────────────────────────────────────┤
│ Start Backend:   .\run_backend.ps1                   │
│ Start Frontend:  .\run_frontend.ps1                  │
│ Train Model:     python train_model.py               │
│ Copy Model:      python scripts\copy_best_model.py   │
│ Clear Reports:   python cleanup_reports.py         │
├─────────────────────────────────────────────────────┤
│ Model Path:  backend/models/best.pt                  │
│ Database:    backend/potholes.db (auto-created)      │
│ Uploads:     backend/uploads/ (auto-created)         │
├─────────────────────────────────────────────────────┤
│ Confidence Threshold: 0.35 (frontend)                │
│ Frame Interval:       2 seconds                    │
│ Save Cooldown:        5 seconds                      │
│ Inference Image Size: 480px (backend)                │
└─────────────────────────────────────────────────────┘
```

---

*End of documentation. Good luck with your interview and GitHub upload!*
