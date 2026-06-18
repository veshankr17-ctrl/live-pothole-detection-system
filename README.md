# Live Pothole Detection System using YOLOv8

## Overview

The Live Pothole Detection System is a computer vision-based web application that detects potholes from camera input using the YOLOv8 object detection model. The system captures pothole locations using browser geolocation, stores reports in a database, and visualizes detected potholes on an interactive map.

This project aims to assist in road condition monitoring by enabling automated pothole reporting and location tracking.

---

## Features

* Real-time pothole detection using YOLOv8
* Browser camera integration
* Automatic GPS location capture
* Confidence score reporting
* Interactive pothole map visualization
* Report history management
* Mobile device support
* FastAPI backend for inference and data handling
* SQLite database for report storage
* Leaflet and OpenStreetMap integration

---

## System Architecture

Frontend:

* HTML
* CSS
* JavaScript

Backend:

* FastAPI
* Python

Machine Learning:

* YOLOv8 (Ultralytics)

Database:

* SQLite

Mapping:

* Leaflet.js
* OpenStreetMap

---

## Project Structure

```text
live-pothole-detection-system/
│
├── backend/
│   ├── app/
│   │   └── main.py
│   ├── models/
│   └── requirements.txt
│
├── frontend/
│   ├── assets/
│   │   ├── css/
│   │   └── js/
│   ├── index.html
│   ├── detect.html
│   ├── map.html
│   ├── reports.html
│   ├── settings.html
│   └── upload.html
│
├── scripts/
│   └── copy_best_model.py
│
├── colab/
│   └── train_colab.py
│
├── train_model.py
├── data.yaml
├── PROJECT_DOCUMENTATION.md
└── README.md
```

---

## How It Works

1. User opens the web application.
2. Browser requests camera and location permissions.
3. Video frames are captured periodically.
4. Frames are sent to the FastAPI backend.
5. YOLOv8 performs pothole detection.
6. Bounding boxes are displayed on the screen.
7. Detected potholes are automatically saved with:

   * Confidence score
   * Timestamp
   * Latitude
   * Longitude
8. Stored reports are displayed on:

   * Reports page
   * Interactive map page

---

## Installation and Setup

### Clone Repository

```bash
git clone https://github.com/veshankr17-ctrl/live-pothole-detection-system.git
cd live-pothole-detection-system
```

### Backend Setup

```bash
cd backend

python -m venv .venv

.venv\Scripts\activate

pip install -r requirements.txt
```

### Run Backend

```bash
uvicorn app.main:app --reload
```

Backend will start at:

```text
http://127.0.0.1:8000
```

---

### Frontend Setup

Open a new terminal:

```bash
cd frontend

python -m http.server 5500
```

Open:

```text
http://127.0.0.1:5500
```

---

## Model Training

Install Ultralytics:

```bash
pip install ultralytics
```

Train the model:

```bash
python train_model.py
```

The trained model will be generated in:

```text
runs/pothole_yolov8n/weights/best.pt
```

Copy the trained model:

```bash
python scripts/copy_best_model.py
```

---

## API Endpoints

### Health Check

```http
GET /health
```

### Pothole Detection

```http
POST /predict
```

### Save Report

```http
POST /reports
```

### Get Reports

```http
GET /reports
```

### Map Data

```http
GET /map-points
```

---

## Technologies Used

* Python
* FastAPI
* YOLOv8
* OpenCV
* SQLite
* HTML
* CSS
* JavaScript
* Leaflet.js
* OpenStreetMap

---

## Future Enhancements

* Cloud database integration
* Cloud image storage
* Address extraction through reverse geocoding
* Advanced report filtering
* Real-time dashboard analytics
* Mobile application version

---

## Project Outcome

The system successfully detects potholes using a trained YOLOv8 model, records their geographic locations, stores reports, and visualizes affected areas through an interactive map interface, providing a practical solution for road condition monitoring and reporting.
