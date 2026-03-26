import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

// 🔹 Options Swagger
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Document Generator API",
      version: "1.0.0",
      description: "API pour générer des documents en batch (CERFA, conventions).",
    },
    servers: [
      { url: "http://localhost:3000/api" },
    ],
  },
  // 🔹 Chemin vers les fichiers JS compilés (dist)
  apis: [path.join(__dirname, "../routes/*.js")],
};

// 🔹 Génération des specs
const specs = swaggerJsdoc(options);

export { swaggerUi, specs };