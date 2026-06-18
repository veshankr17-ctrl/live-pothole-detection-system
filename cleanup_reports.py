#!/usr/bin/env python3
"""
Cleanup script to delete all test reports from the database.
Run this to clear out unnecessary test reports before deploying.
"""

import sqlite3
from pathlib import Path
import shutil

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "backend" / "potholes.db"
UPLOAD_DIR = BASE_DIR / "backend" / "uploads"


def cleanup_all_reports():
    """Delete all reports from the database and their associated images."""
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        return False
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get all image paths
        cursor.execute("SELECT image_path FROM reports")
        rows = cursor.fetchall()
        deleted_count = len(rows)
        
        if deleted_count == 0:
            print("✅ No reports to delete. Database is already clean!")
            conn.close()
            return True
        
        # Delete images from disk
        deleted_images = 0
        for row in rows:
            image_path = row[0]
            if image_path:
                file_path = BASE_DIR / image_path.lstrip("/")
                if file_path.exists():
                    try:
                        file_path.unlink()
                        deleted_images += 1
                    except Exception as e:
                        print(f"⚠️  Could not delete image {image_path}: {e}")
        
        # Delete all reports from database
        cursor.execute("DELETE FROM reports")
        conn.commit()
        conn.close()
        
        print(f"✅ Cleanup Complete!")
        print(f"   - Deleted {deleted_count} reports from database")
        print(f"   - Deleted {deleted_images} image files from disk")
        return True
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        return False


def get_report_count():
    """Get the number of reports currently in the database."""
    if not DB_PATH.exists():
        return 0
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM reports")
        count = cursor.fetchone()[0]
        conn.close()
        return count
    except:
        return 0


if __name__ == "__main__":
    print("=" * 50)
    print("Pothole Detection - Report Cleanup Tool")
    print("=" * 50)
    
    current_count = get_report_count()
    print(f"\n📊 Current reports in database: {current_count}")
    
    if current_count > 0:
        response = input(f"\n🗑️  Delete all {current_count} reports? (yes/no): ").strip().lower()
        if response == "yes":
            cleanup_all_reports()
        else:
            print("❌ Cleanup cancelled.")
    else:
        print("✅ Database is already clean!")
    
    print("\n" + "=" * 50)
    print("Done!")
    print("=" * 50)
