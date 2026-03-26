"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const API_BASE = "http://localhost:3000/api/documents"; // adapte si nécessaire
// 🔹 Création d'un batch de 1000 utilisateurs fictifs
const userIds = Array.from({ length: 1000 }, (_, i) => `user${i + 1}`);
async function runBenchmark() {
    try {
        console.log("🚀 Lancement du batch de 1000 documents...");
        const startTime = Date.now();
        // 🔹 Créer le batch
        const response = await axios_1.default.post(`${API_BASE}/batch`, { userIds });
        const batchId = response.data.batchId;
        console.log(`📦 Batch créé avec ID: ${batchId}`);
        let completed = false;
        // 🔹 Polling pour vérifier le statut du batch
        while (!completed) {
            const res = await axios_1.default.get(`${API_BASE}/batch/${batchId}`);
            const status = res.data.status;
            const docs = res.data.documents;
            const completedDocs = docs.filter(d => d.status === "completed").length;
            const failedDocs = docs.filter(d => d.status === "failed").length;
            console.log(`⏱️  Statut batch: ${status}, Completed: ${completedDocs}, Failed: ${failedDocs}`);
            if (status === "completed" || status === "failed") {
                completed = true;
                const endTime = Date.now();
                console.log(`✅ Batch terminé en ${(endTime - startTime) / 1000} secondes`);
                console.log(`📊 Total documents: ${docs.length}, Completed: ${completedDocs}, Failed: ${failedDocs}`);
            }
            else {
                await new Promise(r => setTimeout(r, 2000)); // attendre 2s avant le prochain polling
            }
        }
    }
    catch (err) {
        console.error("❌ Erreur durant le benchmark :", err);
    }
}
runBenchmark();
