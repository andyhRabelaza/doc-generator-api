"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
require("./workers/documentWorker");
const documentRoutes_1 = __importDefault(require("./routes/documentRoutes"));
const swagger_1 = require("./config/swagger");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
// 🔥 Connexion MongoDB
(0, database_1.connectDB)();
// 🔹 Swagger UI
app.use("/api/docs", swagger_1.swaggerUi.serve, swagger_1.swaggerUi.setup(swagger_1.specs));
// 🔹 Routes API
app.use("/api/documents", documentRoutes_1.default);
// 🔥 Health check (IMPORTANT pour le test)
app.get("/health", async (req, res) => {
    res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date(),
    });
});
// Route test
app.get("/", (req, res) => res.send("API running 🚀"));
// 🔥 Gestion arrêt propre (graceful shutdown)
process.on("SIGTERM", () => {
    console.log("🛑 SIGTERM reçu, arrêt propre...");
    process.exit(0);
});
process.on("SIGINT", () => {
    console.log("🛑 SIGINT reçu, arrêt...");
    process.exit(0);
});
// 🔥 Lancement serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
