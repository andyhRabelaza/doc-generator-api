import axios from "axios";

const API_URL = "http://localhost:3000";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 🔹 Générer liste userIds
function generateUserIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `user_${i}`);
}

async function runBenchmark() {
  const totalDocs = 1000;

  console.log(`🚀 Lancement benchmark pour ${totalDocs} documents...\n`);

  const startTime = Date.now();

  let successRequests = 0;
  let failedRequests = 0;

  try {
    // 🔥 1. Générer les userIds
    const userIds = generateUserIds(totalDocs);

    // 🔥 2. Création du batch
    const batchRes = await axios.post(`${API_URL}/api/documents/batch`, {
      userIds,
    });

    const batchId = batchRes.data.batchId;
    console.log(`📦 Batch créé: ${batchId}`);

    // 🔥 3. Polling
    let status = "pending";
    let completed = 0;
    let failed = 0;

    while (status !== "completed") {
      try {
        const res = await axios.get(`${API_URL}/api/documents/batch/${batchId}`);

        status = res.data.status;

        const docs = res.data.documents;
        completed = docs.filter((d: any) => d.status === "completed").length;
        failed = docs.filter((d: any) => d.status === "failed").length;

        console.log(
          `⏱️ Statut: ${status} | Completed: ${completed} | Failed: ${failed}`
        );

        successRequests++;
      } catch (err: any) {
        failedRequests++;
        console.warn("⚠️ Erreur polling:", err.message);
      }

      await sleep(1000);
    }

    const duration = (Date.now() - startTime) / 1000;

    console.log("\n✅ Batch terminé !");
    console.log(`⏱️ Temps total: ${duration.toFixed(2)} sec`);
    console.log(`📊 Total: ${totalDocs}`);
    console.log(`✔️ Completed: ${completed}`);
    console.log(`❌ Failed: ${failed}`);

    console.log("\n📈 Stats:");
    console.log(`✔️ Requêtes OK: ${successRequests}`);
    console.log(`❌ Requêtes KO: ${failedRequests}`);
    console.log(`⚡ Débit: ${(totalDocs / duration).toFixed(2)} docs/sec`);

  } catch (err: any) {
    console.error("❌ Erreur benchmark:", err.response?.data || err.message);
  }
}

runBenchmark();