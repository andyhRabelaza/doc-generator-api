import { Worker, Job } from "bullmq";
import { connection } from "../config/redis";
import DocumentModel from "../models/Document";
import BatchModel from "../models/Batch";
import { GridFSBucket } from "mongodb";
import { getDb } from "../config/database";
import { Worker as ThreadWorker } from "worker_threads";
import { circuitBreakerRequest } from "../utils/circuitBreaker";
import { documentsGeneratedTotal, batchProcessingDuration } from "../config/metrics";

// ===========================
// 🔹 Safe Mongo Helpers
// ===========================
async function safeUpdateDocument(documentId: string, update: any) {
  try {
    await DocumentModel.findOneAndUpdate({ documentId }, update);
  } catch (err) {
    console.error(JSON.stringify({
      level: "error",
      message: "Mongo update failed",
      documentId,
      error: (err as Error).message
    }));
  }
}

// ===========================
// Worker BullMQ
// ===========================
export const documentWorker = new Worker(
  "documents",
  async (job: Job) => {
    const { documentId, userId, batchId } = job.data;

    const batchTimer = batchProcessingDuration.startTimer({ batchId });

    try {
      // 🔹 Circuit breaker
      const externalData = await circuitBreakerRequest<{ success: boolean }>(
        "http://localhost:3000/api/externalMock",
        undefined,
        { timeoutMs: 3000, maxRetries: 2 }
      );

      if (!externalData?.success) {
        console.warn(`⚠️ External API failed`);
      }

      // 🔹 Génération PDF
      const pdfBuffer = await generatePdfThreaded(documentId, userId, 5000);

      // 🔹 Upload GridFS (safe)
      try {
        const db = getDb();
        const bucket = new GridFSBucket(db, { bucketName: "documents" });
        const uploadStream = bucket.openUploadStream(`${documentId}.pdf`);
        uploadStream.end(pdfBuffer);
      } catch (err) {
        console.error("Mongo GridFS error", err);
      }

      // 🔹 Update document
      await safeUpdateDocument(documentId, {
        status: "completed",
        pdfUrl: `${documentId}.pdf`,
      });

      documentsGeneratedTotal.inc({ status: "success" });

      // 🔹 Optimisation batch (NO find())
      try {
        const remaining = await DocumentModel.countDocuments({
          batchId,
          status: { $ne: "completed" }
        });

        if (remaining === 0) {
          await BatchModel.findOneAndUpdate(
            { batchId, status: { $ne: "completed" } },
            { status: "completed" }
          );
        }
      } catch (err) {
        console.error("Mongo batch check error", err);
      }

    } catch (err) {
      console.error(`❌ Worker error ${documentId}`, err);

      await safeUpdateDocument(documentId, { status: "failed" });
      documentsGeneratedTotal.inc({ status: "failed" });

      throw err;
    } finally {
      batchTimer();
    }
  },
  { connection, concurrency: 5 } // 🔥 augmenté
);

// ===========================
// PDF Thread
// ===========================
async function generatePdfThreaded(
  documentId: string,
  userId: string,
  timeoutMs: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const worker = new ThreadWorker(`
      const { parentPort } = require('worker_threads');
      const { PDFDocument, StandardFonts } = require('pdf-lib');

      parentPort.on('message', async (data) => {
        try {
          const pdfDoc = await PDFDocument.create();
          const page = pdfDoc.addPage();
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

          page.drawText("Generated Document", { x: 50, y: 750, size: 18, font });
          page.drawText("Document ID: " + data.documentId, { x: 50, y: 700, size: 12, font });
          page.drawText("User ID: " + data.userId, { x: 50, y: 680, size: 12, font });

          const pdfBytes = await pdfDoc.save();
          parentPort.postMessage({ pdfBytes: Buffer.from(pdfBytes) });
        } catch (err) {
          parentPort.postMessage({ error: err.toString() });
        }
      });
    `, { eval: true });

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error(`PDF timeout ${documentId}`));
    }, timeoutMs);

    worker.on("message", (msg) => {
      clearTimeout(timer);
      if (msg.error) return reject(new Error(msg.error));
      resolve(msg.pdfBytes);
    });

    worker.on("error", reject);

    worker.postMessage({ documentId, userId });
  });
}

console.log("⚡ Worker running...");