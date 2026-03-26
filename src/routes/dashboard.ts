// src/routes/dashboard.ts
import { Router } from "express";
import { documentQueue } from "../config/redis";
import BatchModel from "../models/Batch";
import DocumentModel from "../models/Document";

const router = Router();

// ===========================
// 🔹 Endpoint JSON pour métriques dynamiques
// ===========================
router.get("/metrics", async (req, res) => {
  try {
    const runningBatches = await BatchModel.countDocuments({
      status: { $in: ["pending", "processing"] },
    });

    const documentsGenerated = await DocumentModel.countDocuments({
      status: "completed",
    });

    const queueSize = await documentQueue.getWaitingCount();

    res.json({ runningBatches, documentsGenerated, queueSize });
  } catch (err) {
    console.error("Dashboard metrics error:", err);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// ===========================
// 🔹 Dashboard HTML
// ===========================
router.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>API Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; background: #f4f4f4; }
    h1 { text-align: center; }
    .metrics { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .metric { background: white; padding: 20px 40px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); width: 300px; text-align: center; font-size: 18px; }
  </style>
</head>
<body>
  <h1>API Dashboard</h1>
  <div class="metrics">
    <div class="metric" id="runningBatches">Batchs en cours: ...</div>
    <div class="metric" id="documentsGenerated">Documents générés: ...</div>
    <div class="metric" id="queueSize">Queue size: ...</div>
  </div>

  <script>
    async function fetchMetrics() {
      try {
        const res = await fetch("/dashboard/metrics");
        const data = await res.json();
        document.getElementById("runningBatches").textContent = "Batchs en cours: " + data.runningBatches;
        document.getElementById("documentsGenerated").textContent = "Documents générés: " + data.documentsGenerated;
        document.getElementById("queueSize").textContent = "Queue size: " + data.queueSize;
      } catch(err) {
        console.error("Failed to fetch metrics", err);
      }
    }

    setInterval(fetchMetrics, 1000);
    fetchMetrics();
  </script>
</body>
</html>
  `);
});

export default router;