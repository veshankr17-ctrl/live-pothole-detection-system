const reportsContainer = document.getElementById("reports");
const reportSearch = document.getElementById("report-search");
const deleteAllBtn = document.getElementById("delete-all-btn");
let allReports = [];

function renderReports(reports) {
  if (!reports.length) {
    reportsContainer.innerHTML = "<p>No reports saved yet. Start live detection first.</p>";
    return;
  }
  reportsContainer.innerHTML = reports
    .map((r) => {
      const imageUrl = getImageUrl(r.image_path);
      return `
        <div class="card report-card">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <p><b>Report ID:</b> ${r.id}</p>
              <p><b>Confidence:</b> ${(r.confidence * 100).toFixed(1)}%</p>
              <p><b>Detections:</b> ${r.detections_count}</p>
              <p><b>Detected at:</b> ${new Date(r.detected_at).toLocaleString()}</p>
              <p><b>Location:</b> ${r.latitude ?? "N/A"}, ${r.longitude ?? "N/A"}</p>
            </div>
            <button class="btn secondary delete-report-btn" data-report-id="${r.id}" style="background-color: #ef4444; padding: 8px 12px; font-size: 12px; margin-left: 10px;">Delete</button>
          </div>
          <img class="report" src="${imageUrl}" alt="pothole frame"/>
        </div>
      `;
    })
    .join("");
  
  // Add delete event listeners
  document.querySelectorAll(".delete-report-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const reportId = btn.getAttribute("data-report-id");
      if (confirm(`Delete report ${reportId}?`)) {
        try {
          btn.disabled = true;
          btn.textContent = "Deleting...";
          await deleteReportById(reportId);
          await loadReports();
        } catch (err) {
          alert(`Error deleting report: ${err.message}`);
          btn.disabled = false;
          btn.textContent = "Delete";
        }
      }
    });
  });
}

async function loadReports() {
  allReports = await fetchReportsMerged();
  renderReports(allReports);
}

loadReports().catch((e) => {
  reportsContainer.innerHTML = `<p class="err">Failed loading reports: ${e.message}</p>`;
});

if (reportSearch) {
  reportSearch.addEventListener("input", () => {
    const query = reportSearch.value.trim().toLowerCase();
    if (!query) {
      renderReports(allReports);
      return;
    }
    const filtered = allReports.filter((r) => (r.id || "").toLowerCase().includes(query));
    renderReports(filtered);
  });
}

if (deleteAllBtn) {
  deleteAllBtn.addEventListener("click", async () => {
    if (confirm("⚠️ Delete ALL reports? This cannot be undone!")) {
      try {
        deleteAllBtn.disabled = true;
        deleteAllBtn.textContent = "Deleting all...";
        const result = await deleteAllReports();
        alert(`✅ Deleted ${result.deleted_count} reports`);
        await loadReports();
        deleteAllBtn.disabled = false;
        deleteAllBtn.textContent = "Delete All Reports";
      } catch (err) {
        alert(`Error deleting reports: ${err.message}`);
        deleteAllBtn.disabled = false;
        deleteAllBtn.textContent = "Delete All Reports";
      }
    }
  });
}
