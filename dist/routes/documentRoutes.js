"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const redis_1 = require("../config/redis");
const Batch_1 = __importDefault(require("../models/Batch"));
const Document_1 = __importDefault(require("../models/Document"));
const router = (0, express_1.Router)();
// 🔹 Créer un batch et lancer les jobs
/**
 * @swagger
 * /documents/batch:
 *   post:
 *     summary: Crée un batch de documents
 *     description: Reçoit un tableau de userIds et crée un batch asynchrone
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Batch créé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 batchId:
 *                   type: string
 *                 totalDocuments:
 *                   type: integer
 */
router.post("/batch", async (req, res) => {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "userIds must be a non-empty array" });
    }
    const batchId = (0, uuid_1.v4)();
    const batch = await Batch_1.default.create({ batchId, status: "pending" });
    const documents = userIds.map((userId) => {
        const documentId = (0, uuid_1.v4)();
        // 🔹 Ajout dans la queue avec retry/backoff
        redis_1.documentQueue.add("generateDocument", { documentId, userId, batchId }, {
            attempts: 3,
            backoff: { type: "exponential", delay: 1000 },
        });
        return { documentId, userId, batchId, status: "pending" };
    });
    await Document_1.default.insertMany(documents);
    batch.documentIds = documents.map((d) => d.documentId);
    await batch.save();
    res.json({ batchId, totalDocuments: documents.length });
});
/**
 * @swagger
 * /documents/batch/{batchId}:
 *   get:
 *     summary: Récupère le statut d'un batch
 *     parameters:
 *       - in: path
 *         name: batchId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID du batch
 *     responses:
 *       200:
 *         description: Statut du batch et liste des documents
 */
router.get("/batch/:batchId", async (req, res) => {
    const batch = await Batch_1.default.findOne({ batchId: req.params.batchId });
    if (!batch)
        return res.status(404).json({ error: "Batch not found" });
    const documents = await Document_1.default.find({ batchId: batch.batchId });
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
/**
 * @swagger
 * /documents/{documentId}:
 *   get:
 *     summary: Télécharge le PDF d'un document
 *     parameters:
 *       - in: path
 *         name: documentId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID du document
 *     responses:
 *       200:
 *         description: PDF du document
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:documentId", async (req, res) => {
    const document = await Document_1.default.findOne({ documentId: req.params.documentId });
    if (!document)
        return res.status(404).json({ error: "Document not found" });
    if (!document.pdfUrl)
        return res.status(400).json({ error: "PDF not generated yet" });
    const db = require("../config/database").getDb();
    const bucket = new (require("mongodb").GridFSBucket)(db, { bucketName: "documents" });
    const downloadStream = bucket.openDownloadStreamByName(document.pdfUrl);
    res.setHeader("Content-Type", "application/pdf");
    downloadStream.pipe(res);
});
exports.default = router;
