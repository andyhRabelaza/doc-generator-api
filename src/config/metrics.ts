import { Request, Response } from "express";
import client, { Counter, Histogram, Gauge } from "prom-client";

// ✅ Compteurs et histogrammes
export const documentsGeneratedTotal = new Counter({
  name: "documents_generated_total",
  help: "Nombre total de documents générés",
  labelNames: ["status"], // success, failed
});

export const batchProcessingDuration = new Histogram({
  name: "batch_processing_duration_seconds",
  help: "Durée de traitement d'un batch",
  labelNames: ["batchId"],
  buckets: [1, 5, 10, 30, 60, 120],
});

export const queueSizeGauge = new Gauge({
  name: "queue_size",
  help: "Taille actuelle de la queue",
  labelNames: ["queue"],
});

// ✅ Middleware pour exposer les métriques Prometheus
export const metricsMiddleware = async (req: Request, res: Response) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err: any) {
    res.status(500).end(err.message);
  }
};