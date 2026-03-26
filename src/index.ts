import express from "express";
import dotenv from "dotenv";
import { connectDB, getDb } from "./config/database";
import "./workers/documentWorker";
import documentRoutes from "./routes/documentRoutes";
import { swaggerUi, specs } from "./config/swagger";
import dashboardRouter from "./routes/dashboard";

dotenv.config();
const app = express();

app.use(express.json());

// 🔥 Connexion MongoDB
connectDB();

// 🔹 Swagger UI
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(specs));

// 🔹 Routes API
app.use("/api/documents", documentRoutes);

app.get("/health", async (req, res) => {
  let mongoUp = false;
  let redisUp = false;

  // 🔹 Test MongoDB avec client temporaire
  try {
    const { MongoClient } = await import("mongodb");
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/test";
    const mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 1000 });
    await mongoClient.connect();
    await mongoClient.db().command({ ping: 1 });
    mongoUp = true;
    await mongoClient.close();
  } catch (err) {
    mongoUp = false;
  }

  // 🔹 Test Redis avec client temporaire
  try {
    const IORedis = (await import("ioredis")).default;
    const redisClient = new IORedis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      connectTimeout: 1000,
      retryStrategy: () => null, // pas de retry
    });
    await redisClient.ping();
    redisUp = true;
    redisClient.disconnect();
  } catch (err) {
    redisUp = false;
  }

  res.json({
    status: mongoUp && redisUp ? "ok" : "partial",
    mongo: mongoUp ? "up" : "down",
    redis: redisUp ? "up" : "down",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// Route test simple
app.get("/", (req, res) => res.send("API running 🚀"));

// 🔹 Endpoint mock externe
app.get("/api/externalMock", (req, res) => {
  res.json({ success: true });
});

// 🔥 Gestion arrêt propre (graceful shutdown)
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM reçu, arrêt propre...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT reçu, arrêt...");
  process.exit(0);
});

//dashboard
app.use("/dashboard", dashboardRouter);

// 🔥 Lancement serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});