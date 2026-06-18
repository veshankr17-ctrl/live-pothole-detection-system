import argparse
import json
from pathlib import Path

from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser(description="Train YOLO model for pothole detection.")
    parser.add_argument("--epochs", type=int, default=120, help="Number of training epochs.")
    parser.add_argument("--imgsz", type=int, default=640, help="Training image size.")
    parser.add_argument("--batch", type=int, default=16, help="Batch size.")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model checkpoint.")
    args = parser.parse_args()

    model = YOLO(args.model)
    results = model.train(
        data="data.yaml",
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project="runs",
        name="pothole_yolov8n",
    )

    metrics = None
    if hasattr(results, "metrics"):
        metrics = results.metrics
    elif hasattr(results, "boxes") and hasattr(results.boxes, "data"):
        metrics = {"boxes": str(results.boxes.data)}

    if metrics is not None:
        print("\n=== Training metrics ===")
        try:
            print(json.dumps(metrics, indent=2, default=str))
        except Exception:
            print(metrics)

        metrics_path = Path("runs") / "pothole_yolov8n" / "train_metrics.json"
        metrics_path.parent.mkdir(parents=True, exist_ok=True)
        with metrics_path.open("w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2, default=str)
        print(f"Saved model metrics to: {metrics_path.resolve()}")
    else:
        print("\nTraining complete, but no metrics object was found on the result object.")
        print("Open the generated run folder under runs/pothole_yolov8n to inspect YOLO logs.")


if __name__ == "__main__":
    main()
