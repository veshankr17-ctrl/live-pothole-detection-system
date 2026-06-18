# Live Pothole Detection System

Web app for real-time and image-based pothole detection using YOLOv8.

**Features:** live camera detection, image upload, bounding-box overlay, auto-save reports, map pins with GPS.

## Project Structure

```
Pothole_Detection/
├── backend/
│   ├── app/main.py          # FastAPI server + YOLO inference
│   ├── models/              # Place trained best.pt here
│   └── requirements.txt
├── frontend/
│   ├── *.html               # App pages
│   └── assets/css, js/      # Styles and client logic
├── scripts/copy_best_model.py
├── colab/train_colab.py     # Optional Colab training script
├── train_model.py           # Local training
├── data.yaml                # Dataset config for training
├── cleanup_reports.py       # Clear local test reports
├── run_backend.ps1
├── run_frontend.ps1
├── run_mobile_tunnel.ps1
└── run_mobile_backend_tunnel.ps1
```

## Setup

### 1. Install backend dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Add the trained model

Copy your trained weights to:

```
backend/models/best.pt
```

If missing, the API falls back to the default `yolov8n.pt` (downloaded automatically on first run).

After local training:

```powershell
python scripts\copy_best_model.py
```

### 3. Run locally

```powershell
.\run_backend.ps1
.\run_frontend.ps1
```

Open: `http://127.0.0.1:5501`

## Mobile Access

**Same Wi-Fi:** open `http://<your-laptop-ip>:5501` on your phone.

**HTTPS tunnel (camera on mobile):** install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/), then:

```powershell
.\run_mobile_backend_tunnel.ps1
.\run_mobile_tunnel.ps1
```

Open on phone:

```
https://FRONTEND.trycloudflare.com/detect.html?api=https://BACKEND.trycloudflare.com
```

## Training

Requires dataset folders in project root:

- `train/images`, `train/labels`
- `valid/images`, `valid/labels`

```powershell
python train_model.py
python scripts\copy_best_model.py
```

## API Endpoints

| Method | Endpoint     | Description        |
|--------|--------------|--------------------|
| GET    | `/health`    | Health check       |
| POST   | `/predict`   | Detect potholes    |
| POST   | `/reports`   | Save a report      |
| GET    | `/reports`   | List reports       |
| GET    | `/map-points`| Map pin coordinates|

## Pages

- `frontend/detect.html` — live + upload detection
- `frontend/map.html` — pothole map
- `frontend/reports.html` — saved reports
- `frontend/settings.html` — API URL settings
