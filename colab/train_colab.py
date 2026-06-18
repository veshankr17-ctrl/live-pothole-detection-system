from ultralytics import YOLO

# Train model with more epochs for better accuracy
model = YOLO("yolov8n.pt")
model.train(
    data="/content/Pothole_Detection/Pothole_Detection/data.yaml",
    epochs=120,  # Increased from 35 to 120 for better accuracy
    imgsz=640,
    batch=16,
    project="/content/runs",
    name="pothole_colab",
)
