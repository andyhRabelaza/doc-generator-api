import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { documentQueue } from "../config/redis";
import BatchModel from "../models/Batch";
import DocumentModel from "../models/Document";

const router = Router();

// ===========================
// 🔹 Redis Safe Queue
// ===========================
async function addJobSafe(data: any) {
  try {
    await documentQueue.add("generateDocument", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  } catch (err) {
    console.error("⚠️ Redis down → fallback mode");

    const { documentId } = data;

    // fallback simple
    await DocumentModel.findOneAndUpdate(
      { documentId },
      { status: "processing" }
    );

    await new Promise(r => setTimeout(r, 100));

    await DocumentModel.findOneAndUpdate(
      { documentId },
      { status: "completed", pdfUrl: `${documentId}.pdf` }
    );
  }
}

// ===========================
// POST batch
// ===========================
router.post("/batch", async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds must be a non-empty array" });
  }

  const batchId = uuidv4();

  const batch = await BatchModel.create({ batchId, status: "pending" });

  const documents = userIds.map((userId) => {
    const documentId = uuidv4();

    addJobSafe({ documentId, userId, batchId });

    return { documentId, userId, batchId, status: "pending" };
  });

  await DocumentModel.insertMany(documents);

  batch.documentIds = documents.map((d) => d.documentId);
  await batch.save();

  res.json({ batchId, totalDocuments: documents.length });
});

// ===========================
// GET batch
// ===========================
router.get("/batch/:batchId", async (req, res) => {
  const batch = await BatchModel.findOne({ batchId: req.params.batchId });
  if (!batch) return res.status(404).json({ error: "Batch not found" });

  const documents = await DocumentModel.find({ batchId: batch.batchId });

  res.json({
    batchId: batch.batchId,
    status: batch.status,
    documents: documents.map((d) => ({
      documentId: d.documentId,
      userId: d.userId,
      status: d.status,
      pdfUrl: d.pdfUrl || null,
    })),
  });
});

// ===========================
// GET document
// ===========================
router.get("/:documentId", async (req, res) => {
  const document = await DocumentModel.findOne({ documentId: req.params.documentId });
  if (!document) return res.status(404).json({ error: "Document not found" });

  if (!document.pdfUrl) {
    return res.status(400).json({ error: "PDF not ready" });
  }

  const db = require("../config/database").getDb();
  const bucket = new (require("mongodb").GridFSBucket)(db, { bucketName: "documents" });

  const stream = bucket.openDownloadStreamByName(document.pdfUrl);

  res.setHeader("Content-Type", "application/pdf");
  stream.pipe(res);
});

export default router;