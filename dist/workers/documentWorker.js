"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const Document_1 = __importDefault(require("../models/Document"));
const Batch_1 = __importDefault(require("../models/Batch"));
const pdf_lib_1 = require("pdf-lib");
const mongodb_1 = require("mongodb");
const database_1 = require("../config/database");
const worker_threads_1 = require("worker_threads");
// 🔹 Précompilation du template PDF (1 fois)
let cachedTemplate = null;
async function getPdfTemplate() {
    if (!cachedTemplate) {
        cachedTemplate = await pdf_lib_1.PDFDocument.create();
        const page = cachedTemplate.addPage();
        const font = await cachedTemplate.embedFont(pdf_lib_1.StandardFonts.Helvetica);
        page.drawText("Generated Document Template", { x: 50, y: 750, size: 18, font });
    }
    return cachedTemplate;
}
// ===========================
// Worker BullMQ
// ===========================
exports.documentWorker = new bullmq_1.Worker("documents", async (job) => {
    const { documentId, userId, batchId } = job.data;
    console.log(`⚡ Processing document ${documentId} for user ${userId}`);
    try {
        // 🔹 Génération PDF dans un thread séparé avec timeout
        const pdfBuffer = await generatePdfThreaded(documentId, userId, 5000); // 5s timeout
        // 🔹 Streaming PDF vers GridFS
        const db = (0, database_1.getDb)();
        const bucket = new mongodb_1.GridFSBucket(db, { bucketName: "documents" });
        const uploadStream = bucket.openUploadStream(`${documentId}.pdf`);
        uploadStream.end(pdfBuffer);
        // 🔹 Mise à jour document
        await Document_1.default.findOneAndUpdate({ documentId }, { status: "completed", pdfUrl: `${documentId}.pdf` });
        console.log(`✅ Document ${documentId} completed`);
        // 🔹 Vérifier si batch complet
        const docs = await Document_1.default.find({ batchId });
        const allCompleted = docs.every(d => d.status === "completed");
        if (allCompleted) {
            const result = await Batch_1.default.findOneAndUpdate({ batchId, status: { $ne: "completed" } }, { status: "completed" });
            if (result)
                console.log(`🎯 Batch ${batchId} completed`);
        }
    }
    catch (err) {
        console.error(`❌ Error processing document ${documentId}`, err);
        await Document_1.default.findOneAndUpdate({ documentId }, { status: "failed" });
        throw err; // BullMQ gère retry/backoff
    }
}, { connection: redis_1.connection, concurrency: 5 } // ajustable
);
// ===========================
// Génération PDF Threaded avec timeout
// ===========================
async function generatePdfThreaded(documentId, userId, timeoutMs) {
    return new Promise((resolve, reject) => {
        const worker = new worker_threads_1.Worker(`
      const { parentPort } = require('worker_threads');
      const { PDFDocument, StandardFonts } = require('pdf-lib');

      parentPort.on('message', async (data) => {
        try {
          const pdfDoc = await PDFDocument.create();

          // 🔹 Reutilisation du template
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
        // Timeout 5s
        const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error(`PDF generation timeout for document ${documentId}`));
        }, timeoutMs);
        worker.on("message", (msg) => {
            clearTimeout(timer);
            if (msg.error)
                return reject(new Error(msg.error));
            resolve(msg.pdfBytes);
        });
        worker.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
        worker.on("exit", (code) => {
            clearTimeout(timer);
            if (code !== 0)
                reject(new Error(`Worker stopped with exit code ${code}`));
        });
        worker.postMessage({ documentId, userId });
    });
}
exports.documentWorker.on("completed", job => {
    if (job?.data)
        console.log(`🎯 Job completed for document ${job.data.documentId}`);
});
exports.documentWorker.on("failed", (job, err) => {
    if (job?.data)
        console.error(`❌ Job failed for document ${job.data.documentId}`, err);
});
console.log("⚡ Document worker running...");
